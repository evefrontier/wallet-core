import { PasskeyKeypair } from '@mysten/sui/keypairs/passkey'
import { Secp256r1Keypair } from '@mysten/sui/keypairs/secp256r1'
import { isValidSuiAddress, toBase64 } from '@mysten/sui/utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  provisionPasskeyAlias,
  recoverPasskeyKeypair,
} from '#src/address-alias'

/**
 * True only in the node project. In a real browser `window` is non-configurable,
 * so the environment-guard tests (which need to remove or downgrade `window`)
 * run node-only; the browser project exercises the guard against its real DOM.
 */
const NODE_ONLY = typeof window === 'undefined'

/**
 * Provides a browser-like environment when running under node so the passkey env
 * guard passes. In the real browser project the DOM already satisfies it, so
 * this is a no-op there (and stubbing `window` would throw).
 */
function stubBrowserEnv(): void {
  if (NODE_ONLY) {
    vi.stubGlobal('window', {
      isSecureContext: true,
      location: { hostname: 'example.com' },
    })
    vi.stubGlobal('navigator', { credentials: {} })
  }
}

/** A fake PasskeyKeypair whose public key resolves to a known address. */
function fakeKeypair(address: string, publicKeyBytes: Uint8Array) {
  return {
    getPublicKey: () => ({
      toSuiAddress: () => address,
      toBase64: () => toBase64(publicKeyBytes),
    }),
    getCredentialId: () => new Uint8Array([1, 2, 3]),
  } as unknown as PasskeyKeypair
}

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('provisionPasskeyAlias', () => {
  it('returns the credential address, base64 public key, and credential id', async () => {
    stubBrowserEnv()
    const address = `0x${'d'.repeat(64)}`
    const publicKeyBytes = new Uint8Array(33).fill(7)
    const spy = vi
      .spyOn(PasskeyKeypair, 'getPasskeyInstance')
      .mockResolvedValue(fakeKeypair(address, publicKeyBytes))

    const result = await provisionPasskeyAlias({
      appName: 'Eve Frontier',
      rpId: 'example.com',
    })

    expect(spy).toHaveBeenCalledOnce()
    expect(result.source).toBe('passkey')
    expect(result.address).toBe(address)
    expect(result.publicKey).toBe(toBase64(publicKeyBytes))
    expect(result.credentialId).toBe(toBase64(new Uint8Array([1, 2, 3])))
    expect(result.keypair).toBeDefined()
  })

  it.runIf(NODE_ONLY)(
    'throws a clear error when WebAuthn is unavailable',
    async () => {
      vi.stubGlobal('window', undefined)
      vi.stubGlobal('navigator', undefined)

      await expect(
        provisionPasskeyAlias({ appName: 'Eve Frontier', rpId: 'example.com' }),
      ).rejects.toThrow(/browser environment with WebAuthn/)
    },
  )

  it.runIf(NODE_ONLY)('throws in an insecure context', async () => {
    vi.stubGlobal('window', {
      isSecureContext: false,
      location: { hostname: 'example.com' },
    })
    vi.stubGlobal('navigator', { credentials: {} })

    await expect(
      provisionPasskeyAlias({ appName: 'Eve Frontier' }),
    ).rejects.toThrow(/secure context/)
  })
})

describe('recoverPasskeyKeypair', () => {
  it('rebuilds the keypair directly from a stored public key', async () => {
    // A real 33-byte compressed secp256r1 public key, as a passkey would carry.
    const publicKeyBytes = Secp256r1Keypair.generate()
      .getPublicKey()
      .toRawBytes()
    const publicKey = toBase64(publicKeyBytes)

    const keypair = await recoverPasskeyKeypair({
      provider: {} as never,
      publicKey,
    })

    expect(keypair.getPublicKey().toBase64()).toBe(publicKey)
    expect(isValidSuiAddress(keypair.getPublicKey().toSuiAddress())).toBe(true)
  })

  it('runs the two-signature recovery ceremony when no public key is stored', async () => {
    const target = Secp256r1Keypair.generate().getPublicKey()
    const other = Secp256r1Keypair.generate().getPublicKey()
    // Both ceremonies surface the target key; only the first also surfaces a
    // decoy, so findCommonPublicKey uniquely resolves the target.
    const signAndRecover = vi
      .spyOn(PasskeyKeypair, 'signAndRecover')
      .mockResolvedValueOnce([target, other])
      .mockResolvedValueOnce([target])

    const keypair = await recoverPasskeyKeypair({ provider: {} as never })

    expect(signAndRecover).toHaveBeenCalledTimes(2)
    expect(keypair.getPublicKey().toBase64()).toBe(target.toBase64())
  })
})
