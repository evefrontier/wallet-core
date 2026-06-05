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
   * JWT subject claim used when deriving the address seed.
   */
  tokenClaimSub: string
  /**
   * JWT audience claim used when deriving the address seed.
   */
  tokenClaimAud: string
}

/**
 * Serialized Ed25519 zkLogin keypair data.
 */
export interface ZKEd25519KeypairData {
  secretKey: Uint8Array | string
  zkProofData: ZKProofData
}

/** Per-tenant config: EVE token package ID (Sui) and Datahub API host. v0.0.18
 * @category Constants
 */
export interface TenantConfig {
  packageId: string
  evePackageId: string
  datahubHost: string
}
