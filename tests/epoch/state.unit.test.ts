import { describe, expect, it } from 'vitest'
import { computeEpochState, DEFAULT_RENEW_BEFORE_MS } from '#src/epoch'

const EPOCH_START = 1_700_000_000_000
const DURATION = 86_400_000

const INFO = {
  currentEpoch: 100,
  epochDurationMs: DURATION,
  epochStartTimestampMs: EPOCH_START,
}

describe('computeEpochState', () => {
  it('should treat maxEpoch as inclusive: offset 0 is valid through the end of the current epoch', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      nowMs: EPOCH_START,
    })

    expect(state.numericMaxEpoch).toBe(100)
    expect(state.maxEpochTimestampMs).toBe(EPOCH_START + DURATION)
  })

  it('should yield offset + 1 epoch durations of effective lifetime', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 2,
      nowMs: EPOCH_START,
    })

    expect(state.numericMaxEpoch).toBe(102)
    expect(state.epochsFromCurrent).toBe(2)
    expect(state.maxEpochTimestampMs).toBe(EPOCH_START + DURATION * 3)
  })

  it('should compute nextEpochTimestampMs as one duration after epoch start', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 2,
      nowMs: EPOCH_START,
    })

    expect(state.nextEpochTimestampMs).toBe(EPOCH_START + DURATION)
  })

  it('should honor absoluteMaxEpoch over epochsFromCurrent', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 2,
      absoluteMaxEpoch: 105,
      nowMs: EPOCH_START,
    })

    expect(state.numericMaxEpoch).toBe(105)
    expect(state.epochsFromCurrent).toBe(5)
    expect(state.maxEpochTimestampMs).toBe(EPOCH_START + DURATION * 6)
  })

  it('should schedule renewal renewBeforeMs before maxEpoch expiry by default', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      nowMs: EPOCH_START,
    })

    expect(state.renewAtTimestampMs).toBe(
      EPOCH_START + DURATION - DEFAULT_RENEW_BEFORE_MS,
    )
  })

  it('should default to no jitter', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      nowMs: EPOCH_START,
    })

    expect(state.appliedRenewJitterMs).toBe(0)
    expect(state.renewAtTimestampMs).toBe(
      EPOCH_START + DURATION - DEFAULT_RENEW_BEFORE_MS,
    )
  })

  it('should subtract the full jitter window at fraction 1', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      renewJitterMs: 300_000,
      renewJitterFraction: 1,
      nowMs: EPOCH_START,
    })

    expect(state.appliedRenewJitterMs).toBe(300_000)
    expect(state.renewAtTimestampMs).toBe(
      EPOCH_START + DURATION - DEFAULT_RENEW_BEFORE_MS - 300_000,
    )
  })

  it('should scale the jitter by the fraction', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      renewJitterMs: 300_000,
      renewJitterFraction: 0.25,
      nowMs: EPOCH_START,
    })

    expect(state.appliedRenewJitterMs).toBe(75_000)
    expect(state.renewAtTimestampMs).toBe(
      EPOCH_START + DURATION - DEFAULT_RENEW_BEFORE_MS - 75_000,
    )
  })

  it('should clamp the jitter fraction into [0, 1]', () => {
    const below = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      renewJitterMs: 300_000,
      renewJitterFraction: -5,
      nowMs: EPOCH_START,
    })
    expect(below.appliedRenewJitterMs).toBe(0)

    const above = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      renewJitterMs: 300_000,
      renewJitterFraction: 5,
      nowMs: EPOCH_START,
    })
    expect(above.appliedRenewJitterMs).toBe(300_000)
  })

  it('should ignore a non-finite jitter window', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      renewJitterMs: Number.NaN,
      renewJitterFraction: 1,
      nowMs: EPOCH_START,
    })

    expect(state.appliedRenewJitterMs).toBe(0)
    expect(state.renewAtTimestampMs).toBe(
      EPOCH_START + DURATION - DEFAULT_RENEW_BEFORE_MS,
    )
  })

  it('should clamp a jittered renewal back to the epoch start', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      renewBeforeMs: DURATION / 2,
      renewJitterMs: DURATION,
      renewJitterFraction: 1,
      nowMs: EPOCH_START,
    })

    expect(state.renewAtTimestampMs).toBe(EPOCH_START)
  })

  it('should clamp renewAtTimestampMs to the epoch start', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      renewBeforeMs: DURATION * 2,
      nowMs: EPOCH_START,
    })

    expect(state.renewAtTimestampMs).toBe(EPOCH_START)
  })

  it('should floor msUntil values at zero when the deadlines have passed', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      nowMs: EPOCH_START + DURATION * 10,
    })

    expect(state.msUntilRenew).toBe(0)
    expect(state.msUntilMaxEpoch).toBe(0)
  })

  it('should compute msUntil values relative to nowMs', () => {
    const now = EPOCH_START + 1_000
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      nowMs: now,
    })

    expect(state.msUntilRenew).toBe(state.renewAtTimestampMs - now)
    expect(state.msUntilMaxEpoch).toBe(state.maxEpochTimestampMs - now)
  })

  it('should treat a non-finite offset as zero', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: Number.NaN,
      nowMs: EPOCH_START,
    })

    expect(state.numericMaxEpoch).toBe(100)
    expect(state.maxEpochTimestampMs).toBe(EPOCH_START + DURATION)
  })

  it('should clamp absoluteMaxEpoch to at least the current epoch', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 2,
      absoluteMaxEpoch: 42,
      nowMs: EPOCH_START,
    })

    expect(state.numericMaxEpoch).toBe(100)
    expect(state.epochsFromCurrent).toBe(0)
  })

  it('should ignore a non-finite absoluteMaxEpoch', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 2,
      absoluteMaxEpoch: Number.NaN,
      nowMs: EPOCH_START,
    })

    expect(state.numericMaxEpoch).toBe(102)
  })

  it('should fall back to the default lead time for a non-finite renewBeforeMs', () => {
    const state = computeEpochState(INFO, {
      epochsFromCurrent: 0,
      renewBeforeMs: Number.NaN,
      nowMs: EPOCH_START,
    })

    expect(state.renewAtTimestampMs).toBe(
      EPOCH_START + DURATION - DEFAULT_RENEW_BEFORE_MS,
    )
  })

  it('should throw when nowMs is not finite', () => {
    expect(() =>
      computeEpochState(INFO, {
        epochsFromCurrent: 0,
        nowMs: Number.NaN,
      }),
    ).toThrow('computeEpochState requires a finite nowMs timestamp')
  })

  it('should normalize a negative or fractional offset', () => {
    const negative = computeEpochState(INFO, {
      epochsFromCurrent: -3,
      nowMs: EPOCH_START,
    })
    expect(negative.numericMaxEpoch).toBe(100)

    const fractional = computeEpochState(INFO, {
      epochsFromCurrent: 2.9,
      nowMs: EPOCH_START,
    })
    expect(fractional.numericMaxEpoch).toBe(102)
  })
})
