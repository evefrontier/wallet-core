import { describe, expect, it } from 'vitest'
import {
  isPartialZKLoginSignature,
  withZKProofHandling,
  ZKEd25519Keypair,
  ZKProofHandler,
  ZKSecp256r1Keypair,
  ZKWebCryptoSigner,
} from '#src/crypto'
import { ZKProofHandler as ExpectedZKProofHandler } from '#src/crypto/zk-common'
import { ZKEd25519Keypair as ExpectedZKEd25519Keypair } from '#src/crypto/zk-ed25519-keypair'
import { ZKSecp256r1Keypair as ExpectedZKSecp256r1Keypair } from '#src/crypto/zk-secp256r1-keypair'
import { ZKWebCryptoSigner as ExpectedZKWebCryptoSigner } from '#src/crypto/zk-webcrypto-signer'

describe('crypto exports', () => {
  it('should export ZK keypair and signer classes', () => {
    expect(ZKEd25519Keypair).toBe(ExpectedZKEd25519Keypair)
    expect(ZKSecp256r1Keypair).toBe(ExpectedZKSecp256r1Keypair)
    expect(ZKWebCryptoSigner).toBe(ExpectedZKWebCryptoSigner)
  })

  it('should export ZK proof handling utilities', () => {
    expect(ZKProofHandler).toBe(ExpectedZKProofHandler)
    expect(isPartialZKLoginSignature).toBeTypeOf('function')
    expect(withZKProofHandling).toBeTypeOf('function')
  })
})
