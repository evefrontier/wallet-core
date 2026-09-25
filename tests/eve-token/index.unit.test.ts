import { describe, expect, it } from 'vitest'
import { getEveCoinType, isEveCoinType } from '#src/eve-token'
import { TenantId } from '#src/tenant'

const eveCoinTypePattern = /^0x[0-9a-f]{64}::EVE::EVE$/

// EVE coin types from the `@evefrontier/currency*` MVR registrations (type-origin
// of `EVE::EVE`, testnet). STILLNESS and LIMINALITY share the one
// `@evefrontier/currency` package.
const expectedStillnessEveCoinType =
  '0xc663658ff707985246bc7b5c605a458ec2caea28bfc35c253eb526dcf961643e::EVE::EVE'

const expectedEveCoinTypes = {
  [TenantId.TAUCETI]:
    '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9::EVE::EVE',
  [TenantId.TESSERACT]:
    '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9::EVE::EVE',
  [TenantId.TETRA]:
    '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9::EVE::EVE',
  [TenantId.TIAKI]:
    '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9::EVE::EVE',
  [TenantId.UTOPIA]:
    '0x5a575ae8d55c0ee9a4486a5a7d227e682679ef3e34fe19ff3cac6bd17a04ccd6::EVE::EVE',
  [TenantId.UMBRA]:
    '0x5a575ae8d55c0ee9a4486a5a7d227e682679ef3e34fe19ff3cac6bd17a04ccd6::EVE::EVE',
  [TenantId.STILLNESS]: expectedStillnessEveCoinType,
  [TenantId.LIMINALITY]: expectedStillnessEveCoinType,
} satisfies Record<TenantId, string>

describe('eve-token', () => {
  it('should build EVE coin types with an address and EVE type suffix', () => {
    for (const tenantId of Object.values(TenantId)) {
      expect(getEveCoinType(tenantId)).toMatch(eveCoinTypePattern)
    }
  })

  it('should build the expected EVE coin type for Stillness', () => {
    expect(getEveCoinType(TenantId.STILLNESS)).toBe(
      expectedStillnessEveCoinType,
    )
  })

  it('should identify known current EVE coin types', () => {
    for (const coinType of Object.values(expectedEveCoinTypes)) {
      expect(isEveCoinType(coinType)).toBe(true)
    }

    expect(isEveCoinType('0x2::sui::SUI')).toBe(false)
    expect(isEveCoinType('')).toBe(false)
    expect(
      isEveCoinType(
        '0x0000000000000000000000000000000000000000000000000000000000000001::EVE::EVE',
      ),
    ).toBe(false)
  })
})
