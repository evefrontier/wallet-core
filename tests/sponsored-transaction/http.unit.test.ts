import { describe, expect, it, vi } from 'vitest'
import {
  executeSponsoredTransaction,
  fetchUnsignedAddressAliasTransaction,
  fetchUnsignedSponsoredTransaction,
  SponsoredTransactionActions,
  type SponsoredTransactionApiContext,
  SponsoredTransactionError,
  type SponsoredTransactionInput,
} from '#src/sponsored-transaction'
import { tokenWithPayload } from '../jwt/test-tokens'

const INPUT: SponsoredTransactionInput = {
  txAction: SponsoredTransactionActions.BRING_ONLINE,
  assembly: '42',
  assemblyType: 'storage-units',
  metadata: { name: 'My SSU', description: 'desc', url: 'https://x.example' },
}

/** Gateway token whose `tenant` claim drives the `X-Tenant` header. */
const TOKEN = tokenWithPayload({ tenant: 'stillness' })

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

function contextWithResponse(
  response: Response,
  token: string = TOKEN,
): {
  context: SponsoredTransactionApiContext
  fetchMock: ReturnType<typeof vi.fn>
} {
  const fetchMock = vi.fn().mockResolvedValue(response)
  return {
    context: {
      getApiGatewayUrl: (path: string) => `https://gateway.example/${path}`,
      getApiGatewayToken: () => token,
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
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.example/v2/transactions/sponsored/storage-units/online',
      {
        method: 'POST',
        body: JSON.stringify({
          assemblyId: '42',
          name: 'My SSU',
          description: 'desc',
          url: 'https://x.example',
        }),
        headers: {
          Accept: 'application/json, application/problem+json',
          'X-Tenant': 'stillness',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
      },
    )
  })

  it('should throw invalid_input without calling fetch on an unknown assembly type', async () => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-1' }),
    )

    await expect(
      fetchUnsignedSponsoredTransaction(
        // Bypass the type to exercise the runtime guard for JS callers.
        { ...INPUT, assemblyType: 'bogus' as never },
        context,
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should throw invalid_input without calling fetch on an unknown action', async () => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-1' }),
    )

    await expect(
      fetchUnsignedSponsoredTransaction(
        { ...INPUT, txAction: 'x y' as never },
        context,
      ),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should throw invalid_input without calling fetch when the token has no tenant claim', async () => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-1' }),
      tokenWithPayload({ sub: 'user-1' }),
    )

    await expect(
      fetchUnsignedSponsoredTransaction(INPUT, context),
    ).rejects.toMatchObject({ code: 'invalid_input' })
    expect(fetchMock).not.toHaveBeenCalled()
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

describe('fetchUnsignedAddressAliasTransaction', () => {
  const ALIAS_ADDRESS = `0x${'ab'.repeat(32)}`

  it('should POST an empty body for enable with tenant and bearer headers', async () => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-1' }),
    )

    const result = await fetchUnsignedAddressAliasTransaction(
      { action: 'enable' },
      context,
    )

    expect(result).toEqual({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-1' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.example/v2/transactions/sponsored/address-aliases/enable',
      {
        method: 'POST',
        body: '{}',
        headers: {
          Accept: 'application/json, application/problem+json',
          'X-Tenant': 'stillness',
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TOKEN}`,
        },
      },
    )
  })

  it('should POST the personal access key address for add', async () => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-2' }),
    )

    const result = await fetchUnsignedAddressAliasTransaction(
      { action: 'add', personalAccessKeyAddress: ALIAS_ADDRESS },
      context,
    )

    expect(result).toEqual({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-2' })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.example/v2/transactions/sponsored/address-aliases/add',
      expect.objectContaining({
        body: JSON.stringify({ personalAccessKeyAddress: ALIAS_ADDRESS }),
      }),
    )
  })

  it('should not send the address for enable', async () => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-1' }),
    )

    await fetchUnsignedAddressAliasTransaction(
      // @ts-expect-error the address is only allowed for add
      { action: 'enable', personalAccessKeyAddress: ALIAS_ADDRESS },
      context,
    )

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ body: '{}' }),
    )
  })

  it.each([
    undefined,
    '',
    ' ',
    'hello',
    '0x2',
    `0x${'ab'.repeat(31)}`,
    ` ${ALIAS_ADDRESS}`,
    `${ALIAS_ADDRESS} `,
  ])('should throw invalid_input without calling fetch for add with address %j', async (address) => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-1' }),
    )

    await expect(
      fetchUnsignedAddressAliasTransaction(
        { action: 'add', personalAccessKeyAddress: address as string },
        context,
      ),
    ).rejects.toMatchObject({
      code: 'invalid_input',
      message: 'personal access key address must be a valid Sui address',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should throw invalid_input without calling fetch on an unknown action', async () => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-1' }),
    )

    await expect(
      // Bypass the type to exercise the runtime guard for JS callers.
      fetchUnsignedAddressAliasTransaction(
        { action: 'remove' } as never,
        context,
      ),
    ).rejects.toMatchObject({
      code: 'invalid_input',
      message: 'Unknown address alias action: remove',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should throw invalid_input without calling fetch when the token is not a JWT', async () => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ bcsDataB64Bytes: 'AAEC', preparationId: 'prep-1' }),
      'not-a-jwt',
    )

    await expect(
      fetchUnsignedAddressAliasTransaction({ action: 'enable' }, context),
    ).rejects.toMatchObject({
      code: 'invalid_input',
      message: 'API gateway token is not a decodable JWT',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should throw fetch_failed with the problem body on non-OK responses', async () => {
    const problem = { detail: 'address aliasing is already enabled' }
    const { context } = contextWithResponse(
      jsonResponse(problem, { status: 409, statusText: 'Conflict' }),
    )

    const error = await fetchUnsignedAddressAliasTransaction(
      { action: 'enable' },
      context,
    ).catch((e: unknown) => e)

    expect(error).toBeInstanceOf(SponsoredTransactionError)
    expect(error).toMatchObject({
      code: 'fetch_failed',
      message: 'Failed to prepare address alias transaction: 409 Conflict',
      httpStatus: 409,
      raw: problem,
    })
  })

  it('should preserve raw: null when an error body is not JSON', async () => {
    const { context } = contextWithResponse(
      jsonResponse(undefined, { status: 502, statusText: 'Bad Gateway' }),
    )

    await expect(
      fetchUnsignedAddressAliasTransaction({ action: 'enable' }, context),
    ).rejects.toMatchObject({
      code: 'fetch_failed',
      httpStatus: 502,
      raw: null,
    })
  })

  it('should throw invalid_shape when the OK response is missing fields', async () => {
    const { context } = contextWithResponse(
      jsonResponse({ preparationId: 'prep-1' }),
    )

    await expect(
      fetchUnsignedAddressAliasTransaction({ action: 'enable' }, context),
    ).rejects.toMatchObject({
      code: 'invalid_shape',
      message:
        'Address alias API returned invalid shape: expected { bcsDataB64Bytes: string, preparationId: string }',
      httpStatus: 200,
      raw: { preparationId: 'prep-1' },
    })
  })
})

describe('executeSponsoredTransaction', () => {
  const PARAMS = { preparationId: 'prep-1', userSignatureB64Bytes: 'c2ln' }

  it('should POST the signature to the execute endpoint and return the digest and status', async () => {
    const { context, fetchMock } = contextWithResponse(
      jsonResponse({ digest: '0xabc', executionStatus: 'success' }),
    )

    const result = await executeSponsoredTransaction(PARAMS, context)

    expect(result).toEqual({ digest: '0xabc', executionStatus: 'success' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.example/transactions/sponsored/execute',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(PARAMS),
      }),
    )
  })

  it('should throw execute_failed when the tx executed on-chain but did not succeed', async () => {
    const { context } = contextWithResponse(
      jsonResponse({
        digest: '0xabc',
        executionStatus: 'failure',
        executionErrorMessage: 'MoveAbort',
      }),
    )

    await expect(
      executeSponsoredTransaction(PARAMS, context),
    ).rejects.toMatchObject({ code: 'execute_failed', message: 'MoveAbort' })
  })

  it('should throw execute_failed when a 2xx response omits executionStatus', async () => {
    const { context } = contextWithResponse(jsonResponse({ digest: '0xabc' }))

    await expect(
      executeSponsoredTransaction(PARAMS, context),
    ).rejects.toMatchObject({ code: 'execute_failed', httpStatus: 200 })
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
