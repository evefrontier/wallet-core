import { isNonEmptyString, isObjectRecord } from '#src/utils'
import type {
  SponsoredTransactionInput,
  SponsoredTransactionOutput,
} from './wallet-standard-extension-method'

/** Failure modes of the sponsored transaction API calls. */
export type SponsoredTransactionErrorCode =
  | 'fetch_failed'
  | 'invalid_shape'
  | 'execute_failed'

/**
 * Thrown when the sponsored transaction API returns a non-OK response or an
 * unexpected payload shape. Carries the HTTP status and raw response body
 * (when parseable) so consumers can log or map it to their own error
 * surface (e.g. JSON-RPC error codes). Network-level failures from `fetch`
 * itself are not wrapped and propagate as-is.
 */
export class SponsoredTransactionError extends Error {
  readonly code: SponsoredTransactionErrorCode
  readonly httpStatus?: number
  /** Parsed response body, or `null` when the body was not valid JSON. */
  readonly raw: unknown

  constructor(
    code: SponsoredTransactionErrorCode,
    message: string,
    options: { httpStatus?: number; raw?: unknown } = {},
  ) {
    super(message)
    this.name = 'SponsoredTransactionError'
    this.code = code
    if (typeof options.httpStatus === 'number') {
      this.httpStatus = options.httpStatus
    }
    this.raw = options.raw ?? null
  }
}

/**
 * Caller-supplied connection to the Eve Frontier API gateway. URL formation
 * and token acquisition stay with the consumer; this module only performs
 * the calls.
 */
export interface SponsoredTransactionApiContext {
  /** Resolves a gateway-relative path (e.g. `transactions/sponsored/execute`) to a full URL. */
  getApiGatewayUrl: (path: string) => string
  /** Returns the bearer token for the `Authorization` header. */
  getApiGatewayToken: () => string
  /** Tenant identifier sent as the `X-Tenant` header. */
  tenant: string
  /** Fetch override for tests or non-global fetch environments. Defaults to `globalThis.fetch`. */
  fetch?: typeof globalThis.fetch
}

/** An unsigned sponsored transaction prepared by the gateway. */
export interface UnsignedSponsoredTransaction {
  /** BCS transaction bytes, base64 encoded, ready to sign. */
  bcsDataB64Bytes: string
  /** Correlates the later execute call with this preparation. */
  preparationId: string
}

async function postJson(
  path: string,
  body: Record<string, unknown>,
  context: SponsoredTransactionApiContext,
): Promise<{ response: Response; raw: unknown }> {
  const doFetch = context.fetch ?? globalThis.fetch
  const response = await doFetch(context.getApiGatewayUrl(path), {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      Accept: 'application/json, application/problem+json',
      'X-Tenant': context.tenant,
      'Content-Type': 'application/json',
      Authorization: `Bearer ${context.getApiGatewayToken()}`,
    },
  })

  // Error bodies may be non-JSON (e.g. gateway HTML error pages); a parse
  // failure is preserved as raw: null and surfaced via the thrown error.
  let raw: unknown = null
  try {
    raw = await response.json()
  } catch {
    raw = null
  }

  return { response, raw }
}

/**
 * Requests an unsigned sponsored transaction from the API gateway for the
 * given assembly action. Sign the returned `bcsDataB64Bytes`, then submit
 * via {@link executeSponsoredTransaction}.
 *
 * @throws SponsoredTransactionError on non-OK responses (`fetch_failed`) or
 * unexpected response shape (`invalid_shape`).
 */
export async function fetchUnsignedSponsoredTransaction(
  input: SponsoredTransactionInput,
  context: SponsoredTransactionApiContext,
): Promise<UnsignedSponsoredTransaction> {
  const path = `transactions/sponsored/${encodeURIComponent(
    input.assemblyType,
  )}/${encodeURIComponent(input.txAction)}`

  const { response, raw } = await postJson(
    path,
    {
      assemblyId: input.assembly,
      name: input.metadata?.name,
      description: input.metadata?.description,
      url: input.metadata?.url,
    },
    context,
  )

  if (!response.ok) {
    throw new SponsoredTransactionError(
      'fetch_failed',
      `Failed to fetch sponsored transaction: ${response.status} ${response.statusText}`,
      { httpStatus: response.status, raw },
    )
  }

  if (
    !isObjectRecord(raw) ||
    !isNonEmptyString(raw.bcsDataB64Bytes) ||
    !isNonEmptyString(raw.preparationId)
  ) {
    throw new SponsoredTransactionError(
      'invalid_shape',
      'Sponsored tx API returned invalid shape: expected { bcsDataB64Bytes: string, preparationId: string }',
      { httpStatus: response.status, raw },
    )
  }

  return {
    bcsDataB64Bytes: raw.bcsDataB64Bytes,
    preparationId: raw.preparationId,
  }
}

/**
 * Submits the user's signature for a previously prepared sponsored
 * transaction; the gateway co-signs and executes it.
 *
 * @throws SponsoredTransactionError on non-OK responses (`execute_failed`).
 */
export async function executeSponsoredTransaction(
  params: {
    preparationId: string
    /** The user's transaction signature, base64 encoded. */
    userSignatureB64Bytes: string
  },
  context: SponsoredTransactionApiContext,
): Promise<SponsoredTransactionOutput> {
  const { response, raw } = await postJson(
    'transactions/sponsored/execute',
    {
      preparationId: params.preparationId,
      userSignatureB64Bytes: params.userSignatureB64Bytes,
    },
    context,
  )

  if (!response.ok) {
    throw new SponsoredTransactionError(
      'execute_failed',
      `Failed to execute sponsored transaction: ${response.status} ${response.statusText}`,
      { httpStatus: response.status, raw },
    )
  }

  const result = isObjectRecord(raw) ? raw : {}
  return {
    digest: isNonEmptyString(result.digest) ? result.digest : '0x0',
    effects: isNonEmptyString(result.effects) ? result.effects : '0x0',
  }
}
