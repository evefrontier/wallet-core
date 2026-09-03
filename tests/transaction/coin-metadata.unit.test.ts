import { describe, expect, it, vi } from 'vitest'
import { getEveCoinType } from '#src/eve-token'
import { TenantId } from '#src/tenant'
import {
  type CoinMetadataLookupClient,
  createCoinMetadataResolver,
  SuiCoinMetadataResolver,
} from '#src/transaction'

function createClient(): CoinMetadataLookupClient {
  return {
    getCoinMetadata: vi.fn(),
  }
}

describe('SuiCoinMetadataResolver', () => {
  it('resolves SUI without a client lookup', async () => {
    const client = createClient()
    const resolver = new SuiCoinMetadataResolver(client)

    await expect(resolver.resolve('0x2::sui::SUI')).resolves.toEqual({
      decimals: 9,
      symbol: 'SUI',
      name: 'Sui',
    })
    expect(client.getCoinMetadata).not.toHaveBeenCalled()
  })

  it('resolves known EVE coin types without a client lookup', async () => {
    const client = createClient()
    const resolver = new SuiCoinMetadataResolver(client)

    await expect(
      resolver.resolve(getEveCoinType(TenantId.STILLNESS)),
    ).resolves.toEqual({ decimals: 9, symbol: 'EVE', name: 'EVE' })
    expect(client.getCoinMetadata).not.toHaveBeenCalled()
  })

  it('maps chain metadata to wallet-core metadata', async () => {
    const client = createClient()
    vi.mocked(client.getCoinMetadata).mockResolvedValue({
      coinMetadata: {
        id: '0xmetadata',
        decimals: 6,
        name: 'Usd Coin',
        symbol: 'USDC',
        description: 'A stable coin',
        iconUrl: 'https://example.com/usdc.svg',
      },
    })
    const resolver = new SuiCoinMetadataResolver(client)

    await expect(resolver.resolve('0x123::usdc::USDC')).resolves.toEqual({
      decimals: 6,
      symbol: 'USDC',
      name: 'Usd Coin',
    })
    expect(client.getCoinMetadata).toHaveBeenCalledWith({
      coinType: '0x123::usdc::USDC',
    })
  })

  it('caches metadata by coin type', async () => {
    const client = createClient()
    vi.mocked(client.getCoinMetadata).mockResolvedValue({
      coinMetadata: {
        id: '0xmetadata',
        decimals: 2,
        name: 'Cached Coin',
        symbol: 'CACHE',
        description: '',
        iconUrl: null,
      },
    })
    const resolver = new SuiCoinMetadataResolver(client)

    await resolver.resolve('0x123::cached::CACHE')
    await resolver.resolve('0x123::cached::CACHE')

    expect(client.getCoinMetadata).toHaveBeenCalledTimes(1)
  })

  it('clearCache makes the next lookup fetch again', async () => {
    const client = createClient()
    vi.mocked(client.getCoinMetadata).mockResolvedValue({
      coinMetadata: {
        id: '0xmetadata',
        decimals: 2,
        name: 'Cached Coin',
        symbol: 'CACHE',
        description: '',
        iconUrl: null,
      },
    })
    const resolver = new SuiCoinMetadataResolver(client)

    await resolver.resolve('0x123::cached::CACHE')
    resolver.clearCache()
    await resolver.resolve('0x123::cached::CACHE')

    expect(client.getCoinMetadata).toHaveBeenCalledTimes(2)
  })

  it('does not cache rejected lookups', async () => {
    const client = createClient()
    vi.mocked(client.getCoinMetadata)
      .mockRejectedValueOnce(new Error('fullnode unavailable'))
      .mockResolvedValueOnce({
        coinMetadata: {
          id: '0xmetadata',
          decimals: 3,
          name: 'Retry Coin',
          symbol: 'RETRY',
          description: '',
          iconUrl: null,
        },
      })
    const resolver = new SuiCoinMetadataResolver(client)

    await expect(resolver.resolve('0x123::retry::RETRY')).resolves.toBeNull()
    await expect(resolver.resolve('0x123::retry::RETRY')).resolves.toEqual({
      decimals: 3,
      symbol: 'RETRY',
      name: 'Retry Coin',
    })
    expect(client.getCoinMetadata).toHaveBeenCalledTimes(2)
  })
})

describe('createCoinMetadataResolver', () => {
  it('returns the resolver function for a cached resolver instance', async () => {
    const client = createClient()
    vi.mocked(client.getCoinMetadata).mockResolvedValue({ coinMetadata: null })
    const resolveCoinMetadata = createCoinMetadataResolver(client)

    await expect(
      resolveCoinMetadata('0x123::unknown::UNKNOWN'),
    ).resolves.toBeNull()
    await resolveCoinMetadata('0x123::unknown::UNKNOWN')

    expect(client.getCoinMetadata).toHaveBeenCalledTimes(1)
  })
})
