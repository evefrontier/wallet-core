import { decodeSuiPrivateKey } from '@mysten/sui/cryptography'
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1'
import { withZKProofHandling } from './zk-common'

const ZKSecp256r1KeypairBase = withZKProofHandling(Secp256r1Keypair)

/**
 * Drop-in replacement for Mysten Labs' `Secp256r1Keypair` with zkLogin proof-aware signing support.
 *
 * This class keeps the same signing surface as `Secp256r1Keypair` and adds proof-aware behavior
 * through `applyZKProof`. Once you call `applyZKProof` with your ZK Login proof data, subsequent
 * calls to `signWithIntent`, `signTransaction`, and `signPersonalMessage` will produce zkLogin signatures.
 * Without proof data applied, it behaves identically to the underlying Mysten Labs class.
 *
 * @example
 * ```ts
 * const keypair = ZKSecp256r1Keypair.fromSeed(seedBytes)
 * const publicKey = keypair.getPublicKey()
 *
 * // Later, after obtaining ZK proof data:
 * keypair.applyZKProof({ maxEpoch, userSalt, keyClaimName: 'sub', keyClaimValue: sub, aud, partialZkLoginSignature })
 * const { signature } = await keypair.signTransaction(txBytes)
 * ```
 *
 * @category Primary API
 */
export class ZKSecp256r1Keypair extends ZKSecp256r1KeypairBase {
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
}
