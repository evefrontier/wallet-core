import { describe, expect, it, vi } from 'vitest'
import { getEveCoinType } from '#src/eve-token'
import { TenantId } from '#src/tenant'
import {
  CachedCoinMetadataResolver,
  COIN_METADATA_CACHE_TTL_MS,
  type CoinMetadataLookupClient,
  getKnownCoinMetadata,
  SuiCoinMetadataResolver,
} from '#src/transaction'

function createClient(): CoinMetadataLookupClient {
  return {
    getCoinMetadata: vi.fn(),
  }
}

describe('getKnownCoinMetadata', () => {
  it('returns SUI metadata for normalized SUI coin types', () => {
    expect(
      getKnownCoinMetadata(
        '0x0000000000000000000000000000000000000000000000000000000000000002::sui::SUI',
      ),
    ).toEqual({
      decimals: 9,
      symbol: 'SUI',
      name: 'Sui',
      description: 'Sui Native Token',
      iconUrl: null,
    })
  })

  it('returns EVE metadata for known EVE coin types', () => {
    expect(getKnownCoinMetadata(getEveCoinType(TenantId.STILLNESS))).toEqual({
      decimals: 9,
      symbol: 'EVE',
      name: 'EVE',
      iconUrl: null,
    })
  })

  it('returns null for unknown coin types', () => {
    expect(getKnownCoinMetadata('0x123::usdc::USDC')).toBeNull()
  })
})

describe('CachedCoinMetadataResolver', () => {
  it('resolves SUI without a client lookup', async () => {
    const lookup = vi.fn()
    const resolver = new CachedCoinMetadataResolver(lookup)

    await expect(resolver.resolve('0x2::sui::SUI')).resolves.toEqual({
      decimals: 9,
      symbol: 'SUI',
      name: 'Sui',
      description: 'Sui Native Token',
      iconUrl: null,
    })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('resolves known EVE coin types without a client lookup', async () => {
    const lookup = vi.fn()
    const resolver = new CachedCoinMetadataResolver(lookup)

    await expect(
      resolver.resolve(getEveCoinType(TenantId.STILLNESS)),
    ).resolves.toEqual({
      decimals: 9,
      symbol: 'EVE',
      name: 'EVE',
      iconUrl: null,
    })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('returns lookup metadata with display fields for unknown coin types', async () => {
    const lookup = vi.fn().mockResolvedValue({
      decimals: 6,
      symbol: 'USDC',
      name: 'Usd Coin',
      description: 'A stable coin',
      iconUrl: 'https://example.com/usdc.svg',
    })
    const resolver = new CachedCoinMetadataResolver(lookup)

    await expect(resolver.resolve('0x123::usdc::USDC')).resolves.toEqual({
      decimals: 6,
      symbol: 'USDC',
      name: 'Usd Coin',
      description: 'A stable coin',
      iconUrl: 'https://example.com/usdc.svg',
    })
    expect(lookup).toHaveBeenCalledWith('0x123::usdc::USDC')
  })

  it('caches metadata by coin type', async () => {
    const lookup = vi.fn().mockResolvedValue({
      decimals: 2,
      symbol: 'CACHE',
      name: 'Cached Coin',
    })
    const resolver = new CachedCoinMetadataResolver(lookup)

    await resolver.resolve('0x123::cached::CACHE')
    await resolver.resolve('0x123::cached::CACHE')

    expect(lookup).toHaveBeenCalledTimes(1)
  })

  it('fetches again after the cache ttl expires', async () => {
    let nowMs = 1_000
    const lookup = vi
      .fn()
      .mockResolvedValueOnce({
        decimals: 2,
        symbol: 'OLD',
        name: 'Old Coin',
      })
      .mockResolvedValueOnce({
        decimals: 3,
        symbol: 'NEW',
        name: 'New Coin',
      })
    const resolver = new CachedCoinMetadataResolver(lookup, {
      nowMs: () => nowMs,
    })

    await expect(resolver.resolve('0x123::ttl::TTL')).resolves.toEqual({
      decimals: 2,
      symbol: 'OLD',
      name: 'Old Coin',
    })
    nowMs += COIN_METADATA_CACHE_TTL_MS
    await expect(resolver.resolve('0x123::ttl::TTL')).resolves.toEqual({
      decimals: 3,
      symbol: 'NEW',
      name: 'New Coin',
    })
    expect(lookup).toHaveBeenCalledTimes(2)
  })

  it('clearCache makes every cached coin type fetch again', async () => {
    const lookup = vi.fn().mockResolvedValue({
      decimals: 2,
      symbol: 'CACHE',
      name: 'Cached Coin',
    })
    const resolver = new CachedCoinMetadataResolver(lookup)

    await resolver.resolve('0x123::cached-a::CACHE_A')
    await resolver.resolve('0x123::cached-b::CACHE_B')
    resolver.clearCache()
    await resolver.resolve('0x123::cached-a::CACHE_A')

    expect(lookup).toHaveBeenCalledTimes(3)
  })

  it('clearCache with a coin type makes only that coin type fetch again', async () => {
    const lookup = vi.fn().mockResolvedValue({
      decimals: 2,
      symbol: 'CACHE',
      name: 'Cached Coin',
    })
    const resolver = new CachedCoinMetadataResolver(lookup)

    await resolver.resolve('0x123::cached-a::CACHE_A')
    await resolver.resolve('0x123::cached-b::CACHE_B')
    resolver.clearCache('0x123::cached-a::CACHE_A')
    await resolver.resolve('0x123::cached-a::CACHE_A')
    await resolver.resolve('0x123::cached-b::CACHE_B')

    expect(lookup).toHaveBeenCalledTimes(3)
  })

  it('does not cache rejected lookups', async () => {
    const lookup = vi
      .fn()
      .mockRejectedValueOnce(new Error('fullnode unavailable'))
      .mockResolvedValueOnce({
        decimals: 3,
        symbol: 'RETRY',
        name: 'Retry Coin',
      })
    const resolver = new CachedCoinMetadataResolver(lookup)

    await expect(resolver.resolve('0x123::retry::RETRY')).resolves.toBeNull()
    await expect(resolver.resolve('0x123::retry::RETRY')).resolves.toEqual({
      decimals: 3,
      symbol: 'RETRY',
      name: 'Retry Coin',
    })
    expect(lookup).toHaveBeenCalledTimes(2)
  })
})

describe('SuiCoinMetadataResolver', () => {
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
      description: 'A stable coin',
      iconUrl: 'https://example.com/usdc.svg',
    })
    expect(client.getCoinMetadata).toHaveBeenCalledWith({
      coinType: '0x123::usdc::USDC',
    })
  })
})
