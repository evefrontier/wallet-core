import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type ChainEpochInfo, EpochManager } from '#src/epoch'

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
      onRenewalDue: vi.fn().mockRejectedValue(failure),
      onError,
      watchEpochTransitions: false,
    })

    await vi.advanceTimersByTimeAsync(DURATION)
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure, 'renewal-callback')
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
