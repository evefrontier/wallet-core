import type { ClientWithCoreApi } from '@mysten/sui/client'
import type { SuiGraphQLClient } from '@mysten/sui/graphql'
import type { SuiGrpcClient } from '@mysten/sui/grpc'
import { type ChainEpochInfo, DEFAULT_EPOCH_DURATION_MS } from './state'

/**
 * GraphQL query used by {@link fetchEpochFromGraphQL}.
 */
export const CURRENT_EPOCH_QUERY = `
  query CurrentEpoch {
    epoch {
      epochId
      startTimestamp
      endTimestamp
    }
  }
`

type EpochQueryResponse = {
  epoch?: {
    epochId?: number | string
    startTimestamp?: string
    endTimestamp?: string
  } | null
}

/**
 * Fetches current-epoch facts from the system state object via the client's
 * core API. Preferred path for gRPC fullnode endpoints.
 */
export async function fetchEpochFromSystemState(
  client: ClientWithCoreApi,
): Promise<ChainEpochInfo> {
  const { systemState } = await client.core.getCurrentSystemState()

  return {
    currentEpoch: Number(systemState.epoch),
    epochDurationMs: Number.parseInt(
      systemState.parameters.epochDurationMs,
      10,
    ),
    epochStartTimestampMs: Number.parseInt(
      systemState.epochStartTimestampMs,
      10,
    ),
  }
}

/**
 * Fetches current-epoch facts via Sui GraphQL. Useful where gRPC is not
 * available (JSON-RPC/GraphQL-only endpoints).
 *
 * Falls back to {@link DEFAULT_EPOCH_DURATION_MS} when the response has no
 * `endTimestamp`.
 */
export async function fetchEpochFromGraphQL(
  client: SuiGraphQLClient,
): Promise<ChainEpochInfo> {
  const result = await client.query<EpochQueryResponse>({
    query: CURRENT_EPOCH_QUERY,
    variables: {},
  })

  if (result.errors?.length) {
    const message = result.errors.map((e) => e.message).join(', ')
    throw new Error(`GraphQL epoch query failed: ${message}`)
  }

  const epoch = result.data?.epoch
  if (!epoch) {
    throw new Error('GraphQL epoch query returned no epoch data')
  }

  const epochStartTimestampMs = epoch.startTimestamp
    ? new Date(epoch.startTimestamp).getTime()
    : 0
  const epochDurationMs = epoch.endTimestamp
    ? new Date(epoch.endTimestamp).getTime() - epochStartTimestampMs
    : DEFAULT_EPOCH_DURATION_MS

  return {
    currentEpoch: Number(epoch.epochId),
    epochDurationMs,
    epochStartTimestampMs,
  }
}

type ProtoTimestamp = { seconds?: bigint | string | number; nanos?: number }

function timestampToMs(timestamp: ProtoTimestamp | undefined): number | null {
  if (timestamp == null || timestamp.seconds == null) {
    return null
  }
  return (
    Number(timestamp.seconds) * 1_000 +
    Math.floor((timestamp.nanos ?? 0) / 1_000_000)
  )
}

/**
 * Fetches current-epoch facts via the gRPC ledger service. Intended for
 * localnet, where the system state path may not be available.
 *
 * Falls back to {@link DEFAULT_EPOCH_DURATION_MS} when the response lacks
 * `start`/`end` timestamps.
 */
export async function fetchEpochFromLedger(
  client: SuiGrpcClient,
): Promise<ChainEpochInfo> {
  const { epoch } = await client.ledgerService.getEpoch({}).response

  const epochStartTimestampMs = timestampToMs(epoch?.start) ?? 0
  const epochEndTimestampMs = timestampToMs(epoch?.end)
  const epochDurationMs =
    epochEndTimestampMs !== null
      ? epochEndTimestampMs - epochStartTimestampMs
      : DEFAULT_EPOCH_DURATION_MS

  return {
    currentEpoch: Number(epoch?.epoch ?? 0),
    epochDurationMs,
    epochStartTimestampMs,
  }
}
