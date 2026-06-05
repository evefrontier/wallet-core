import { isNonEmptyString, isPositiveSafeInteger } from '#src/utils/validation'
import { isPartialZKLoginSignature, ZKProofHandler } from './zk-common'
import type { CreateZkLoginSignatureParams } from './zk-types'

/**
 * Builds the final zkLogin signature by applying a partial ZK proof to an
 * existing ephemeral user signature.
 */
export function createZkLoginSignature({
  maxEpoch,
  partialZkLoginSignature,
  claims,
  userSignature,
  bytes,
}: CreateZkLoginSignatureParams): string {
  if (!isPartialZKLoginSignature(partialZkLoginSignature)) {
    throw new Error('ZK proof data not found or invalid')
  }

  const zkProofHandler = new ZKProofHandler()
  zkProofHandler.applyZKProof({
    maxEpoch: parseMaxEpoch(maxEpoch),
    partialZkLoginSignature,
    userSalt: requireZkLoginClaim(claims.salt, 'salt'),
    tokenClaimSub: requireZkLoginClaim(claims.sub, 'sub'),
    tokenClaimAud: requireZkLoginClaim(claims.aud, 'aud'),
  })

  return zkProofHandler.processSignature({ signature: userSignature, bytes })
    .signature
}

function parseMaxEpoch(maxEpoch: number | string): number {
  const numericMaxEpoch =
    typeof maxEpoch === 'number' ? maxEpoch : Number(maxEpoch)

  if (!isPositiveSafeInteger(numericMaxEpoch)) {
    throw new Error('Max epoch is not set')
  }

  return numericMaxEpoch
}

function requireZkLoginClaim(value: unknown, field: string): string {
  if (!isNonEmptyString(value)) {
    throw new Error(`Missing required zkLogin profile field: ${field}`)
  }
  return value
}
