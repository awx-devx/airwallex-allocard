/**
 * Process a persisted Airwallex webhook event → transaction + budget ledger.
 *
 * Called by the worker's webhook consumer after ingest stored the raw event.
 * Idempotent: if the airwallexTransactionId already exists, skip.
 */
import { connectDb } from '@/server/db/connect'
import { publishEvent } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import type { OrgContext } from '@/server/http/types'
import { findCardByAirwallexIdGlobal } from '@/server/repositories/cards'
import { findEntriesByLifecycleId } from '@/server/repositories/budgetEntries'
import * as transactionRepo from '@/server/repositories/transactions'
import * as webhookEvents from '@/server/repositories/webhookEvents'
import { appendBudgetEntry } from '@/server/services/budget/ledger'
import { majorToMinor } from '@/server/services/cards/controls'
import {
  mapEventToLedgerOps,
  type LifecycleLedgerSummary,
} from '@/server/services/transactions/ledgerMap'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { OrgRole } from '@/shared/enums/orgRole'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'

/** Airwallex webhook event names we handle for card transactions. */
const EVENT_NAME_TO_TYPE: Record<string, TransactionType> = {
  'issuing.card_transaction.authorized': TransactionType.AUTHORIZATION,
  'issuing.card_transaction.verified': TransactionType.AUTHORIZATION,
  'issuing.card_transaction.cleared': TransactionType.CLEARING,
  'issuing.card_transaction.reversed': TransactionType.REVERSAL_AUTH,
  'issuing.card_transaction.expired': TransactionType.EXPIRED_AUTHORIZATION,
  'issuing.card_transaction.declined': TransactionType.AUTHORIZATION,
}

const EVENT_NAME_TO_STATUS: Record<string, TransactionStatus> = {
  'issuing.card_transaction.authorized': TransactionStatus.AUTHORIZED,
  'issuing.card_transaction.verified': TransactionStatus.VERIFIED,
  'issuing.card_transaction.cleared': TransactionStatus.CLEARED,
  'issuing.card_transaction.reversed': TransactionStatus.REVERSED,
  'issuing.card_transaction.expired': TransactionStatus.EXPIRED,
  'issuing.card_transaction.declined': TransactionStatus.DECLINED,
}

const STATUS_TO_DOMAIN_EVENT: Partial<Record<TransactionStatus, DomainEventType>> = {
  [TransactionStatus.AUTHORIZED]: DomainEventType.TRANSACTION_AUTHORIZED,
  [TransactionStatus.CLEARED]: DomainEventType.TRANSACTION_CLEARED,
  [TransactionStatus.DECLINED]: DomainEventType.TRANSACTION_DECLINED,
  [TransactionStatus.REVERSED]: DomainEventType.TRANSACTION_REVERSED,
  [TransactionStatus.EXPIRED]: DomainEventType.TRANSACTION_REVERSED,
}

type CardTransactionData = {
  card_id?: string
  card_transaction_lifecycle_id?: string
  card_transaction_id?: string
  card_transaction_event_id?: string
  transaction_amount?: { value?: number; currency?: string }
  billing_amount?: { value?: number; currency?: string }
  merchant?: { name?: string; mcc?: string; country?: string }
  failure_reason?: string
  event_type?: string
  created_at?: string
}

function readCardTransactionData(payload: Record<string, unknown>): CardTransactionData | null {
  const data = payload.data as Record<string, unknown> | undefined
  if (!data || typeof data !== 'object') {
    return null
  }
  const object = data.object as Record<string, unknown> | undefined
  if (!object || typeof object !== 'object') {
    return null
  }
  const ctd = object.card_transaction_data as CardTransactionData | undefined
  if (!ctd || typeof ctd !== 'object') {
    return object as unknown as CardTransactionData
  }
  return ctd
}

function resolveTransactionType(eventName: string, ctd: CardTransactionData): TransactionType {
  const eventType = ctd.event_type
  if (eventType && eventType in TransactionType) {
    return eventType as TransactionType
  }
  return EVENT_NAME_TO_TYPE[eventName] ?? TransactionType.AUTHORIZATION
}

function systemCtx(orgId: string): OrgContext {
  return { orgId, userId: 'system', orgRole: OrgRole.OWNER }
}

function buildLifecycleSummary(
  entries: Array<{ type: string; amount: number }>,
): LifecycleLedgerSummary {
  let committed = 0
  let actual = 0
  for (const e of entries) {
    if (e.type === BudgetEntryType.COMMITMENT) committed += e.amount
    else if (e.type === BudgetEntryType.RELEASE) committed -= e.amount
    else if (e.type === BudgetEntryType.ACTUAL) actual += e.amount
  }
  return { committed: Math.max(0, committed), actual }
}

export type ProcessWebhookResult = {
  processed: boolean
  reason?: string
}

/**
 * Main entry point: called by the worker with the webhook event's eventId.
 */
export async function processAirwallexWebhook(eventId: string): Promise<ProcessWebhookResult> {
  await connectDb()

  const webhookEvent = await webhookEvents.findWebhookEventByEventId(eventId)
  if (!webhookEvent) {
    return { processed: false, reason: 'webhook_event_not_found' }
  }

  const payload = webhookEvent.payload
  const eventName = webhookEvent.name

  const status = EVENT_NAME_TO_STATUS[eventName]
  if (!status) {
    await webhookEvents.markWebhookProcessed(eventId, new Date())
    return { processed: true, reason: 'unhandled_event_type' }
  }

  const ctd = readCardTransactionData(payload)
  if (!ctd) {
    await webhookEvents.markWebhookFailed(eventId, 'missing card_transaction_data')
    return { processed: false, reason: 'missing_card_transaction_data' }
  }

  const airwallexCardId = ctd.card_id
  if (!airwallexCardId) {
    await webhookEvents.markWebhookFailed(eventId, 'missing card_id')
    return { processed: false, reason: 'missing_card_id' }
  }

  const card = await findCardByAirwallexIdGlobal(airwallexCardId)
  if (!card) {
    await webhookEvents.markWebhookFailed(eventId, `card not found: ${airwallexCardId}`)
    return { processed: false, reason: 'card_not_found' }
  }

  const ctx = systemCtx(card.orgId)
  const lifecycleId = ctd.card_transaction_lifecycle_id ?? ctd.card_transaction_id ?? eventId
  const airwallexTxId = ctd.card_transaction_event_id ?? ctd.card_transaction_id ?? eventId

  const existing = await transactionRepo.findByAirwallexTransactionId(ctx, airwallexTxId)
  if (existing) {
    await webhookEvents.markWebhookProcessed(eventId, new Date())
    return { processed: true, reason: 'idempotent_skip' }
  }

  const txAmount = ctd.transaction_amount ?? {}
  const txCurrency = String(txAmount.currency ?? card.appliedControls.transactionLimits.currency)
  const amountMinor = majorToMinor(Number(txAmount.value ?? 0), txCurrency)

  const billingAmount = ctd.billing_amount ?? txAmount
  const billingCurrency = String(billingAmount.currency ?? txCurrency)
  const billingAmountMinor = majorToMinor(Number(billingAmount.value ?? 0), billingCurrency)

  const merchant = ctd.merchant ?? {}
  const transactionType = resolveTransactionType(eventName, ctd)

  const transaction = await transactionRepo.createTransaction(ctx, {
    cardId: card.id,
    projectId: card.projectId ?? '',
    airwallexTransactionId: airwallexTxId,
    cardTransactionId: ctd.card_transaction_id ?? airwallexTxId,
    lifecycleId,
    type: transactionType,
    status,
    amount: amountMinor,
    currency: txCurrency,
    billingAmount: billingAmountMinor,
    billingCurrency,
    merchant: {
      name: String(merchant.name ?? 'Unknown'),
      mcc: String(merchant.mcc ?? '0000'),
      country: String(merchant.country ?? 'XX'),
    },
    failureReason: ctd.failure_reason ?? null,
    transactedAt: ctd.created_at ? new Date(ctd.created_at) : new Date(),
  })

  if (card.projectId && status !== TransactionStatus.DECLINED) {
    try {
      const existingEntries = await findEntriesByLifecycleId(ctx, card.projectId, lifecycleId)
      const summary = buildLifecycleSummary(existingEntries)
      const ops = mapEventToLedgerOps(transactionType, Math.abs(amountMinor), summary)

      for (const op of ops) {
        const sourceType =
          op.type === BudgetEntryType.COMMITMENT
            ? BudgetEntrySourceType.AUTHORIZATION
            : BudgetEntrySourceType.TRANSACTION
        await appendBudgetEntry(ctx, card.projectId, {
          type: op.type,
          amount: op.amount,
          currency: txCurrency,
          sourceType,
          sourceId: transaction.id,
          lifecycleId,
          createdBy: 'system',
        })
      }
    } catch (error) {
      console.error('[process] ledger write failed', {
        eventId,
        transactionId: transaction.id,
        error,
      })
      await webhookEvents.markWebhookFailed(
        eventId,
        error instanceof Error ? error.message : String(error),
      )
      return { processed: false, reason: 'ledger_write_failed' }
    }
  }

  const domainEventType = STATUS_TO_DOMAIN_EVENT[status]
  if (domainEventType) {
    await publishEvent({
      type: domainEventType,
      orgId: card.orgId,
      projectId: card.projectId ?? undefined,
      subjectType: 'transaction',
      subjectId: transaction.id,
      payload: {
        transactionId: transaction.id,
        cardId: card.id,
        projectId: card.projectId,
        lifecycleId,
        type: transactionType,
        status,
        amount: amountMinor,
        currency: txCurrency,
      },
    })
  }

  await webhookEvents.markWebhookProcessed(eventId, new Date())
  return { processed: true }
}
