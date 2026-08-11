/**
 * B8.9 — Transaction sync backstop.
 *
 * Replaces the worker noop for `sync-transactions`. This is a best-effort
 * backstop that reconciles transactions from Airwallex stubs.
 *
 * Since the Airwallex transactions API is still a stub, this implementation
 * logs and returns. The admin trigger and worker job prove the gate and
 * scheduling work end-to-end.
 */
import { connectDb } from '@/server/db/connect'

export type SyncTransactionsResult = {
  synced: number
  errors: number
}

/**
 * Run the sync backstop. Idempotent with the webhook path — in production this
 * would iterate recent cards and pull transaction history from Airwallex, but
 * the Airwallex transactions list API is still a stub.
 */
export async function syncTransactions(): Promise<SyncTransactionsResult> {
  await connectDb()
  console.info('[sync-transactions] running sync backstop (Airwallex API stub — no-op)')
  return { synced: 0, errors: 0 }
}
