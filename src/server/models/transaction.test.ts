import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { WebhookEventStatus } from '@/shared/enums/webhookEventStatus'
import { toDomain } from '@/server/models/base'
import { TransactionModel } from '@/server/models/Transaction'
import { WebhookEventModel } from '@/server/models/WebhookEvent'
import type { Transaction } from '@/shared/types/transaction'
import type { WebhookEvent } from '@/shared/types/webhookEvent'

async function syncIndexes(): Promise<void> {
  await Promise.all([TransactionModel.syncIndexes(), WebhookEventModel.syncIndexes()])
}

function minimalMerchant(overrides: Record<string, unknown> = {}) {
  return {
    name: 'ACME STORE',
    mcc: '5411',
    country: 'US',
    ...overrides,
  }
}

function minimalTransaction(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
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
    merchant: minimalMerchant(),
    transactedAt: new Date('2026-08-11T10:00:00.000Z'),
    ...overrides,
  }
}

function minimalWebhook(overrides: Record<string, unknown> = {}) {
  return {
    eventId: 'evt_1',
    name: 'issuing.card_transaction.authorized',
    payload: { id: 'evt_1', name: 'issuing.card_transaction.authorized' },
    receivedAt: new Date('2026-08-11T10:00:00.000Z'),
    ...overrides,
  }
}

describe('models/transaction', () => {
  useTestDb()

  beforeAll(async () => {
    await syncIndexes()
  })

  describe('Transaction', () => {
    it('stores integer minor amounts and required lifecycleId', async () => {
      const doc = await TransactionModel.create(minimalTransaction())

      expect(doc.amount).toBe(12_500)
      expect(doc.billingAmount).toBe(12_500)
      expect(doc.lifecycleId).toBe('awx_lc_1')
      expect(doc.failureReason).toBeNull()
      expect(doc.receiptFileId).toBeNull()
      expect(Number.isInteger(doc.amount)).toBe(true)
    })

    it('toDomain emits ISO dates and merchant without subdocument _id', async () => {
      const transactedAt = new Date('2026-08-11T10:00:00.000Z')
      const doc = await TransactionModel.create(minimalTransaction({ transactedAt }))

      const domain = toDomain<Transaction>(doc)
      expect(domain).toMatchObject({
        id: expect.any(String),
        orgId: 'org_1',
        amount: 12_500,
        type: TransactionType.AUTHORIZATION,
        status: TransactionStatus.AUTHORIZED,
        merchant: { name: 'ACME STORE', mcc: '5411', country: 'US' },
        transactedAt: transactedAt.toISOString(),
      })
      expect(domain.merchant).not.toHaveProperty('_id')
      expect(domain.failureReason).toBeNull()
      expect(domain.receiptFileId).toBeNull()
    })

    it('enforces unique (orgId, airwallexTransactionId)', async () => {
      await TransactionModel.create(minimalTransaction())
      await expect(TransactionModel.create(minimalTransaction())).rejects.toThrow(/duplicate key/i)
    })

    it('allows same airwallexTransactionId across orgs', async () => {
      await TransactionModel.create(minimalTransaction({ orgId: 'org_1' }))
      const other = await TransactionModel.create(minimalTransaction({ orgId: 'org_2' }))
      expect(other.orgId).toBe('org_2')
    })

    it('throws without orgId (tenantScoped)', async () => {
      await expect(TransactionModel.find({ cardId: 'card_1' }).exec()).rejects.toThrow(
        /Tenant scope missing/,
      )
    })

    it('rejects create without lifecycleId', async () => {
      await expect(
        TransactionModel.create(
          minimalTransaction({
            lifecycleId: undefined,
          }),
        ),
      ).rejects.toThrow()
    })
  })

  describe('WebhookEvent', () => {
    it('defaults RECEIVED status, attempts 0, null accountId/processedAt/error', async () => {
      const doc = await WebhookEventModel.create(minimalWebhook())

      expect(doc.status).toBe(WebhookEventStatus.RECEIVED)
      expect(doc.attempts).toBe(0)
      expect(doc.accountId).toBeNull()
      expect(doc.processedAt).toBeNull()
      expect(doc.error).toBeNull()
    })

    it('enforces unique eventId globally (not tenant-scoped)', async () => {
      await WebhookEventModel.create(minimalWebhook({ eventId: 'evt_dup' }))
      await expect(
        WebhookEventModel.create(minimalWebhook({ eventId: 'evt_dup' })),
      ).rejects.toThrow(/duplicate key/i)
    })

    it('allows find without orgId (global collection)', async () => {
      await WebhookEventModel.create(minimalWebhook({ eventId: 'evt_find' }))
      const found = await WebhookEventModel.findOne({ eventId: 'evt_find' }).exec()
      expect(found?.name).toBe('issuing.card_transaction.authorized')
    })

    it('toDomain emits ISO dates and payload record', async () => {
      const receivedAt = new Date('2026-08-11T10:00:00.000Z')
      const doc = await WebhookEventModel.create(
        minimalWebhook({
          eventId: 'evt_domain',
          accountId: 'acct_1',
          receivedAt,
          payload: { id: 'evt_domain', data: { card_id: 'c1' } },
        }),
      )

      const domain = toDomain<WebhookEvent>(doc)
      expect(domain).toMatchObject({
        id: expect.any(String),
        eventId: 'evt_domain',
        accountId: 'acct_1',
        status: WebhookEventStatus.RECEIVED,
        receivedAt: receivedAt.toISOString(),
        processedAt: null,
        attempts: 0,
        error: null,
      })
      expect(domain.payload).toEqual({ id: 'evt_domain', data: { card_id: 'c1' } })
    })
  })
})
