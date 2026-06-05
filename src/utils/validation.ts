/**
 * Checks whether `value` is a string with at least one non-whitespace
 * character.
 *
 * This is useful for fields that must be present and meaningful before they are
 * passed into APIs such as `BigInt` or address seed generation.
 *
 * @param value {unknown}
 * @returns {boolean} True when `value` is a string and `value.trim()` is not empty.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Checks whether `value` is a non-empty string that can be parsed by `BigInt`
 * and represents a value greater than or equal to zero.
 *
 * Decimal, hexadecimal, and other string formats accepted by `BigInt` are
 * accepted here too.
 *
 * @param value {unknown}
 * @returns {boolean} True when `value` can be parsed as a non-negative bigint.
 */
export function isNonNegativeBigIntString(value: unknown): value is string {
  if (!isNonEmptyString(value)) {
    return false
  }

  try {
    return BigInt(value) >= 0n
  } catch {
    return false
  }
}

/**
 * Checks whether `value` is a positive JavaScript safe integer.
 *
 * This rejects zero, negative numbers, fractional numbers, infinities, `NaN`,
 * and integers outside `Number.MAX_SAFE_INTEGER`.
 *
 * @param value {unknown}
 * @returns {boolean} True when `value` is an integer greater than zero and safely representable.
 */
export function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0
}

/**
 * Checks whether `value` is an integer in the unsigned 8-bit range.
 *
 * This is a type/serialization-shape check for values that are encoded as
 * `u8`; it does not attach additional domain semantics to the number.
 *
 * @param value {unknown}
 * @returns {boolean} True when `value` is an integer from 0 through 255.
 */
export function isUint8Integer(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= 255
  )
}

/**
 * Checks whether `value` is an array of strings with exactly `length` entries.
 *
 * Empty strings are allowed; this helper validates shape and element type, not
 * string content.
 *
 * @param value {unknown}
 * @param length {number}
 * @returns {boolean} True when `value` is a string array with exactly `length` entries.
 */
export function isStringArrayWithLength(
  value: unknown,
  length: number,
): value is string[] {
  return (
    Array.isArray(value) &&
    value.length === length &&
    value.every((item) => typeof item === 'string')
  )
}

/**
 * Checks whether `obj` is a 3x2 matrix of strings.
 *
 * Empty strings are allowed; this helper validates shape and element type, not
 * string content.
 *
 * @param obj {unknown}
 * @returns {boolean} True when `obj` is an array with three rows and two string entries per row.
 */
export function is3x2ArrayOfStrings(obj: unknown): obj is string[][] {
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
