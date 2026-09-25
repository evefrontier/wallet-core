import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TENANT,
  EVE_PACKAGE_ID_BY_TENANT,
  getTenantWorldType,
  TENANT_CONFIG,
  TenantId,
} from '#src/tenant'

// Type-origin package ids registered under the `@evefrontier/world*` MVR names
// (testnet), i.e. what the embedded cache resolves to.
const WORLD_TEST =
  '0x353988e063b4683580e3603dbe9e91fefd8f6a06263a646d43fd3a2f3ef6b8c1'
const WORLD_UAT =
  '0x28eab6a6e9e12808a15901b12fcd3adfb07317d716dcaeb3f2965e25c7da0230'
const WORLD =
  '0x7be18d6294e533bedd9a5d70a96ce8d9d4b87a7c74188ba65d3fe966bbed9d92'

// EVE token package ids (type-origin of `EVE::EVE`) registered under the
// `@evefrontier/currency*` MVR names (testnet), i.e. what the embedded cache
// resolves to.
const EVE_TEST =
  '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9'
const EVE_UAT =
  '0x5a575ae8d55c0ee9a4486a5a7d227e682679ef3e34fe19ff3cac6bd17a04ccd6'
const EVE = '0xc663658ff707985246bc7b5c605a458ec2caea28bfc35c253eb526dcf961643e'

describe('tenant', () => {
  it('should use Stillness as the default tenant', () => {
    expect(DEFAULT_TENANT).toBe(TenantId.STILLNESS)
  })

  describe('TENANT_CONFIG world package id derivation', () => {
    it('resolves the four world-test tenants to the shared test package', () => {
      for (const id of [
        TenantId.TAUCETI,
        TenantId.TIAKI,
        TenantId.TESSERACT,
        TenantId.TETRA,
      ]) {
        expect(TENANT_CONFIG[id].mvrName).toBe('@evefrontier/world-test')
        expect(TENANT_CONFIG[id].packageId).toBe(WORLD_TEST)
      }
    })

    it('resolves utopia/umbra to the world-uat package (not the stale 0xd12a70c)', () => {
      for (const id of [TenantId.UTOPIA, TenantId.UMBRA]) {
        expect(TENANT_CONFIG[id].mvrName).toBe('@evefrontier/world-uat')
        expect(TENANT_CONFIG[id].packageId).toBe(WORLD_UAT)
      }
    })

    it('resolves stillness/liminality to the @evefrontier/world package', () => {
      for (const id of [TenantId.STILLNESS, TenantId.LIMINALITY]) {
        expect(TENANT_CONFIG[id].mvrName).toBe('@evefrontier/world')
        expect(TENANT_CONFIG[id].packageId).toBe(WORLD)
      }
    })

    it('covers every TenantId with a resolved config', () => {
      for (const id of Object.values(TenantId)) {
        expect(TENANT_CONFIG[id]?.packageId).toMatch(/^0x[0-9a-f]+$/)
      }
    })
  })

  describe('getTenantWorldType', () => {
    it('returns type-origin-correct tags for the TenantItemId key', () => {
      expect(
        getTenantWorldType(TenantId.TAUCETI, 'in_game_id::TenantItemId'),
      ).toBe(`${WORLD_TEST}::in_game_id::TenantItemId`)
      expect(
        getTenantWorldType(TenantId.UTOPIA, 'in_game_id::TenantItemId'),
      ).toBe(`${WORLD_UAT}::in_game_id::TenantItemId`)
    })

    it('returns the ObjectRegistry tag that anchors packageId', () => {
      expect(
        getTenantWorldType(
          TenantId.STILLNESS,
          'object_registry::ObjectRegistry',
        ),
      ).toBe(`${WORLD}::object_registry::ObjectRegistry`)
    })
  })

  describe('TENANT_CONFIG EVE package id derivation', () => {
    it('resolves the four world-test tenants to the shared currency-test package', () => {
      for (const id of [
        TenantId.TAUCETI,
        TenantId.TIAKI,
        TenantId.TESSERACT,
        TenantId.TETRA,
      ]) {
        expect(TENANT_CONFIG[id].currencyMvrName).toBe(
          '@evefrontier/currency-test',
        )
        expect(TENANT_CONFIG[id].evePackageId).toBe(EVE_TEST)
      }
    })

    it('resolves utopia/umbra to the currency-uat package (not the stale 0xf0446b9)', () => {
      for (const id of [TenantId.UTOPIA, TenantId.UMBRA]) {
        expect(TENANT_CONFIG[id].currencyMvrName).toBe(
          '@evefrontier/currency-uat',
        )
        expect(TENANT_CONFIG[id].evePackageId).toBe(EVE_UAT)
      }
    })

    it('resolves stillness/liminality to the one shared @evefrontier/currency package', () => {
      for (const id of [TenantId.STILLNESS, TenantId.LIMINALITY]) {
        expect(TENANT_CONFIG[id].currencyMvrName).toBe('@evefrontier/currency')
        expect(TENANT_CONFIG[id].evePackageId).toBe(EVE)
      }
    })
  })

  describe('EVE_PACKAGE_ID_BY_TENANT', () => {
    it('mirrors each tenant evePackageId', () => {
      for (const id of Object.values(TenantId)) {
        expect(EVE_PACKAGE_ID_BY_TENANT[id]).toBe(
          TENANT_CONFIG[id].evePackageId,
        )
        expect(EVE_PACKAGE_ID_BY_TENANT[id]).toMatch(/^0x[0-9a-f]+$/)
      }
    })
  })
})
