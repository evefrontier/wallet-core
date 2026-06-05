import { EVE_PACKAGE_ID_BY_TENANT, TenantId } from './tenants'

/** @category Constants */
export const EVE_COIN_TYPE_SUFFIX = '::EVE::EVE'

/**
 * Returns the EVE token coin type for the given tenant.
 * Format: `{packageId}::EVE::EVE` (Sui Move type used by RPC/GraphQL).
 * @param tenantId - The tenant identifier (e.g., TenantId.UTOPIA, TenantId.STILLNESS)
 * @returns The fully qualified EVE coin type string
 *
 * @category Utilities - Config
 */
export function getEveCoinType(tenantId: TenantId): string {
  return `${EVE_PACKAGE_ID_BY_TENANT[tenantId]}${EVE_COIN_TYPE_SUFFIX}`
}

const KNOWN_EVE_COIN_TYPES = new Set(
  Object.values(TenantId).map(getEveCoinType),
)

/**
 * Returns true when the coin type is a known EVE token for any supported tenant.
 */
export function isEveCoinType(coinType: string): boolean {
  return KNOWN_EVE_COIN_TYPES.has(coinType)
}
