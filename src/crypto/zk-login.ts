import type { getZkLoginSignature } from '@mysten/sui/zklogin'

/**
 * zkLogin signature inputs returned by a proving service before wallet-core
 * adds the signer-computed `addressSeed`.
 */
export type PartialZkLoginSignature = Omit<
  Parameters<typeof getZkLoginSignature>['0']['inputs'],
  'addressSeed'
>

/**
 * JSON/session-safe proof data used by wallet-core to produce zkLogin
 * signatures.
 *
 * wallet-core stores `userSalt` as a decimal integer string so the object can be
 * serialized through JSON. During validation, the salt must be in the Sui
 * zkLogin documented range from 0 to 2^128 - 1.
 */
export interface ZKProofData {
  /**
   * Maximum Sui epoch for which the zkLogin proof may be used.
   */
  maxEpoch: number
  /**
   * Proving-service signature inputs. `addressSeed` is intentionally excluded
   * because wallet-core computes it from the salt and JWT claims.
   */
  partialZkLoginSignature?: PartialZkLoginSignature
  /**
   * User salt encoded as a base-10 integer string for JSON persistence.
   */
  userSalt: string
  /**
   * JWT key claim name used when deriving the address seed. Most Enoki-backed
   * flows use `sub`; callers using a different stable JWT claim should pass
   * that claim name.
   */
  keyClaimName: string
  /**
   * JWT key claim value used when deriving the address seed.
   */
  keyClaimValue: string
  /**
   * JWT audience claim used when deriving the address seed.
   */
  aud: string
}
