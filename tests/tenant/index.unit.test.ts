import { describe, expect, it } from 'vitest'
import { DEFAULT_TENANT, TenantId } from '#src/tenant'

describe('tenant', () => {
  it('should use Stillness as the default tenant', () => {
    expect(DEFAULT_TENANT).toBe(TenantId.STILLNESS)
  })
})
