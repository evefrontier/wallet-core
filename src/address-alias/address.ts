/**
 * Normalized Sui address comparison helpers (`0x2::address_alias`).
 *
 * @experimental This module's API has not been architecturally agreed on and
 * may change or be removed without a major version bump.
 *
 * On-chain addresses can appear in short-form and mixed-case variants that all
 * denote the same account. These helpers normalize both sides before comparing
 * so callers never have to remember to do it themselves. They assume valid
 * addresses; validate first where that matters.
 */

import { normalizeSuiAddress } from '@mysten/sui/utils'

/** True when two addresses denote the same account after normalization. */
export const addressesEqual = (a: string, b: string): boolean =>
  normalizeSuiAddress(a) === normalizeSuiAddress(b)

/** True when `candidate` appears in `addresses` (normalized comparison). */
export const includesAddress = (
  addresses: string[],
  candidate: string,
): boolean => addresses.some((address) => addressesEqual(address, candidate))

/** Returns `addresses` without any entry equal to `exclude` (normalized). */
export const excludeAddress = (
  addresses: string[],
  exclude: string,
): string[] => addresses.filter((address) => !addressesEqual(address, exclude))
