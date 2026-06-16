import { describe, expect, it } from 'vitest'
import { getEveCoinType, isEveCoinType } from '#src/eve-token'
import { TenantId } from '#src/tenant'

const eveCoinTypePattern = /^0x[0-9a-f]{64}::EVE::EVE$/

const expectedStillnessEveCoinType =
  '0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60::EVE::EVE'

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
    '0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465::EVE::EVE',
  [TenantId.STILLNESS]: expectedStillnessEveCoinType,
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
