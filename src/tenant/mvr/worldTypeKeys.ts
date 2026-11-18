/**
 * Canonical EVE World Move types the dapp interpolates into GraphQL/gRPC
 * `type:` filters and event subscriptions, plus the literal MVR type names that
 * seed `@mysten/mvr-static` generation.
 *
 * World is split into one Move package per `contracts/<package>` directory of
 * world-contracts, each registered on MVR as
 * `@evefrontier/world-<package>-<tier>` (underscores become dashes; the live
 * tier has no suffix), e.g. `@evefrontier/world-generic-module-dev`.
 *
 * Each Move type is pinned to the package version in which it was FIRST defined
 * (its type-origin), which differs per type and is NOT the latest upgrade nor
 * necessarily version 1. A single package id therefore cannot be interpolated
 * into every type string; each type must be resolved individually.
 * `mvrCache.generated.ts` embeds those resolutions; regenerate it with
 * `bun run gen:mvr` after any world-contract upgrade.
 */

/** World Move packages, named as in world-contracts `contracts/<package>`. */
export const WORLD_PACKAGES = [
  'core',
  'character',
  'creation',
  'generic_module',
  'inventory',
  'power',
  'metadata',
  'killmail',
] as const

export type WorldPackage = (typeof WORLD_PACKAGES)[number]

/**
 * Package-qualified `package::module::Type` keys, the single source of truth
 * for what we resolve. The first key of each package anchors its package id.
 */
export const WORLD_TYPE_KEYS = [
  'core::object_registry::ObjectRegistry',
  'core::entity_key::EntityKey',
  'core::access_cap::AccessCap',
  'core::entity::Entity',
  'character::identity::Identity',
  'character::identity::CharacterCreated',
  'creation::layout::Layout',
  'generic_module::generic_module::GenericModule',
  'inventory::inventory::Inventory',
  'inventory::item::Item',
  'inventory::item::ItemMinted',
  'inventory::item::ItemBurned',
  'power::fuel::Fuel',
  'metadata::metadata::Metadata',
  'killmail::record::Killmail',
  'killmail::record::KillmailCreated',
] as const

export type WorldTypeKey = (typeof WORLD_TYPE_KEYS)[number]

/**
 * Fully-qualified MVR type-name literals for every world package, read by the
 * `@mysten/mvr-static` scanner (which matches literal `name::module::Type`
 * strings, not our dynamically-built ones). Not read at runtime — the generated
 * cache is. Keep in sync with {@link WORLD_TYPE_KEYS}. Only tiers registered on
 * MVR are listed; add `-test`/`-uat`/`-ptu`/live as they are published.
 */
export const WORLD_MVR_SCAN_SEED = [
  '@evefrontier/world-core-dev::object_registry::ObjectRegistry',
  '@evefrontier/world-core-dev::entity_key::EntityKey',
  '@evefrontier/world-core-dev::access_cap::AccessCap',
  '@evefrontier/world-core-dev::entity::Entity',
  '@evefrontier/world-character-dev::identity::Identity',
  '@evefrontier/world-character-dev::identity::CharacterCreated',
  '@evefrontier/world-creation-dev::layout::Layout',
  '@evefrontier/world-generic-module-dev::generic_module::GenericModule',
  '@evefrontier/world-inventory-dev::inventory::Inventory',
  '@evefrontier/world-inventory-dev::item::Item',
  '@evefrontier/world-inventory-dev::item::ItemMinted',
  '@evefrontier/world-inventory-dev::item::ItemBurned',
  '@evefrontier/world-power-dev::fuel::Fuel',
  '@evefrontier/world-metadata-dev::metadata::Metadata',
  '@evefrontier/world-killmail-dev::record::Killmail',
  '@evefrontier/world-killmail-dev::record::KillmailCreated',
] as const

/**
 * EVE token (`EVE::EVE` coin type) MVR literals across every currency tier, read
 * by the `@mysten/mvr-static` scanner. Not read at runtime — the generated cache
 * is. Keep in sync with the currency tiers in tenants.ts.
 */
export const CURRENCY_MVR_SCAN_SEED = [
  '@evefrontier/currency::EVE::EVE',
  '@evefrontier/currency-dev::EVE::EVE',
  '@evefrontier/currency-test::EVE::EVE',
  '@evefrontier/currency-uat::EVE::EVE',
  '@evefrontier/currency-ptu::EVE::EVE',
] as const
