/**
 * B9.10 — project.closing | project.closed | project.archived emit once per successful path.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
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

describe('events/b9', () => {
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

  async function seedActiveProject() {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `ev9-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'EV9 Org',
      slug: `ev9-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'EV9 Project',
      code: `EV9-${Date.now().toString(16)}`,
    })
    await projectsRepo.updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ACTIVE, {
      approvedAt: new Date(),
      launchedAt: new Date(),
    })
    await upsertBudgetFields(ctx, project.id, {
      currency: 'USD',
      approvedAmount: 50_000,
    })
    await appendEntry(ctx, {
      projectId: project.id,
      type: BudgetEntryType.APPROVAL,
      amount: 50_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: `approved-ev9-${Date.now()}`,
      createdBy: user.id,
    })
    await createCard(ctx, {
      projectId: project.id,
      cardholderId: '507f1f77bcf86cd799439011',
      airwallexCardId: 'card_fixture_001',
      maskedNumber: '****9999',
      nickName: 'EV9 Card',
      purpose: CardPurpose.SHARED,
      status: CardStatus.PENDING,
      desiredControls: makeCardControls(),
      appliedControls: makeCardControls(),
    })
    return {
      ctx,
      project: (await projectsRepo.findProjectById(ctx, project.id))!,
    }
  }

  it('emits project.closing exactly once on successful start', async () => {
    const { ctx, project } = await seedActiveProject()
    resetEventPublisher()

    await startClosure(ctx, project.id)

    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSING)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      orgId: ctx.orgId,
      projectId: project.id,
      subjectType: 'project',
      subjectId: project.id,
    })
  })

  it('does not re-emit project.closing on start resume', async () => {
    const { ctx, project } = await seedActiveProject()
    await startClosure(ctx, project.id)
    resetEventPublisher()

    await startClosure(ctx, project.id)

    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSING),
    ).toHaveLength(0)
  })

  it('emits project.closed and project.archived once on successful complete', async () => {
    const { ctx, project } = await seedActiveProject()
    await startClosure(ctx, project.id)
    resetEventPublisher()

    await completeClosure(ctx, project.id, {
      confirmCloseCards: true,
      confirmArchive: true,
    })

    const closed = getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSED)
    const archived = getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_ARCHIVED)
    expect(closed).toHaveLength(1)
    expect(archived).toHaveLength(1)
    expect(closed[0]).toMatchObject({
      orgId: ctx.orgId,
      projectId: project.id,
      subjectId: project.id,
    })
    expect(archived[0]).toMatchObject({
      orgId: ctx.orgId,
      projectId: project.id,
      subjectId: project.id,
    })
  })

  it('does not re-emit closed/archived on complete resume', async () => {
    const { ctx, project } = await seedActiveProject()
    await startClosure(ctx, project.id)
    await completeClosure(ctx, project.id, {
      confirmCloseCards: true,
      confirmArchive: true,
    })
    resetEventPublisher()

    await completeClosure(ctx, project.id, {
      confirmCloseCards: true,
      confirmArchive: true,
    })

    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSED),
    ).toHaveLength(0)
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_ARCHIVED),
    ).toHaveLength(0)
  })

  it('full path emits closing, closed, archived once each', async () => {
    const { ctx, project } = await seedActiveProject()
    resetEventPublisher()

    await startClosure(ctx, project.id)
    await completeClosure(ctx, project.id, {
      confirmCloseCards: true,
      confirmArchive: true,
    })

    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSING),
    ).toHaveLength(1)
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_CLOSED),
    ).toHaveLength(1)
    expect(
      getPublishedEvents().filter((e) => e.type === DomainEventType.PROJECT_ARCHIVED),
    ).toHaveLength(1)
  })
})
