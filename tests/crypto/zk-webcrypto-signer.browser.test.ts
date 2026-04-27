import { describe, it, expect } from 'vitest'
import { ZKWebCryptoSigner } from '#src/crypto'
import { Secp256r1PublicKey } from '@mysten/sui/keypairs/secp256r1'
import { fromBase64, toBase64 } from '@mysten/sui/utils'
import { parseSerializedSignature, type IntentScope } from '@mysten/sui/cryptography'
import { zkpdBase } from '#tests/crypto/zk-common.unit.test'
import { parseZkLoginSignature } from '@mysten/sui/zklogin'

describe('ZKWebCryptoSigner', async () => {
  it('should be constructable', async () => {
    // Start of by using "generate" to create a reference instance as the
    // constructor requires arguments (which can be obtained from an existing instance).
    const ref = await ZKWebCryptoSigner.generate()
    expect(ref).toBeInstanceOf(ZKWebCryptoSigner)
    const refPrivateKey = ref.privateKey
    expect(refPrivateKey).toBeInstanceOf(CryptoKey)
    const refPublicKey = ref.getPublicKey()
    expect(refPublicKey).toBeInstanceOf(Secp256r1PublicKey)
    // Use the constructor with the values from the reference instance.
    const sut = new ZKWebCryptoSigner(refPrivateKey, refPublicKey.toRawBytes())
    expect(sut).toBeInstanceOf(ZKWebCryptoSigner)
    // Do we have the same algorithm and public key?
    expect(sut.privateKey.algorithm).toStrictEqual(refPrivateKey.algorithm)
    expect(sut.getPublicKey().toRawBytes()).toEqual(refPublicKey.toRawBytes())
  })

  it('should sign and verify without ZK', async () => {
    const signer = await ZKWebCryptoSigner.generate({ extractable: true })
    const bytesToSign = new Uint8Array([1, 2, 3])
    const intent = 'TransactionData' as IntentScope
    const signatureWithBytes = await signer.signWithIntent(bytesToSign, intent)
    const isValid = await signer
      .getPublicKey()
      .verifyWithIntent(bytesToSign, signatureWithBytes.signature, intent)
    expect(isValid).toBe(true)
  })

  it('should signWithIntent in a stable manner (none ZK)', async () => {
    const ref = await ZKWebCryptoSigner.generate({ extractable: true })
    expect(ref).toBeInstanceOf(ZKWebCryptoSigner)
    const refPrivateKey = ref.privateKey
    expect(refPrivateKey).toBeInstanceOf(CryptoKey)
    const exported = await globalThis.crypto.subtle.exportKey('jwk', refPrivateKey)

    const importedKey = await globalThis.crypto.subtle.importKey(
      'jwk',
      exported,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign'],
    )
    const sut = new ZKWebCryptoSigner(importedKey, ref.getPublicKey().toRawBytes())
    expect(sut).toBeInstanceOf(ZKWebCryptoSigner)

    // Might be the same instance? so probably not a good expectation.
    expect(ref.getPublicKey().toRawBytes()).toEqual(sut.getPublicKey().toRawBytes())
    // can we verify a sig from the reference with the sut's public key?
    const bytesToSign = new Uint8Array([1, 2, 3])
    const intent = 'TransactionData' as IntentScope
    const signatureWithBytes = await sut.signWithIntent(bytesToSign, intent)
    // We can't really expect a specific signature value since the key is generated on the fly, but we can check that it's a valid signature by verifying it with the public key.
    const refSeesAsValid = await ref
      .getPublicKey()
      .verifyWithIntent(bytesToSign, signatureWithBytes.signature, intent)
    expect(refSeesAsValid).toBe(true)
    const sutSeesAsValid = await sut
      .getPublicKey()
      .verifyWithIntent(bytesToSign, signatureWithBytes.signature, intent)
    expect(sutSeesAsValid).toBe(true)
  })

  it('should signWithIntent in a stable manner 2 (none ZK)', async () => {
    const publicKeyAsBase64 = 'AmSj40owFihqPgZn50qiOwEjBc+mZYuTpE5YPLS2o3Ul'
    const publicKeyAsRawBytes = fromBase64(publicKeyAsBase64)
    const exported = {
      crv: 'P-256',
      d: 'pIZ8bxvnmfDxTt7Hy6D7Ae997Zi2_w6afeWtGl1FyBo',
      ext: true,
      key_ops: ['sign'],
      kty: 'EC',
      x: 'ZKPjSjAWKGo-BmfnSqI7ASMFz6Zli5OkTlg8tLajdSU',
      y: 'qFIdoXQF4D_RNtC0AhZ53Rf25To7OIHdkLEDU_86diw',
    }

    const importedKey = await globalThis.crypto.subtle.importKey(
      'jwk',
      exported,
      {
        name: 'ECDSA',
        namedCurve: 'P-256',
      },
      true,
      ['sign'],
    )
    const sut = new ZKWebCryptoSigner(importedKey, publicKeyAsRawBytes)
    expect(sut).toBeInstanceOf(ZKWebCryptoSigner)

    expect(publicKeyAsRawBytes).toEqual(sut.getPublicKey().toRawBytes())
    // can we verify a sig from the reference with the sut's public key?
    const bytesToSign = new Uint8Array([1, 2, 3])
    const intent = 'TransactionData' as IntentScope
    const signatureWithBytes = await sut.signWithIntent(bytesToSign, intent)
    // We can't really expect a specific signature value since the key is generated on the fly, but we can check that it's a valid signature by verifying it with the public key.
    const sutSeesAsValid = await sut
      .getPublicKey()
      .verifyWithIntent(bytesToSign, signatureWithBytes.signature, intent)
    expect(sutSeesAsValid).toBe(true)
  })

  it('should signWithIntent in a verifiable manner (ZK)', async () => {
    const signer = await ZKWebCryptoSigner.generate({ extractable: true })
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
    const isValid = await signer
      .getPublicKey()
      .verifyWithIntent(bytesToSign, parsedUserSignature.signature!, intent)
    expect(isValid).toBe(true)
    // verify against the ZK Proof data that was applied earlier (signer.applyZKProof)
    expect(parsedZkLoginSignature.inputs.proofPoints).toStrictEqual(
      zkpdBase.partialZkLoginSignature?.proofPoints,
    )
    expect(parsedZkLoginSignature.inputs.issBase64Details).toStrictEqual(
      zkpdBase.partialZkLoginSignature?.issBase64Details,
    )
    expect(parsedZkLoginSignature.inputs.headerBase64).toBe(
      zkpdBase.partialZkLoginSignature?.headerBase64,
    )
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
})
