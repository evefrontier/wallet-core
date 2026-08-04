import { describe, expect, it } from 'vitest'
import { getApiContext, resolveEveTier } from '#src/jwt'
import { tokenWithPayload } from '#tests/jwt/test-tokens'

const HOST_TEMPLATE = 'api.{tier}.example.com'

describe('resolveEveTier', () => {
  it('should default stillness to live', () => {
    expect(resolveEveTier({ tenant: 'stillness', tier: '' })).toBe('live')
  })

  it('should respect an explicit tier for stillness', () => {
    expect(resolveEveTier({ tenant: 'stillness', tier: 'dev' })).toBe('dev')
  })

  it('should force utopia to uat regardless of the tier claim', () => {
    expect(resolveEveTier({ tenant: 'utopia', tier: 'live' })).toBe('uat')
    expect(resolveEveTier({ tenant: 'utopia', tier: '' })).toBe('uat')
  })

  it('should default other tenants to test', () => {
    expect(resolveEveTier({ tenant: 'tauceti', tier: '' })).toBe('test')
    expect(resolveEveTier({ tenant: 'tauceti', tier: 'dev' })).toBe('dev')
  })
})

describe('getApiContext', () => {
  it('should derive the API base URL from the resolved tier', () => {
    const token = tokenWithPayload({
      sub: 'user-1',
      tenant: 'stillness',
      tier: 'test',
    })

    const context = getApiContext(token, { apiHostTemplate: HOST_TEMPLATE })

    expect(context.apiBaseUrl).toBe('https://api.test.example.com')
    expect(context.tenant).toBe('stillness')
    expect(context.tier).toBe('test')
    expect(context.claims.sub).toBe('user-1')
  })

  it('should apply tenant tier policy when the tier claim is absent', () => {
    const token = tokenWithPayload({ tenant: 'stillness' })

    expect(
      getApiContext(token, { apiHostTemplate: HOST_TEMPLATE }).apiBaseUrl,
    ).toBe('https://api.live.example.com')
  })

  it('should reject an unknown tier claim', () => {
    const token = tokenWithPayload({ tenant: 'stillness', tier: 'staging' })

    expect(() =>
      getApiContext(token, { apiHostTemplate: HOST_TEMPLATE }),
    ).toThrow('Invalid tier claim in token')
  })

  it('should reject a host template without a {tier} placeholder', () => {
    const token = tokenWithPayload({ tenant: 'stillness' })

    expect(() =>
      getApiContext(token, { apiHostTemplate: 'api.example.com' }),
    ).toThrow('apiHostTemplate must contain a {tier} placeholder')
  })

  it('should throw on malformed tokens', () => {
    expect(() =>
      getApiContext('opaque', { apiHostTemplate: HOST_TEMPLATE }),
    ).toThrow('Invalid JWT')
  })
})
