import { describe, expect, it, vi } from 'vitest'
import { buildTransactionBytes } from '#src/crypto'

describe('buildTransactionBytes', () => {
  it('should set the sender and build transaction bytes', async () => {
    const bytes = new Uint8Array([1, 2, 3])
    const tx = {
      setSender: vi.fn(),
      setSenderIfNotSet: vi.fn(),
      build: vi.fn().mockResolvedValue(bytes),
    }
    const client = { core: {} }

    await expect(
      buildTransactionBytes(tx as never, '0xsender', client as never),
    ).resolves.toBe(bytes)

    expect(tx.setSender).toHaveBeenCalledWith('0xsender')
    expect(tx.setSenderIfNotSet).not.toHaveBeenCalled()
    expect(tx.build).toHaveBeenCalledWith({ client })
  })

  it('should support setSenderIfNotSet', async () => {
    const tx = {
      setSender: vi.fn(),
      setSenderIfNotSet: vi.fn(),
      build: vi.fn().mockResolvedValue(new Uint8Array([1])),
    }
    const client = { core: {} }

    await buildTransactionBytes(tx as never, '0xsender', client as never, {
      setSenderIfNotSet: true,
    })

    expect(tx.setSender).not.toHaveBeenCalled()
    expect(tx.setSenderIfNotSet).toHaveBeenCalledWith('0xsender')
  })
})
