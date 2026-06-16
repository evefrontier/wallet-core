import { isObjectRecord } from '#src/utils/validation'
import { isPartialZKLoginSignature } from './zk-common'
import type { PartialZkLoginSignature } from './zk-login'
import type { ZkProofResponseLike } from './zk-types'

/**
 * Validates and returns the partial ZK proof payload from a proving-service
 * response. This handles both explicit error payloads and malformed data.
 * @category Supporting Types and Utilities
 */
export function parseZkProofResponse(
  zkProof: ZkProofResponseLike | null | undefined,
): PartialZkLoginSignature {
  const error = getZkProofResponseErrorMessage(zkProof)
  if (error) {
    throw new Error(error)
  }

  if (!isObjectRecord(zkProof) || !isPartialZKLoginSignature(zkProof.data)) {
    throw new Error('ZK proof data not found or invalid')
  }

  return zkProof.data
}

/**
 * Loads a proving-service response and returns its validated partial ZK proof payload.
 * @category Supporting Types and Utilities
 */
export async function loadZkProof(
  getZkProof: () => Promise<ZkProofResponseLike | null | undefined>,
): Promise<PartialZkLoginSignature> {
  return parseZkProofResponse(await getZkProof())
}

/**
 * Returns an error string from a proving-service response, if one is available.
 * @category Supporting Types and Utilities
 */
export function getZkProofResponseErrorMessage(
  zkProof: ZkProofResponseLike | null | undefined,
): string | null {
  if (!zkProof) {
    return 'Failed to get ZK proof'
  }
  if (zkProof.error == null) {
    return null
  }
  const message =
    typeof zkProof.error === 'string' ? zkProof.error : zkProof.error.message
  return message || 'Failed to get ZK proof'
}
