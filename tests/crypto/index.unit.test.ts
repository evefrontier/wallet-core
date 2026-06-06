import { describe, expect, it } from 'vitest'
import {
  createZkLoginSignature,
  getZkProofResponseErrorMessage,
  isPartialZKLoginSignature,
  loadZkProof,
  parseZkProofResponse,
  signWithIntent,
  withZKProofHandling,
  ZKEd25519Keypair,
  ZKProofHandler,
  ZKSecp256r1Keypair,
  ZKWebCryptoSigner,
} from '#src/crypto'
import { signWithIntent as ExpectedSignWithIntent } from '#src/crypto/sign-with-intent'
import * as zkCommon from '#src/crypto/zk-common'
import { ZKEd25519Keypair as ExpectedZKEd25519Keypair } from '#src/crypto/zk-ed25519-keypair'
import * as zkProofResponse from '#src/crypto/zk-proof-response'
import { ZKSecp256r1Keypair as ExpectedZKSecp256r1Keypair } from '#src/crypto/zk-secp256r1-keypair'
import { createZkLoginSignature as ExpectedCreateZkLoginSignature } from '#src/crypto/zk-signature'
import { ZKWebCryptoSigner as ExpectedZKWebCryptoSigner } from '#src/crypto/zk-webcrypto-signer'

describe('crypto exports', () => {
  it('should export ZK keypair and signer classes', () => {
    expect(ZKEd25519Keypair).toBe(ExpectedZKEd25519Keypair)
    expect(ZKSecp256r1Keypair).toBe(ExpectedZKSecp256r1Keypair)
    expect(ZKWebCryptoSigner).toBe(ExpectedZKWebCryptoSigner)
  })

  it('should export ZK proof handling utilities', () => {
    expect(ZKProofHandler).toBe(zkCommon.ZKProofHandler)
    expect(isPartialZKLoginSignature).toBe(zkCommon.isPartialZKLoginSignature)
    expect(createZkLoginSignature).toBe(ExpectedCreateZkLoginSignature)
    expect(getZkProofResponseErrorMessage).toBe(
      zkProofResponse.getZkProofResponseErrorMessage,
    )
    expect(loadZkProof).toBe(zkProofResponse.loadZkProof)
    expect(parseZkProofResponse).toBe(zkProofResponse.parseZkProofResponse)
    expect(signWithIntent).toBe(ExpectedSignWithIntent)
    expect(withZKProofHandling).toBe(zkCommon.withZKProofHandling)
  })
})
