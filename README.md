# wallet-core

Core signing utilities for Eve Frontier wallets.

## Status

Early version. APIs may evolve as wallet and zkLogin based signing requirements mature.

## Requirements

- Node.js 25.6.1 or newer (see `.nvmrc`)
- bun 1.3.13 (project package manager)

This package publishes ESM-only entrypoints and TypeScript declarations from `dist`.

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
- @evefrontier/wallet-core/epoch
- @evefrontier/wallet-core/eve-token
- @evefrontier/wallet-core/sponsored-transaction
- @evefrontier/wallet-core/tenant
- @evefrontier/wallet-core/utils
- @evefrontier/wallet-core/wallet-features

## Usage

### Import

Example imports:

```ts
import { ZKEd25519Keypair, type ZKProofData } from '@evefrontier/wallet-core/crypto'
import { SponsoredTransactionActions } from '@evefrontier/wallet-core/sponsored-transaction'
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

### Applying zkLogin proof data

After creating a signer the public key can be obtained to perform the zkLogin

```ts
const publicKey = keypair.getPublicKey()
```

Then when the partial zkLogin signature, salt, max epoch, and JWT claim data
used for zkLogin address derivation are available, they can be applied to the
keypair classes by using `applyZKProof`.

```ts
keyPair.applyZKProof({
  maxEpoch,
  partialZkLoginSignature,
  userSalt,
  keyClaimName: 'sub',
  keyClaimValue: tokenClaimSub,
  aud: tokenClaimAud,
})
```

`applyZKProof` switches the signer into zkLogin signing mode for future
`signWithIntent`, `signTransaction`, and `signPersonalMessage` calls. The
applied proof data is cloned into the signer, and `getProofData()` also returns
a copy, so mutating the original input or a returned proof-data object does not
mutate the signer's internal proof state. If the supplied partial signature
includes `addressSeed`, wallet-core does not store it; the signer computes the
address seed from `userSalt`, `keyClaimName`, `keyClaimValue`, and
`aud`. Most Enoki-backed flows use `keyClaimName: 'sub'` and pass
the JWT `sub` claim as `keyClaimValue`.

By default, `applyZKProof` validates wallet-core's expected JSON proof-data
shape before storing it:

- `maxEpoch` must be a positive safe integer.
- `partialZkLoginSignature` must match the zkLogin proof input shape, excluding
  `addressSeed`.
- Proof points, `issBase64Details.value`, and `headerBase64` must be strings in
  the expected shape. Empty proof-service strings are not rejected by this shape
  check.
- `issBase64Details.indexMod4` must be an integer in the unsigned 8-bit
  serialization range. wallet-core does not assert an undocumented 0..3 semantic
  range.
- `userSalt` must be a base-10 integer string from `0` to `2^128 - 1`, matching
  the salt bound in the
  [Sui zkLogin integration guide](https://docs.sui.io/sui-stack/zklogin-integration).
- `keyClaimName`, `keyClaimValue`, and `aud` must be non-empty
  JWT claim strings. `keyClaimName` is the zkLogin key claim name used for
  address derivation, typically `sub`; callers using a different stable JWT
  claim should pass that claim name and value.

Passing `{ skipValidation: true }` skips only those explicit validation checks.
The signer still clones the supplied data, removes any supplied `addressSeed`,
and computes its own address seed, so malformed fields can still fail during
address-seed computation or later when they are used for signing.

If no `partialZkLoginSignature` is stored, signing falls back to the underlying
keypair or signer and returns a normal Sui signature.

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
nvm use
bun install
bunx playwright install --with-deps chromium
```

Run checks:

```bash
bun run build
bun run lint
bun run test
bun run test:coverage
```

`bun run test` runs the full Vitest suite, including browser projects, in headless mode. Use `bun run test:node` for the Node-only project and `bun run test:browser` for the browser projects.

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
