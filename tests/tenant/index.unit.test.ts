import { describe, expect, it } from 'vitest'
import {
  DEFAULT_TENANT,
  EVE_PACKAGE_ID_BY_TENANT,
  getTenantWorldPackageId,
  getTenantWorldType,
  getWorldPackageId,
  getWorldType,
  TENANT_CONFIG,
  TenantId,
  WORLD_PACKAGES,
  WORLD_TYPE_KEYS,
  worldMvrName,
} from '#src/tenant'

// Type-origin package ids registered under the `@evefrontier/world-*-dev` MVR
// names (testnet), i.e. what the embedded cache resolves to.
const WORLD_CORE_DEV =
  '0x0a4f1548929e834800da94990c419bc1ca63a836eeed517aada08788e2f00bca'
const WORLD_CHARACTER_DEV =
  '0x029e9cc9bdceb44ede8b3f848ddaae972f059641ededc5609255a04ea402ff17'
const WORLD_GENERIC_MODULE_DEV =
  '0x83e72009135503c350f723cbfedc19d13c0aa5366dfd56ab4b0f1eb6a49f7292'

// EVE token package ids (type-origin of `EVE::EVE`) registered under the
// `@evefrontier/currency*` MVR names (testnet), i.e. what the embedded cache
// resolves to.
const EVE_TEST =
  '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9'
const EVE_UAT =
  '0x5a575ae8d55c0ee9a4486a5a7d227e682679ef3e34fe19ff3cac6bd17a04ccd6'
const EVE_PTU =
  '0xf298ea7a927237f0cd045ff5926ecdde59bb469b69fa42e70dd47eb0f5feb21a'
const EVE = '0xc663658ff707985246bc7b5c605a458ec2caea28bfc35c253eb526dcf961643e'

describe('tenant', () => {
  it('should use Stillness as the default tenant', () => {
    expect(DEFAULT_TENANT).toBe(TenantId.STILLNESS)
  })

  describe('TENANT_CONFIG world tier', () => {
    it('puts the four test tenants on the test tier', () => {
      for (const id of [
        TenantId.TAUCETI,
        TenantId.TIAKI,
        TenantId.TESSERACT,
        TenantId.TETRA,
      ]) {
        expect(TENANT_CONFIG[id].worldTier).toBe('test')
      }
    })

    it('puts utopia/umbra on the uat tier', () => {
      for (const id of [TenantId.UTOPIA, TenantId.UMBRA]) {
        expect(TENANT_CONFIG[id].worldTier).toBe('uat')
      }
    })

    it('puts stillness on live and only liminality on ptu', () => {
      expect(TENANT_CONFIG[TenantId.STILLNESS].worldTier).toBe('live')
      expect(TENANT_CONFIG[TenantId.LIMINALITY].worldTier).toBe('ptu')
      expect(
        Object.values(TENANT_CONFIG).filter((c) => c.worldTier === 'ptu'),
      ).toHaveLength(1)
    })
  })

  describe('worldMvrName', () => {
    it('suffixes the tier and dashes the package name', () => {
      expect(worldMvrName('character', 'dev')).toBe(
        '@evefrontier/world-character-dev',
      )
      expect(worldMvrName('generic_module', 'ptu')).toBe(
        '@evefrontier/world-generic-module-ptu',
      )
    })

    it('has no suffix on the live tier', () => {
      expect(worldMvrName('core', 'live')).toBe('@evefrontier/world-core')
    })
  })

  describe('getWorldType', () => {
    it('resolves every key on the dev tier', () => {
      for (const key of WORLD_TYPE_KEYS) {
        expect(getWorldType('dev', key)).toMatch(/^0x[0-9a-f]+::/)
      }
    })

    it('returns type-origin tags under each package', () => {
      expect(getWorldType('dev', 'character::identity::Identity')).toBe(
        `${WORLD_CHARACTER_DEV}::identity::Identity`,
      )
      expect(
        getWorldType('dev', 'generic_module::generic_module::GenericModule'),
      ).toBe(`${WORLD_GENERIC_MODULE_DEV}::generic_module::GenericModule`)
    })
  })

  describe('getWorldPackageId', () => {
    it('anchors core on ObjectRegistry', () => {
      expect(getWorldPackageId('dev', 'core')).toBe(WORLD_CORE_DEV)
    })

    it('resolves every package on the dev tier', () => {
      for (const pkg of WORLD_PACKAGES) {
        expect(getWorldPackageId('dev', pkg)).toMatch(/^0x[0-9a-f]+$/)
      }
    })
  })

  describe('tenant world resolution', () => {
    it('throws for a tier missing from the MVR cache', () => {
      expect(() =>
        getTenantWorldType(TenantId.TAUCETI, 'character::identity::Identity'),
      ).toThrow(/MVR cache has no type-origin entry/)
      expect(() =>
        getTenantWorldPackageId(TenantId.LIMINALITY, 'core'),
      ).toThrow(/@evefrontier\/world-core-ptu::object_registry::ObjectRegistry/)
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

    it('resolves stillness to the @evefrontier/currency package', () => {
      expect(TENANT_CONFIG[TenantId.STILLNESS].currencyMvrName).toBe(
        '@evefrontier/currency',
      )
      expect(TENANT_CONFIG[TenantId.STILLNESS].evePackageId).toBe(EVE)
    })

    it('resolves liminality to the currency-ptu package', () => {
      expect(TENANT_CONFIG[TenantId.LIMINALITY].currencyMvrName).toBe(
        '@evefrontier/currency-ptu',
      )
      expect(TENANT_CONFIG[TenantId.LIMINALITY].evePackageId).toBe(EVE_PTU)
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
