/**
 * @packageDocumentation
 *
 * Tenant identifiers and per-tenant environment configuration for Eve Frontier.
 *
 * ## Usage
 *
 * The tenant entrypoint provides a single place to discover supported tenants
 * and resolve environment-specific values such as package IDs and API hosts.
 *
 * - `TenantId` lists the supported tenants
 * - `DEFAULT_TENANT` identifies the fallback tenant
 * - `TENANT_CONFIG` maps each tenant to its world tier, EVE package ID and
 *   DataHub hostname
 * - `getTenantWorldType` / `getTenantWorldPackageId` resolve per-package world
 *   types and package IDs for a tenant
 * - `EVE_PACKAGE_ID_BY_TENANT` exposes the EVE package ID lookup directly
 *
 * ### Quick example
 *
 * ```ts
 * import { DEFAULT_TENANT, TENANT_CONFIG } from '@evefrontier/wallet-core/tenant'
 *
 * const config = TENANT_CONFIG[DEFAULT_TENANT]
 *
 * console.log(config.datahubHost)
 * ```
 */

export { getMvrCache } from './mvr/mvrCache.generated'
export {
  WORLD_PACKAGES,
  WORLD_TYPE_KEYS,
  type WorldPackage,
  type WorldTypeKey,
} from './mvr/worldTypeKeys'
export * from './tenants'
