/**
 * B9.6 — Closure start: ACTIVE + canStart → CLOSING, freeze cards, FREEZE→DONE;
 * idempotent resume when already CLOSING.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/projects/[id]/closure/start/route'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
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
import * as projectsRepo from '@/server/repositories/projects'
import { createCard, findCardById } from '@/server/repositories/cards'
import { findByProject as findClosureByProject } from '@/server/repositories/projectClosures'
import { createTransaction } from '@/server/repositories/transactions'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { resetRedis } from '@/server/redis'
import { closureContracts } from '@/shared/contracts/closure'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { ClosureStep } from '@/shared/enums/closureStep'
import { ClosureStepStatus } from '@/shared/enums/closureStepStatus'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { makeCardControls } from '../helpers/factories'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('B9.6 closure start', () => {
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
    resetEventPublisher()
    resetRedis()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    resetEventPublisher()
    resetRedis()
    vi.restoreAllMocks()
  })

  async function seedActiveProject() {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `st-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Start Org',
      slug: `st-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Start Project',
      code: `ST-${Date.now().toString(16)}`,
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
    return POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${projectId}/closure/start`,
        session,
        params: { id: projectId },
      }),
    )
  }

  it('#1 unauthenticated → 401', async () => {
    const owner = await seedActiveProject()
    expect((await callStart(null, owner.project.id)).status).toBe(401)
  })

  it('#3 cross-org → 404', async () => {
    const a = await seedActiveProject()
    const b = await seedActiveProject()
    expect((await callStart(b.session, a.project.id)).status).toBe(404)
  })

  it('#4 lacks project.close → 403', async () => {
    const owner = await seedActiveProject()
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
    const res = await callStart(
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

  it('rejects when blockers present', async () => {
    const owner = await seedActiveProject()
    await createTransaction(owner.ctx, {
      cardId: '507f1f77bcf86cd799439011',
      projectId: owner.project.id,
      airwallexTransactionId: `awx-block-${Date.now()}`,
      cardTransactionId: `ct-block-${Date.now()}`,
      lifecycleId: `life-block-${Date.now()}`,
      type: TransactionType.AUTHORIZATION,
      status: TransactionStatus.AUTHORIZED,
      amount: 100,
      currency: 'USD',
      billingAmount: 100,
      billingCurrency: 'USD',
      merchant: { name: 'Store', mcc: '5411', country: 'US' },
      transactedAt: new Date(),
    })

    const res = await callStart(owner.session, owner.project.id)
    expect(res.status).toBe(409)
    expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(ErrorCode.CONFLICT)
    const still = await projectsRepo.findProjectById(owner.ctx, owner.project.id)
    expect(still?.status).toBe(ProjectStatus.ACTIVE)
  })

  it('happy start: CLOSING, FREEZE DONE, currentStep SETTLE, emits project.closing', async () => {
    const owner = await seedActiveProject()
    // PENDING card (not ACTIVE) so canStart; start freezes via freezeCard + Airwallex fixtures.
    const card = await createCard(owner.ctx, {
      projectId: owner.project.id,
      cardholderId: '507f1f77bcf86cd799439011',
      airwallexCardId: 'card_fixture_001',
      maskedNumber: '****2222',
      nickName: 'Pending',
      purpose: CardPurpose.SHARED,
      status: CardStatus.PENDING,
      desiredControls: makeCardControls(),
      appliedControls: makeCardControls(),
    })

    const res = await callStart(owner.session, owner.project.id)
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, closureContracts.start.output)
    expect(body.projectStatus).toBe(ProjectStatus.CLOSING)
    expect(body.currentStep).toBe(ClosureStep.SETTLE)
    expect(body.resumable).toBe(true)
    const freeze = body.steps.find((s) => s.step === ClosureStep.FREEZE)
    const preflight = body.steps.find((s) => s.step === ClosureStep.PREFLIGHT)
    expect(freeze?.status).toBe(ClosureStepStatus.DONE)
    expect(preflight?.status).toBe(ClosureStepStatus.DONE)

    const project = await projectsRepo.findProjectById(owner.ctx, owner.project.id)
    expect(project?.status).toBe(ProjectStatus.CLOSING)

    const frozen = await findCardById(owner.ctx, card.id)
    expect(frozen?.status).toBe(CardStatus.INACTIVE)

    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSING),
    ).toHaveLength(1)

    const audits = await AuditLogModel.find({
      orgId: owner.org.id,
      action: 'project.closure_started',
      subjectId: owner.project.id,
    }).exec()
    expect(audits).toHaveLength(1)
  })

  it('idempotent resume when already CLOSING', async () => {
    const owner = await seedActiveProject()
    const first = await callStart(owner.session, owner.project.id)
    expect(first.status).toBe(200)
    const firstBody = await expectMatchesContract(first, closureContracts.start.output)
    const closureAfterFirst = await findClosureByProject(owner.ctx, owner.project.id)
    expect(closureAfterFirst).not.toBeNull()

    resetEventPublisher()
    const second = await callStart(owner.session, owner.project.id)
    expect(second.status).toBe(200)
    const secondBody = await expectMatchesContract(second, closureContracts.start.output)
    expect(secondBody.projectStatus).toBe(ProjectStatus.CLOSING)
    expect(secondBody.currentStep).toBe(firstBody.currentStep)
    expect(secondBody.steps).toEqual(firstBody.steps)

    // No second closing event on resume.
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSING),
    ).toHaveLength(0)

    const audits = await AuditLogModel.find({
      orgId: owner.org.id,
      action: 'project.closure_started',
      subjectId: owner.project.id,
    }).exec()
    expect(audits).toHaveLength(1)
  })
})
