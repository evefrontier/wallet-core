import { describe, expect, it } from 'vitest'
import { EVEFRONTIER_SPONSORED_TRANSACTION } from '#src/wallet-standard-extensions'

describe('wallet-standard-extensions', () => {
  it('should export the sponsored transaction feature identifier', () => {
    expect(EVEFRONTIER_SPONSORED_TRANSACTION).toBe(
      'evefrontier:sponsoredTransaction',
    )
  })
})
