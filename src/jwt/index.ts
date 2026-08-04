/**
 * @packageDocumentation
 *
 * Unverified JWT claim reading for Eve Frontier wallet flows: payload
 * decoding, normalized Eve claims, and API-gateway context derivation.
 *
 * Everything here decodes **without signature verification** — it is for
 * claims you do not need to trust (request routing, URL formation, session
 * correlation, display). Verifying a token cryptographically (JWKS)
 * remains the consumer's responsibility.
 *
 * Dependency-free: decoding uses `atob`/`TextDecoder`, available in both
 * Node and browsers.
 *
 * ## Usage
 *
 * The jwt entrypoint groups together:
 *
 * - `decodeJwtPayload` / `decodeJwtPayloadSafely`, raw payload decoding
 * - `decodeEveClaims`, tolerant extraction of the normalized
 *   `EveJwtClaims` (`nonce`, `sub`, `aud`, `tier`, `tenant`)
 * - `resolveEveTier` and `getApiContext`, the shared tenant→tier policy
 *   and API-gateway base-URL derivation. Environments front the gateway
 *   under different domains, so `getApiContext` takes the host as a
 *   `{tier}`-templated parameter rather than baking one in.
 *
 * ### Quick example
 *
 * ```ts
 * import {
 *   decodeEveClaims,
 *   getApiContext,
 * } from '@evefrontier/wallet-core/jwt'
 *
 * const { nonce, sub } = decodeEveClaims(idToken)
 *
 * const { apiBaseUrl, tenant } = getApiContext(idToken, {
 *   apiHostTemplate: 'api.{tier}.example.com',
 * })
 * const response = await fetch(`${apiBaseUrl}/auth/zklogin/zkp`, {
 *   headers: { 'X-Tenant': tenant },
 * })
 * ```
 */
export {
  type ApiContext,
  type ApiTier,
  type GetApiContextOptions,
  getApiContext,
  resolveEveTier,
  VALID_TIERS,
} from './api-context'
export { decodeEveClaims, type EveJwtClaims } from './claims'
export { decodeJwtPayload, decodeJwtPayloadSafely } from './decode'
