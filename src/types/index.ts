import type { getZkLoginSignature } from '@mysten/sui/zklogin'

export type { RawSignParams } from '#src/crypto/sign-with-intent'

/**
 * A partial ZKLogin Signature.
 */
export type PartialZkLoginSignature = Omit<
  Parameters<typeof getZkLoginSignature>['0']['inputs'],
  'addressSeed'
>

export interface ZKProofData {
  maxEpoch: number
  partialZkLoginSignature?: PartialZkLoginSignature
  userSalt: string
  tokenClaimSub: string
  tokenClaimAud: string
}

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
