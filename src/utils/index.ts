import { TENANT_CONFIG, type TenantId } from '../definitions'
import type { TenantConfig } from '../types'

/**
 * Checks if `obj` has a property named `property` of type `type`
 * @param obj {object}
 * @param property {string}
 * @param type {string}
 * @returns {boolean} Returns true if `obj` has a property named `property` of type `type`
 */
export function hasTypedProperty(
  obj: object,
  property: string,
  type: string,
): boolean {
  return (
    property in obj &&
    typeof (obj as Record<string, unknown>)[property] === type
  )
}

/**
 * Checks if `obj` has a property named `property` that is an array of type `type`
 * with the specified `length`
 * @param obj {object}
 * @param property {string}
 * @param type {string}
 * @param length {number}
 * @returns {boolean} Returns true if `obj` has a property named `property` that
 * is an array of type `type` with the specified `length`
 */
export function hasTypedArrayPropertyWithLength(
  obj: object,
  property: string,
  type: string,
  length: number,
): boolean {
  return (
    property in obj &&
    Array.isArray((obj as Record<string, unknown>)[property]) &&
    ((obj as Record<string, unknown>)[property] as unknown[]).every(
      (item: unknown) => typeof item === type,
    ) &&
    ((obj as Record<string, unknown>)[property] as unknown[]).length === length
  )
}

/**
 * Checks if `obj` is a 3x2 array of strings
 * @param obj {unknown}
 * @returns {boolean} Returns true if `obj` is a 3x2 array of strings
 */
export function is3x2ArrayOfStrings(obj: unknown): boolean {
  return (
    Array.isArray(obj) &&
    obj.length === 3 &&
    obj.every(
      (item) =>
        Array.isArray(item) &&
        item.length === 2 &&
        item.every((subItem) => typeof subItem === 'string'),
    )
  )
}

/** EVE token package ID per tenant (derived from TENANT_CONFIG).
 * @category Constants
 */
export const EVE_PACKAGE_ID_BY_TENANT = Object.fromEntries(
  (Object.entries(TENANT_CONFIG) as [TenantId, TenantConfig][]).map(
    ([id, config]) => [id, config.evePackageId],
  ),
) as Record<TenantId, string>
