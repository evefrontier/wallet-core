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
