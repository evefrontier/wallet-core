import { normalizeSuiAddress } from '@mysten/sui/utils'
import { ADDRESS_ALIAS_MODULE } from './config'

const [ADDRESS_ALIAS_PACKAGE, ADDRESS_ALIAS_MODULE_NAME] =
  ADDRESS_ALIAS_MODULE.split('::')
const NORMALIZED_ADDRESS_ALIAS_PACKAGE = normalizeSuiAddress(
  ADDRESS_ALIAS_PACKAGE as string,
)

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

/**
 * True when a decoded transaction command is a MoveCall into the
 * address-alias module. These calls add/remove aliases, which can hand full
 * control of the account to another address, so wallet approval flows should
 * surface them as danger-class.
 *
 * Accepts the loosely-typed command objects produced by transaction decoding
 * (`MoveCall`/`moveCall` keyed variants) and returns `false` for anything it
 * cannot recognize.
 */
export function isAddressAliasCall(command: unknown): boolean {
  if (!isRecord(command)) return false

  const moveCall = command.MoveCall ?? command.moveCall
  if (!isRecord(moveCall)) return false

  const pkg = moveCall.package
  const module = moveCall.module
  if (typeof pkg !== 'string' || typeof module !== 'string') return false

  return (
    normalizeSuiAddress(pkg) === NORMALIZED_ADDRESS_ALIAS_PACKAGE &&
    module === ADDRESS_ALIAS_MODULE_NAME
  )
}
