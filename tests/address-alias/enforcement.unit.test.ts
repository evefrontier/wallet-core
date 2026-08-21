import { normalizeSuiAddress } from '@mysten/sui/utils'
import { describe, expect, it, vi } from 'vitest'
import type { AddressAliasesInfo } from '#src/address-alias'
import {
  AliasEnforcementError,
  checkAliasEnforcement,
  evaluateAliasEnforcement,
  hasEnforceableAlias,
} from '#src/address-alias'

const OWNER = `0x${'a'.repeat(64)}`
const ALIAS = `0x${'c'.repeat(64)}`

function info(overrides: Partial<AddressAliasesInfo>): AddressAliasesInfo {
  return { enabled: true, addressAliases: [], ...overrides }
}

describe('evaluateAliasEnforcement', () => {
  it('is not satisfied when aliases are not enabled', () => {
    expect(evaluateAliasEnforcement(info({ enabled: false }), OWNER)).toEqual({
      satisfied: false,
      reason: 'no-aliases-object',
    })
  })

  it('is not satisfied when the alias list is empty', () => {
    expect(
      evaluateAliasEnforcement(info({ addressAliases: [] }), OWNER),
    ).toEqual({ satisfied: false, reason: 'no-aliases' })
  })

  it('is not satisfied when the only alias is the owner itself', () => {
    expect(
      evaluateAliasEnforcement(info({ addressAliases: [OWNER] }), OWNER),
    ).toEqual({ satisfied: false, reason: 'only-self-alias' })
  })

  it('is satisfied when a distinct alias exists', () => {
    expect(
      evaluateAliasEnforcement(info({ addressAliases: [ALIAS] }), OWNER),
    ).toEqual({ satisfied: true })
  })

  it('is satisfied when both self and a distinct alias are present', () => {
    expect(
      evaluateAliasEnforcement(info({ addressAliases: [OWNER, ALIAS] }), OWNER),
    ).toEqual({ satisfied: true })
  })

  it('normalizes addresses before comparing', () => {
    // Short-form / unpadded owner vs. full-form self alias must count as self.
    const shortOwner = '0x2'
    const fullSelf = normalizeSuiAddress('0x2')
    expect(
      evaluateAliasEnforcement(
        info({ addressAliases: [fullSelf] }),
        shortOwner,
      ),
    ).toEqual({ satisfied: false, reason: 'only-self-alias' })
  })
})

describe('hasEnforceableAlias', () => {
  it('returns true only when a distinct alias exists', () => {
    expect(hasEnforceableAlias(info({ addressAliases: [ALIAS] }), OWNER)).toBe(
      true,
    )
    expect(hasEnforceableAlias(info({ addressAliases: [OWNER] }), OWNER)).toBe(
      false,
    )
  })
})

describe('checkAliasEnforcement', () => {
  function clientWithObjects(objects: unknown[]) {
    const listOwnedObjects = vi.fn().mockResolvedValue({ objects })
    return { client: { core: { listOwnedObjects } } as never }
  }

  it('reads on-chain aliases and evaluates the policy', async () => {
    const { client } = clientWithObjects([
      { objectId: '0x1', json: { aliases: { contents: [ALIAS] } } },
    ])
    await expect(checkAliasEnforcement(client, OWNER)).resolves.toEqual({
      satisfied: true,
    })
  })

  it('is not satisfied when no aliases object exists', async () => {
    const { client } = clientWithObjects([])
    await expect(checkAliasEnforcement(client, OWNER)).resolves.toEqual({
      satisfied: false,
      reason: 'no-aliases-object',
    })
  })
})

describe('AliasEnforcementError', () => {
  it('carries the owner, coded reason, and status', () => {
    const status = { satisfied: false, reason: 'only-self-alias' } as const
    const error = new AliasEnforcementError(OWNER, status)
    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('alias_enforcement_required')
    expect(error.owner).toBe(OWNER)
    expect(error.status).toEqual(status)
    expect(error.message).toContain('only-self-alias')
  })
})
