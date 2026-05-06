import { WebCryptoSigner } from '@mysten/signers/webcrypto'
import { withZKProofHandling } from './zk-common'

const ZKWebCryptoSignerBase = withZKProofHandling(WebCryptoSigner)

export class ZKWebCryptoSigner extends ZKWebCryptoSignerBase {
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
}
