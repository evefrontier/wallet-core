# signer-core

Core signing utilities for Eve Frontier wallets.

## Status

Early version. APIs may evolve as wallet and zkLogin based signing requirements mature.

## Requirements

- Node.js 22 or newer
- pnpm 10.33.0 (project package manager)

This package is published as TypeScript source files. Consumers should use a TypeScript-aware toolchain (for example Vite, Next.js, tsx, or another bundler/compiler that handles TypeScript source imports).

## Install

Install from npm (when published):

```bash
npm install @evefrontier/signer-core
```

Or with pnpm:

```bash
pnpm add @evefrontier/signer-core
```

## API Surface

Supported package subpath exports:

- @evefrontier/signer-core/crypto
- @evefrontier/signer-core/wallet-standard
- @evefrontier/signer-core/definitions

## Usage

### Import

Example imports:

```ts
import { ZKEd25519Keypair } from '@evefrontier/signer-core/crypto'
import { SponsoredTransactionActions } from '@evefrontier/signer-core/definitions'
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
pnpm install
pnpm exec playwright install
```

Run checks:

```bash
pnpm run build
pnpm run lint
pnpm run test
```

## Packaging

Create a local package tarball:

```bash
pnpm install
pnpm run build
pnpm pack
```

Install that tarball into another project:

```bash
pnpm add /absolute/path/to/evefrontier-signer-core-0.0.1.tgz
```

If needed, validate consumption in the consumer project with TypeScript:

```bash
npx tsc --noEmit
```

## Notes

- Add to ZKProofData maxEpochTimestampMs: number
  evevault has this for refreshing zklogin
  see getCurrentEpochFromRpc getCurrentEpochFromGraphQL for details (in evevault)

