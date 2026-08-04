/**
 * @packageDocumentation
 *
 * zkLogin epoch handling: fetching current-epoch facts from chain, deriving
 * `maxEpoch` timing, and scheduling session renewals.
 *
 * zkLogin signatures are valid through the end of their (inclusive)
 * `maxEpoch`. This module is the single source of truth for that timing
 * math, so wallets and signers don't each reimplement
 * `epochStart + duration * (offset + 1)`.
 *
 * The `maxEpoch` offset (`epochsFromCurrent`) is a security policy decision —
 * larger offsets extend proof lifetime — so it is a required parameter
 * everywhere rather than a library default.
 *
 * ## Usage
 *
 * The epoch entrypoint groups together:
 *
 * - `computeEpochState`, the pure timing derivation, and its
 *   `ChainEpochInfo` input / `EpochState` output models
 * - `fetchEpochFromSystemState`, which reads current-epoch facts from the
 *   system state object and returns `ChainEpochInfo`
 * - `EpochManager`, a scheduler that emits a callback when a session renewal
 *   is due and optionally watches epoch transitions
 *
 * `fetchEpochFromSystemState` accepts an injected client
 * (`ClientWithCoreApi`); this module never constructs clients or resolves
 * fullnode URLs.
 *
 * ### Quick example
 *
 * ```ts
 * import {
 *   computeEpochState,
 *   EpochManager,
 *   fetchEpochFromSystemState,
 * } from '@evefrontier/wallet-core/epoch'
 *
 * // One-shot derivation, e.g. for a zkLogin nonce:
 * const info = await fetchEpochFromSystemState(suiClient)
 * const { numericMaxEpoch, maxEpochTimestampMs } = computeEpochState(info, {
 *   epochsFromCurrent: 0,
 *   nowMs: Date.now(),
 * })
 *
 * // Or a long-lived renewal scheduler:
 * const manager = new EpochManager()
 * await manager.initialize({
 *   fetchEpoch: () => fetchEpochFromSystemState(suiClient),
 *   epochsFromCurrent: 2,
 *   onRenewalDue: ({ epoch }) => prepareNewSession(epoch),
 * })
 * ```
 */
export { fetchEpochFromSystemState } from './fetch'
export {
  type EpochChangedCallback,
  type EpochChangedNotification,
  EpochManager,
  type EpochManagerErrorCallback,
  type EpochManagerInitializeOptions,
  type EpochRenewalCallback,
  type EpochRenewalNotification,
} from './manager'
export {
  type ChainEpochInfo,
  type ComputeEpochStateOptions,
  computeEpochState,
  DEFAULT_RENEW_BEFORE_MS,
  DEFAULT_RENEW_JITTER_MS,
  type EpochState,
} from './state'
