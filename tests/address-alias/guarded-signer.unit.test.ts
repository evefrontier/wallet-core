import { Transaction } from '@mysten/sui/transactions'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AliasEnforcementStatus } from '#src/address-alias'
import {
  AliasEnforcementError,
  createAliasEnforcedSigner,
  createOnChainStatusResolver,
} from '#src/address-alias'

const OWNER = `0x${'a'.repeat(64)}`
const SATISFIED: AliasEnforcementStatus = { satisfied: true }
const UNSATISFIED: AliasEnforcementStatus = {
  satisfied: false,
  reason: 'no-aliases',
}

const BYTES = new Uint8Array([1, 2, 3])

function innerSigner() {
  return {
    sign: vi.fn().mockResolvedValue(new Uint8Array([9])),
    signWithIntent: vi.fn().mockResolvedValue({ signature: 'wi', bytes: 'b' }),
    signTransaction: vi.fn().mockResolvedValue({ signature: 'tx', bytes: 'b' }),
    signPersonalMessage: vi
      .fn()
      .mockResolvedValue({ signature: 'pm', bytes: 'b' }),
    toSuiAddress: vi.fn().mockReturnValue(OWNER),
    getPublicKey: vi.fn().mockReturnValue({ pk: true }),
    getKeyScheme: vi.fn().mockReturnValue('ED25519'),
  }
}

/** Spies `Transaction.from` so decoding yields a single command with the given module. */
function stubDecodedModule(module: string) {
  vi.spyOn(Transaction, 'from').mockReturnValue({
    getData: () => ({ commands: [{ MoveCall: { package: '0x2', module } }] }),
  } as never)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('createAliasEnforcedSigner - signTransaction', () => {
  it('throws AliasEnforcementError when unsatisfied and not an alias-setup tx', async () => {
    stubDecodedModule('coin')
    const inner = innerSigner()
    const signer = createAliasEnforcedSigner({
      signer: inner,
      owner: OWNER,
      resolveStatus: vi.fn().mockResolvedValue(UNSATISFIED),
    })

    await expect(signer.signTransaction(BYTES)).rejects.toBeInstanceOf(
      AliasEnforcementError,
    )
    expect(inner.signTransaction).not.toHaveBeenCalled()
  })

  it('bypasses enforcement for an alias-setup tx even when unsatisfied', async () => {
    stubDecodedModule('address_alias')
    const inner = innerSigner()
    const resolveStatus = vi.fn().mockResolvedValue(UNSATISFIED)
    const signer = createAliasEnforcedSigner({
      signer: inner,
      owner: OWNER,
      resolveStatus,
    })

    await expect(signer.signTransaction(BYTES)).resolves.toEqual({
      signature: 'tx',
      bytes: 'b',
    })
    expect(resolveStatus).not.toHaveBeenCalled()
    expect(inner.signTransaction).toHaveBeenCalledWith(BYTES)
  })

  it('delegates when satisfied', async () => {
    stubDecodedModule('coin')
    const inner = innerSigner()
    const signer = createAliasEnforcedSigner({
      signer: inner,
      owner: OWNER,
      resolveStatus: vi.fn().mockResolvedValue(SATISFIED),
    })

    await expect(signer.signTransaction(BYTES)).resolves.toEqual({
      signature: 'tx',
      bytes: 'b',
    })
    expect(inner.signTransaction).toHaveBeenCalledWith(BYTES)
  })

  it('enforces even an alias-setup tx when the bypass is disabled', async () => {
    stubDecodedModule('address_alias')
    const inner = innerSigner()
    const signer = createAliasEnforcedSigner({
      signer: inner,
      owner: OWNER,
      resolveStatus: vi.fn().mockResolvedValue(UNSATISFIED),
      allowAliasSetupBypass: false,
    })

    await expect(signer.signTransaction(BYTES)).rejects.toBeInstanceOf(
      AliasEnforcementError,
    )
    expect(inner.signTransaction).not.toHaveBeenCalled()
  })
})

describe('createAliasEnforcedSigner - signPersonalMessage', () => {
  it('is not enforced, even when unsatisfied', async () => {
    const inner = innerSigner()
    const resolveStatus = vi.fn().mockResolvedValue(UNSATISFIED)
    const signer = createAliasEnforcedSigner({
      signer: inner,
      owner: OWNER,
      resolveStatus,
    })

    await expect(signer.signPersonalMessage(BYTES)).resolves.toEqual({
      signature: 'pm',
      bytes: 'b',
    })
    expect(resolveStatus).not.toHaveBeenCalled()
    expect(inner.signPersonalMessage).toHaveBeenCalledWith(BYTES)
  })

  it('delegates when satisfied', async () => {
    const inner = innerSigner()
    const signer = createAliasEnforcedSigner({
      signer: inner,
      owner: OWNER,
      resolveStatus: vi.fn().mockResolvedValue(SATISFIED),
    })

    await expect(signer.signPersonalMessage(BYTES)).resolves.toEqual({
      signature: 'pm',
      bytes: 'b',
    })
    expect(inner.signPersonalMessage).toHaveBeenCalledWith(BYTES)
  })
})

describe('createAliasEnforcedSigner - signWithIntent', () => {
  it('never enforces PersonalMessage intent, regardless of status', async () => {
    const inner = innerSigner()
    const resolveStatus = vi.fn().mockResolvedValue(UNSATISFIED)
    const signer = createAliasEnforcedSigner({
      signer: inner,
      owner: OWNER,
      resolveStatus,
    })

    await expect(
      signer.signWithIntent(BYTES, 'PersonalMessage'),
    ).resolves.toEqual({ signature: 'wi', bytes: 'b' })
    expect(resolveStatus).not.toHaveBeenCalled()
    expect(inner.signWithIntent).toHaveBeenCalledWith(BYTES, 'PersonalMessage')
  })

  it('bypasses TransactionData intent for an alias-setup tx', async () => {
    stubDecodedModule('address_alias')
    const inner = innerSigner()
    const signer = createAliasEnforcedSigner({
      signer: inner,
      owner: OWNER,
      resolveStatus: vi.fn().mockResolvedValue(UNSATISFIED),
    })

    await expect(
      signer.signWithIntent(BYTES, 'TransactionData'),
    ).resolves.toEqual({ signature: 'wi', bytes: 'b' })
    expect(inner.signWithIntent).toHaveBeenCalledWith(BYTES, 'TransactionData')
  })
})

describe('createAliasEnforcedSigner - pass-throughs', () => {
  it('delegates non-signing methods to the inner signer', async () => {
    const inner = innerSigner()
    const signer = createAliasEnforcedSigner({
      signer: inner,
      owner: OWNER,
      resolveStatus: vi.fn().mockResolvedValue(SATISFIED),
    })

    expect(signer.toSuiAddress()).toBe(OWNER)
    expect(signer.getPublicKey()).toEqual({ pk: true })
    expect(signer.getKeyScheme()).toBe('ED25519')
    await expect(signer.sign(BYTES)).resolves.toEqual(new Uint8Array([9]))
    expect(inner.sign).toHaveBeenCalledWith(BYTES)
  })
})

describe('createOnChainStatusResolver', () => {
  it('reads on-chain state each call', async () => {
    const listOwnedObjects = vi.fn().mockResolvedValue({
      objects: [
        {
          objectId: '0x1',
          json: { aliases: { contents: [`0x${'c'.repeat(64)}`] } },
        },
      ],
    })
    const client = { core: { listOwnedObjects } } as never
    const resolve = createOnChainStatusResolver(client, OWNER)

    await expect(resolve()).resolves.toEqual({ satisfied: true })
    expect(listOwnedObjects).toHaveBeenCalledTimes(1)
    await resolve()
    expect(listOwnedObjects).toHaveBeenCalledTimes(2)
  })
})
