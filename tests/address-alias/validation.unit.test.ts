import { describe, expect, it } from 'vitest'
import {
  type AddressAliasesInfo,
  MAX_ADDRESS_ALIASES,
  validateAddressAliasRemoval,
  validateExistingAddressAlias,
  validateNewAddressAlias,
} from '#src/address-alias'

const VALID_ADDRESS = `0x${'1'.repeat(64)}`
const OTHER_ADDRESS = `0x${'2'.repeat(64)}`
const OWNER_ADDRESS = `0x${'9'.repeat(64)}`

const LAST_ALIAS_ERROR =
  'You can’t remove your last recovery alias. Add another personal access key before removing this one.'

describe('validateNewAddressAlias', () => {
  it('should accept a valid new alias', () => {
    expect(
      validateNewAddressAlias({ addressAlias: VALID_ADDRESS, existing: [] }),
    ).toBeNull()
  })

  it('should trim whitespace before validating', () => {
    expect(
      validateNewAddressAlias({
        addressAlias: `  ${VALID_ADDRESS}  `,
        existing: [],
      }),
    ).toBeNull()
  })

  it('should reject an empty alias', () => {
    expect(validateNewAddressAlias({ addressAlias: '   ', existing: [] })).toBe(
      'Enter an address to add as an address alias',
    )
  })

  it('should reject an invalid Sui address', () => {
    expect(
      validateNewAddressAlias({ addressAlias: '0x123', existing: [] }),
    ).toBe('Not a valid Sui address')
  })

  it('should reject a duplicate alias', () => {
    expect(
      validateNewAddressAlias({
        addressAlias: VALID_ADDRESS,
        existing: [VALID_ADDRESS],
      }),
    ).toBe('Address is already an address alias')
  })

  it('should reject when the alias limit is reached', () => {
    const existing = Array.from(
      { length: MAX_ADDRESS_ALIASES },
      (_, i) => `0x${String(i).padStart(64, '0')}`,
    )
    expect(
      validateNewAddressAlias({ addressAlias: VALID_ADDRESS, existing }),
    ).toBe(`Maximum of ${MAX_ADDRESS_ALIASES} address aliases reached`)
  })
})

describe('validateExistingAddressAlias', () => {
  it('should accept an existing alias', () => {
    expect(
      validateExistingAddressAlias({
        addressAlias: VALID_ADDRESS,
        existing: [VALID_ADDRESS],
      }),
    ).toBeNull()
  })

  it('should reject an empty alias', () => {
    expect(
      validateExistingAddressAlias({ addressAlias: '', existing: [] }),
    ).toBe('Enter an address to remove')
  })

  it('should reject an invalid Sui address', () => {
    expect(
      validateExistingAddressAlias({ addressAlias: 'nope', existing: [] }),
    ).toBe('Not a valid Sui address')
  })

  it('should reject an address that is not an alias', () => {
    expect(
      validateExistingAddressAlias({
        addressAlias: OTHER_ADDRESS,
        existing: [VALID_ADDRESS],
      }),
    ).toBe('Address is not an existing address alias')
  })
})

describe('validateAddressAliasRemoval', () => {
  const info = (addressAliases: string[]): AddressAliasesInfo => ({
    enabled: true,
    objectId: `0x${'a'.repeat(64)}`,
    addressAliases,
  })

  it('should allow removing an alias when another enforceable alias remains', () => {
    expect(
      validateAddressAliasRemoval({
        addressAlias: VALID_ADDRESS,
        owner: OWNER_ADDRESS,
        info: info([VALID_ADDRESS, OTHER_ADDRESS]),
      }),
    ).toBeNull()
  })

  it('should block removing the last non-self alias', () => {
    expect(
      validateAddressAliasRemoval({
        addressAlias: VALID_ADDRESS,
        owner: OWNER_ADDRESS,
        info: info([VALID_ADDRESS]),
      }),
    ).toBe(LAST_ALIAS_ERROR)
  })

  it('should block when the only remaining alias would be the owner itself', () => {
    expect(
      validateAddressAliasRemoval({
        addressAlias: VALID_ADDRESS,
        owner: OWNER_ADDRESS,
        info: info([VALID_ADDRESS, OWNER_ADDRESS]),
      }),
    ).toBe(LAST_ALIAS_ERROR)
  })

  it('should normalize addresses when simulating the removal', () => {
    const stored = `0x${'ab'.repeat(32)}`
    const mixedCase = `0x${'AB'.repeat(32)}`
    expect(
      validateAddressAliasRemoval({
        addressAlias: mixedCase,
        owner: OWNER_ADDRESS,
        info: info([stored]),
      }),
    ).toBe(LAST_ALIAS_ERROR)
  })

  it('should still enforce base membership checks', () => {
    expect(
      validateAddressAliasRemoval({
        addressAlias: OTHER_ADDRESS,
        owner: OWNER_ADDRESS,
        info: info([VALID_ADDRESS]),
      }),
    ).toBe('Address is not an existing address alias')
  })

  it('should skip the enforceability guard when aliasing is not enabled', () => {
    expect(
      validateAddressAliasRemoval({
        addressAlias: VALID_ADDRESS,
        owner: OWNER_ADDRESS,
        info: { enabled: false, addressAliases: [VALID_ADDRESS] },
      }),
    ).toBeNull()
  })
})
