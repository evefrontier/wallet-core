import {
  decodeSuiPrivateKey,
  type IntentScope,
  type SignatureWithBytes,
} from '@mysten/sui/cryptography'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { type ZKProofData, ZKProofHandler } from '#src/crypto'

export interface ZKEd25519KeypairData {
  secretKey: Uint8Array | string
  zkProofData: ZKProofData
}

/**
 * Keypair / Signer that can do ZKLogin base signing
 */
export class ZKEd25519Keypair extends Ed25519Keypair {
  protected zkProofHandler: ZKProofHandler = new ZKProofHandler()

  /**
   * Applies the neccessary data to make this instance capable of performing ZKLogin signing.
   * @param zkpd {ZKProofData}
   * @param options optional object that can have `skipValidation` set in order to skip validation.
   */
  applyZKProof(
    zkpd: ZKProofData,
    options?: { skipValidation?: boolean },
  ): ZKProofData {
    return this.zkProofHandler.applyZKProof(zkpd, options)
  }

  /**
   * Returns the zk proof data currently in use
   * @returns {ZKProofData} the proof data in use
   */
  getProofData(): ZKProofData {
    return this.zkProofHandler.getProofData()
  }

  /**
   * Returns the current address seed that is generated when the proof data is applied.
   * @returns {string} the current address seed
   */
  getAddressSeed(): string {
    return this.zkProofHandler.getAddressSeed()
  }

  /**
   * Generate a new random Ed25519 keypair
   */
  static override generate(): ZKEd25519Keypair {
    const result = Ed25519Keypair.generate()
    const parsedKeyPair = decodeSuiPrivateKey(result.getSecretKey())
    const keypair = {
      publicKey: result.getPublicKey().toRawBytes(),
      secretKey: parsedKeyPair.secretKey,
    }
    return new ZKEd25519Keypair(keypair)
  }

  /**
   * Exports the current ZK Login data and ephemeral key
   * The intent is that this is used for testing the behaviour
   * of expired ZK Login sessions.
   */
  toZKEd25519KeypairData(): ZKEd25519KeypairData {
    return {
      secretKey: this.getSecretKey(),
      zkProofData: this.getProofData() as ZKProofData,
    }
  }

  /**
   * Creates a ZKEd25519Keypair from the supplied data.
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
   * @param options: skip secret key validation
   */
  static override fromSecretKey(
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
   * Sign messages with a specific intent. By combining the message bytes with the intent before hashing and signing,
   * it ensures that a signed message is tied to a specific purpose and domain separator is provided
   */
  async signWithIntent(
    bytes: Uint8Array,
    intent: IntentScope,
  ): Promise<SignatureWithBytes> {
    const signatureWithBytes = await super.signWithIntent(bytes, intent)
    return this.zkProofHandler.processSignature(signatureWithBytes)
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
