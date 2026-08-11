/**
 * B8.10 — transaction domain events emitted from webhook processing.
 * Verifies transaction.authorized|cleared|declined|reversed events fire.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import type { OrgContext } from '@/server/http/types'
import { BudgetModel } from '@/server/models/Budget'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { CardModel } from '@/server/models/Card'
import { ProjectModel } from '@/server/models/Project'
import { TransactionModel } from '@/server/models/Transaction'
import { WebhookEventModel } from '@/server/models/WebhookEvent'
import { resetRedis } from '@/server/redis'
import * as projects from '@/server/repositories/projects'
import * as budgets from '@/server/repositories/budgets'
import { appendBudgetEntry } from '@/server/services/budget/ledger'
import { processAirwallexWebhook } from '@/server/services/webhooks/process'
import * as webhookEvents from '@/server/repositories/webhookEvents'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { OrgRole } from '@/shared/enums/orgRole'
import { useTestDb } from '../helpers/db'

function ctx(orgId: string, userId = 'user_ev8'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

function makeCard(orgId: string, projectId: string, airwallexCardId: string) {
  const controls = {
    allowedTransactionCount: 'MULTIPLE' as const,
    transactionLimits: {
      currency: 'USD',
      limits: [{ interval: 'MONTHLY' as const, amount: 500_000 }],
    },
    activeFrom: null,
    activeTo: null,
    allowedCurrencies: null,
    allowedMerchantCategories: null,
    allowedMerchantCountries: null,
    allowedMerchantBrands: null,
    blockedTransactionUsages: [] as never[],
  }
  return CardModel.create({
    orgId,
    projectId,
    airwallexCardId,
    cardholderId: 'ch_1',
    maskedNumber: '************1234',
    nickName: 'Test Card',
    status: 'ACTIVE' as const,
    purpose: 'MEMBER' as const,
    desiredControls: controls,
    appliedControls: controls,
  })
}

let webhookSeq = 0
function webhookPayload(eventName: string, cardId: string, lifecycleId: string, amount = 100.0) {
  webhookSeq++
  return {
    name: eventName,
    account_id: 'acct_1',
    data: {
      object: {
        card_id: cardId,
        card_transaction_lifecycle_id: lifecycleId,
        card_transaction_id: `ct_${lifecycleId}_${webhookSeq}`,
        card_transaction_event_id: `cte_${lifecycleId}_${webhookSeq}`,
        transaction_amount: { value: amount, currency: 'USD' },
        billing_amount: { value: amount, currency: 'USD' },
        merchant: { name: 'Test Merchant', mcc: '5411', country: 'US' },
        failure_reason: eventName.includes('decline') ? 'insufficient_funds' : undefined,
      },
    },
  }
}

describe('events/b8', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      ProjectModel.syncIndexes(),
      BudgetModel.syncIndexes(),
      BudgetEntryModel.syncIndexes(),
      CardModel.syncIndexes(),
      TransactionModel.syncIndexes(),
      WebhookEventModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetRedis()
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    resetEventPublisher()
    resetRedis()
    vi.restoreAllMocks()
  })

  it('emits transaction.authorized on issuing.card_transaction.authorized', async () => {
    const orgCtx = ctx('org_ev8_auth')
    const project = await projects.createProject(orgCtx, { name: 'EV8-A', code: 'EV8-A' })
    await budgets.upsertBudgetFields(orgCtx, project.id, {
      currency: 'USD',
      approvedAmount: 100_000,
    })
    await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.APPROVAL,
      amount: 100_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'budget_ev8',
      createdBy: orgCtx.userId,
    })
    const card = await makeCard(orgCtx.orgId, project.id, 'awx_card_ev8_auth')

    const payload = webhookPayload(
      'issuing.card_transaction.authorized',
      card.airwallexCardId,
      'lc_ev8_auth_001',
    )
    const we = await webhookEvents.insertWebhookEvent({
      eventId: `ev_auth_${Date.now()}`,
      name: payload.name,
      accountId: payload.account_id,
      payload: payload as unknown as Record<string, unknown>,
      receivedAt: new Date(),
    })

    resetEventPublisher()
    await processAirwallexWebhook(we.event.eventId)

    const events = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.TRANSACTION_AUTHORIZED,
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      orgId: orgCtx.orgId,
      subjectType: 'transaction',
    })
  })

  it('emits transaction.cleared on issuing.card_transaction.cleared', async () => {
    const orgCtx = ctx('org_ev8_clear')
    const project = await projects.createProject(orgCtx, { name: 'EV8-C', code: 'EV8-C' })
    await budgets.upsertBudgetFields(orgCtx, project.id, {
      currency: 'USD',
      approvedAmount: 100_000,
    })
    await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.APPROVAL,
      amount: 100_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'budget_ev8c',
      createdBy: orgCtx.userId,
    })
    const card = await makeCard(orgCtx.orgId, project.id, 'awx_card_ev8_clear')

    const authPayload = webhookPayload(
      'issuing.card_transaction.authorized',
      card.airwallexCardId,
      'lc_ev8_clear_001',
      50.0,
    )
    const weAuth = await webhookEvents.insertWebhookEvent({
      eventId: `ev_clear_auth_${Date.now()}`,
      name: authPayload.name,
      accountId: authPayload.account_id,
      payload: authPayload as unknown as Record<string, unknown>,
      receivedAt: new Date(),
    })
    await processAirwallexWebhook(weAuth.event.eventId)

    resetEventPublisher()
    const clearPayload = webhookPayload(
      'issuing.card_transaction.cleared',
      card.airwallexCardId,
      'lc_ev8_clear_001',
      50.0,
    )
    const weClear = await webhookEvents.insertWebhookEvent({
      eventId: `ev_clear_${Date.now()}`,
      name: clearPayload.name,
      accountId: clearPayload.account_id,
      payload: clearPayload as unknown as Record<string, unknown>,
      receivedAt: new Date(),
    })
    await processAirwallexWebhook(weClear.event.eventId)

    const events = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.TRANSACTION_CLEARED,
    )
    expect(events).toHaveLength(1)
  })

  it('emits transaction.declined on issuing.card_transaction.declined', async () => {
    const orgCtx = ctx('org_ev8_decline')
    const project = await projects.createProject(orgCtx, { name: 'EV8-D', code: 'EV8-D' })
    const card = await makeCard(orgCtx.orgId, project.id, 'awx_card_ev8_decline')

    const payload = webhookPayload(
      'issuing.card_transaction.declined',
      card.airwallexCardId,
      'lc_ev8_decline_001',
    )
    const we = await webhookEvents.insertWebhookEvent({
      eventId: `ev_decline_${Date.now()}`,
      name: payload.name,
      accountId: payload.account_id,
      payload: payload as unknown as Record<string, unknown>,
      receivedAt: new Date(),
    })

    resetEventPublisher()
    await processAirwallexWebhook(we.event.eventId)

    const events = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.TRANSACTION_DECLINED,
    )
    expect(events).toHaveLength(1)
  })

  it('emits transaction.reversed on issuing.card_transaction.reversed', async () => {
    const orgCtx = ctx('org_ev8_reverse')
    const project = await projects.createProject(orgCtx, { name: 'EV8-R', code: 'EV8-R' })
    await budgets.upsertBudgetFields(orgCtx, project.id, {
      currency: 'USD',
      approvedAmount: 100_000,
    })
    await appendBudgetEntry(orgCtx, project.id, {
      type: BudgetEntryType.APPROVAL,
      amount: 100_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'budget_ev8r',
      createdBy: orgCtx.userId,
    })
    const card = await makeCard(orgCtx.orgId, project.id, 'awx_card_ev8_reverse')

    const authPayload = webhookPayload(
      'issuing.card_transaction.authorized',
      card.airwallexCardId,
      'lc_ev8_reverse_001',
      75.0,
    )
    const weAuth = await webhookEvents.insertWebhookEvent({
      eventId: `ev_rev_auth_${Date.now()}`,
      name: authPayload.name,
      accountId: authPayload.account_id,
      payload: authPayload as unknown as Record<string, unknown>,
      receivedAt: new Date(),
    })
    await processAirwallexWebhook(weAuth.event.eventId)

    resetEventPublisher()
    const revPayload = webhookPayload(
      'issuing.card_transaction.reversed',
      card.airwallexCardId,
      'lc_ev8_reverse_001',
      75.0,
    )
    const weRev = await webhookEvents.insertWebhookEvent({
      eventId: `ev_rev_${Date.now()}`,
      name: revPayload.name,
      accountId: revPayload.account_id,
      payload: revPayload as unknown as Record<string, unknown>,
      receivedAt: new Date(),
    })
    await processAirwallexWebhook(weRev.event.eventId)

    const events = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.TRANSACTION_REVERSED,
    )
    expect(events).toHaveLength(1)
  })
})
