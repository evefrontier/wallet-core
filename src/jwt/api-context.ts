import { TenantId } from '#src/tenant'
import { decodeEveClaims, type EveJwtClaims } from './claims'

/** API tiers accepted in the JWT `tier` claim. @category Constants */
export const VALID_TIERS = ['dev', 'test', 'uat', 'live'] as const

/**
 * Canonical `{tier}`-templated API-gateway host for {@link getApiContext}'s
 * `apiHostTemplate`. No scheme — `getApiContext` prepends `https://`.
 *
 * @category Constants
 */
export const EVE_API_HOST_TEMPLATE = 'api.{tier}.pub.evefrontier.com'

export type ApiTier = (typeof VALID_TIERS)[number]

const VALID_TIER_SET: ReadonlySet<string> = new Set(VALID_TIERS)

/**
 * Resolves the effective API tier for a tenant/claims combination.
 *
 * `stillness`/`liminality` default to `live` and unlisted tenants to `test`,
 * but an explicit `tier` claim overrides both. `utopia`/`umbra` are always
 * `uat`.
 */
export function resolveEveTier(
  claims: Pick<EveJwtClaims, 'tenant' | 'tier'>,
): string {
  switch (claims.tenant) {
    case TenantId.STILLNESS:
      return claims.tier || 'live'
    case TenantId.LIMINALITY:
      return claims.tier || 'live'
    case TenantId.UTOPIA:
      return 'uat'
    case TenantId.UMBRA:
      return 'uat'
    default:
      return claims.tier || 'test'
  }
}

export interface ApiContext {
  /** Base URL of the Eve Frontier API gateway, e.g. `https://api.test.example.com`. */
  apiBaseUrl: string
  tenant: string
  tier: ApiTier
  /** The decoded, normalized claims the context was derived from. */
  claims: EveJwtClaims
}

export interface GetApiContextOptions {
  /**
   * Host pattern for the API gateway with a literal `{tier}` placeholder,
   * e.g. `api.{tier}.example.com`. Environments front the gateway under
   * different domains, so the host is caller-supplied rather than baked in.
   */
  apiHostTemplate: string
}

/**
 * Derives the Eve Frontier API gateway base URL and tenant from a JWT.
 *
 * Decodes the token without signature verification — use this for URL
 * formation and request routing, not for trust decisions.
 *
 * @throws when the token is malformed, the host template has no `{tier}`
 * placeholder, or the resolved tier is not one of {@link VALID_TIERS}.
 */
export function getApiContext(
  token: string,
  options: GetApiContextOptions,
): ApiContext {
  const { apiHostTemplate } = options
  if (!apiHostTemplate.includes('{tier}')) {
    throw new Error('apiHostTemplate must contain a {tier} placeholder')
  }

  const claims = decodeEveClaims(token)
  const tier = resolveEveTier(claims)

  if (!VALID_TIER_SET.has(tier)) {
    throw new Error('Invalid tier claim in token')
  }

  return {
    apiBaseUrl: `https://${apiHostTemplate.replace('{tier}', tier)}`,
    tenant: claims.tenant,
    tier: tier as ApiTier,
    claims,
  }
}
