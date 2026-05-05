import type { SignatureWithBytes } from '@mysten/sui/cryptography'
import { genAddressSeed, getZkLoginSignature } from '@mysten/sui/zklogin'
import type { PartialZkLoginSignature, ZKProofData } from '#src/types'
import {
  hasTypedArrayPropertyWithLength,
  hasTypedProperty,
  is3x2ArrayOfStrings,
} from '#src/utils'

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

export class ZKProofHandler implements ZKProofData {
  // proof data members
  maxEpoch: number = 0
  partialZkLoginSignature?: PartialZkLoginSignature = undefined
  userSalt: string = ''
  tokenClaimSub: string = ''
  tokenClaimAud: string = ''
  // runtime state members
  addressSeed: string = ''

  /**
   * Returns the zk proof data currently in use
   * @returns {ZKProofData} the proof data in use
   */
  getProofData(): ZKProofData {
    return {
      maxEpoch: this.maxEpoch,
      partialZkLoginSignature: this.partialZkLoginSignature,
      userSalt: this.userSalt,
      tokenClaimSub: this.tokenClaimSub,
      tokenClaimAud: this.tokenClaimAud,
    }
  }

  /**
   * Returns the current address seed that is generated when the proof data is applied.
   * @returns {string} the current address seed
   */
  getAddressSeed(): string {
    return this.addressSeed
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
    this.maxEpoch = zkpd.maxEpoch
    this.userSalt = zkpd.userSalt
    this.tokenClaimSub = zkpd.tokenClaimSub
    this.tokenClaimAud = zkpd.tokenClaimAud
    this.setAddressSeed()
    // Setting this last as it is either set or undefined and is a good
    // candidate to know if the proof has been applied
    this.partialZkLoginSignature = zkpd.partialZkLoginSignature
    if (this.partialZkLoginSignature) {
      if ('addressSeed' in this.partialZkLoginSignature) {
        delete this.partialZkLoginSignature.addressSeed
      }
    }
    return this.getProofData()
  }

  /**
   * Sets the address seed by calling genAddressSeed with the current salt and token claim data.
   * This is called when new proof data is applied.
   */
  protected setAddressSeed(): void {
    this.addressSeed = genAddressSeed(
      BigInt(this.userSalt as string),
      'sub',
      this.tokenClaimSub as string,
      this.tokenClaimAud as string,
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
    if (this.partialZkLoginSignature === undefined) {
      return { signature, bytes }
    }
    const zkSignature = getZkLoginSignature({
      inputs: {
        ...this.partialZkLoginSignature,
        addressSeed: this.addressSeed,
      },
      maxEpoch: this.maxEpoch,
      userSignature: signature,
    })
    return { signature: zkSignature, bytes }
  }
}
