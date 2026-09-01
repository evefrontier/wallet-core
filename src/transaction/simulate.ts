import type { SuiClientTypes } from '@mysten/sui/client'
import type { SuiGrpcClient } from '@mysten/sui/grpc'
import {
  normalizeSuiAddress,
  parseStructTag,
  SUI_DECIMALS,
} from '@mysten/sui/utils'
import { formatByDecimals, formatMistToSui } from '#src/utils'

// Fallback coin type for balance changes whose `coinType` comes back empty:
// the fullnode reports gas movement against native SUI without a type tag.
const SUI_COIN_TYPE = '0x2::sui::SUI'

// On-chain coin decimals are stored as a `u8`, so 255 is the protocol ceiling;
// anything above it (or non-integer/negative) is a bogus resolver value.
const MAX_COIN_DECIMALS = 255

// `decimals` comes from an injected resolver. Treat it as untrusted: a
// negative, non-integer, NaN, or out-of-range value would make
// `formatByDecimals` throw (`BigInt(NaN)`, `10n ** BigInt(-1)`) or allocate an
// enormous string. Fall back to SUI's decimals for anything outside u8 range.
function sanitizeDecimals(decimals: number | undefined): number {
  if (
    decimals === undefined ||
    !Number.isInteger(decimals) ||
    decimals < 0 ||
    decimals > MAX_COIN_DECIMALS
  ) {
    return SUI_DECIMALS
  }
  return decimals
}

// Ask the fullnode for the full effect surface: net balance deltas, parsed
// effects (status, gas, changed objects, digest), the type of every changed
// object, and emitted events, so the approval popup can show what the
// transaction actually does.
const SIMULATE_INCLUDE = {
  effects: true,
  balanceChanges: true,
  objectTypes: true,
  events: true,
} as const

type SimulateResult = SuiClientTypes.SimulateTransactionResult<
  typeof SIMULATE_INCLUDE
>

/** Coin display facts a caller resolves for a coin type. */
export type CoinMetadata = {
  decimals?: number
  symbol?: string
  name?: string
}

/**
 * Resolves display facts for a coin type. Injected so this module stays free of
 * any particular metadata source (GraphQL query, cache, static table). Return
 * `null` when nothing is known; the simulation falls back to 9 decimals and a
 * symbol derived from the coin type.
 */
export type CoinMetadataResolver = (
  coinType: string,
) => Promise<CoinMetadata | null>

export type SimulatedBalanceChange = {
  coinType: string
  symbol: string
  name?: string
  /** Formatted absolute amount, e.g. "12.5". */
  amount: string
  /** True when the account's balance of this coin decreases. */
  isDebit: boolean
}

export type ObjectChangeKind =
  | 'created'
  | 'mutated'
  | 'deleted'
  | 'published'
  | 'unknown'

export type SimulatedObjectChange = {
  objectId: string
  kind: ObjectChangeKind
  objectType?: string
  /**
   * Owner before/after, as display tokens: an address, `shared`, `immutable`,
   * or `object:0x…`. Only set when the transition is meaningful (a created
   * object's new owner, or a mutated object whose owner changed).
   */
  ownerBefore?: string
  ownerAfter?: string
}

export type SimulatedEvent = {
  /** Full Move type, e.g. `0xpkg::market::Sale`. */
  type: string
  /** `module::StructName`, for a compact label. */
  label: string
  /** Decoded Move struct data, when the node could render it. */
  json?: unknown
}

export type SimulatedGas = {
  /** All formatted in SUI. */
  computation: string
  storage: string
  rebate: string
  /** Net fee = computation + storage − rebate. */
  net: string
}

export type TransactionSimulation = {
  status: 'success' | 'failure'
  /** Set when the transaction would fail on-chain. */
  error?: string
  /** Projected transaction digest. */
  digest: string
  gas: SimulatedGas
  /** Net balance changes for the sender; the SUI line already reflects gas. */
  balanceChanges: SimulatedBalanceChange[]
  changedObjects: SimulatedObjectChange[]
  events: SimulatedEvent[]
}

/**
 * Extracts the symbol from a coin type string, e.g. `0x2::sui::SUI` -> `SUI`.
 * Falls back to naive `::` splitting if the type tag cannot be parsed.
 */
function extractSymbolFromCoinType(coinType: string): string {
  try {
    const struct = parseStructTag(coinType)
    return struct.name || coinType
  } catch {
    const parts = coinType.split('::')
    return parts[parts.length - 1] || coinType
  }
}

// Both `Transaction` and `FailedTransaction` responses carry effects (a failed
// simulation still reports the gas it consumed), so read whichever is present.
// Any other shape is unrecognized: return undefined so the caller treats the
// simulation as unavailable rather than rendering an empty phantom success.
function getInner(result: SimulateResult) {
  if (result.$kind === 'Transaction') return result.Transaction
  if (result.$kind === 'FailedTransaction') return result.FailedTransaction
  return undefined
}

function buildGas(
  gas: SuiClientTypes.GasCostSummary | undefined,
): SimulatedGas {
  const computation = BigInt(gas?.computationCost ?? '0')
  const storage = BigInt(gas?.storageCost ?? '0')
  const rebate = BigInt(gas?.storageRebate ?? '0')
  return {
    computation: formatMistToSui(computation),
    storage: formatMistToSui(storage),
    rebate: formatMistToSui(rebate),
    net: formatMistToSui(computation + storage - rebate),
  }
}

function objectChangeKind(
  change: SuiClientTypes.ChangedObject,
): ObjectChangeKind {
  if (change.idOperation === 'Deleted') return 'deleted'
  // A published package is `Created` + `PackageWrite`; check the output state
  // first so it is labeled `published` rather than a plain `created` object.
  if (change.outputState === 'PackageWrite') return 'published'
  if (change.idOperation === 'Created') return 'created'
  if (change.outputState === 'ObjectWrite') return 'mutated'
  return 'unknown'
}

// Collapses an ObjectOwner into a single display token: an address, or one of
// the shorthand kinds. Returns undefined for unknown/absent owners.
function describeOwner(
  owner: SuiClientTypes.ObjectOwner | null | undefined,
): string | undefined {
  if (!owner) return undefined
  switch (owner.$kind) {
    case 'AddressOwner':
      return owner.AddressOwner
    case 'ObjectOwner':
      return `object:${owner.ObjectOwner}`
    case 'ConsensusAddressOwner':
      return owner.ConsensusAddressOwner.owner
    case 'Shared':
      return 'shared'
    case 'Immutable':
      return 'immutable'
    default:
      return undefined
  }
}

function buildChangedObjects(
  effects: SuiClientTypes.TransactionEffects | undefined,
  objectTypes: Record<string, string> | undefined,
): SimulatedObjectChange[] {
  return (effects?.changedObjects ?? []).map((change) => {
    const before = describeOwner(change.inputOwner)
    const after = describeOwner(change.outputOwner)
    // Only surface ownership when it tells a story: a brand-new owner, or a
    // change of hands. A mutation that leaves the owner untouched adds noise.
    const ownerChanged = change.idOperation === 'Created' || before !== after
    const objectType = objectTypes?.[change.objectId]
    return {
      objectId: change.objectId,
      kind: objectChangeKind(change),
      ...(objectType != null ? { objectType } : {}),
      ...(ownerChanged && before ? { ownerBefore: before } : {}),
      ...(ownerChanged && after ? { ownerAfter: after } : {}),
    }
  })
}

function buildEvents(
  events: SuiClientTypes.Event[] | undefined,
): SimulatedEvent[] {
  return (events ?? []).map((event) => {
    // eventType is `pkg::module::Name`, optionally with generics like
    // `pkg::module::Name<0x2::sui::SUI>`. Drop any type parameters first so the
    // `::` inside them doesn't leak into the `module::Name` tail we keep.
    const base = event.eventType.split('<')[0] ?? event.eventType
    const label = base.split('::').slice(-2).join('::')
    return {
      type: event.eventType,
      label,
      ...(event.json != null ? { json: event.json } : {}),
    }
  })
}

async function enrichBalanceChanges(
  changes: SuiClientTypes.BalanceChange[],
  resolveCoinMetadata: CoinMetadataResolver,
): Promise<SimulatedBalanceChange[]> {
  // Drop zero-amount changes, then resolve metadata concurrently — the lookups
  // are independent, so awaiting them one-by-one would serialize a round-trip
  // per coin type. `Promise.all` preserves input order.
  const nonZero = changes.filter((change) => BigInt(change.amount) !== 0n)
  return Promise.all(
    nonZero.map(async (change): Promise<SimulatedBalanceChange> => {
      const amount = BigInt(change.amount)
      const coinType = change.coinType || SUI_COIN_TYPE
      const metadata = await resolveCoinMetadata(coinType)
      const decimals = sanitizeDecimals(metadata?.decimals)
      const abs = amount < 0n ? -amount : amount

      return {
        coinType,
        symbol: metadata?.symbol ?? extractSymbolFromCoinType(coinType),
        ...(metadata?.name != null ? { name: metadata.name } : {}),
        amount: formatByDecimals(abs.toString(), decimals),
        isDebit: amount < 0n,
      }
    }),
  )
}

function buildFailureSimulation({
  error,
  digest,
  effects,
  objectTypes,
  events,
}: {
  error: string
  digest?: string | undefined
  effects?: SuiClientTypes.TransactionEffects | undefined
  objectTypes?: Record<string, string> | undefined
  events?: SuiClientTypes.Event[] | undefined
}): TransactionSimulation {
  return {
    status: 'failure',
    error,
    digest: digest ?? '',
    gas: buildGas(effects?.gasUsed),
    balanceChanges: [],
    changedObjects: buildChangedObjects(effects, objectTypes),
    events: buildEvents(events),
  }
}

// Matches the failed simulate result `SimulationError` from `Transaction#build()`
// attaches as `.cause` (@mysten/sui `client/core-resolver.ts` `setGasBudget`).
function isFailedSimulationCause(cause: unknown): cause is {
  $kind: 'FailedTransaction'
  FailedTransaction: {
    effects?: SuiClientTypes.TransactionEffects
    digest?: string
    objectTypes?: Record<string, string>
    events?: SuiClientTypes.Event[]
  }
} {
  return (
    !!cause &&
    typeof cause === 'object' &&
    (cause as { $kind?: unknown }).$kind === 'FailedTransaction' &&
    'FailedTransaction' in cause
  )
}

// Reads the parsed `ExecutionError` a `SimulationError` carries on
// `.executionError`; survives bundling that drops `.cause`.
function extractExecutionError(err: Error): { message?: string } | undefined {
  const executionError = (err as { executionError?: unknown }).executionError
  return executionError && typeof executionError === 'object'
    ? (executionError as { message?: string })
    : undefined
}

// Canonical gRPC status names, matched against `RpcError.code` on the error's
// `.cause` — a string like `'UNAVAILABLE'` set from grpcweb's `GrpcStatusCode`.
// Hardcoded rather than imported: the names are gRPC-spec stable, and comparing
// strings keeps this decoupled from the transport library that produced them.
const TRANSIENT_RPC_CODES = new Set([
  'CANCELLED',
  'DEADLINE_EXCEEDED',
  'UNAVAILABLE',
  'ABORTED',
  'RESOURCE_EXHAUSTED',
])
const DETERMINISTIC_RPC_CODES = new Set([
  'INVALID_ARGUMENT',
  'FAILED_PRECONDITION',
  'OUT_OF_RANGE',
  'NOT_FOUND',
  'UNIMPLEMENTED',
  'PERMISSION_DENIED',
  'UNAUTHENTICATED',
])

// Retryable transport/contention failures — outcome unknown. This wins over the
// deterministic check, so HTTP codes match only in context (never a bare `503`,
// which could be a Move abort code) to avoid masking a real failure as retryable.
const TRANSIENT_MESSAGE =
  /time ?out|timed out|unavailable|temporarily|overloaded|connection|failed to connect|fetch failed|requires a connection|reserved for another transaction|equivocated|(?:\bhttp\b[\s/:]*|\bstatus\b[\s:]*(?:code)?[\s:]*)(?:403|429|502|503|504)\b|\b(?:403|429|502|503|504)\s+(?:forbidden|too many|bad gateway|service unavailable|gateway time)|-32050|-32604/i
// Failures the node reports before execution that the transaction cannot recover
// from as-is (gas/balance shortfalls, input validation, verification).
const DETERMINISTIC_MESSAGE =
  /insufficient|no valid gas coins|gas selection|could not automatically determine a budget|unusedvalue|vmverification|deserialization|move ?abort|transaction inputs|validator signing failed|invalid sui address|unresolved address|-32002/i

function rpcCode(cause: unknown): string | undefined {
  const code =
    cause && typeof cause === 'object'
      ? (cause as { code?: unknown }).code
      : undefined
  return typeof code === 'string' ? code : undefined
}

/**
 * Inspects an error thrown while building/simulating a transaction and decides
 * whether it represents a deterministic on-chain failure (return a failure
 * simulation) or a transient/unknown transport error (return `null`, so the
 * caller treats the simulation as unavailable rather than a certain failure).
 */
export function classifyBuildFailure(
  err: unknown,
): TransactionSimulation | null {
  if (!(err instanceof Error)) return null

  const executionError = extractExecutionError(err)

  // `.cause` carries full effects (gas, digest, changed objects).
  const cause = (err as Error & { cause?: unknown }).cause
  if (isFailedSimulationCause(cause)) {
    const inner = cause.FailedTransaction
    return buildFailureSimulation({
      error:
        inner.effects?.status.error?.message ??
        executionError?.message ??
        err.message,
      digest: inner.effects?.transactionDigest ?? inner.digest,
      effects: inner.effects,
      objectTypes: inner.objectTypes,
      events: inner.events,
    })
  }

  // `.cause` dropped; report the abort without effect detail.
  if (executionError) {
    return buildFailureSimulation({
      error: executionError.message ?? err.message,
    })
  }

  // Transient first, so an incidental substring can't label a retryable error
  // as a certain failure. Unrecognized errors fall through to unavailable.
  const code = rpcCode(cause)
  if (
    (code && TRANSIENT_RPC_CODES.has(code)) ||
    TRANSIENT_MESSAGE.test(err.message)
  ) {
    return null
  }
  if (
    (code && DETERMINISTIC_RPC_CODES.has(code)) ||
    DETERMINISTIC_MESSAGE.test(err.message)
  ) {
    return buildFailureSimulation({ error: err.message })
  }

  return null
}

/**
 * Simulates already-built transaction bytes and shapes the fullnode response
 * into the projected effect on the sender's account. Throws on transport
 * failure so callers can distinguish "simulation unavailable" from "the
 * transaction would fail on-chain".
 *
 * @param resolveCoinMetadata - Resolver for coin display facts (decimals,
 *   symbol, name). Inject your own metadata source; see {@link CoinMetadataResolver}.
 */
export async function simulateTransactionOutcome({
  transactionBytes,
  sender,
  suiClient,
  resolveCoinMetadata,
}: {
  transactionBytes: Uint8Array
  sender: string
  suiClient: SuiGrpcClient
  resolveCoinMetadata: CoinMetadataResolver
}): Promise<TransactionSimulation> {
  const result = await suiClient.simulateTransaction({
    transaction: transactionBytes,
    include: SIMULATE_INCLUDE,
  })

  const inner = getInner(result)
  if (!inner) {
    throw new Error(`Unrecognized simulation response: ${result.$kind}`)
  }
  const effects = inner.effects
  const gas = buildGas(effects?.gasUsed)
  const digest = effects?.transactionDigest ?? inner.digest ?? ''
  const changedObjects = buildChangedObjects(effects, inner.objectTypes)
  const events = buildEvents(inner.events)

  if (effects?.status.success === false) {
    return buildFailureSimulation({
      error: effects.status.error?.message ?? 'Transaction would fail',
      digest,
      effects,
      objectTypes: inner.objectTypes,
      events: inner.events,
    })
  }

  // Normalize both sides before comparing
  const normalizedSender = normalizeSuiAddress(sender)
  const senderChanges = (inner.balanceChanges ?? []).filter(
    (bc) => normalizeSuiAddress(bc.address) === normalizedSender,
  )

  return {
    status: 'success',
    digest,
    gas,
    balanceChanges: await enrichBalanceChanges(
      senderChanges,
      resolveCoinMetadata,
    ),
    changedObjects,
    events,
  }
}
