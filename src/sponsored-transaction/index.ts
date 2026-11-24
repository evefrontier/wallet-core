/**
 * @packageDocumentation
 *
 * Types and helpers for Eve Frontier sponsored transaction flows.
 *
 * ## Usage
 *
 * The sponsored-transaction entrypoint groups together:
 *
 * - `SponsoredTransactionActions`, the entity actions the gateway sponsors
 * - transaction input and output types for the sponsored signing method
 * - `SponsoredTransactionMethod`, the wallet-facing method signature
 * - `fetchUnsignedSponsoredTransaction` / `executeSponsoredTransaction`, the
 *   API gateway calls implementing the prepare → sign → execute flow. The
 *   gateway connection (URL formation, bearer token) is supplied by the
 *   caller via `SponsoredTransactionApiContext`, and the `X-Tenant` header is
 *   read from the token's `tenant` claim; failures throw
 *   `SponsoredTransactionError` for consumers to map to their own error
 *   surface.
 * - `fetchUnsignedAddressAliasTransaction`, the same prepare step for
 *   enabling address aliasing or adding an alias; execute it with
 *   `executeSponsoredTransaction`.
 *
 * These exports are intended to be shared between transaction-building code and
 * wallet feature definitions so both sides agree on payload shape.
 *
 * ### Prepare, sign, execute
 *
 * ```ts
 * const unsigned = await fetchUnsignedSponsoredTransaction(input, apiContext)
 * const { signature } = await keypair.signTransaction(
 *   fromBase64(unsigned.bcsDataB64Bytes),
 * )
 * const { digest } = await executeSponsoredTransaction(
 *   { preparationId: unsigned.preparationId, userSignatureB64Bytes: signature },
 *   apiContext,
 * )
 * ```
 *
 * ### Quick example
 *
 * ```ts
 * import {
 *   SponsoredTransactionActions,
 *   type SponsoredTransactionInput,
 * } from '@evefrontier/wallet-core/sponsored-transaction'
 *
 * const rename: SponsoredTransactionInput = {
 *   txAction: SponsoredTransactionActions.UPDATE_METADATA,
 *   entityId: '42',
 *   metadata: { name: 'My SSU', description: '', url: '' },
 * }
 *
 * const powerOn: SponsoredTransactionInput = {
 *   txAction: SponsoredTransactionActions.SET_POWER_GRID,
 *   entityId: '42',
 *   on: true,
 * }
 * ```
 */
export * from './actions'
export * from './http'
export * from './wallet-standard-extension-method'
