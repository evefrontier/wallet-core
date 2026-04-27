import type { SignatureWithBytes } from '@mysten/sui/cryptography'
import { genAddressSeed, getZkLoginSignature } from '@mysten/sui/zklogin'

/**
 * A partial ZKLogin Signature.
 */
export type PartialZkLoginSignature = Omit<
  Parameters<typeof getZkLoginSignature>['0']['inputs'],
  'addressSeed'
>

/**
 * Checks if obj is a PartialZkLoginSignature
 * @param obj {unknown}
 * @returns true if `obj` includes properties with the same types found in
 * a PartialZkLoginSignature
 */
export function isPartialZKLoginSignature(obj: unknown): obj is PartialZkLoginSignature {
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
        'value' in partial.issBase64Details &&
        'indexMod4' in partial.issBase64Details &&
        typeof partial.issBase64Details.value === 'string' &&
        typeof partial.issBase64Details.indexMod4 === 'number' &&
        // proofPoints
        'a' in partial.proofPoints &&
        'b' in partial.proofPoints &&
        'c' in partial.proofPoints &&
        Array.isArray(partial.proofPoints.a) &&
        Array.isArray(partial.proofPoints.b) &&
        Array.isArray(partial.proofPoints.c) &&
        partial.proofPoints.a.length === 3 &&
        partial.proofPoints.b.length === 3 &&
        partial.proofPoints.c.length === 3 &&
        typeof (partial.proofPoints.a as unknown[])[0] === 'string' &&
        typeof (partial.proofPoints.a as unknown[])[1] === 'string' &&
        typeof (partial.proofPoints.a as unknown[])[2] === 'string' &&
        // b
        Array.isArray((partial.proofPoints.b as unknown[])[0]) &&
        Array.isArray((partial.proofPoints.b as unknown[])[1]) &&
        Array.isArray((partial.proofPoints.b as unknown[])[2]) &&
        ((b: unknown[]): boolean => {
          return (
            typeof (b[0] as unknown[])[0] === 'string' &&
            typeof (b[0] as unknown[])[1] === 'string' &&
            typeof (b[1] as unknown[])[0] === 'string' &&
            typeof (b[1] as unknown[])[1] === 'string' &&
            typeof (b[2] as unknown[])[0] === 'string' &&
            typeof (b[2] as unknown[])[1] === 'string'
          )
        })(partial.proofPoints.b as unknown[]) &&
        // c
        typeof (partial.proofPoints.c as unknown[])[0] === 'string' &&
        typeof (partial.proofPoints.c as unknown[])[1] === 'string' &&
        typeof (partial.proofPoints.c as unknown[])[2] === 'string'
      )
    })(obj as PartialZkLoginSignature)
  )
}

export interface ZKProofData {
  maxEpoch: number
  partialZkLoginSignature: PartialZkLoginSignature | undefined
  userSalt: string
  tokenClaimSub: string
  tokenClaimAud: string
}

export class ZKProofHandler implements ZKProofData {
  // proof data members
  maxEpoch: number = 0
  partialZkLoginSignature: PartialZkLoginSignature | undefined = undefined
  userSalt: string = ''
  tokenClaimSub: string = ''
  tokenClaimAud: string = ''
  // runtime state members
  addressSeed: string = ''

  /**
   * Applies the neccessary data to make this instance capable of performing ZKLogin signing.
   * @param zkpd {ZKProofData}
   * @param options optional object that can have `skipValidation` set in order to skip validation.
   */
  applyZKProof(zkpd: ZKProofData, options?: { skipValidation?: boolean }): void {
    const skipValidation = options?.skipValidation ?? false
    if (!skipValidation) {
      const isStringWithContent = (data: unknown): boolean => {
        return typeof data === 'string' && data.trim().length > 0
      }
      const throwIfNotStringOrEmpty = (data: unknown, name: string) => {
        if (!isStringWithContent(data)) {
          throw new Error(`applyZKProof expected property "${name}" to be a string with content`)
        }
      }
      const isNumberGreaterThan = (data: unknown, value: number): boolean => {
        return typeof data === 'number' && data > value
      }
      if (!isNumberGreaterThan(zkpd.maxEpoch, 0)) {
        throw new Error(`applyZKProof expected property "$maxEpoch" to be a number greater than 0`)
      }
      if (!isPartialZKLoginSignature(zkpd.partialZkLoginSignature)) {
        throw new Error(`applyZKProof expected property "partialZkLoginSignature" in incorrect`)
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
    if ('addressSeed' in this.partialZkLoginSignature!) {
      delete this.partialZkLoginSignature['addressSeed']
    }
  }

  protected setAddressSeed(): void {
    this.addressSeed = genAddressSeed(
      BigInt(this.userSalt as string),
      'sub',
      this.tokenClaimSub as string,
      this.tokenClaimAud as string,
    ).toString()
  }

  toZKProofData(): ZKProofData {
    return {
      maxEpoch: this.maxEpoch,
      partialZkLoginSignature: this.partialZkLoginSignature,
      userSalt: this.userSalt,
      tokenClaimSub: this.tokenClaimSub,
      tokenClaimAud: this.tokenClaimAud,
    }
  }

  processSignature(signatureWithBytes: SignatureWithBytes): SignatureWithBytes {
    const { signature, bytes } = signatureWithBytes
    if (this.partialZkLoginSignature === undefined) {
      return { signature, bytes }
    }
    const zkSignature = getZkLoginSignature({
      inputs: {
        ...this.partialZkLoginSignature!,
        addressSeed: this.addressSeed,
      },
      maxEpoch: this.maxEpoch,
      userSignature: signature,
    })
    return { signature: zkSignature, bytes }
  }
}
