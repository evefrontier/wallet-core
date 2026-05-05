import {
  decodeSuiPrivateKey,
  type IntentScope,
  type SignatureWithBytes,
} from '@mysten/sui/cryptography'
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1'
import { ZKProofHandler } from '#src/crypto'
import type { ZKProofData } from '#src/types'

/**
 * A wrapper around Secp256r1Keypair that can hold ZKLogin proof data and apply it to the signing process.
 */
export class ZKSecp256r1Keypair extends Secp256r1Keypair {
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
   * Generate a keypair from a 32 byte seed.
   *
   * @param seed seed byte array
   */
  static fromSeed(seed: Uint8Array): ZKSecp256r1Keypair {
    const secpKP = Secp256r1Keypair.fromSeed(seed)
    return new ZKSecp256r1Keypair({
      publicKey: secpKP.getPublicKey().toRawBytes(),
      secretKey: decodeSuiPrivateKey(secpKP.getSecretKey()).secretKey,
    })
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
}
