import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { ApprovalDecision } from '@/shared/enums/approvalDecision'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { AuditLogModel } from '@/server/models/AuditLog'
import { ApprovalRuleModel } from '@/server/models/ApprovalRule'
import { BudgetModel } from '@/server/models/Budget'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { ProjectModel } from '@/server/models/Project'
import { PurchaseRequestModel } from '@/server/models/PurchaseRequest'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AppError } from '@/server/http/errors'
import type { OrgContext } from '@/server/http/types'
import { resetRedis } from '@/server/redis'
import * as approvalRules from '@/server/repositories/approvalRules'
import * as budgetEntries from '@/server/repositories/budgetEntries'
import * as budgets from '@/server/repositories/budgets'
import * as projects from '@/server/repositories/projects'
import { appendBudgetEntry } from '@/server/services/budget/ledger'
import {
  cancelPurchaseRequest,
  createPurchaseRequest,
  decidePurchaseRequest,
  submitPurchaseRequest,
  updatePurchaseRequest,
} from '@/server/services/approvals/requests'

function ctx(orgId: string, userId = 'user_req'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

function draftBody(overrides: Record<string, unknown> = {}) {
  return {
    amount: 5_000,
    currency: 'USD',
    vendor: 'Acme',
    description: 'Office chairs',
    justification: 'New hires',
    ...overrides,
  }
}

async function seedProject(orgCtx: OrgContext, code: string) {
  return projects.createProject(orgCtx, { name: code, code })
}

async function seedBudgetWithRemaining(
  orgCtx: OrgContext,
  projectId: string,
  approvedAmount: number,
) {
  await budgets.upsertBudgetFields(orgCtx, projectId, {
    currency: 'USD',
    approvedAmount,
  })
  await appendBudgetEntry(orgCtx, projectId, {
    type: BudgetEntryType.APPROVAL,
    amount: approvedAmount,
    currency: 'USD',
    sourceType: BudgetEntrySourceType.MANUAL,
    sourceId: `budget_${projectId}`,
    createdBy: orgCtx.userId,
  })
}

async function seedApprovalRule(
  orgCtx: OrgContext,
  projectId: string,
  threshold: number,
  requiredCount = 1,
) {
  await approvalRules.replaceProjectRules(orgCtx, projectId, [
    {
      threshold,
      approverSelection: { type: ApproverSelection.PROJECT_OWNER },
      requiredCount,
      escalationAfterMins: 240,
      escalateTo: { type: ApproverSelection.ROLE, roleKey: 'finance-approver' },
    },
  ])
}

async function auditsFor(orgId: string, action?: string) {
  const filter: Record<string, unknown> = { orgId }
  if (action !== undefined) filter.action = action
  return AuditLogModel.find(filter).exec()
}

describe('approvals/requests', () => {
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
  })

  afterEach(() => {
    resetEventPublisher()
    resetRedis()
  })

  it('create → DRAFT + audit + event', async () => {
    const orgCtx = ctx('org_create')
    const project = await seedProject(orgCtx, 'CREATE-1')

    const created = await createPurchaseRequest(orgCtx, project.id, draftBody())
    expect(created.status).toBe(PurchaseRequestStatus.DRAFT)
    expect(created.policyDecision).toBeNull()
    expect(created.requestedBy).toBe(orgCtx.userId)

    const audits = await auditsFor(orgCtx.orgId, 'request.created')
    expect(audits).toHaveLength(1)
    expect(audits[0]?.subjectId).toBe(created.id)

    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.REQUEST_CREATED)
    expect(events).toHaveLength(1)
    expect(events[0]?.subjectId).toBe(created.id)
  })

  it('update only DRAFT by requester', async () => {
    const orgCtx = ctx('org_update')
    const other = ctx('org_update', 'user_other')
    const project = await seedProject(orgCtx, 'UPD-1')
    const created = await createPurchaseRequest(orgCtx, project.id, draftBody())

    const updated = await updatePurchaseRequest(orgCtx, created.id, {
      amount: 8_000,
      vendor: 'Beta',
    })
    expect(updated.amount).toBe(8_000)
    expect(updated.vendor).toBe('Beta')

    const audits = await auditsFor(orgCtx.orgId, 'request.updated')
    expect(audits).toHaveLength(1)

    await expect(updatePurchaseRequest(other, created.id, { amount: 1 })).rejects.toMatchObject({
      code: ErrorCode.PERMISSION_DENIED,
    })

    await submitPurchaseRequest(orgCtx, created.id)
    await expect(updatePurchaseRequest(orgCtx, created.id, { amount: 2 })).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    })
  })

  it('submit under threshold → APPROVED + commitment + events', async () => {
    const orgCtx = ctx('org_under')
    const project = await seedProject(orgCtx, 'UNDER-1')
    await seedApprovalRule(orgCtx, project.id, 10_000, 1)

    const created = await createPurchaseRequest(orgCtx, project.id, draftBody({ amount: 5_000 }))
    resetEventPublisher()

    const submitted = await submitPurchaseRequest(orgCtx, created.id)
    expect(submitted.status).toBe(PurchaseRequestStatus.APPROVED)
    expect(submitted.policyDecision?.outcome).toBe(PolicyOutcome.NO_APPROVAL_REQUIRED)

    const entries = await budgetEntries.findEntriesByProject(orgCtx, project.id)
    const commitments = entries.filter(
      (e) =>
        e.type === BudgetEntryType.COMMITMENT &&
        e.sourceType === BudgetEntrySourceType.PURCHASE_REQUEST &&
        e.sourceId === submitted.id,
    )
    expect(commitments).toHaveLength(1)
    expect(commitments[0]?.amount).toBe(5_000)

    const types = getPublishedEvents().map((e) => e.type)
    expect(types).toContain(DomainEventType.REQUEST_SUBMITTED)
    expect(types).toContain(DomainEventType.REQUEST_APPROVED)

    const audits = await auditsFor(orgCtx.orgId, 'request.submitted')
    expect(audits).toHaveLength(1)
  })

  it('submit over threshold → PENDING', async () => {
    const orgCtx = ctx('org_over')
    const project = await seedProject(orgCtx, 'OVER-1')
    await seedApprovalRule(orgCtx, project.id, 10_000, 2)

    const created = await createPurchaseRequest(orgCtx, project.id, draftBody({ amount: 25_000 }))

    const submitted = await submitPurchaseRequest(orgCtx, created.id)
    expect(submitted.status).toBe(PurchaseRequestStatus.PENDING)
    expect(submitted.policyDecision?.outcome).toBe(PolicyOutcome.APPROVAL_REQUIRED)
    expect(submitted.policyDecision?.requiredApprovals).toBe(2)

    const entries = await budgetEntries.findEntriesByProject(orgCtx, project.id)
    expect(entries.filter((e) => e.type === BudgetEntryType.COMMITMENT)).toHaveLength(0)

    const types = getPublishedEvents().map((e) => e.type)
    expect(types).toContain(DomainEventType.REQUEST_SUBMITTED)
    expect(types).not.toContain(DomainEventType.REQUEST_APPROVED)
  })

  it('submit NOT_PERMITTED when spending denial (remaining budget)', async () => {
    const orgCtx = ctx('org_spend')
    const project = await seedProject(orgCtx, 'SPEND-1')
    await seedBudgetWithRemaining(orgCtx, project.id, 10_000)

    const created = await createPurchaseRequest(orgCtx, project.id, draftBody({ amount: 50_000 }))

    try {
      await submitPurchaseRequest(orgCtx, created.id)
      expect.unreachable('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(AppError)
      const appError = error as AppError
      expect(appError.code).toBe(ErrorCode.VALIDATION_FAILED)
      expect(appError.details).toEqual({
        fieldErrors: {
          policy: [expect.stringMatching(/Insufficient remaining budget \(\$100\.00\)/)],
        },
      })
    }

    const stored = await PurchaseRequestModel.findOne({
      _id: created.id,
      orgId: orgCtx.orgId,
    })
      .lean()
      .exec()
    expect(stored?.status).toBe(PurchaseRequestStatus.DRAFT)
  })

  it('decide APPROVE until requiredCount; duplicate same user does not complete', async () => {
    const requester = ctx('org_multi', 'user_req')
    const approverA = ctx('org_multi', 'user_a')
    const approverB = ctx('org_multi', 'user_b')
    const project = await seedProject(requester, 'MULTI-1')
    await seedApprovalRule(requester, project.id, 1_000, 2)

    const created = await createPurchaseRequest(
      requester,
      project.id,
      draftBody({ amount: 20_000 }),
    )
    const pending = await submitPurchaseRequest(requester, created.id)
    expect(pending.status).toBe(PurchaseRequestStatus.PENDING)
    expect(pending.policyDecision?.requiredApprovals).toBe(2)

    const first = await decidePurchaseRequest(approverA, pending.id, {
      decision: ApprovalDecision.APPROVE,
    })
    expect(first.status).toBe(PurchaseRequestStatus.PENDING)
    expect(first.approvals).toHaveLength(1)

    const dup = await decidePurchaseRequest(approverA, pending.id, {
      decision: ApprovalDecision.APPROVE,
    })
    expect(dup.status).toBe(PurchaseRequestStatus.PENDING)
    expect(dup.approvals).toHaveLength(2)

    resetEventPublisher()
    const done = await decidePurchaseRequest(approverB, pending.id, {
      decision: ApprovalDecision.APPROVE,
    })
    expect(done.status).toBe(PurchaseRequestStatus.APPROVED)
    expect(done.approvals).toHaveLength(3)

    const entries = await budgetEntries.findEntriesByProject(requester, project.id)
    expect(
      entries.filter((e) => e.type === BudgetEntryType.COMMITMENT && e.sourceId === done.id),
    ).toHaveLength(1)

    expect(getPublishedEvents().some((e) => e.type === DomainEventType.REQUEST_APPROVED)).toBe(true)
  })

  it('decide REJECT requires reason; 409 if already decided', async () => {
    const requester = ctx('org_rej', 'user_req')
    const approver = ctx('org_rej', 'user_a')
    const project = await seedProject(requester, 'REJ-1')
    await seedApprovalRule(requester, project.id, 1_000, 1)

    const created = await createPurchaseRequest(
      requester,
      project.id,
      draftBody({ amount: 20_000 }),
    )
    const pending = await submitPurchaseRequest(requester, created.id)

    await expect(
      decidePurchaseRequest(approver, pending.id, { decision: ApprovalDecision.REJECT }),
    ).rejects.toMatchObject({ code: ErrorCode.VALIDATION_FAILED })

    const rejected = await decidePurchaseRequest(approver, pending.id, {
      decision: ApprovalDecision.REJECT,
      reason: 'Out of policy',
    })
    expect(rejected.status).toBe(PurchaseRequestStatus.REJECTED)

    expect(getPublishedEvents().some((e) => e.type === DomainEventType.REQUEST_REJECTED)).toBe(true)

    await expect(
      decidePurchaseRequest(approver, pending.id, {
        decision: ApprovalDecision.APPROVE,
      }),
    ).rejects.toMatchObject({ code: ErrorCode.CONFLICT })
  })

  it('cancel from DRAFT', async () => {
    const orgCtx = ctx('org_cancel')
    const project = await seedProject(orgCtx, 'CAN-1')
    const created = await createPurchaseRequest(orgCtx, project.id, draftBody())
    resetEventPublisher()

    const cancelled = await cancelPurchaseRequest(orgCtx, created.id)
    expect(cancelled.status).toBe(PurchaseRequestStatus.CANCELLED)

    const audits = await auditsFor(orgCtx.orgId, 'request.cancelled')
    expect(audits).toHaveLength(1)

    expect(getPublishedEvents().some((e) => e.type === DomainEventType.REQUEST_CANCELLED)).toBe(
      true,
    )

    await expect(cancelPurchaseRequest(orgCtx, created.id)).rejects.toMatchObject({
      code: ErrorCode.CONFLICT,
    })
  })

  it('requester cannot decide own request', async () => {
    const requester = ctx('org_self', 'user_req')
    const project = await seedProject(requester, 'SELF-1')
    await seedApprovalRule(requester, project.id, 1_000, 1)

    const created = await createPurchaseRequest(
      requester,
      project.id,
      draftBody({ amount: 20_000 }),
    )
    const pending = await submitPurchaseRequest(requester, created.id)

    await expect(
      decidePurchaseRequest(requester, pending.id, {
        decision: ApprovalDecision.APPROVE,
      }),
    ).rejects.toMatchObject({
      code: ErrorCode.PERMISSION_DENIED,
      message: 'Requester cannot decide their own request',
    })
  })
})
