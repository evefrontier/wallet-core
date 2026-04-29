import { describe, expect, it } from 'vitest'
import { Uint8ArrayFromBase64, Uint8ArrayFromHex } from '#tests/utils'

describe('Uint8ArrayFromBase64', () => {
  it('should convert base64 string to Uint8Array correctly', () => {
    const base64 = 'SGVsbG8gV29ybGQh' // "Hello World!" in base64
    const expected = new Uint8Array([
      72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
    ])
    const result = Uint8ArrayFromBase64(base64)
    expect(result).toEqual(expected)
  })
})

describe('Uint8ArrayFromHex', () => {
  it('should convert hex string to Uint8Array correctly', () => {
    const hex = '48656c6c6f20576f726c6421' // "Hello World!" in hex
    const expected = new Uint8Array([
      72, 101, 108, 108, 111, 32, 87, 111, 114, 108, 100, 33,
    ])
    const result = Uint8ArrayFromHex(hex)
    expect(result).toEqual(expected)
  })

  it('should throw an error for invalid hex string', () => {
    const invalidHex = '123' // Odd length
    expect(() => Uint8ArrayFromHex(invalidHex)).toThrow('Invalid hex string')
  })
})
