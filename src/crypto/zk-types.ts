/**
 * Claims required for creating a zkLogin signature.
 * @category Supporting Types and Utilities
 */
export type ZkLoginClaims = {
  salt: string
  keyClaimName: string
  keyClaimValue: string
  aud: string
}

/**
 * Input payload for `createZkLoginSignature`.
 * @category Supporting Types and Utilities
 */
export type CreateZkLoginSignatureParams = {
  maxEpoch: number | string
  partialZkLoginSignature: unknown
  claims: ZkLoginClaims
  userSignature: string
  bytes: string
}

/**
 * Supported proving-service response shape.
 * @category Supporting Types and Utilities
 */
export type ZkProofResponseLike = {
  data?: unknown
  error?: string | { message?: string | null } | null
}
