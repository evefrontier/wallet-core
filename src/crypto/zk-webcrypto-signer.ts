import { WebCryptoSigner } from '@mysten/signers/webcrypto'
import type { IntentScope, SignatureWithBytes } from '@mysten/sui/cryptography'
import { type ZKProofData, ZKProofHandler } from '#src/crypto'

export class ZKWebCryptoSigner extends WebCryptoSigner {
  protected zkProofHandler: ZKProofHandler = new ZKProofHandler()

  static async generate({
    extractable = false,
  }: {
    extractable?: boolean
  } = {}) {
    const signer = await WebCryptoSigner.generate({ extractable })
    return new ZKWebCryptoSigner(
      signer.privateKey,
      signer.getPublicKey().toRawBytes(),
    )
  }

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
