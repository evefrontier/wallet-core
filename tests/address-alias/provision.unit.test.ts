import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction } from '@mysten/sui/transactions'
import { isValidSuiAddress } from '@mysten/sui/utils'
import { validateMnemonic } from '@scure/bip39'
import { wordlist } from '@scure/bip39/wordlists/english.js'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AliasAcknowledgementRequiredError,
  generateAliasKey,
  registerAcknowledgedAlias,
} from '#src/address-alias'

const OWNER = `0x${'a'.repeat(64)}`
const OBJECT_ID = `0x${'b'.repeat(64)}`
const ALIAS = `0x${'c'.repeat(64)}`

afterEach(() => {
  vi.restoreAllMocks()
})

describe('generateAliasKey', () => {
  it('returns a valid mnemonic, private key, and address that all agree', () => {
    const key = generateAliasKey()

    expect(validateMnemonic(key.mnemonic, wordlist)).toBe(true)
    expect(key.mnemonic.trim().split(/\s+/)).toHaveLength(24)
    expect(key.privateKey.startsWith('suiprivkey1')).toBe(true)
    expect(isValidSuiAddress(key.address)).toBe(true)

    // The address must derive identically from both representations.
    expect(Ed25519Keypair.deriveKeypair(key.mnemonic).toSuiAddress()).toBe(
      key.address,
    )
    expect(Ed25519Keypair.fromSecretKey(key.privateKey).toSuiAddress()).toBe(
      key.address,
    )
  })

  it('returns a fresh key each call', () => {
    expect(generateAliasKey().address).not.toBe(generateAliasKey().address)
  })
})

describe('registerAcknowledgedAlias', () => {
  function signer() {
    return { signTransaction: vi.fn().mockResolvedValue({ signature: 'sig' }) }
  }

  function successResult(digest: string) {
    return { $kind: 'Transaction', Transaction: { digest } }
  }

  const ALIASES_TYPE = '0x2::address_alias::AddressAliases'

  /** An enable result whose effects surface the minted AddressAliases object. */
  function enableResultWithEffects(digest: string, objectId: string) {
    return {
      $kind: 'Transaction',
      Transaction: {
        digest,
        effects: {
          changedObjects: [{ objectId, idOperation: 'Created' }],
        },
        objectTypes: { [objectId]: ALIASES_TYPE },
      },
    }
  }

  it('throws without acknowledgement and does not touch the chain', async () => {
    const executeTransaction = vi.fn()
    const listOwnedObjects = vi.fn()
    await expect(
      registerAcknowledgedAlias({
        suiClient: { core: { executeTransaction, listOwnedObjects } } as never,
        owner: OWNER,
        signer: signer(),
        aliasAddress: ALIAS,
        acknowledged: false,
      }),
    ).rejects.toBeInstanceOf(AliasAcknowledgementRequiredError)
    expect(executeTransaction).not.toHaveBeenCalled()
    expect(listOwnedObjects).not.toHaveBeenCalled()
  })

  it('surfaces validation errors (duplicate alias)', async () => {
    const executeTransaction = vi.fn()
    await expect(
      registerAcknowledgedAlias({
        suiClient: { core: { executeTransaction } } as never,
        owner: OWNER,
        signer: signer(),
        aliasAddress: ALIAS,
        acknowledged: true,
        info: { enabled: true, objectId: OBJECT_ID, addressAliases: [ALIAS] },
      }),
    ).rejects.toThrow('already an address alias')
    expect(executeTransaction).not.toHaveBeenCalled()
  })

  it('adds only when aliases are already enabled', async () => {
    vi.spyOn(Transaction.prototype, 'build').mockResolvedValue(
      new Uint8Array([1]),
    )
    const executeTransaction = vi
      .fn()
      .mockResolvedValueOnce(successResult('add-digest'))
    const suiClient = { core: { executeTransaction } } as never

    await expect(
      registerAcknowledgedAlias({
        suiClient,
        owner: OWNER,
        signer: signer(),
        aliasAddress: ALIAS,
        acknowledged: true,
        info: { enabled: true, objectId: OBJECT_ID, addressAliases: [] },
      }),
    ).resolves.toEqual({ addDigest: 'add-digest' })
    expect(executeTransaction).toHaveBeenCalledTimes(1)
  })

  it('enables, resolves the object id from effects, then adds', async () => {
    vi.spyOn(Transaction.prototype, 'build').mockResolvedValue(
      new Uint8Array([1]),
    )
    const executeTransaction = vi
      .fn()
      .mockResolvedValueOnce(
        enableResultWithEffects('enable-digest', OBJECT_ID),
      )
      .mockResolvedValueOnce(successResult('add-digest'))
    // Only the initial read runs; the object id comes from the enable effects,
    // so no post-enable re-read is needed.
    const listOwnedObjects = vi.fn().mockResolvedValueOnce({ objects: [] })
    const waitForTransaction = vi.fn().mockResolvedValue(undefined)
    const suiClient = {
      core: { executeTransaction, listOwnedObjects, waitForTransaction },
    } as never

    await expect(
      registerAcknowledgedAlias({
        suiClient,
        owner: OWNER,
        signer: signer(),
        aliasAddress: ALIAS,
        acknowledged: true,
      }),
    ).resolves.toEqual({
      enableDigest: 'enable-digest',
      addDigest: 'add-digest',
    })
    expect(executeTransaction).toHaveBeenCalledTimes(2)
    expect(waitForTransaction).toHaveBeenCalledWith({ digest: 'enable-digest' })
    expect(listOwnedObjects).toHaveBeenCalledTimes(1)
  })

  it('falls back to a re-read when effects omit the object id', async () => {
    vi.spyOn(Transaction.prototype, 'build').mockResolvedValue(
      new Uint8Array([1]),
    )
    // Enable result carries no effects, so the id cannot be read from it.
    const executeTransaction = vi
      .fn()
      .mockResolvedValueOnce(successResult('enable-digest'))
      .mockResolvedValueOnce(successResult('add-digest'))
    // First read (implicit, info omitted): not enabled. Second read (fallback
    // after waiting): enabled with an object id.
    const listOwnedObjects = vi
      .fn()
      .mockResolvedValueOnce({ objects: [] })
      .mockResolvedValueOnce({
        objects: [{ objectId: OBJECT_ID, json: { aliases: { contents: [] } } }],
      })
    const waitForTransaction = vi.fn().mockResolvedValue(undefined)
    const suiClient = {
      core: { executeTransaction, listOwnedObjects, waitForTransaction },
    } as never

    await expect(
      registerAcknowledgedAlias({
        suiClient,
        owner: OWNER,
        signer: signer(),
        aliasAddress: ALIAS,
        acknowledged: true,
      }),
    ).resolves.toEqual({
      enableDigest: 'enable-digest',
      addDigest: 'add-digest',
    })
    expect(executeTransaction).toHaveBeenCalledTimes(2)
    expect(waitForTransaction).toHaveBeenCalledWith({ digest: 'enable-digest' })
    expect(listOwnedObjects).toHaveBeenCalledTimes(2)
  })
})
