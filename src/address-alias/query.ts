import { bcs } from '@mysten/sui/bcs'
import type { ClientWithCoreApi } from '@mysten/sui/client'
import { deriveObjectID, normalizeStructTag } from '@mysten/sui/utils'
import {
  ADDRESS_ALIAS_KEY_TYPE,
  ADDRESS_ALIAS_STATE,
  ADDRESS_ALIASES_TYPE,
  type AddressAliasesInfo,
} from './config'

const EMPTY: AddressAliasesInfo = { enabled: false, addressAliases: [] }

const NORMALIZED_ADDRESS_ALIASES_TYPE = normalizeStructTag(ADDRESS_ALIASES_TYPE)

/**
 * Object id of the owner's `AddressAliases` object. It is a derived object of
 * the shared `AddressAliasState`, keyed by the owner address, so the id is
 * known without any lookup. Equivalent spellings of an address (short, padded,
 * mixed case) resolve to the same id; an invalid address throws.
 * https://github.com/MystenLabs/sui/blob/26eec5440adb2069baddde29ceac61a18c5e8bed/crates/sui-types/src/address_alias.rs#L38-L52
 */
export function addressAliasesObjectId(owner: string): string {
  return deriveObjectID(
    ADDRESS_ALIAS_STATE,
    ADDRESS_ALIAS_KEY_TYPE,
    // `AliasKey(address)` is a single-field struct, so its BCS is the 32-byte address.
    bcs.Address.serialize(owner).toBytes(),
  )
}

/**
 * Reads the caller's `AddressAliases` object by its derived id, so the read is
 * a point lookup that works over any core client (gRPC or GraphQL) and does not
 * depend on an owned-objects index. Returns `enabled: false` when the object
 * does not exist; any other failure (transport, timeout) is thrown rather than
 * reported as "not enabled".
 */
export async function getAddressAliases(
  client: ClientWithCoreApi,
  owner: string,
): Promise<AddressAliasesInfo> {
  const objectId = addressAliasesObjectId(owner)

  let object: Awaited<ReturnType<typeof readObject>>
  try {
    object = await readObject(client, objectId)
  } catch (error) {
    if (isObjectNotFound(error)) {
      return EMPTY
    }
    throw error
  }

  if (normalizeStructTag(object.type) !== NORMALIZED_ADDRESS_ALIASES_TYPE) {
    throw new Error(
      `Object ${objectId} has type ${object.type}, expected ${ADDRESS_ALIASES_TYPE}`,
    )
  }

  return {
    enabled: true,
    objectId: object.objectId,
    addressAliases: parseAddressAliases(object.json),
  }
}

/**
 * True for the core client's "object does not exist" error. It is matched on its
 * transport-neutral `reason` rather than `instanceof ObjectError`, because the
 * client that threw it may come from a different copy of `@mysten/sui` than the
 * one this module resolves, and a failed `instanceof` would turn "not enabled"
 * into a thrown error.
 */
function isObjectNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    (error as { reason?: unknown }).reason === 'notFound'
  )
}

async function readObject(client: ClientWithCoreApi, objectId: string) {
  const { object } = await client.core.getObject({
    objectId,
    include: { json: true },
  })
  return object
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
