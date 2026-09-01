import { SUI_DECIMALS } from '@mysten/sui/utils'

/**
 * Formats a raw token amount by its decimals into a human-readable string.
 *
 * @param amount - The raw token amount as a string
 * @param decimals - The number of decimal places
 * @returns Formatted balance string with appropriate decimal places
 *
 * @example
 * formatByDecimals("1000000000", 9) // Returns "1"
 * formatByDecimals("1500000000", 9) // Returns "1.5"
 * formatByDecimals("1234567890", 9) // Returns "1.23456789"
 */
export function formatByDecimals(amount: string, decimals: number): string {
  const divisor = 10n ** BigInt(decimals)
  const value = BigInt(amount)
  // Operate on the magnitude so the sign is applied once at the end; splitting a
  // negative value into integer/fraction otherwise yields garbage like "-1.-5".
  const negative = value < 0n
  const abs = negative ? -value : value
  const sign = negative ? '-' : ''
  const integer = abs / divisor
  const fraction = abs % divisor

  if (fraction === 0n) {
    return `${sign}${integer.toString()}`
  }

  const fractionStr = fraction
    .toString()
    .padStart(decimals, '0')
    .replace(/0+$/, '')

  return `${sign}${integer.toString()}.${fractionStr}`
}

/**
 * Formats MIST (Sui's smallest unit) as a human-readable SUI string.
 *
 * @param mist - Amount in MIST (string or bigint)
 * @returns Formatted SUI amount, e.g. "0.001"
 */
export function formatMistToSui(mist: string | bigint): string {
  const s = typeof mist === 'bigint' ? mist.toString() : mist
  return formatByDecimals(s, SUI_DECIMALS)
}
