import type { SuiWalletFeatures } from '@mysten/wallet-standard'
/* EveFrontierSponsoredTransactions custom types */

export const EVEFRONTIER_SPONSORED_TRANSACTION =
  'evefrontier:sponsoredTransaction' as const

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

export type EveVaultWalletFeatures = SuiWalletFeatures & {
  [EVEFRONTIER_SPONSORED_TRANSACTION]: {
    version: '1.0.1'
    signSponsoredTransaction: SponsoredTransactionMethod
  }
}
