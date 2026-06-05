import type { PartialZkLoginSignature } from '#src/types'
import { isPartialZKLoginSignature } from './zk-common'
import type { ZkProofResponseLike } from './zk-types'

/**
 * Validates and returns the partial ZK proof payload from a proving-service
 * response. This handles both explicit error payloads and malformed data.
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

export async function loadZkProof(
  getZkProof: () => Promise<ZkProofResponseLike | null | undefined>,
): Promise<PartialZkLoginSignature> {
  return parseZkProofResponse(await getZkProof())
}

export function getZkProofResponseErrorMessage(
  zkProof: ZkProofResponseLike | null | undefined,
): string | null {
  if (!zkProof) {
    return 'Failed to get ZK proof'
  }
  if (!zkProof.error) {
    return null
  }
  return typeof zkProof.error === 'string'
    ? zkProof.error
    : (zkProof.error.message ?? 'Failed to get ZK proof')
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}
