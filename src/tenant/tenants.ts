import type { ApiTier } from '#src/jwt/api-context'
import { getMvrCache } from './mvr/mvrCache.generated'
import {
  WORLD_TYPE_KEYS,
  type WorldPackage,
  type WorldTypeKey,
} from './mvr/worldTypeKeys'

/** Tenant IDs.
 *  @category Constants
 */
export enum TenantId {
  STILLNESS = 'stillness',
  LIMINALITY = 'liminality',
  UTOPIA = 'utopia',
  UMBRA = 'umbra',
  TAUCETI = 'tauceti',
  TIAKI = 'tiaki',
  TETRA = 'tetra',
  TESSERACT = 'tesseract',
}

/** Tenant when not provided via URL ?tenant= (e.g. dev/default chain).
 *  @category Constants
 */
export const DEFAULT_TENANT = TenantId.STILLNESS

/** MVR network the world and currency maps are resolved against. */
const WORLD_MVR_NETWORK = 'testnet' as const

type MvrResolution = {
  packages: Record<string, string>
  types: Record<string, string>
}

const worldMvrCache = getMvrCache(WORLD_MVR_NETWORK) as MvrResolution

/** Package id prefix of a fully-qualified `0x…::module::Type` tag. */
const packageIdOf = (typeTag: string): string =>
  typeTag.slice(0, typeTag.indexOf('::'))

/**
 * Type-origin tag for a fully-qualified MVR type name (e.g.
 * `@evefrontier/world-inventory-dev::item::Item`), pinned to the package version
 * the type was first defined in.
 */
const originTag = (fullName: string): string => {
  const tag = worldMvrCache.types[fullName]
  if (!tag) {
    throw new Error(
      `MVR cache has no type-origin entry for "${fullName}". Regenerate the ` +
        `cache with \`bun run gen:mvr\` (see src/tenant/mvr) after adding the ` +
        `type/tier to the scan seeds in worldTypeKeys.ts.`,
    )
  }
  return tag
}

/**
 * MVR name of a world package at a tier, e.g.
 * `@evefrontier/world-generic-module-dev`. The live tier has no suffix.
 * @category Utilities
 */
export const worldMvrName = (pkg: WorldPackage, tier: ApiTier): string =>
  `@evefrontier/world-${pkg.replaceAll('_', '-')}${tier === 'live' ? '' : `-${tier}`}`

/**
 * Resolve a world Move type to its fully-qualified, type-origin tag at a tier,
 * e.g. `0x…::identity::Identity`.
 * @category Utilities
 */
export const getWorldType = (tier: ApiTier, key: WorldTypeKey): string => {
  const sep = key.indexOf('::')
  const pkg = key.slice(0, sep) as WorldPackage
  return originTag(`${worldMvrName(pkg, tier)}${key.slice(sep)}`)
}

/**
 * A world package's id (type-origin) at a tier, anchored on the package's first
 * key in {@link WORLD_TYPE_KEYS}.
 * @category Utilities
 */
export const getWorldPackageId = (tier: ApiTier, pkg: WorldPackage): string => {
  const anchor = WORLD_TYPE_KEYS.find((key) => key.startsWith(`${pkg}::`))
  if (!anchor) throw new Error(`No world type key for package "${pkg}".`)
  return packageIdOf(getWorldType(tier, anchor))
}

/**
 * The tier's EVE token package id (type-origin of the `EVE::EVE` coin type),
 * derived from the `@evefrontier/currency*` MVR registration.
 */
const evePackageIdFor = (currencyMvrName: string): string =>
  packageIdOf(originTag(`${currencyMvrName}::EVE::EVE`))

/**
 * Per-tenant identity: which world tier it runs, which currency MVR tier its
 * EVE token lives on, and its DataHub host.
 */
interface TenantSource {
  /** World package tier, resolved via the embedded MVR cache. */
  worldTier: ApiTier
  /** EVE token (currency) tier, resolved via the embedded MVR cache. */
  currencyMvrName: string
  /** DataHub API host. */
  datahubHost: string
}

/**
 * Per-tenant source of truth. Multiple tenants may share a world or currency
 * tier.
 */
const TENANT_SOURCE: Record<TenantId, TenantSource> = {
  [TenantId.TAUCETI]: {
    worldTier: 'test',
    currencyMvrName: '@evefrontier/currency-test',
    datahubHost: 'world-api-tauceti.test.priv.evefrontier.com',
  },
  [TenantId.TIAKI]: {
    worldTier: 'test',
    currencyMvrName: '@evefrontier/currency-test',
    datahubHost: 'world-api-tiaki.test.priv.evefrontier.com',
  },
  [TenantId.TESSERACT]: {
    worldTier: 'test',
    currencyMvrName: '@evefrontier/currency-test',
    datahubHost: 'world-api-tesseract.test.priv.evefrontier.com',
  },
  [TenantId.TETRA]: {
    worldTier: 'test',
    currencyMvrName: '@evefrontier/currency-test',
    datahubHost: 'world-api-tetra.test.priv.evefrontier.com',
  },
  [TenantId.UTOPIA]: {
    worldTier: 'uat',
    currencyMvrName: '@evefrontier/currency-uat',
    datahubHost: 'world-api-utopia.uat.priv.evefrontier.com',
  },
  [TenantId.UMBRA]: {
    worldTier: 'uat',
    currencyMvrName: '@evefrontier/currency-uat',
    datahubHost: 'world-api-umbra.uat.priv.evefrontier.com',
  },
  [TenantId.STILLNESS]: {
    worldTier: 'live',
    currencyMvrName: '@evefrontier/currency',
    datahubHost: 'world-api-stillness.live.pub.evefrontier.com',
  },
  [TenantId.LIMINALITY]: {
    worldTier: 'ptu',
    currencyMvrName: '@evefrontier/currency-ptu',
    datahubHost: 'world-api-liminality.ptu.pub.evefrontier.com',
  },
}

/** Per-tenant config: world tier, EVE token package ID (Sui) and DataHub host.
 * World package ids are per package; see {@link getTenantWorldPackageId}.
 * @category Constants
 */
export interface TenantConfig {
  /** World tier this tenant runs. */
  worldTier: ApiTier
  /** EVE token package id (type-origin), derived from the MVR cache. */
  evePackageId: string
  /** DataHub API host. */
  datahubHost: string
  /** EVE token (currency) MVR tier this tenant runs. */
  currencyMvrName: string
}

/**
 * Per-tenant config, with the EVE package id resolved from the embedded MVR
 * cache.
 * Regenerate the cache with `bun run gen:mvr` after a contract upgrade.
 * @category Constants
 */
export const TENANT_CONFIG: Record<TenantId, TenantConfig> = Object.fromEntries(
  (Object.entries(TENANT_SOURCE) as [TenantId, TenantSource][]).map(
    ([id, src]) => [
      id,
      {
        worldTier: src.worldTier,
        evePackageId: evePackageIdFor(src.currencyMvrName),
        datahubHost: src.datahubHost,
        currencyMvrName: src.currencyMvrName,
      } satisfies TenantConfig,
    ],
  ),
) as Record<TenantId, TenantConfig>

/**
 * Resolve a world Move type to its fully-qualified, type-origin tag for a
 * tenant, e.g. `0x…::identity::Identity`. Throws if the tenant's tier is not in
 * the MVR cache.
 * @category Utilities
 */
export const getTenantWorldType = (
  tenant: TenantId,
  key: WorldTypeKey,
): string => getWorldType(TENANT_CONFIG[tenant].worldTier, key)

/**
 * A world package's id (type-origin) for a tenant. Throws if the tenant's tier
 * is not in the MVR cache.
 * @category Utilities
 */
export const getTenantWorldPackageId = (
  tenant: TenantId,
  pkg: WorldPackage,
): string => getWorldPackageId(TENANT_CONFIG[tenant].worldTier, pkg)

/** EVE token package ID per tenant (derived from TENANT_CONFIG).
 * @category Constants
 */
export const EVE_PACKAGE_ID_BY_TENANT = Object.fromEntries(
  (Object.entries(TENANT_CONFIG) as [TenantId, TenantConfig][]).map(
    ([id, config]) => [id, config.evePackageId],
  ),
) as Record<TenantId, string>
