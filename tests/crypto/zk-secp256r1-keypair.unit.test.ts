import { describe, it, expect } from 'vitest'
import { ZKSecp256r1Keypair } from '#src/crypto/zk-secp256r1-keypair'
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1'
import { parseSerializedSignature, type IntentScope } from '@mysten/sui/cryptography'
import { zkpdBase } from '#tests/crypto/zk-common.unit.test'
import { fromBase64, toBase64 } from '@mysten/sui/utils'
import { parseZkLoginSignature } from '@mysten/sui/zklogin'
import { Uint8ArrayFromHex } from '#tests/utils'

describe('zk-secp256r1-keypair (a Keypair/Signer that can ZK sign)', () => {
  it('should be constructable', async () => {
    const sut = new ZKSecp256r1Keypair()
    expect(sut).toBeInstanceOf(ZKSecp256r1Keypair)
    expect(sut).toBeInstanceOf(Secp256r1Keypair)
  })

  describe('applyZKProof', () => {
    it('should not throw if given normal input', () => {
      const sut = new ZKSecp256r1Keypair()
      expect(() => sut.applyZKProof(zkpdBase)).not.toThrow()
    })
  })

  it('should create the same keypair from the same seed', () => {
    const seed = '0x0102030405060708091011121314151617181920212223242526272829303132'
    const sut1 = ZKSecp256r1Keypair.fromSeed(new Uint8Array(Uint8ArrayFromHex(seed.slice(2))))
    const sut2 = ZKSecp256r1Keypair.fromSeed(new Uint8Array(Uint8ArrayFromHex(seed.slice(2))))
    expect(sut1.getSecretKey()).toBe(sut2.getSecretKey())
    expect(sut1.getPublicKey().toRawBytes()).toEqual(sut2.getPublicKey().toRawBytes())
  })

  it('should signWithIntent in a stable manner (none ZK)', async () => {
    const seed = '0x0102030405060708091011121314151617181920212223242526272829303132'
    const ref = ZKSecp256r1Keypair.fromSeed(new Uint8Array(Uint8ArrayFromHex(seed.slice(2))))
    const intent = 'TransactionData' as IntentScope
    const { signature } = await ref.signWithIntent(new Uint8Array([1, 2, 3]), intent)
    expect(signature).toBe(
      'At73yV1IKtqDwydNQThiy97UMLIgiQ4DGUx5so/e2drqW1UreHmlR+0cSb0sFvdq+iSzYJCVC9YwcpRcnf4nfV0DwSTxv0QJrg4hWDbP8xtfsiJenYukOy5AmQUhDJSfjjo=',
    )
  })

  it('should signWithIntent in a verifiable manner (ZK)', async () => {
    const signer = new ZKSecp256r1Keypair()
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
