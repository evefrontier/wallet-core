import { ObjectError } from '@mysten/sui/client'
import { describe, expect, it, vi } from 'vitest'
import {
  ADDRESS_ALIASES_TYPE,
  addressAliasesObjectId,
  getAddressAliases,
  parseAddressAliases,
} from '#src/address-alias'
import { aliasesObject, notFoundError } from './object-mocks'

const OWNER = `0x${'a'.repeat(64)}`
const OBJECT_ID = addressAliasesObjectId(OWNER)
const ALIAS = `0x${'c'.repeat(64)}`

// Captured from a real devnet/testnet enable: the owner and the AddressAliases
// object it was given.
const GOLDEN_OWNER =
  '0x2dcae64eeb255b56b25e3b44b9f07a363f0025f83ed221c3e3b38e57e55d3fde'
const GOLDEN_OBJECT_ID =
  '0x3380507002291d03a12f9fd1981ca377353caccf6239947e773d52d4be234ed7'

function clientWith(getObject: ReturnType<typeof vi.fn>) {
  return { core: { getObject } } as never
}

describe('addressAliasesObjectId', () => {
  it('should derive the id the chain assigned to a real owner', () => {
    expect(addressAliasesObjectId(GOLDEN_OWNER)).toBe(GOLDEN_OBJECT_ID)
  })

  it.each([
    '0x1',
    '0x01',
    '1',
    '0X1',
    `0x${'0'.repeat(63)}1`,
  ])('should resolve %s to the same id as the full address', (owner) => {
    expect(addressAliasesObjectId(owner)).toBe(
      addressAliasesObjectId(`0x${'0'.repeat(63)}1`),
    )
  })

  it('should ignore the case of the owner', () => {
    expect(
      addressAliasesObjectId(GOLDEN_OWNER.toUpperCase().replace('0X', '0x')),
    ).toBe(GOLDEN_OBJECT_ID)
  })

  it.each([
    ['empty', ''],
    ['not hex', '0xzz'],
    ['too long', `0x${'11'.repeat(33)}`],
  ])('should reject an owner that is %s', (_name, owner) => {
    expect(() => addressAliasesObjectId(owner)).toThrow()
  })
})

describe('getAddressAliases', () => {
  it('should read the derived object id with its JSON view', async () => {
    const getObject = vi
      .fn()
      .mockResolvedValue(aliasesObject(GOLDEN_OBJECT_ID, []))

    await getAddressAliases(clientWith(getObject), GOLDEN_OWNER)

    expect(getObject).toHaveBeenCalledWith({
      objectId: GOLDEN_OBJECT_ID,
      include: { json: true },
    })
  })

  it('should return enabled: false when the object does not exist', async () => {
    const getObject = vi.fn().mockRejectedValue(notFoundError())

    await expect(
      getAddressAliases(clientWith(getObject), OWNER),
    ).resolves.toEqual({ enabled: false, addressAliases: [] })
  })

  it('should return the object id and aliases when the object exists', async () => {
    const getObject = vi
      .fn()
      .mockResolvedValue(aliasesObject(OBJECT_ID, [ALIAS]))

    await expect(
      getAddressAliases(clientWith(getObject), OWNER),
    ).resolves.toEqual({
      enabled: true,
      objectId: OBJECT_ID,
      addressAliases: [ALIAS],
    })
  })

  it('should treat a not-found error from another copy of the SDK as not enabled', async () => {
    class ForeignObjectError extends Error {
      code = 'notExists'
      reason = 'notFound'
    }
    const getObject = vi.fn().mockRejectedValue(new ForeignObjectError('gone'))

    await expect(
      getAddressAliases(clientWith(getObject), OWNER),
    ).resolves.toEqual({ enabled: false, addressAliases: [] })
  })

  it('should accept the type in its zero-padded form', async () => {
    const getObject = vi.fn().mockResolvedValue({
      object: {
        objectId: OBJECT_ID,
        type: `0x${'0'.repeat(63)}2::address_alias::AddressAliases`,
        json: { aliases: { contents: [ALIAS] } },
      },
    })

    await expect(
      getAddressAliases(clientWith(getObject), OWNER),
    ).resolves.toMatchObject({ enabled: true, addressAliases: [ALIAS] })
  })

  it('should reject an object that is not an AddressAliases', async () => {
    const getObject = vi.fn().mockResolvedValue({
      object: { objectId: OBJECT_ID, type: '0x2::coin::Coin<0x2::sui::SUI>' },
    })

    await expect(
      getAddressAliases(clientWith(getObject), OWNER),
    ).rejects.toThrow(`expected ${ADDRESS_ALIASES_TYPE}`)
  })

  it('should reject an object whose id is not the derived id', async () => {
    const otherId = `0x${'d'.repeat(64)}`
    const getObject = vi.fn().mockResolvedValue(aliasesObject(otherId, [ALIAS]))

    await expect(
      getAddressAliases(clientWith(getObject), OWNER),
    ).rejects.toThrow(`Read object ${otherId}`)
  })

  it('should accept the object id in another case', async () => {
    const getObject = vi.fn().mockResolvedValue({
      object: {
        objectId: `0x${OBJECT_ID.slice(2).toUpperCase()}`,
        type: ADDRESS_ALIASES_TYPE,
        json: { aliases: { contents: [ALIAS] } },
      },
    })

    await expect(
      getAddressAliases(clientWith(getObject), OWNER),
    ).resolves.toEqual({
      enabled: true,
      objectId: OBJECT_ID,
      addressAliases: [ALIAS],
    })
  })

  it.each([
    ['no JSON view', undefined],
    ['null JSON', null],
    ['no aliases field', {}],
    ['no contents', { aliases: {} }],
    ['non-array contents', { aliases: { contents: 'oops' } }],
  ])('should reject an existing object with %s', async (_name, json) => {
    const getObject = vi.fn().mockResolvedValue({
      object: { objectId: OBJECT_ID, type: ADDRESS_ALIASES_TYPE, json },
    })

    await expect(
      getAddressAliases(clientWith(getObject), OWNER),
    ).rejects.toThrow('has no alias list in its JSON view')
  })

  it('should return an empty list for an enabled object with no aliases', async () => {
    const getObject = vi.fn().mockResolvedValue(aliasesObject(OBJECT_ID, []))

    await expect(
      getAddressAliases(clientWith(getObject), OWNER),
    ).resolves.toEqual({
      enabled: true,
      objectId: OBJECT_ID,
      addressAliases: [],
    })
  })

  it('should rethrow a transport failure instead of reporting not enabled', async () => {
    const failure = new Error('deadline exceeded')
    const getObject = vi.fn().mockRejectedValue(failure)

    await expect(getAddressAliases(clientWith(getObject), OWNER)).rejects.toBe(
      failure,
    )
  })

  it.each([
    'deleted',
    'unknown',
  ] as const)('should rethrow an object error with reason %s', async (reason) => {
    const failure = new ObjectError('x', 'boom', { reason })
    const getObject = vi.fn().mockRejectedValue(failure)

    await expect(getAddressAliases(clientWith(getObject), OWNER)).rejects.toBe(
      failure,
    )
  })

  it('should reject an invalid owner without reading the chain', async () => {
    const getObject = vi.fn()

    await expect(
      getAddressAliases(clientWith(getObject), 'not-an-address'),
    ).rejects.toThrow()
    expect(getObject).not.toHaveBeenCalled()
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
