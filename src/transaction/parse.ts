import { Transaction } from '@mysten/sui/transactions'
import { fromBase64, toBase64 } from '@mysten/sui/utils'

export type ParseTransactionBytesResult = {
  /** Display-ready, pretty-printed string for approval/review UIs */
  displayValue: string
  /** Parsed transaction-like value for review logic. Display formatting must not affect this. */
  reviewValue?: unknown
  /** Signing-ready transaction string for Transaction.from() - base64 for bytes, JSON for objects, trimmed/normalized for strings */
  transactionForSigning?: string
}

async function bytesToReviewValue(bytes: Uint8Array): Promise<unknown> {
  const tx = Transaction.from(bytes)
  const json = await tx.toJSON()
  return typeof json === 'string' ? JSON.parse(json) : json
}

function parseJsonString(value: string): { ok: true; value: unknown } | null {
  try {
    return { ok: true, value: JSON.parse(value) }
  } catch {
    return null
  }
}

function toDisplayResult(
  reviewValue: unknown,
  transactionForSigning?: string,
): ParseTransactionBytesResult {
  return {
    displayValue: JSON.stringify(reviewValue, null, 2),
    reviewValue,
    ...(transactionForSigning && { transactionForSigning }),
  }
}

/**
 * Normalizes a raw pending-transaction value (as handed to a wallet by a
 * dapp or read back from storage) into display-, review-, and signing-ready
 * forms.
 *
 * - If object: serializes to JSON for display and returns JSON string for signing (Transaction.from() accepts it)
 * - If comma-separated bytes (deprecated dapp format): parses to human-readable JSON and base64 for signing
 * - If base64: parses to human-readable JSON for display, normalized base64 for signing
 * - Otherwise: returns the original string as `displayValue`
 *   (and sets `reviewValue` when it is valid JSON)
 *
 * Never throws: values that cannot be interpreted as a transaction come back
 * with only `displayValue` set (and `reviewValue` when the string is valid
 * JSON), letting review UIs surface them without offering signing.
 */
export async function parseTransactionBytes(
  transaction: string | Record<string, unknown>,
): Promise<ParseTransactionBytesResult> {
  return typeof transaction === 'string'
    ? parseTransactionString(transaction)
    : parseTransactionObject(transaction)
}

const parseTransactionObject = (
  transaction: Record<string, unknown>,
): ParseTransactionBytesResult => {
  try {
    return toDisplayResult(
      transaction,
      // Transaction.from() can accept serialized transaction objects as JSON strings.
      JSON.stringify(transaction),
    )
  } catch {
    // JSON.stringify throws on bigint values and circular references. Such
    // objects cannot be faithfully serialized for signing, so degrade to a
    // display/review-only result.
    return {
      displayValue: safeStringify(transaction),
      reviewValue: transaction,
    }
  }
}

/** Best-effort pretty-print for objects JSON.stringify rejects (bigint, cycles). */
const safeStringify = (value: unknown): string => {
  const seen = new WeakSet<object>()
  return JSON.stringify(
    value,
    (_key, v: unknown) => {
      if (typeof v === 'bigint') return v.toString()
      if (typeof v === 'object' && v !== null) {
        if (seen.has(v)) return '[Circular]'
        seen.add(v)
      }
      return v
    },
    2,
  )
}

const parseTransactionString = async (
  transaction: string,
): Promise<ParseTransactionBytesResult> => {
  const trimmed = transaction.trim()
  // A comma signals the deprecated comma-separated byte format; base64 never contains one.
  const parser = trimmed.includes(',')
    ? parseCommaSeparatedBytes
    : parseBase64Bytes

  const result = await parser(trimmed, transaction)
  if (result.transactionForSigning || result.reviewValue !== undefined) {
    return result
  }

  const parsed = parseJsonString(transaction)
  return parsed ? { ...result, reviewValue: parsed.value } : result
}

const parseCommaSeparatedBytes = async (
  trimmed: string,
  original: string,
): Promise<ParseTransactionBytesResult> => {
  try {
    const bytes = new Uint8Array(trimmed.split(',').map(parseByteValue))
    return toDisplayResult(await bytesToReviewValue(bytes), toBase64(bytes))
  } catch {
    return { displayValue: original }
  }
}

const parseBase64Bytes = async (
  trimmed: string,
  original: string,
): Promise<ParseTransactionBytesResult> => {
  try {
    return toDisplayResult(
      await bytesToReviewValue(fromBase64(trimmed)),
      trimmed,
    )
  } catch {
    return { displayValue: original }
  }
}

const parseByteValue = (value: string): number => {
  const trimmed = value.trim()
  // Number('') is 0, so empty segments (e.g. from "1,2,3,") must be rejected explicitly
  if (trimmed === '') {
    throw new Error('Empty byte value')
  }
  const num = Number(trimmed)
  if (!Number.isFinite(num) || !Number.isInteger(num) || num < 0 || num > 255) {
    throw new Error(`Invalid byte value: ${trimmed}`)
  }
  return num
}
