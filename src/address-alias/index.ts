/**
 * @packageDocumentation
 *
 * Helpers for Sui address aliases (`0x2::address_alias`).
 *
 * @experimental This entry point has not been architecturally agreed on by
 * the team yet. The API surface may change or be removed in any release
 * without a major version bump — do not build on it without checking in
 * first.
 *
 * An address alias is another Sui address authorized to sign transactions for
 * your address — effectively a co-owner with full access. For zkLogin
 * accounts this is the key-continuity primitive: the zkLogin-derived address
 * can authorize additional keys as co-signers.
 *
 * Docs: https://docs.sui.io/develop/transactions/transaction-auth/address-aliases
 *
 * ## Usage
 *
 * The address-alias entrypoint groups together:
 *
 * - constants and the `AddressAliasesInfo` read model
 * - `getAddressAliases`, the owned-object read path
 * - transaction builders for `enable`, `add`, and `remove`, plus
 *   `executeAddressAliasTx` to sign and execute them
 * - `validateNewAddressAlias` / `validateExistingAddressAlias` input checks
 * - `isAddressAliasCall`, for wallet approval flows that flag alias
 *   transactions
 *
 * All chain-facing helpers accept any client satisfying the Mysten SDK's
 * `ClientWithCoreApi` (e.g. `SuiGrpcClient`), and any signer with a
 * `signTransaction` method — including the zkLogin signers from the
 * `./crypto` entrypoint.
 *
 * ### Quick example
 *
 * ```ts
 * import {
 *   addAddressAliasTxBytes,
 *   executeAddressAliasTx,
 *   getAddressAliases,
 *   validateNewAddressAlias,
 * } from '@evefrontier/wallet-core/address-alias'
 *
 * const { enabled, objectId, addressAliases } = await getAddressAliases(
 *   suiClient,
 *   owner,
 * )
 *
 * const error = validateNewAddressAlias({
 *   addressAlias: newAlias,
 *   existing: addressAliases,
 * })
 * if (error) throw new Error(error)
 *
 * const digest = await executeAddressAliasTx({
 *   suiClient,
 *   sender: owner,
 *   signer: zkKeypair,
 *   buildBytes: (sender, client) =>
 *     addAddressAliasTxBytes(sender, objectId!, newAlias, client),
 * })
 * ```
 */
export {
  ADDRESS_ALIAS_MODULE,
  ADDRESS_ALIAS_STATE,
  ADDRESS_ALIASES_TYPE,
  type AddressAliasesInfo,
  DEFAULT_ADDRESS_ALIAS_GAS_BUDGET,
  MAX_ADDRESS_ALIASES,
} from './config'
export { getAddressAliases, parseAddressAliases } from './query'
export { isAddressAliasCall } from './risk'
export {
  addAddressAliasTx,
  addAddressAliasTxBytes,
  type ExecuteAddressAliasTransactionParams,
  enableAddressAliasTx,
  enableAddressAliasTxBytes,
  executeAddressAliasTx,
  removeAddressAliasTx,
  removeAddressAliasTxBytes,
  type TransactionBytesSigner,
} from './transaction'
export {
  type ValidateAddressAliasParams,
  validateExistingAddressAlias,
  validateNewAddressAlias,
} from './validation'
