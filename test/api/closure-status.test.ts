/**
 * B9.7 — Closure status GET + settle on poll.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from '@/app/api/projects/[id]/closure/status/route'
import { POST as startClosurePost } from '@/app/api/projects/[id]/closure/start/route'
import type { OrgContext } from '@/server/http/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectClosureModel } from '@/server/models/ProjectClosure'
import { ProjectModel } from '@/server/models/Project'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { RoleModel } from '@/server/models/Role'
import { TransactionModel } from '@/server/models/Transaction'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectMembers from '@/server/repositories/projectMembers'
import * as projectsRepo from '@/server/repositories/projects'
import * as rolesRepo from '@/server/repositories/roles'
import { createTransaction } from '@/server/repositories/transactions'
import { revokeClosure } from '@/server/services/closure/revoke'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { resetRedis } from '@/server/redis'
import { closureContracts } from '@/shared/contracts/closure'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ClosureStep } from '@/shared/enums/closureStep'
import { ClosureStepStatus } from '@/shared/enums/closureStepStatus'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('B9.7 closure status', () => {
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
      email: `cs-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Status Org',
      slug: `cs-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Status Project',
      code: `CS-${Date.now().toString(16)}`,
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

  async function callStart(
    session: { userId: string; orgId: string; orgRole: OrgRole; onboarded: true } | null,
    projectId: string,
  ) {
    return startClosurePost(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${projectId}/closure/start`,
        session,
        params: { id: projectId },
      }),
    )
  }

  async function callStatus(
    session: { userId: string; orgId: string; orgRole: OrgRole; onboarded: true } | null,
    projectId: string,
  ) {
    return GET(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${projectId}/closure/status`,
        session,
        params: { id: projectId },
      }),
    )
  }

  it('#1 unauthenticated → 401', async () => {
    const owner = await seedActiveProject()
    expect((await callStatus(null, owner.project.id)).status).toBe(401)
  })

  it('#3 cross-org → 404', async () => {
    const a = await seedActiveProject()
    await callStart(a.session, a.project.id)
    const b = await seedActiveProject()
    expect((await callStatus(b.session, a.project.id)).status).toBe(404)
  })

  it('#4 lacks project.close → 403', async () => {
    const owner = await seedActiveProject()
    await callStart(owner.session, owner.project.id)
    const member = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `m-${Date.now()}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId: owner.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
      { userId: member.id, orgRole: OrgRole.MEMBER },
    )
    const res = await callStatus(
      {
        userId: member.id,
        orgId: owner.org.id,
        orgRole: OrgRole.MEMBER,
        onboarded: true,
      },
      owner.project.id,
    )
    expect(res.status).toBe(403)
    expect(
      (await readBody<{ error: { details?: { permission?: string } } }>(res)).error.details,
    ).toMatchObject({ permission: Permission.PROJECT_CLOSE })
  })

  it('#8 ACTIVE without closure → 409', async () => {
    const owner = await seedActiveProject()
    const res = await callStatus(owner.session, owner.project.id)
    expect(res.status).toBe(409)
    expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(ErrorCode.CONFLICT)
  })

  it('#8 missing project → 404', async () => {
    const owner = await seedActiveProject()
    const res = await callStatus(owner.session, '507f1f77bcf86cd799439011')
    expect(res.status).toBe(404)
  })

  it('happy status after start: SETTLE DONE when no pending auths', async () => {
    const owner = await seedActiveProject()
    expect((await callStart(owner.session, owner.project.id)).status).toBe(200)

    const body = await expectMatchesContract(
      await callStatus(owner.session, owner.project.id),
      closureContracts.status.output,
    )
    expect(body.projectStatus).toBe(ProjectStatus.CLOSING)
    expect(body.resumable).toBe(true)
    expect(body.currentStep).toBe(ClosureStep.REVOKE)
    const settle = body.steps.find((s) => s.step === ClosureStep.SETTLE)
    expect(settle?.status).toBe(ClosureStepStatus.DONE)
  })

  it('status poll marks SETTLE BLOCKED when pending auth remains', async () => {
    const owner = await seedActiveProject()
    expect((await callStart(owner.session, owner.project.id)).status).toBe(200)

    await createTransaction(owner.ctx, {
      cardId: '507f1f77bcf86cd799439011',
      projectId: owner.project.id,
      airwallexTransactionId: `awx-pend-${Date.now()}`,
      cardTransactionId: `ct-pend-${Date.now()}`,
      lifecycleId: `life-pend-${Date.now()}`,
      type: TransactionType.AUTHORIZATION,
      status: TransactionStatus.AUTHORIZED,
      amount: 2500,
      currency: 'USD',
      billingAmount: 2500,
      billingCurrency: 'USD',
      merchant: { name: 'Store', mcc: '5411', country: 'US' },
      transactedAt: new Date(),
    })

    const body = await expectMatchesContract(
      await callStatus(owner.session, owner.project.id),
      closureContracts.status.output,
    )
    const settle = body.steps.find((s) => s.step === ClosureStep.SETTLE)
    expect(settle?.status).toBe(ClosureStepStatus.BLOCKED)
    expect(settle?.detail).toBe('1 pending authorization(s)')
    expect(body.currentStep).toBe(ClosureStep.SETTLE)
  })

  it('revoke expires scopes and strips payment.make; does not close cards', async () => {
    const owner = await seedActiveProject()
    expect((await callStart(owner.session, owner.project.id)).status).toBe(200)

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
    const future = new Date(Date.now() + 7 * 24 * 60 * 60_000).toISOString()
    await projectMembers.addProjectMember(owner.ctx, {
      projectId: owner.project.id,
      userId: spender.id,
      roleId: role!.id,
      scope: { level: AccessScopeLevel.PROJECT, validTo: future },
      effectivePermissions: role!.permissions,
      addedBy: owner.user.id,
    })

    // Settle first so revoke advances currentStep to CLOSE_CARDS.
    await expectMatchesContract(
      await callStatus(owner.session, owner.project.id),
      closureContracts.status.output,
    )

    const closure = await revokeClosure(owner.ctx, owner.project.id)
    const revoke = closure.steps.find((s) => s.step === ClosureStep.REVOKE)
    expect(revoke?.status).toBe(ClosureStepStatus.DONE)
    expect(closure.currentStep).toBe(ClosureStep.CLOSE_CARDS)

    const member = await projectMembers.findActiveProjectMember(
      owner.ctx,
      owner.project.id,
      spender.id,
    )
    expect(member).not.toBeNull()
    expect(member!.effectivePermissions).not.toContain(Permission.PAYMENT_MAKE)
    expect(member!.scope.validTo).toBeDefined()
    expect(Date.parse(member!.scope.validTo!)).toBeLessThanOrEqual(Date.now())

    const cards = await CardModel.find({ orgId: owner.org.id, projectId: owner.project.id }).exec()
    expect(cards.every((c) => c.status !== 'CLOSED')).toBe(true)
  })
})
