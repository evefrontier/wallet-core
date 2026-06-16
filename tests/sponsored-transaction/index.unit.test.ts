import { describe, expect, it } from 'vitest'
import {
  ASSEMBLY_TYPE_API_STRING,
  Assemblies,
  getAssemblyTypeApiString,
} from '#src/sponsored-transaction'

const expectedAssemblyTypeApiString = {
  [Assemblies.SmartStorageUnit]: 'storage-units',
  [Assemblies.SmartTurret]: 'turrets',
  [Assemblies.SmartGate]: 'gates',
  [Assemblies.NetworkNode]: 'network-nodes',
  [Assemblies.Assembly]: 'assemblies',
} satisfies Record<Assemblies, string>

describe('sponsored-transaction', () => {
  it('should map assembly types to API strings', () => {
    expect(ASSEMBLY_TYPE_API_STRING).toEqual(expectedAssemblyTypeApiString)

    for (const assembly of Object.values(Assemblies)) {
      expect(getAssemblyTypeApiString(assembly)).toBe(
        expectedAssemblyTypeApiString[assembly],
      )
    }
  })
})
