import type { IntentScope, Signer } from '@mysten/sui/cryptography'

export interface RawSignParams {
  sui_address: string
  keypair: Signer
}

/**
 * Signs bytes using the wallet-standard intent methods exposed by Mysten
 * signers and normalizes the returned user signature shape.
 *
 * @deprecated Use `ZKEd25519Keypair`, `ZKSecp256r1Keypair`, or
 * `ZKWebCryptoSigner` instead — they expose `signWithIntent` directly on the
 * keypair instance.
 */
export async function signWithIntent(
  messageBytes: Uint8Array,
  scope: IntentScope,
  params: RawSignParams,
): Promise<{ bytes: string; userSignature: string }> {
  const { sui_address, keypair } = params

  if (!sui_address) {
    throw new Error('[signWithIntent] User address not found')
  }

  if (!keypair) {
    throw new Error('[signWithIntent] Key pair not found')
  }

  const rawSignature =
    scope === 'TransactionData'
      ? await keypair.signTransaction(messageBytes)
      : await keypair.signPersonalMessage(messageBytes)

  if (!rawSignature?.bytes || !rawSignature?.signature) {
    throw new Error('[signWithIntent] Signer returned no signature')
  }

  return {
    bytes: rawSignature.bytes,
    userSignature: rawSignature.signature,
  }
}
