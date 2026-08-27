/**
 * Ledger-backed alias provisioning (`0x2::address_alias`).
 *
 * @experimental This module's API has not been architecturally agreed on and
 * may change or be removed without a major version bump.
 *
 * A Ledger alias registers a Ledger hardware-wallet address as the co-signer, so
 * key continuity is backed by the device's own seed rather than a written-down
 * mnemonic. `provisionLedgerAlias` derives the address to register on-chain with
 * {@link registerAcknowledgedAlias}; the private key stays on the device and
 * every signature requires physical confirmation.
 *
 * The Ledger tooling is an *optional* dependency: this module dynamically
 * imports `@mysten/signers/ledger`, so consumers who never provision a Ledger
 * alias need not install it (nor `@mysten/ledgerjs-hw-app-sui` or a
 * `@ledgerhq/hw-transport-*` transport). Construct the `SuiLedgerClient`
 * yourself and pass it in — the transport lifecycle is the consumer's.
 *
 * Note: `LedgerSigner` only implements `signTransaction` and
 * `signPersonalMessage`; `sign` and `signWithIntent` throw. That matters only if
 * a Ledger signer is later promoted to a primary wrapped signer.
 */

import type { ClientWithCoreApi } from '@mysten/sui/client'
import { isValidHardenedPath, type Signer } from '@mysten/sui/cryptography'
import { DEFAULT_ED25519_DERIVATION_PATH } from '@mysten/sui/keypairs/ed25519'

/**
 * Module specifier resolved at runtime so the optional dep isn't required to
 * type-check. Typed as `string` (not a literal) so the dynamic `import()` does
 * not trigger module resolution against the uninstalled package.
 */
const LEDGER_MODULE: string = '@mysten/signers/ledger'

interface LedgerSignerModule {
  LedgerSigner: {
    fromDerivationPath(
      derivationPath: string,
      ledgerClient: unknown,
      suiClient: ClientWithCoreApi,
    ): Promise<Signer>
  }
}

export interface ProvisionLedgerAliasParams {
  /**
   * A connected `SuiLedgerClient` (from `@mysten/ledgerjs-hw-app-sui`) wrapping a
   * transport such as `@ledgerhq/hw-transport-webhid`. The consumer owns its
   * lifecycle.
   */
  ledgerClient: unknown
  /** Resolves transaction data for signing. */
  suiClient: ClientWithCoreApi
  /**
   * SLIP-0010 hardened Ed25519 path (the scheme the Ledger Sui app uses).
   * Defaults to {@link DEFAULT_ED25519_DERIVATION_PATH} (`m/44'/784'/0'/0'/0'`).
   * A malformed path is rejected before touching the device.
   */
  derivationPath?: string
}

/**
 * A Ledger alias created by {@link provisionLedgerAlias}. Register
 * {@link address} on-chain; re-derive the same address later from the same
 * device and {@link derivationPath}.
 */
export interface LedgerProvisionedAlias {
  source: 'ledger'
  /** The Sui address to register on-chain as the alias. */
  address: string
  /** The derivation path used, so the same address can be reproduced. */
  derivationPath: string
  /** The live Ledger signer for this path. */
  signer: Signer
}

/**
 * Derives a Ledger address for use as an alias. Reads the public key from the
 * device (which may require unlocking it and opening the Sui app) and returns
 * the address to register plus the live signer.
 *
 * Throws a clear error when the optional `@mysten/signers` package is not
 * installed.
 */
export async function provisionLedgerAlias({
  ledgerClient,
  suiClient,
  derivationPath = DEFAULT_ED25519_DERIVATION_PATH,
}: ProvisionLedgerAliasParams): Promise<LedgerProvisionedAlias> {
  if (!isValidHardenedPath(derivationPath)) {
    throw new Error(
      `Invalid Sui derivation path: ${derivationPath}. Expected a SLIP-0010 hardened Ed25519 path, e.g. ${DEFAULT_ED25519_DERIVATION_PATH}.`,
    )
  }

  let module: LedgerSignerModule
  try {
    module = (await import(LEDGER_MODULE)) as LedgerSignerModule
  } catch (cause) {
    throw new Error(
      "Ledger aliases require the optional '@mysten/signers' package (with '@mysten/ledgerjs-hw-app-sui' and a '@ledgerhq/hw-transport-*' transport). Install it to provision a Ledger alias.",
      { cause },
    )
  }

  const signer = await module.LedgerSigner.fromDerivationPath(
    derivationPath,
    ledgerClient,
    suiClient,
  )

  return {
    source: 'ledger',
    address: signer.toSuiAddress(),
    derivationPath,
    signer,
  }
}
