import type {
  SponsoredTransactionActions,
  SponsoredTransactionAssemblyType,
} from './assemblies'

export interface SponsoredTransactionMetadata {
  name?: string
  description?: string
  url?: string
}

export type SponsoredTransactionInput = {
  txAction: SponsoredTransactionActions
  assembly: string // uint64 decimal string, preserves ids > 2^53
  assemblyType: SponsoredTransactionAssemblyType
  metadata?: SponsoredTransactionMetadata
}

export type SponsoredTransactionOutput = {
  /** The transaction digest */
  digest: string
  /** On-chain execution status reported by the gateway (e.g. `success`). */
  executionStatus: string
  /** Error message when the on-chain execution failed; absent on success. */
  executionErrorMessage?: string
}

export type SponsoredTransactionMethod = (
  input: SponsoredTransactionInput,
) => Promise<SponsoredTransactionOutput>
