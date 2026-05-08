# wallet-core

Core signing utilities for Eve Frontier wallets.

## Status

Early version. APIs may evolve as wallet and zkLogin based signing requirements mature.

## Requirements

- Node.js 22 or newer
- bun 1.3.13 (project package manager)

This package is published as TypeScript source files. Consumers should use a TypeScript-aware toolchain (for example Vite, Next.js, tsx, or another bundler/compiler that handles TypeScript source imports).

## Install

Install from npm (when published):

```bash
npm install @evefrontier/wallet-core
```

Or with bun:

```bash
bun add @evefrontier/wallet-core
```

## API Surface

Supported package subpath exports:

- @evefrontier/wallet-core/crypto
- @evefrontier/wallet-core/definitions
- @evefrontier/wallet-core/types
- @evefrontier/wallet-core/utils
- @evefrontier/wallet-core/wallet-standard-extensions

## Usage

### Import

Example imports:

```ts
import { ZKEd25519Keypair } from '@evefrontier/wallet-core/crypto'
import { SponsoredTransactionActions } from '@evefrontier/wallet-core/definitions'
```

Keypair signers available are:
- ZKEd25519Keypair
- ZKSecp256r1Keypair
- ZKWebCryptoSigner

### Creating a signer

These can be instantiated as follows:
```ts
// ZKEd25519Keypair
const keypair = new ZKEd25519Keypair()
// or 
const keypair = ZKEd25519Keypair.generate()

// ZKSecp256r1Keypair
const keypair = new ZKSecp256r1Keypair()

// ZKWebCryptoSigner
const keypair = await ZKWebCryptoSigner.generate()
```

### Applying ZK Login proof data

After creating a signer the public key can be obtained to perform the ZK Login

```ts
const publicKey = keypair.getPublicKey()
```

Then when the partial ZK login signature, salt, max epoch and `sub` and `aud` claims
from the JWT are available, they can be applied to the keypair classes by using
`applyZKProof`. This allows the signing to be done as follows. Assuming a standard
Sui gRPC client.

### Signing a transaction

Signing a transaction can be done as follows

```ts
const suiClient = getNewSuiGrpcClient() // returns a SuiGrpcClient
const tx = Transaction.from(transaction as string)
tx.setSenderIfNotSet(userAddress as string)
const txBytes = await tx.build({ client: suiClient })
const { signature, bytes } = await keypair.signTransaction(txBytes)
```

Signing and executing can be done as follows:

```ts
const client = getNewSuiGrpcClient() // returns a SuiGrpcClient

const tx = Transaction.from(transaction as string)
tx.setSenderIfNotSet(userAddress as string)
const txb = await tx.build({ client })
const txResult = await client.core.signAndExecuteTransaction({
  transaction: txb,
  signer: keypair,
  additionalSignatures: [],
  include: {
    effects: true,
  },
})
```

### Signing a personal message

Signing a personal message can be done as follows:

```ts
const message = fromBase64('SGVsbG8gV29ybGQ=')
const { signature, bytes } =
  await keypair.signPersonalMessage(message)
```

## Local Development

Setup:

```bash
 bun install
 bunx playwright install --with-deps chromium
```

Run checks:

```bash
bun run build
bun run lint
bun run test
```

## Packaging

Create a local package tarball:

```bash
bun install
bun run build
bun pm pack
```

Install that tarball into another project:

```bash
bun add /absolute/path/to/evefrontier-wallet-core-0.0.1.tgz
```

If needed, validate consumption in the consumer project with TypeScript:

```bash
npx tsc --noEmit
```

## Notes

- Add to ZKProofData maxEpochTimestampMs: number
  evevault has this for refreshing zklogin
  see getCurrentEpochFromRpc getCurrentEpochFromGraphQL for details (in evevault)

