import { describe, expect, it } from 'vitest'
import {
  purchaseRequestFeedSummary,
  transactionFeedSummary,
} from '@/server/services/activity/summaries'

describe('activity feed money copy', () => {
  it('formats purchase-request amounts as money, not minor units', () => {
    expect(purchaseRequestFeedSummary('PENDING', 'Procure QA Vendor', 17_500, 'USD')).toBe(
      'Purchase request PENDING: Procure QA Vendor $175.00',
    )
    expect(purchaseRequestFeedSummary('REJECTED', 'Procure QA Vendor', 17_500, 'USD')).toBe(
      'Purchase request REJECTED: Procure QA Vendor $175.00',
    )
  })

  it('formats transaction amounts as money, not minor units', () => {
    expect(transactionFeedSummary('AUTHORIZATION', 'AUTHORIZED', 1000, 'USD', 'Store')).toBe(
      'AUTHORIZATION AUTHORIZED $10.00 at Store',
    )
  })
})
