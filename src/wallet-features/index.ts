import type { SuiWalletFeatures } from '@mysten/wallet-standard'
import type { SponsoredTransactionMethod } from '#src/sponsored-transaction'

export const EVEFRONTIER_SPONSORED_TRANSACTION =
  'evefrontier:sponsoredTransaction' as const

export type EveVaultWalletFeatures = SuiWalletFeatures & {
  [EVEFRONTIER_SPONSORED_TRANSACTION]: {
    version: '1.0.1'
    signSponsoredTransaction: SponsoredTransactionMethod
  }
}
