/**
 * B9.10 — after full closure, verifyBudgets() and final report totals match ledger.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { verifyBudgets } from '../scripts/budget-verify'
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
import { appendBudgetEntry } from '@/server/services/budget/ledger'
import { findEntriesByProject } from '@/server/repositories/budgetEntries'
import { upsertBudgetFields } from '@/server/repositories/budgets'
import { createCard } from '@/server/repositories/cards'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import { findByProject as findClosureByProject } from '@/server/repositories/projectClosures'
import * as projectsRepo from '@/server/repositories/projects'
import { createTransaction } from '@/server/repositories/transactions'
import { resetRedis } from '@/server/redis'
import { projectBudget } from '@/server/services/budget/projectProjection'
import { completeClosure, getFinalReport } from '@/server/services/closure/complete'
import { startClosure } from '@/server/services/closure/start'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { makeCardControls } from './helpers/factories'
import { useTestDb } from './helpers/db'

describe('closure-reconcile', () => {
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
    resetEventPublisher()
    resetRedis()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    resetEventPublisher()
    resetRedis()
    vi.restoreAllMocks()
  })

  async function seedClosableProject() {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `rec-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Reconcile Org',
      slug: `rec-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Reconcile Project',
      code: `REC-${Date.now().toString(16)}`,
    })
    await projectsRepo.updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ACTIVE, {
      approvedAt: new Date(),
      launchedAt: new Date(),
    })

    await upsertBudgetFields(ctx, project.id, {
      currency: 'USD',
      approvedAmount: 200_000,
    })
    await appendBudgetEntry(ctx, project.id, {
      type: BudgetEntryType.APPROVAL,
      amount: 200_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: `approved-rec-${Date.now()}`,
      createdBy: user.id,
    })
    const lifecycleId = `lc-rec-clear-${Date.now()}`
    await appendBudgetEntry(ctx, project.id, {
      type: BudgetEntryType.COMMITMENT,
      amount: 40_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.TRANSACTION,
      sourceId: `tx-auth-rec-${Date.now()}`,
      lifecycleId,
      createdBy: user.id,
    })
    await appendBudgetEntry(ctx, project.id, {
      type: BudgetEntryType.RELEASE,
      amount: -40_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.TRANSACTION,
      sourceId: `tx-clear-rec-${Date.now()}`,
      lifecycleId,
      createdBy: user.id,
    })
    await appendBudgetEntry(ctx, project.id, {
      type: BudgetEntryType.ACTUAL,
      amount: 40_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.TRANSACTION,
      sourceId: `tx-clear-rec-actual-${Date.now()}`,
      lifecycleId,
      createdBy: 'system',
    })

    const card = await createCard(ctx, {
      projectId: project.id,
      cardholderId: '507f1f77bcf86cd799439011',
      airwallexCardId: 'card_fixture_001',
      maskedNumber: '****7777',
      nickName: 'Reconcile Card',
      purpose: CardPurpose.SHARED,
      status: CardStatus.PENDING,
      desiredControls: makeCardControls(),
      appliedControls: makeCardControls(),
    })
    await createTransaction(ctx, {
      cardId: card.id,
      projectId: project.id,
      airwallexTransactionId: `awx-rec-${Date.now()}`,
      cardTransactionId: `ct-rec-${Date.now()}`,
      lifecycleId,
      type: TransactionType.CLEARING,
      status: TransactionStatus.CLEARED,
      amount: 40_000,
      currency: 'USD',
      billingAmount: 40_000,
      billingCurrency: 'USD',
      merchant: { name: 'Reconcile Vendor', mcc: '5411', country: 'US' },
      transactedAt: new Date(),
    })

    return {
      ctx,
      project: (await projectsRepo.findProjectById(ctx, project.id))!,
    }
  }

  it('verifyBudgets and final report match ledger after full closure', async () => {
    const { ctx, project } = await seedClosableProject()

    await startClosure(ctx, project.id)
    await completeClosure(ctx, project.id, {
      confirmCloseCards: true,
      confirmArchive: true,
    })

    const archived = await projectsRepo.findProjectById(ctx, project.id)
    expect(archived?.status).toBe(ProjectStatus.ARCHIVED)

    const result = await verifyBudgets()
    expect(result.ok).toBe(true)
    expect(result.drifts.filter((d) => d.projectId === project.id)).toEqual([])

    const entries = await findEntriesByProject(ctx, project.id)
    const projected = projectBudget(entries)
    const report = await getFinalReport(ctx, project.id)

    expect(report.approved).toBe(projected.approved)
    expect(report.committed).toBe(projected.committed)
    expect(report.actual).toBe(projected.actual)
    expect(report.remaining).toBe(projected.remaining)
    expect(report.utilisationPct).toBe(projected.utilisationPct)
    expect(report.transactionCount).toBe(1)
    expect(report.closedAt).toBeTruthy()
    expect(report.archivedAt).toBeTruthy()

    const closure = await findClosureByProject(ctx, project.id)
    expect(closure?.finalReportSnapshot).toMatchObject({
      approved: projected.approved,
      actual: projected.actual,
      remaining: projected.remaining,
    })
    expect(closure?.completedAt).toBeTruthy()
  })
})
