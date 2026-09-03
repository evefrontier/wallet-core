import { normalizeStructTag } from '@mysten/sui/utils'

export const SUI_COIN_TYPE = '0x2::sui::SUI'

export function isSameCoinType(a: string, b: string): boolean {
  if (a === b) {
    return true
  }

  try {
    return normalizeStructTag(a) === normalizeStructTag(b)
  } catch {
    return false
  }
}

export function isSuiCoinType(coinType: string): boolean {
  return isSameCoinType(coinType, SUI_COIN_TYPE)
}
