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
 */
export {
  type ParseTransactionBytesResult,
  parseTransactionBytes,
} from './parse'
