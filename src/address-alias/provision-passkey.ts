/**
 * Passkey-backed alias provisioning (`0x2::address_alias`).
 *
 * @experimental This module's API has not been architecturally agreed on and
 * may change or be removed without a major version bump.
 *
 * A passkey alias replaces the write-it-down mnemonic from {@link generateAliasKey}
 * with a biometric WebAuthn credential. `provisionPasskeyAlias` runs the passkey
 * create ceremony and returns the credential's Sui address to register on-chain
 * with {@link registerAcknowledgedAlias}; the private key never leaves the
 * platform authenticator (Touch ID / Face ID / Windows Hello) and is stored and
 * synced by the OS credential manager (iCloud Keychain, Google Password Manager,
 * 1Password, …).
 *
 * WebAuthn does not return the public key on later assertions, so persist the
 * returned {@link PasskeyProvisionedAlias.publicKey} to rebuild a signer for
 * recovery/co-signing — otherwise use {@link recoverPasskeyKeypair} without a
 * stored key, which re-derives it via two signing ceremonies. This is a
 * browser-only path: it requires a secure context and `navigator.credentials`.
 */

import {
  BrowserPasskeyProvider,
  type BrowserPasswordProviderOptions,
  findCommonPublicKey,
  PasskeyKeypair,
  type PasskeyProvider,
} from '@mysten/sui/keypairs/passkey'
import { fromBase64, toBase64 } from '@mysten/sui/utils'

/** WebAuthn authenticator kinds. `platform` is the device's built-in biometric. */
export type PasskeyAuthenticatorAttachment = 'platform' | 'cross-platform'

export interface ProvisionPasskeyAliasParams {
  /** Human-readable name shown in the passkey prompt and stored on the credential. */
  appName: string
  /** Relying-party display name. Defaults to {@link appName}. */
  rpName?: string
  /**
   * Relying-party id — the origin the passkey is scoped to. Defaults to
   * `window.location.hostname`. A passkey can only be used again from this rpId.
   */
  rpId?: string
  /**
   * Authenticator to use. Defaults to `platform` (biometric: Touch ID / Face ID
   * / Windows Hello). Use `cross-platform` for a hardware security key or a phone.
   */
  attachment?: PasskeyAuthenticatorAttachment
}

/**
 * A passkey alias created by {@link provisionPasskeyAlias}. Register
 * {@link address} on-chain and persist {@link publicKey} (and
 * {@link credentialId}) so the signer can be rebuilt later without a recovery
 * ceremony.
 */
export interface PasskeyProvisionedAlias {
  source: 'passkey'
  /** The Sui address to register on-chain as the alias. */
  address: string
  /** Base64 secp256r1 public key — persist it to rebuild the signer. */
  publicKey: string
  /** Base64 WebAuthn credential id, when the authenticator returned one. */
  credentialId?: string
  /** The live keypair from this ceremony; cache it to sign without re-recovery. */
  keypair: PasskeyKeypair
}

/**
 * Throws when the current environment cannot run the WebAuthn create/get
 * ceremonies (no `window`/`navigator.credentials`, or an insecure context).
 */
function assertBrowserPasskeyEnv(): void {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !navigator.credentials
  ) {
    throw new Error(
      'Passkey aliases require a browser environment with WebAuthn (navigator.credentials) available.',
    )
  }
  if (window.isSecureContext === false) {
    throw new Error(
      'Passkey aliases require a secure context (HTTPS, or localhost).',
    )
  }
}

/**
 * Builds a `BrowserPasskeyProvider` for the given app/relying-party. The
 * default authenticator is `platform` (biometric), unlike the SDK default of
 * `cross-platform`.
 */
export function createBrowserPasskeyProvider({
  appName,
  rpName,
  rpId,
  attachment = 'platform',
}: ProvisionPasskeyAliasParams): BrowserPasskeyProvider {
  assertBrowserPasskeyEnv()
  const options: BrowserPasswordProviderOptions = {
    rp: { name: rpName ?? appName, id: rpId ?? window.location.hostname },
    authenticatorSelection: { authenticatorAttachment: attachment },
  }
  return new BrowserPasskeyProvider(appName, options)
}

/**
 * Runs the passkey create ceremony and returns the credential's Sui address plus
 * the material needed to register and later reconstruct it. Only call this once
 * per origin per account — creating multiple passkeys for the same origin makes
 * later recovery ambiguous.
 */
export async function provisionPasskeyAlias(
  params: ProvisionPasskeyAliasParams,
): Promise<PasskeyProvisionedAlias> {
  const provider = createBrowserPasskeyProvider(params)
  const keypair = await PasskeyKeypair.getPasskeyInstance(provider)
  const publicKey = keypair.getPublicKey()
  const credentialId = keypair.getCredentialId()
  return {
    source: 'passkey',
    address: publicKey.toSuiAddress(),
    publicKey: publicKey.toBase64(),
    ...(credentialId ? { credentialId: toBase64(credentialId) } : {}),
    keypair,
  }
}

export interface RecoverPasskeyKeypairParams {
  /** The passkey provider bound to the same rpId used at creation. */
  provider: PasskeyProvider
  /**
   * The base64 public key captured at provisioning
   * ({@link PasskeyProvisionedAlias.publicKey}). When omitted, the public key is
   * recovered via two signing ceremonies.
   */
  publicKey?: string
}

/**
 * Rebuilds a `PasskeyKeypair` for a previously created passkey.
 *
 * When {@link RecoverPasskeyKeypairParams.publicKey} is provided the keypair is
 * constructed directly. Otherwise it is recovered by signing two messages and
 * cross-referencing the candidate public keys with `findCommonPublicKey` — this
 * prompts the authenticator twice.
 */
export async function recoverPasskeyKeypair({
  provider,
  publicKey,
}: RecoverPasskeyKeypairParams): Promise<PasskeyKeypair> {
  if (publicKey) {
    return new PasskeyKeypair(fromBase64(publicKey), provider)
  }
  const message1 = new TextEncoder().encode('wallet-core passkey recovery 1')
  const message2 = new TextEncoder().encode('wallet-core passkey recovery 2')
  const candidates1 = await PasskeyKeypair.signAndRecover(provider, message1)
  const candidates2 = await PasskeyKeypair.signAndRecover(provider, message2)
  const commonPk = findCommonPublicKey(candidates1, candidates2)
  return new PasskeyKeypair(commonPk.toRawBytes(), provider)
}
