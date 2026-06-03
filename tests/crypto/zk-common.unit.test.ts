import { describe, expect, it } from 'vitest'
import { isPartialZKLoginSignature, ZKProofHandler } from '#src/crypto'
import type { PartialZkLoginSignature, ZKProofData } from '#src/types'
import {
  zkpdBase,
  zkpdBaseWithoutPartialSignature,
} from '#tests/crypto/zk-proof-data'

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

  it('should accept empty strings in proof-service fields when the shape is correct', () => {
    expect(
      isPartialZKLoginSignature({
        ...signature,
        proofPoints: {
          ...signature.proofPoints,
          a: ['', '0', '0'],
        },
        issBase64Details: {
          ...signature.issBase64Details,
          value: '',
        },
        headerBase64: '',
      }),
    ).toBe(true)
  })

  it('should reject malformed partial ZK Login signatures', () => {
    const malformedSignatures = [
      null,
      {},
      { ...signature, proofPoints: null },
      { ...signature, issBase64Details: null },
      { ...signature, headerBase64: 1 },
      {
        ...signature,
        issBase64Details: {
          ...signature.issBase64Details,
          indexMod4: -1,
        },
      },
      {
        ...signature,
        issBase64Details: {
          ...signature.issBase64Details,
          indexMod4: 1.5,
        },
      },
      {
        ...signature,
        issBase64Details: {
          ...signature.issBase64Details,
          indexMod4: 256,
        },
      },
      {
        ...signature,
        proofPoints: {
          ...signature.proofPoints,
          a: ['0', '0', 0],
        },
      },
      {
        ...signature,
        proofPoints: {
          ...signature.proofPoints,
          b: [['0', '0']],
        },
      },
    ]

    for (const malformedSignature of malformedSignatures) {
      expect(isPartialZKLoginSignature(malformedSignature)).toBe(false)
    }
  })
})

describe('ZKProofHandler', () => {
  describe('applyZKProof should validate its input', () => {
    it('should throw if maxEpoch is not a positive safe integer', () => {
      const sut = new ZKProofHandler()
      const invalidMaxEpochs = [-1, 0, 1.5, Number.POSITIVE_INFINITY]

      for (const maxEpoch of invalidMaxEpochs) {
        expect(() => sut.applyZKProof({ ...zkpdBase, maxEpoch })).toThrow(
          '[applyZKProof] expected property "maxEpoch" to be a positive safe integer',
        )
      }
    })
    it('should throw if userSalt is not a non-negative integer string', () => {
      const sut = new ZKProofHandler()
      const invalidUserSalts = ['', '-1', 'not-a-number']

      for (const userSalt of invalidUserSalts) {
        expect(() => sut.applyZKProof({ ...zkpdBase, userSalt })).toThrow(
          '[applyZKProof] expected property "userSalt" to be a non-negative integer string',
        )
      }
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
        '[applyZKProof] expected property "partialZkLoginSignature" to match zkLogin proof input shape',
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
      const sutProofData = sut.getProofData()
      expect(sutProofData.partialZkLoginSignature).not.toHaveProperty(
        'addressSeed',
      )
      expect(sutProofData.maxEpoch).toBe(-1)
      expect(sutProofData.userSalt).toBe('')
      expect(sutProofData.tokenClaimSub).toBe('')
      expect(sutProofData.tokenClaimAud).toBe('')
      expect(sutProofData.partialZkLoginSignature).toHaveProperty('proofPoints')
      expect(sutProofData.partialZkLoginSignature).toHaveProperty(
        'issBase64Details',
      )
      expect(sutProofData.partialZkLoginSignature).toHaveProperty(
        'headerBase64',
      )
    })
    it('should not throw if skipValidation is true, even if the input is missing the partial signature', () => {
      const sut = new ZKProofHandler()
      expect(() =>
        sut.applyZKProof(
          {
            ...zkpdBaseWithoutPartialSignature,
            maxEpoch: -1,
            userSalt: '',
            tokenClaimSub: '',
            tokenClaimAud: '',
          },
          { skipValidation: true },
        ),
      ).not.toThrow()
      const sutProofData = sut.getProofData()
      expect(sutProofData.partialZkLoginSignature).toBeUndefined()
      expect(sutProofData.maxEpoch).toBe(-1)
      expect(sutProofData.userSalt).toBe('')
      expect(sutProofData.tokenClaimSub).toBe('')
      expect(sutProofData.tokenClaimAud).toBe('')
    })
  })

  describe('applyZKProof should isolate stored proof data from caller mutations', () => {
    it('should not mutate caller-supplied proof data when removing addressSeed', () => {
      const sut = new ZKProofHandler()
      const proofData = structuredClone(zkpdBase) as ZKProofData
      const inputWithAddressSeed = {
        ...proofData,
        partialZkLoginSignature: {
          ...proofData.partialZkLoginSignature,
          addressSeed: 'caller-owned-address-seed',
        } as PartialZkLoginSignature,
      }

      const appliedProofData = sut.applyZKProof(inputWithAddressSeed)

      expect(
        'addressSeed' in
          (inputWithAddressSeed.partialZkLoginSignature as object),
      ).toBe(true)
      expect(appliedProofData.partialZkLoginSignature).not.toHaveProperty(
        'addressSeed',
      )
    })

    it('should not allow caller mutations after applyZKProof to affect future proof data', () => {
      const sut = new ZKProofHandler()
      const proofData = structuredClone(zkpdBase) as ZKProofData
      sut.applyZKProof(proofData)

      if (!proofData.partialZkLoginSignature) {
        throw new Error('Expected test proof data to include partial signature')
      }
      proofData.partialZkLoginSignature.headerBase64 = 'mutated-header'
      const proofPointA = proofData.partialZkLoginSignature.proofPoints
        .a as string[]
      proofPointA[0] = '999'
      proofData.partialZkLoginSignature.issBase64Details.value = 'mutated-iss'

      expect(sut.getProofData().partialZkLoginSignature).toEqual(
        zkpdBase.partialZkLoginSignature,
      )
    })

    it('should not allow getProofData return values to mutate internal proof data', () => {
      const sut = new ZKProofHandler()
      sut.applyZKProof(zkpdBase)
      const proofData = sut.getProofData()

      if (!proofData.partialZkLoginSignature) {
        throw new Error(
          'Expected stored proof data to include partial signature',
        )
      }
      proofData.partialZkLoginSignature.headerBase64 = 'mutated-header'
      const proofPointRows = proofData.partialZkLoginSignature.proofPoints
        .b as string[][]
      const firstProofPointRow = proofPointRows[0]
      if (!firstProofPointRow) {
        throw new Error('Expected proof points to include a first b row')
      }
      firstProofPointRow[0] = '999'
      proofData.partialZkLoginSignature.issBase64Details.indexMod4 = 3

      expect(sut.getProofData().partialZkLoginSignature).toEqual(
        zkpdBase.partialZkLoginSignature,
      )
    })
  })
})
