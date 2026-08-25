/**
 * Address-alias enforcement policy (`0x2::address_alias`).
 *
 * @experimental This module's API has not been architecturally agreed on and
 * may change or be removed without a major version bump.
 *
 * The policy is intentionally pure and stateless: it reads the on-chain
 * `AddressAliases` object (the authoritative source of truth) and decides
 * whether an owner has at least one usable alias — an address other than the
 * owner itself. Wallets use this to block signing until the account has a
 * co-signing alias registered.
 */

import type { ClientWithCoreApi } from '@mysten/sui/client'
import { normalizeSuiAddress } from '@mysten/sui/utils'
import type { AddressAliasesInfo } from './config'
import { getAddressAliases } from './query'

/**
 * Reason an owner fails the alias-enforcement policy.
 *
 * - `no-aliases-object` — the owner has not enabled address aliases yet
 *   (no `AddressAliases` object minted).
 * - `no-aliases` — the object exists but registers no aliases.
 * - `only-self-alias` — the only registered alias is the owner's own address,
 *   which provides no key continuity.
 */
export type AliasEnforcementReason =
  | 'no-aliases-object'
  | 'no-aliases'
  | 'only-self-alias'

/** Result of evaluating the alias-enforcement policy for an owner. */
export type AliasEnforcementStatus =
  | { satisfied: true }
  | { satisfied: false; reason: AliasEnforcementReason }

/**
 * Evaluates the alias-enforcement policy against an already-read
 * `AddressAliasesInfo`. Pure and synchronous.
 *
 * The policy is satisfied when at least one registered alias is an address
 * other than `owner`. Addresses are compared after normalization so short-form
 * and mixed-case inputs match their canonical on-chain form.
 */
export function evaluateAliasEnforcement(
  info: AddressAliasesInfo,
  owner: string,
): AliasEnforcementStatus {
  if (!info.enabled) {
    return { satisfied: false, reason: 'no-aliases-object' }
  }
  if (info.addressAliases.length === 0) {
    return { satisfied: false, reason: 'no-aliases' }
  }

  const normalizedOwner = normalizeSuiAddress(owner)
  const hasOther = info.addressAliases.some(
    (alias) => normalizeSuiAddress(alias) !== normalizedOwner,
  )

  return hasOther
    ? { satisfied: true }
    : { satisfied: false, reason: 'only-self-alias' }
}

/**
 * Convenience predicate over {@link evaluateAliasEnforcement}: true when
 * `owner` has at least one alias that is not itself.
 */
export function hasEnforceableAlias(
  info: AddressAliasesInfo,
  owner: string,
): boolean {
  return evaluateAliasEnforcement(info, owner).satisfied
}

/**
 * Reads the owner's on-chain aliases and evaluates the enforcement policy.
 * The client is the authoritative source of truth; callers that sign
 * frequently should cache the result and refresh it after registering an
 * alias (see `createOnChainStatusResolver` in `./guarded-signer`).
 */
export async function checkAliasEnforcement(
  client: ClientWithCoreApi,
  owner: string,
): Promise<AliasEnforcementStatus> {
  const info = await getAddressAliases(client, owner)
  return evaluateAliasEnforcement(info, owner)
}

/**
 * Thrown when a guarded signer refuses to sign because the owner has no
 * enforceable alias. Carries the owner and the failing status so consumers can
 * route the user into alias setup and map it to their own error surface.
 */
export class AliasEnforcementError extends Error {
  readonly code = 'alias_enforcement_required'
  readonly owner: string
  readonly status: Extract<AliasEnforcementStatus, { satisfied: false }>

  constructor(
    owner: string,
    status: Extract<AliasEnforcementStatus, { satisfied: false }>,
  ) {
    super(
      `Signing is blocked: address ${owner} has no address alias (${status.reason}). Register an alias before signing.`,
    )
    this.name = 'AliasEnforcementError'
    this.owner = owner
    this.status = status
  }
}
