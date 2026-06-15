import type { IntentScope, SignatureWithBytes } from '@mysten/sui/cryptography'
import { genAddressSeed, getZkLoginSignature } from '@mysten/sui/zklogin'
import type { PartialZkLoginSignature, ZKProofData } from '#src/types'
import {
  is3x2ArrayOfStrings,
  isNonEmptyString,
  isObjectRecord,
  isPositiveSafeInteger,
  isStringArrayWithLength,
  isUint8Integer,
  isUnsignedDecimalIntegerStringBelow,
} from '#src/utils/validation'

/**
 * Constructor constraint used by `withZKProofHandling`.
 * @category Supporting Types and Utilities
 */
export type Constructor<TInstance = object> = abstract new (
  // biome-ignore lint/suspicious/noExplicitAny: TypeScript mixin constructor constraints require any[].
  ...args: any[]
) => TInstance

/**
 * Minimal signer contract expected by `withZKProofHandling`.
 * @category Supporting Types and Utilities
 */
export type IntentSigner = {
  signWithIntent(
    bytes: Uint8Array,
    intent: IntentScope,
  ): Promise<SignatureWithBytes>
}

// Supporting definitions for isPartialZKLoginSignature
// This is for establishing that the expected properties are present.
const PARTIAL_ZK_LOGIN_SIGNATURE_FIELDS = [
  'proofPoints',
  'issBase64Details',
  'headerBase64',
] as const

// Used to establish that the 'issBase64Details' property has the expected shape.
const ISS_BASE64_DETAILS_FIELDS = ['value', 'indexMod4'] as const

// Used to establish that the 'proofPoints' property has the expected shape.
const PROOF_POINTS_ARRAY_FIELDS = ['a', 'b', 'c'] as const

// Sui documents zkLogin user salt as a 16-byte value or integer below 2^128.
const ZK_LOGIN_USER_SALT_UPPER_BOUND = 2n ** 128n

// Helper to check that we have the expected properties.
function hasPartialZKLoginSignatureFields(
  value: Record<string, unknown>,
): boolean {
  return PARTIAL_ZK_LOGIN_SIGNATURE_FIELDS.every((field) => field in value)
}

// Helper to check that the 'issBase64Details' property has the expected shape and type.
function isIssBase64Details(value: unknown): boolean {
  if (!isObjectRecord(value)) {
    return false
  }
  if (!ISS_BASE64_DETAILS_FIELDS.every((property) => property in value)) {
    return false
  }
  if (typeof value.value !== 'string') {
    return false
  }

  return isUint8Integer(value.indexMod4)
}

// Helper to check that the 'proofPoints' property has the expected shape and type.
function isProofPoints(value: unknown): boolean {
  if (!isObjectRecord(value)) {
    return false
  }
  if (!PROOF_POINTS_ARRAY_FIELDS.every((property) => property in value)) {
    return false
  }
  if (!isStringArrayWithLength(value.a, 3)) {
    return false
  }
  if (!is3x2ArrayOfStrings(value.b)) {
    return false
  }

  return isStringArrayWithLength(value.c, 3)
}

function clonePartialZkLoginSignature(
  signature: PartialZkLoginSignature,
): PartialZkLoginSignature {
  return {
    proofPoints: {
      a: [...signature.proofPoints.a],
      b: Array.from(signature.proofPoints.b, (row) => Array.from(row)),
      c: [...signature.proofPoints.c],
    },
    issBase64Details: { ...signature.issBase64Details },
    headerBase64: signature.headerBase64,
  }
}

function cloneZKProofData(zkpd: ZKProofData): ZKProofData {
  return {
    maxEpoch: zkpd.maxEpoch,
    userSalt: zkpd.userSalt,
    keyClaimName: zkpd.keyClaimName,
    keyClaimValue: zkpd.keyClaimValue,
    aud: zkpd.aud,
    ...(zkpd.partialZkLoginSignature
      ? {
          partialZkLoginSignature: clonePartialZkLoginSignature(
            zkpd.partialZkLoginSignature,
          ),
        }
      : {}),
  }
}

/**
 * Checks whether `obj` has the shape required for zkLogin signature inputs
 * supplied by the proving service, excluding `addressSeed`.
 *
 * This verifies JSON/object shape and primitive field types only. It does not
 * verify cryptographic proof validity or add undocumented constraints to proof
 * strings.
 *
 * @param obj {unknown}
 * @returns true if `obj` includes properties with the same shape as a
 * PartialZkLoginSignature
 * @category Supporting Types and Utilities
 */
export function isPartialZKLoginSignature(
  obj: unknown,
): obj is PartialZkLoginSignature {
  if (!isObjectRecord(obj) || !hasPartialZKLoginSignatureFields(obj)) {
    return false
  }

  return (
    isProofPoints(obj.proofPoints) &&
    isIssBase64Details(obj.issBase64Details) &&
    typeof obj.headerBase64 === 'string'
  )
}

/**
 * Proof handling mixin contract exposed by `withZKProofHandling`.
 * @category Supporting Types and Utilities
 */
export type ZKProofHandling = {
  zkProofHandler: ZKProofHandler

  /**
   * Applies proof data that enables zkLogin signing for future signatures.
   *
   * The supplied proof data is cloned before it is stored, and any supplied
   * `partialZkLoginSignature.addressSeed` is not stored. Mutating the input
   * object after this call does not mutate signer state. The returned proof data
   * is also a copy.
   *
   * By default, this validates wallet-core's expected JSON proof-data shape and
   * required fields before storing them. `skipValidation` skips only those
   * explicit checks; cloning, address-seed computation, and later signing can
   * still throw for malformed values.
   *
   * @param zkpd {ZKProofData} Proof data to apply to the signer.
   * @param options Optional object. Set `skipValidation` to skip wallet-core's explicit validation checks.
   * @returns {ZKProofData} A copy of the proof data now stored by the signer.
   */
  applyZKProof(
    zkpd: ZKProofData,
    options?: { skipValidation?: boolean },
  ): ZKProofData

  /**
   * Returns a copy of the zk proof data currently in use.
   *
   * Mutating the returned value does not mutate signer state.
   *
   * @returns {ZKProofData} A copy of the proof data in use.
   */
  getProofData(): ZKProofData

  /**
   * Returns the current address seed that is generated when the proof data is applied.
   * @returns {string} the current address seed
   */
  getAddressSeed(): string
}

/**
 * Adds zkLogin proof-aware behavior to a signer class.
 *
 * The returned class keeps the original constructor arguments unchanged.
 * @param {TBase} Base
 * @returns {InstanceType<TBase> & ZKProofHandling}
 * @category Supporting Types and Utilities
 */
export function withZKProofHandling<TBase extends Constructor<IntentSigner>>(
  Base: TBase,
): abstract new (
  ...args: ConstructorParameters<TBase>
) => InstanceType<TBase> & ZKProofHandling {
  abstract class WithZKProofHandling extends Base {
    protected zkProofHandler: ZKProofHandler = new ZKProofHandler()

    applyZKProof(
      zkpd: ZKProofData,
      options?: { skipValidation?: boolean },
    ): ZKProofData {
      return this.zkProofHandler.applyZKProof(zkpd, options)
    }

    getProofData(): ZKProofData {
      return this.zkProofHandler.getProofData()
    }

    getAddressSeed(): string {
      return this.zkProofHandler.getAddressSeed()
    }

    /**
     * Sign messages with a specific intent. By combining the message bytes with the intent before hashing and signing,
     * it ensures that a signed message is tied to a specific purpose and domain separator is provided
     */
    override async signWithIntent(
      bytes: Uint8Array,
      intent: IntentScope,
    ): Promise<SignatureWithBytes> {
      const signatureWithBytes = await super.signWithIntent(bytes, intent)
      return this.zkProofHandler.processSignature(signatureWithBytes)
    }
  }

  return WithZKProofHandling as unknown as abstract new (
    ...args: ConstructorParameters<TBase>
  ) => InstanceType<TBase> & ZKProofHandling
}

/**
 * Helper that stores zkLogin proof state and transforms signatures into zkLogin signatures.
 * @category Supporting Types and Utilities
 */
export class ZKProofHandler {
  // proof data
  #data: ZKProofData = {
    maxEpoch: 0,
    userSalt: '',
    keyClaimName: '',
    keyClaimValue: '',
    aud: '',
  }
  // runtime state members
  #addressSeed: string = ''

  /**
   * Returns a copy of the zk proof data currently in use.
   *
   * Mutating the returned value does not mutate handler state.
   *
   * @returns {ZKProofData} A copy of the proof data in use.
   */
  getProofData(): ZKProofData {
    return cloneZKProofData(this.#data)
  }

  /**
   * Returns the current address seed that is generated when the proof data is applied.
   * @returns {string} the current address seed
   */
  getAddressSeed(): string {
    return this.#addressSeed
  }

  /**
   * Applies proof data that enables zkLogin signing for future signatures.
   *
   * The supplied proof data is cloned before it is stored, and any supplied
   * `partialZkLoginSignature.addressSeed` is not stored. Mutating the input
   * object after this call does not mutate handler state. The returned proof
   * data is also a copy.
   *
   * When validation is enabled, this checks wallet-core's expected JSON
   * proof-data shape:
   * - `maxEpoch` is a positive safe integer.
   * - `partialZkLoginSignature` matches the zkLogin proof input shape,
   *   excluding `addressSeed`.
   * - `userSalt` is a base-10 integer string from 0 to 2^128 - 1.
   * - `keyClaimName`, `keyClaimValue`, and `aud` are non-empty
   *   JWT claim strings. `keyClaimName` is the zkLogin key claim name used
   *   for address derivation, typically `sub`; callers using a different stable
   *   JWT claim should pass that claim name and value.
   *
   * `skipValidation` skips only those explicit checks. The data is still cloned
   * and used to compute the address seed, so malformed values can still throw
   * here or later when signing.
   *
   * @param zkpd {ZKProofData} Proof data to apply to the handler.
   * @param options Optional object. Set `skipValidation` to skip wallet-core's explicit validation checks.
   * @returns {ZKProofData} A copy of the proof data now stored by the handler.
   */
  applyZKProof(
    zkpd: ZKProofData,
    options?: { skipValidation?: boolean },
  ): ZKProofData {
    const skipValidation = options?.skipValidation ?? false
    if (!skipValidation) {
      const throwIfNotStringOrEmpty = (data: unknown, name: string) => {
        if (!isNonEmptyString(data)) {
          throw new Error(
            `[applyZKProof] expected property "${name}" to be a string with content`,
          )
        }
      }
      if (!isPositiveSafeInteger(zkpd.maxEpoch)) {
        throw new Error(
          `[applyZKProof] expected property "maxEpoch" to be a positive safe integer`,
        )
      }
      if (!isPartialZKLoginSignature(zkpd.partialZkLoginSignature)) {
        throw new Error(
          `[applyZKProof] expected property "partialZkLoginSignature" to match zkLogin proof input shape`,
        )
      }
      if (
        !isUnsignedDecimalIntegerStringBelow(
          zkpd.userSalt,
          ZK_LOGIN_USER_SALT_UPPER_BOUND,
        )
      ) {
        throw new Error(
          `[applyZKProof] expected property "userSalt" to be a base-10 integer string from 0 to 2^128 - 1`,
        )
      }
      throwIfNotStringOrEmpty(zkpd.keyClaimName, 'keyClaimName')
      throwIfNotStringOrEmpty(zkpd.keyClaimValue, 'keyClaimValue')
      throwIfNotStringOrEmpty(zkpd.aud, 'aud')
    }
    this.#data = cloneZKProofData(zkpd)
    this.setAddressSeed()

    return this.getProofData()
  }

  /**
   * Sets the address seed by calling genAddressSeed with the current salt and
   * JWT key claim data.
   * This is called when new proof data is applied.
   */
  protected setAddressSeed(): void {
    this.#addressSeed = genAddressSeed(
      BigInt(this.#data.userSalt as string),
      this.#data.keyClaimName as string,
      this.#data.keyClaimValue as string,
      this.#data.aud as string,
    ).toString()
  }

  /**
   * Called from `signWithIntent` in the zkLogin enabled keypair/signer classes.
   * This is how we end up with a zkLogin signature instead of a normal
   * signature when the proof data is applied.
   * @param signatureWithBytes the normal signature with bytes
   *   that is returned from the underlying keypair/signer
   * @returns a possibly modified SignatureWithBytes that includes a zkLogin
   *   signature if the proof data is applied, or the original
   *   signatureWithBytes if not.
   * Note that the bytes are not modified in either case, as the zkLogin signature
   * is generated in a way that it can be verified against the original bytes.
   * This means that the zkLogin signature is essentially a wrapper around the
   * original signature that includes the proof data, and can be verified in a way
   * that extracts the original signature and checks it against the original bytes.
   * This can be seen in the keypair/signer tests where `parseZkLoginSignature` is used.
   *
   * If no partial zkLogin signature is stored, the original signature and bytes
   * are returned unchanged.
   */
  processSignature(signatureWithBytes: SignatureWithBytes): SignatureWithBytes {
    const { signature, bytes } = signatureWithBytes
    if (this.#data.partialZkLoginSignature === undefined) {
      return { signature, bytes }
    }
    const zkSignature = getZkLoginSignature({
      inputs: {
        ...this.#data.partialZkLoginSignature,
        addressSeed: this.#addressSeed,
      },
      maxEpoch: this.#data.maxEpoch,
      userSignature: signature,
    })
    return { signature: zkSignature, bytes }
  }
}
