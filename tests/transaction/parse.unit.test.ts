import { Transaction } from '@mysten/sui/transactions'
import { toBase58, toBase64 } from '@mysten/sui/utils'
import { describe, expect, it } from 'vitest'
import { parseTransactionBytes } from '#src/transaction'

const SENDER = `0x${'a'.repeat(64)}`
const GAS_OBJECT = `0x${'b'.repeat(64)}`

/** Builds real BCS transaction bytes offline (no client round-trips). */
async function buildTransactionBytesOffline(): Promise<Uint8Array> {
  const tx = new Transaction()
  tx.setSender(SENDER)
  tx.setGasPrice(1_000)
  tx.setGasBudget(1_000_000)
  tx.setGasPayment([
    {
      objectId: GAS_OBJECT,
      version: '1',
      digest: toBase58(new Uint8Array(32).fill(1)),
    },
  ])
  return tx.build()
}

describe('parseTransactionBytes', () => {
  describe('base64 input', () => {
    it('should parse real transaction bytes into display, review, and signing forms', async () => {
      const bytes = await buildTransactionBytesOffline()
      const base64 = toBase64(bytes)

      const result = await parseTransactionBytes(base64)

      expect(result.transactionForSigning).toBe(base64)
      expect(result.reviewValue).toMatchObject({ sender: SENDER })
      expect(result.displayValue).toBe(
        JSON.stringify(result.reviewValue, null, 2),
      )
    })

    it('should trim surrounding whitespace and return normalized base64 for signing', async () => {
      const base64 = toBase64(await buildTransactionBytesOffline())

      const result = await parseTransactionBytes(`  ${base64}  \n`)

      expect(result.transactionForSigning).toBe(base64)
      expect(result.reviewValue).toMatchObject({ sender: SENDER })
    })

    it('should return only displayValue when base64 decodes to invalid transaction bytes', async () => {
      const input = toBase64(new Uint8Array([1, 2, 3]))

      const result = await parseTransactionBytes(input)

      expect(result).toEqual({ displayValue: input })
    })

    it('should return only displayValue for non-base64 strings', async () => {
      const input = 'not-valid-base64!!!'

      const result = await parseTransactionBytes(input)

      expect(result).toEqual({ displayValue: input })
    })
  })

  describe('comma-separated bytes (deprecated dapp format)', () => {
    it('should parse decimal bytes and return base64 for signing', async () => {
      const bytes = await buildTransactionBytesOffline()
      const commaSeparated = Array.from(bytes).join(',')

      const result = await parseTransactionBytes(commaSeparated)

      expect(result.transactionForSigning).toBe(toBase64(bytes))
      expect(result.reviewValue).toMatchObject({ sender: SENDER })
    })

    it('should allow whitespace around commas and values', async () => {
      const bytes = await buildTransactionBytesOffline()
      const spaced = Array.from(bytes).join(' , ')

      const result = await parseTransactionBytes(`  ${spaced}  `)

      expect(result.transactionForSigning).toBe(toBase64(bytes))
    })

    it('should reject out-of-range, negative, or fractional byte values', async () => {
      for (const input of ['0,1,256,3', '0,1,-1,3', '0,1,2.5,3']) {
        const result = await parseTransactionBytes(input)
        expect(result).toEqual({ displayValue: input })
      }
    })

    it('should return only displayValue when the bytes are not a valid transaction', async () => {
      const input = '0,1,2,3,4'

      const result = await parseTransactionBytes(input)

      expect(result).toEqual({ displayValue: input })
    })
  })

  describe('object input', () => {
    it('should serialize objects for display and signing without byte parsing', async () => {
      const input = { version: 2, sender: SENDER }

      const result = await parseTransactionBytes(input)

      expect(result).toEqual({
        displayValue: JSON.stringify(input, null, 2),
        reviewValue: input,
        transactionForSigning: JSON.stringify(input),
      })
    })
  })

  describe('plain strings', () => {
    it('should keep JSON strings displayable and reviewable but not signable', async () => {
      const input = '{"kind":"ProgrammableTransaction"}'

      const result = await parseTransactionBytes(input)

      expect(result).toEqual({
        displayValue: input,
        reviewValue: { kind: 'ProgrammableTransaction' },
      })
    })

    it('should pass through uninterpretable strings as displayValue only', async () => {
      const input = '  \n  {"x":1}  \t  '

      const result = await parseTransactionBytes(input)

      expect(result.displayValue).toBe(input)
      expect(result.reviewValue).toEqual({ x: 1 })
      expect(result.transactionForSigning).toBeUndefined()
    })
  })

  describe('round trip', () => {
    it('should produce a transactionForSigning that Transaction.from() accepts', async () => {
      const bytes = await buildTransactionBytesOffline()

      for (const input of [toBase64(bytes), Array.from(bytes).join(',')]) {
        const { transactionForSigning } = await parseTransactionBytes(input)
        const rebuilt = Transaction.from(transactionForSigning as string)
        expect(rebuilt.getData().sender).toBe(SENDER)
      }
    })
  })
})
