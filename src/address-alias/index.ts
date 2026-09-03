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
 * - enforcement + onboarding: the alias policy (`evaluateAliasEnforcement`,
 *   `checkAliasEnforcement`), a `createAliasEnforcedSigner` wrapper that blocks
 *   signing until an alias exists, and the alias provisioners
 *   (`provisionPasskeyAlias` — default, biometric; `provisionLedgerAlias` —
 *   hardware; `generateAliasKey` / `provisionGeneratedAlias` — mnemonic
 *   fallback) plus `registerAcknowledgedAlias` to register the first alias
 *
 * ## Enforcement & onboarding
 *
 * Wallets can require every account to have at least one alias that is not the
 * account itself before allowing signing. On-chain state is the source of
 * truth; user acknowledgement gates registering the alias.
 *
 * 1. Wrap the zkLogin signer with `createAliasEnforcedSigner` and use it for
 *    all signing. It throws `AliasEnforcementError` until an alias exists,
 *    exempting the alias-setup transaction itself.
 * 2. On that error, provision an alias key. Prefer `provisionPasskeyAlias(...)`
 *    (a biometric passkey, stored and synced by the platform credential
 *    manager — nothing for the user to write down); offer `provisionLedgerAlias(...)`
 *    for a hardware wallet; fall back to `generateAliasKey()` /
 *    `provisionGeneratedAlias()` and display the `mnemonic` + `privateKey` once,
 *    never persisting them. For a passkey, persist the returned `publicKey` so
 *    the signer can be rebuilt later.
 * 3. After the user acknowledges the key is saved (for a passkey, that the
 *    credential was created — ideally with a backup key too), call
 *    `registerAcknowledgedAlias({ acknowledged: true, aliasAddress, ... })` to
 *    register the address on-chain, then refresh the signer's status resolver so
 *    signing unblocks. A device-bound (non-synced) passkey is lost with the
 *    device, so encourage a second alias of a different kind for continuity.
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
export {
  AliasEnforcementError,
  type AliasEnforcementReason,
  type AliasEnforcementStatus,
  checkAliasEnforcement,
  evaluateAliasEnforcement,
  hasEnforceableAlias,
} from './enforcement'
export {
  AliasEnforcedSigner,
  type AliasEnforcedSignerConfig,
  createAliasEnforcedSigner,
  createOnChainStatusResolver,
  type EnforceableSigner,
} from './guarded-signer'
export {
  AliasAcknowledgementRequiredError,
  type AliasSource,
  type GeneratedAliasKey,
  type GeneratedProvisionedAlias,
  generateAliasKey,
  type ProvisionedAlias,
  provisionGeneratedAlias,
  type RegisterAcknowledgedAliasParams,
  type RegisterAcknowledgedAliasResult,
  registerAcknowledgedAlias,
} from './provision'
export {
  type LedgerProvisionedAlias,
  type ProvisionLedgerAliasParams,
  provisionLedgerAlias,
} from './provision-ledger'
export {
  createBrowserPasskeyProvider,
  type PasskeyAuthenticatorAttachment,
  type PasskeyProvisionedAlias,
  type ProvisionPasskeyAliasParams,
  provisionPasskeyAlias,
  type RecoverPasskeyKeypairParams,
  recoverPasskeyKeypair,
} from './provision-passkey'
export { getAddressAliases, parseAddressAliases } from './query'
export { isAddressAliasCall, isRecord } from './risk'
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
