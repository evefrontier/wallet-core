import { isValidSuiAddress } from '@mysten/sui/utils'
import { excludeAddress, includesAddress } from './address'
import { type AddressAliasesInfo, MAX_ADDRESS_ALIASES } from './config'
import { hasEnforceableAlias } from './enforcement'

export type ValidateAddressAliasParams = {
  addressAlias: string
  existing: string[]
}

/**
 * Returns the first blocking error for a candidate address alias, or `null` when
 * it is safe to submit.
 */
export const validateNewAddressAlias = ({
  addressAlias,
  existing,
}: ValidateAddressAliasParams): string | null => {
  const trimmed = addressAlias.trim()

  if (!trimmed) {
    return 'Enter an address to add as an address alias'
  }
  if (!isValidSuiAddress(trimmed)) {
    return 'Not a valid Sui address'
  }
  if (includesAddress(existing, trimmed)) {
    return 'Address is already an address alias'
  }
  if (existing.length >= MAX_ADDRESS_ALIASES) {
    return `Maximum of ${MAX_ADDRESS_ALIASES} address aliases reached`
  }
  return null
}

/**
 * Returns an error when the address is not a current address alias, or `null`
 * when it is safe to remove.
 */
export const validateExistingAddressAlias = ({
  addressAlias,
  existing,
}: ValidateAddressAliasParams): string | null => {
  const trimmed = addressAlias.trim()

  if (!trimmed) {
    return 'Enter an address to remove'
  }
  if (!isValidSuiAddress(trimmed)) {
    return 'Not a valid Sui address'
  }
  if (!includesAddress(existing, trimmed)) {
    return 'Address is not an existing address alias'
  }
  return null
}

export type ValidateAddressAliasRemovalParams = {
  /** Address the caller wants to remove from their aliases. */
  addressAlias: string
  /** Owner of the `AddressAliases` object (the account being protected). */
  owner: string
  /** Current on-chain alias state, the authoritative source of truth. */
  info: AddressAliasesInfo
}

/**
 * Returns the first blocking error for removing an alias, or `null` when it is
 * safe to remove.
 *
 * Extends {@link validateExistingAddressAlias} with an enforceability guard:
 * after simulating the removal, the owner must still have at least one alias
 * that is not itself (see {@link hasEnforceableAlias}). This blocks stranding an
 * account by removing its last co-signing key, which would then fail alias
 * enforcement and lock the owner out of signing.
 *
 * This is the authoritative rule. Callers that gate the feature (rollout flags,
 * localnet exemptions) should apply that gating themselves and fall back to
 * {@link validateExistingAddressAlias} when enforcement is inactive.
 */
export const validateAddressAliasRemoval = ({
  addressAlias,
  owner,
  info,
}: ValidateAddressAliasRemovalParams): string | null => {
  const base = validateExistingAddressAlias({
    addressAlias,
    existing: info.addressAliases,
  })
  if (base) return base

  const remaining = excludeAddress(info.addressAliases, addressAlias.trim())
  const stillEnforceable = hasEnforceableAlias(
    { ...info, addressAliases: remaining },
    owner,
  )
  if (!stillEnforceable) {
    return 'You can’t remove your last recovery alias. Add another personal access key before removing this one.'
  }
  return null
}
