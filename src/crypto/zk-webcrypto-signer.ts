import { WebCryptoSigner } from '@mysten/signers/webcrypto'
import type { IntentScope, SignatureWithBytes } from '@mysten/sui/cryptography'
import { ZKProofHandler, type ZKProofData } from './zk-common.js'

export class ZKWebCryptoSigner extends WebCryptoSigner {
  protected zkProofHandler: ZKProofHandler = new ZKProofHandler()

  static async generate({
    extractable = false,
  }: { extractable?: boolean } = {}) {
    const signer = await super.generate({ extractable })
    return new ZKWebCryptoSigner(
      signer.privateKey,
      signer.getPublicKey().toRawBytes()
    )
  }

  constructor(privateKey: CryptoKey, publicKey: Uint8Array) {
    super(privateKey, publicKey)
  }

  /**
   * Applies the neccessary data to make this instance capable of performing ZKLogin signing.
   * @param zkpd {ZKProofData}
   * @param options optional object that can have `skipValidation` set in order to skip validation.
   */
  applyZKProof(
    zkpd: ZKProofData,
    options?: { skipValidation?: boolean }
  ): void {
    this.zkProofHandler.applyZKProof(zkpd, options)
  }

  /**
   * Sign messages with a specific intent. By combining the message bytes with the intent before hashing and signing,
   * it ensures that a signed message is tied to a specific purpose and domain separator is provided
   */
  async signWithIntent(
    bytes: Uint8Array,
    intent: IntentScope
  ): Promise<SignatureWithBytes> {
    const signatureWithBytes = await super.signWithIntent(bytes, intent)
    return this.zkProofHandler.processSignature(signatureWithBytes)
  }
}
