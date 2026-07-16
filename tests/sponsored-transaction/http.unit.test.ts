import { describe, expect, it, vi } from 'vitest'
import {
  executeSponsoredTransaction,
  fetchUnsignedSponsoredTransaction,
  type SponsoredTransactionApiContext,
  SponsoredTransactionError,
  type SponsoredTransactionInput,
} from '#src/sponsored-transaction'

const INPUT: SponsoredTransactionInput = {
  txAction: 'online',
  assembly: 42,
  assemblyType: 'storage-units',
  metadata: { name: 'My SSU', description: 'desc', url: 'https://x.example' },
}

function jsonResponse(
  body: unknown,
  init: { status?: number; statusText?: string } = {},
): Response {
  const status = init.status ?? 200
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: init.statusText ?? '',
    json:
      body === undefined
        ? () => Promise.reject(new Error('not json'))
        : () => Promise.resolve(body),
  } as unknown as Response
}

function contextWithResponse(response: Response): {
  context: SponsoredTransactionApiContext
  fetchMock: ReturnType<typeof vi.fn>
} {
  const fetchMock = vi.fn().mockResolvedValue(response)
  return {
    context: {
      getApiGatewayUrl: (path: string) => `https://gateway.example/${path}`,
      getApiGatewayToken: () => 'token-123',
      tenant: 'stillness',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    },
    fetchMock,
  }
}

describe('fetchUnsignedSponsoredTransaction', () => {
  it('should POST the assembly action with tenant and bearer headers', async () => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-1' }),
    )

    const result = await fetchUnsignedSponsoredTransaction(INPUT, context)

    expect(result).toEqual({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-1' })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      'https://gateway.example/transactions/sponsored/storage-units/online',
      {
        method: 'POST',
        body: JSON.stringify({
          assemblyId: 42,
          name: 'My SSU',
          description: 'desc',
          url: 'https://x.example',
        }),
        headers: {
          Accept: 'application/json, application/problem+json',
          'X-Tenant': 'stillness',
          'Content-Type': 'application/json',
          Authorization: 'Bearer token-123',
        },
      },
    )
  })

  it('should URL-encode path segments', async () => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-1' }),
    )

    await fetchUnsignedSponsoredTransaction(
      { ...INPUT, assemblyType: 'a/b', txAction: 'x y' },
      context,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.example/transactions/sponsored/a%2Fb/x%20y',
      expect.anything(),
    )
  })

  it('should throw fetch_failed with status and body on non-OK responses', async () => {
    const { context } = contextWithResponse(
      jsonResponse(
        { detail: 'not allowed' },
        { status: 403, statusText: 'Forbidden' },
      ),
    )

    const error = await fetchUnsignedSponsoredTransaction(INPUT, context).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(SponsoredTransactionError)
    expect(error).toMatchObject({
      code: 'fetch_failed',
      httpStatus: 403,
      raw: { detail: 'not allowed' },
    })
  })

  it('should preserve raw: null when an error body is not JSON', async () => {
    const { context } = contextWithResponse(
      jsonResponse(undefined, { status: 502, statusText: 'Bad Gateway' }),
    )

    await expect(
      fetchUnsignedSponsoredTransaction(INPUT, context),
    ).rejects.toMatchObject({ code: 'fetch_failed', raw: null })
  })

  it('should throw invalid_shape when the OK response is missing fields', async () => {
    const { context } = contextWithResponse(
      jsonResponse({ bcsDataB64Bytes: 'AAEC' }),
    )

    await expect(
      fetchUnsignedSponsoredTransaction(INPUT, context),
    ).rejects.toMatchObject({ code: 'invalid_shape' })
  })

  it('should propagate network-level fetch rejections unwrapped', async () => {
    const failure = new TypeError('fetch failed')
    const { context } = contextWithResponse(jsonResponse({}))
    ;(context.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(failure)

    await expect(
      fetchUnsignedSponsoredTransaction(INPUT, context),
    ).rejects.toBe(failure)
  })
})

describe('executeSponsoredTransaction', () => {
  const PARAMS = { preparationId: 'prep-1', userSignatureB64Bytes: 'c2ln' }

  it('should POST the signature to the execute endpoint and return digest/effects', async () => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ digest: '0xabc', effects: 'ZWZm' }),
    )

    const result = await executeSponsoredTransaction(PARAMS, context)

    expect(result).toEqual({ digest: '0xabc', effects: 'ZWZm' })
    expect(fetchMock).toHaveBeenCalledExactlyOnceWith(
      'https://gateway.example/transactions/sponsored/execute',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(PARAMS),
      }),
    )
  })

  it('should default missing digest/effects fields', async () => {
    const { context } = contextWithResponse(jsonResponse({}))

    await expect(executeSponsoredTransaction(PARAMS, context)).resolves.toEqual(
      { digest: '0x0', effects: '0x0' },
    )
  })

  it('should throw execute_failed with status and body on non-OK responses', async () => {
    const { context } = contextWithResponse(
      jsonResponse({ detail: 'expired' }, { status: 410, statusText: 'Gone' }),
    )

    const error = await executeSponsoredTransaction(PARAMS, context).catch(
      (e: unknown) => e,
    )

    expect(error).toBeInstanceOf(SponsoredTransactionError)
    expect(error).toMatchObject({
      code: 'execute_failed',
      httpStatus: 410,
      raw: { detail: 'expired' },
    })
  })
})
