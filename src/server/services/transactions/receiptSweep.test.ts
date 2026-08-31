import { describe, expect, it } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { TransactionModel } from '@/server/models/Transaction'
import { sweepMissingReceiptsAll } from '@/server/services/transactions/receiptSweep'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'

describe('transactions/receiptSweep', () => {
  useTestDb()

  it('cross-tenant find does not throw tenantScoped', async () => {
    await TransactionModel.create({
      orgId: 'org_1',
      cardId: 'card_1',
      projectId: 'proj_1',
      airwallexTransactionId: 'awx_tx_1',
      cardTransactionId: 'awx_ct_1',
      lifecycleId: 'awx_lc_1',
      type: TransactionType.CLEARING,
      status: TransactionStatus.CLEARED,
      amount: 6_000,
      currency: 'USD',
      billingAmount: 6_000,
      billingCurrency: 'USD',
      merchant: { name: 'ACME STORE', mcc: '5411', country: 'US' },
      transactedAt: new Date('2026-08-11T10:00:00.000Z'),
    })

    await expect(sweepMissingReceiptsAll()).resolves.toBeUndefined()
  })
})
