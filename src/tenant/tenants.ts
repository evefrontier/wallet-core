/** Tenant IDs.
 *  @category Constants
 */
export enum TenantId {
  STILLNESS = 'stillness',
  UTOPIA = 'utopia',
  TAUCETI = 'tauceti',
  TIAKI = 'tiaki',
  TETRA = 'tetra',
  TESSERACT = 'tesseract',
}

/** Tenant when not provided via URL ?tenant= (e.g. dev/default chain).
 *  @category Constants
 */
export const DEFAULT_TENANT = TenantId.STILLNESS

/** Per-tenant config: EVE token package ID (Sui) and Datahub API host. v0.0.18
 * @category Constants
 */
export interface TenantConfig {
  packageId: string
  evePackageId: string
  datahubHost: string
}

/** Single source of truth for the six tenants (package ID + datahub host).
 * Corresponds to world contracts v0.0.18
 * @category Constants
 */
export const TENANT_CONFIG: Record<TenantId, TenantConfig> = {
  [TenantId.TAUCETI]: {
    packageId:
      '0x353988e063b4683580e3603dbe9e91fefd8f6a06263a646d43fd3a2f3ef6b8c1',
    evePackageId:
      '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9',
    datahubHost: 'world-api-tauceti.test.priv.evefrontier.com',
  },
  [TenantId.TIAKI]: {
    packageId:
      '0x353988e063b4683580e3603dbe9e91fefd8f6a06263a646d43fd3a2f3ef6b8c1',
    evePackageId:
      '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9',
    datahubHost: 'world-api-tiaki.test.priv.evefrontier.com',
  },
  [TenantId.TESSERACT]: {
    packageId:
      '0x353988e063b4683580e3603dbe9e91fefd8f6a06263a646d43fd3a2f3ef6b8c1',
    evePackageId:
      '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9',
    datahubHost: 'world-api-tesseract.test.priv.evefrontier.com',
  },
  [TenantId.TETRA]: {
    packageId:
      '0x353988e063b4683580e3603dbe9e91fefd8f6a06263a646d43fd3a2f3ef6b8c1',
    evePackageId:
      '0x6407060579895a8b30f7d30d2447046eb80ecc23f0c9acde09222b2a505583c9',
    datahubHost: 'world-api-tetra.test.priv.evefrontier.com',
  },
  [TenantId.UTOPIA]: {
    packageId:
      '0xd12a70c74c1e759445d6f209b01d43d860e97fcf2ef72ccbbd00afd828043f75',
    evePackageId:
      '0xf0446b93345c1118f21239d7ac58fb82d005219b2016e100f074e4d17162a465',
    datahubHost: 'world-api-utopia.uat.priv.evefrontier.com',
  },
  [TenantId.STILLNESS]: {
    packageId:
      '0x28b497559d65ab320d9da4613bf2498d5946b2c0ae3597ccfda3072ce127448c',
    evePackageId:
      '0x2a66a89b5a735738ffa4423ac024d23571326163f324f9051557617319e59d60',
    datahubHost: 'world-api-stillness.live.pub.evefrontier.com',
  },
}

/** EVE token package ID per tenant (derived from TENANT_CONFIG).
 * @category Constants
 */
export const EVE_PACKAGE_ID_BY_TENANT = Object.fromEntries(
  (Object.entries(TENANT_CONFIG) as [TenantId, TenantConfig][]).map(
    ([id, config]) => [id, config.evePackageId],
  ),
) as Record<TenantId, string>
