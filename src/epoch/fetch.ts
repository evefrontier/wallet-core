import type { ClientWithCoreApi } from '@mysten/sui/client'
import type { ChainEpochInfo } from './state'

/**
 * Fetches current-epoch facts from the system state object via the client's
 * core API. Preferred path for gRPC fullnode endpoints.
 */
export async function fetchEpochFromSystemState(
  client: ClientWithCoreApi,
): Promise<ChainEpochInfo> {
  const { systemState } = await client.core.getCurrentSystemState()

  const currentEpoch = Number(systemState.epoch)
  const epochDurationMs = Number.parseInt(
    systemState.parameters.epochDurationMs,
    10,
  )
  const epochStartTimestampMs = Number.parseInt(
    systemState.epochStartTimestampMs,
    10,
  )

  if (
    !Number.isFinite(currentEpoch) ||
    !Number.isFinite(epochDurationMs) ||
    !Number.isFinite(epochStartTimestampMs)
  ) {
    throw new Error(
      'System state returned non-numeric epoch fields: ' +
        `epoch=${systemState.epoch}, ` +
        `epochDurationMs=${systemState.parameters.epochDurationMs}, ` +
        `epochStartTimestampMs=${systemState.epochStartTimestampMs}`,
    )
  }

  return { currentEpoch, epochDurationMs, epochStartTimestampMs }
}
