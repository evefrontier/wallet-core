import { WebCryptoSigner } from '@mysten/webcrypto-signer'
import { withZKProofHandling } from './zk-common'

const ZKWebCryptoSignerBase = withZKProofHandling(WebCryptoSigner)

/**
 * Drop-in replacement for Mysten Labs' `WebCryptoSigner` with zkLogin proof-aware signing support.
 *
 * This class keeps the same signing surface as `WebCryptoSigner` and adds proof-aware behavior
 * through `applyZKProof`. Once you call `applyZKProof` with your ZK Login proof data, subsequent
 * calls to `signWithIntent`, `signTransaction`, and `signPersonalMessage` will produce zkLogin signatures.
 * Without proof data applied, it behaves identically to the underlying Mysten Labs class.
 *
 * @example
 * ```ts
 * const signer = await ZKWebCryptoSigner.generate()
 * const publicKey = signer.getPublicKey()
 *
 * // Later, after obtaining ZK proof data:
 * signer.applyZKProof({ maxEpoch, userSalt, keyClaimName: 'sub', keyClaimValue: sub, aud, partialZkLoginSignature })
 * const { signature } = await signer.signTransaction(txBytes)
 * ```
 *
 * @category Primary API
 */
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
