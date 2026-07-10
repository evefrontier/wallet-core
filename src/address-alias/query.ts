import type { ClientWithCoreApi } from '@mysten/sui/client'
import { ADDRESS_ALIASES_TYPE, type AddressAliasesInfo } from './config'

const EMPTY: AddressAliasesInfo = { enabled: false, addressAliases: [] }

/**
 * Reads the caller's `AddressAliases` owned object. Its id isn't known ahead of
 * time (it's minted by `enable`), so we list owned objects filtered by type.
 * Returns `enabled: false` when absent.
 */
export async function getAddressAliases(
  client: ClientWithCoreApi,
  owner: string,
): Promise<AddressAliasesInfo> {
  const result = await client.core.listOwnedObjects({
    owner,
    type: ADDRESS_ALIASES_TYPE,
    include: { json: true },
  })

  const object = result.objects[0]
  if (!object) {
    return EMPTY
  }

  return {
    enabled: true,
    objectId: object.objectId,
    addressAliases: parseAddressAliases(object.json),
  }
}

/**
 * Defensive parse of the address aliases list out of the object's JSON view.
 */
export function parseAddressAliases(json: unknown): string[] {
  const aliases = (json as { aliases?: { contents?: unknown } } | null)?.aliases
    ?.contents
  if (!Array.isArray(aliases)) {
    return []
  }
  return aliases.filter((alias): alias is string => typeof alias === 'string')
}
