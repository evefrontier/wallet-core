/**
 * One-time alias-key provisioning and acknowledgement-gated registration
 * (`0x2::address_alias`).
 *
 * @experimental This module's API has not been architecturally agreed on and
 * may change or be removed without a major version bump.
 *
 * `generateAliasKey` mints a fresh client-only keypair for the user to record
 * once (mnemonic + private key). wallet-core keeps no reference to it — keeping
 * the material out of storage is the consumer's responsibility. Once the user
 * acknowledges they have saved it, `registerAcknowledgedAlias` registers the
 * key's address on-chain as an alias of the zkLogin account, which unblocks
 * signing.
 */

import type { ClientWithCoreApi } from '@mysten/sui/client'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { generateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { getAddressAliases } from './query'
import {
  addAddressAliasTxBytes,
  executeAddressAliasTx,
  executeEnableAddressAliasTx,
  type TransactionBytesSigner,
} from './transaction'
import { validateNewAddressAlias } from './validation'

/** Default BIP39 entropy strength in bits (24-word mnemonic). */
const MNEMONIC_STRENGTH_BITS = 256

/**
 * A freshly generated client-only alias key. Display it to the user once and
 * never persist it: `mnemonic` and `privateKey` are two representations of the
 * same key, and `address` is the value registered on-chain as the alias.
 */
export interface GeneratedAliasKey {
  /** BIP39 mnemonic (24 words) — the recovery phrase to display once. */
  mnemonic: string
  /** Bech32 `suiprivkey1…` secret key derived from the mnemonic. */
  privateKey: string
  /** The Sui address to register as an alias. */
  address: string
}

/**
 * Generates a new client-only alias keypair. The returned material is the only
 * copy — wallet-core retains no reference. Show it to the user once, capture
 * their acknowledgement, then register {@link GeneratedAliasKey.address} with
 * {@link registerAcknowledgedAlias}.
 */
export function generateAliasKey(): GeneratedAliasKey {
  const mnemonic = generateMnemonic(wordlist, MNEMONIC_STRENGTH_BITS)
  const keypair = Ed25519Keypair.deriveKeypair(mnemonic)
  return {
    mnemonic,
    privateKey: keypair.getSecretKey(),
    address: keypair.toSuiAddress(),
  }
}

/**
 * Thrown when {@link registerAcknowledgedAlias} is called without the user
 * having acknowledged that they saved the alias key. Acknowledgement gates
 * on-chain registration so an alias is never registered for a key the user
 * cannot recover.
 */
export class AliasAcknowledgementRequiredError extends Error {
  readonly code = 'alias_acknowledgement_required'

  constructor() {
    super(
      'Alias registration requires the user to acknowledge they saved the alias key.',
    )
    this.name = 'AliasAcknowledgementRequiredError'
  }
}

export interface RegisterAcknowledgedAliasParams {
  suiClient: ClientWithCoreApi
  /** The zkLogin owner address; the sender of the enable/add transactions. */
  owner: string
  /** The zkLogin signer authorizing the enable/add transactions. */
  signer: TransactionBytesSigner
  /** The alias address to register (from {@link generateAliasKey}). */
  aliasAddress: string
  /** Must be `true`: the user has acknowledged saving the alias key. */
  acknowledged: boolean
  /**
   * Pre-read aliases info. When omitted it is fetched via `getAddressAliases`.
   * Pass it to avoid a redundant read when the caller already has it.
   */
  info?: Awaited<ReturnType<typeof getAddressAliases>>
  /** Overrides the default address-alias gas budget for both transactions. */
  gasBudget?: number
}

/** Digests produced by {@link registerAcknowledgedAlias}. */
export interface RegisterAcknowledgedAliasResult {
  /** Digest of the `enable` transaction, when the object had to be minted. */
  enableDigest?: string
  /** Digest of the `add` transaction that registered the alias. */
  addDigest: string
}

/**
 * Registers `aliasAddress` as an on-chain alias of `owner`, gated on user
 * acknowledgement.
 *
 * Mints the owner's `AddressAliases` object first when it does not exist yet
 * (`enable` transfers the minted object internally, so its id is only known
 * after a re-read — enable and add cannot share one PTB). Throws
 * {@link AliasAcknowledgementRequiredError} when not acknowledged, or a
 * validation error when the alias address is invalid, self, a duplicate, or
 * over the maximum.
 */
export async function registerAcknowledgedAlias({
  suiClient,
  owner,
  signer,
  aliasAddress,
  acknowledged,
  info,
  gasBudget,
}: RegisterAcknowledgedAliasParams): Promise<RegisterAcknowledgedAliasResult> {
  if (acknowledged !== true) {
    throw new AliasAcknowledgementRequiredError()
  }

  const aliasesInfo = info ?? (await getAddressAliases(suiClient, owner))

  const validationError = validateNewAddressAlias({
    addressAlias: aliasAddress,
    existing: aliasesInfo.addressAliases,
  })
  if (validationError) {
    throw new Error(validationError)
  }

  let enableDigest: string | undefined
  let aliasesObjectId = aliasesInfo.objectId
  if (!aliasesInfo.enabled) {
    // `enable` mints and transfers the object; its id comes from the effects.
    const enableResult = await executeEnableAddressAliasTx({
      suiClient,
      sender: owner,
      signer,
      gasBudget,
    })
    enableDigest = enableResult.digest
    aliasesObjectId = enableResult.objectId

    // Wait for the minted object to propagate so the `add` transaction below
    // can resolve it as an input, then re-read as a fallback when the effects
    // did not surface the id.
    await suiClient.core.waitForTransaction({ digest: enableResult.digest })
    if (!aliasesObjectId) {
      aliasesObjectId = (await getAddressAliases(suiClient, owner)).objectId
    }
  }

  if (!aliasesObjectId) {
    throw new Error(
      'Address aliases object was not found after enabling; cannot register alias.',
    )
  }
  const addDigest = await executeAddressAliasTx({
    suiClient,
    sender: owner,
    signer,
    buildBytes: (sender, client) =>
      addAddressAliasTxBytes(
        sender,
        aliasesObjectId,
        aliasAddress,
        client,
        gasBudget,
      ),
  })

  return enableDigest === undefined
    ? { addDigest }
    : { enableDigest, addDigest }
}
