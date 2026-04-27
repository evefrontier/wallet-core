import { describe, it, expect } from 'vitest'
import { ZKEd25519Keypair } from '#src/crypto/zk-ed25519-keypair'
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'
import { parseSerializedSignature, type IntentScope } from '@mysten/sui/cryptography'
import { zkpdBase } from '#tests/crypto/zk-common.unit.test'
import { fromBase64, toBase64 } from '@mysten/sui/utils'
import { parseZkLoginSignature } from '@mysten/sui/zklogin'

describe('zk-ed25519-keypair (a Keypair/Signer that can ZK sign)', () => {
  it('should be constructable', async () => {
    const sut = new ZKEd25519Keypair()
    expect(sut).toBeInstanceOf(ZKEd25519Keypair)
  })

  describe('applyZKProof', () => {
    it('should not throw if given normal input', () => {
      const sut = new ZKEd25519Keypair()
      expect(() => sut.applyZKProof(zkpdBase)).not.toThrow()
    })
  })

  it('should to and from ZKEd25519KeypairData correctly', () => {
    const ref = ZKEd25519Keypair.generate()
    ref.applyZKProof(zkpdBase)
    const keypairData = ref.toZKEd25519KeypairData()
    const sut = ZKEd25519Keypair.fromZKEd25519KeypairData(keypairData)
    expect(sut).toBeInstanceOf(ZKEd25519Keypair)
    expect(sut.getSecretKey()).toBe(ref.getSecretKey())
    expect(sut['zkProofHandler']['maxEpoch']).toBe(
      ref['zkProofHandler']['maxEpoch']
    )
    expect(sut['zkProofHandler']['userSalt']).toBe(
      ref['zkProofHandler']['userSalt']
    )
    expect(sut['zkProofHandler']['tokenClaimSub']).toBe(
      ref['zkProofHandler']['tokenClaimSub']
    )
    expect(sut['zkProofHandler']['tokenClaimAud']).toBe(
      ref['zkProofHandler']['tokenClaimAud']
    )
    expect(sut['zkProofHandler']['partialZkLoginSignature']).toEqual(
      ref['zkProofHandler']['partialZkLoginSignature']
    )
    expect(sut.toSuiAddress()).toBe(ref.toSuiAddress())
  })

  it('should signWithIntent in a stable manner (none ZK)', async () => {
    const seed = '0x123456789012345678901'
    const ref = ZKEd25519Keypair.deriveKeypairFromSeed(seed)
    const intent = 'TransactionData' as IntentScope
    const { signature } = await ref.signWithIntent(
      new Uint8Array([1, 2, 3]),
      intent
    )
    expect(signature).toBe(
      'AHWKc5xpmRMg+ThF9UVF2nKwVan5XwsKGlBAfe6AzA5ZhThkl9Rh5QXEmKmwZCVq6pulpG7TbnUDhNkCbbgQbQe4wQR3rQjfYSMB7oXfwpBXKKVChxrnMsu50Qz/iBS/Lg=='
    )
  })

  it('should signWithIntent in a stable manner (ZK)', async () => {
    const seed = '0x123456789012345678901'
    const ref = ZKEd25519Keypair.deriveKeypairFromSeed(seed)
    ref.applyZKProof(zkpdBase)
    const bytes = Buffer.from(
      'AAACACB6nRnUwhBmOSbrVJ2lmlTiV3f+9jFhv8zaCCd7WLQhLgAIAQAAAAAAAAACAgABAQEAAQEDAAAAAAEAAIkm4xFlv/IfCwFL2q8gQl48ASW+dZshGS6KlQjPcXnzAaQHRhEcp3nw0f9HRL6o78c1/DEHTE7W0Ou+c0HJrMnzshXQFAAAAAAgauRZWN2P4by/234vMwvTe0w9W3GOeMQ84iJGT4Y7Gs+JJuMRZb/yHwsBS9qvIEJePAElvnWbIRkuipUIz3F58+gDAAAAAAAAgENbCQAAAAAA',
      'base64'
    )
    const intent = 'TransactionData' as IntentScope
    const { signature } = await ref.signWithIntent(bytes, intent)
    expect(signature).toBe(
      'BQNMMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Nk0xMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2NwExAwJMMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Nk0xMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2NwJMMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Nk0xMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2NwIBMQEwA2IxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3OE0xMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2NwExFWlzc0Jhc2U2NERldGFpbHNWYWx1ZQIMaGVhZGVyQmFzZTY0SzcyMDIxNDcxNjY3NDg3ODg5MzU0OTc5Mjg0MjgyODMxMzU4MzEzNjk3ODU1Nzk2NTI3OTc3MTM0Njc5MjA3MzAzODQ5NDUzNjM5NwEAAAAAAAAAYQDhvqaDLgPg6j/BphewxXUwnT+E2IU5WQDSrh91xa64OzKujqKIS5E3sOzplgzAdU+mFVKsf04r4G//+9Qp/4cKuMEEd60I32EjAe6F38KQVyilQoca5zLLudEM/4gUvy4='
    )
  })

  it('should signWithIntent in a verifiable manner (ZK)', async () => {
    const signer = ZKEd25519Keypair.generate()
    const bytesToSign = new Uint8Array([1, 2, 3])
    const intent = 'TransactionData' as IntentScope
    expect(() => signer.applyZKProof(zkpdBase)).not.toThrow()
    const signatureWithBytes = await signer.signWithIntent(bytesToSign, intent)
    
    // getZkLoginSignature returns the base64 of the signature with a byte prefix
    // indicating the signature scheme, which is 5 for ZkLogin.
    const schemeAndZkLoginSignatureBytes = fromBase64(signatureWithBytes.signature)
    const zkLoginSignatureBytes = schemeAndZkLoginSignatureBytes.slice(1)
    const parsedZkLoginSignature = parseZkLoginSignature(zkLoginSignatureBytes)
    const userSignature = parsedZkLoginSignature.userSignature
    // the userSignature is from toSerializedSignature where the key scheme could be Secp256r1 or ED25519 etc
    const parsedUserSignature = parseSerializedSignature(toBase64(userSignature))

    // Verify the actual signature
    const isValid = await signer.getPublicKey().verifyWithIntent(
      bytesToSign, parsedUserSignature.signature!, intent
    )
    expect(isValid).toBe(true)
    // verify against the ZK Proof data that was applied earlier (signer.applyZKProof)
    expect(parsedZkLoginSignature.inputs.proofPoints).toStrictEqual(zkpdBase.partialZkLoginSignature?.proofPoints)
    expect(parsedZkLoginSignature.inputs.issBase64Details).toStrictEqual(zkpdBase.partialZkLoginSignature?.issBase64Details)
    expect(parsedZkLoginSignature.inputs.headerBase64).toBe(zkpdBase.partialZkLoginSignature?.headerBase64)
    expect(parsedZkLoginSignature.inputs.addressSeed).toBe(signer['zkProofHandler'].addressSeed)
    expect(parsedZkLoginSignature.maxEpoch).toBe(zkpdBase.maxEpoch.toString())
    
    // Verify that the user signature contains the correct scheme and public key
    expect(parsedUserSignature.signatureScheme).toBe(signer.getKeyScheme())
    expect(parsedUserSignature).toHaveProperty('publicKey')
    if ('publicKey' in parsedUserSignature) {
      expect(parsedUserSignature.publicKey).toBeInstanceOf(Uint8Array)
      expect(parsedUserSignature.publicKey).toStrictEqual(signer.getPublicKey().toRawBytes())
    }
  })

  describe('static initializer methods should be equivalent to Ed25519Keypair', () => {
    it('should generate the same', () => {
      const sut = ZKEd25519Keypair.generate()
      expect(sut).toBeInstanceOf(ZKEd25519Keypair)
      const secretKey = sut.getSecretKey()
      expect(typeof secretKey).toBe('string')
      expect(secretKey.startsWith('suiprivkey1')).toBe(true)
    })

    it('should fromSecretKey the same', () => {
      const ref = Ed25519Keypair.generate()
      const refSecretKey = ref.getSecretKey()
      const sut = ZKEd25519Keypair.fromSecretKey(refSecretKey)
      expect(sut).toBeInstanceOf(ZKEd25519Keypair)
      const secretKey = sut.getSecretKey()
      expect(typeof secretKey).toBe('string')
      expect(secretKey.startsWith('suiprivkey1')).toBe(true)
      expect(secretKey).toBe(refSecretKey)
    })

    it('should deriveKeypair the same as a keypair generated with "sui keytool"', () => {
      const mnemonic =
        'test test test test test test test test test test test junk'
      const expectedSuiAddress =
        '0xc88ef07b9b8b2fc3b7daad9478f4e1337f01792e2eab9c3794494e610636026e'
      const ref = Ed25519Keypair.deriveKeypair(mnemonic)
      const expectedSecretKey = ref.getSecretKey()

      const sut = ZKEd25519Keypair.deriveKeypair(mnemonic)
      expect(sut).toBeInstanceOf(ZKEd25519Keypair)
      const suiAddress = sut.toSuiAddress()
      expect(suiAddress).toBe(expectedSuiAddress)
      const secretKey = sut.getSecretKey()
      expect(secretKey).toBe(expectedSecretKey)
    })

    it('should deriveKeypairFromSeed the same ', () => {
      const seed = '0x728234023495600947534'
      const ref = Ed25519Keypair.deriveKeypairFromSeed(seed)
      const expectedSecretKey = ref.getSecretKey()

      const sut = ZKEd25519Keypair.deriveKeypairFromSeed(seed)
      expect(sut).toBeInstanceOf(ZKEd25519Keypair)
      const secretKey = sut.getSecretKey()
      expect(secretKey).toBe(expectedSecretKey)
    })
  })
})
