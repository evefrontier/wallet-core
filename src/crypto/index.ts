export type { RawSignParams } from './sign-with-intent'
export { signWithIntent } from './sign-with-intent'
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
