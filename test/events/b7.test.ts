/**
 * B7.10 — request domain events + B6 can consume request.approved.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { handleDomainEventForRules } from '@/server/events/handlers/rules'
import { DomainEventType } from '@/server/events/types'
import type { OrgContext } from '@/server/http/types'
import { ApprovalRuleModel } from '@/server/models/ApprovalRule'
import { AuditLogModel } from '@/server/models/AuditLog'
import { BudgetModel } from '@/server/models/Budget'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { ProjectModel } from '@/server/models/Project'
import { PurchaseRequestModel } from '@/server/models/PurchaseRequest'
import { resetRedis } from '@/server/redis'
import * as approvalRules from '@/server/repositories/approvalRules'
import * as projects from '@/server/repositories/projects'
import { escalateApprovals } from '@/server/services/approvals/escalate'
import {
  cancelPurchaseRequest,
  createPurchaseRequest,
  decidePurchaseRequest,
  submitPurchaseRequest,
} from '@/server/services/approvals/requests'
import * as evaluateAndApplyModule from '@/server/services/rules/evaluateAndApply'
import { ApprovalDecision } from '@/shared/enums/approvalDecision'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { OrgRole } from '@/shared/enums/orgRole'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { useTestDb } from '../helpers/db'

function ctx(orgId: string, userId = 'user_req'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

function draftBody(overrides: Record<string, unknown> = {}) {
  return {
    amount: 25_000,
    currency: 'USD',
    vendor: 'Acme',
    description: 'Office chairs',
    justification: 'New hires',
    ...overrides,
  }
}

async function seedApprovalRule(
  orgCtx: OrgContext,
  projectId: string,
  threshold: number,
  requiredCount = 1,
  escalationAfterMins = 240,
) {
  await approvalRules.replaceProjectRules(orgCtx, projectId, [
    {
      threshold,
      approverSelection: { type: ApproverSelection.PROJECT_OWNER },
      requiredCount,
      escalationAfterMins,
      escalateTo: { type: ApproverSelection.ROLE, roleKey: 'approver' },
    },
  ])
}

describe('events/b7', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      ProjectModel.syncIndexes(),
      BudgetModel.syncIndexes(),
      BudgetEntryModel.syncIndexes(),
      PurchaseRequestModel.syncIndexes(),
      ApprovalRuleModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetRedis()
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    resetEventPublisher()
    resetRedis()
    vi.restoreAllMocks()
  })

  it('emits request.created on create', async () => {
    const orgCtx = ctx('org_ev_create')
    const project = await projects.createProject(orgCtx, { name: 'C', code: 'EV-C' })

    const created = await createPurchaseRequest(orgCtx, project.id, draftBody())

    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.REQUEST_CREATED)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      orgId: orgCtx.orgId,
      projectId: project.id,
      subjectType: 'purchaseRequest',
      subjectId: created.id,
      payload: expect.objectContaining({
        requestId: created.id,
        status: PurchaseRequestStatus.DRAFT,
      }),
    })
  })

  it('emits request.submitted and request.approved once under threshold; B6 can consume approved', async () => {
    const orgCtx = ctx('org_ev_approved')
    const project = await projects.createProject(orgCtx, { name: 'A', code: 'EV-A' })
    await seedApprovalRule(orgCtx, project.id, 10_000, 1)

    const created = await createPurchaseRequest(orgCtx, project.id, draftBody({ amount: 5_000 }))
    resetEventPublisher()

    await submitPurchaseRequest(orgCtx, created.id)

    const submitted = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.REQUEST_SUBMITTED,
    )
    const approved = getPublishedEvents().filter((e) => e.type === DomainEventType.REQUEST_APPROVED)
    expect(submitted).toHaveLength(1)
    expect(approved).toHaveLength(1)
    expect(approved[0]?.subjectId).toBe(created.id)

    const evaluateSpy = vi.spyOn(evaluateAndApplyModule, 'evaluateAndApply').mockResolvedValue({
      runs: [],
      pipeline: {
        outcomes: [],
        desiredState: { cards: [] },
        diff: { cards: [] },
        conflicts: [],
        explanations: [],
      },
    })

    await handleDomainEventForRules(approved[0]!, {})

    expect(evaluateSpy).toHaveBeenCalledTimes(1)
    expect(evaluateSpy.mock.calls[0]?.[1]).toMatchObject({
      triggerEvent: DomainEventType.REQUEST_APPROVED,
      projectId: project.id,
    })
  })

  it('emits request.submitted then request.approved once on decide', async () => {
    const requester = ctx('org_ev_decide', 'user_req')
    const approver = ctx('org_ev_decide', 'user_appr')
    const project = await projects.createProject(requester, { name: 'D', code: 'EV-D' })
    await seedApprovalRule(requester, project.id, 1_000, 1)

    const created = await createPurchaseRequest(
      requester,
      project.id,
      draftBody({ amount: 20_000 }),
    )
    await submitPurchaseRequest(requester, created.id)
    resetEventPublisher()

    await decidePurchaseRequest(approver, created.id, { decision: ApprovalDecision.APPROVE })

    const approved = getPublishedEvents().filter((e) => e.type === DomainEventType.REQUEST_APPROVED)
    expect(approved).toHaveLength(1)
    expect(approved[0]?.payload).toMatchObject({
      requestId: created.id,
      status: PurchaseRequestStatus.APPROVED,
    })
  })

  it('emits request.rejected on reject', async () => {
    const requester = ctx('org_ev_rej', 'user_req')
    const approver = ctx('org_ev_rej', 'user_appr')
    const project = await projects.createProject(requester, { name: 'R', code: 'EV-R' })
    await seedApprovalRule(requester, project.id, 1_000, 1)

    const created = await createPurchaseRequest(
      requester,
      project.id,
      draftBody({ amount: 20_000 }),
    )
    await submitPurchaseRequest(requester, created.id)
    resetEventPublisher()

    await decidePurchaseRequest(approver, created.id, {
      decision: ApprovalDecision.REJECT,
      reason: 'Out of policy',
    })

    const rejected = getPublishedEvents().filter((e) => e.type === DomainEventType.REQUEST_REJECTED)
    expect(rejected).toHaveLength(1)
    expect(rejected[0]?.payload).toMatchObject({
      requestId: created.id,
      reason: 'Out of policy',
    })
  })

  it('emits request.cancelled on cancel', async () => {
    const orgCtx = ctx('org_ev_cancel')
    const project = await projects.createProject(orgCtx, { name: 'X', code: 'EV-X' })
    const created = await createPurchaseRequest(orgCtx, project.id, draftBody())
    resetEventPublisher()

    await cancelPurchaseRequest(orgCtx, created.id)

    const cancelled = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.REQUEST_CANCELLED,
    )
    expect(cancelled).toHaveLength(1)
    expect(cancelled[0]?.subjectId).toBe(created.id)
  })

  it('emits request.escalated once from the sweep', async () => {
    const orgCtx = ctx('org_ev_esc')
    const project = await projects.createProject(orgCtx, { name: 'E', code: 'EV-E' })
    await seedApprovalRule(orgCtx, project.id, 1, 1, 60)

    const created = await createPurchaseRequest(orgCtx, project.id, draftBody({ amount: 10_000 }))
    const pending = await submitPurchaseRequest(orgCtx, created.id)
    expect(pending.status).toBe(PurchaseRequestStatus.PENDING)

    const past = new Date(Date.now() - 2 * 60 * 60_000)
    await PurchaseRequestModel.updateOne(
      { _id: pending.id, orgId: orgCtx.orgId },
      { $set: { updatedAt: past } },
      { timestamps: false },
    )

    resetEventPublisher()
    const result = await escalateApprovals(new Date())
    expect(result.escalated).toBe(1)

    const escalated = getPublishedEvents().filter(
      (e) => e.type === DomainEventType.REQUEST_ESCALATED,
    )
    expect(escalated).toHaveLength(1)
    expect(escalated[0]?.payload).toMatchObject({
      requestId: pending.id,
      projectId: project.id,
    })
  })
})
