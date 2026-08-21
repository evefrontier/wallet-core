import type { ClientWithCoreApi } from '@mysten/sui/client'
import { Transaction } from '@mysten/sui/transactions'
import {
  ADDRESS_ALIAS_MODULE,
  ADDRESS_ALIAS_STATE,
  ADDRESS_ALIASES_TYPE,
  DEFAULT_ADDRESS_ALIAS_GAS_BUDGET,
} from './config'

/**
 * Anything able to sign BCS transaction bytes — the Mysten `Signer` base class
 * (including `ZKEd25519Keypair` and the other zkLogin signers from the
 * `./crypto` entrypoint) satisfies this shape.
 */
export interface TransactionBytesSigner {
  signTransaction(bytes: Uint8Array): Promise<{ signature: string }>
}

export type ExecuteAddressAliasTransactionParams = {
  suiClient: ClientWithCoreApi
  /** The alias owner's address; set as the transaction sender. */
  sender: string
  signer: TransactionBytesSigner
  /** Builds the transaction bytes for the specific address alias action. */
  buildBytes: (
    sender: string,
    suiClient: ClientWithCoreApi,
  ) => Promise<Uint8Array>
}

/**
 * Assembles an address alias PTB: runs the caller's command(s), then sets the
 * sender and gas budget. Every address alias transaction shares this tail.
 */
function newAddressAliasTx(
  sender: string,
  addCommands: (tx: Transaction) => void,
  gasBudget: number = DEFAULT_ADDRESS_ALIAS_GAS_BUDGET,
): Transaction {
  const tx = new Transaction()
  addCommands(tx)
  tx.setSender(sender)
  tx.setGasBudget(gasBudget)
  return tx
}

async function buildAddressAliasTx(
  tx: Transaction,
  suiClient: ClientWithCoreApi,
): Promise<Uint8Array> {
  const txb = await tx.build({ client: suiClient })
  return new Uint8Array(txb)
}

/**
 * Enable address alias configuration for the sender. Creates the caller's
 * `AddressAliases` object; `enable` transfers the minted object to the caller
 * internally.
 *
 * @param gasBudget overrides {@link DEFAULT_ADDRESS_ALIAS_GAS_BUDGET}
 */
export function enableAddressAliasTx(
  sender: string,
  gasBudget?: number,
): Transaction {
  return newAddressAliasTx(
    sender,
    (tx) => {
      tx.moveCall({
        target: `${ADDRESS_ALIAS_MODULE}::enable`,
        arguments: [tx.object(ADDRESS_ALIAS_STATE)],
      })
    },
    gasBudget,
  )
}

/** BCS bytes variant of {@link enableAddressAliasTx}. */
export function enableAddressAliasTxBytes(
  sender: string,
  suiClient: ClientWithCoreApi,
  gasBudget?: number,
): Promise<Uint8Array> {
  return buildAddressAliasTx(enableAddressAliasTx(sender, gasBudget), suiClient)
}

/**
 * Add a new address alias to the caller's `AddressAliases` object.
 *
 * @param aliasesObjectId the caller's AddressAliases object id (from the read path)
 * @param addressAlias the address to add as an alias
 * @param gasBudget overrides {@link DEFAULT_ADDRESS_ALIAS_GAS_BUDGET}
 */
export function addAddressAliasTx(
  sender: string,
  aliasesObjectId: string,
  addressAlias: string,
  gasBudget?: number,
): Transaction {
  return newAddressAliasTx(
    sender,
    (tx) => {
      tx.moveCall({
        target: `${ADDRESS_ALIAS_MODULE}::add`,
        arguments: [tx.object(aliasesObjectId), tx.pure.address(addressAlias)],
      })
    },
    gasBudget,
  )
}

/** BCS bytes variant of {@link addAddressAliasTx}. */
export function addAddressAliasTxBytes(
  sender: string,
  aliasesObjectId: string,
  addressAlias: string,
  suiClient: ClientWithCoreApi,
  gasBudget?: number,
): Promise<Uint8Array> {
  return buildAddressAliasTx(
    addAddressAliasTx(sender, aliasesObjectId, addressAlias, gasBudget),
    suiClient,
  )
}

/**
 * Removes an address alias from the caller's `AddressAliases` object.
 *
 * @param aliasesObjectId the caller's AddressAliases object id (from the read path)
 * @param addressAlias the address alias to remove
 * @param gasBudget overrides {@link DEFAULT_ADDRESS_ALIAS_GAS_BUDGET}
 */
export function removeAddressAliasTx(
  sender: string,
  aliasesObjectId: string,
  addressAlias: string,
  gasBudget?: number,
): Transaction {
  return newAddressAliasTx(
    sender,
    (tx) => {
      tx.moveCall({
        target: `${ADDRESS_ALIAS_MODULE}::remove`,
        arguments: [tx.object(aliasesObjectId), tx.pure.address(addressAlias)],
      })
    },
    gasBudget,
  )
}

/** BCS bytes variant of {@link removeAddressAliasTx}. */
export function removeAddressAliasTxBytes(
  sender: string,
  aliasesObjectId: string,
  addressAlias: string,
  suiClient: ClientWithCoreApi,
  gasBudget?: number,
): Promise<Uint8Array> {
  return buildAddressAliasTx(
    removeAddressAliasTx(sender, aliasesObjectId, addressAlias, gasBudget),
    suiClient,
  )
}

/**
 * Signs and executes an address alias PTB, returning the transaction digest.
 *
 * Build bytes → sign → execute via the client's core API. Throws when the
 * transaction fails on chain.
 */
export async function executeAddressAliasTx({
  suiClient,
  sender,
  signer,
  buildBytes,
}: ExecuteAddressAliasTransactionParams): Promise<string> {
  const txBytes = await buildBytes(sender, suiClient)
  const { signature } = await signer.signTransaction(txBytes)

  const result = await suiClient.core.executeTransaction({
    transaction: txBytes,
    signatures: [signature],
  })

  if (result.$kind === 'FailedTransaction') {
    throw new Error(
      `Address alias transaction failed: ${result.FailedTransaction.digest}`,
    )
  }

  return result.Transaction.digest
}

/** Digest plus the id of the `AddressAliases` object minted by `enable`. */
export interface EnableAddressAliasResult {
  digest: string
  /**
   * The minted `AddressAliases` object id, read directly from the transaction
   * effects. Undefined only if it could not be located in the effects (the
   * caller should then fall back to a read after the transaction propagates).
   */
  objectId?: string | undefined
}

/**
 * Signs and executes the `enable` transaction, resolving the minted
 * `AddressAliases` object id from the transaction effects.
 *
 * Reading the id from effects avoids the read-after-write race that a fresh
 * owned-object query hits: right after execution the newly minted object is not
 * yet visible to the read path, so listing owned objects can miss it.
 */
export async function executeEnableAddressAliasTx({
  suiClient,
  sender,
  signer,
  gasBudget,
}: {
  suiClient: ClientWithCoreApi
  sender: string
  signer: TransactionBytesSigner
  gasBudget?: number | undefined
}): Promise<EnableAddressAliasResult> {
  const txBytes = await enableAddressAliasTxBytes(sender, suiClient, gasBudget)
  const { signature } = await signer.signTransaction(txBytes)

  const result = await suiClient.core.executeTransaction({
    transaction: txBytes,
    signatures: [signature],
    include: { effects: true, objectTypes: true },
  })

  if (result.$kind === 'FailedTransaction') {
    throw new Error(
      `Address alias transaction failed: ${result.FailedTransaction.digest}`,
    )
  }

  const { digest, effects, objectTypes } = result.Transaction
  const created = effects?.changedObjects.find(
    (object) =>
      object.idOperation === 'Created' &&
      (objectTypes?.[object.objectId]?.startsWith(ADDRESS_ALIASES_TYPE) ??
        false),
  )

  return { digest, objectId: created?.objectId }
}
