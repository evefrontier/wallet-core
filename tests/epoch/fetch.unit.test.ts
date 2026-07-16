import { describe, expect, it, vi } from 'vitest'
import {
  CURRENT_EPOCH_QUERY,
  DEFAULT_EPOCH_DURATION_MS,
  fetchEpochFromGraphQL,
  fetchEpochFromLedger,
  fetchEpochFromSystemState,
} from '#src/epoch'

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
})

describe('fetchEpochFromGraphQL', () => {
  function clientWithResult(result: unknown) {
    const query = vi.fn().mockResolvedValue(result)
    return { client: { query } as never, query }
  }

  it('should query the current epoch and derive duration from timestamps', async () => {
    const { client, query } = clientWithResult({
      data: {
        epoch: {
          epochId: 42,
          startTimestamp: new Date(EPOCH_START).toISOString(),
          endTimestamp: new Date(EPOCH_START + 3_600_000).toISOString(),
        },
      },
    })

    await expect(fetchEpochFromGraphQL(client)).resolves.toEqual({
      currentEpoch: 42,
      epochDurationMs: 3_600_000,
      epochStartTimestampMs: EPOCH_START,
    })
    expect(query).toHaveBeenCalledWith({
      query: CURRENT_EPOCH_QUERY,
      variables: {},
    })
  })

  it('should fall back to the default duration when endTimestamp is missing', async () => {
    const { client } = clientWithResult({
      data: {
        epoch: {
          epochId: '42',
          startTimestamp: new Date(EPOCH_START).toISOString(),
        },
      },
    })

    await expect(fetchEpochFromGraphQL(client)).resolves.toEqual({
      currentEpoch: 42,
      epochDurationMs: DEFAULT_EPOCH_DURATION_MS,
      epochStartTimestampMs: EPOCH_START,
    })
  })

  it('should throw when the response carries GraphQL errors', async () => {
    const { client } = clientWithResult({
      errors: [{ message: 'boom' }, { message: 'bang' }],
    })

    await expect(fetchEpochFromGraphQL(client)).rejects.toThrow(
      'GraphQL epoch query failed: boom, bang',
    )
  })

  it('should throw when the response has no epoch data', async () => {
    const { client } = clientWithResult({ data: {} })

    await expect(fetchEpochFromGraphQL(client)).rejects.toThrow(
      'GraphQL epoch query returned no epoch data',
    )
  })
})

describe('fetchEpochFromLedger', () => {
  function clientWithEpoch(epoch: unknown) {
    const getEpoch = vi.fn().mockReturnValue({
      response: Promise.resolve({ epoch }),
    })
    return { client: { ledgerService: { getEpoch } } as never, getEpoch }
  }

  it('should convert protobuf timestamps and derive duration from start/end', async () => {
    const { client } = clientWithEpoch({
      epoch: 7n,
      start: { seconds: BigInt(EPOCH_START / 1_000), nanos: 500_000_000 },
      end: { seconds: BigInt(EPOCH_START / 1_000 + 3_600), nanos: 500_000_000 },
    })

    await expect(fetchEpochFromLedger(client)).resolves.toEqual({
      currentEpoch: 7,
      epochDurationMs: 3_600_000,
      epochStartTimestampMs: EPOCH_START + 500,
    })
  })

  it('should fall back to the default duration when end is missing', async () => {
    const { client } = clientWithEpoch({
      epoch: 7n,
      start: { seconds: BigInt(EPOCH_START / 1_000) },
    })

    await expect(fetchEpochFromLedger(client)).resolves.toEqual({
      currentEpoch: 7,
      epochDurationMs: DEFAULT_EPOCH_DURATION_MS,
      epochStartTimestampMs: EPOCH_START,
    })
  })

  it('should tolerate an entirely empty epoch response', async () => {
    const { client } = clientWithEpoch(undefined)

    await expect(fetchEpochFromLedger(client)).resolves.toEqual({
      currentEpoch: 0,
      epochDurationMs: DEFAULT_EPOCH_DURATION_MS,
      epochStartTimestampMs: 0,
    })
  })
})
