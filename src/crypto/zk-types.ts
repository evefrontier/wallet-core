export type ZkLoginClaims = {
  salt: string
  sub: string
  aud: string
}

export type CreateZkLoginSignatureParams = {
  maxEpoch: number | string
  partialZkLoginSignature: unknown
  claims: ZkLoginClaims
  userSignature: string
  bytes: string
}

export type ZkProofResponseLike = {
  data?: unknown
  error?: string | { message?: string | null } | null
}
