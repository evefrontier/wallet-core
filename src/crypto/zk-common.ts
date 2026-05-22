import type { IntentScope, SignatureWithBytes } from '@mysten/sui/cryptography'
import { genAddressSeed, getZkLoginSignature } from '@mysten/sui/zklogin'
import type { PartialZkLoginSignature, ZKProofData } from '#src/types'
import {
  hasTypedArrayPropertyWithLength,
  hasTypedProperty,
  is3x2ArrayOfStrings,
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

/**
 * Checks if `obj` is a PartialZkLoginSignature
 * @param obj {unknown}
 * @returns true if `obj` includes properties with the same types found in
 * a PartialZkLoginSignature
 */
export function isPartialZKLoginSignature(
  obj: unknown,
): obj is PartialZkLoginSignature {
  return (
    typeof obj === 'object' &&
    obj != null &&
    'proofPoints' in obj &&
    'issBase64Details' in obj &&
    'headerBase64' in obj &&
    ((partial: PartialZkLoginSignature): partial is PartialZkLoginSignature => {
      return (
        typeof partial.proofPoints === 'object' &&
        typeof partial.issBase64Details === 'object' &&
        typeof partial.headerBase64 === 'string' &&
        // issBase64Details
        hasTypedProperty(partial.issBase64Details, 'value', 'string') &&
        hasTypedProperty(partial.issBase64Details, 'indexMod4', 'number') &&
        // proofPoints
        hasTypedArrayPropertyWithLength(
          partial.proofPoints,
          'a',
          'string',
          3,
        ) &&
        hasTypedArrayPropertyWithLength(
          partial.proofPoints,
          'b',
          'object',
          3,
        ) &&
        hasTypedArrayPropertyWithLength(
          partial.proofPoints,
          'c',
          'string',
          3,
        ) &&
        // b is a 3x2 array of strings
        is3x2ArrayOfStrings(partial.proofPoints.b)
      )
    })(obj as PartialZkLoginSignature)
  )
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
    return { ...this.#data }
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
      const isStringWithContent = (data: unknown): boolean => {
        return typeof data === 'string' && data.trim().length > 0
      }
      const throwIfNotStringOrEmpty = (data: unknown, name: string) => {
        if (!isStringWithContent(data)) {
          throw new Error(
            `[applyZKProof] expected property "${name}" to be a string with content`,
          )
        }
      }
      const isNumberGreaterThan = (data: unknown, value: number): boolean => {
        return typeof data === 'number' && data > value
      }
      if (!isNumberGreaterThan(zkpd.maxEpoch, 0)) {
        throw new Error(
          `[applyZKProof] expected property "$maxEpoch" to be a number greater than 0`,
        )
      }
      if (!isPartialZKLoginSignature(zkpd.partialZkLoginSignature)) {
        throw new Error(
          `[applyZKProof] expected property "partialZkLoginSignature" in incorrect`,
        )
      }
      throwIfNotStringOrEmpty(zkpd.userSalt, 'userSalt')
      throwIfNotStringOrEmpty(zkpd.tokenClaimSub, 'tokenClaimSub')
      throwIfNotStringOrEmpty(zkpd.tokenClaimAud, 'tokenClaimAud')
    }
    this.#data = { ...zkpd }
    this.setAddressSeed()
    // Setting this last as it is either set or undefined and is a good
    // candidate to know if the proof has been applied
    if (this.#data.partialZkLoginSignature) {
      if ('addressSeed' in this.#data.partialZkLoginSignature) {
        delete this.#data.partialZkLoginSignature.addressSeed
      }
    }

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
