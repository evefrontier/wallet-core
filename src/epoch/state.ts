/**
 * Default lead time before `maxEpochTimestampMs` at which a renewal is due.
 */
export const DEFAULT_RENEW_BEFORE_MS = 60_000

/**
 * Current-epoch facts fetched from chain.
 */
export interface ChainEpochInfo {
  /** The chain's current epoch number. */
  currentEpoch: number
  /** Length of the current epoch in milliseconds. */
  epochDurationMs: number
  /** Unix timestamp (ms) at which the current epoch started. */
  epochStartTimestampMs: number
}

/**
 * Derived zkLogin epoch timing for one chain at one point in time.
 */
export interface EpochState {
  /** The chain's current epoch number. */
  currentEpoch: number
  /** The zkLogin `maxEpoch` value (inclusive). */
  numericMaxEpoch: number
  /** Resolved offset of `numericMaxEpoch` from `currentEpoch`. */
  epochsFromCurrent: number
  /** Length of the current epoch in milliseconds. */
  epochDurationMs: number
  /** Unix timestamp (ms) at which the current epoch started. */
  epochStartTimestampMs: number
  /** Unix timestamp (ms) at which the next epoch is expected to start. */
  nextEpochTimestampMs: number
  /** Unix timestamp (ms) at which signatures bound to `numericMaxEpoch` expire. */
  maxEpochTimestampMs: number
  /** Unix timestamp (ms) at which a session renewal is due. */
  renewAtTimestampMs: number
  /** Milliseconds from `nowMs` until renewal is due (floored at 0). */
  msUntilRenew: number
  /** Milliseconds from `nowMs` until `maxEpochTimestampMs` (floored at 0). */
  msUntilMaxEpoch: number
}

export interface ComputeEpochStateOptions {
  /**
   * Offset of `maxEpoch` from the current epoch. This is a security policy
   * decision (larger values extend proof lifetime), so it has no default —
   * callers must state it explicitly. Ignored when `absoluteMaxEpoch` is set.
   */
  epochsFromCurrent: number
  /** Use this exact `maxEpoch` instead of `currentEpoch + epochsFromCurrent`. */
  absoluteMaxEpoch?: number
  /** Renewal lead time before `maxEpochTimestampMs`. Defaults to {@link DEFAULT_RENEW_BEFORE_MS}. */
  renewBeforeMs?: number
  /** The caller's current Unix timestamp (ms); injected so results are deterministic. */
  nowMs: number
}

/**
 * Computes zkLogin epoch timing from current-epoch facts.
 *
 * `maxEpoch` is inclusive: a signature with `maxEpoch = currentEpoch + N`
 * remains valid through the end of that epoch, yielding up to N + 1 epoch
 * durations of effective lifetime — hence
 * `maxEpochTimestampMs = epochStart + duration * (N + 1)`.
 */
export function computeEpochState(
  info: ChainEpochInfo,
  options: ComputeEpochStateOptions,
): EpochState {
  const { currentEpoch, epochDurationMs, epochStartTimestampMs } = info
  const { absoluteMaxEpoch, nowMs } = options

  if (!Number.isFinite(nowMs)) {
    throw new Error('computeEpochState requires a finite nowMs timestamp')
  }

  const renewBeforeMs =
    options.renewBeforeMs != null && Number.isFinite(options.renewBeforeMs)
      ? Math.max(0, options.renewBeforeMs)
      : DEFAULT_RENEW_BEFORE_MS
  const epochsFromCurrent = Number.isFinite(options.epochsFromCurrent)
    ? Math.max(0, Math.floor(options.epochsFromCurrent))
    : 0
  // maxEpoch below the current epoch is already expired; clamp so derived
  // timestamps never run backwards.
  const numericMaxEpoch =
    typeof absoluteMaxEpoch === 'number' && Number.isFinite(absoluteMaxEpoch)
      ? Math.max(currentEpoch, Math.floor(absoluteMaxEpoch))
      : currentEpoch + epochsFromCurrent
  const resolvedEpochsFromCurrent = numericMaxEpoch - currentEpoch
  const nextEpochTimestampMs = epochStartTimestampMs + epochDurationMs
  const maxEpochTimestampMs =
    epochStartTimestampMs + epochDurationMs * (resolvedEpochsFromCurrent + 1)
  const renewAtTimestampMs = Math.max(
    epochStartTimestampMs,
    maxEpochTimestampMs - renewBeforeMs,
  )

  return {
    currentEpoch,
    numericMaxEpoch,
    epochsFromCurrent: resolvedEpochsFromCurrent,
    epochDurationMs,
    epochStartTimestampMs,
    nextEpochTimestampMs,
    maxEpochTimestampMs,
    renewAtTimestampMs,
    msUntilRenew: Math.max(0, renewAtTimestampMs - nowMs),
    msUntilMaxEpoch: Math.max(0, maxEpochTimestampMs - nowMs),
  }
}
