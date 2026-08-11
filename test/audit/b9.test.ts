/**
 * B9.10 — audit: closure start/complete, each export kind, final report generation.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as EXPORT_AUDIT } from '@/app/api/exports/audit/route'
import { POST as EXPORT_BUDGET } from '@/app/api/exports/budget/route'
import { POST as EXPORT_CARDS } from '@/app/api/exports/cards/route'
import { POST as EXPORT_TRANSACTIONS } from '@/app/api/exports/transactions/route'
import { resetEventPublisher } from '@/server/events/bus'
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
import { appendEntry } from '@/server/repositories/budgetEntries'
import { upsertBudgetFields } from '@/server/repositories/budgets'
import { createCard } from '@/server/repositories/cards'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import { resetRedis } from '@/server/redis'
import { completeClosure } from '@/server/services/closure/complete'
import { startClosure } from '@/server/services/closure/start'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { makeCardControls } from '../helpers/factories'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver } from '../helpers/request'

type ExportHandler = (req: Request) => Promise<Response>

const EXPORT_KINDS: Array<{
  name: string
  path: string
  handler: ExportHandler
  action: string
}> = [
  { name: 'budget', path: '/api/exports/budget', handler: EXPORT_BUDGET, action: 'export.budget' },
  {
    name: 'transactions',
    path: '/api/exports/transactions',
    handler: EXPORT_TRANSACTIONS,
    action: 'export.transactions',
  },
  { name: 'cards', path: '/api/exports/cards', handler: EXPORT_CARDS, action: 'export.cards' },
  { name: 'audit', path: '/api/exports/audit', handler: EXPORT_AUDIT, action: 'export.audit' },
]

describe('audit/b9', () => {
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
    installTestSessionResolver()
    resetEventPublisher()
    resetRedis()
    vi.restoreAllMocks()
  })

  async function seedOwner() {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `aud9-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Aud9 Org',
      slug: `aud9-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Aud9 Project',
      code: `A9-${Date.now().toString(16)}`,
    })
    await projectsRepo.updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ACTIVE, {
      approvedAt: new Date(),
      launchedAt: new Date(),
    })
    await upsertBudgetFields(ctx, project.id, {
      currency: 'USD',
      approvedAmount: 80_000,
    })
    await appendEntry(ctx, {
      projectId: project.id,
      type: BudgetEntryType.APPROVAL,
      amount: 80_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: `approved-aud9-${Date.now()}`,
      createdBy: user.id,
    })
    await createCard(ctx, {
      projectId: project.id,
      cardholderId: '507f1f77bcf86cd799439011',
      airwallexCardId: 'card_fixture_001',
      maskedNumber: '****8888',
      nickName: 'Aud9 Card',
      purpose: CardPurpose.SHARED,
      status: CardStatus.PENDING,
      desiredControls: makeCardControls(),
      appliedControls: makeCardControls(),
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

  async function consumeExport(res: Response): Promise<void> {
    expect(res.status).toBe(200)
    const reader = res.body?.getReader()
    if (!reader) return
    while (true) {
      const { done } = await reader.read()
      if (done) break
    }
  }

  it('audits closure start (exactly one project.closure_started)', async () => {
    const owner = await seedOwner()
    await startClosure(owner.ctx, owner.project.id)

    const audits = await AuditLogModel.find({
      orgId: owner.org.id,
      action: 'project.closure_started',
      subjectId: owner.project.id,
    }).exec()
    expect(audits).toHaveLength(1)
    expect(audits[0]!.actorId).toBe(owner.user.id)
  })

  it('audits final report generation and closure complete', async () => {
    const owner = await seedOwner()
    await startClosure(owner.ctx, owner.project.id)
    await completeClosure(owner.ctx, owner.project.id, {
      confirmCloseCards: true,
      confirmArchive: true,
    })

    const finalReportAudits = await AuditLogModel.find({
      orgId: owner.org.id,
      action: 'report.final_generated',
      subjectId: owner.project.id,
    }).exec()
    expect(finalReportAudits).toHaveLength(1)
    expect(finalReportAudits[0]!.actorId).toBe(owner.user.id)
    expect(finalReportAudits[0]!.after).toMatchObject({
      approved: 80_000,
      remaining: 80_000,
    })

    const completeAudits = await AuditLogModel.find({
      orgId: owner.org.id,
      action: 'project.closure_completed',
      subjectId: owner.project.id,
    }).exec()
    expect(completeAudits).toHaveLength(1)
    expect(completeAudits[0]!.actorId).toBe(owner.user.id)
  })

  it('does not re-audit final report or complete on resume', async () => {
    const owner = await seedOwner()
    await startClosure(owner.ctx, owner.project.id)
    await completeClosure(owner.ctx, owner.project.id, {
      confirmCloseCards: true,
      confirmArchive: true,
    })
    await completeClosure(owner.ctx, owner.project.id, {
      confirmCloseCards: true,
      confirmArchive: true,
    })

    expect(
      await AuditLogModel.countDocuments({
        orgId: owner.org.id,
        action: 'report.final_generated',
        subjectId: owner.project.id,
      }),
    ).toBe(1)
    expect(
      await AuditLogModel.countDocuments({
        orgId: owner.org.id,
        action: 'project.closure_completed',
        subjectId: owner.project.id,
      }),
    ).toBe(1)
  })

  it.each(EXPORT_KINDS)(
    'audits export.$name (exactly one $action)',
    async ({ path, handler, action }) => {
      const owner = await seedOwner()
      const res = await handler(
        buildRequest({
          method: 'POST',
          path,
          session: owner.session,
          body: { projectId: owner.project.id },
        }),
      )
      await consumeExport(res)

      const audits = await AuditLogModel.find({
        orgId: owner.org.id,
        action,
      }).exec()
      expect(audits).toHaveLength(1)
      expect(audits[0]!.actorId).toBe(owner.user.id)
    },
  )
})
