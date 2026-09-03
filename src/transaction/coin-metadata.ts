import type { SuiClientTypes } from '@mysten/sui/client'
import { SUI_DECIMALS } from '@mysten/sui/utils'
import { isSuiCoinType } from '#src/coin-types'
import { isEveCoinType } from '#src/eve-token'
import type { CoinMetadata } from './simulate'

export const COIN_METADATA_CACHE_TTL_MS = 30 * 60 * 1000

export interface ResolvedCoinMetadata extends CoinMetadata {
  description?: string | null
  iconUrl?: string | null
}

export interface CoinMetadataLookupClient {
  getCoinMetadata(options: {
    coinType: string
  }): Promise<{ coinMetadata: SuiClientTypes.CoinMetadata | null }>
}

export type CoinMetadataLookup = (
  coinType: string,
) => Promise<ResolvedCoinMetadata | null>

export type ResolvedCoinMetadataResolver = (
  coinType: string,
) => Promise<ResolvedCoinMetadata | null>

interface CoinMetadataCacheEntry {
  metadata: Promise<ResolvedCoinMetadata | null>
  timestampMs: number
}

export interface CachedCoinMetadataResolverOptions {
  ttlMs?: number
  nowMs?: () => number
}

export function getKnownCoinMetadata(
  coinType: string,
): ResolvedCoinMetadata | null {
  if (isSuiCoinType(coinType)) {
    return {
      decimals: SUI_DECIMALS,
      symbol: 'SUI',
      name: 'Sui',
      description: 'Sui Native Token',
      iconUrl: null,
    }
  }

  if (isEveCoinType(coinType)) {
    return { decimals: 9, symbol: 'EVE', name: 'EVE', iconUrl: null }
  }

  return null
}

export class CachedCoinMetadataResolver {
  readonly resolve: ResolvedCoinMetadataResolver = async (coinType) => {
    const cached = this.cache.get(coinType)
    if (cached && this.nowMs() - cached.timestampMs < this.ttlMs) {
      return cached.metadata
    }

    if (cached) {
      this.cache.delete(coinType)
    }

    const resolved = this.resolveUncached(coinType).then((metadata) => {
      if (!metadata) {
        this.cache.delete(coinType)
      }

      return metadata
    })
    this.cache.set(coinType, {
      metadata: resolved,
      timestampMs: this.nowMs(),
    })
    return resolved
  }

  private readonly cache = new Map<string, CoinMetadataCacheEntry>()
  private readonly ttlMs: number
  private readonly nowMs: () => number

  constructor(
    private readonly lookup: CoinMetadataLookup,
    options: CachedCoinMetadataResolverOptions = {},
  ) {
    this.ttlMs = options.ttlMs ?? COIN_METADATA_CACHE_TTL_MS
    this.nowMs = options.nowMs ?? Date.now
  }

  clearCache(coinType?: string): void {
    if (coinType) {
      this.cache.delete(coinType)
      return
    }

    this.cache.clear()
  }

  private async resolveUncached(
    coinType: string,
  ): Promise<ResolvedCoinMetadata | null> {
    const known = getKnownCoinMetadata(coinType)
    if (known) {
      return known
    }

    try {
      return await this.lookup(coinType)
    } catch {
      this.cache.delete(coinType)
      return null
    }
  }
}

export class SuiCoinMetadataResolver extends CachedCoinMetadataResolver {
  constructor(suiClient: CoinMetadataLookupClient) {
    super(async (coinType) => {
      const { coinMetadata } = await suiClient.getCoinMetadata({ coinType })

      return coinMetadata
        ? {
            decimals: coinMetadata.decimals,
            symbol: coinMetadata.symbol,
            name: coinMetadata.name,
            description: coinMetadata.description,
            iconUrl: coinMetadata.iconUrl,
          }
        : null
    })
  }
}
