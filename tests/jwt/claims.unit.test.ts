import { describe, expect, it } from 'vitest'
import { decodeEveClaims } from '#src/jwt'
import { tokenWithPayload } from '#tests/jwt/test-tokens'

describe('decodeEveClaims', () => {
  it('should extract all Eve claims when present', () => {
    const token = tokenWithPayload({
      nonce: 'abc123',
      sub: 'user-1',
      aud: 'wallet',
      tier: 'test',
      tenant: 'stillness',
    })

    expect(decodeEveClaims(token)).toEqual({
      nonce: 'abc123',
      sub: 'user-1',
      aud: 'wallet',
      tier: 'test',
      tenant: 'stillness',
    })
  })

  it('should normalize missing claims to empty strings, except nonce', () => {
    const token = tokenWithPayload({ sub: 'user-1' })

    expect(decodeEveClaims(token)).toEqual({
      nonce: undefined,
      sub: 'user-1',
      aud: '',
      tier: '',
      tenant: '',
    })
  })

  it('should normalize non-string claim values', () => {
    const token = tokenWithPayload({
      nonce: 42,
      sub: { nested: true },
      aud: ['a', 'b'],
      tier: 1,
      tenant: null,
    })

    expect(decodeEveClaims(token)).toEqual({
      nonce: undefined,
      sub: '',
      aud: '',
      tier: '',
      tenant: '',
    })
  })

  it('should throw on malformed tokens', () => {
    expect(() => decodeEveClaims('opaque')).toThrow('Invalid JWT')
  })
})
