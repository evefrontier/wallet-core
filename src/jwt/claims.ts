import { decodeJwtPayload } from './decode'

/**
 * Normalized Eve Frontier JWT claims used by wallet auth/session flows.
 *
 * Optional or invalid claim values are represented as empty strings, except
 * `nonce`, which remains `undefined` when missing/invalid so callers can
 * handle legacy no-nonce compatibility paths explicitly.
 */
export interface EveJwtClaims {
  nonce: string | undefined
  sub: string
  aud: string
  tier: string
  tenant: string
}

/**
 * Decodes a JWT (without signature verification) and extracts the Eve
 * Frontier claims, tolerating missing or mismatched claim types.
 *
 * @throws when the token itself is malformed (see {@link decodeJwtPayload}).
 */
export function decodeEveClaims(token: string): EveJwtClaims {
  const payload = decodeJwtPayload<{
    nonce?: unknown
    sub?: unknown
    aud?: unknown
    tier?: unknown
    tenant?: unknown
  }>(token)

  return {
    nonce: typeof payload.nonce === 'string' ? payload.nonce : undefined,
    sub: typeof payload.sub === 'string' ? payload.sub : '',
    aud: typeof payload.aud === 'string' ? payload.aud : '',
    tier: typeof payload.tier === 'string' ? payload.tier : '',
    tenant: typeof payload.tenant === 'string' ? payload.tenant : '',
  }
}
