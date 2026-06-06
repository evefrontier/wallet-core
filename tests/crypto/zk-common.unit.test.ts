import type { SignatureWithBytes } from '@mysten/sui/cryptography'
import { describe, expect, it, vi } from 'vitest'
import {
  createZkLoginSignature,
  getZkProofResponseErrorMessage,
  isPartialZKLoginSignature,
  loadZkProof,
  parseZkProofResponse,
  signWithIntent,
  ZKProofHandler,
} from '#src/crypto'
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

describe('signWithIntent', () => {
  const messageBytes = new Uint8Array([1, 2, 3])

  it('should sign transactions with signTransaction', async () => {
    const signTransaction = vi.fn().mockResolvedValue({
      bytes: 'transaction-bytes',
      signature: 'transaction-signature',
    } satisfies SignatureWithBytes)
    const signPersonalMessage = vi.fn().mockResolvedValue({
      bytes: 'message-bytes',
      signature: 'message-signature',
    } satisfies SignatureWithBytes)

    const result = await signWithIntent(messageBytes, 'TransactionData', {
      sui_address: '0x1',
      keypair: {
        signTransaction,
        signPersonalMessage,
      } as never,
    })

    expect(signTransaction).toHaveBeenCalledWith(messageBytes)
    expect(signPersonalMessage).not.toHaveBeenCalled()
    expect(result).toEqual({
      bytes: 'transaction-bytes',
      userSignature: 'transaction-signature',
    })
  })

  it('should sign non-transaction scopes with signPersonalMessage', async () => {
    const signTransaction = vi.fn().mockResolvedValue({
      bytes: 'transaction-bytes',
      signature: 'transaction-signature',
    } satisfies SignatureWithBytes)
    const signPersonalMessage = vi.fn().mockResolvedValue({
      bytes: 'message-bytes',
      signature: 'message-signature',
    } satisfies SignatureWithBytes)

    const result = await signWithIntent(messageBytes, 'PersonalMessage', {
      sui_address: '0x1',
      keypair: {
        signTransaction,
        signPersonalMessage,
      } as never,
    })

    expect(signTransaction).not.toHaveBeenCalled()
    expect(signPersonalMessage).toHaveBeenCalledWith(messageBytes)
    expect(result).toEqual({
      bytes: 'message-bytes',
      userSignature: 'message-signature',
    })
  })

  it('should require an address and a keypair', async () => {
    await expect(
      signWithIntent(messageBytes, 'PersonalMessage', {
        sui_address: '',
        keypair: {} as never,
      }),
    ).rejects.toThrow('[signWithIntent] User address not found')

    await expect(
      signWithIntent(messageBytes, 'PersonalMessage', {
        sui_address: '0x1',
        keypair: undefined as never,
      }),
    ).rejects.toThrow('[signWithIntent] Key pair not found')
  })

  it('should reject empty signer output', async () => {
    await expect(
      signWithIntent(messageBytes, 'PersonalMessage', {
        sui_address: '0x1',
        keypair: {
          signTransaction: vi.fn(),
          signPersonalMessage: vi.fn().mockResolvedValue({}),
        } as never,
      }),
    ).rejects.toThrow('[signWithIntent] Signer returned no signature')
  })
})

describe('ZK proof response helpers', () => {
  it('should return error messages from proof responses', () => {
    expect(getZkProofResponseErrorMessage(null)).toBe('Failed to get ZK proof')
    expect(getZkProofResponseErrorMessage({ error: 'proof failed' })).toBe(
      'proof failed',
    )
    expect(
      getZkProofResponseErrorMessage({ error: { message: 'message failed' } }),
    ).toBe('message failed')
    expect(getZkProofResponseErrorMessage({ data: {} })).toBeNull()
  })

  it('should parse and load valid proof response data', async () => {
    expect(
      parseZkProofResponse({ data: zkpdBase.partialZkLoginSignature }),
    ).toEqual(zkpdBase.partialZkLoginSignature)
    await expect(
      loadZkProof(async () => ({ data: zkpdBase.partialZkLoginSignature })),
    ).resolves.toEqual(zkpdBase.partialZkLoginSignature)
  })

  it('should reject proof errors and malformed data', () => {
    expect(() => parseZkProofResponse({ error: 'proof failed' })).toThrow(
      'proof failed',
    )
    expect(() => parseZkProofResponse({ data: {} })).toThrow(
      'ZK proof data not found or invalid',
    )
  })
})

describe('createZkLoginSignature', () => {
  it('should create the expected zkLogin signature', () => {
    const baseSignature = {
      signature:
        'AHWKc5xpmRMg+ThF9UVF2nKwVan5XwsKGlBAfe6AzA5ZhThkl9Rh5QXEmKmwZCVq6pulpG7TbnUDhNkCbbgQbQe4wQR3rQjfYSMB7oXfwpBXKKVChxrnMsu50Qz/iBS/Lg==',
      bytes: 'AQID',
    }
    const expectedSignature =
      'BQNMMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Nk0xMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2NwExAwJMMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Nk0xMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2NwJMMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Nk0xMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2NwIBMQEwA2IxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3OE0xMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2NwExFWlzc0Jhc2U2NERldGFpbHNWYWx1ZQIMaGVhZGVyQmFzZTY0SzcyMDIxNDcxNjY3NDg3ODg5MzU0OTc5Mjg0MjgyODMxMzU4MzEzNjk3ODU1Nzk2NTI3OTc3MTM0Njc5MjA3MzAzODQ5NDUzNjM5NwEAAAAAAAAAYQB1inOcaZkTIPk4RfVFRdpysFWp+V8LChpQQH3ugMwOWYU4ZJfUYeUFxJipsGQlauqbpaRu0251A4TZAm24EG0HuMEEd60I32EjAe6F38KQVyilQoca5zLLudEM/4gUvy4='

    expect(
      createZkLoginSignature({
        maxEpoch: zkpdBase.maxEpoch.toString(),
        partialZkLoginSignature: zkpdBase.partialZkLoginSignature,
        claims: {
          salt: zkpdBase.userSalt,
          sub: zkpdBase.tokenClaimSub,
          aud: zkpdBase.tokenClaimAud,
        },
        userSignature: baseSignature.signature,
        bytes: baseSignature.bytes,
      }),
    ).toBe(expectedSignature)
  })

  it('should validate proof input, claims, and max epoch', () => {
    const validParams = {
      maxEpoch: zkpdBase.maxEpoch,
      partialZkLoginSignature: zkpdBase.partialZkLoginSignature,
      claims: {
        salt: zkpdBase.userSalt,
        sub: zkpdBase.tokenClaimSub,
        aud: zkpdBase.tokenClaimAud,
      },
      userSignature: 'user-signature',
      bytes: 'signed-bytes',
    }

    expect(() =>
      createZkLoginSignature({
        ...validParams,
        partialZkLoginSignature: {},
      }),
    ).toThrow('ZK proof data not found or invalid')
    expect(() =>
      createZkLoginSignature({
        ...validParams,
        claims: { ...validParams.claims, salt: '' },
      }),
    ).toThrow('Missing required zkLogin profile field: salt')
    expect(() =>
      createZkLoginSignature({ ...validParams, maxEpoch: '' }),
    ).toThrow('Max epoch is not set')
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
