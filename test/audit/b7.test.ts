/**
 * B7.10 — one audit assertion per mutating purchase-request / approval-rules path.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PUT as PUT_RULES } from '@/app/api/projects/[id]/approval-rules/route'
import { POST as CREATE } from '@/app/api/projects/[id]/requests/route'
import { PATCH } from '@/app/api/requests/[id]/route'
import { POST as CANCEL } from '@/app/api/requests/[id]/cancel/route'
import { POST as DECIDE } from '@/app/api/requests/[id]/decide/route'
import { POST as SUBMIT } from '@/app/api/requests/[id]/submit/route'
import { resetEventPublisher } from '@/server/events/bus'
import type { OrgContext } from '@/server/http/types'
import { ApprovalRuleModel } from '@/server/models/ApprovalRule'
import { AuditLogModel } from '@/server/models/AuditLog'
import { BudgetModel } from '@/server/models/Budget'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { PurchaseRequestModel } from '@/server/models/PurchaseRequest'
import { UserModel } from '@/server/models/User'
import { resetRedis } from '@/server/redis'
import * as approvalRules from '@/server/repositories/approvalRules'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import { escalateApprovals } from '@/server/services/approvals/escalate'
import { ApprovalDecision } from '@/shared/enums/approvalDecision'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { OrgRole } from '@/shared/enums/orgRole'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver } from '../helpers/request'

const draftBody = {
  amount: 25_000,
  currency: 'USD',
  vendor: 'Acme Supplies',
  description: 'Office supplies',
  justification: 'Needed for launch',
}

const ruleBody = {
  threshold: 1_000,
  approverSelection: { type: ApproverSelection.PROJECT_OWNER },
  requiredCount: 1,
  escalationAfterMins: 240,
  escalateTo: { type: ApproverSelection.ROLE, roleKey: 'approver' },
}

describe('audit/b7', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      BudgetModel.syncIndexes(),
      BudgetEntryModel.syncIndexes(),
      PurchaseRequestModel.syncIndexes(),
      ApprovalRuleModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetEventPublisher()
    resetRedis()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    resetEventPublisher()
    resetRedis()
    vi.restoreAllMocks()
  })

  async function seedOwner() {
    const user = await users.createUser({
      email: `a7-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Audit B7',
      slug: `a7-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    const project = await projectsRepo.createProject(ctx, {
      name: 'Audit Project',
      code: `A7-${Date.now().toString(16)}`,
    })
    return {
      user,
      org,
      ctx,
      project,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  async function addApprover(orgId: string) {
    const user = await users.createUser({
      email: `appr-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Approver',
    })
    const ctx: OrgContext = { orgId, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    return {
      user,
      ctx,
      session: {
        userId: user.id,
        orgId,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  it('audits create, update, submit, cancel', async () => {
    const owner = await seedOwner()
    await approvalRules.replaceProjectRules(owner.ctx, owner.project.id, [ruleBody])

    const createdRes = await CREATE(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/requests`,
        session: owner.session,
        params: { id: owner.project.id },
        body: draftBody,
      }),
    )
    expect(createdRes.status).toBe(201)
    const created = (await createdRes.json()) as { id: string }
    expect(
      await AuditLogModel.countDocuments({ orgId: owner.org.id, action: 'request.created' }),
    ).toBe(1)

    const patchRes = await PATCH(
      buildRequest({
        method: 'PATCH',
        path: `/api/requests/${created.id}`,
        session: owner.session,
        params: { id: created.id },
        body: { vendor: 'Beta Co' },
      }),
    )
    expect(patchRes.status).toBe(200)
    expect(
      await AuditLogModel.countDocuments({ orgId: owner.org.id, action: 'request.updated' }),
    ).toBe(1)

    const submitRes = await SUBMIT(
      buildRequest({
        method: 'POST',
        path: `/api/requests/${created.id}/submit`,
        session: owner.session,
        params: { id: created.id },
      }),
    )
    expect(submitRes.status).toBe(200)
    expect(
      await AuditLogModel.countDocuments({ orgId: owner.org.id, action: 'request.submitted' }),
    ).toBe(1)

    // Separate draft for cancel (submitted request may be PENDING).
    const draftRes = await CREATE(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/requests`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { ...draftBody, amount: 1_000, vendor: 'Cancel Me' },
      }),
    )
    const draft = (await draftRes.json()) as { id: string }
    const cancelRes = await CANCEL(
      buildRequest({
        method: 'POST',
        path: `/api/requests/${draft.id}/cancel`,
        session: owner.session,
        params: { id: draft.id },
      }),
    )
    expect(cancelRes.status).toBe(200)
    expect(
      await AuditLogModel.countDocuments({ orgId: owner.org.id, action: 'request.cancelled' }),
    ).toBe(1)
  })

  it('audits decide and put approval-rules', async () => {
    const owner = await seedOwner()
    const approver = await addApprover(owner.org.id)
    await approvalRules.replaceProjectRules(owner.ctx, owner.project.id, [ruleBody])

    const createdRes = await CREATE(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/requests`,
        session: owner.session,
        params: { id: owner.project.id },
        body: draftBody,
      }),
    )
    const created = (await createdRes.json()) as { id: string }
    await SUBMIT(
      buildRequest({
        method: 'POST',
        path: `/api/requests/${created.id}/submit`,
        session: owner.session,
        params: { id: created.id },
      }),
    )

    const decideRes = await DECIDE(
      buildRequest({
        method: 'POST',
        path: `/api/requests/${created.id}/decide`,
        session: approver.session,
        params: { id: created.id },
        body: { decision: ApprovalDecision.APPROVE },
      }),
    )
    expect(decideRes.status).toBe(200)
    expect(
      await AuditLogModel.countDocuments({ orgId: owner.org.id, action: 'request.decided' }),
    ).toBe(1)

    const putRes = await PUT_RULES(
      buildRequest({
        method: 'PUT',
        path: `/api/projects/${owner.project.id}/approval-rules`,
        session: owner.session,
        params: { id: owner.project.id },
        body: [{ ...ruleBody, threshold: 5_000 }],
      }),
    )
    expect(putRes.status).toBe(200)
    expect(
      await AuditLogModel.countDocuments({
        orgId: owner.org.id,
        action: 'approval_rule.replaced',
      }),
    ).toBe(1)
  })

  it('audits escalate from the worker sweep', async () => {
    const owner = await seedOwner()
    await approvalRules.replaceProjectRules(owner.ctx, owner.project.id, [
      { ...ruleBody, threshold: 1, escalationAfterMins: 60 },
    ])

    const createdRes = await CREATE(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/requests`,
        session: owner.session,
        params: { id: owner.project.id },
        body: draftBody,
      }),
    )
    const created = (await createdRes.json()) as { id: string }
    const submitRes = await SUBMIT(
      buildRequest({
        method: 'POST',
        path: `/api/requests/${created.id}/submit`,
        session: owner.session,
        params: { id: created.id },
      }),
    )
    expect(submitRes.status).toBe(200)
    const submitted = (await submitRes.json()) as { status: string }
    expect(submitted.status).toBe(PurchaseRequestStatus.PENDING)

    const past = new Date(Date.now() - 2 * 60 * 60_000)
    await PurchaseRequestModel.updateOne(
      { _id: created.id, orgId: owner.org.id },
      { $set: { updatedAt: past } },
      { timestamps: false },
    )

    const result = await escalateApprovals(new Date())
    expect(result.escalated).toBe(1)
    expect(
      await AuditLogModel.countDocuments({ orgId: owner.org.id, action: 'request.escalated' }),
    ).toBe(1)
  })
})
