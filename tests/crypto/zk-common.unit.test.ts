import { describe, expect, it } from 'vitest'
import { isPartialZKLoginSignature, ZKProofHandler } from '#src/crypto'
import type { PartialZkLoginSignature } from '#src/types'
import { zkpdBase } from '#tests/crypto/zk-proof-data'

describe('isPartialZKLoginSignature', () => {
  const signature = {
    proofPoints: {
      a: [
        '1234567890123456789012345678901234567890123456789012345678901234567890123456',
        '12345678901234567890123456789012345678901234567890123456789012345678901234567',
        '1',
      ],
      b: [
        [
          '1234567890123456789012345678901234567890123456789012345678901234567890123456',
          '12345678901234567890123456789012345678901234567890123456789012345678901234567',
        ],
        [
          '1234567890123456789012345678901234567890123456789012345678901234567890123456',
          '12345678901234567890123456789012345678901234567890123456789012345678901234567',
        ],
        ['1', '0'],
      ],
      c: [
        '12345678901234567890123456789012345678901234567890123456789012345678901234567890123456789012345678',
        '12345678901234567890123456789012345678901234567890123456789012345678901234567',
        '1',
      ],
    },
    issBase64Details: {
      value: 'issBase64DetailsValue',
      indexMod4: 2,
    },
    headerBase64: 'headerBase64',
  }

  it('should detect the shape of a partial ZK Login signature', () => {
    expect(isPartialZKLoginSignature(signature)).toBe(true)
  })
})

describe('ZKProofHandler', () => {
  describe('applyZKProof should validate its input', () => {
    it('should throw if maxEpoch is not a number greater than 0', () => {
      const sut = new ZKProofHandler()
      expect(() => sut.applyZKProof({ ...zkpdBase, maxEpoch: -1 })).toThrow(
        '[applyZKProof] expected property "$maxEpoch" to be a number greater than 0',
      )
    })
    it('should throw if userSalt is not a string with content', () => {
      const sut = new ZKProofHandler()
      expect(() => sut.applyZKProof({ ...zkpdBase, userSalt: '' })).toThrow(
        '[applyZKProof] expected property "userSalt" to be a string with content',
      )
    })
    it('should throw if tokenClaimSub is not a string with content', () => {
      const sut = new ZKProofHandler()
      expect(() =>
        sut.applyZKProof({ ...zkpdBase, tokenClaimSub: '' }),
      ).toThrow(
        '[applyZKProof] expected property "tokenClaimSub" to be a string with content',
      )
    })
    it('should throw if tokenClaimAud is not a string with content', () => {
      const sut = new ZKProofHandler()
      expect(() =>
        sut.applyZKProof({ ...zkpdBase, tokenClaimAud: '' }),
      ).toThrow(
        '[applyZKProof] expected property "tokenClaimAud" to be a string with content',
      )
    })
    it('should throw if partialZkLoginSignature is not in the correct format', () => {
      const sut = new ZKProofHandler()
      expect(() =>
        sut.applyZKProof({
          ...zkpdBase,
          partialZkLoginSignature: {} as PartialZkLoginSignature,
        }),
      ).toThrow(
        '[applyZKProof] expected property "partialZkLoginSignature" in incorrect',
      )
    })
    it('should not throw if skipValidation is true, even if the input is incorrect', () => {
      const sut = new ZKProofHandler()
      expect(() =>
        sut.applyZKProof(
          {
            ...zkpdBase,
            maxEpoch: -1,
            userSalt: '',
            tokenClaimSub: '',
            tokenClaimAud: '',
            partialZkLoginSignature: {
              addressSeed: 'someAddressSeed',
              proofPoints: {
                a: ['0', '0', '0'],
                b: [
                  ['0', '0'],
                  ['0', '0'],
                  ['0', '0'],
                ],
                c: ['0', '0', '0'],
              },
              issBase64Details: {
                value: '',
                indexMod4: 0,
              },
              headerBase64: '',
            } as PartialZkLoginSignature,
          },
          { skipValidation: true },
        ),
      ).not.toThrow()
      expect(sut.partialZkLoginSignature).not.toHaveProperty('addressSeed')
      expect(sut.maxEpoch).toBe(-1)
      expect(sut.userSalt).toBe('')
      expect(sut.tokenClaimSub).toBe('')
      expect(sut.tokenClaimAud).toBe('')
      expect(sut.partialZkLoginSignature).toHaveProperty('proofPoints')
      expect(sut.partialZkLoginSignature).toHaveProperty('issBase64Details')
      expect(sut.partialZkLoginSignature).toHaveProperty('headerBase64')
    })
    it('should not throw if skipValidation is true, even if the input is missing the partial signature', () => {
      const sut = new ZKProofHandler()
      expect(() =>
        sut.applyZKProof(
          {
            ...zkpdBase,
            maxEpoch: -1,
            userSalt: '',
            tokenClaimSub: '',
            tokenClaimAud: '',
            partialZkLoginSignature: undefined,
          },
          { skipValidation: true },
        ),
      ).not.toThrow()
      expect(sut.partialZkLoginSignature).toBeUndefined()
      expect(sut.maxEpoch).toBe(-1)
      expect(sut.userSalt).toBe('')
      expect(sut.tokenClaimSub).toBe('')
      expect(sut.tokenClaimAud).toBe('')
    })
  })
})
