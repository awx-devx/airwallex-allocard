/**
 * B9.8 — Closure complete: confirms required; close cards; final report; archive;
 * resumable; ARCHIVED rejects PATCH; final report totals match ledger.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as completeClosurePost } from '@/app/api/projects/[id]/closure/complete/route'
import { GET as getFinalReport } from '@/app/api/projects/[id]/report/final/route'
import { POST as startClosurePost } from '@/app/api/projects/[id]/closure/start/route'
import { PATCH as patchProject } from '@/app/api/projects/[id]/route'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import type { OrgContext } from '@/server/http/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { BudgetModel } from '@/server/models/Budget'
import { CardModel } from '@/server/models/Card'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectClosureModel } from '@/server/models/ProjectClosure'
import { ProjectModel } from '@/server/models/Project'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { RoleModel } from '@/server/models/Role'
import { TransactionModel } from '@/server/models/Transaction'
import { UserModel } from '@/server/models/User'
import { appendEntry, findEntriesByProject } from '@/server/repositories/budgetEntries'
import { upsertBudgetFields } from '@/server/repositories/budgets'
import { createCard, findCardById, listCards } from '@/server/repositories/cards'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectMembers from '@/server/repositories/projectMembers'
import { findByProject as findClosureByProject } from '@/server/repositories/projectClosures'
import * as projectsRepo from '@/server/repositories/projects'
import * as rolesRepo from '@/server/repositories/roles'
import { createTransaction } from '@/server/repositories/transactions'
import { projectBudget } from '@/server/services/budget/projectProjection'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { resetRedis } from '@/server/redis'
import { closureContracts } from '@/shared/contracts/closure'
import { reportContracts } from '@/shared/contracts/report'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
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

describe('B9.8 closure complete', () => {
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
      BudgetModel.syncIndexes(),
      BudgetEntryModel.syncIndexes(),
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
      email: `cc-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Complete Org',
      slug: `cc-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Complete Project',
      code: `CC-${Date.now().toString(16)}`,
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

  async function callComplete(
    session: { userId: string; orgId: string; orgRole: OrgRole; onboarded: true } | null,
    projectId: string,
    body: unknown,
  ) {
    return completeClosurePost(
      buildRequest({
        method: 'POST',
        path: `/api/projects/${projectId}/closure/complete`,
        session,
        params: { id: projectId },
        body,
      }),
    )
  }

  async function callFinalReport(
    session: { userId: string; orgId: string; orgRole: OrgRole; onboarded: true } | null,
    projectId: string,
  ) {
    return getFinalReport(
      buildRequest({
        method: 'GET',
        path: `/api/projects/${projectId}/report/final`,
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

  async function archiveProject(owner: Awaited<ReturnType<typeof seedActiveProject>>) {
    expect((await callStart(owner.session, owner.project.id)).status).toBe(200)
    const res = await callComplete(owner.session, owner.project.id, {
      confirmCloseCards: true,
      confirmArchive: true,
    })
    expect(res.status).toBe(200)
    return res
  }

  describe('POST /api/projects/:id/closure/complete', () => {
    it('#1 unauthenticated → 401', async () => {
      const owner = await seedActiveProject()
      expect(
        (
          await callComplete(null, owner.project.id, {
            confirmCloseCards: true,
            confirmArchive: true,
          })
        ).status,
      ).toBe(401)
    })

    it('#2 no organisation → 403 ONBOARDING_INCOMPLETE', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `solo-cc-${Date.now()}@example.com`,
        name: 'Solo',
      })
      const res = await completeClosurePost(
        buildRequest({
          method: 'POST',
          path: '/api/projects/507f1f77bcf86cd799439011/closure/complete',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: '507f1f77bcf86cd799439011' },
          body: { confirmCloseCards: true, confirmArchive: true },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    it('#3 cross-org → 404', async () => {
      const a = await seedActiveProject()
      await callStart(a.session, a.project.id)
      const b = await seedActiveProject()
      expect(
        (
          await callComplete(b.session, a.project.id, {
            confirmCloseCards: true,
            confirmArchive: true,
          })
        ).status,
      ).toBe(404)
    })

    it('#4 lacks project.close → 403', async () => {
      const owner = await seedActiveProject()
      await callStart(owner.session, owner.project.id)
      const member = await addOrgMember(owner.org.id)
      const res = await callComplete(member.session, owner.project.id, {
        confirmCloseCards: true,
        confirmArchive: true,
      })
      expect(res.status).toBe(403)
      expect(
        (await readBody<{ error: { details?: { permission?: string } } }>(res)).error.details,
      ).toMatchObject({ permission: Permission.PROJECT_CLOSE })
    })

    it('#5 access scope excludes subject → 403', async () => {
      const owner = await seedActiveProject()
      await callStart(owner.session, owner.project.id)
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'project_manager', {
        level: AccessScopeLevel.WORKSTREAM,
        workstreamIds: ['507f1f77bcf86cd799439011'],
      })
      const res = await callComplete(member.session, owner.project.id, {
        confirmCloseCards: true,
        confirmArchive: true,
      })
      expect(res.status).toBe(403)
    })

    it('#6 both confirm literals required → 422', async () => {
      const owner = await seedActiveProject()
      await callStart(owner.session, owner.project.id)

      const missing = await callComplete(owner.session, owner.project.id, {})
      expect(missing.status).toBe(422)

      const falseClose = await callComplete(owner.session, owner.project.id, {
        confirmCloseCards: false,
        confirmArchive: true,
      })
      expect(falseClose.status).toBe(422)

      const falseArchive = await callComplete(owner.session, owner.project.id, {
        confirmCloseCards: true,
        confirmArchive: false,
      })
      expect(falseArchive.status).toBe(422)
    })

    it('#7 happy complete: cards CLOSED, ARCHIVED, events, final report', async () => {
      const owner = await seedActiveProject()
      await upsertBudgetFields(owner.ctx, owner.project.id, {
        currency: 'USD',
        approvedAmount: 100_000,
      })
      await appendEntry(owner.ctx, {
        projectId: owner.project.id,
        type: BudgetEntryType.APPROVAL,
        amount: 100_000,
        currency: 'USD',
        sourceType: BudgetEntrySourceType.MANUAL,
        sourceId: `approved-${Date.now()}`,
        createdBy: owner.user.id,
      })
      await appendEntry(owner.ctx, {
        projectId: owner.project.id,
        type: BudgetEntryType.ACTUAL,
        amount: 25_000,
        currency: 'USD',
        sourceType: BudgetEntrySourceType.TRANSACTION,
        sourceId: `actual-${Date.now()}`,
        lifecycleId: `life-actual-${Date.now()}`,
        createdBy: 'system',
      })

      const card = await createCard(owner.ctx, {
        projectId: owner.project.id,
        cardholderId: '507f1f77bcf86cd799439011',
        airwallexCardId: 'card_fixture_001',
        maskedNumber: '****2222',
        nickName: 'To close',
        purpose: CardPurpose.SHARED,
        status: CardStatus.PENDING,
        desiredControls: makeCardControls(),
        appliedControls: makeCardControls(),
      })

      await createTransaction(owner.ctx, {
        cardId: card.id,
        projectId: owner.project.id,
        airwallexTransactionId: `awx-cleared-${Date.now()}`,
        cardTransactionId: `ct-cleared-${Date.now()}`,
        lifecycleId: `life-cleared-${Date.now()}`,
        type: TransactionType.CLEARING,
        status: TransactionStatus.CLEARED,
        amount: 25_000,
        currency: 'USD',
        billingAmount: 25_000,
        billingCurrency: 'USD',
        merchant: { name: 'Store', mcc: '5411', country: 'US' },
        transactedAt: new Date(),
      })

      expect((await callStart(owner.session, owner.project.id)).status).toBe(200)
      resetEventPublisher()

      const res = await callComplete(owner.session, owner.project.id, {
        confirmCloseCards: true,
        confirmArchive: true,
      })
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, closureContracts.complete.output)
      expect(body.projectStatus).toBe(ProjectStatus.ARCHIVED)
      expect(body.resumable).toBe(false)
      expect(body.currentStep).toBe(ClosureStep.ARCHIVE)
      for (const step of [
        ClosureStep.CLOSE_CARDS,
        ClosureStep.FINAL_REPORT,
        ClosureStep.ARCHIVE,
      ] as const) {
        expect(body.steps.find((s) => s.step === step)?.status).toBe(ClosureStepStatus.DONE)
      }

      const closedCard = await findCardById(owner.ctx, card.id)
      expect(closedCard?.status).toBe(CardStatus.CLOSED)

      const project = await projectsRepo.findProjectById(owner.ctx, owner.project.id)
      expect(project?.status).toBe(ProjectStatus.ARCHIVED)
      expect(project?.closedAt).not.toBeNull()

      expect(
        getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSED),
      ).toHaveLength(1)
      expect(
        getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_ARCHIVED),
      ).toHaveLength(1)

      const finalRes = await callFinalReport(owner.session, owner.project.id)
      expect(finalRes.status).toBe(200)
      const report = await expectMatchesContract(finalRes, reportContracts.final.output)
      const entries = await findEntriesByProject(owner.ctx, owner.project.id)
      const projected = projectBudget(entries)
      expect(report.approved).toBe(projected.approved)
      expect(report.actual).toBe(projected.actual)
      expect(report.committed).toBe(projected.committed)
      expect(report.remaining).toBe(projected.remaining)
      expect(report.transactionCount).toBe(1)
      expect(report.closedAt).toBeTruthy()
      expect(report.archivedAt).toBeTruthy()

      const audits = await AuditLogModel.find({
        orgId: owner.org.id,
        action: 'project.closure_completed',
        subjectId: owner.project.id,
      }).exec()
      expect(audits).toHaveLength(1)
    })

    it('#8 unknown project → 404', async () => {
      const owner = await seedActiveProject()
      expect(
        (
          await callComplete(owner.session, '507f1f77bcf86cd799439099', {
            confirmCloseCards: true,
            confirmArchive: true,
          })
        ).status,
      ).toBe(404)
    })

    it('#9 N/A — no idempotency key; resume when ARCHIVED covered below', () => {
      expect(true).toBe(true)
    })

    it('#10 exactly one audit entry (project.closure_completed)', async () => {
      const owner = await seedActiveProject()
      expect((await callStart(owner.session, owner.project.id)).status).toBe(200)
      const before = await AuditLogModel.countDocuments({
        orgId: owner.org.id,
        action: 'project.closure_completed',
      }).exec()
      const res = await callComplete(owner.session, owner.project.id, {
        confirmCloseCards: true,
        confirmArchive: true,
      })
      expect(res.status).toBe(200)
      const after = await AuditLogModel.countDocuments({
        orgId: owner.org.id,
        action: 'project.closure_completed',
        subjectId: owner.project.id,
      }).exec()
      expect(after - before).toBe(1)
      const entry = await AuditLogModel.findOne({
        orgId: owner.org.id,
        action: 'project.closure_completed',
        subjectId: owner.project.id,
      })
        .lean()
        .exec()
      expect(entry).not.toBeNull()
      expect(entry!.actorId).toBe(owner.user.id)
    })

    it('resume skips DONE steps; second complete is idempotent', async () => {
      const owner = await seedActiveProject()
      const card = await createCard(owner.ctx, {
        projectId: owner.project.id,
        cardholderId: '507f1f77bcf86cd799439011',
        airwallexCardId: 'card_fixture_001',
        maskedNumber: '****3333',
        nickName: 'Resume',
        purpose: CardPurpose.SHARED,
        status: CardStatus.PENDING,
        desiredControls: makeCardControls(),
        appliedControls: makeCardControls(),
      })
      expect((await callStart(owner.session, owner.project.id)).status).toBe(200)

      const first = await callComplete(owner.session, owner.project.id, {
        confirmCloseCards: true,
        confirmArchive: true,
      })
      expect(first.status).toBe(200)
      expect((await findCardById(owner.ctx, card.id))?.status).toBe(CardStatus.CLOSED)

      resetEventPublisher()
      const second = await callComplete(owner.session, owner.project.id, {
        confirmCloseCards: true,
        confirmArchive: true,
      })
      expect(second.status).toBe(200)
      const body = await expectMatchesContract(second, closureContracts.complete.output)
      expect(body.projectStatus).toBe(ProjectStatus.ARCHIVED)

      // No re-emit on idempotent resume.
      expect(
        getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSED),
      ).toHaveLength(0)
      expect(
        getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_ARCHIVED),
      ).toHaveLength(0)

      const audits = await AuditLogModel.find({
        orgId: owner.org.id,
        action: 'project.closure_completed',
        subjectId: owner.project.id,
      }).exec()
      expect(audits).toHaveLength(1)
    })

    it('ARCHIVED project rejects PATCH', async () => {
      const owner = await seedActiveProject()
      expect((await callStart(owner.session, owner.project.id)).status).toBe(200)
      expect(
        (
          await callComplete(owner.session, owner.project.id, {
            confirmCloseCards: true,
            confirmArchive: true,
          })
        ).status,
      ).toBe(200)

      const patch = await patchProject(
        buildRequest({
          method: 'PATCH',
          path: `/api/projects/${owner.project.id}`,
          session: owner.session,
          params: { id: owner.project.id },
          body: { name: 'Nope' },
        }),
      )
      expect(patch.status).toBe(409)
      expect((await readBody<{ error: { code: string } }>(patch)).error.code).toBe(
        ErrorCode.CONFLICT,
      )
    })

    it('CLEARING after card CLOSED still records', async () => {
      const owner = await seedActiveProject()
      const card = await createCard(owner.ctx, {
        projectId: owner.project.id,
        cardholderId: '507f1f77bcf86cd799439011',
        airwallexCardId: 'card_fixture_001',
        maskedNumber: '****4444',
        nickName: 'Post-close',
        purpose: CardPurpose.SHARED,
        status: CardStatus.PENDING,
        desiredControls: makeCardControls(),
        appliedControls: makeCardControls(),
      })
      expect((await callStart(owner.session, owner.project.id)).status).toBe(200)
      expect(
        (
          await callComplete(owner.session, owner.project.id, {
            confirmCloseCards: true,
            confirmArchive: true,
          })
        ).status,
      ).toBe(200)
      expect((await findCardById(owner.ctx, card.id))?.status).toBe(CardStatus.CLOSED)

      const clearing = await createTransaction(owner.ctx, {
        cardId: card.id,
        projectId: owner.project.id,
        airwallexTransactionId: `awx-post-${Date.now()}`,
        cardTransactionId: `ct-post-${Date.now()}`,
        lifecycleId: `life-post-${Date.now()}`,
        type: TransactionType.CLEARING,
        status: TransactionStatus.CLEARED,
        amount: 1500,
        currency: 'USD',
        billingAmount: 1500,
        billingCurrency: 'USD',
        merchant: { name: 'Late clear', mcc: '5411', country: 'US' },
        transactedAt: new Date(),
      })
      expect(clearing.id).toBeTruthy()
      expect(clearing.status).toBe(TransactionStatus.CLEARED)

      const listed = await listCards(owner.ctx, { projectId: owner.project.id, pageSize: 10 })
      expect(listed.items.every((c) => c.status === CardStatus.CLOSED)).toBe(true)
    })

    it('SETTLE BLOCKED rejects complete', async () => {
      const owner = await seedActiveProject()
      expect((await callStart(owner.session, owner.project.id)).status).toBe(200)

      await createTransaction(owner.ctx, {
        cardId: '507f1f77bcf86cd799439011',
        projectId: owner.project.id,
        airwallexTransactionId: `awx-block-${Date.now()}`,
        cardTransactionId: `ct-block-${Date.now()}`,
        lifecycleId: `life-block-${Date.now()}`,
        type: TransactionType.AUTHORIZATION,
        status: TransactionStatus.AUTHORIZED,
        amount: 1000,
        currency: 'USD',
        billingAmount: 1000,
        billingCurrency: 'USD',
        merchant: { name: 'Pending', mcc: '5411', country: 'US' },
        transactedAt: new Date(),
      })

      const res = await callComplete(owner.session, owner.project.id, {
        confirmCloseCards: true,
        confirmArchive: true,
      })
      expect(res.status).toBe(409)
      const project = await projectsRepo.findProjectById(owner.ctx, owner.project.id)
      expect(project?.status).toBe(ProjectStatus.CLOSING)
      const closure = await findClosureByProject(owner.ctx, owner.project.id)
      expect(closure?.steps.find((s) => s.step === ClosureStep.SETTLE)?.status).toBe(
        ClosureStepStatus.BLOCKED,
      )
    })
  })

  describe('GET /api/projects/:id/report/final', () => {
    it('#1 unauthenticated → 401', async () => {
      const owner = await seedActiveProject()
      expect((await callFinalReport(null, owner.project.id)).status).toBe(401)
    })

    it('#2 no organisation → 403 ONBOARDING_INCOMPLETE', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `solo-fr-${Date.now()}@example.com`,
        name: 'Solo',
      })
      const res = await getFinalReport(
        buildRequest({
          method: 'GET',
          path: '/api/projects/507f1f77bcf86cd799439011/report/final',
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
      await archiveProject(a)
      const b = await seedActiveProject()
      expect((await callFinalReport(b.session, a.project.id)).status).toBe(404)
    })

    it('#4 lacks project.view → 403', async () => {
      const owner = await seedActiveProject()
      await archiveProject(owner)
      const member = await addOrgMember(owner.org.id)
      const res = await callFinalReport(member.session, owner.project.id)
      expect(res.status).toBe(403)
      expect(
        (await readBody<{ error: { details?: { permission?: string } } }>(res)).error.details,
      ).toMatchObject({ permission: Permission.PROJECT_VIEW })
    })

    it('#5 access scope excludes subject → 403', async () => {
      const owner = await seedActiveProject()
      await archiveProject(owner)
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'viewer', {
        level: AccessScopeLevel.WORKSTREAM,
        workstreamIds: ['507f1f77bcf86cd799439011'],
      })
      const res = await callFinalReport(member.session, owner.project.id)
      expect(res.status).toBe(403)
    })

    it('#6 N/A — GET has no payload', () => {
      expect(true).toBe(true)
    })

    it('#7 happy path — final report contract; totals match ledger', async () => {
      const owner = await seedActiveProject()
      await upsertBudgetFields(owner.ctx, owner.project.id, {
        currency: 'USD',
        approvedAmount: 50_000,
      })
      await appendEntry(owner.ctx, {
        projectId: owner.project.id,
        type: BudgetEntryType.APPROVAL,
        amount: 50_000,
        currency: 'USD',
        sourceType: BudgetEntrySourceType.MANUAL,
        sourceId: `fr-approved-${Date.now()}`,
        createdBy: owner.user.id,
      })
      await appendEntry(owner.ctx, {
        projectId: owner.project.id,
        type: BudgetEntryType.ACTUAL,
        amount: 10_000,
        currency: 'USD',
        sourceType: BudgetEntrySourceType.TRANSACTION,
        sourceId: `fr-actual-${Date.now()}`,
        lifecycleId: `life-fr-${Date.now()}`,
        createdBy: 'system',
      })
      await archiveProject(owner)

      const res = await callFinalReport(owner.session, owner.project.id)
      expect(res.status).toBe(200)
      const report = await expectMatchesContract(res, reportContracts.final.output)
      const entries = await findEntriesByProject(owner.ctx, owner.project.id)
      const projected = projectBudget(entries)
      expect(report.approved).toBe(projected.approved)
      expect(report.actual).toBe(projected.actual)
      expect(report.closedAt).toBeTruthy()
      expect(report.archivedAt).toBeTruthy()
    })

    it('#8 unknown project / no snapshot → 404', async () => {
      const owner = await seedActiveProject()
      expect((await callFinalReport(owner.session, '507f1f77bcf86cd799439099')).status).toBe(404)
      // ACTIVE without closure snapshot
      expect((await callFinalReport(owner.session, owner.project.id)).status).toBe(404)
    })

    it('#9 N/A — GET has no idempotency key', () => {
      expect(true).toBe(true)
    })

    it('#10 N/A — GET does not write audit', async () => {
      const owner = await seedActiveProject()
      await archiveProject(owner)
      const before = await AuditLogModel.countDocuments({ orgId: owner.ctx.orgId }).exec()
      const res = await callFinalReport(owner.session, owner.project.id)
      expect(res.status).toBe(200)
      const after = await AuditLogModel.countDocuments({ orgId: owner.ctx.orgId }).exec()
      expect(after).toBe(before)
    })
  })
})
