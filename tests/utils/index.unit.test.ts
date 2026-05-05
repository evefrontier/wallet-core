import { describe, expect, it } from 'vitest'
import {
  hasTypedArrayPropertyWithLength,
  hasTypedProperty,
  is3x2ArrayOfStrings,
} from '#src/utils'

describe('Utility Functions', () => {
  describe('hasTypedProperty', () => {
    it('should return true if object has property of specified type', () => {
      const obj = { name: 'Alice', age: 30 }
      expect(hasTypedProperty(obj, 'name', 'string')).toBe(true)
      expect(hasTypedProperty(obj, 'age', 'number')).toBe(true)
    })

    it('should return false if object does not have property of specified type', () => {
      const obj = { name: 'Alice', age: 30 }
      expect(hasTypedProperty(obj, 'name', 'number')).toBe(false)
      expect(hasTypedProperty(obj, 'age', 'string')).toBe(false)
    })
  })

  describe('hasTypedArrayPropertyWithLength', () => {
    it('should return true if object has array property of specified type and length', () => {
      const obj = { numbers: [1, 2, 3] }
      expect(hasTypedArrayPropertyWithLength(obj, 'numbers', 'number', 3)).toBe(
        true,
      )
    })

    it('should return false if object does not have array property of specified type and length', () => {
      const obj = { numbers: [1, 2, 3] }
      expect(hasTypedArrayPropertyWithLength(obj, 'numbers', 'string', 3)).toBe(
        false,
      )
      expect(hasTypedArrayPropertyWithLength(obj, 'numbers', 'number', 2)).toBe(
        false,
      )
    })
  })

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
})
