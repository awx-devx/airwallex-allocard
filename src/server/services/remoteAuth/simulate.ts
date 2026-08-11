/**
 * Demo simulator — builds Airwallex v2 remote-auth input from minor-unit domain
 * shape and runs the same decideRemoteAuth path as live.
 */
import { randomUUID } from 'node:crypto'
import { minorToMajor } from '@/server/services/cards/controls'
import { decideRemoteAuth } from '@/server/services/remoteAuth/decide'
import type { RemoteAuthDecision, SimulatePurchaseInput } from '@/shared/types/remoteAuth'
import type { RemoteAuthInput } from '@/shared/types/remoteAuth'

export function buildSyntheticRemoteAuthInput(
  input: SimulatePurchaseInput,
  options: { now?: Date; accountId?: string } = {},
): RemoteAuthInput {
  const now = options.now ?? new Date()
  const eventId = randomUUID()
  const cardTxId = randomUUID()
  const lifecycleId = randomUUID()
  return {
    version: 2,
    account_id: options.accountId ?? 'simulate',
    card_id: input.cardId,
    card_transaction_event_id: eventId,
    card_transaction_id: cardTxId,
    card_transaction_lifecycle_id: lifecycleId,
    transaction_type: 'AUTHORIZATION',
    transaction_category: 'PURCHASE',
    transaction_date: now.toISOString().replace('Z', '+0000'),
    transaction_amount: minorToMajor(input.amount, input.currency),
    transaction_currency: input.currency,
    merchant: {
      name: input.merchant.name,
      country: input.merchant.country,
      category_code: input.merchant.mcc,
    },
    billing_order: [
      {
        currency: input.currency,
        amount: minorToMajor(input.amount, input.currency),
      },
    ],
  }
}

export async function simulatePurchase(input: SimulatePurchaseInput): Promise<RemoteAuthDecision> {
  const remoteInput = buildSyntheticRemoteAuthInput(input)
  const result = await decideRemoteAuth(remoteInput)
  return result.decision
}
