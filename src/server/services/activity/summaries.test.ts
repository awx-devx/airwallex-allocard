import { describe, expect, it } from 'vitest'
import {
  auditActionFeedSummary,
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

describe('auditActionFeedSummary', () => {
  it('does not surface pan_token in the feed', () => {
    expect(auditActionFeedSummary('card.pan_token_created')).toBe('Card details revealed')
    expect(auditActionFeedSummary('card.pan_token_created').toLowerCase()).not.toContain('pan')
  })

  it('humanises dotted audit actions', () => {
    expect(auditActionFeedSummary('card.created')).toBe('Card created')
    expect(auditActionFeedSummary('member.added')).toBe('Member added')
    expect(auditActionFeedSummary('project.updated')).toBe('Project updated')
    expect(auditActionFeedSummary('budget.change_request_decided')).toBe(
      'Budget change request decided',
    )
  })
})
