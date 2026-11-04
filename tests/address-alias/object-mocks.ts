import { ObjectError } from '@mysten/sui/client'
import { ADDRESS_ALIASES_TYPE } from '#src/address-alias'

/** What a core client rejects with when the derived object does not exist. */
export function notFoundError(): ObjectError {
  return new ObjectError('notFound', 'Object not found', {
    reason: 'notFound',
  })
}

/** What `core.getObject` resolves with for an existing `AddressAliases` object. */
export function aliasesObject(objectId: string, aliases: string[]) {
  return {
    object: {
      objectId,
      type: ADDRESS_ALIASES_TYPE,
      json: { aliases: { contents: aliases } },
    },
  }
}
