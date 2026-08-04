import {
  type ChainEpochInfo,
  computeEpochState,
  DEFAULT_RENEW_BEFORE_MS,
  DEFAULT_RENEW_JITTER_MS,
  type EpochState,
} from './state'

/**
 * Emitted when the renewal lead time before `maxEpochTimestampMs` is reached.
 */
export interface EpochRenewalNotification {
  reason: 'renewal_due'
  emittedAtMs: number
  epoch: EpochState
}

/**
 * Emitted after an epoch transition is observed on chain.
 */
export interface EpochChangedNotification {
  previousEpoch: number
  currentEpoch: number
  emittedAtMs: number
  epoch: EpochState
}

export type EpochRenewalCallback = (
  notification: EpochRenewalNotification,
) => void | Promise<void>

export type EpochChangedCallback = (
  notification: EpochChangedNotification,
) => void | Promise<void>

/**
 * Invoked when a callback or a scheduled chain refresh fails. The manager
 * never throws from timer context; wire this up to your logger.
 */
export type EpochManagerErrorCallback = (
  error: unknown,
  context: 'renewal-callback' | 'epoch-changed-callback' | 'transition-refresh',
) => void

/** Largest delay `setTimeout` honors (2^31 - 1 ms); longer waits are chunked. */
const MAX_TIMEOUT_DELAY_MS = 2_147_483_647

function toNonNegativeInt(value: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback
}

/** Coerce a randomness draw to a usable jitter fraction in `[0, 1)`. */
function toJitterFraction(value: number): number {
  return Number.isFinite(value)
    ? Math.min(0.999_999_999, Math.max(0, value))
    : 0
}

export interface EpochManagerInitializeOptions {
  /**
   * Fetches current-epoch facts from chain — typically one of the fetchers
   * from `./fetch` bound to a client, e.g.
   * `() => fetchEpochFromSystemState(client)`.
   */
  fetchEpoch: () => Promise<ChainEpochInfo>
  /**
   * Offset of `maxEpoch` from the current epoch. A security policy decision,
   * so it has no default. Ignored when `absoluteMaxEpoch` is set.
   */
  epochsFromCurrent: number
  /** Use this exact `maxEpoch` instead of `currentEpoch + epochsFromCurrent`. */
  absoluteMaxEpoch?: number
  /** Renewal lead time before `maxEpochTimestampMs`. Defaults to {@link DEFAULT_RENEW_BEFORE_MS}. */
  renewBeforeMs?: number
  /**
   * Width of the renewal staggering window. Each manager instance renews at a
   * random offset within `[0, renewJitterMs]` before its usual `renewBeforeMs`
   * deadline, so many wallets sharing an epoch boundary don't renew at once.
   * Defaults to {@link DEFAULT_RENEW_JITTER_MS}; pass 0 to disable.
   */
  renewJitterMs?: number
  /** Randomness source for the per-client jitter offset. Defaults to `Math.random`. */
  random?: () => number
  onRenewalDue?: EpochRenewalCallback
  onEpochChanged?: EpochChangedCallback
  onError?: EpochManagerErrorCallback
  /** Refresh state after each expected epoch boundary. Defaults to true. */
  watchEpochTransitions?: boolean
  /** Delay past the expected boundary before refreshing. Defaults to 2000. */
  epochTransitionBufferMs?: number
  /** Clock override for tests. Defaults to `Date.now`. */
  nowMs?: () => number
}

interface EpochManagerConfig {
  fetchEpoch: () => Promise<ChainEpochInfo>
  epochsFromCurrent: number
  absoluteMaxEpoch?: number
  renewBeforeMs: number
  renewJitterMs: number
  /** Per-instance jitter offset in `[0, 1)`, drawn once at initialize. */
  renewJitterFraction: number
  onRenewalDue?: EpochRenewalCallback
  onEpochChanged?: EpochChangedCallback
  onError?: EpochManagerErrorCallback
  watchEpochTransitions: boolean
  epochTransitionBufferMs: number
  nowMs: () => number
}

/**
 * Epoch renewal scheduler for one chain at a time.
 *
 * - `initialize()` fetches current epoch facts, computes `maxEpoch` timing,
 *   and schedules a renewal callback before `maxEpoch` expires so the host
 *   can prepare a new zkLogin session.
 * - `afterRenewal()` refreshes chain state and recomputes `maxEpoch` once a
 *   new key/session is ready.
 * - The optional epoch-transition watcher refreshes state after each epoch
 *   boundary and reports observed transitions via `onEpochChanged`.
 *
 * Lifecycle semantics (intentionally not strict start/stop symmetry):
 * - Calling `initialize()` again is supported and reconfigures scheduling.
 * - `stop()` only clears active timers; config/state are preserved and
 *   `initialize()` may be called to restart.
 * - `reset()` clears timers and drops config/state; methods that need
 *   initialized state throw until `initialize()` is called again.
 */
export class EpochManager {
  protected config: EpochManagerConfig | null = null
  protected state: EpochState | null = null
  protected renewalTimer: ReturnType<typeof setTimeout> | null = null
  protected epochTransitionTimer: ReturnType<typeof setTimeout> | null = null

  async initialize({
    fetchEpoch,
    epochsFromCurrent,
    absoluteMaxEpoch,
    renewBeforeMs = DEFAULT_RENEW_BEFORE_MS,
    renewJitterMs = DEFAULT_RENEW_JITTER_MS,
    random = () => Math.random(),
    onRenewalDue,
    onEpochChanged,
    onError,
    watchEpochTransitions = true,
    epochTransitionBufferMs = 2_000,
    nowMs = () => Date.now(),
  }: EpochManagerInitializeOptions): Promise<EpochState> {
    this.config = {
      fetchEpoch,
      epochsFromCurrent: toNonNegativeInt(epochsFromCurrent, 0),
      ...(typeof absoluteMaxEpoch === 'number' &&
      Number.isFinite(absoluteMaxEpoch)
        ? { absoluteMaxEpoch: Math.floor(absoluteMaxEpoch) }
        : {}),
      renewBeforeMs: toNonNegativeInt(renewBeforeMs, DEFAULT_RENEW_BEFORE_MS),
      renewJitterMs: toNonNegativeInt(renewJitterMs, DEFAULT_RENEW_JITTER_MS),
      renewJitterFraction: toJitterFraction(random()),
      ...(onRenewalDue ? { onRenewalDue } : {}),
      ...(onEpochChanged ? { onEpochChanged } : {}),
      ...(onError ? { onError } : {}),
      watchEpochTransitions,
      epochTransitionBufferMs: toNonNegativeInt(epochTransitionBufferMs, 2_000),
      nowMs,
    }

    return this.refreshFromChain({ triggerEpochChangedCallback: false })
  }

  getState(): EpochState {
    const { config, state } = this.requireInitialized()

    // Recompute relative timers when read.
    const now = config.nowMs()
    return {
      ...state,
      msUntilRenew: Math.max(0, state.renewAtTimestampMs - now),
      msUntilMaxEpoch: Math.max(0, state.maxEpochTimestampMs - now),
    }
  }

  async refresh(): Promise<EpochState> {
    return this.refreshFromChain({ triggerEpochChangedCallback: false })
  }

  /**
   * Call once a new key/session has been prepared by the host so `maxEpoch`
   * is recalculated from the latest chain state.
   */
  async afterRenewal({
    epochsFromCurrent,
  }: {
    epochsFromCurrent?: number
  } = {}): Promise<EpochState> {
    const { config } = this.requireInitialized()

    if (typeof epochsFromCurrent === 'number') {
      config.epochsFromCurrent = toNonNegativeInt(
        epochsFromCurrent,
        config.epochsFromCurrent,
      )
    }

    return this.refreshFromChain({ triggerEpochChangedCallback: false })
  }

  /** Stops active timers but preserves current config/state. */
  stop(): void {
    this.clearTimers()
  }

  /** Full teardown: clears timers and drops config/state. */
  reset(): void {
    this.clearTimers()
    this.state = null
    this.config = null
  }

  protected requireInitialized(): {
    config: EpochManagerConfig
    state: EpochState
  } {
    if (!this.config || !this.state) {
      throw new Error('EpochManager must be initialized before use')
    }
    return { config: this.config, state: this.state }
  }

  protected clearTimers(): void {
    if (this.renewalTimer !== null) {
      clearTimeout(this.renewalTimer)
      this.renewalTimer = null
    }
    if (this.epochTransitionTimer !== null) {
      clearTimeout(this.epochTransitionTimer)
      this.epochTransitionTimer = null
    }
  }

  protected reportError(
    error: unknown,
    context: Parameters<EpochManagerErrorCallback>[1],
  ): void {
    this.config?.onError?.(error, context)
  }

  /**
   * Schedules `onFire` at `targetMs`, chunking waits longer than
   * {@link MAX_TIMEOUT_DELAY_MS} into successive timeouts so `setTimeout`'s
   * 32-bit delay clamp cannot make far-future timers fire immediately.
   */
  protected startTimerAt(
    targetMs: number,
    timerKey: 'renewalTimer' | 'epochTransitionTimer',
    onFire: () => void,
  ): void {
    const { config } = this.requireInitialized()

    const tick = () => {
      const remaining = targetMs - config.nowMs()
      if (remaining <= MAX_TIMEOUT_DELAY_MS) {
        this[timerKey] = setTimeout(
          () => {
            this[timerKey] = null
            onFire()
          },
          Math.max(0, remaining),
        )
      } else {
        this[timerKey] = setTimeout(tick, MAX_TIMEOUT_DELAY_MS)
      }
    }
    tick()
  }

  protected scheduleRenewalTimer(): void {
    const { config, state } = this.requireInitialized()

    if (this.renewalTimer !== null) {
      clearTimeout(this.renewalTimer)
      this.renewalTimer = null
    }
    if (!config.onRenewalDue) {
      return
    }

    this.startTimerAt(state.renewAtTimestampMs, 'renewalTimer', () => {
      const latest = this.getState()
      void Promise.resolve(
        config.onRenewalDue?.({
          reason: 'renewal_due',
          emittedAtMs: config.nowMs(),
          epoch: latest,
        }),
      ).catch((error) => {
        this.reportError(error, 'renewal-callback')
      })
    })
  }

  protected scheduleEpochTransitionTimer(): void {
    const { config, state } = this.requireInitialized()

    if (this.epochTransitionTimer !== null) {
      clearTimeout(this.epochTransitionTimer)
      this.epochTransitionTimer = null
    }
    if (!config.watchEpochTransitions) {
      return
    }

    // A stale boundary (e.g. a fetcher that fell back to epoch start 0) would
    // otherwise schedule a 0ms refresh that reschedules another 0ms refresh,
    // hammering the endpoint. Roll past boundaries forward one epoch duration
    // at a time so the watcher keeps its normal cadence instead.
    const now = config.nowMs()
    const epochDurationMs = Math.max(1, state.epochDurationMs)
    let transitionAt =
      state.nextEpochTimestampMs + config.epochTransitionBufferMs
    if (transitionAt <= now) {
      const missedEpochs =
        Math.floor((now - transitionAt) / epochDurationMs) + 1
      transitionAt += missedEpochs * epochDurationMs
    }

    this.startTimerAt(transitionAt, 'epochTransitionTimer', () => {
      void this.refreshFromChain({ triggerEpochChangedCallback: true }).catch(
        (error) => {
          this.reportError(error, 'transition-refresh')
        },
      )
    })
  }

  protected async refreshFromChain({
    triggerEpochChangedCallback,
  }: {
    triggerEpochChangedCallback: boolean
  }): Promise<EpochState> {
    if (!this.config) {
      throw new Error('EpochManager must be initialized before use')
    }

    const config = this.config
    const previousState = this.state

    const info = await config.fetchEpoch()
    const updatedState = computeEpochState(info, {
      epochsFromCurrent: config.epochsFromCurrent,
      ...(typeof config.absoluteMaxEpoch === 'number'
        ? { absoluteMaxEpoch: config.absoluteMaxEpoch }
        : {}),
      renewBeforeMs: config.renewBeforeMs,
      renewJitterMs: config.renewJitterMs,
      renewJitterFraction: config.renewJitterFraction,
      nowMs: config.nowMs(),
    })

    // If reset() or a newer initialize() replaced the config while the fetch
    // was in flight, that configuration now owns state and timers — return
    // the computed snapshot without applying anything.
    if (this.config !== config) {
      return updatedState
    }

    this.state = updatedState
    this.scheduleRenewalTimer()
    this.scheduleEpochTransitionTimer()

    if (
      triggerEpochChangedCallback &&
      config.onEpochChanged &&
      previousState &&
      updatedState.currentEpoch !== previousState.currentEpoch
    ) {
      try {
        await config.onEpochChanged({
          previousEpoch: previousState.currentEpoch,
          currentEpoch: updatedState.currentEpoch,
          emittedAtMs: config.nowMs(),
          epoch: updatedState,
        })
      } catch (error) {
        this.reportError(error, 'epoch-changed-callback')
      }
    }

    return updatedState
  }
}
