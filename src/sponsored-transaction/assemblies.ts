export enum SponsoredTransactionActions {
  BRING_ONLINE = 'online',
  BRING_OFFLINE = 'offline',
  UPDATE_METADATA = 'update-metadata',
  LINK_SMART_GATE = 'link-smart-gate',
  UNLINK_SMART_GATE = 'unlink-smart-gate',
}

export enum Assemblies {
  SmartStorageUnit = 'SmartStorageUnit',
  SmartTurret = 'SmartTurret',
  SmartGate = 'SmartGate',
  NetworkNode = 'NetworkNode',
  Assembly = 'Assembly',
}

export const ASSEMBLY_TYPE_API_STRING: Record<Assemblies, string> = {
  [Assemblies.SmartStorageUnit]: 'storage-units',
  [Assemblies.SmartTurret]: 'turrets',
  [Assemblies.SmartGate]: 'gates',
  [Assemblies.NetworkNode]: 'network-nodes',
  [Assemblies.Assembly]: 'assemblies',
} as const

export type SponsoredTransactionAssemblyType =
  (typeof ASSEMBLY_TYPE_API_STRING)[Assemblies]

export function getAssemblyTypeApiString(
  type: Assemblies,
): SponsoredTransactionAssemblyType {
  return ASSEMBLY_TYPE_API_STRING[type]
}
