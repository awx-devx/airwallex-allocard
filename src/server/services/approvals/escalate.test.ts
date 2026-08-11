import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { OrgRole } from '@/shared/enums/orgRole'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import type { OrgContext } from '@/server/http/types'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { ApprovalRuleModel } from '@/server/models/ApprovalRule'
import { AuditLogModel } from '@/server/models/AuditLog'
import { ProjectModel } from '@/server/models/Project'
import { PurchaseRequestModel } from '@/server/models/PurchaseRequest'
import * as approvalRules from '@/server/repositories/approvalRules'
import * as projects from '@/server/repositories/projects'
import * as purchaseRequests from '@/server/repositories/purchaseRequests'
import { escalateApprovals } from '@/server/services/approvals/escalate'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

describe('approvals/escalate', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      ProjectModel.syncIndexes(),
      PurchaseRequestModel.syncIndexes(),
      ApprovalRuleModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetEventPublisher()
  })

  it('escalates PENDING past escalationAfterMins once (idempotent)', async () => {
    const org = ctx('org_esc')
    const project = await projects.createProject(org, { name: 'Esc', code: 'ESC-1' })
    await approvalRules.replaceProjectRules(org, project.id, [
      {
        threshold: 1,
        approverSelection: { type: ApproverSelection.PROJECT_OWNER },
        requiredCount: 1,
        escalationAfterMins: 60,
        escalateTo: { type: ApproverSelection.ROLE, roleKey: 'finance-approver' },
      },
    ])

    const created = await purchaseRequests.createPurchaseRequest(org, {
      projectId: project.id,
      requestedBy: 'user_req',
      amount: 10_000,
      currency: 'USD',
      vendor: 'V',
      description: 'D',
      justification: 'J',
    })
    const pending = await purchaseRequests.submitPurchaseRequest(org, created.id, {
      policyDecision: {
        outcome: PolicyOutcome.APPROVAL_REQUIRED,
        reasons: [],
        requiredApprovals: 1,
      },
      status: PurchaseRequestStatus.PENDING,
    })
    expect(pending).not.toBeNull()

    // Force updatedAt into the past beyond SLA (disable timestamps so Mongoose
    // does not clobber our $set with "now").
    const past = new Date(Date.now() - 2 * 60 * 60_000)
    await PurchaseRequestModel.updateOne(
      { _id: pending!.id, orgId: org.orgId },
      { $set: { updatedAt: past } },
      { timestamps: false },
    )

    const now = new Date()
    const first = await escalateApprovals(now)
    expect(first.escalated).toBe(1)

    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.REQUEST_ESCALATED)
    expect(events).toHaveLength(1)

    const second = await escalateApprovals(now)
    expect(second.escalated).toBe(0)
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.REQUEST_ESCALATED),
    ).toHaveLength(1)

    const reloaded = await purchaseRequests.findPurchaseRequestById(org, pending!.id)
    expect(reloaded?.escalatedAt).toEqual(expect.any(String))
  })

  it('skips PENDING that are still within SLA', async () => {
    const org = ctx('org_fresh')
    const project = await projects.createProject(org, { name: 'Fresh', code: 'FRS-1' })
    await approvalRules.replaceProjectRules(org, project.id, [
      {
        threshold: 1,
        approverSelection: { type: ApproverSelection.PROJECT_OWNER },
        requiredCount: 1,
        escalationAfterMins: 240,
        escalateTo: { type: ApproverSelection.PROJECT_OWNER },
      },
    ])
    const created = await purchaseRequests.createPurchaseRequest(org, {
      projectId: project.id,
      requestedBy: 'user_req',
      amount: 5_000,
      currency: 'USD',
      vendor: 'V',
      description: 'D',
      justification: 'J',
    })
    await purchaseRequests.submitPurchaseRequest(org, created.id, {
      policyDecision: {
        outcome: PolicyOutcome.APPROVAL_REQUIRED,
        reasons: [],
        requiredApprovals: 1,
      },
      status: PurchaseRequestStatus.PENDING,
    })

    const result = await escalateApprovals(new Date())
    expect(result.escalated).toBe(0)
  })
})
