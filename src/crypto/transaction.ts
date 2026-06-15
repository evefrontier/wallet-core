import type { SuiGrpcClient } from '@mysten/sui/grpc'
import type { Transaction } from '@mysten/sui/transactions'

export type BuildTransactionBytesOptions = {
  setSenderIfNotSet?: boolean
}

/**
 * Sets the sender on a transaction and builds its BCS transaction bytes.
 */
export async function buildTransactionBytes(
  tx: Transaction,
  sender: string,
  suiClient: SuiGrpcClient,
  options: BuildTransactionBytesOptions = {},
): Promise<Uint8Array> {
  if (options.setSenderIfNotSet === true) {
    tx.setSenderIfNotSet(sender)
  } else {
    tx.setSender(sender)
  }

  return tx.build({ client: suiClient })
}
