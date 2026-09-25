import { getMvrCache } from './mvr/mvrCache.generated'
import type { WorldTypeKey } from './mvr/worldTypeKeys'

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
 * `@evefrontier/world::in_game_id::TenantItemId`), pinned to the package version
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

/** Type-origin tag for a world Move type under a world MVR tier. */
const worldTypeTag = (mvrName: string, key: WorldTypeKey): string =>
  originTag(`${mvrName}::${key}`)

/**
 * The tier's world package id (type-origin), anchored on the ObjectRegistry
 * type.
 */
const worldPackageId = (mvrName: string): string =>
  packageIdOf(worldTypeTag(mvrName, 'object_registry::ObjectRegistry'))

/**
 * The tier's EVE token package id (type-origin of the `EVE::EVE` coin type),
 * derived from the `@evefrontier/currency*` MVR registration.
 */
const evePackageIdFor = (currencyMvrName: string): string =>
  packageIdOf(originTag(`${currencyMvrName}::EVE::EVE`))

/**
 * Per-tenant identity: which world MVR tier it runs, which currency MVR tier its
 * EVE token lives on, and its DataHub host.
 */
interface TenantSource {
  /** World package tier, resolved via the embedded MVR cache. */
  mvrName: string
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
    mvrName: '@evefrontier/world-test',
    currencyMvrName: '@evefrontier/currency-test',
    datahubHost: 'world-api-tauceti.test.priv.evefrontier.com',
  },
  [TenantId.TIAKI]: {
    mvrName: '@evefrontier/world-test',
    currencyMvrName: '@evefrontier/currency-test',
    datahubHost: 'world-api-tiaki.test.priv.evefrontier.com',
  },
  [TenantId.TESSERACT]: {
    mvrName: '@evefrontier/world-test',
    currencyMvrName: '@evefrontier/currency-test',
    datahubHost: 'world-api-tesseract.test.priv.evefrontier.com',
  },
  [TenantId.TETRA]: {
    mvrName: '@evefrontier/world-test',
    currencyMvrName: '@evefrontier/currency-test',
    datahubHost: 'world-api-tetra.test.priv.evefrontier.com',
  },
  [TenantId.UTOPIA]: {
    mvrName: '@evefrontier/world-uat',
    currencyMvrName: '@evefrontier/currency-uat',
    datahubHost: 'world-api-utopia.uat.priv.evefrontier.com',
  },
  [TenantId.UMBRA]: {
    mvrName: '@evefrontier/world-uat',
    currencyMvrName: '@evefrontier/currency-uat',
    datahubHost: 'world-api-umbra.uat.priv.evefrontier.com',
  },
  [TenantId.STILLNESS]: {
    mvrName: '@evefrontier/world',
    currencyMvrName: '@evefrontier/currency',
    datahubHost: 'world-api-stillness.live.pub.evefrontier.com',
  },
  [TenantId.LIMINALITY]: {
    mvrName: '@evefrontier/world',
    currencyMvrName: '@evefrontier/currency',
    datahubHost: 'world-api-liminality.live.pub.evefrontier.com',
  },
}

/** Per-tenant config: world + EVE token package IDs (Sui) and DataHub host.
 * @category Constants
 */
export interface TenantConfig {
  /** World package id (type-origin), derived from the MVR cache. */
  packageId: string
  /** EVE token package id (type-origin), derived from the MVR cache. */
  evePackageId: string
  /** DataHub API host. */
  datahubHost: string
  /** World MVR tier this tenant runs. */
  mvrName: string
  /** EVE token (currency) MVR tier this tenant runs. */
  currencyMvrName: string
}

/**
 * Per-tenant config, with package ids resolved from the embedded MVR cache.
 * Regenerate the cache with `bun run gen:mvr` after a contract upgrade.
 * @category Constants
 */
export const TENANT_CONFIG: Record<TenantId, TenantConfig> = Object.fromEntries(
  (Object.entries(TENANT_SOURCE) as [TenantId, TenantSource][]).map(
    ([id, src]) => [
      id,
      {
        packageId: worldPackageId(src.mvrName),
        evePackageId: evePackageIdFor(src.currencyMvrName),
        datahubHost: src.datahubHost,
        mvrName: src.mvrName,
        currencyMvrName: src.currencyMvrName,
      } satisfies TenantConfig,
    ],
  ),
) as Record<TenantId, TenantConfig>

/**
 * Resolve a world Move type to its fully-qualified, type-origin tag for a
 * tenant, e.g. `0x…::in_game_id::TenantItemId`.
 * @category Utilities
 */
export const getTenantWorldType = (
  tenant: TenantId,
  key: WorldTypeKey,
): string => worldTypeTag(TENANT_CONFIG[tenant].mvrName, key)

/** EVE token package ID per tenant (derived from TENANT_CONFIG).
 * @category Constants
 */
export const EVE_PACKAGE_ID_BY_TENANT = Object.fromEntries(
  (Object.entries(TENANT_CONFIG) as [TenantId, TenantConfig][]).map(
    ([id, config]) => [id, config.evePackageId],
  ),
) as Record<TenantId, string>
