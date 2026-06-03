import type { IntentScope, SignatureWithBytes } from '@mysten/sui/cryptography'
import { genAddressSeed, getZkLoginSignature } from '@mysten/sui/zklogin'
import type { PartialZkLoginSignature, ZKProofData } from '#src/types'
import {
  is3x2ArrayOfStrings,
  isNonEmptyString,
  isNonNegativeBigIntString,
  isPositiveSafeInteger,
  isStringArrayWithLength,
  isUint8Integer,
} from '#src/utils'

type Constructor<TInstance = object> = abstract new (
  // biome-ignore lint/suspicious/noExplicitAny: TypeScript mixin constructor constraints require any[].
  ...args: any[]
) => TInstance

type IntentSigner = {
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

// Helper to check that we have an object and narrows to Record<string, unknown>.
function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

// Helper to check that we have the expected properties.
function hasPartialZKLoginSignatureFields(
  value: Record<string, unknown>,
): boolean {
  return PARTIAL_ZK_LOGIN_SIGNATURE_FIELDS.every((field) => field in value)
}

// Helper to check that the 'issBase64Details' property has the expected shape and type.
function isIssBase64Details(value: unknown): boolean {
  return (
    isObjectRecord(value) &&
    ISS_BASE64_DETAILS_FIELDS.every((property) => property in value) &&
    typeof value.value === 'string' &&
    isUint8Integer(value.indexMod4)
  )
}

// Helper to check that the 'proofPoints' property has the expected shape and type.
function isProofPoints(value: unknown): boolean {
  return (
    isObjectRecord(value) &&
    PROOF_POINTS_ARRAY_FIELDS.every((property) => property in value) &&
    isStringArrayWithLength(value.a, 3) &&
    is3x2ArrayOfStrings(value.b) &&
    isStringArrayWithLength(value.c, 3)
  )
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
    tokenClaimSub: zkpd.tokenClaimSub,
    tokenClaimAud: zkpd.tokenClaimAud,
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

type ZKProofHandling = {
  zkProofHandler: ZKProofHandler

  /**
   * Applies the neccessary data to make this instance capable of performing ZKLogin signing.
   * @param zkpd {ZKProofData}
   * @param options optional object that can have `skipValidation` set in order to skip validation.
   */
  applyZKProof(
    zkpd: ZKProofData,
    options?: { skipValidation?: boolean },
  ): ZKProofData

  /**
   * Returns the zk proof data currently in use
   * @returns {ZKProofData} the proof data in use
   */
  getProofData(): ZKProofData

  /**
   * Returns the current address seed that is generated when the proof data is applied.
   * @returns {string} the current address seed
   */
  getAddressSeed(): string
}

/**
 * Adds ZK proof-aware behavior to a signer class.
 *
 * The returned class keeps the original constructor arguments unchanged.
 * @param {TBase} Base
 * @returns {InstanceType<TBase> & ZKProofHandling}
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

export class ZKProofHandler {
  // proof data
  #data: ZKProofData = {
    maxEpoch: 0,
    userSalt: '',
    tokenClaimSub: '',
    tokenClaimAud: '',
  }
  // runtime state members
  #addressSeed: string = ''

  /**
   * Returns the zk proof data currently in use
   * @returns {ZKProofData} the proof data in use
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
   * Applies the neccessary data to make this instance capable of performing ZKLogin signing.
   * @param zkpd {ZKProofData}
   * @param options optional object that can have `skipValidation` set in order to skip validation.
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
      if (!isNonNegativeBigIntString(zkpd.userSalt)) {
        throw new Error(
          `[applyZKProof] expected property "userSalt" to be a non-negative integer string`,
        )
      }
      throwIfNotStringOrEmpty(zkpd.tokenClaimSub, 'tokenClaimSub')
      throwIfNotStringOrEmpty(zkpd.tokenClaimAud, 'tokenClaimAud')
    }
    this.#data = cloneZKProofData(zkpd)
    this.setAddressSeed()

    return this.getProofData()
  }

  /**
   * Sets the address seed by calling genAddressSeed with the current salt and token claim data.
   * This is called when new proof data is applied.
   */
  protected setAddressSeed(): void {
    this.#addressSeed = genAddressSeed(
      BigInt(this.#data.userSalt as string),
      'sub',
      this.#data.tokenClaimSub as string,
      this.#data.tokenClaimAud as string,
    ).toString()
  }

  /**
   * Called from `signWithIntent` in the ZK enabled keypair/signer classes.
   * This is how we end up with a ZK Login signature instead of a normal
   * signature when the proof data is applied.
   * @param signatureWithBytes the normal signature with bytes
   *   that is returned from the underlying keypair/signer
   * @returns a possibly modified SignatureWithBytes that includes a ZK Login
   *   signature if the proof data is applied, or the original
   *   signatureWithBytes if not.
   * Note that the bytes are not modified in either case, as the ZK Login signature
   * is generated in a way that it can be verified against the original bytes.
   * This means that the ZK Login signature is essentially a wrapper around the
   * original signature that includes the proof data, and can be verified in a way
   * that extracts the original signature and checks it against the original bytes.
   * This can be seen in the keypair/signer tests where `parseZkLoginSignature` is used.
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
