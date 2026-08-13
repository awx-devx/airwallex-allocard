import { describe, expect, it } from 'vitest'
import { statusBadgeVariant } from '@/components/patterns/statusBadgeMap'
import {
  cardStatusVariant,
  projectStatusVariant,
  purchaseRequestStatusVariant,
  ruleRunStatusVariant,
} from '@/lib/format/status'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'

describe('statusBadgeVariant', () => {
  it('matches F2 project variants for every status', () => {
    for (const status of Object.values(ProjectStatus)) {
      expect(statusBadgeVariant({ kind: 'project', status })).toBe(projectStatusVariant(status))
    }
  })

  it('matches F2 card variants for every status', () => {
    for (const status of Object.values(CardStatus)) {
      expect(statusBadgeVariant({ kind: 'card', status })).toBe(cardStatusVariant(status))
    }
  })

  it('matches F2 request variants for every status', () => {
    for (const status of Object.values(PurchaseRequestStatus)) {
      expect(statusBadgeVariant({ kind: 'request', status })).toBe(
        purchaseRequestStatusVariant(status),
      )
    }
  })

  it('matches F2 rule-run variants for every status', () => {
    for (const status of Object.values(RuleRunStatus)) {
      expect(statusBadgeVariant({ kind: 'ruleRun', status })).toBe(ruleRunStatusVariant(status))
    }
  })
})
