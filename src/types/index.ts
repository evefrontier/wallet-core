import type { getZkLoginSignature } from '@mysten/sui/zklogin'

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

/** Tenant IDs.
 *  @category Constants
 */
export declare enum TenantId {
  STILLNESS = 'stillness',
  UTOPIA = 'utopia',
  TAUCETI = 'tauceti',
  TIAKI = 'tiaki',
  TETRA = 'tetra',
  TESSERACT = 'tesseract',
}
/** Tenant when not provided via URL ?tenant= (e.g. dev/default chain).
 *  @category Constants
 */
export declare const DEFAULT_TENANT = TenantId.STILLNESS
