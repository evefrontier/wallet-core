/**
 * Alias-enforced signer wrapper (`0x2::address_alias`).
 *
 * `createAliasEnforcedSigner` wraps a zkLogin (or any Mysten) signer so that
 * signing is blocked until the owner has an enforceable address alias. The
 * wrapper delegates the actual signing to the inner signer — so zkLogin
 * signature wrapping is preserved — and only interposes an enforcement check.
 *
 * The alias-setup transaction itself is exempt (see `allowAliasSetupBypass`),
 * so the very first alias can be registered while the account still has none.
 */

import type { ClientWithCoreApi } from '@mysten/sui/client'
import type {
  IntentScope,
  PublicKey,
  SignatureScheme,
  SignatureWithBytes,
  Signer,
} from '@mysten/sui/cryptography'
import { Transaction } from '@mysten/sui/transactions'
import {
  AliasEnforcementError,
  type AliasEnforcementStatus,
  checkAliasEnforcement,
} from './enforcement'
import { isAddressAliasCall } from './risk'

/** Intent scope used when signing a transaction (vs. a personal message). */
const TRANSACTION_DATA_INTENT: IntentScope = 'TransactionData'

/**
 * The signing surface the wrapper delegates to. The Mysten `Signer` base class
 * — and therefore every `ZK*` signer from the `./crypto` entrypoint — satisfies
 * this shape.
 */
export type EnforceableSigner = Pick<
  Signer,
  | 'sign'
  | 'signWithIntent'
  | 'signTransaction'
  | 'signPersonalMessage'
  | 'toSuiAddress'
  | 'getPublicKey'
  | 'getKeyScheme'
>

export interface AliasEnforcedSignerConfig {
  /** The underlying signer whose signatures are gated (e.g. a `ZKEd25519Keypair`). */
  signer: EnforceableSigner
  /** The zkLogin owner address whose alias state is enforced. */
  owner: string
  /**
   * Resolves the current enforcement status. Called before each guarded sign.
   * Use {@link createOnChainStatusResolver} for the default on-chain read, and
   * wrap it with your own memoization to avoid a network round-trip per sign.
   */
  resolveStatus: () => Promise<AliasEnforcementStatus>
  /**
   * When true (default), transactions containing an address-alias MoveCall
   * bypass enforcement so the first alias can be registered. Personal
   * messages are never enforced — they don't move assets on-chain, so alias
   * policy doesn't apply to them.
   */
  allowAliasSetupBypass?: boolean
}

/**
 * Builds a resolver that reads on-chain alias state for `owner`. The returned
 * function performs a network read on every call; callers that sign frequently
 * should memoize it and invalidate the cache after registering an alias.
 */
export function createOnChainStatusResolver(
  client: ClientWithCoreApi,
  owner: string,
): () => Promise<AliasEnforcementStatus> {
  return () => checkAliasEnforcement(client, owner)
}

/**
 * True when a decoded transaction consists solely of address-alias MoveCalls.
 *
 * The exemption requires *every* command to be an address-alias call (and at
 * least one to exist), not merely that one is present. This keeps a caller from
 * bundling an alias call together with asset-moving commands to slip the whole
 * PTB past enforcement. The `enable`/`add` transactions this library builds each
 * contain a single alias MoveCall, so they still qualify.
 */
function isAliasSetupTransaction(bytes: Uint8Array): boolean {
  try {
    const { commands } = Transaction.from(bytes).getData()
    return (
      commands.length > 0 &&
      commands.every((command) => isAddressAliasCall(command))
    )
  } catch {
    // Undecodable bytes are never treated as an alias-setup exemption.
    return false
  }
}

/**
 * A signer that enforces address-alias policy before delegating to an inner
 * signer. Implements the Mysten `Signer` surface so it drops into
 * `client.core.signAndExecuteTransaction({ signer })` and `executeAddressAliasTx`.
 */
export class AliasEnforcedSigner implements EnforceableSigner {
  readonly #signer: EnforceableSigner
  readonly #owner: string
  readonly #resolveStatus: () => Promise<AliasEnforcementStatus>
  readonly #allowAliasSetupBypass: boolean

  constructor(config: AliasEnforcedSignerConfig) {
    this.#signer = config.signer
    this.#owner = config.owner
    this.#resolveStatus = config.resolveStatus
    this.#allowAliasSetupBypass = config.allowAliasSetupBypass ?? true
  }

  async #assertAllowed(): Promise<void> {
    const status = await this.#resolveStatus()
    if (!status.satisfied) {
      throw new AliasEnforcementError(this.#owner, status)
    }
  }

  /**
   * True when enforcement should be skipped for a transaction-signing call:
   * `allowAliasSetupBypass` is enabled and the bytes decode to an alias-setup
   * transaction. Only transaction-data signing is ever eligible — personal
   * messages are never enforced in the first place.
   */
  #isAliasSetupBypass(bytes: Uint8Array): boolean {
    return this.#allowAliasSetupBypass && isAliasSetupTransaction(bytes)
  }

  /**
   * Raw byte signing, below the intent layer. Deliberately unguarded: it has no
   * intent to distinguish a transaction from a personal message, so enforcement
   * cannot be applied here. Sign through `signTransaction`, `signWithIntent`, or
   * `client.core.signAndExecuteTransaction` for the alias policy to take effect.
   */
  sign(bytes: Uint8Array): Promise<Uint8Array<ArrayBuffer>> {
    return this.#signer.sign(bytes)
  }

  /**
   * Guards signing based on intent, then delegates to the inner signer.
   * Transaction signing (`TransactionData`) bypasses enforcement for
   * alias-setup calls (see `#isAliasSetupBypass`); personal messages
   * are never enforced, since they don't move assets on-chain.
   *
   * Note: this does not act as a single chokepoint. Because the wrapper
   * delegates to the inner signer's own methods, `signTransaction` and
   * `signPersonalMessage` apply enforcement independently rather than routing
   * through this method.
   */
  async signWithIntent(
    bytes: Uint8Array,
    intent: IntentScope,
  ): Promise<SignatureWithBytes> {
    const bypass =
      intent !== TRANSACTION_DATA_INTENT || this.#isAliasSetupBypass(bytes)

    if (!bypass) {
      await this.#assertAllowed()
    }
    return this.#signer.signWithIntent(bytes, intent)
  }

  async signTransaction(bytes: Uint8Array): Promise<SignatureWithBytes> {
    if (!this.#isAliasSetupBypass(bytes)) {
      await this.#assertAllowed()
    }
    return this.#signer.signTransaction(bytes)
  }

  /**
   * Personal messages never move assets on-chain, so alias policy doesn't
   * apply — this delegates straight through without enforcement.
   */
  signPersonalMessage(
    bytes: Uint8Array,
  ): Promise<{ bytes: string; signature: string }> {
    return this.#signer.signPersonalMessage(bytes)
  }

  toSuiAddress(): string {
    return this.#signer.toSuiAddress()
  }

  getPublicKey(): PublicKey {
    return this.#signer.getPublicKey()
  }

  getKeyScheme(): SignatureScheme {
    return this.#signer.getKeyScheme()
  }
}

/**
 * Wraps a signer so signing is blocked until the owner has an enforceable
 * address alias. See {@link AliasEnforcedSignerConfig}.
 */
export function createAliasEnforcedSigner(
  config: AliasEnforcedSignerConfig,
): AliasEnforcedSigner {
  return new AliasEnforcedSigner(config)
}
