import { describe, expect, it } from 'vitest'
import {
  is3x2ArrayOfStrings,
  isNonEmptyString,
  isObjectRecord,
  isPositiveSafeInteger,
  isStringArrayWithLength,
  isUint8Integer,
  isUnsignedDecimalIntegerStringBelow,
} from '#src/utils'

describe('Utility Functions', () => {
  describe('is3x2ArrayOfStrings', () => {
    it('should return true if object is a 3x2 array of strings', () => {
      const arr = [
        ['a', 'b'],
        ['c', 'd'],
        ['e', 'f'],
      ]
      expect(is3x2ArrayOfStrings(arr)).toBe(true)
    })

    it('should return false if object is not a 3x2 array of strings', () => {
      const arr1 = [
        ['a', 'b'],
        ['c', 'd'],
      ] // 2x2 not 3x2
      const arr2 = [
        ['a', 'b'],
        ['c', 'd'],
        ['e', 1],
      ] // a number is not a string
      expect(is3x2ArrayOfStrings(arr1)).toBe(false)
      expect(is3x2ArrayOfStrings(arr2)).toBe(false)
    })
  })

  describe('isNonEmptyString', () => {
    it('should return true only for strings with non-whitespace content', () => {
      expect(isNonEmptyString('value')).toBe(true)
      expect(isNonEmptyString('')).toBe(false)
      expect(isNonEmptyString('   ')).toBe(false)
      expect(isNonEmptyString(1)).toBe(false)
    })
  })

  describe('isObjectRecord', () => {
    it('should return true only for non-null objects', () => {
      expect(isObjectRecord({ value: 1 })).toBe(true)
      expect(isObjectRecord([])).toBe(true)
      expect(isObjectRecord(null)).toBe(false)
      expect(isObjectRecord('value')).toBe(false)
      expect(isObjectRecord(1)).toBe(false)
      expect(isObjectRecord(() => undefined)).toBe(false)
    })
  })

  describe('isUnsignedDecimalIntegerStringBelow', () => {
    it('should return true only for unsigned decimal integer strings below the upper bound', () => {
      const upperBound = 10n

      expect(isUnsignedDecimalIntegerStringBelow('0', upperBound)).toBe(true)
      expect(isUnsignedDecimalIntegerStringBelow('09', upperBound)).toBe(true)
      expect(isUnsignedDecimalIntegerStringBelow('10', upperBound)).toBe(false)
      expect(isUnsignedDecimalIntegerStringBelow('-1', upperBound)).toBe(false)
      expect(isUnsignedDecimalIntegerStringBelow('0x1', upperBound)).toBe(false)
      expect(isUnsignedDecimalIntegerStringBelow('1.5', upperBound)).toBe(false)
      expect(isUnsignedDecimalIntegerStringBelow(' 1 ', upperBound)).toBe(false)
      expect(isUnsignedDecimalIntegerStringBelow('', upperBound)).toBe(false)
    })
  })

  describe('isPositiveSafeInteger', () => {
    it('should return true only for positive safe integers', () => {
      expect(isPositiveSafeInteger(1)).toBe(true)
      expect(isPositiveSafeInteger(0)).toBe(false)
      expect(isPositiveSafeInteger(1.5)).toBe(false)
      expect(isPositiveSafeInteger(Number.MAX_SAFE_INTEGER + 1)).toBe(false)
    })
  })

  describe('isUint8Integer', () => {
    it('should return true only for integers in the uint8 range', () => {
      expect(isUint8Integer(0)).toBe(true)
      expect(isUint8Integer(255)).toBe(true)
      expect(isUint8Integer(-1)).toBe(false)
      expect(isUint8Integer(256)).toBe(false)
      expect(isUint8Integer(1.5)).toBe(false)
    })
  })

  describe('isStringArrayWithLength', () => {
    it('should return true only for string arrays of the given length', () => {
      expect(isStringArrayWithLength(['', 'a'], 2)).toBe(true)
      expect(isStringArrayWithLength(['a'], 2)).toBe(false)
      expect(isStringArrayWithLength(['a', 1], 2)).toBe(false)
      expect(isStringArrayWithLength('not-array', 2)).toBe(false)
    })
  })
})
