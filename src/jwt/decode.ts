function base64UrlDecode(segment: string): string {
  const base64 = segment.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(
    base64.length + ((4 - (base64.length % 4)) % 4),
    '=',
  )
  const binary = atob(padded)
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}

/**
 * Decodes a JWT's payload segment without verifying its signature.
 *
 * Dependency-free base64url + JSON decode. Use only for reading claims you
 * do not need to trust (routing, display, correlation); signature
 * verification is out of scope for this module.
 *
 * @throws when the token is not three dot-separated segments or the payload
 * is not a base64url-encoded JSON object.
 */
export function decodeJwtPayload<T = Record<string, unknown>>(
  token: string,
): T {
  const segments = token.split('.')
  if (segments.length !== 3 || segments[1] === '') {
    throw new Error('Invalid JWT: expected three dot-separated segments')
  }

  let payload: unknown
  try {
    payload = JSON.parse(base64UrlDecode(segments[1] as string))
  } catch {
    throw new Error('Invalid JWT: payload is not base64url-encoded JSON')
  }

  if (payload === null || typeof payload !== 'object') {
    throw new Error('Invalid JWT: payload is not a JSON object')
  }

  return payload as T
}

/**
 * Like {@link decodeJwtPayload}, but tolerates opaque, malformed, or absent
 * tokens by returning `null` instead of throwing.
 */
export function decodeJwtPayloadSafely<T = Record<string, unknown>>(
  token?: string,
): T | null {
  if (!token) {
    return null
  }
  try {
    return decodeJwtPayload<T>(token)
  } catch {
    return null
  }
}
