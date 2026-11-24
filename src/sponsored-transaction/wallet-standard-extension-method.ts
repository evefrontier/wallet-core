import type { SponsoredTransactionActions } from './actions'

/** Display fields for an entity. An edit replaces all three; send `''` to clear one. */
export interface SponsoredTransactionMetadata {
  name: string
  description: string
  url: string
}

interface SponsoredTransactionBase {
  /** In-game entity id (`EntityKey.id`), uint64 decimal string; the tenant comes from the token. */
  entityId: string
}

export interface UpdateMetadataInput extends SponsoredTransactionBase {
  txAction: SponsoredTransactionActions.UPDATE_METADATA
  metadata: SponsoredTransactionMetadata
}

export interface SetPowerGridInput extends SponsoredTransactionBase {
  txAction: SponsoredTransactionActions.SET_POWER_GRID
  /** Switch the entity's power grid on (`true`) or off (`false`). */
  on: boolean
}

export type SponsoredTransactionInput = UpdateMetadataInput | SetPowerGridInput

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
