import { decodeSuiPrivateKey } from '@mysten/sui/cryptography'
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1'
import { withZKProofHandling } from './zk-common'

const ZKSecp256r1KeypairBase = withZKProofHandling(Secp256r1Keypair)

/**
 * A wrapper around Secp256r1Keypair that can hold ZKLogin proof data and apply it to the signing process.
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
