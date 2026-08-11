import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { OrgRole } from '@/shared/enums/orgRole'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import type { OrgContext } from '@/server/http/types'
import { resetRedis } from '@/server/redis'
import * as approvalRules from '@/server/repositories/approvalRules'
import * as budgetEntries from '@/server/repositories/budgetEntries'
import * as budgets from '@/server/repositories/budgets'
import * as projects from '@/server/repositories/projects'
import * as purchaseRequests from '@/server/repositories/purchaseRequests'
import { appendBudgetEntry } from '@/server/services/budget/ledger'
import { projectBudget } from '@/server/services/budget/projectProjection'
import {
  cancelPurchaseRequest,
  createPurchaseRequest,
  decidePurchaseRequest,
  releaseIfCommitted,
  submitPurchaseRequest,
} from '@/server/services/approvals/requests'
import { ApprovalRuleModel } from '@/server/models/ApprovalRule'
import { BudgetModel } from '@/server/models/Budget'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { ProjectModel } from '@/server/models/Project'
import { PurchaseRequestModel } from '@/server/models/PurchaseRequest'
import { resetEventPublisher } from '@/server/events/bus'

function ctx(orgId: string, userId = 'user_req'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

async function seedProjectBudget(orgCtx: OrgContext, code: string, approved: number) {
  const project = await projects.createProject(orgCtx, { name: code, code })
  await budgets.upsertBudgetFields(orgCtx, project.id, {
    currency: 'USD',
    approvedAmount: approved,
  })
  await appendBudgetEntry(orgCtx, project.id, {
    type: BudgetEntryType.APPROVAL,
    amount: approved,
    currency: 'USD',
    sourceType: BudgetEntrySourceType.MANUAL,
    sourceId: `budget_${project.id}`,
    createdBy: orgCtx.userId,
  })
  return project
}

function draftBody(amount: number) {
  return {
    amount,
    currency: 'USD',
    vendor: 'Vendor',
    description: 'Item',
    justification: 'Need it',
  }
}

describe('approvals/commitment', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      ProjectModel.syncIndexes(),
      BudgetModel.syncIndexes(),
      BudgetEntryModel.syncIndexes(),
      PurchaseRequestModel.syncIndexes(),
      ApprovalRuleModel.syncIndexes(),
    ])
  })

  beforeEach(async () => {
    resetEventPublisher()
    await resetRedis()
  })

  it('APPROVED writes exactly one COMMITMENT; remaining decreases', async () => {
    const org = ctx('org_commit')
    const project = await seedProjectBudget(org, 'CMT-1', 100_000)
    const created = await createPurchaseRequest(org, project.id, draftBody(40_000))
    const approved = await submitPurchaseRequest(org, created.id)

    expect(approved.status).toBe(PurchaseRequestStatus.APPROVED)
    const entries = await budgetEntries.findEntriesByProject(org, project.id)
    const commitments = entries.filter(
      (e) =>
        e.type === BudgetEntryType.COMMITMENT &&
        e.sourceType === BudgetEntrySourceType.PURCHASE_REQUEST &&
        e.sourceId === approved.id,
    )
    expect(commitments).toHaveLength(1)
    expect(commitments[0]?.amount).toBe(40_000)

    const projection = projectBudget(entries)
    expect(projection.committed).toBe(40_000)
    expect(projection.remaining).toBe(60_000)
  })

  it('RELEASE balances COMMITMENT on reject after commit (via releaseIfCommitted)', async () => {
    const org = ctx('org_rel')
    const project = await seedProjectBudget(org, 'REL-1', 50_000)
    const created = await createPurchaseRequest(org, project.id, draftBody(20_000))
    const approved = await submitPurchaseRequest(org, created.id)
    expect(approved.status).toBe(PurchaseRequestStatus.APPROVED)

    const released = await releaseIfCommitted(org, approved)
    expect(released).toBe(true)
    // idempotent
    expect(await releaseIfCommitted(org, approved)).toBe(false)

    const projection = projectBudget(await budgetEntries.findEntriesByProject(org, project.id))
    expect(projection.committed).toBe(0)
    expect(projection.remaining).toBe(50_000)
  })

  it('CANCELLED from PENDING without commitment writes no RELEASE', async () => {
    const org = ctx('org_cancel_pend')
    const project = await seedProjectBudget(org, 'CAN-1', 100_000)
    await approvalRules.replaceProjectRules(org, project.id, [
      {
        threshold: 1,
        approverSelection: { type: ApproverSelection.PROJECT_OWNER },
        requiredCount: 1,
        escalationAfterMins: 60,
        escalateTo: { type: ApproverSelection.PROJECT_OWNER },
      },
    ])
    const created = await createPurchaseRequest(org, project.id, draftBody(10_000))
    await submitPurchaseRequest(org, created.id)
    await cancelPurchaseRequest(org, created.id)

    const related = (await budgetEntries.findEntriesByProject(org, project.id)).filter(
      (e) => e.sourceId === created.id,
    )
    expect(related).toHaveLength(0)
  })

  it('EXPIRED path releases a prior COMMITMENT', async () => {
    const org = ctx('org_exp')
    const project = await seedProjectBudget(org, 'EXP-1', 80_000)
    const created = await createPurchaseRequest(org, project.id, draftBody(15_000))
    const approved = await submitPurchaseRequest(org, created.id)

    await purchaseRequests.setPurchaseRequestStatus(
      org,
      approved.id,
      PurchaseRequestStatus.EXPIRED,
      { fromStatuses: [PurchaseRequestStatus.APPROVED] },
    )
    const expired = await purchaseRequests.findPurchaseRequestById(org, approved.id)
    expect(expired?.status).toBe(PurchaseRequestStatus.EXPIRED)
    await releaseIfCommitted(org, expired!)

    const projection = projectBudget(await budgetEntries.findEntriesByProject(org, project.id))
    expect(projection.committed).toBe(0)
    expect(projection.remaining).toBe(80_000)
  })

  it('decide REJECT on PENDING does not invent a RELEASE', async () => {
    const org = ctx('org_rej')
    const approver = ctx('org_rej', 'user_appr')
    const project = await seedProjectBudget(org, 'REJ-1', 100_000)
    await projects.changeOwner(org, project.id, 'user_appr')
    await approvalRules.replaceProjectRules(org, project.id, [
      {
        threshold: 1,
        approverSelection: { type: ApproverSelection.PROJECT_OWNER },
        requiredCount: 1,
        escalationAfterMins: 60,
        escalateTo: { type: ApproverSelection.PROJECT_OWNER },
      },
    ])
    const created = await createPurchaseRequest(org, project.id, draftBody(10_000))
    await submitPurchaseRequest(org, created.id)
    await decidePurchaseRequest(approver, created.id, {
      decision: 'REJECT',
      reason: 'Not needed',
    })

    const related = (await budgetEntries.findEntriesByProject(org, project.id)).filter(
      (e) => e.sourceId === created.id,
    )
    expect(related).toHaveLength(0)
  })

  it('concurrent commitments serialize via budget lock — projection matches recompute', async () => {
    const org = ctx('org_race')
    const project = await seedProjectBudget(org, 'RACE-1', 100_000)

    const a = await createPurchaseRequest(org, project.id, draftBody(40_000))
    const b = await createPurchaseRequest(ctx('org_race', 'user_2'), project.id, draftBody(40_000))

    await Promise.all([
      submitPurchaseRequest(org, a.id),
      submitPurchaseRequest(ctx('org_race', 'user_2'), b.id),
    ])

    const entries = await budgetEntries.findEntriesByProject(org, project.id)
    const commitments = entries.filter((e) => e.type === BudgetEntryType.COMMITMENT)
    expect(commitments).toHaveLength(2)

    const recomputed = projectBudget(entries)
    expect(recomputed.committed).toBe(80_000)
    expect(recomputed.remaining).toBe(20_000)

    const stored = await projects.findProjectById(org, project.id)
    expect(stored?.budgetSnapshot).toMatchObject({
      committed: 80_000,
      remaining: 20_000,
    })
  })
})
