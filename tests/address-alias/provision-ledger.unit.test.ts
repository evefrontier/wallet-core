import { describe, expect, it } from 'vitest'
import { provisionLedgerAlias } from '#src/address-alias'

describe('provisionLedgerAlias', () => {
  // `@mysten/signers` is an optional peer dependency and is intentionally not
  // installed here, so the dynamic import fails and the guard surfaces a clear,
  // actionable error rather than a bare module-resolution failure.
  it('throws a clear error when the optional @mysten/signers package is absent', async () => {
    await expect(
      provisionLedgerAlias({
        ledgerClient: {},
        suiClient: {} as never,
      }),
    ).rejects.toThrow(/optional '@mysten\/signers' package/)
  })

  it('preserves the cause of the module-resolution failure', async () => {
    const error = await provisionLedgerAlias({
      ledgerClient: {},
      suiClient: {} as never,
    }).catch((e: unknown) => e as Error)

    expect(error).toBeInstanceOf(Error)
    expect((error as Error).cause).toBeDefined()
  })

  it('rejects a malformed derivation path before touching the device', async () => {
    await expect(
      provisionLedgerAlias({
        ledgerClient: {},
        suiClient: {} as never,
        // Non-hardened path segments are invalid here (expected a fully-hardened SLIP-0010 Ed25519 path).
        derivationPath: "m/44'/0'/0'/0/0",
      }),
    ).rejects.toThrow(/Invalid Sui derivation path/)
  })
})
