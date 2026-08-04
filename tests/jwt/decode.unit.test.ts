import { describe, expect, it } from 'vitest'
import { decodeJwtPayload, decodeJwtPayloadSafely } from '#src/jwt'
import { tokenWithPayload } from '#tests/jwt/test-tokens'

describe('decodeJwtPayload', () => {
  it('should decode the payload segment as JSON', () => {
    const token = tokenWithPayload({ sub: 'user-1', exp: 123 })

    expect(decodeJwtPayload(token)).toEqual({ sub: 'user-1', exp: 123 })
  })

  it('should decode base64url characters and UTF-8 content', () => {
    // '~~~?' base64-encodes with '+' and '/' in standard base64; the
    // snowman exercises multi-byte UTF-8 decoding.
    const payload = { name: '~~~?☃', aud: 'a?b>c' }
    const token = tokenWithPayload(payload)

    expect(decodeJwtPayload(token)).toEqual(payload)
  })

  it('should reject tokens without three segments', () => {
    expect(() => decodeJwtPayload('not-a-jwt')).toThrow(
      'Invalid JWT: expected three dot-separated segments',
    )
    expect(() => decodeJwtPayload('one.two')).toThrow(
      'Invalid JWT: expected three dot-separated segments',
    )
    expect(() => decodeJwtPayload('a..c')).toThrow(
      'Invalid JWT: expected three dot-separated segments',
    )
  })

  it('should reject payloads that are not base64url JSON', () => {
    expect(() => decodeJwtPayload('a.!!!.c')).toThrow(
      'Invalid JWT: payload is not base64url-encoded JSON',
    )
  })

  it('should reject payloads that are not JSON objects', () => {
    expect(() => decodeJwtPayload(tokenWithPayload('a string'))).toThrow(
      'Invalid JWT: payload is not a JSON object',
    )
    expect(() => decodeJwtPayload(tokenWithPayload(null))).toThrow(
      'Invalid JWT: payload is not a JSON object',
    )
  })
})

describe('decodeJwtPayloadSafely', () => {
  it('should decode a valid token', () => {
    expect(decodeJwtPayloadSafely(tokenWithPayload({ sub: 'x' }))).toEqual({
      sub: 'x',
    })
  })

  it('should return null for absent, opaque, or malformed tokens', () => {
    expect(decodeJwtPayloadSafely(undefined)).toBeNull()
    expect(decodeJwtPayloadSafely('')).toBeNull()
    expect(decodeJwtPayloadSafely('opaque-access-token')).toBeNull()
    expect(decodeJwtPayloadSafely('a.!!!.c')).toBeNull()
  })
})
