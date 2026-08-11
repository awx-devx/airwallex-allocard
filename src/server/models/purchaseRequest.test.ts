import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { ApprovalDecision } from '@/shared/enums/approvalDecision'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { ApprovalRuleModel } from '@/server/models/ApprovalRule'
import { PurchaseRequestModel } from '@/server/models/PurchaseRequest'
import { toDomain } from '@/server/models/base'
import type { ApprovalRule } from '@/shared/types/approvalRule'
import type { PurchaseRequest } from '@/shared/types/purchaseRequest'

async function syncIndexes(): Promise<void> {
  await Promise.all([PurchaseRequestModel.syncIndexes(), ApprovalRuleModel.syncIndexes()])
}

function minimalRequest(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    projectId: 'proj_1',
    requestedBy: 'user_1',
    amount: 25_000,
    currency: 'USD',
    vendor: 'Acme Supplies',
    description: 'Office chairs',
    justification: 'New hires starting next month',
    ...overrides,
  }
}

function minimalRule(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    projectId: 'proj_1',
    threshold: 10_000,
    approverSelection: { type: ApproverSelection.PROJECT_OWNER },
    requiredCount: 1,
    escalationAfterMins: 240,
    escalateTo: { type: ApproverSelection.ROLE, roleKey: 'finance-approver' },
    ...overrides,
  }
}

describe('models/purchaseRequest', () => {
  useTestDb()

  beforeAll(async () => {
    await syncIndexes()
  })

  describe('PurchaseRequest', () => {
    it('defaults DRAFT status, empty approvals, null policyDecision', async () => {
      const doc = await PurchaseRequestModel.create(minimalRequest())

      expect(doc.status).toBe(PurchaseRequestStatus.DRAFT)
      expect(doc.approvals).toEqual([])
      expect(doc.policyDecision).toBeNull()
      expect(doc.categoryId).toBeNull()
      expect(doc.cardId).toBeNull()
      expect(doc.escalatedAt).toBeNull()
      expect(doc.amount).toBe(25_000)
    })

    it('embeds policyDecision and approvals without subdocument _id', async () => {
      const at = new Date('2026-08-11T12:00:00.000Z')
      const doc = await PurchaseRequestModel.create(
        minimalRequest({
          status: PurchaseRequestStatus.PENDING,
          policyDecision: {
            outcome: PolicyOutcome.APPROVAL_REQUIRED,
            reasons: [],
            requiredApprovals: 2,
          },
          approvals: [
            {
              approverId: 'user_2',
              decision: ApprovalDecision.APPROVE,
              reason: null,
              at,
            },
          ],
        }),
      )

      expect(doc.policyDecision).toMatchObject({
        outcome: PolicyOutcome.APPROVAL_REQUIRED,
        requiredApprovals: 2,
      })
      expect(doc.approvals).toHaveLength(1)

      const domain = toDomain<PurchaseRequest>(doc)
      expect(domain.policyDecision?.outcome).toBe(PolicyOutcome.APPROVAL_REQUIRED)
      expect(domain.approvals[0]).toMatchObject({
        approverId: 'user_2',
        decision: ApprovalDecision.APPROVE,
        reason: null,
        at: at.toISOString(),
      })
      expect(domain.approvals[0]).not.toHaveProperty('_id')
      expect(domain).toMatchObject({
        id: expect.any(String),
        amount: 25_000,
        status: PurchaseRequestStatus.PENDING,
      })
    })

    it('throws without orgId (tenantScoped)', async () => {
      await expect(PurchaseRequestModel.find({ projectId: 'proj_1' }).exec()).rejects.toThrow(
        /Tenant scope missing/,
      )
    })

    it('allows same projectId across orgs', async () => {
      await PurchaseRequestModel.create(minimalRequest({ orgId: 'org_1' }))
      const other = await PurchaseRequestModel.create(minimalRequest({ orgId: 'org_2' }))
      expect(other.orgId).toBe('org_2')
    })
  })

  describe('ApprovalRule', () => {
    it('stores discriminated approverSelection and escalateTo', async () => {
      const doc = await ApprovalRuleModel.create(
        minimalRule({
          approverSelection: {
            type: ApproverSelection.NAMED_USERS,
            userIds: ['user_a', 'user_b'],
          },
        }),
      )

      const domain = toDomain<ApprovalRule>(doc)
      expect(domain.approverSelection).toEqual({
        type: ApproverSelection.NAMED_USERS,
        userIds: ['user_a', 'user_b'],
      })
      expect(domain.escalateTo).toEqual({
        type: ApproverSelection.ROLE,
        roleKey: 'finance-approver',
      })
      expect(domain.threshold).toBe(10_000)
      expect(domain.projectId).toBe('proj_1')
    })

    it('allows null projectId for org default', async () => {
      const doc = await ApprovalRuleModel.create(minimalRule({ projectId: null }))
      expect(doc.projectId).toBeNull()
      const domain = toDomain<ApprovalRule>(doc)
      expect(domain.projectId).toBeNull()
    })

    it('throws without orgId (tenantScoped)', async () => {
      await expect(ApprovalRuleModel.find({ projectId: 'proj_1' }).exec()).rejects.toThrow(
        /Tenant scope missing/,
      )
    })
  })
})
