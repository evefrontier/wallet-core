/**
 * @packageDocumentation
 *
 * Types and helpers for Eve Frontier sponsored transaction flows.
 *
 * ## Usage
 *
 * The sponsored-transaction entrypoint groups together:
 *
 * - assembly enums and API string mappings used by sponsored transaction APIs
 * - transaction input and output types for the sponsored signing method
 * - `SponsoredTransactionMethod`, the wallet-facing method signature
 *
 * These exports are intended to be shared between transaction-building code and
 * wallet feature definitions so both sides agree on payload shape.
 *
 * ### Quick example
 *
 * ```ts
 * import {
 *   Assemblies,
 *   getAssemblyTypeApiString,
 *   type SponsoredTransactionInput,
 * } from '@evefrontier/wallet-core/sponsored-transaction'
 *
 * const input: SponsoredTransactionInput = {
 *   txAction: 'online',
 *   assembly: 42,
 *   assemblyType: getAssemblyTypeApiString(Assemblies.SmartStorageUnit),
 * }
 * ```
 */
export * from './assemblies'
export * from './wallet-standard-extension-method'
