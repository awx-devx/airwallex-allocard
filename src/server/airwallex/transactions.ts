import type { OrgContext } from '@/server/http/types'
import type { AirwallexRequester } from '@/server/airwallex/types'

/**
 * Transaction reads — stub until B8 money-in-motion.
 * Shape kept per AIRWALLEX-INTEGRATION §10 so callers can type against it.
 */
export type TransactionsApi = {
  list(ctx: OrgContext): Promise<never>
  get(ctx: OrgContext, transactionId: string): Promise<never>
  events(ctx: OrgContext, transactionId: string): Promise<never>
}

export function createTransactionsApi(_client: AirwallexRequester): TransactionsApi {
  void _client
  return {
    // TODO(B8): implement org-filtered transaction list
    list(_ctx) {
      void _ctx
      return Promise.reject(new Error('TODO(B8): airwallex.transactions.list not implemented'))
    },
    // TODO(B8): implement transaction get with org check
    get(_ctx, _transactionId) {
      void _ctx
      void _transactionId
      return Promise.reject(new Error('TODO(B8): airwallex.transactions.get not implemented'))
    },
    // TODO(B8): implement transaction events
    events(_ctx, _transactionId) {
      void _ctx
      void _transactionId
      return Promise.reject(new Error('TODO(B8): airwallex.transactions.events not implemented'))
    },
  }
}
