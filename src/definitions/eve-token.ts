import { EVE_PACKAGE_ID_BY_TENANT, TenantId } from './tenants'

/** @category Constants */
export const EVE_COIN_TYPE_SUFFIX = '::EVE::EVE'

/** Legacy EVE coin type from before per-tenant packages were introduced. */
export const LEGACY_EVE_COIN_TYPE =
  '0x59d7bb2e0feffb90cb2446fb97c2ce7d4bd24d2fb98939d6cb6c3940110a0de0::EVE::EVE'

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

const KNOWN_EVE_COIN_TYPES = new Set([
  ...Object.values(TenantId).map(getEveCoinType),
  LEGACY_EVE_COIN_TYPE,
])

/**
 * Returns true when the coin type is a known EVE token for any supported
 * tenant, including the legacy pre-tenant EVE coin type.
 */
export function isEveCoinType(coinType: string): boolean {
  return KNOWN_EVE_COIN_TYPES.has(coinType)
}
