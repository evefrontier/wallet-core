import { Transaction } from '@mysten/sui/transactions'
import { normalizeSuiAddress } from '@mysten/sui/utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  ADDRESS_ALIAS_STATE,
  addAddressAliasTx,
  addAddressAliasTxBytes,
  DEFAULT_ADDRESS_ALIAS_GAS_BUDGET,
  enableAddressAliasTx,
  executeAddressAliasTx,
  removeAddressAliasTx,
} from '#src/address-alias'

const SENDER = `0x${'a'.repeat(64)}`
const ALIASES_OBJECT_ID = `0x${'b'.repeat(64)}`
const ALIAS = `0x${'c'.repeat(64)}`

function getMoveCall(tx: Transaction) {
  const data = tx.getData()
  expect(data.commands).toHaveLength(1)
  const moveCall = data.commands[0]?.MoveCall
  expect(moveCall).toBeDefined()
  return { data, moveCall: moveCall as NonNullable<typeof moveCall> }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('enableAddressAliasTx', () => {
  it('should call 0x2::address_alias::enable with the shared state object', () => {
    const tx = enableAddressAliasTx(SENDER)
    const { data, moveCall } = getMoveCall(tx)

    expect(moveCall.package).toBe(normalizeSuiAddress('0x2'))
    expect(moveCall.module).toBe('address_alias')
    expect(moveCall.function).toBe('enable')
    expect(data.inputs).toHaveLength(1)
    expect(data.inputs[0]?.UnresolvedObject?.objectId).toBe(
      normalizeSuiAddress(ADDRESS_ALIAS_STATE),
    )
    expect(data.sender).toBe(SENDER)
    expect(data.gasData.budget).toBe(String(DEFAULT_ADDRESS_ALIAS_GAS_BUDGET))
  })

  it('should use the gas budget override when provided', () => {
    const tx = enableAddressAliasTx(SENDER, 123_456)

    expect(tx.getData().gasData.budget).toBe(String(123_456))
  })
})

describe('addAddressAliasTx', () => {
  it('should call 0x2::address_alias::add with the aliases object and alias', () => {
    const tx = addAddressAliasTx(SENDER, ALIASES_OBJECT_ID, ALIAS)
    const { data, moveCall } = getMoveCall(tx)

    expect(moveCall.package).toBe(normalizeSuiAddress('0x2'))
    expect(moveCall.module).toBe('address_alias')
    expect(moveCall.function).toBe('add')
    expect(data.inputs[0]?.UnresolvedObject?.objectId).toBe(ALIASES_OBJECT_ID)
    expect(data.inputs[1]?.Pure).toBeDefined()
    expect(data.sender).toBe(SENDER)
    expect(data.gasData.budget).toBe(String(DEFAULT_ADDRESS_ALIAS_GAS_BUDGET))
  })

  it('should use the gas budget override when provided', () => {
    const tx = addAddressAliasTx(SENDER, ALIASES_OBJECT_ID, ALIAS, 123_456)

    expect(tx.getData().gasData.budget).toBe(String(123_456))
  })
})

describe('removeAddressAliasTx', () => {
  it('should call 0x2::address_alias::remove with the aliases object and alias', () => {
    const tx = removeAddressAliasTx(SENDER, ALIASES_OBJECT_ID, ALIAS)
    const { moveCall } = getMoveCall(tx)

    expect(moveCall.function).toBe('remove')
  })
})

describe('addAddressAliasTxBytes', () => {
  it('should build the transaction against the provided client', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const build = vi
      .spyOn(Transaction.prototype, 'build')
      .mockResolvedValue(bytes)
    const client = { core: {} }

    await expect(
      addAddressAliasTxBytes(SENDER, ALIASES_OBJECT_ID, ALIAS, client as never),
    ).resolves.toEqual(bytes)

    expect(build).toHaveBeenCalledWith({ client })
  })
})

describe('executeAddressAliasTx', () => {
  const txBytes = new Uint8Array([9, 9, 9])
  const signer = {
    signTransaction: vi.fn().mockResolvedValue({ signature: 'sig' }),
  }
  const buildBytes = vi.fn().mockResolvedValue(txBytes)

  function clientExecuting(result: unknown) {
    const executeTransaction = vi.fn().mockResolvedValue(result)
    return {
      client: { core: { executeTransaction } } as never,
      executeTransaction,
    }
  }

  it('should build, sign, execute, and return the digest', async () => {
    const { client, executeTransaction } = clientExecuting({
      $kind: 'Transaction',
      Transaction: { digest: 'digest123' },
    })

    await expect(
      executeAddressAliasTx({
        suiClient: client,
        sender: SENDER,
        signer,
        buildBytes,
      }),
    ).resolves.toBe('digest123')

    expect(buildBytes).toHaveBeenCalledWith(SENDER, client)
    expect(signer.signTransaction).toHaveBeenCalledWith(txBytes)
    expect(executeTransaction).toHaveBeenCalledWith({
      transaction: txBytes,
      signatures: ['sig'],
    })
  })

  it('should throw when the transaction fails on chain', async () => {
    const { client } = clientExecuting({
      $kind: 'FailedTransaction',
      FailedTransaction: { digest: 'digest456' },
    })

    await expect(
      executeAddressAliasTx({
        suiClient: client,
        sender: SENDER,
        signer,
        buildBytes,
      }),
    ).rejects.toThrow('Address alias transaction failed: digest456')
  })
})
