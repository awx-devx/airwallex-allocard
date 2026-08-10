import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/projects/[id]/transition/route'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { BudgetModel } from '@/server/models/Budget'
import { CardModel } from '@/server/models/Card'
import { CardholderModel } from '@/server/models/Cardholder'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import * as budgets from '@/server/repositories/budgets'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as users from '@/server/repositories/users'
import { projectContracts } from '@/shared/contracts/project'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

const ALL = Object.values(ProjectStatus)

const VALID: ReadonlyArray<{ from: ProjectStatus; to: ProjectStatus }> = [
  { from: ProjectStatus.DRAFT, to: ProjectStatus.PENDING_APPROVAL },
  { from: ProjectStatus.DRAFT, to: ProjectStatus.CANCELLED },
  { from: ProjectStatus.PENDING_APPROVAL, to: ProjectStatus.ACTIVE },
  { from: ProjectStatus.ACTIVE, to: ProjectStatus.CLOSING },
  { from: ProjectStatus.CLOSING, to: ProjectStatus.CLOSED },
  { from: ProjectStatus.CLOSED, to: ProjectStatus.ARCHIVED },
]

function isValid(from: ProjectStatus, to: ProjectStatus): boolean {
  return VALID.some((e) => e.from === from && e.to === to)
}

describe('/api/projects/:id/transition', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      BudgetModel.syncIndexes(),
      CardholderModel.syncIndexes(),
      CardModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    resetEventPublisher()
    vi.restoreAllMocks()
  })

  async function seedOwner() {
    const user = await users.createUser({
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Transition Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    await memberships.createMembership(
      { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER },
      { userId: user.id, orgRole: OrgRole.OWNER },
    )
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    return {
      user,
      org,
      ctx,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  async function createReadyDraft(
    ctx: { orgId: string; userId: string; orgRole: OrgRole },
    code: string,
  ) {
    const project = await projectsRepo.createProject(ctx, {
      name: 'Ready Project',
      code,
      ownerId: ctx.userId,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
    })
    await budgets.upsertBudgetFields(ctx, project.id, {
      currency: 'USD',
      approvedAmount: 100_000,
    })
    return project
  }

  /** Advance a project along the happy path until `target` (inclusive). */
  async function advanceTo(
    ctx: { orgId: string; userId: string; orgRole: OrgRole },
    projectId: string,
    target: ProjectStatus,
  ) {
    const path: ProjectStatus[] = [
      ProjectStatus.DRAFT,
      ProjectStatus.PENDING_APPROVAL,
      ProjectStatus.ACTIVE,
      ProjectStatus.CLOSING,
      ProjectStatus.CLOSED,
      ProjectStatus.ARCHIVED,
    ]
    const targetIdx = path.indexOf(target)
    if (targetIdx < 0) {
      if (target === ProjectStatus.CANCELLED) {
        await projectsRepo.updateStatus(
          ctx,
          projectId,
          ProjectStatus.DRAFT,
          ProjectStatus.CANCELLED,
        )
      }
      return
    }
    for (let i = 0; i < targetIdx; i += 1) {
      const from = path[i]!
      const to = path[i + 1]!
      const extras =
        to === ProjectStatus.ACTIVE
          ? { approvedAt: new Date(), launchedAt: new Date() }
          : to === ProjectStatus.CLOSED
            ? { closedAt: new Date() }
            : {}
      const updated = await projectsRepo.updateStatus(ctx, projectId, from, to, extras)
      expect(updated?.status).toBe(to)
    }
  }

  async function callTransition(
    session: { userId: string; orgId: string; orgRole: OrgRole; onboarded: true },
    projectId: string,
    to: ProjectStatus,
    reason?: string,
  ) {
    return POST(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${projectId}/transition`,
        session,
        params: { id: projectId },
        body: reason !== undefined ? { to, reason } : { to },
      }),
    )
  }

  // Matrix #1
  it('returns 401 when unauthenticated', async () => {
    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/projects/x/transition',
        session: null,
        params: { id: 'x' },
        body: { to: ProjectStatus.CANCELLED },
      }),
    )
    expect(res.status).toBe(401)
  })

  // Matrix #4
  it('returns 403 when the caller lacks permission', async () => {
    const owner = await seedOwner()
    const member = await users.createUser({
      email: `m-${Date.now()}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId: owner.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
      { userId: member.id, orgRole: OrgRole.MEMBER },
    )
    const project = await createReadyDraft(owner.ctx, `PERM-${Date.now()}`)

    const res = await callTransition(
      {
        userId: member.id,
        orgId: owner.org.id,
        orgRole: OrgRole.MEMBER,
        onboarded: true,
      },
      project.id,
      ProjectStatus.CANCELLED,
    )
    expect(res.status).toBe(403)
  })

  // Matrix #3
  it('returns 404 for a project in another org', async () => {
    const a = await seedOwner()
    const b = await seedOwner()
    const project = await createReadyDraft(a.ctx, `XO-${Date.now()}`)
    const res = await callTransition(b.session, project.id, ProjectStatus.CANCELLED)
    expect(res.status).toBe(404)
  })

  it('returns 422 when DRAFT→PENDING_APPROVAL lacks required fields', async () => {
    const { session, ctx } = await seedOwner()
    const project = await projectsRepo.createProject(ctx, {
      name: 'Incomplete',
      code: `INC-${Date.now()}`,
    })

    const res = await callTransition(session, project.id, ProjectStatus.PENDING_APPROVAL)
    expect(res.status).toBe(422)
    const body = await readBody<{ error: { code: string; details?: { fieldErrors?: unknown } } }>(
      res,
    )
    expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED)
    expect(body.error.details?.fieldErrors).toBeTruthy()

    const still = await projectsRepo.findProjectById(ctx, project.id)
    expect(still?.status).toBe(ProjectStatus.DRAFT)
  })

  it('returns 422 when DRAFT→PENDING_APPROVAL has fields but no approved budget', async () => {
    const { session, ctx } = await seedOwner()
    const project = await projectsRepo.createProject(ctx, {
      name: 'Ready without budget',
      code: `NOB-${Date.now()}`,
      ownerId: ctx.userId,
      startDate: new Date('2026-01-01T00:00:00.000Z'),
      endDate: new Date('2026-12-31T00:00:00.000Z'),
    })

    const res = await callTransition(session, project.id, ProjectStatus.PENDING_APPROVAL)
    expect(res.status).toBe(422)
    const body = await readBody<{
      error: { code: string; details?: { fieldErrors?: { hasBudget?: string[] } } }
    }>(res)
    expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED)
    expect(body.error.details?.fieldErrors?.hasBudget).toBeTruthy()
  })

  it('covers the full transition matrix (valid + invalid)', async () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const { session, ctx } = await seedOwner()
        const project = await createReadyDraft(
          ctx,
          `${from.slice(0, 2)}-${to.slice(0, 2)}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
        )
        await advanceTo(ctx, project.id, from)

        resetEventPublisher()
        const res = await callTransition(session, project.id, to)

        if (isValid(from, to)) {
          expect(res.status, `${from}→${to}`).toBe(200)
          const body = await expectMatchesContract(res, projectContracts.transition.output)
          expect(body.status).toBe(to)
        } else {
          expect(res.status, `${from}→${to}`).toBe(409)
          const after = await projectsRepo.findProjectById(ctx, project.id)
          expect(after?.status).toBe(from)
        }
      }
    }
  }, 120_000)

  it('emits approved+launched on → ACTIVE, closing on → CLOSING, closed on → CLOSED', async () => {
    const { session, ctx } = await seedOwner()
    const project = await createReadyDraft(ctx, `EVT-${Date.now()}`)

    await callTransition(session, project.id, ProjectStatus.PENDING_APPROVAL)
    resetEventPublisher()

    await callTransition(session, project.id, ProjectStatus.ACTIVE)
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_APPROVED),
    ).toHaveLength(1)
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_LAUNCHED),
    ).toHaveLength(1)

    resetEventPublisher()
    await callTransition(session, project.id, ProjectStatus.CLOSING)
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSING),
    ).toHaveLength(1)

    resetEventPublisher()
    await callTransition(session, project.id, ProjectStatus.CLOSED)
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSED),
    ).toHaveLength(1)
  })

  it('emits project.launched exactly once under concurrent double launch', async () => {
    const { session, ctx } = await seedOwner()
    const project = await createReadyDraft(ctx, `RACE-${Date.now()}`)
    await advanceTo(ctx, project.id, ProjectStatus.PENDING_APPROVAL)
    resetEventPublisher()

    const [a, b] = await Promise.all([
      callTransition(session, project.id, ProjectStatus.ACTIVE),
      callTransition(session, project.id, ProjectStatus.ACTIVE),
    ])

    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual([200, 409])

    const launched = getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_LAUNCHED)
    expect(launched).toHaveLength(1)

    const after = await projectsRepo.findProjectById(ctx, project.id)
    expect(after?.status).toBe(ProjectStatus.ACTIVE)
    expect(after?.launchedAt).toEqual(expect.any(String))
  })

  it('audits a successful transition once', async () => {
    const { session, ctx } = await seedOwner()
    const project = await createReadyDraft(ctx, `AUD-${Date.now()}`)

    const res = await callTransition(session, project.id, ProjectStatus.CANCELLED, 'abandoned')
    expect(res.status).toBe(200)

    const audits = await AuditLogModel.find({
      orgId: session.orgId,
      action: 'project.transitioned',
      subjectId: project.id,
    }).exec()
    expect(audits).toHaveLength(1)
    expect(audits[0]?.metadata).toMatchObject({
      from: ProjectStatus.DRAFT,
      to: ProjectStatus.CANCELLED,
      reason: 'abandoned',
    })
  })

  it('blocks ACTIVE→CLOSING while non-CLOSED cards exist', async () => {
    const { session, ctx } = await seedOwner()
    const project = await createReadyDraft(ctx, `CARDS-${Date.now()}`)
    await advanceTo(ctx, project.id, ProjectStatus.ACTIVE)

    const { createCardholderForOrg } = await import('@/server/services/cardholders/create')
    const { createCardForProject } = await import('@/server/services/cards/create')
    const { CardholderType } = await import('@/shared/enums/cardholderType')
    const { CardholderStatus } = await import('@/shared/enums/cardholderStatus')
    const { CardPurpose } = await import('@/shared/enums/cardPurpose')
    const cardholdersRepo = await import('@/server/repositories/cardholders')
    const { makeCardControls } = await import('../helpers/factories')

    const ch = await createCardholderForOrg(ctx, { type: CardholderType.DELEGATE })
    if (ch.status !== CardholderStatus.READY) {
      await cardholdersRepo.updateCardholderStatus(ctx, ch.id, CardholderStatus.READY)
    }
    await createCardForProject(ctx, project.id, {
      purpose: CardPurpose.SHARED,
      cardholderId: ch.id,
      desiredControls: makeCardControls(),
    })

    const res = await callTransition(session, project.id, ProjectStatus.CLOSING)
    expect(res.status).toBe(409)
    const body = await readBody<{ error: { code: string; message: string } }>(res)
    expect(body.error.code).toBe(ErrorCode.CONFLICT)
    expect(body.error.message).toMatch(/not CLOSED/)
  })
})
