/**
 * B9.1 — Unified activity feed.
 * Merge order, cursor stability, OWN filter, matrix rows that apply.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as LIST_ORG } from '@/app/api/activity/route'
import { GET as LIST_PROJECT } from '@/app/api/projects/[id]/activity/route'
import { resetEventPublisher } from '@/server/events/bus'
import type { OrgContext } from '@/server/http/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { PurchaseRequestModel } from '@/server/models/PurchaseRequest'
import { RoleModel } from '@/server/models/Role'
import { RuleRunModel } from '@/server/models/RuleRun'
import { TransactionModel } from '@/server/models/Transaction'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectMembers from '@/server/repositories/projectMembers'
import * as projectsRepo from '@/server/repositories/projects'
import * as purchaseRequests from '@/server/repositories/purchaseRequests'
import * as rolesRepo from '@/server/repositories/roles'
import * as ruleRuns from '@/server/repositories/ruleRuns'
import * as transactionsRepo from '@/server/repositories/transactions'
import { decodeActivityCursor, encodeActivityCursor } from '@/server/services/activity/feed'
import { audit } from '@/server/services/audit/log'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { resetRedis } from '@/server/redis'
import { activityContracts } from '@/shared/contracts/activity'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ActivityItemType } from '@/shared/enums/activityItemType'
import { ActorType } from '@/shared/enums/audit'
import { ApprovalDecision } from '@/shared/enums/approvalDecision'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('B9.1 activity feed', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      RoleModel.syncIndexes(),
      ProjectMemberModel.syncIndexes(),
      TransactionModel.syncIndexes(),
      PurchaseRequestModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
      RuleRunModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    installTestSessionResolver()
    resetEventPublisher()
    resetRedis()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    resetEventPublisher()
    resetRedis()
    vi.restoreAllMocks()
  })

  async function seedOwner() {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `act-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Activity Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Activity Project',
      code: `ACT-${Date.now().toString(16)}`,
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

  async function addOrgMember(orgId: string, name = 'Member') {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
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
    scope: { level: AccessScopeLevel; cardIds?: string[]; workstreamIds?: string[] } = {
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

  async function seedTx(ctx: OrgContext, projectId: string, at: string, suffix: string) {
    return transactionsRepo.createTransaction(ctx, {
      cardId: '507f1f77bcf86cd799439011',
      projectId,
      airwallexTransactionId: `awx-${suffix}`,
      cardTransactionId: `ct-${suffix}`,
      lifecycleId: `life-${suffix}`,
      type: TransactionType.AUTHORIZATION,
      status: TransactionStatus.AUTHORIZED,
      amount: 1000,
      currency: 'USD',
      billingAmount: 1000,
      billingCurrency: 'USD',
      merchant: { name: 'Store', mcc: '5411', country: 'US' },
      transactedAt: new Date(at),
    })
  }

  describe('cursor helpers', () => {
    it('round-trips opaque { at, id }', () => {
      const encoded = encodeActivityCursor('2026-01-01T00:00:00.000Z', 'abc')
      expect(decodeActivityCursor(encoded)).toEqual({
        at: '2026-01-01T00:00:00.000Z',
        id: 'abc',
      })
    })
  })

  describe('GET /api/projects/:id/activity', () => {
    it('#1 unauthenticated → 401', async () => {
      const owner = await seedOwner()
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/activity`,
          session: null,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('#2 no organisation → 403 ONBOARDING_INCOMPLETE', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `solo-${Date.now()}@example.com`,
        name: 'Solo',
      })
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: '/api/projects/507f1f77bcf86cd799439011/activity',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: '507f1f77bcf86cd799439011' },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    it('#3 cross-org project → 404', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${b.project.id}/activity`,
          session: a.session,
          params: { id: b.project.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('#4 lacks permission → 403', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/activity`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.PERMISSION_DENIED,
      )
    })

    it('#5 OWN scope filters to own items (not 403)', async () => {
      const owner = await seedOwner()
      const spender = await addOrgMember(owner.org.id, 'Spender')
      await assignProjectRole(owner, spender.user.id, 'project_spender', {
        level: AccessScopeLevel.OWN,
      })

      const ownReq = await purchaseRequests.createPurchaseRequest(owner.ctx, {
        projectId: owner.project.id,
        requestedBy: spender.user.id,
        amount: 500,
        currency: 'USD',
        vendor: 'Own Vendor',
        description: 'desc',
        justification: 'why',
      })
      await purchaseRequests.createPurchaseRequest(owner.ctx, {
        projectId: owner.project.id,
        requestedBy: owner.user.id,
        amount: 900,
        currency: 'USD',
        vendor: 'Other Vendor',
        description: 'desc',
        justification: 'why',
      })

      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/activity`,
          session: spender.session,
          params: { id: owner.project.id },
          query: { type: 'PURCHASE_REQUEST' },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, activityContracts.listForProject.output)
      expect(body.items.every((i) => i.id === ownReq.id)).toBe(true)
    })

    it('#6 invalid cursor → 422', async () => {
      const owner = await seedOwner()
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/activity`,
          session: owner.session,
          params: { id: owner.project.id },
          query: { cursor: 'not-valid-cursor!!!' },
        }),
      )
      expect(res.status).toBe(422)
    })

    it('#7 happy path — merge order by at desc then id desc', async () => {
      const owner = await seedOwner()
      const t1 = await seedTx(owner.ctx, owner.project.id, '2026-01-01T10:00:00.000Z', 'a')
      const t2 = await seedTx(owner.ctx, owner.project.id, '2026-01-01T12:00:00.000Z', 'b')
      await audit(owner.ctx, {
        action: 'card.status_changed',
        subjectType: 'card',
        subjectId: '507f1f77bcf86cd799439011',
        projectId: owner.project.id,
        at: new Date('2026-01-01T11:00:00.000Z'),
      })

      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/activity`,
          session: owner.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, activityContracts.listForProject.output)
      expect(body.items.length).toBeGreaterThanOrEqual(3)
      expect(body.items[0]!.id).toBe(t2.id)
      expect(body.items[0]!.type).toBe(ActivityItemType.TRANSACTION)
      expect(body.items[1]!.type).toBe(ActivityItemType.CARD)
      expect(body.items[2]!.id).toBe(t1.id)
    })

    it('#8 unknown project → 404', async () => {
      const owner = await seedOwner()
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: '/api/projects/507f1f77bcf86cd799439099/activity',
          session: owner.session,
          params: { id: '507f1f77bcf86cd799439099' },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('#9 N/A — GET has no idempotency key', () => {
      expect(true).toBe(true)
    })

    it('#10 N/A — GET does not write audit', () => {
      expect(true).toBe(true)
    })

    it('cursor is stable when a newer item arrives at the head', async () => {
      const owner = await seedOwner()
      const older = await seedTx(owner.ctx, owner.project.id, '2026-01-01T09:00:00.000Z', 'old')
      const mid = await seedTx(owner.ctx, owner.project.id, '2026-01-01T10:00:00.000Z', 'mid')
      const newest = await seedTx(owner.ctx, owner.project.id, '2026-01-01T11:00:00.000Z', 'new')

      const first = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/activity`,
          session: owner.session,
          params: { id: owner.project.id },
          query: { limit: 2, type: 'TRANSACTION' },
        }),
      )
      const firstBody = await expectMatchesContract(first, activityContracts.listForProject.output)
      expect(firstBody.items.map((i) => i.id)).toEqual([newest.id, mid.id])
      expect(firstBody.nextCursor).toBeTruthy()

      await seedTx(owner.ctx, owner.project.id, '2026-01-01T12:00:00.000Z', 'head')

      const second = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/activity`,
          session: owner.session,
          params: { id: owner.project.id },
          query: { limit: 2, type: 'TRANSACTION', cursor: firstBody.nextCursor! },
        }),
      )
      const secondBody = await expectMatchesContract(
        second,
        activityContracts.listForProject.output,
      )
      expect(secondBody.items.map((i) => i.id)).toEqual([older.id])
      expect(secondBody.items.some((i) => i.id === mid.id)).toBe(false)
      expect(secondBody.items.some((i) => i.id === newest.id)).toBe(false)
    })

    it('includes approvals and rule runs', async () => {
      const owner = await seedOwner()
      const req = await purchaseRequests.createPurchaseRequest(owner.ctx, {
        projectId: owner.project.id,
        requestedBy: owner.user.id,
        amount: 100,
        currency: 'USD',
        vendor: 'Acme',
        description: 'd',
        justification: 'j',
      })
      await PurchaseRequestModel.updateOne(
        { _id: req.id, orgId: owner.org.id },
        {
          $set: {
            status: PurchaseRequestStatus.APPROVED,
            policyDecision: {
              outcome: PolicyOutcome.APPROVAL_REQUIRED,
              reasons: [],
              requiredApprovals: 1,
            },
            approvals: [
              {
                approverId: owner.user.id,
                decision: ApprovalDecision.APPROVE,
                reason: null,
                at: new Date('2026-02-01T00:00:00.000Z'),
              },
            ],
          },
        },
      )
      await ruleRuns.createRuleRun(owner.ctx, {
        ruleId: '507f1f77bcf86cd799439011',
        triggeredBy: owner.user.id,
        triggeredByType: ActorType.USER,
        triggerEvent: 'manual',
        inputs: [],
        matched: true,
        desiredState: { cards: [] },
        diff: { cards: [] },
        actions: [],
        conflicts: [],
        status: RuleRunStatus.SUCCESS,
        durationMs: 1,
        startedAt: '2026-02-02T00:00:00.000Z',
        finishedAt: '2026-02-02T00:00:01.000Z',
        projectId: owner.project.id,
      })

      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/activity`,
          session: owner.session,
          params: { id: owner.project.id },
        }),
      )
      const body = await expectMatchesContract(res, activityContracts.listForProject.output)
      const types = new Set(body.items.map((i) => i.type))
      expect(types.has(ActivityItemType.APPROVAL)).toBe(true)
      expect(types.has(ActivityItemType.RULE_RUN)).toBe(true)
      expect(types.has(ActivityItemType.PURCHASE_REQUEST)).toBe(true)
    })
  })

  describe('GET /api/activity', () => {
    it('#1 unauthenticated → 401', async () => {
      const res = await LIST_ORG(
        buildRequest({ method: 'GET', path: '/api/activity', session: null }),
      )
      expect(res.status).toBe(401)
    })

    it('#2 no organisation → 403 ONBOARDING_INCOMPLETE', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `solo-org-act-${Date.now()}@example.com`,
        name: 'Solo',
      })
      const res = await LIST_ORG(
        buildRequest({
          method: 'GET',
          path: '/api/activity',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    it('#3 N/A — org-wide route has no foreign resource id (cross-org is session-bound)', () => {
      expect(true).toBe(true)
    })

    it('#4 lacks transaction.view → 403', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      const res = await LIST_ORG(
        buildRequest({ method: 'GET', path: '/api/activity', session: member.session }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.TRANSACTION_VIEW,
      )
    })

    it('#5 access scope excludes subject → 403', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'viewer', {
        level: AccessScopeLevel.WORKSTREAM,
        workstreamIds: ['507f1f77bcf86cd799439011'],
      })
      const res = await LIST_ORG(
        buildRequest({ method: 'GET', path: '/api/activity', session: member.session }),
      )
      expect(res.status).toBe(403)
    })

    it('#6 invalid cursor → 422', async () => {
      const owner = await seedOwner()
      const res = await LIST_ORG(
        buildRequest({
          method: 'GET',
          path: '/api/activity',
          session: owner.session,
          query: { cursor: 'not-valid-cursor!!!' },
        }),
      )
      expect(res.status).toBe(422)
    })

    it('#7 happy path org-wide', async () => {
      const owner = await seedOwner()
      await seedTx(owner.ctx, owner.project.id, '2026-03-01T00:00:00.000Z', 'org')
      const res = await LIST_ORG(
        buildRequest({
          method: 'GET',
          path: '/api/activity',
          session: owner.session,
          query: { type: 'TRANSACTION' },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, activityContracts.list.output)
      expect(body.items.length).toBeGreaterThanOrEqual(1)
    })

    it('#8 N/A — org activity has no resource id', () => {
      expect(true).toBe(true)
    })

    it('#9 N/A — GET has no idempotency key', () => {
      expect(true).toBe(true)
    })

    it('#10 N/A — GET does not write audit', async () => {
      const owner = await seedOwner()
      const before = await AuditLogModel.countDocuments({ orgId: owner.ctx.orgId }).exec()
      const res = await LIST_ORG(
        buildRequest({
          method: 'GET',
          path: '/api/activity',
          session: owner.session,
        }),
      )
      expect(res.status).toBe(200)
      const after = await AuditLogModel.countDocuments({ orgId: owner.ctx.orgId }).exec()
      expect(after).toBe(before)
    })
  })
})
