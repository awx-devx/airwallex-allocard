import { describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { ApprovalDecision } from '@/shared/enums/approvalDecision'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import type { OrgContext } from '@/server/http/types'
import { OrgRole } from '@/shared/enums/orgRole'
import * as purchaseRequests from '@/server/repositories/purchaseRequests'
import * as approvalRules from '@/server/repositories/approvalRules'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

function draftInput(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 'proj_1',
    requestedBy: 'user_1',
    amount: 25_000,
    currency: 'USD',
    vendor: 'Acme',
    description: 'Chairs',
    justification: 'New hires',
    ...overrides,
  }
}

function ruleBody(overrides: Record<string, unknown> = {}) {
  return {
    threshold: 10_000,
    approverSelection: { type: ApproverSelection.PROJECT_OWNER },
    requiredCount: 1,
    escalationAfterMins: 240,
    escalateTo: { type: ApproverSelection.ROLE, roleKey: 'finance-approver' },
    ...overrides,
  }
}

describe('repositories/purchaseRequest', () => {
  useTestDb()

  describe('purchaseRequests', () => {
    it('creates DRAFT and finds within org only', async () => {
      const created = await purchaseRequests.createPurchaseRequest(ctx('org_1'), draftInput())
      expect(created.status).toBe(PurchaseRequestStatus.DRAFT)
      expect(created.policyDecision).toBeNull()
      expect(created.approvals).toEqual([])

      expect(
        await purchaseRequests.findPurchaseRequestById(ctx('org_1'), created.id),
      ).toMatchObject({ id: created.id })
      expect(
        await purchaseRequests.findPurchaseRequestById(ctx('org_other'), created.id),
      ).toBeNull()
      expect(await purchaseRequests.findPurchaseRequestById(ctx('org_1'), 'not-an-id')).toBeNull()
    })

    it('updates only while DRAFT', async () => {
      const created = await purchaseRequests.createPurchaseRequest(ctx('org_1'), draftInput())
      const updated = await purchaseRequests.updateDraftPurchaseRequest(ctx('org_1'), created.id, {
        amount: 50_000,
        vendor: 'Beta',
      })
      expect(updated?.amount).toBe(50_000)
      expect(updated?.vendor).toBe('Beta')

      await purchaseRequests.submitPurchaseRequest(ctx('org_1'), created.id, {
        policyDecision: {
          outcome: PolicyOutcome.APPROVAL_REQUIRED,
          reasons: [],
          requiredApprovals: 1,
        },
        status: PurchaseRequestStatus.PENDING,
      })

      expect(
        await purchaseRequests.updateDraftPurchaseRequest(ctx('org_1'), created.id, {
          amount: 1,
        }),
      ).toBeNull()
    })

    it('lists by project with pagination and requestedBy filter', async () => {
      const org = ctx('org_list')
      await purchaseRequests.createPurchaseRequest(org, draftInput({ requestedBy: 'a' }))
      await purchaseRequests.createPurchaseRequest(org, draftInput({ requestedBy: 'b' }))
      await purchaseRequests.createPurchaseRequest(
        org,
        draftInput({ projectId: 'proj_other', requestedBy: 'a' }),
      )

      const page = await purchaseRequests.listPurchaseRequests(org, 'proj_1', {
        page: 1,
        pageSize: 10,
        requestedBy: 'a',
      })
      expect(page.total).toBe(1)
      expect(page.items[0]?.requestedBy).toBe('a')
    })

    it('listPendingForApprover returns PENDING oldest-first and can exclude requester', async () => {
      const org = ctx('org_queue')
      const first = await purchaseRequests.createPurchaseRequest(
        org,
        draftInput({ requestedBy: 'req_1' }),
      )
      const second = await purchaseRequests.createPurchaseRequest(
        org,
        draftInput({ requestedBy: 'req_2' }),
      )
      const policy = {
        outcome: PolicyOutcome.APPROVAL_REQUIRED,
        reasons: [],
        requiredApprovals: 1,
      }
      await purchaseRequests.submitPurchaseRequest(org, first.id, {
        policyDecision: policy,
        status: PurchaseRequestStatus.PENDING,
      })
      await purchaseRequests.submitPurchaseRequest(org, second.id, {
        policyDecision: policy,
        status: PurchaseRequestStatus.PENDING,
      })

      const all = await purchaseRequests.listPendingForApprover(org, { page: 1, pageSize: 20 })
      expect(all.total).toBe(2)
      expect(all.items.map((r) => r.id)).toEqual([first.id, second.id])

      const filtered = await purchaseRequests.listPendingForApprover(org, {
        excludeRequesterId: 'req_1',
      })
      expect(filtered.total).toBe(1)
      expect(filtered.items[0]?.requestedBy).toBe('req_2')
    })

    it('listOverdueForEscalation is cross-tenant and skips escalated', async () => {
      const a = await purchaseRequests.createPurchaseRequest(ctx('org_a'), draftInput())
      const b = await purchaseRequests.createPurchaseRequest(ctx('org_b'), draftInput())
      const policy = {
        outcome: PolicyOutcome.APPROVAL_REQUIRED,
        reasons: [],
        requiredApprovals: 1,
      }
      await purchaseRequests.submitPurchaseRequest(ctx('org_a'), a.id, {
        policyDecision: policy,
        status: PurchaseRequestStatus.PENDING,
      })
      await purchaseRequests.submitPurchaseRequest(ctx('org_b'), b.id, {
        policyDecision: policy,
        status: PurchaseRequestStatus.PENDING,
      })
      await purchaseRequests.markEscalated(ctx('org_a'), a.id, new Date())

      const overdue = await purchaseRequests.listOverdueForEscalation()
      expect(overdue.map((r) => r.id)).toEqual([b.id])
    })

    it('appendApproval only while PENDING; markEscalated is idempotent', async () => {
      const org = ctx('org_appr')
      const created = await purchaseRequests.createPurchaseRequest(org, draftInput())
      expect(
        await purchaseRequests.appendApproval(org, created.id, {
          approverId: 'approver_1',
          decision: ApprovalDecision.APPROVE,
          reason: null,
          at: new Date(),
        }),
      ).toBeNull()

      await purchaseRequests.submitPurchaseRequest(org, created.id, {
        policyDecision: {
          outcome: PolicyOutcome.APPROVAL_REQUIRED,
          reasons: [],
          requiredApprovals: 2,
        },
        status: PurchaseRequestStatus.PENDING,
      })

      const withApproval = await purchaseRequests.appendApproval(org, created.id, {
        approverId: 'approver_1',
        decision: ApprovalDecision.APPROVE,
        reason: null,
        at: new Date('2026-08-11T12:00:00.000Z'),
      })
      expect(withApproval?.approvals).toHaveLength(1)

      const first = await purchaseRequests.markEscalated(
        org,
        created.id,
        new Date('2026-08-11T13:00:00.000Z'),
      )
      expect(first?.escalatedAt).toBe('2026-08-11T13:00:00.000Z')
      expect(
        await purchaseRequests.markEscalated(org, created.id, new Date('2026-08-11T14:00:00.000Z')),
      ).toBeNull()
    })

    it('setPurchaseRequestStatus cancels from DRAFT/PENDING', async () => {
      const org = ctx('org_cancel')
      const draft = await purchaseRequests.createPurchaseRequest(org, draftInput())
      const cancelled = await purchaseRequests.setPurchaseRequestStatus(
        org,
        draft.id,
        PurchaseRequestStatus.CANCELLED,
      )
      expect(cancelled?.status).toBe(PurchaseRequestStatus.CANCELLED)
      expect(
        await purchaseRequests.setPurchaseRequestStatus(
          org,
          draft.id,
          PurchaseRequestStatus.CANCELLED,
        ),
      ).toBeNull()
    })
  })

  describe('approvalRules', () => {
    it('replaceProjectRules replaces only that project and preserves org defaults', async () => {
      const org = ctx('org_rules')
      await approvalRules.replaceProjectRules(org, 'proj_1', [ruleBody({ threshold: 5_000 })])

      const { ApprovalRuleModel } = await import('@/server/models/ApprovalRule')
      await ApprovalRuleModel.create({
        orgId: 'org_rules',
        projectId: null,
        threshold: 1_000,
        approverSelection: { type: ApproverSelection.PROJECT_OWNER },
        requiredCount: 1,
        escalationAfterMins: 60,
        escalateTo: { type: ApproverSelection.PROJECT_OWNER },
      })

      const replaced = await approvalRules.replaceProjectRules(org, 'proj_1', [
        ruleBody({ threshold: 20_000, requiredCount: 2 }),
        ruleBody({
          threshold: 50_000,
          approverSelection: {
            type: ApproverSelection.NAMED_USERS,
            userIds: ['u1', 'u2'],
          },
        }),
      ])
      expect(replaced).toHaveLength(2)
      expect(replaced.map((r) => r.threshold)).toEqual([20_000, 50_000])

      const projectOnly = await approvalRules.listApprovalRules(org, 'proj_1')
      expect(projectOnly).toHaveLength(2)

      const defaults = await approvalRules.listOrgDefaultApprovalRules(org)
      expect(defaults).toHaveLength(1)
      expect(defaults[0]?.threshold).toBe(1_000)

      const applicable = await approvalRules.listApplicableApprovalRules(org, 'proj_1')
      expect(applicable.map((r) => r.threshold)).toEqual([1_000, 20_000, 50_000])

      // other project untouched
      await approvalRules.replaceProjectRules(org, 'proj_2', [ruleBody({ threshold: 99 })])
      expect(await approvalRules.listApprovalRules(org, 'proj_1')).toHaveLength(2)
    })
  })
})
