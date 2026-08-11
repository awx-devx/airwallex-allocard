/**
 * B9.6 — Closure preflight: each blocker kind independently;
 * canStart === (blockers.length === 0).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/projects/[id]/closure/preflight/route'
import type { OrgContext } from '@/server/http/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectClosureModel } from '@/server/models/ProjectClosure'
import { ProjectModel } from '@/server/models/Project'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { PurchaseRequestModel } from '@/server/models/PurchaseRequest'
import { RoleModel } from '@/server/models/Role'
import { TransactionModel } from '@/server/models/Transaction'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectMembers from '@/server/repositories/projectMembers'
import * as projectsRepo from '@/server/repositories/projects'
import * as purchaseRequests from '@/server/repositories/purchaseRequests'
import * as rolesRepo from '@/server/repositories/roles'
import { createCard } from '@/server/repositories/cards'
import { createTransaction } from '@/server/repositories/transactions'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { resetRedis } from '@/server/redis'
import { closureContracts } from '@/shared/contracts/closure'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ClosureBlockingKind } from '@/shared/enums/closureBlockingKind'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { makeCardControls } from '../helpers/factories'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('B9.6 closure preflight', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      RoleModel.syncIndexes(),
      ProjectMemberModel.syncIndexes(),
      CardModel.syncIndexes(),
      TransactionModel.syncIndexes(),
      PurchaseRequestModel.syncIndexes(),
      ProjectClosureModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    installTestSessionResolver()
    resetRedis()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    resetRedis()
    vi.restoreAllMocks()
  })

  async function seedActiveProject() {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `pf-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Preflight Org',
      slug: `pf-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Preflight Project',
      code: `PF-${Date.now().toString(16)}`,
    })
    await projectsRepo.updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ACTIVE, {
      approvedAt: new Date(),
      launchedAt: new Date(),
    })
    return {
      user,
      org,
      ctx,
      project: (await projectsRepo.findProjectById(ctx, project.id))!,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  async function callPreflight(
    session: { userId: string; orgId: string; orgRole: OrgRole; onboarded: true } | null,
    projectId: string,
  ) {
    return GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${projectId}/closure/preflight`,
        session,
        params: { id: projectId },
      }),
    )
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
    owner: Awaited<ReturnType<typeof seedActiveProject>>,
    userId: string,
    roleKey: string,
    scope: { level: AccessScopeLevel; workstreamIds?: string[] } = {
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

  it('#1 unauthenticated → 401', async () => {
    const owner = await seedActiveProject()
    const res = await callPreflight(null, owner.project.id)
    expect(res.status).toBe(401)
  })

  it('#2 no organisation → 403 ONBOARDING_INCOMPLETE', async () => {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `solo-pf-${Date.now()}@example.com`,
      name: 'Solo',
    })
    const res = await GET(
      buildRequest({
        method: 'GET',
        path: '/api/projects/507f1f77bcf86cd799439011/closure/preflight',
        session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        params: { id: '507f1f77bcf86cd799439011' },
      }),
    )
    expect(res.status).toBe(403)
    expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
      ErrorCode.ONBOARDING_INCOMPLETE,
    )
  })

  it('#3 cross-org → 404', async () => {
    const a = await seedActiveProject()
    const b = await seedActiveProject()
    const res = await callPreflight(b.session, a.project.id)
    expect(res.status).toBe(404)
  })

  it('#4 lacks project.close → 403', async () => {
    const owner = await seedActiveProject()
    const member = await addOrgMember(owner.org.id)
    const res = await callPreflight(member.session, owner.project.id)
    expect(res.status).toBe(403)
    expect(
      (await readBody<{ error: { details?: { permission?: string } } }>(res)).error.details,
    ).toMatchObject({ permission: Permission.PROJECT_CLOSE })
  })

  it('#5 access scope excludes subject → 403', async () => {
    const owner = await seedActiveProject()
    const member = await addOrgMember(owner.org.id)
    await assignProjectRole(owner, member.user.id, 'project_manager', {
      level: AccessScopeLevel.WORKSTREAM,
      workstreamIds: ['507f1f77bcf86cd799439011'],
    })
    const res = await callPreflight(member.session, owner.project.id)
    expect(res.status).toBe(403)
  })

  it('#6 N/A — GET has no payload', () => {
    expect(true).toBe(true)
  })

  it('#7 happy path: empty blockers → canStart true', async () => {
    const owner = await seedActiveProject()
    const res = await callPreflight(owner.session, owner.project.id)
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, closureContracts.preflight.output)
    expect(body).toEqual({
      projectId: owner.project.id,
      canStart: true,
      blockers: [],
    })
  })

  it('#8 unknown project → 404', async () => {
    const owner = await seedActiveProject()
    const res = await callPreflight(owner.session, '507f1f77bcf86cd799439099')
    expect(res.status).toBe(404)
  })

  it('#9 N/A — GET has no idempotency key', () => {
    expect(true).toBe(true)
  })

  it('#10 N/A — GET does not write audit', async () => {
    const owner = await seedActiveProject()
    const before = await AuditLogModel.countDocuments({ orgId: owner.ctx.orgId }).exec()
    const res = await callPreflight(owner.session, owner.project.id)
    expect(res.status).toBe(200)
    const after = await AuditLogModel.countDocuments({ orgId: owner.ctx.orgId }).exec()
    expect(after).toBe(before)
  })

  it('OPEN_TRANSACTION blocker (AUTHORIZED non-auth type)', async () => {
    const owner = await seedActiveProject()
    const tx = await createTransaction(owner.ctx, {
      cardId: '507f1f77bcf86cd799439011',
      projectId: owner.project.id,
      airwallexTransactionId: `awx-open-${Date.now()}`,
      cardTransactionId: `ct-open-${Date.now()}`,
      lifecycleId: `life-open-${Date.now()}`,
      type: TransactionType.CLEARING,
      status: TransactionStatus.AUTHORIZED,
      amount: 2500,
      currency: 'USD',
      billingAmount: 2500,
      billingCurrency: 'USD',
      merchant: { name: 'Store', mcc: '5411', country: 'US' },
      transactedAt: new Date(),
    })

    const body = await expectMatchesContract(
      await callPreflight(owner.session, owner.project.id),
      closureContracts.preflight.output,
    )
    expect(body.canStart).toBe(false)
    expect(body.blockers.some((b) => b.kind === ClosureBlockingKind.OPEN_TRANSACTION)).toBe(true)
    expect(
      body.blockers.find((b) => b.kind === ClosureBlockingKind.OPEN_TRANSACTION),
    ).toMatchObject({
      subjectType: 'transaction',
      subjectId: tx.id,
    })
  })

  it('PENDING_AUTHORIZATION blocker (AUTHORIZATION + AUTHORIZED)', async () => {
    const owner = await seedActiveProject()
    const tx = await createTransaction(owner.ctx, {
      cardId: '507f1f77bcf86cd799439011',
      projectId: owner.project.id,
      airwallexTransactionId: `awx-auth-${Date.now()}`,
      cardTransactionId: `ct-auth-${Date.now()}`,
      lifecycleId: `life-auth-${Date.now()}`,
      type: TransactionType.AUTHORIZATION,
      status: TransactionStatus.AUTHORIZED,
      amount: 1000,
      currency: 'USD',
      billingAmount: 1000,
      billingCurrency: 'USD',
      merchant: { name: 'Store', mcc: '5411', country: 'US' },
      transactedAt: new Date(),
    })

    const body = await expectMatchesContract(
      await callPreflight(owner.session, owner.project.id),
      closureContracts.preflight.output,
    )
    expect(body.canStart).toBe(false)
    expect(body.blockers.some((b) => b.kind === ClosureBlockingKind.PENDING_AUTHORIZATION)).toBe(
      true,
    )
    expect(
      body.blockers.find((b) => b.kind === ClosureBlockingKind.PENDING_AUTHORIZATION),
    ).toMatchObject({ subjectId: tx.id })
  })

  it('PENDING_REQUEST blocker', async () => {
    const owner = await seedActiveProject()
    const draft = await purchaseRequests.createPurchaseRequest(owner.ctx, {
      projectId: owner.project.id,
      requestedBy: owner.user.id,
      amount: 5000,
      currency: 'USD',
      vendor: 'Acme',
      description: 'Widgets',
      justification: 'Need them',
    })
    const pending = await purchaseRequests.submitPurchaseRequest(owner.ctx, draft.id, {
      status: PurchaseRequestStatus.PENDING,
      policyDecision: {
        outcome: PolicyOutcome.APPROVAL_REQUIRED,
        reasons: ['threshold'],
        requiredApprovals: 1,
      },
    })
    expect(pending?.status).toBe(PurchaseRequestStatus.PENDING)

    const body = await expectMatchesContract(
      await callPreflight(owner.session, owner.project.id),
      closureContracts.preflight.output,
    )
    expect(body.canStart).toBe(false)
    expect(body.blockers.some((b) => b.kind === ClosureBlockingKind.PENDING_REQUEST)).toBe(true)
    expect(body.blockers.find((b) => b.kind === ClosureBlockingKind.PENDING_REQUEST)).toMatchObject(
      {
        subjectId: pending!.id,
      },
    )
  })

  it('ACTIVE_CARD blocker', async () => {
    const owner = await seedActiveProject()
    const card = await createCard(owner.ctx, {
      projectId: owner.project.id,
      cardholderId: '507f1f77bcf86cd799439011',
      airwallexCardId: `awx-card-${Date.now()}`,
      maskedNumber: '****1111',
      nickName: 'Active',
      purpose: CardPurpose.SHARED,
      status: CardStatus.ACTIVE,
      desiredControls: makeCardControls(),
      appliedControls: makeCardControls(),
    })

    const body = await expectMatchesContract(
      await callPreflight(owner.session, owner.project.id),
      closureContracts.preflight.output,
    )
    expect(body.canStart).toBe(false)
    expect(body.blockers.some((b) => b.kind === ClosureBlockingKind.ACTIVE_CARD)).toBe(true)
    expect(body.blockers.find((b) => b.kind === ClosureBlockingKind.ACTIVE_CARD)).toMatchObject({
      subjectId: card.id,
    })
  })

  it('ACTIVE_ACCESS blocker (spend permission)', async () => {
    const owner = await seedActiveProject()
    const spender = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `sp-${Date.now()}@example.com`,
      name: 'Spender',
    })
    await memberships.createMembership(
      { orgId: owner.org.id, userId: spender.id, orgRole: OrgRole.MEMBER },
      { userId: spender.id, orgRole: OrgRole.MEMBER },
    )
    const role = await rolesRepo.findRoleByKey(owner.ctx, 'project_spender')
    expect(role).not.toBeNull()
    const member = await projectMembers.addProjectMember(owner.ctx, {
      projectId: owner.project.id,
      userId: spender.id,
      roleId: role!.id,
      scope: { level: AccessScopeLevel.PROJECT },
      effectivePermissions: role!.permissions,
      addedBy: owner.user.id,
    })
    expect(member.effectivePermissions).toContain(Permission.PAYMENT_MAKE)

    const body = await expectMatchesContract(
      await callPreflight(owner.session, owner.project.id),
      closureContracts.preflight.output,
    )
    expect(body.canStart).toBe(false)
    expect(body.blockers.some((b) => b.kind === ClosureBlockingKind.ACTIVE_ACCESS)).toBe(true)
    expect(body.blockers.find((b) => b.kind === ClosureBlockingKind.ACTIVE_ACCESS)).toMatchObject({
      subjectId: member.id,
    })
  })

  it('ACTIVE_ACCESS blocker (validTo in future)', async () => {
    const owner = await seedActiveProject()
    const viewer = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `v-${Date.now()}@example.com`,
      name: 'Temp Viewer',
    })
    await memberships.createMembership(
      { orgId: owner.org.id, userId: viewer.id, orgRole: OrgRole.MEMBER },
      { userId: viewer.id, orgRole: OrgRole.MEMBER },
    )
    const role = await rolesRepo.findRoleByKey(owner.ctx, 'viewer')
    expect(role).not.toBeNull()
    const future = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString()
    const member = await projectMembers.addProjectMember(owner.ctx, {
      projectId: owner.project.id,
      userId: viewer.id,
      roleId: role!.id,
      scope: { level: AccessScopeLevel.PROJECT, validTo: future },
      effectivePermissions: role!.permissions,
      addedBy: owner.user.id,
    })

    const body = await expectMatchesContract(
      await callPreflight(owner.session, owner.project.id),
      closureContracts.preflight.output,
    )
    expect(body.canStart).toBe(false)
    expect(body.blockers.some((b) => b.kind === ClosureBlockingKind.ACTIVE_ACCESS)).toBe(true)
    expect(body.blockers.find((b) => b.kind === ClosureBlockingKind.ACTIVE_ACCESS)).toMatchObject({
      subjectId: member.id,
    })
  })
})
