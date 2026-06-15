/**
 * @packageDocumentation
 *
 * Helpers for working with the EVE token type across supported tenants.
 *
 * ## Usage
 *
 * The eve-token entrypoint exposes utilities for building and validating the
 * fully qualified Sui coin type for EVE.
 *
 * - `getEveCoinType` builds the coin type for a specific tenant
 * - `isEveCoinType` checks whether a coin type matches a supported tenant
 * - `EVE_COIN_TYPE_SUFFIX` exposes the shared `::EVE::EVE` suffix
 *
 * ### Quick example
 *
 * ```ts
 * import { getEveCoinType, isEveCoinType } from '@evefrontier/wallet-core/eve-token'
 * import { TenantId } from '@evefrontier/wallet-core/tenant'
 *
 * const coinType = getEveCoinType(TenantId.STILLNESS)
 *
 * if (isEveCoinType(coinType)) {
 *   console.log(coinType)
 * }
 * ```
 */
export {
  EVE_COIN_TYPE_SUFFIX,
  getEveCoinType,
  isEveCoinType,
} from './eve-token'
