/**
 * B7.7 — Request + policy HTTP matrix.
 * Standard 10 rows per endpoint (or N/A with comment).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as PREVIEW } from '@/app/api/policy/preview/route'
import { GET as LIST, POST as CREATE } from '@/app/api/projects/[id]/requests/route'
import { PUT as PUT_BUDGET } from '@/app/api/projects/[id]/budget/route'
import { GET as GET_ONE, PATCH } from '@/app/api/requests/[id]/route'
import { POST as SUBMIT } from '@/app/api/requests/[id]/submit/route'
import { POST as CANCEL } from '@/app/api/requests/[id]/cancel/route'
import { POST as DECIDE } from '@/app/api/requests/[id]/decide/route'
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
import { purchaseRequestContracts } from '@/shared/contracts/purchaseRequest'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ApprovalDecision } from '@/shared/enums/approvalDecision'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
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

describe('B7.7 purchase request + policy routes', () => {
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
      email: `req-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Req Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Req Project',
      code: `RQ-${Date.now().toString(16)}`,
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
  ) {
    const role = await rolesRepo.findRoleByKey(owner.ctx, roleKey)
    expect(role).not.toBeNull()
    await projectMembers.addProjectMember(owner.ctx, {
      projectId: owner.project.id,
      userId,
      roleId: role!.id,
      scope,
      effectivePermissions: role!.permissions,
      addedBy: owner.user.id,
    })
    return role!
  }

  async function createDraft(owner: Awaited<ReturnType<typeof seedOwner>>, body = draftBody) {
    const res = await CREATE(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${owner.project.id}/requests`,
        session: owner.session,
        params: { id: owner.project.id },
        body,
      }),
    )
    expect(res.status).toBe(201)
    return expectMatchesContract(res, purchaseRequestContracts.create.output)
  }

  async function createPending(owner: Awaited<ReturnType<typeof seedOwner>>) {
    await putBudget(owner)
    await seedApprovalRule(owner.ctx, owner.project.id, 1_000, 1)
    const draft = await createDraft(owner, { ...draftBody, amount: 5_000 })
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

  // ─── POST /api/policy/preview ───────────────────────────────────────────

  describe('POST /api/policy/preview', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await PREVIEW(
        buildRequest({
          method: 'POST',
          path: '/api/policy/preview',
          session: null,
          body: { projectId: 'x', amount: 1, currency: 'USD' },
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
      const res = await PREVIEW(
        buildRequest({
          method: 'POST',
          path: '/api/policy/preview',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          body: { projectId: 'x', amount: 1, currency: 'USD' },
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
      const res = await PREVIEW(
        buildRequest({
          method: 'POST',
          path: '/api/policy/preview',
          session: b.session,
          body: { projectId: a.project.id, amount: 1_000, currency: 'USD' },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when caller lacks transaction.view', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      const res = await PREVIEW(
        buildRequest({
          method: 'POST',
          path: '/api/policy/preview',
          session: member.session,
          body: { projectId: owner.project.id, amount: 1_000, currency: 'USD' },
        }),
      )
      expect(res.status).toBe(403)
      const body = await readBody<{ error: { code: string; message: string } }>(res)
      expect(body.error.code).toBe(ErrorCode.PERMISSION_DENIED)
      expect(body.error.message).toContain(Permission.TRANSACTION_VIEW)
    })

    // Matrix #5
    it('returns 403 when CARD scope excludes the subject', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'project_spender', {
        level: AccessScopeLevel.CARD,
        cardIds: ['card_other'],
      })
      const res = await PREVIEW(
        buildRequest({
          method: 'POST',
          path: '/api/policy/preview',
          session: member.session,
          body: { projectId: owner.project.id, amount: 1_000, currency: 'USD' },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #6
    it('returns 422 on invalid payload', async () => {
      const owner = await seedOwner()
      const res = await PREVIEW(
        buildRequest({
          method: 'POST',
          path: '/api/policy/preview',
          session: owner.session,
          body: { projectId: owner.project.id, amount: -1, currency: 'USD' },
        }),
      )
      expect(res.status).toBe(422)
    })

    // Matrix #7
    it('returns policy decision for owner', async () => {
      const owner = await seedOwner()
      await putBudget(owner)
      const res = await PREVIEW(
        buildRequest({
          method: 'POST',
          path: '/api/policy/preview',
          session: owner.session,
          body: { projectId: owner.project.id, amount: 500, currency: 'USD' },
        }),
      )
      expect(res.status).toBe(200)
      const decision = await expectMatchesContract(
        res,
        purchaseRequestContracts.policyPreview.output,
      )
      expect(decision.outcome).toBe(PolicyOutcome.NO_APPROVAL_REQUIRED)
    })

    // Matrix #8 — N/A (no resource id; missing project → 404 covered in #3)
    it.todo('matrix #8 N/A — preview has no resource id beyond projectId')

    // Matrix #9 — N/A (no idempotency key)
    it.todo('matrix #9 N/A — no idempotency key on preview')

    // Matrix #10 — N/A (read-only preview, no audit)
    it.todo('matrix #10 N/A — preview does not write audit')
  })

  // ─── GET /api/projects/:id/requests ─────────────────────────────────────

  describe('GET /api/projects/:id/requests', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await LIST(
        buildRequest({
          method: 'GET',
          path: '/api/projects/x/requests',
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
      const res = await LIST(
        buildRequest({
          method: 'GET',
          path: '/api/projects/x/requests',
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
      const res = await LIST(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${a.project.id}/requests`,
          session: b.session,
          params: { id: a.project.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when caller lacks transaction.view', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      const res = await LIST(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/requests`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.TRANSACTION_VIEW,
      )
    })

    // Matrix #5 — OWN scope filters list (sees own only, not 403)
    it('OWN-scoped spender sees only their own requests', async () => {
      const owner = await seedOwner()
      const spender = await addOrgMember(owner.org.id, 'Spender')
      const other = await addOrgMember(owner.org.id, 'Other')
      await assignProjectRole(owner, spender.user.id, 'project_spender', {
        level: AccessScopeLevel.OWN,
      })
      await assignProjectRole(owner, other.user.id, 'project_spender', {
        level: AccessScopeLevel.PROJECT,
      })

      const ownerDraft = await createDraft(owner)
      const otherRes = await CREATE(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${owner.project.id}/requests`,
          session: other.session,
          params: { id: owner.project.id },
          body: draftBody,
        }),
      )
      expect(otherRes.status).toBe(201)
      const otherDraft = await expectMatchesContract(
        otherRes,
        purchaseRequestContracts.create.output,
      )

      const spenderCreate = await CREATE(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${owner.project.id}/requests`,
          session: spender.session,
          params: { id: owner.project.id },
          body: draftBody,
        }),
      )
      expect(spenderCreate.status).toBe(201)
      const mine = await expectMatchesContract(
        spenderCreate,
        purchaseRequestContracts.create.output,
      )

      const listRes = await LIST(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/requests`,
          session: spender.session,
          params: { id: owner.project.id },
        }),
      )
      expect(listRes.status).toBe(200)
      const listed = await expectMatchesContract(listRes, purchaseRequestContracts.list.output)
      expect(listed.items.map((r) => r.id)).toEqual([mine.id])
      expect(listed.items.map((r) => r.id)).not.toContain(ownerDraft.id)
      expect(listed.items.map((r) => r.id)).not.toContain(otherDraft.id)
    })

    // Matrix #6 — N/A (query defaults; invalid pageSize → 422)
    it('returns 422 on invalid pageSize', async () => {
      const owner = await seedOwner()
      const res = await LIST(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/requests`,
          session: owner.session,
          params: { id: owner.project.id },
          query: { pageSize: 999 },
        }),
      )
      expect(res.status).toBe(422)
    })

    // Matrix #7
    it('lists requests for owner', async () => {
      const owner = await seedOwner()
      const created = await createDraft(owner)
      const res = await LIST(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/requests`,
          session: owner.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(200)
      const listed = await expectMatchesContract(res, purchaseRequestContracts.list.output)
      expect(listed.items.map((r) => r.id)).toContain(created.id)
      expect(listed.total).toBeGreaterThanOrEqual(1)
    })

    // Matrix #8 — missing project → 404 (via list service requireProject)
    it('returns 404 when project is missing', async () => {
      const owner = await seedOwner()
      const res = await LIST(
        buildRequest({
          method: 'GET',
          path: '/api/projects/000000000000000000000000/requests',
          session: owner.session,
          params: { id: '000000000000000000000000' },
        }),
      )
      // OWNER short-circuits permission; missing project → 404 from list helper
      expect(res.status).toBe(404)
    })

    // Matrix #9 — N/A
    it.todo('matrix #9 N/A — GET list has no idempotency key')

    // Matrix #10 — N/A
    it.todo('matrix #10 N/A — list does not write audit')
  })

  // ─── POST /api/projects/:id/requests ────────────────────────────────────

  describe('POST /api/projects/:id/requests', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await CREATE(
        buildRequest({
          method: 'POST',
          path: '/api/projects/x/requests',
          session: null,
          params: { id: 'x' },
          body: draftBody,
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
      const res = await CREATE(
        buildRequest({
          method: 'POST',
          path: '/api/projects/x/requests',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
          body: draftBody,
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
      const res = await CREATE(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${a.project.id}/requests`,
          session: b.session,
          params: { id: a.project.id },
          body: draftBody,
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when caller lacks payment.make', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'viewer')
      const res = await CREATE(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${owner.project.id}/requests`,
          session: member.session,
          params: { id: owner.project.id },
          body: draftBody,
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.PAYMENT_MAKE,
      )
    })

    // Matrix #5
    it('returns 403 when CARD scope excludes create subject', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'project_spender', {
        level: AccessScopeLevel.CARD,
        cardIds: ['card_other'],
      })
      const res = await CREATE(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${owner.project.id}/requests`,
          session: member.session,
          params: { id: owner.project.id },
          body: draftBody,
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #6
    it('returns 422 on invalid payload', async () => {
      const owner = await seedOwner()
      const res = await CREATE(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${owner.project.id}/requests`,
          session: owner.session,
          params: { id: owner.project.id },
          body: { ...draftBody, amount: -5 },
        }),
      )
      expect(res.status).toBe(422)
    })

    // Matrix #7 + #10
    it('creates DRAFT and writes exactly one audit', async () => {
      const owner = await seedOwner()
      const res = await CREATE(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${owner.project.id}/requests`,
          session: owner.session,
          params: { id: owner.project.id },
          body: draftBody,
        }),
      )
      expect(res.status).toBe(201)
      const created = await expectMatchesContract(res, purchaseRequestContracts.create.output)
      expect(created.status).toBe(PurchaseRequestStatus.DRAFT)
      expect(created.requestedBy).toBe(owner.user.id)
      expect(created.policyDecision).toBeNull()

      const audits = await AuditLogModel.find({
        orgId: owner.org.id,
        action: 'request.created',
        subjectId: created.id,
      }).exec()
      expect(audits).toHaveLength(1)
      expect(audits[0]?.actorId).toBe(owner.user.id)
    })

    // Matrix #8
    it('returns 404 when project is missing', async () => {
      const owner = await seedOwner()
      const res = await CREATE(
        buildRequest({
          method: 'POST',
          path: '/api/projects/000000000000000000000000/requests',
          session: owner.session,
          params: { id: '000000000000000000000000' },
          body: draftBody,
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #9 — N/A
    it.todo('matrix #9 N/A — create has no idempotency key')
  })

  // ─── GET /api/requests/:id ──────────────────────────────────────────────

  describe('GET /api/requests/:id', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: '/api/requests/x',
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
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: '/api/requests/x',
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
    it('returns 404 for cross-org request', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const draft = await createDraft(a)
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: `/api/requests/${draft.id}`,
          session: b.session,
          params: { id: draft.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when caller lacks transaction.view', async () => {
      const owner = await seedOwner()
      const draft = await createDraft(owner)
      const member = await addOrgMember(owner.org.id)
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: `/api/requests/${draft.id}`,
          session: member.session,
          params: { id: draft.id },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.TRANSACTION_VIEW,
      )
    })

    // Matrix #5
    it('returns 403 when OWN scope excludes another requester', async () => {
      const owner = await seedOwner()
      const draft = await createDraft(owner)
      const spender = await addOrgMember(owner.org.id, 'OwnSpender')
      await assignProjectRole(owner, spender.user.id, 'project_spender', {
        level: AccessScopeLevel.OWN,
      })
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: `/api/requests/${draft.id}`,
          session: spender.session,
          params: { id: draft.id },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #6 — N/A
    it.todo('matrix #6 N/A — GET has no payload')

    // Matrix #7
    it('returns the request for owner', async () => {
      const owner = await seedOwner()
      const draft = await createDraft(owner)
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: `/api/requests/${draft.id}`,
          session: owner.session,
          params: { id: draft.id },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, purchaseRequestContracts.get.output)
      expect(body.id).toBe(draft.id)
    })

    // Matrix #8
    it('returns 404 when request is missing', async () => {
      const owner = await seedOwner()
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: '/api/requests/000000000000000000000000',
          session: owner.session,
          params: { id: '000000000000000000000000' },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #9 — N/A
    it.todo('matrix #9 N/A — GET has no idempotency key')

    // Matrix #10 — N/A
    it.todo('matrix #10 N/A — GET does not write audit')
  })

  // ─── PATCH /api/requests/:id ────────────────────────────────────────────

  describe('PATCH /api/requests/:id', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/requests/x',
          session: null,
          params: { id: 'x' },
          body: { vendor: 'New' },
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
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/requests/x',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
          body: { vendor: 'New' },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    // Matrix #3
    it('returns 404 for cross-org request', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const draft = await createDraft(a)
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/requests/${draft.id}`,
          session: b.session,
          params: { id: draft.id },
          body: { vendor: 'Hijack' },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4 — non-requester denied (service)
    it('returns 403 when caller is not the requester', async () => {
      const owner = await seedOwner()
      const draft = await createDraft(owner)
      const other = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, other.user.id, 'project_spender')
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/requests/${draft.id}`,
          session: other.session,
          params: { id: draft.id },
          body: { vendor: 'Nope' },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #5 — N/A (requester identity, not access scope)
    it.todo('matrix #5 N/A — PATCH is requester-gated, not scope-gated')

    // Matrix #6
    it('returns 422 on invalid payload', async () => {
      const owner = await seedOwner()
      const draft = await createDraft(owner)
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/requests/${draft.id}`,
          session: owner.session,
          params: { id: draft.id },
          body: { amount: -1 },
        }),
      )
      expect(res.status).toBe(422)
    })

    // Matrix #7 + #10
    it('updates DRAFT and writes exactly one audit', async () => {
      const owner = await seedOwner()
      const draft = await createDraft(owner)
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/requests/${draft.id}`,
          session: owner.session,
          params: { id: draft.id },
          body: { vendor: 'Updated Vendor' },
        }),
      )
      expect(res.status).toBe(200)
      const updated = await expectMatchesContract(res, purchaseRequestContracts.update.output)
      expect(updated.vendor).toBe('Updated Vendor')

      const audits = await AuditLogModel.find({
        orgId: owner.org.id,
        action: 'request.updated',
        subjectId: draft.id,
      }).exec()
      expect(audits).toHaveLength(1)
    })

    // Matrix #8
    it('returns 404 when request is missing', async () => {
      const owner = await seedOwner()
      const res = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/requests/000000000000000000000000',
          session: owner.session,
          params: { id: '000000000000000000000000' },
          body: { vendor: 'X' },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #9 — N/A
    it.todo('matrix #9 N/A — PATCH has no idempotency key')
  })

  // ─── POST /api/requests/:id/submit ──────────────────────────────────────

  describe('POST /api/requests/:id/submit', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await SUBMIT(
        buildRequest({
          method: 'POST',
          path: '/api/requests/x/submit',
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
      const res = await SUBMIT(
        buildRequest({
          method: 'POST',
          path: '/api/requests/x/submit',
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
    it('returns 404 for cross-org request', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const draft = await createDraft(a)
      const res = await SUBMIT(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${draft.id}/submit`,
          session: b.session,
          params: { id: draft.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when caller is not the requester', async () => {
      const owner = await seedOwner()
      await putBudget(owner)
      const draft = await createDraft(owner)
      const other = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, other.user.id, 'project_spender')
      const res = await SUBMIT(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${draft.id}/submit`,
          session: other.session,
          params: { id: draft.id },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #5 — N/A
    it.todo('matrix #5 N/A — submit is requester-gated, not scope-gated')

    // Matrix #6 — N/A (no body); policy NOT_PERMITTED → 422
    it('returns 422 when policy denies (insufficient budget)', async () => {
      const owner = await seedOwner()
      await putBudget(owner, 1_000)
      const draft = await createDraft(owner, { ...draftBody, amount: 50_000 })
      const res = await SUBMIT(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${draft.id}/submit`,
          session: owner.session,
          params: { id: draft.id },
        }),
      )
      expect(res.status).toBe(422)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.VALIDATION_FAILED,
      )
    })

    // Matrix #7 + #10
    it('submits to APPROVED when no approval rule and audits once', async () => {
      const owner = await seedOwner()
      await putBudget(owner)
      const draft = await createDraft(owner)
      const res = await SUBMIT(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${draft.id}/submit`,
          session: owner.session,
          params: { id: draft.id },
        }),
      )
      expect(res.status).toBe(200)
      const submitted = await expectMatchesContract(res, purchaseRequestContracts.submit.output)
      expect(submitted.status).toBe(PurchaseRequestStatus.APPROVED)
      expect(submitted.policyDecision?.outcome).toBe(PolicyOutcome.NO_APPROVAL_REQUIRED)

      const audits = await AuditLogModel.find({
        orgId: owner.org.id,
        action: 'request.submitted',
        subjectId: draft.id,
      }).exec()
      expect(audits).toHaveLength(1)
    })

    // Matrix #8
    it('returns 404 when request is missing', async () => {
      const owner = await seedOwner()
      const res = await SUBMIT(
        buildRequest({
          method: 'POST',
          path: '/api/requests/000000000000000000000000/submit',
          session: owner.session,
          params: { id: '000000000000000000000000' },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #9 — N/A
    it.todo('matrix #9 N/A — submit has no idempotency key')
  })

  // ─── POST /api/requests/:id/cancel ──────────────────────────────────────

  describe('POST /api/requests/:id/cancel', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await CANCEL(
        buildRequest({
          method: 'POST',
          path: '/api/requests/x/cancel',
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
      const res = await CANCEL(
        buildRequest({
          method: 'POST',
          path: '/api/requests/x/cancel',
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
    it('returns 404 for cross-org request', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const draft = await createDraft(a)
      const res = await CANCEL(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${draft.id}/cancel`,
          session: b.session,
          params: { id: draft.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when caller is not the requester', async () => {
      const owner = await seedOwner()
      const draft = await createDraft(owner)
      const other = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, other.user.id, 'project_spender')
      const res = await CANCEL(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${draft.id}/cancel`,
          session: other.session,
          params: { id: draft.id },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #5 — N/A
    it.todo('matrix #5 N/A — cancel is requester-gated, not scope-gated')

    // Matrix #6 — N/A
    it.todo('matrix #6 N/A — cancel has no payload')

    // Matrix #7 + #10
    it('cancels DRAFT and writes exactly one audit', async () => {
      const owner = await seedOwner()
      const draft = await createDraft(owner)
      const res = await CANCEL(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${draft.id}/cancel`,
          session: owner.session,
          params: { id: draft.id },
        }),
      )
      expect(res.status).toBe(200)
      const cancelled = await expectMatchesContract(res, purchaseRequestContracts.cancel.output)
      expect(cancelled.status).toBe(PurchaseRequestStatus.CANCELLED)

      const audits = await AuditLogModel.find({
        orgId: owner.org.id,
        action: 'request.cancelled',
        subjectId: draft.id,
      }).exec()
      expect(audits).toHaveLength(1)
    })

    // Matrix #8
    it('returns 404 when request is missing', async () => {
      const owner = await seedOwner()
      const res = await CANCEL(
        buildRequest({
          method: 'POST',
          path: '/api/requests/000000000000000000000000/cancel',
          session: owner.session,
          params: { id: '000000000000000000000000' },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #9 — N/A
    it.todo('matrix #9 N/A — cancel has no idempotency key')
  })

  // ─── POST /api/requests/:id/decide ──────────────────────────────────────

  describe('POST /api/requests/:id/decide', () => {
    // Matrix #1
    it('returns 401 when unauthenticated', async () => {
      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: '/api/requests/x/decide',
          session: null,
          params: { id: 'x' },
          body: { decision: ApprovalDecision.APPROVE },
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
      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: '/api/requests/x/decide',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
          body: { decision: ApprovalDecision.APPROVE },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    // Matrix #3
    it('returns 404 for cross-org request', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const pending = await createPending(a)
      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${pending.id}/decide`,
          session: b.session,
          params: { id: pending.id },
          body: { decision: ApprovalDecision.APPROVE },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #4
    it('returns 403 when caller lacks request.approve', async () => {
      const owner = await seedOwner()
      const pending = await createPending(owner)
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'project_spender')
      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${pending.id}/decide`,
          session: member.session,
          params: { id: pending.id },
          body: { decision: ApprovalDecision.APPROVE },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.REQUEST_APPROVE,
      )
    })

    // Matrix #5
    it('returns 403 when CARD scope excludes decide subject', async () => {
      const owner = await seedOwner()
      const pending = await createPending(owner)
      const member = await addOrgMember(owner.org.id)
      // Approver role + CARD scope → scopeCoversSubject fails without cardId
      await assignProjectRole(owner, member.user.id, 'approver', {
        level: AccessScopeLevel.CARD,
        cardIds: ['card_other'],
      })
      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${pending.id}/decide`,
          session: member.session,
          params: { id: pending.id },
          body: { decision: ApprovalDecision.APPROVE },
        }),
      )
      expect(res.status).toBe(403)
    })

    // Matrix #6
    it('returns 422 on invalid decide payload', async () => {
      const owner = await seedOwner()
      const pending = await createPending(owner)
      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${pending.id}/decide`,
          session: owner.session,
          params: { id: pending.id },
          body: { decision: 'MAYBE' },
        }),
      )
      expect(res.status).toBe(422)
    })

    // Matrix #7 + #10
    it('approves PENDING and writes exactly one audit', async () => {
      const owner = await seedOwner()
      // Owner cannot decide own request — use a separate requester + owner as approver
      const requester = await addOrgMember(owner.org.id, 'Requester')
      await assignProjectRole(owner, requester.user.id, 'project_spender')
      await putBudget(owner)
      await seedApprovalRule(owner.ctx, owner.project.id, 1_000, 1)

      const createRes = await CREATE(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${owner.project.id}/requests`,
          session: requester.session,
          params: { id: owner.project.id },
          body: { ...draftBody, amount: 5_000 },
        }),
      )
      const draft = await expectMatchesContract(createRes, purchaseRequestContracts.create.output)
      const submitRes = await SUBMIT(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${draft.id}/submit`,
          session: requester.session,
          params: { id: draft.id },
        }),
      )
      const pending = await expectMatchesContract(submitRes, purchaseRequestContracts.submit.output)
      expect(pending.status).toBe(PurchaseRequestStatus.PENDING)

      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${pending.id}/decide`,
          session: owner.session,
          params: { id: pending.id },
          body: { decision: ApprovalDecision.APPROVE },
        }),
      )
      expect(res.status).toBe(200)
      const decided = await expectMatchesContract(res, purchaseRequestContracts.decide.output)
      expect(decided.status).toBe(PurchaseRequestStatus.APPROVED)

      const audits = await AuditLogModel.find({
        orgId: owner.org.id,
        action: 'request.decided',
        subjectId: pending.id,
      }).exec()
      expect(audits).toHaveLength(1)
      expect(audits[0]?.actorId).toBe(owner.user.id)
    })

    // Matrix #8
    it('returns 404 when request is missing', async () => {
      const owner = await seedOwner()
      const res = await DECIDE(
        buildRequest({
          method: 'POST',
          path: '/api/requests/000000000000000000000000/decide',
          session: owner.session,
          params: { id: '000000000000000000000000' },
          body: { decision: ApprovalDecision.APPROVE },
        }),
      )
      expect(res.status).toBe(404)
    })

    // Matrix #9 — N/A (no idempotency key); already-decided → 409
    it('returns 409 when deciding an already-decided request', async () => {
      const owner = await seedOwner()
      const requester = await addOrgMember(owner.org.id, 'Req2')
      await assignProjectRole(owner, requester.user.id, 'project_spender')
      await putBudget(owner)
      await seedApprovalRule(owner.ctx, owner.project.id, 1_000, 1)

      const createRes = await CREATE(
        buildRequest({
          method: 'POST',
          path: `/api/projects/${owner.project.id}/requests`,
          session: requester.session,
          params: { id: owner.project.id },
          body: { ...draftBody, amount: 5_000 },
        }),
      )
      const draft = await expectMatchesContract(createRes, purchaseRequestContracts.create.output)
      await SUBMIT(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${draft.id}/submit`,
          session: requester.session,
          params: { id: draft.id },
        }),
      )

      await DECIDE(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${draft.id}/decide`,
          session: owner.session,
          params: { id: draft.id },
          body: { decision: ApprovalDecision.APPROVE },
        }),
      )
      const again = await DECIDE(
        buildRequest({
          method: 'POST',
          path: `/api/requests/${draft.id}/decide`,
          session: owner.session,
          params: { id: draft.id },
          body: { decision: ApprovalDecision.REJECT, reason: 'late' },
        }),
      )
      expect(again.status).toBe(409)
    })
  })
})
