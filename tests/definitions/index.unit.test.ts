import { describe, expect, it } from 'vitest'
import {
  ASSEMBLY_TYPE_API_STRING,
  Assemblies,
  DEFAULT_TENANT,
  EVE_COIN_TYPE_SUFFIX,
  getAssemblyTypeApiString,
  getEveCoinType,
  TENANT_CONFIG,
  TenantId,
} from '#src/definitions'

describe('definitions', () => {
  it('should use Stillness as the default tenant', () => {
    expect(DEFAULT_TENANT).toBe(TenantId.STILLNESS)
  })

  it('should map assembly types to API strings', () => {
    const apiStringsByAssembly = Object.fromEntries(
      Object.values(Assemblies).map((assembly) => [
        assembly,
        getAssemblyTypeApiString(assembly),
      ]),
    )

    expect(apiStringsByAssembly).toEqual(ASSEMBLY_TYPE_API_STRING)
    expect(getAssemblyTypeApiString(Assemblies.SmartStorageUnit)).toBe(
      'storage-units',
    )
    expect(getAssemblyTypeApiString(Assemblies.SmartTurret)).toBe('turrets')
    expect(getAssemblyTypeApiString(Assemblies.SmartGate)).toBe('gates')
    expect(getAssemblyTypeApiString(Assemblies.NetworkNode)).toBe(
      'network-nodes',
    )
    expect(getAssemblyTypeApiString(Assemblies.Assembly)).toBe('assemblies')
  })

  it('should build EVE coin types from tenant EVE package IDs', () => {
    for (const tenantId of Object.values(TenantId)) {
      expect(getEveCoinType(tenantId)).toBe(
        `${TENANT_CONFIG[tenantId].evePackageId}${EVE_COIN_TYPE_SUFFIX}`,
      )
    }
  })
})
