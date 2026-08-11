/**
 * B7.8 — Approvals queue + approval-rules HTTP matrix.
 * Standard 10 rows per endpoint (or N/A with comment).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as LIST_APPROVALS } from '@/app/api/approvals/route'
import { GET as COUNT_APPROVALS } from '@/app/api/approvals/count/route'
import { GET as LIST_RULES, PUT as PUT_RULES } from '@/app/api/projects/[id]/approval-rules/route'
import { PUT as PUT_BUDGET } from '@/app/api/projects/[id]/budget/route'
import { POST as CREATE } from '@/app/api/projects/[id]/requests/route'
import { POST as SUBMIT } from '@/app/api/requests/[id]/submit/route'
import { resetEventPublisher } from '@/server/events/bus'
import type { OrgContext } from '@/server/http/types'
import { ApprovalRuleModel } from '@/server/models/ApprovalRule'
import { AuditLogModel } from '@/server/models/AuditLog'
import { BudgetModel } from '@/server/models/Budget'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { ProjectModel } from '@/server/models/Project'
import { PurchaseRequestModel } from '@/server/models/PurchaseRequest'
import { RoleModel } from '@/server/models/Role'
import { UserModel } from '@/server/models/User'
import * as approvalRules from '@/server/repositories/approvalRules'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectMembers from '@/server/repositories/projectMembers'
import * as projectsRepo from '@/server/repositories/projects'
import * as rolesRepo from '@/server/repositories/roles'
import * as users from '@/server/repositories/users'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { resetRedis } from '@/server/redis'
import { approvalRuleContracts } from '@/shared/contracts/approvalRule'
import { purchaseRequestContracts } from '@/shared/contracts/purchaseRequest'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

const draftBody = {
  amount: 5_000,
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

describe('B7.8 approvals queue + approval-rules routes', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      RoleModel.syncIndexes(),
      ProjectMemberModel.syncIndexes(),
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
      email: `appr-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Appr Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Appr Project',
      code: `AP-${Date.now().toString(16)}`,
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

  async function putBudget(owner: Awaited<ReturnType<typeof seedOwner>>, amount = 100_000) {
    const res = await PUT_BUDGET(
      buildRequest({
        method: 'PUT',
        path: `/api/projects/${owner.project.id}/budget`,
        session: owner.session,
        params: { id: owner.project.id },
        body: { currency: 'USD', approvedAmount: amount },
      }),
    )
    expect(res.status).toBe(200)
  }

  async function seedApprovalRule(
    ctx: OrgContext,
    projectId: string,
    threshold = 1_000,
    requiredCount = 1,
  ) {
    await approvalRules.replaceProjectRules(ctx, projectId, [
      {
        threshold,
        approverSelection: { type: ApproverSelection.PROJECT_OWNER },
        requiredCount,
        escalationAfterMins: 240,
        escalateTo: { type: ApproverSelection.ROLE, roleKey: 'approver' },
      },
    ])
  }

  async function addOrgMember(orgId: string, name = 'Member') {
    const user = await users.createUser({
      email: `m-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name,
    })
    await memberships.createMembership(
      { orgId, userId: user.id, orgRole: OrgRole.MEMBER },
      { userId: user.id, orgRole: OrgRole.MEMBER },
    )
    return {
      user,
      session: {
        userId: user.id,
        orgId,
        orgRole: OrgRole.MEMBER,
        onboarded: true as const,
      },
    }
  }

  async function assignProjectRole(
    owner: Awaited<ReturnType<typeof seedOwner>>,
    userId: string,
    roleKey: string,
    scope: { level: AccessScopeLevel; cardIds?: string[] } = {
      level: AccessScopeLevel.PROJECT,
    },
    projectId = owner.project.id,
  ) {
    const role = await rolesRepo.findRoleByKey(owner.ctx, roleKey)
    expect(role).not.toBeNull()
    await projectMembers.addProjectMember(owner.ctx, {
      projectId,
      userId,
      roleId: role!.id,
      scope,
      effectivePermissions: role!.permissions,
      addedBy: owner.user.id,
    })
    return role!
  }

  async function createDraft(
    owner: Awaited<ReturnType<typeof seedOwner>>,
    body = draftBody,
    projectId = owner.project.id,
  ) {
    const res = await CREATE(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${projectId}/requests`,
        session: owner.session,
        params: { id: projectId },
        body,
      }),
    )
    expect(res.status).toBe(201)
    return expectMatchesContract(res, purchaseRequestContracts.create.output)
  }

  async function createPending(
    owner: Awaited<ReturnType<typeof seedOwner>>,
    projectId = owner.project.id,
  ) {
    await putBudget(owner)
    await seedApprovalRule(owner.ctx, projectId, 1_000, 1)
    const draft = await createDraft(owner, { ...draftBody, amount: 5_000 }, projectId)
    const submitRes = await SUBMIT(
      buildRequest({
        method: 'POST',
        path: `/api/requests/${draft.id}/submit`,
        session: owner.session,
        params: { id: draft.id },
      }),
    )
    expect(submitRes.status).toBe(200)
    const pending = await expectMatchesContract(submitRes, purchaseRequestContracts.submit.output)
    expect(pending.status).toBe(PurchaseRequestStatus.PENDING)
    return pending
  }

  // ─── GET /api/approvals ─────────────────────────────────────────────────

  describe('GET /api/approvals', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await LIST_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals', session: null }),
      )
      expect(res.status).toBe(401)
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await users.createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await LIST_APPROVALS(
        buildRequest({
          method: 'GET',
          path: '/api/approvals',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    // Matrix #3 — org-scoped list; other org sees empty, never foreign items
    it('does not leak PENDING from another org', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      await createPending(a)
      const res = await LIST_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals', session: b.session }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, purchaseRequestContracts.listApprovals.output)
      expect(body.total).toBe(0)
      expect(body.items).toHaveLength(0)
    })

    // Matrix #4
    it('returns 403 when MEMBER lacks request.approve', async () => {
      const owner = await seedOwner()
      await createPending(owner)
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'project_spender')
      const res = await LIST_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals', session: member.session }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.REQUEST_APPROVE,
      )
    })

    // Matrix #5 — CARD scope does not grant queue via projectIdsGrantingPermission
    it('returns 403 when CARD scope excludes approver queue', async () => {
      const owner = await seedOwner()
      await createPending(owner)
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'approver', {
        level: AccessScopeLevel.CARD,
        cardIds: ['card_other'],
      })
      const res = await LIST_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals', session: member.session }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #6
    it('returns 422 on invalid pageSize', async () => {
      const owner = await seedOwner()
      const res = await LIST_APPROVALS(
        buildRequest({
          method: 'GET',
          path: '/api/approvals',
          session: owner.session,
          query: { pageSize: 999 },
        }),
      )
      expect(res.status).toBe(422)
    })

    // Matrix #7
    it('lists PENDING excluding caller own requests for OWNER', async () => {
      const owner = await seedOwner()
      const pending = await createPending(owner)
      // Owner is the requester — excluded from their own queue
      const ownerRes = await LIST_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals', session: owner.session }),
      )
      expect(ownerRes.status).toBe(200)
      const ownerBody = await expectMatchesContract(
        ownerRes,
        purchaseRequestContracts.listApprovals.output,
      )
      expect(ownerBody.total).toBe(0)

      const approver = await addOrgMember(owner.org.id, 'Approver')
      await assignProjectRole(owner, approver.user.id, 'approver')
      const res = await LIST_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals', session: approver.session }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, purchaseRequestContracts.listApprovals.output)
      expect(body.total).toBe(1)
      expect(body.items[0]?.id).toBe(pending.id)
      expect(body.items[0]?.status).toBe(PurchaseRequestStatus.PENDING)
    })

    it('filters MEMBER queue to projects granting request.approve', async () => {
      const owner = await seedOwner()
      const project2 = await projectsRepo.createProject(owner.ctx, {
        name: 'Other Project',
        code: `AP2-${Date.now().toString(16)}`,
      })
      await putBudget(owner)
      await seedApprovalRule(owner.ctx, owner.project.id, 1_000, 1)
      await seedApprovalRule(owner.ctx, project2.id, 1_000, 1)

      // Budget for project2
      const budgetRes = await PUT_BUDGET(
        buildRequest({
          method: 'PUT',
          path: `/api/projects/${project2.id}/budget`,
          session: owner.session,
          params: { id: project2.id },
          body: { currency: 'USD', approvedAmount: 100_000 },
        }),
      )
      expect(budgetRes.status).toBe(200)

      const pending1 = await createDraft(owner, { ...draftBody, amount: 5_000 }, owner.project.id)
      const submit1 = await SUBMIT(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${pending1.id}/submit`,
          session: owner.session,
          params: { id: pending1.id },
        }),
      )
      expect(submit1.status).toBe(200)

      const pending2 = await createDraft(owner, { ...draftBody, amount: 5_000 }, project2.id)
      const submit2 = await SUBMIT(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${pending2.id}/submit`,
          session: owner.session,
          params: { id: pending2.id },
        }),
      )
      expect(submit2.status).toBe(200)

      const approver = await addOrgMember(owner.org.id, 'Scoped Approver')
      await assignProjectRole(owner, approver.user.id, 'approver', undefined, owner.project.id)

      const res = await LIST_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals', session: approver.session }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, purchaseRequestContracts.listApprovals.output)
      expect(body.total).toBe(1)
      expect(body.items[0]?.projectId).toBe(owner.project.id)
    })

    // Matrix #8 — N/A (org-scoped list, no resource id)
    it.todo('matrix #8 N/A — approvals list has no resource id')

    // Matrix #9 — N/A
    it.todo('matrix #9 N/A — GET list has no idempotency key')

    // Matrix #10 — N/A
    it.todo('matrix #10 N/A — list does not write audit')
  })

  // ─── GET /api/approvals/count ───────────────────────────────────────────

  describe('GET /api/approvals/count', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await COUNT_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals/count', session: null }),
      )
      expect(res.status).toBe(401)
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await users.createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await COUNT_APPROVALS(
        buildRequest({
          method: 'GET',
          path: '/api/approvals/count',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    // Matrix #3
    it('returns zero for another org', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      await createPending(a)
      const res = await COUNT_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals/count', session: b.session }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, purchaseRequestContracts.approvalsCount.output)
      expect(body.count).toBe(0)
    })

    // Matrix #4
    it('returns 403 when MEMBER lacks request.approve', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'viewer')
      const res = await COUNT_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals/count', session: member.session }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.REQUEST_APPROVE,
      )
    })

    // Matrix #5
    it('returns 403 when CARD scope excludes count', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'approver', {
        level: AccessScopeLevel.CARD,
        cardIds: ['card_x'],
      })
      const res = await COUNT_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals/count', session: member.session }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #6 — N/A
    it.todo('matrix #6 N/A — count has no payload')

    // Matrix #7
    it('returns badge count matching filtered queue', async () => {
      const owner = await seedOwner()
      await createPending(owner)
      const approver = await addOrgMember(owner.org.id, 'Approver')
      await assignProjectRole(owner, approver.user.id, 'approver')

      const res = await COUNT_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals/count', session: approver.session }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, purchaseRequestContracts.approvalsCount.output)
      expect(body.count).toBe(1)

      // Requester (owner) excluded
      const ownRes = await COUNT_APPROVALS(
        buildRequest({ method: 'GET', path: '/api/approvals/count', session: owner.session }),
      )
      expect(ownRes.status).toBe(200)
      const ownBody = await expectMatchesContract(
        ownRes,
        purchaseRequestContracts.approvalsCount.output,
      )
      expect(ownBody.count).toBe(0)
    })

    // Matrix #8 — N/A
    it.todo('matrix #8 N/A — count has no resource id')

    // Matrix #9 — N/A
    it.todo('matrix #9 N/A — GET count has no idempotency key')

    // Matrix #10 — N/A
    it.todo('matrix #10 N/A — count does not write audit')
  })

  // ─── GET /api/projects/:id/approval-rules ───────────────────────────────

  describe('GET /api/projects/:id/approval-rules', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await LIST_RULES(
        buildRequest({
          method: 'GET',
          path: '/api/projects/x/approval-rules',
          session: null,
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(401)
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await users.createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await LIST_RULES(
        buildRequest({
          method: 'GET',
          path: '/api/projects/x/approval-rules',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    // Matrix #3
    it('returns 404 for cross-org project', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      await seedApprovalRule(a.ctx, a.project.id)
      const res = await LIST_RULES(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${a.project.id}/approval-rules`,
          session: b.session,
          params: { id: a.project.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when MEMBER lacks control.edit', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'approver')
      const res = await LIST_RULES(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/approval-rules`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.CONTROL_EDIT,
      )
    })

    // Matrix #5 — N/A (CONTROL_EDIT org-wide via membership; projectId still passed)
    it.todo('matrix #5 N/A — control.edit is not narrowed by access scope for this surface')

    // Matrix #6 — N/A
    it.todo('matrix #6 N/A — GET has no payload')

    // Matrix #7
    it('lists project approval rules', async () => {
      const owner = await seedOwner()
      await seedApprovalRule(owner.ctx, owner.project.id, 2_500, 2)
      const res = await LIST_RULES(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/approval-rules`,
          session: owner.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, approvalRuleContracts.list.output)
      expect(body).toHaveLength(1)
      expect(body[0]?.threshold).toBe(2_500)
      expect(body[0]?.requiredCount).toBe(2)
      expect(body[0]?.projectId).toBe(owner.project.id)
    })

    // Matrix #8
    it('returns 404 when project is missing', async () => {
      const owner = await seedOwner()
      const res = await LIST_RULES(
        buildRequest({
          method: 'GET',
          path: '/api/projects/000000000000000000000000/approval-rules',
          session: owner.session,
          params: { id: '000000000000000000000000' },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #9 — N/A
    it.todo('matrix #9 N/A — GET has no idempotency key')

    // Matrix #10 — N/A
    it.todo('matrix #10 N/A — list does not write audit')
  })

  // ─── PUT /api/projects/:id/approval-rules ───────────────────────────────

  describe('PUT /api/projects/:id/approval-rules', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await PUT_RULES(
        buildRequest({
          method: 'PUT',
          path: '/api/projects/x/approval-rules',
          session: null,
          params: { id: 'x' },
          body: [ruleBody],
        }),
      )
      expect(res.status).toBe(401)
    })

    // Matrix #2
    it('returns 403 when onboarding is incomplete', async () => {
      const user = await users.createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await PUT_RULES(
        buildRequest({
          method: 'PUT',
          path: '/api/projects/x/approval-rules',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
          body: [ruleBody],
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    // Matrix #3
    it('returns 404 for cross-org project', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const res = await PUT_RULES(
        buildRequest({
          method: 'PUT',
          path: `/api/projects/${a.project.id}/approval-rules`,
          session: b.session,
          params: { id: a.project.id },
          body: [ruleBody],
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when MEMBER lacks control.edit', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'viewer')
      const res = await PUT_RULES(
        buildRequest({
          method: 'PUT',
          path: `/api/projects/${owner.project.id}/approval-rules`,
          session: member.session,
          params: { id: owner.project.id },
          body: [ruleBody],
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.CONTROL_EDIT,
      )
    })

    // Matrix #5 — N/A
    it.todo('matrix #5 N/A — control.edit is not narrowed by access scope for this surface')

    // Matrix #6
    it('returns 422 on invalid rule payload', async () => {
      const owner = await seedOwner()
      const res = await PUT_RULES(
        buildRequest({
          method: 'PUT',
          path: `/api/projects/${owner.project.id}/approval-rules`,
          session: owner.session,
          params: { id: owner.project.id },
          body: [{ ...ruleBody, threshold: -1 }],
        }),
      )
      expect(res.status).toBe(422)
    })

    // Matrix #7 + #10
    it('replaces project rules and writes exactly one audit', async () => {
      const owner = await seedOwner()
      await seedApprovalRule(owner.ctx, owner.project.id, 500, 1)

      const res = await PUT_RULES(
        buildRequest({
          method: 'PUT',
          path: `/api/projects/${owner.project.id}/approval-rules`,
          session: owner.session,
          params: { id: owner.project.id },
          body: [
            { ...ruleBody, threshold: 1_000, requiredCount: 1 },
            { ...ruleBody, threshold: 10_000, requiredCount: 2 },
          ],
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, approvalRuleContracts.put.output)
      expect(body).toHaveLength(2)
      expect(body.map((r) => r.threshold)).toEqual([1_000, 10_000])

      const audits = await AuditLogModel.find({
        orgId: owner.org.id,
        action: 'approval_rule.replaced',
        subjectId: owner.project.id,
      }).exec()
      expect(audits).toHaveLength(1)
      expect(audits[0]?.actorId).toBe(owner.user.id)
    })

    it('allows empty replace (clear project rules)', async () => {
      const owner = await seedOwner()
      await seedApprovalRule(owner.ctx, owner.project.id)
      const res = await PUT_RULES(
        buildRequest({
          method: 'PUT',
          path: `/api/projects/${owner.project.id}/approval-rules`,
          session: owner.session,
          params: { id: owner.project.id },
          body: [],
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, approvalRuleContracts.put.output)
      expect(body).toHaveLength(0)
    })

    it('allows project_manager MEMBER with control.edit', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'project_manager')
      const res = await PUT_RULES(
        buildRequest({
          method: 'PUT',
          path: `/api/projects/${owner.project.id}/approval-rules`,
          session: member.session,
          params: { id: owner.project.id },
          body: [ruleBody],
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, approvalRuleContracts.put.output)
      expect(body).toHaveLength(1)
    })

    // Matrix #8
    it('returns 404 when project is missing', async () => {
      const owner = await seedOwner()
      const res = await PUT_RULES(
        buildRequest({
          method: 'PUT',
          path: '/api/projects/000000000000000000000000/approval-rules',
          session: owner.session,
          params: { id: '000000000000000000000000' },
          body: [ruleBody],
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #9 — N/A
    it.todo('matrix #9 N/A — PUT has no idempotency key')
  })
})
