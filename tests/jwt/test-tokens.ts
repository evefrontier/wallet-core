function base64UrlEncode(value: string): string {
  const bytes = new TextEncoder().encode(value)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const HEADER = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))

/** Builds an unsigned JWT-shaped token around the given payload. */
export function tokenWithPayload(payload: unknown): string {
  return `${HEADER}.${base64UrlEncode(JSON.stringify(payload))}.signature`
}
