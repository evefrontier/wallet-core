export interface SponsoredTransactionMetadata {
  name?: string
  description?: string
  url?: string
}

export type SponsoredTransactionInput = {
  txAction: string
  assembly: number
  assemblyType: string
  metadata?: SponsoredTransactionMetadata
}

export type SponsoredTransactionOutput = {
  /** The transaction digest */
  digest: string
  /** The transaction effects (BCS encoded) */
  effects: string
  /** Raw effects bytes (if available) */
  rawEffects?: number[]
}

export type SponsoredTransactionMethod = (
  input: SponsoredTransactionInput,
) => Promise<SponsoredTransactionOutput>
