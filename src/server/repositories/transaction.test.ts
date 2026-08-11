import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { OrgRole } from '@/shared/enums/orgRole'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { WebhookEventStatus } from '@/shared/enums/webhookEventStatus'
import type { OrgContext } from '@/server/http/types'
import { TransactionModel } from '@/server/models/Transaction'
import { WebhookEventModel } from '@/server/models/WebhookEvent'
import * as transactions from '@/server/repositories/transactions'
import * as webhookEvents from '@/server/repositories/webhookEvents'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

function merchant() {
  return { name: 'ACME STORE', mcc: '5411', country: 'US' }
}

function createInput(overrides: Partial<transactions.CreateTransactionInput> = {}) {
  return {
    cardId: 'card_1',
    projectId: 'proj_1',
    airwallexTransactionId: 'awx_tx_1',
    cardTransactionId: 'awx_ct_1',
    lifecycleId: 'awx_lc_1',
    type: TransactionType.AUTHORIZATION,
    status: TransactionStatus.AUTHORIZED,
    amount: 12_500,
    currency: 'USD',
    billingAmount: 12_500,
    billingCurrency: 'USD',
    merchant: merchant(),
    transactedAt: new Date('2026-08-11T10:00:00.000Z'),
    ...overrides,
  }
}

describe('repositories/transaction', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([TransactionModel.syncIndexes(), WebhookEventModel.syncIndexes()])
  })

  describe('transactions', () => {
    it('creates and finds within org only (cross-org → null)', async () => {
      const orgCtx = ctx('org_1')
      const created = await transactions.createTransaction(orgCtx, createInput())

      expect(created).toMatchObject({
        orgId: 'org_1',
        amount: 12_500,
        lifecycleId: 'awx_lc_1',
        failureReason: null,
        receiptFileId: null,
      })

      expect(await transactions.findTransactionById(orgCtx, created.id)).toEqual(created)
      expect(await transactions.findTransactionById(ctx('org_other'), created.id)).toBeNull()
      expect(
        await transactions.findByAirwallexTransactionId(ctx('org_other'), 'awx_tx_1'),
      ).toBeNull()
    })

    it('findByLifecycleId returns events ordered by transactedAt', async () => {
      const orgCtx = ctx('org_lc')
      await transactions.createTransaction(
        orgCtx,
        createInput({
          airwallexTransactionId: 'awx_tx_auth',
          type: TransactionType.AUTHORIZATION,
          transactedAt: new Date('2026-08-11T10:00:00.000Z'),
        }),
      )
      await transactions.createTransaction(
        orgCtx,
        createInput({
          airwallexTransactionId: 'awx_tx_clear',
          type: TransactionType.CLEARING,
          status: TransactionStatus.CLEARED,
          amount: 12_000,
          billingAmount: 12_000,
          transactedAt: new Date('2026-08-12T10:00:00.000Z'),
        }),
      )
      await transactions.createTransaction(
        orgCtx,
        createInput({
          airwallexTransactionId: 'awx_tx_other',
          lifecycleId: 'awx_lc_other',
          transactedAt: new Date('2026-08-11T09:00:00.000Z'),
        }),
      )

      const chain = await transactions.findByLifecycleId(orgCtx, 'awx_lc_1')
      expect(chain.map((t) => t.airwallexTransactionId)).toEqual(['awx_tx_auth', 'awx_tx_clear'])
      expect(await transactions.findByLifecycleId(ctx('org_other'), 'awx_lc_1')).toEqual([])
    })

    it('listTransactions filters and paginates', async () => {
      const orgCtx = ctx('org_list')
      await transactions.createTransaction(
        orgCtx,
        createInput({
          airwallexTransactionId: 'tx_a',
          status: TransactionStatus.AUTHORIZED,
          transactedAt: new Date('2026-08-10T10:00:00.000Z'),
        }),
      )
      await transactions.createTransaction(
        orgCtx,
        createInput({
          airwallexTransactionId: 'tx_b',
          status: TransactionStatus.DECLINED,
          failureReason: 'LIMIT_EXCEEDED',
          transactedAt: new Date('2026-08-11T10:00:00.000Z'),
        }),
      )
      await transactions.createTransaction(
        orgCtx,
        createInput({
          airwallexTransactionId: 'tx_c',
          cardId: 'card_2',
          projectId: 'proj_2',
          status: TransactionStatus.CLEARED,
          transactedAt: new Date('2026-08-12T10:00:00.000Z'),
        }),
      )

      const declined = await transactions.listTransactions(orgCtx, {
        status: TransactionStatus.DECLINED,
      })
      expect(declined.total).toBe(1)
      expect(declined.items[0]?.airwallexTransactionId).toBe('tx_b')

      const byCard = await transactions.listTransactions(orgCtx, { cardId: 'card_2' })
      expect(byCard.total).toBe(1)
      expect(byCard.items[0]?.projectId).toBe('proj_2')

      const page = await transactions.listTransactions(orgCtx, { page: 1, pageSize: 2 })
      expect(page.items).toHaveLength(2)
      expect(page.total).toBe(3)
      expect(page.items[0]?.airwallexTransactionId).toBe('tx_c')
    })

    it('updateReceipt sets and clears receiptFileId', async () => {
      const orgCtx = ctx('org_receipt')
      const created = await transactions.createTransaction(
        orgCtx,
        createInput({ airwallexTransactionId: 'tx_receipt' }),
      )

      const attached = await transactions.updateReceipt(orgCtx, created.id, {
        receiptFileId: 'file_1',
      })
      expect(attached?.receiptFileId).toBe('file_1')

      const cleared = await transactions.updateReceipt(orgCtx, created.id, {
        receiptFileId: null,
      })
      expect(cleared?.receiptFileId).toBeNull()
      expect(
        await transactions.updateReceipt(ctx('org_other'), created.id, {
          receiptFileId: 'file_x',
        }),
      ).toBeNull()
    })

    it('returns null for invalid object ids', async () => {
      expect(await transactions.findTransactionById(ctx('org_1'), 'not-an-id')).toBeNull()
    })
  })

  describe('webhookEvents', () => {
    it('insertWebhookEvent is idempotent on eventId', async () => {
      const first = await webhookEvents.insertWebhookEvent({
        eventId: 'evt_1',
        name: 'issuing.card_transaction.authorized',
        payload: { id: 'evt_1' },
        receivedAt: new Date('2026-08-11T10:00:00.000Z'),
      })
      expect(first.created).toBe(true)
      expect(first.event.status).toBe(WebhookEventStatus.RECEIVED)

      const second = await webhookEvents.insertWebhookEvent({
        eventId: 'evt_1',
        name: 'issuing.card_transaction.authorized',
        payload: { id: 'evt_1', different: true },
        receivedAt: new Date('2026-08-11T11:00:00.000Z'),
      })
      expect(second.created).toBe(false)
      expect(second.event.id).toBe(first.event.id)
      expect(second.event.payload).toEqual({ id: 'evt_1' })
    })

    it('finds by eventId and marks processed/failed', async () => {
      await webhookEvents.insertWebhookEvent({
        eventId: 'evt_mark',
        name: 'issuing.transaction.succeeded',
        accountId: 'acct_1',
        payload: { id: 'evt_mark' },
        receivedAt: new Date('2026-08-11T10:00:00.000Z'),
      })

      const found = await webhookEvents.findWebhookEventByEventId('evt_mark')
      expect(found?.accountId).toBe('acct_1')

      const processed = await webhookEvents.markWebhookProcessed(
        'evt_mark',
        new Date('2026-08-11T10:01:00.000Z'),
      )
      expect(processed?.status).toBe(WebhookEventStatus.PROCESSED)
      expect(processed?.attempts).toBe(1)
      expect(processed?.processedAt).toBe('2026-08-11T10:01:00.000Z')

      const failed = await webhookEvents.markWebhookFailed('evt_fail_missing', 'boom')
      expect(failed).toBeNull()

      await webhookEvents.insertWebhookEvent({
        eventId: 'evt_fail',
        name: 'issuing.transaction.failed',
        payload: {},
        receivedAt: new Date(),
      })
      const marked = await webhookEvents.markWebhookFailed('evt_fail', 'parse error')
      expect(marked?.status).toBe(WebhookEventStatus.FAILED)
      expect(marked?.error).toBe('parse error')
      expect(marked?.attempts).toBe(1)
    })
  })
})
