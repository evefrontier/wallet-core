/**
 * Address alias configuration (`sui::address_alias`).
 *
 * @experimental This module's API has not been architecturally agreed on and
 * may change or be removed without a major version bump.
 *
 * Docs: https://docs.sui.io/develop/transactions/transaction-auth/address-aliases
 */

/** Shared AddressAliasState singleton. */
export const ADDRESS_ALIAS_STATE = '0xa'

/** `sui` framework module. */
export const ADDRESS_ALIAS_MODULE = '0x2::address_alias'

/** Fully-qualified type of the per-address `AddressAliases` owned object. */
export const ADDRESS_ALIASES_TYPE = '0x2::address_alias::AddressAliases'

/** Maximum number of address aliases a single address may register. */
export const MAX_ADDRESS_ALIASES = 8

/**
 * Default gas budget for address alias transactions. Each transaction builder
 * accepts an optional `gasBudget` parameter to override it.
 */
export const DEFAULT_ADDRESS_ALIAS_GAS_BUDGET = 50_000_000

/** Result of reading the caller's `AddressAliases` owned object. */
export interface AddressAliasesInfo {
  /** True once the caller has minted their `AddressAliases` object. */
  enabled: boolean
  /** Object id of the `AddressAliases` object, when it exists. */
  objectId?: string
  /** Addresses currently registered as address aliases. */
  addressAliases: string[]
}
