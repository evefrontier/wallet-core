/**
 * @packageDocumentation
 *
 * Transaction input normalization for wallet approval and signing flows.
 *
 * Wallets receive pending transactions in several shapes: BCS bytes as
 * base64, serialized transaction objects (JSON or already-parsed), and a
 * deprecated comma-separated decimal byte format still emitted by older
 * dapps. `parseTransactionBytes` accepts any of them and produces:
 *
 * - `displayValue` — pretty-printed JSON for approval/review UIs
 * - `reviewValue` — the parsed transaction for programmatic risk review
 *   (e.g. `isAddressAliasCall` from the `./address-alias` entrypoint)
 * - `transactionForSigning` — a string `Transaction.from()` accepts
 *   (normalized base64 for byte inputs, JSON for object inputs)
 *
 * It never throws: uninterpretable input comes back with only
 * `displayValue`, so review UIs can surface it without offering signing.
 *
 * ### Quick example
 *
 * ```ts
 * import { parseTransactionBytes } from '@evefrontier/wallet-core/transaction'
 * import { Transaction } from '@mysten/sui/transactions'
 *
 * const { displayValue, reviewValue, transactionForSigning } =
 *   await parseTransactionBytes(pendingTransaction)
 *
 * if (!transactionForSigning) {
 *   return showUnsignableWarning(displayValue)
 * }
 * const tx = Transaction.from(transactionForSigning)
 * ```
 *
 * ### Simulating the outcome
 *
 * Once a transaction is built, `simulateTransactionOutcome` asks the fullnode
 * for its projected effect on the sender's account — net balance changes, gas,
 * changed objects, and emitted events — shaped for an approval popup. Coin
 * display facts (decimals, symbol, name) are resolved through an injected
 * {@link CoinMetadataResolver}, so this package stays free of any particular
 * metadata source. `classifyBuildFailure` turns an error thrown while
 * building/simulating into a predicted failure, or `null` when the failure is
 * transient and the outcome is unknown.
 *
 * ```ts
 * import {
 *   simulateTransactionOutcome,
 *   classifyBuildFailure,
 * } from '@evefrontier/wallet-core/transaction'
 *
 * try {
 *   const outcome = await simulateTransactionOutcome({
 *     transactionBytes,
 *     sender,
 *     suiClient,
 *     resolveCoinMetadata: (coinType) => myMetadataSource(coinType),
 *   })
 * } catch (err) {
 *   const predicted = classifyBuildFailure(err)
 *   if (!predicted) throw err // simulation unavailable
 * }
 * ```
 */
export {
  type ParseTransactionBytesResult,
  parseTransactionBytes,
} from './parse'
export {
  PREDICTED_FAILURE_ACKNOWLEDGEMENT,
  requiresAcknowledgement,
  reviewTransaction,
  type TransactionRiskFinding,
  type TransactionRiskSeverity,
} from './review'
export {
  type CoinMetadata,
  type CoinMetadataResolver,
  classifyBuildFailure,
  type ObjectChangeKind,
  type SimulatedBalanceChange,
  type SimulatedEvent,
  type SimulatedGas,
  type SimulatedObjectChange,
  simulateTransactionOutcome,
  type TransactionSimulation,
} from './simulate'
