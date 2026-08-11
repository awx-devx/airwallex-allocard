import { describe, expect, it } from 'vitest'
import {
  cardStatusLabel,
  cardStatusVariant,
  projectStatusLabel,
  projectStatusVariant,
  purchaseRequestStatusLabel,
  purchaseRequestStatusVariant,
  ruleRunStatusLabel,
  ruleRunStatusVariant,
} from '@/lib/format/status'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'

describe('lib/format/status', () => {
  it('covers every ProjectStatus label and variant', () => {
    const expected: Record<ProjectStatus, { label: string; variant: string }> = {
      [ProjectStatus.DRAFT]: { label: 'Draft', variant: 'info' },
      [ProjectStatus.PENDING_APPROVAL]: { label: 'Pending approval', variant: 'info' },
      [ProjectStatus.ACTIVE]: { label: 'Active', variant: 'success' },
      [ProjectStatus.CLOSING]: { label: 'Closing', variant: 'warning' },
      [ProjectStatus.CLOSED]: { label: 'Closed', variant: 'neutral' },
      [ProjectStatus.ARCHIVED]: { label: 'Archived', variant: 'neutral' },
      [ProjectStatus.CANCELLED]: { label: 'Cancelled', variant: 'danger' },
    }
    for (const status of Object.values(ProjectStatus)) {
      expect(projectStatusLabel(status)).toBe(expected[status].label)
      expect(projectStatusVariant(status)).toBe(expected[status].variant)
    }
  })

  it('covers every CardStatus label and variant', () => {
    const expected: Record<CardStatus, { label: string; variant: string }> = {
      [CardStatus.PENDING]: { label: 'Pending', variant: 'info' },
      [CardStatus.ACTIVE]: { label: 'Active', variant: 'success' },
      [CardStatus.INACTIVE]: { label: 'Inactive', variant: 'warning' },
      [CardStatus.CLOSED]: { label: 'Closed', variant: 'neutral' },
      [CardStatus.BLOCKED]: { label: 'Blocked', variant: 'danger' },
      [CardStatus.LOST]: { label: 'Lost', variant: 'danger' },
      [CardStatus.STOLEN]: { label: 'Stolen', variant: 'danger' },
      [CardStatus.FAILED]: { label: 'Failed', variant: 'danger' },
    }
    for (const status of Object.values(CardStatus)) {
      expect(cardStatusLabel(status)).toBe(expected[status].label)
      expect(cardStatusVariant(status)).toBe(expected[status].variant)
    }
  })

  it('covers every PurchaseRequestStatus label and variant', () => {
    const expected: Record<PurchaseRequestStatus, { label: string; variant: string }> = {
      [PurchaseRequestStatus.DRAFT]: { label: 'Draft', variant: 'info' },
      [PurchaseRequestStatus.PENDING]: { label: 'Pending', variant: 'info' },
      [PurchaseRequestStatus.APPROVED]: { label: 'Approved', variant: 'success' },
      [PurchaseRequestStatus.REJECTED]: { label: 'Rejected', variant: 'danger' },
      [PurchaseRequestStatus.EXPIRED]: { label: 'Expired', variant: 'danger' },
      [PurchaseRequestStatus.CANCELLED]: { label: 'Cancelled', variant: 'danger' },
    }
    for (const status of Object.values(PurchaseRequestStatus)) {
      expect(purchaseRequestStatusLabel(status)).toBe(expected[status].label)
      expect(purchaseRequestStatusVariant(status)).toBe(expected[status].variant)
    }
  })

  it('covers every RuleRunStatus label and variant', () => {
    const expected: Record<RuleRunStatus, { label: string; variant: string }> = {
      [RuleRunStatus.SUCCESS]: { label: 'Success', variant: 'success' },
      [RuleRunStatus.PARTIAL]: { label: 'Partial', variant: 'warning' },
      [RuleRunStatus.FAILED]: { label: 'Failed', variant: 'danger' },
      [RuleRunStatus.SKIPPED]: { label: 'Skipped', variant: 'danger' },
      [RuleRunStatus.DRY_RUN]: { label: 'Dry run', variant: 'info' },
    }
    for (const status of Object.values(RuleRunStatus)) {
      expect(ruleRunStatusLabel(status)).toBe(expected[status].label)
      expect(ruleRunStatusVariant(status)).toBe(expected[status].variant)
    }
  })
})
