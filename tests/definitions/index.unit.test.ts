import { describe, expect, it } from 'vitest'
import {
  ASSEMBLY_TYPE_API_STRING,
  Assemblies,
  DEFAULT_TENANT,
  getAssemblyTypeApiString,
  getEveCoinType,
  isEveCoinType,
  TenantId,
} from '#src/definitions'

const expectedAssemblyTypeApiString = {
  [Assemblies.SmartStorageUnit]: 'storage-units',
  [Assemblies.SmartTurret]: 'turrets',
  [Assemblies.SmartGate]: 'gates',
  [Assemblies.NetworkNode]: 'network-nodes',
  [Assemblies.Assembly]: 'assemblies',
} satisfies Record<Assemblies, string>

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

describe('definitions', () => {
  it('should use Stillness as the default tenant', () => {
    expect(DEFAULT_TENANT).toBe(TenantId.STILLNESS)
  })

  it('should map assembly types to API strings', () => {
    expect(ASSEMBLY_TYPE_API_STRING).toEqual(expectedAssemblyTypeApiString)

    for (const assembly of Object.values(Assemblies)) {
      expect(getAssemblyTypeApiString(assembly)).toBe(
        expectedAssemblyTypeApiString[assembly],
      )
    }
  })

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
