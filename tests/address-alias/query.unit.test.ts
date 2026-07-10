import { describe, expect, it, vi } from 'vitest'
import {
  ADDRESS_ALIASES_TYPE,
  getAddressAliases,
  parseAddressAliases,
} from '#src/address-alias'

const OWNER = `0x${'a'.repeat(64)}`
const OBJECT_ID = `0x${'b'.repeat(64)}`
const ALIAS = `0x${'c'.repeat(64)}`

function clientWithObjects(objects: unknown[]) {
  const listOwnedObjects = vi.fn().mockResolvedValue({ objects })
  return {
    client: { core: { listOwnedObjects } } as never,
    listOwnedObjects,
  }
}

describe('getAddressAliases', () => {
  it('should list owned objects filtered by the AddressAliases type', async () => {
    const { client, listOwnedObjects } = clientWithObjects([])

    await getAddressAliases(client, OWNER)

    expect(listOwnedObjects).toHaveBeenCalledWith({
      owner: OWNER,
      type: ADDRESS_ALIASES_TYPE,
      include: { json: true },
    })
  })

  it('should return enabled: false when no AddressAliases object exists', async () => {
    const { client } = clientWithObjects([])

    await expect(getAddressAliases(client, OWNER)).resolves.toEqual({
      enabled: false,
      addressAliases: [],
    })
  })

  it('should return the object id and aliases when the object exists', async () => {
    const { client } = clientWithObjects([
      { objectId: OBJECT_ID, json: { aliases: { contents: [ALIAS] } } },
    ])

    await expect(getAddressAliases(client, OWNER)).resolves.toEqual({
      enabled: true,
      objectId: OBJECT_ID,
      addressAliases: [ALIAS],
    })
  })
})

describe('parseAddressAliases', () => {
  it('should extract string aliases from the JSON view', () => {
    expect(parseAddressAliases({ aliases: { contents: [ALIAS] } })).toEqual([
      ALIAS,
    ])
  })

  it('should drop non-string entries', () => {
    expect(
      parseAddressAliases({ aliases: { contents: [ALIAS, 42, null] } }),
    ).toEqual([ALIAS])
  })

  it.each([
    ['null json', null],
    ['missing aliases', {}],
    ['non-array contents', { aliases: { contents: 'oops' } }],
  ])('should return an empty list for %s', (_name, json) => {
    expect(parseAddressAliases(json)).toEqual([])
  })
})
