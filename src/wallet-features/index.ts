/**
 * @packageDocumentation
 *
 * Eve Frontier wallet feature identifiers and feature typings.
 *
 * This entrypoint is intended primarily for wallet implementors, and for
 * adapter layers such as dapp kits that need to model Eve Frontier-specific
 * wallet capabilities. Typical dapp code will usually consume these features
 * indirectly through a wallet integration layer rather than importing this
 * module directly.
 */
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
