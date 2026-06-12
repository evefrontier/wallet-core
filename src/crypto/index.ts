/**
 * @packageDocumentation
 *
 * Core signer utilities for wallet and zkLogin flows.
 *
 * ## Usage
 *
 * The crypto entrypoint exposes three primary signer classes:
 * `ZKEd25519Keypair`, `ZKSecp256r1Keypair`, and `ZKWebCryptoSigner`.
 *
 * These are drop-in replacements for specific Mysten Labs TypeScript SDK classes:
 *
 * - `ZKEd25519Keypair` wraps `Ed25519Keypair`
 * - `ZKSecp256r1Keypair` wraps `Secp256r1Keypair`
 * - `ZKWebCryptoSigner` wraps `WebCryptoSigner`
 *
 * Each keeps the same signing surface as its underlying signer and adds
 * proof-aware behavior through `applyZKProof`.
 *
 * After you call `applyZKProof` on one of these classes, its implementation of
 * `signWithIntent` performs the extra work needed to build a zkLogin signature.
 * In practice, you use them like the normal Mysten Labs signing classes, but the
 * signatures you receive will be zkLogin signatures once proof data has been
 * applied. If you do not call `applyZKProof`, they behave the same as the
 * Mysten Labs classes they replace.
 *
 * ### Ed25519 quick example
 *
 * ```ts
 * import { ZKEd25519Keypair } from '@evefrontier/wallet-core/crypto'
 *
 * const signer = ZKEd25519Keypair.generate()
 *
 * signer.applyZKProof({
 *   maxEpoch,
 *   userSalt,
 *   keyClaimName: 'sub',
 *   keyClaimValue: sub,
 *   aud,
 *   partialZkLoginSignature,
 * })
 *
 * const { signature, bytes } = await signer.signTransaction(txBytes)
 * ```
 */
export { type RawSignParams, signWithIntent } from './sign-with-intent'
export type {
  Constructor,
  IntentSigner,
  ZKProofHandling,
} from './zk-common'
export {
  isPartialZKLoginSignature,
  withZKProofHandling,
  ZKProofHandler,
} from './zk-common'
export { ZKEd25519Keypair } from './zk-ed25519-keypair'
export {
  getZkProofResponseErrorMessage,
  loadZkProof,
  parseZkProofResponse,
} from './zk-proof-response'
export { ZKSecp256r1Keypair } from './zk-secp256r1-keypair'
export { createZkLoginSignature } from './zk-signature'
export type {
  CreateZkLoginSignatureParams,
  ZkLoginClaims,
  ZkProofResponseLike,
} from './zk-types'

export { ZKWebCryptoSigner } from './zk-webcrypto-signer'
