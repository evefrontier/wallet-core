import { decodeSuiPrivateKey } from '@mysten/sui/cryptography'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import type { ZKEd25519KeypairData, ZKProofData } from '#src/types'
import { withZKProofHandling } from './zk-common'

const ZKEd25519KeypairBase = withZKProofHandling(Ed25519Keypair)

/**
 * Drop-in replacement for Mysten Labs' `Ed25519Keypair` with zkLogin proof-aware signing support.
 *
 * This class keeps the same signing surface as `Ed25519Keypair` and adds proof-aware behavior
 * through `applyZKProof`. Once you call `applyZKProof` with your ZK Login proof data, subsequent
 * calls to `signWithIntent`, `signTransaction`, and `signPersonalMessage` will produce zkLogin signatures.
 * Without proof data applied, it behaves identically to the underlying Mysten Labs class.
 *
 * @example
 * ```ts
 * const keypair = ZKEd25519Keypair.generate()
 * const publicKey = keypair.getPublicKey()
 *
 * // Later, after obtaining ZK proof data:
 * keypair.applyZKProof({ maxEpoch, userSalt, keyClaimName: 'sub', keyClaimValue: sub, aud, partialZkLoginSignature })
 * const { signature } = await keypair.signTransaction(txBytes)
 * ```
 *
 * @category Primary API
 */
export class ZKEd25519Keypair extends ZKEd25519KeypairBase {
  /**
   * Generate a new random Ed25519 keypair
   */
  static generate(): ZKEd25519Keypair {
    const result = Ed25519Keypair.generate()
    const parsedKeyPair = decodeSuiPrivateKey(result.getSecretKey())
    const keypair = {
      publicKey: result.getPublicKey().toRawBytes(),
      secretKey: parsedKeyPair.secretKey,
    }
    return new ZKEd25519Keypair(keypair)
  }

  /**
  * Exports the current zkLogin data and ephemeral key
   * The intent is that this is used for testing the behaviour
  * of expired zkLogin sessions.
   */
  toZKEd25519KeypairData(): ZKEd25519KeypairData {
    return {
      secretKey: this.getSecretKey(),
      zkProofData: this.getProofData() as ZKProofData,
    }
  }

  /**
   * Creates a ZKEd25519Keypair from the supplied data.
   *
   * The optional `skipValidation` value is passed to both the underlying
   * secret-key restoration and `applyZKProof`.
   */
  static fromZKEd25519KeypairData(
    keypairData: ZKEd25519KeypairData,
    options?: { skipValidation?: boolean },
  ): ZKEd25519Keypair {
    const keyPair = ZKEd25519Keypair.fromSecretKey(
      keypairData.secretKey,
      options,
    )
    keyPair.applyZKProof(keypairData.zkProofData, options)
    return keyPair
  }

  /**
   * Create a Ed25519 keypair from a raw secret key byte array, also known as seed.
   * This is NOT the private scalar which is result of hashing and bit clamping of
   * the raw secret key.
   *
   * @throws error if the provided secret key is invalid and validation is not skipped.
   *
   * @param secretKey secret key as a byte array or Bech32 secret key string
   * @param options skip secret key validation
   */
  static fromSecretKey(
    secretKey: Uint8Array | string,
    options?: { skipValidation?: boolean },
  ): ZKEd25519Keypair {
    const result = Ed25519Keypair.fromSecretKey(secretKey, options)
    const parsedKeyPair = decodeSuiPrivateKey(result.getSecretKey())
    const keypair = {
      publicKey: result.getPublicKey().toRawBytes(),
      secretKey: parsedKeyPair.secretKey,
    }
    return new ZKEd25519Keypair(keypair)
  }

  /**
   * Derive Ed25519 keypair from mnemonics and path. The mnemonics must be normalized
   * and validated against the english wordlist.
   *
   * If path is none, it will default to m/44'/784'/0'/0'/0', otherwise the path must
   * be compliant to SLIP-0010 in form m/44'/784'/{account_index}'/{change_index}'/{address_index}'.
   */
  static deriveKeypair(mnemonics: string, path?: string): ZKEd25519Keypair {
    const result = Ed25519Keypair.deriveKeypair(mnemonics, path)
    const parsedKeyPair = decodeSuiPrivateKey(result.getSecretKey())
    const keypair = {
      publicKey: result.getPublicKey().toRawBytes(),
      secretKey: parsedKeyPair.secretKey,
    }
    return new ZKEd25519Keypair(keypair)
  }

  /**
   * Derive Ed25519 keypair from mnemonicSeed and path.
   *
   * If path is none, it will default to m/44'/784'/0'/0'/0', otherwise the path must
   * be compliant to SLIP-0010 in form m/44'/784'/{account_index}'/{change_index}'/{address_index}'.
   *
   * @param seed - The seed as a hex string or Uint8Array.
   */
  static deriveKeypairFromSeed(
    seed: string | Uint8Array,
    path?: string,
  ): ZKEd25519Keypair {
    const result = Ed25519Keypair.deriveKeypairFromSeed(seed, path)
    const parsedKeyPair = decodeSuiPrivateKey(result.getSecretKey())
    const keypair = {
      publicKey: result.getPublicKey().toRawBytes(),
      secretKey: parsedKeyPair.secretKey,
    }
    return new ZKEd25519Keypair(keypair)
  }
}
