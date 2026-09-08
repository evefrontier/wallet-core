import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type ChainEpochInfo,
  DEFAULT_RENEW_BEFORE_MS,
  EpochManager,
} from '#src/epoch'

const EPOCH_START = 1_700_000_000_000
const DURATION = 3_600_000

function chainInfo(overrides: Partial<ChainEpochInfo> = {}): ChainEpochInfo {
  return {
    currentEpoch: 100,
    epochDurationMs: DURATION,
    epochStartTimestampMs: EPOCH_START,
    ...overrides,
  }
}

class RetryTestEpochManager extends EpochManager {
  constructor(private readonly retryDelaysMs: number[]) {
    super()
  }

  protected override getRenewalRetryDelayMs(attempt: number): number {
    return this.retryDelaysMs[attempt] ?? this.retryDelaysMs.at(-1) ?? 100
  }
}

describe('EpochManager', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(EPOCH_START)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should compute state from fetched chain info on initialize', async () => {
    const manager = new EpochManager()
    const state = await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: 2,
    })

    expect(state.numericMaxEpoch).toBe(102)
    expect(state.maxEpochTimestampMs).toBe(EPOCH_START + DURATION * 3)
    manager.reset()
  })

  it('should throw when read before initialization', () => {
    const manager = new EpochManager()

    expect(() => manager.getState()).toThrow(
      'EpochManager must be initialized before use',
    )
  })

  it('should recompute relative timers on getState', async () => {
    const manager = new EpochManager()
    await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: 0,
      watchEpochTransitions: false,
    })

    const before = manager.getState().msUntilMaxEpoch
    vi.setSystemTime(EPOCH_START + 1_000)
    const after = manager.getState().msUntilMaxEpoch

    expect(after).toBe(before - 1_000)
    manager.reset()
  })

  it('should invoke onRenewalDue at the renewal deadline', async () => {
    const manager = new EpochManager()
    const onRenewalDue = vi.fn()
    const state = await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: 0,
      renewBeforeMs: 60_000,
      onRenewalDue,
      watchEpochTransitions: false,
    })

    await vi.advanceTimersByTimeAsync(
      state.renewAtTimestampMs - EPOCH_START - 1,
    )
    expect(onRenewalDue).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(onRenewalDue).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ reason: 'renewal_due' }),
    )
    manager.reset()
  })

  it('should report renewal callback failures via onError', async () => {
    const manager = new EpochManager()
    const failure = new Error('renewal failed')
    const onError = vi.fn()
    await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: 0,
      onRenewalDue: vi.fn().mockRejectedValueOnce(failure),
      onError,
      watchEpochTransitions: false,
    })

    await vi.advanceTimersByTimeAsync(DURATION)
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      failure,
      'renewal-callback',
      {
        message: 'epoch renewal callback failed',
        retryAttempt: 0,
      },
    )
    manager.reset()
  })

  it('should support existing two-argument onError callbacks', async () => {
    const manager = new EpochManager()
    const failure = new Error('renewal failed')
    const onError = vi.fn((_error: unknown, _context: string) => {})
    await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: 0,
      onRenewalDue: vi.fn().mockRejectedValueOnce(failure),
      onError,
      watchEpochTransitions: false,
    })

    await vi.advanceTimersByTimeAsync(DURATION)
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      failure,
      'renewal-callback',
      expect.objectContaining({ retryAttempt: 0 }),
    )
    manager.reset()
  })

  it('should retry failed renewal callbacks and stop after success', async () => {
    const manager = new RetryTestEpochManager([50, 100])
    const onRenewalDue = vi
      .fn()
      .mockRejectedValueOnce(new Error('transient 1'))
      .mockRejectedValueOnce(new Error('transient 2'))
      .mockResolvedValueOnce(undefined)
    const onError = vi.fn()

    await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(
        chainInfo({
          epochDurationMs: 1_000,
          epochStartTimestampMs: EPOCH_START,
        }),
      ),
      epochsFromCurrent: 0,
      renewBeforeMs: 200,
      renewJitterMs: 0,
      onRenewalDue,
      onError,
      watchEpochTransitions: false,
    })

    await vi.advanceTimersByTimeAsync(800)
    expect(onRenewalDue).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(50)
    expect(onRenewalDue).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(100)
    expect(onRenewalDue).toHaveBeenCalledTimes(3)
    await vi.advanceTimersByTimeAsync(500)

    expect(onRenewalDue).toHaveBeenCalledTimes(3)
    expect(onError).toHaveBeenCalledTimes(2)
    manager.reset()
  })

  it('should stop retrying when maxEpoch has elapsed', async () => {
    const manager = new RetryTestEpochManager([100])
    const onRenewalDue = vi.fn().mockRejectedValue(new Error('outage'))
    const onWarning = vi.fn()

    await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(
        chainInfo({
          epochDurationMs: 1_000,
          epochStartTimestampMs: EPOCH_START,
        }),
      ),
      epochsFromCurrent: 0,
      renewBeforeMs: 200,
      renewJitterMs: 0,
      onRenewalDue,
      onWarning,
      watchEpochTransitions: false,
    })

    await vi.advanceTimersByTimeAsync(1_800)
    expect(onRenewalDue).toHaveBeenCalledTimes(3)
    expect(onWarning).toHaveBeenCalledExactlyOnceWith(
      'skip renewal callback retry after maxEpoch elapsed',
      { currentEpoch: 100, maxEpoch: 100 },
    )
    manager.reset()
  })

  it('should cancel a pending renewal retry when stopped', async () => {
    const manager = new RetryTestEpochManager([100])
    const onRenewalDue = vi.fn().mockRejectedValue(new Error('outage'))

    await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(
        chainInfo({
          epochDurationMs: 1_000,
          epochStartTimestampMs: EPOCH_START,
        }),
      ),
      epochsFromCurrent: 0,
      renewBeforeMs: 200,
      renewJitterMs: 0,
      onRenewalDue,
      watchEpochTransitions: false,
    })

    await vi.advanceTimersByTimeAsync(800)
    manager.stop()
    await vi.advanceTimersByTimeAsync(1_000)

    expect(onRenewalDue).toHaveBeenCalledOnce()
    manager.reset()
  })

  it('should bound full-jitter retry delays using the injected retry randomness', async () => {
    const manager = new EpochManager()
    await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: 0,
      retryRandom: () => 0.5,
      watchEpochTransitions: false,
    })

    expect(
      (
        manager as unknown as {
          getRenewalRetryDelayMs: (attempt: number) => number
        }
      ).getRenewalRetryDelayMs(0),
    ).toBe(60_000)
    manager.reset()
  })

  it('should preserve the existing absoluteMaxEpoch clamp behavior', async () => {
    const manager = new EpochManager()
    const onRenewalDue = vi.fn()

    const state = await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: 2,
      absoluteMaxEpoch: 42,
      renewJitterMs: 0,
      onRenewalDue,
      watchEpochTransitions: false,
    })

    expect(state.numericMaxEpoch).toBe(100)
    await vi.advanceTimersByTimeAsync(DURATION - DEFAULT_RENEW_BEFORE_MS - 1)
    expect(onRenewalDue).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onRenewalDue).toHaveBeenCalledOnce()
    manager.reset()
  })

  it('should refresh after the epoch boundary and report the transition', async () => {
    const manager = new EpochManager()
    const onEpochChanged = vi.fn()
    const fetchEpoch = vi
      .fn()
      .mockResolvedValueOnce(chainInfo())
      .mockResolvedValue(
        chainInfo({
          currentEpoch: 101,
          epochStartTimestampMs: EPOCH_START + DURATION,
        }),
      )

    await manager.initialize({
      fetchEpoch,
      epochsFromCurrent: 0,
      onEpochChanged,
      epochTransitionBufferMs: 2_000,
    })

    await vi.advanceTimersByTimeAsync(DURATION + 2_000)
    expect(fetchEpoch).toHaveBeenCalledTimes(2)
    expect(onEpochChanged).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ previousEpoch: 100, currentEpoch: 101 }),
    )
    manager.reset()
  })

  it('should report epoch transition callback failures via onError', async () => {
    const manager = new EpochManager()
    const failure = new Error('epoch changed failed')
    const onError = vi.fn()
    const fetchEpoch = vi
      .fn()
      .mockResolvedValueOnce(chainInfo())
      .mockResolvedValue(
        chainInfo({
          currentEpoch: 101,
          epochStartTimestampMs: EPOCH_START + DURATION,
        }),
      )

    await manager.initialize({
      fetchEpoch,
      epochsFromCurrent: 0,
      onEpochChanged: vi.fn().mockRejectedValue(failure),
      onError,
      epochTransitionBufferMs: 2_000,
    })

    await vi.advanceTimersByTimeAsync(DURATION + 2_000)
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      failure,
      'epoch-changed-callback',
      undefined,
    )
    manager.reset()
  })

  it('should report scheduled transition refresh failures via onError', async () => {
    const manager = new EpochManager()
    const failure = new Error('fetch failed')
    const onError = vi.fn()
    const fetchEpoch = vi
      .fn()
      .mockResolvedValueOnce(chainInfo())
      .mockRejectedValueOnce(failure)

    await manager.initialize({
      fetchEpoch,
      epochsFromCurrent: 0,
      onError,
      epochTransitionBufferMs: 2_000,
    })

    await vi.advanceTimersByTimeAsync(DURATION + 2_000)
    expect(onError).toHaveBeenCalledExactlyOnceWith(
      failure,
      'transition-refresh',
      undefined,
    )
    manager.reset()
  })

  it('should not fire callbacks after stop', async () => {
    const manager = new EpochManager()
    const onRenewalDue = vi.fn()
    await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: 0,
      onRenewalDue,
    })

    manager.stop()
    await vi.advanceTimersByTimeAsync(DURATION * 10)

    expect(onRenewalDue).not.toHaveBeenCalled()
    // stop() preserves state; getState still works.
    expect(manager.getState().currentEpoch).toBe(100)
    manager.reset()
  })

  it('should fall back to defaults for non-finite numeric options', async () => {
    const manager = new EpochManager()
    const onRenewalDue = vi.fn()
    const state = await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: Number.NaN,
      renewBeforeMs: Number.NaN,
      // Isolate the renewBeforeMs fallback from staggering.
      renewJitterMs: 0,
      epochTransitionBufferMs: Number.NaN,
      absoluteMaxEpoch: Number.NaN,
      onRenewalDue,
      watchEpochTransitions: false,
    })

    // NaN offset → 0, NaN absoluteMaxEpoch ignored.
    expect(state.numericMaxEpoch).toBe(100)
    // NaN renewBeforeMs → default lead time, so the timer must not fire early.
    await vi.advanceTimersByTimeAsync(DURATION - 60_001)
    expect(onRenewalDue).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1)
    expect(onRenewalDue).toHaveBeenCalledOnce()
    manager.reset()
  })

  it('should chunk delays beyond the setTimeout clamp instead of firing immediately', async () => {
    const MAX_TIMEOUT_DELAY_MS = 2_147_483_647
    const manager = new EpochManager()
    const onRenewalDue = vi.fn()
    const longDuration = MAX_TIMEOUT_DELAY_MS + 3_600_000

    await manager.initialize({
      fetchEpoch: vi
        .fn()
        .mockResolvedValue(chainInfo({ epochDurationMs: longDuration })),
      epochsFromCurrent: 0,
      renewBeforeMs: 60_000,
      // Isolate the setTimeout-clamp chunking from staggering.
      renewJitterMs: 0,
      onRenewalDue,
      watchEpochTransitions: false,
    })

    // Crossing the 32-bit clamp boundary must not trigger the callback.
    await vi.advanceTimersByTimeAsync(MAX_TIMEOUT_DELAY_MS)
    expect(onRenewalDue).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(longDuration - MAX_TIMEOUT_DELAY_MS)
    expect(onRenewalDue).toHaveBeenCalledOnce()
    manager.reset()
  })

  it('should not refresh-loop when the epoch boundary is in the past', async () => {
    const manager = new EpochManager()
    // Simulates a fetcher that fell back to epoch start 0: the next boundary
    // (0 + duration) is far in the past relative to the current time.
    const fetchEpoch = vi
      .fn()
      .mockResolvedValue(chainInfo({ epochStartTimestampMs: 0 }))

    await manager.initialize({
      fetchEpoch,
      epochsFromCurrent: 0,
      epochTransitionBufferMs: 2_000,
    })

    // A past boundary must not trigger an immediate refresh cascade.
    await vi.advanceTimersByTimeAsync(1_000)
    expect(fetchEpoch).toHaveBeenCalledTimes(1)

    // The watcher rolls forward to the next expected boundary, so exactly one
    // more refresh happens within the following epoch duration.
    await vi.advanceTimersByTimeAsync(DURATION + 2_000)
    expect(fetchEpoch).toHaveBeenCalledTimes(2)
    manager.reset()
  })

  it('should stay torn down when reset() happens during an in-flight initialize', async () => {
    const manager = new EpochManager()
    const onRenewalDue = vi.fn()
    let resolveFetch!: (info: ChainEpochInfo) => void
    const fetchEpoch = vi.fn().mockImplementation(
      () =>
        new Promise<ChainEpochInfo>((resolve) => {
          resolveFetch = resolve
        }),
    )

    const initPromise = manager.initialize({
      fetchEpoch,
      epochsFromCurrent: 0,
      onRenewalDue,
    })

    manager.reset()
    resolveFetch(chainInfo())
    await initPromise

    // The stale continuation must not resurrect state or schedule timers.
    expect(() => manager.getState()).toThrow(
      'EpochManager must be initialized before use',
    )
    await vi.advanceTimersByTimeAsync(DURATION * 2)
    expect(onRenewalDue).not.toHaveBeenCalled()
  })

  it('should let a newer initialize() win over an in-flight refresh', async () => {
    const manager = new EpochManager()
    let resolveFirst!: (info: ChainEpochInfo) => void
    const firstFetch = vi.fn().mockImplementation(
      () =>
        new Promise<ChainEpochInfo>((resolve) => {
          resolveFirst = resolve
        }),
    )
    const secondFetch = vi
      .fn()
      .mockResolvedValue(chainInfo({ currentEpoch: 200 }))

    const firstInit = manager.initialize({
      fetchEpoch: firstFetch,
      epochsFromCurrent: 0,
      watchEpochTransitions: false,
    })
    await manager.initialize({
      fetchEpoch: secondFetch,
      epochsFromCurrent: 0,
      watchEpochTransitions: false,
    })

    resolveFirst(chainInfo({ currentEpoch: 100 }))
    await firstInit

    expect(manager.getState().currentEpoch).toBe(200)
    manager.reset()
  })

  it('should stagger renewal by a jitter drawn from the injected random source', async () => {
    const manager = new EpochManager()
    const state = await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: 0,
      renewBeforeMs: 60_000,
      renewJitterMs: 300_000,
      random: () => 0.5,
      watchEpochTransitions: false,
    })

    expect(state.appliedRenewJitterMs).toBe(150_000)
    expect(state.renewAtTimestampMs).toBe(
      EPOCH_START + DURATION - 60_000 - 150_000,
    )
    manager.reset()
  })

  it('should give instances with different seeds different renewal slots', async () => {
    const opts = {
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: 0,
      renewJitterMs: 300_000,
      watchEpochTransitions: false,
    } as const

    const early = new EpochManager()
    const late = new EpochManager()
    const earlyState = await early.initialize({ ...opts, random: () => 0.9 })
    const lateState = await late.initialize({ ...opts, random: () => 0.1 })

    expect(earlyState.renewAtTimestampMs).toBeLessThan(
      lateState.renewAtTimestampMs,
    )
    early.reset()
    late.reset()
  })

  it('should keep the same renewal slot across refreshes within an epoch', async () => {
    const manager = new EpochManager()
    const random = vi.fn().mockReturnValue(0.5)
    const first = await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: 0,
      renewJitterMs: 300_000,
      random,
      watchEpochTransitions: false,
    })

    const second = await manager.refresh()

    // The jitter offset is drawn once, not re-rolled on every refresh.
    expect(random).toHaveBeenCalledTimes(1)
    expect(second.renewAtTimestampMs).toBe(first.renewAtTimestampMs)
    manager.reset()
  })

  it('should recompute maxEpoch with a new offset via afterRenewal', async () => {
    const manager = new EpochManager()
    await manager.initialize({
      fetchEpoch: vi.fn().mockResolvedValue(chainInfo()),
      epochsFromCurrent: 0,
      watchEpochTransitions: false,
    })

    const renewed = await manager.afterRenewal({ epochsFromCurrent: 2 })

    expect(renewed.numericMaxEpoch).toBe(102)
    manager.reset()
  })
})
