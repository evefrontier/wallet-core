import { describe, expect, it } from 'vitest'
import {
  MAX_ADDRESS_ALIASES,
  validateExistingAddressAlias,
  validateNewAddressAlias,
} from '#src/address-alias'

const VALID_ADDRESS = `0x${'1'.repeat(64)}`
const OTHER_ADDRESS = `0x${'2'.repeat(64)}`

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
