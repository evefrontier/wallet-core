/**
 * Default lead time before `maxEpochTimestampMs` at which a renewal is due.
 */
export const DEFAULT_RENEW_BEFORE_MS = 60_000

/**
 * Default width of the renewal staggering window applied by `EpochManager`, so
 * wallets sharing an epoch boundary don't all renew at the same instant.
 */
export const DEFAULT_RENEW_JITTER_MS = 300_000

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
  /** Jitter (ms) subtracted from the unjittered renewal instant for this client. */
  appliedRenewJitterMs: number
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
  /**
   * Width of the renewal jitter window (ms). A jitter of
   * `renewJitterFraction * renewJitterMs` is subtracted from the renewal
   * instant, moving it earlier but never past the `renewBeforeMs` floor.
   * Defaults to 0 (no jitter).
   */
  renewJitterMs?: number
  /**
   * Fraction in `[0, 1)` selecting this client's slot within the jitter window.
   * Injected rather than randomized internally so results stay deterministic,
   * mirroring `nowMs`. Defaults to 0.
   */
  renewJitterFraction?: number
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
  const renewJitterMs =
    options.renewJitterMs != null && Number.isFinite(options.renewJitterMs)
      ? Math.max(0, options.renewJitterMs)
      : 0
  const renewJitterFraction =
    options.renewJitterFraction != null &&
    Number.isFinite(options.renewJitterFraction)
      ? Math.min(1, Math.max(0, options.renewJitterFraction))
      : 0
  const appliedRenewJitterMs = Math.floor(renewJitterMs * renewJitterFraction)
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
    maxEpochTimestampMs - renewBeforeMs - appliedRenewJitterMs,
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
    appliedRenewJitterMs,
    msUntilRenew: Math.max(0, renewAtTimestampMs - nowMs),
    msUntilMaxEpoch: Math.max(0, maxEpochTimestampMs - nowMs),
  }
}
