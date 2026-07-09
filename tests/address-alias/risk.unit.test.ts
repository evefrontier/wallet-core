import { describe, expect, it } from 'vitest'
import { isAddressAliasCall } from '#src/address-alias'

describe('isAddressAliasCall', () => {
  it('should match a MoveCall into 0x2::address_alias', () => {
    expect(
      isAddressAliasCall({
        MoveCall: { package: '0x2', module: 'address_alias', function: 'add' },
      }),
    ).toBe(true)
  })

  it('should match the lowercase moveCall key and long-form package address', () => {
    expect(
      isAddressAliasCall({
        moveCall: {
          package: `0x${'0'.repeat(63)}2`,
          module: 'address_alias',
          function: 'remove',
        },
      }),
    ).toBe(true)
  })

  it('should not match other modules or packages', () => {
    expect(
      isAddressAliasCall({
        MoveCall: { package: '0x2', module: 'coin', function: 'mint' },
      }),
    ).toBe(false)
    expect(
      isAddressAliasCall({
        MoveCall: {
          package: `0x${'d'.repeat(64)}`,
          module: 'address_alias',
          function: 'add',
        },
      }),
    ).toBe(false)
  })

  it.each([
    ['null', null],
    ['a non-object', 'MoveCall'],
    ['a command without MoveCall', { TransferObjects: {} }],
    ['a MoveCall without package/module', { MoveCall: { function: 'add' } }],
  ])('should return false for %s', (_name, command) => {
    expect(isAddressAliasCall(command)).toBe(false)
  })
})
