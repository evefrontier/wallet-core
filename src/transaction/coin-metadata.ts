import type { SuiClientTypes } from '@mysten/sui/client'
import { SUI_DECIMALS } from '@mysten/sui/utils'
import { isEveCoinType } from '#src/eve-token'
import {
  type CoinMetadata,
  type CoinMetadataResolver,
  SUI_COIN_TYPE,
} from './simulate'

export interface CoinMetadataLookupClient {
  getCoinMetadata(options: {
    coinType: string
  }): Promise<{ coinMetadata: SuiClientTypes.CoinMetadata | null }>
}

export class SuiCoinMetadataResolver {
  readonly resolve: CoinMetadataResolver = async (coinType) => {
    const cached = this.cache.get(coinType)
    if (cached) {
      return cached
    }

    const resolved = this.resolveUncached(coinType)
    this.cache.set(coinType, resolved)
    return resolved
  }

  private readonly cache = new Map<string, Promise<CoinMetadata | null>>()

  constructor(private readonly suiClient: CoinMetadataLookupClient) {}

  clearCache(): void {
    this.cache.clear()
  }

  private async resolveUncached(
    coinType: string,
  ): Promise<CoinMetadata | null> {
    if (coinType === SUI_COIN_TYPE) {
      return { decimals: SUI_DECIMALS, symbol: 'SUI', name: 'Sui' }
    }

    if (isEveCoinType(coinType)) {
      return { decimals: 9, symbol: 'EVE', name: 'EVE' }
    }

    try {
      const { coinMetadata } = await this.suiClient.getCoinMetadata({
        coinType,
      })

      return coinMetadata
        ? {
            decimals: coinMetadata.decimals,
            symbol: coinMetadata.symbol,
            name: coinMetadata.name,
          }
        : null
    } catch {
      this.cache.delete(coinType)
      return null
    }
  }
}

export function createCoinMetadataResolver(
  suiClient: CoinMetadataLookupClient,
): CoinMetadataResolver {
  return new SuiCoinMetadataResolver(suiClient).resolve
}
