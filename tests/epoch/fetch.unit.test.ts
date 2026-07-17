import { describe, expect, it, vi } from 'vitest'
import { fetchEpochFromSystemState } from '#src/epoch'

const EPOCH_START = 1_700_000_000_000

describe('fetchEpochFromSystemState', () => {
  it('should map system state string fields to numbers', async () => {
    const getCurrentSystemState = vi.fn().mockResolvedValue({
      systemState: {
        epoch: '123',
        epochStartTimestampMs: `${EPOCH_START}`,
        parameters: { epochDurationMs: '86400000' },
      },
    })
    const client = { core: { getCurrentSystemState } } as never

    await expect(fetchEpochFromSystemState(client)).resolves.toEqual({
      currentEpoch: 123,
      epochDurationMs: 86_400_000,
      epochStartTimestampMs: EPOCH_START,
    })
  })

  it('should throw when a system state field is not numeric', async () => {
    const getCurrentSystemState = vi.fn().mockResolvedValue({
      systemState: {
        epoch: 'not-a-number',
        epochStartTimestampMs: `${EPOCH_START}`,
        parameters: { epochDurationMs: '86400000' },
      },
    })
    const client = { core: { getCurrentSystemState } } as never

    await expect(fetchEpochFromSystemState(client)).rejects.toThrow(
      'System state returned non-numeric epoch fields: epoch=not-a-number',
    )
  })

  it('should throw when a system state field is missing', async () => {
    const getCurrentSystemState = vi.fn().mockResolvedValue({
      systemState: {
        epoch: '123',
        epochStartTimestampMs: undefined,
        parameters: { epochDurationMs: '86400000' },
      },
    })
    const client = { core: { getCurrentSystemState } } as never

    await expect(fetchEpochFromSystemState(client)).rejects.toThrow(
      'System state returned non-numeric epoch fields',
    )
  })
})
