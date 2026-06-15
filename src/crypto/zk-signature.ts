import { isNonEmptyString, isPositiveSafeInteger } from '#src/utils/validation'
import { isPartialZKLoginSignature, ZKProofHandler } from './zk-common'
import type { CreateZkLoginSignatureParams } from './zk-types'

/**
 * Builds the final zkLogin signature by applying a partial ZK proof to an
 * existing ephemeral user signature.
 *
 * @deprecated Prefer calling `applyZKProof` directly on `ZKEd25519Keypair`,
 * `ZKSecp256r1Keypair`, or `ZKWebCryptoSigner`. This function remains
 * available for cases where a keypair instance is required but the class-based
 * API is not yet accessible.
 * @category Supporting Types and Utilities
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
    keyClaimName: requireZkLoginClaim(claims.keyClaimName, 'keyClaimName'),
    keyClaimValue: requireZkLoginClaim(claims.keyClaimValue, 'keyClaimValue'),
    aud: requireZkLoginClaim(claims.aud, 'aud'),
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
