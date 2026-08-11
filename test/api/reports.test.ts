/**
 * B9.4 — Project + organization reports.
 * Totals reconcile with budget projection; matrix rows that apply.
 *
 * Notes: member/category actuals join ACTUAL ledger → transactions(lifecycleId)
 * → card → cardholder.userId / categoryId.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as GET_ORG } from '@/app/api/reports/organization/route'
import { GET as GET_PROJECT } from '@/app/api/reports/project/[id]/route'
import { resetEventPublisher } from '@/server/events/bus'
import type { OrgContext } from '@/server/http/types'
import { AuditLogModel } from '@/server/models/AuditLog'
import { BudgetEntryModel } from '@/server/models/BudgetEntry'
import { BudgetModel } from '@/server/models/Budget'
import { CardModel } from '@/server/models/Card'
import { CardholderModel } from '@/server/models/Cardholder'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
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
import { appendEntry, findEntriesByProject } from '@/server/repositories/budgetEntries'
import { addCategory, upsertBudgetFields } from '@/server/repositories/budgets'
import { createCard } from '@/server/repositories/cards'
import { createCardholder } from '@/server/repositories/cardholders'
import { createTransaction } from '@/server/repositories/transactions'
import { getProjectBudget } from '@/server/services/budget/get'
import { projectBudget } from '@/server/services/budget/projectProjection'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { resetRedis } from '@/server/redis'
import { reportContracts } from '@/shared/contracts/report'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { makeCardControls } from '../helpers/factories'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('B9.4 project + organization reports', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      RoleModel.syncIndexes(),
      ProjectMemberModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
      BudgetModel.syncIndexes(),
      BudgetEntryModel.syncIndexes(),
      TransactionModel.syncIndexes(),
      CardModel.syncIndexes(),
      CardholderModel.syncIndexes(),
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
      email: `rpt-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Report Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Report Project',
      code: `RPT-${Date.now().toString(16)}`,
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
    projectId = owner.project.id,
    scope: { level: AccessScopeLevel; workstreamIds?: string[] } = {
      level: AccessScopeLevel.PROJECT,
    },
  ) {
    const role = await rolesRepo.findRoleByKey(owner.ctx, roleKey)
    expect(role).not.toBeNull()
    await projectMembers.addProjectMember(owner.ctx, {
      projectId,
      userId,
      roleId: role!.id,
      scope,
      effectivePermissions: role!.permissions,
      addedBy: owner.user.id,
    })
    return role!
  }

  async function seedBudgetWithSpend(
    owner: Awaited<ReturnType<typeof seedOwner>>,
    opts: {
      approved?: number
      currency?: string
      categoryAllocated?: number
      actual?: number
      memberUserId?: string
    } = {},
  ) {
    const currency = opts.currency ?? 'USD'
    const approved = opts.approved ?? 100_000
    const actual = opts.actual ?? 25_000

    await upsertBudgetFields(owner.ctx, owner.project.id, {
      currency,
      approvedAmount: approved,
    })
    await appendEntry(owner.ctx, {
      projectId: owner.project.id,
      type: BudgetEntryType.APPROVAL,
      amount: approved,
      currency,
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'seed-approval',
      createdBy: owner.user.id,
    })

    const category = await addCategory(owner.ctx, owner.project.id, {
      name: 'Media',
      allocated: opts.categoryAllocated ?? 40_000,
    })
    expect(category).not.toBeNull()

    const memberUserId = opts.memberUserId ?? owner.user.id
    const cardholder = await createCardholder(owner.ctx, {
      userId: memberUserId,
      airwallexCardholderId: `awx-ch-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.READY,
    })
    const controls = makeCardControls()
    const card = await createCard(owner.ctx, {
      projectId: owner.project.id,
      categoryId: category!.id,
      cardholderId: cardholder.id,
      airwallexCardId: `awx-card-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      maskedNumber: '************4242',
      nickName: 'Spend',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.ACTIVE,
      desiredControls: controls,
      appliedControls: controls,
    })

    const lifecycleId = `lc-${Date.now()}-${Math.random().toString(16).slice(2)}`
    const tx = await createTransaction(owner.ctx, {
      cardId: card.id,
      projectId: owner.project.id,
      airwallexTransactionId: `awx-tx-${lifecycleId}`,
      cardTransactionId: `ct-${lifecycleId}`,
      lifecycleId,
      type: TransactionType.CLEARING,
      status: TransactionStatus.CLEARED,
      amount: actual,
      currency,
      billingAmount: actual,
      billingCurrency: currency,
      merchant: { name: 'Vendor', mcc: '5812', country: 'US' },
      transactedAt: new Date('2026-06-01T12:00:00.000Z'),
    })

    await appendEntry(owner.ctx, {
      projectId: owner.project.id,
      type: BudgetEntryType.ACTUAL,
      amount: actual,
      currency,
      sourceType: BudgetEntrySourceType.TRANSACTION,
      sourceId: tx.id,
      lifecycleId,
      createdBy: 'system',
      // category via card join (omit categoryId on ledger — mirrors webhook)
    })

    return { category: category!, card, cardholder, lifecycleId, actual, approved, currency }
  }

  describe('GET /api/reports/project/:id', () => {
    it('#1 unauthenticated → 401', async () => {
      const owner = await seedOwner()
      const res = await GET_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/reports/project/${owner.project.id}`,
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
      const res = await GET_PROJECT(
        buildRequest({
          method: 'GET',
          path: '/api/reports/project/507f1f77bcf86cd799439011',
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
      const res = await GET_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/reports/project/${b.project.id}`,
          session: a.session,
          params: { id: b.project.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('#4 lacks report.export → 403', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'approver')
      const res = await GET_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/reports/project/${owner.project.id}`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(403)
      expect(
        (await readBody<{ error: { code: string; message: string } }>(res)).error.message,
      ).toContain(Permission.REPORT_EXPORT)
    })

    it('#5 access scope excludes subject → 403', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'viewer', owner.project.id, {
        level: AccessScopeLevel.WORKSTREAM,
        workstreamIds: ['507f1f77bcf86cd799439011'],
      })
      const res = await GET_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/reports/project/${owner.project.id}`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(403)
    })

    it('#6 N/A — GET has no payload', () => {
      expect(true).toBe(true)
    })

    it('#7 happy path — totals reconcile with projection; byCategory/byMember', async () => {
      const owner = await seedOwner()
      const seeded = await seedBudgetWithSpend(owner, { approved: 100_000, actual: 25_000 })

      const res = await GET_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/reports/project/${owner.project.id}`,
          session: owner.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, reportContracts.project.output)

      const entries = await findEntriesByProject(owner.ctx, owner.project.id)
      const expected = projectBudget(entries)
      const budgetDetail = await getProjectBudget(owner.ctx, owner.project.id)

      expect(body.projectId).toBe(owner.project.id)
      expect(body.currency).toBe('USD')
      expect(body.approved).toBe(expected.approved)
      expect(body.committed).toBe(expected.committed)
      expect(body.actual).toBe(expected.actual)
      expect(body.remaining).toBe(expected.remaining)
      expect(body.utilisationPct).toBe(expected.utilisationPct)
      expect(body.approved).toBe(budgetDetail.projection.approved)
      expect(body.actual).toBe(budgetDetail.projection.actual)

      expect(body.byCategory).toEqual([
        {
          categoryId: seeded.category.id,
          name: 'Media',
          allocated: 40_000,
          actual: 25_000,
        },
      ])
      expect(body.byMember).toEqual([{ userId: owner.user.id, actual: 25_000 }])
    })

    it('#8 unknown project → 404', async () => {
      const owner = await seedOwner()
      const res = await GET_PROJECT(
        buildRequest({
          method: 'GET',
          path: '/api/reports/project/507f1f77bcf86cd799439099',
          session: owner.session,
          params: { id: '507f1f77bcf86cd799439099' },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('#9 N/A — GET has no idempotency key', () => {
      expect(true).toBe(true)
    })

    it('#10 N/A — GET does not write audit', async () => {
      const owner = await seedOwner()
      const before = await AuditLogModel.countDocuments({ orgId: owner.ctx.orgId }).exec()
      const res = await GET_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/reports/project/${owner.project.id}`,
          session: owner.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(200)
      const after = await AuditLogModel.countDocuments({ orgId: owner.ctx.orgId }).exec()
      expect(after).toBe(before)
    })
  })

  describe('GET /api/reports/organization', () => {
    it('#1 unauthenticated → 401', async () => {
      const res = await GET_ORG(
        buildRequest({
          method: 'GET',
          path: '/api/reports/organization',
          session: null,
        }),
      )
      expect(res.status).toBe(401)
    })

    it('#2 no organisation → 403 ONBOARDING_INCOMPLETE', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `solo-org-${Date.now()}@example.com`,
        name: 'Solo',
      })
      const res = await GET_ORG(
        buildRequest({
          method: 'GET',
          path: '/api/reports/organization',
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

    it('#4 lacks report.export → 403', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'approver')
      const res = await GET_ORG(
        buildRequest({
          method: 'GET',
          path: '/api/reports/organization',
          session: member.session,
        }),
      )
      expect(res.status).toBe(403)
      expect(
        (await readBody<{ error: { code: string; message: string } }>(res)).error.message,
      ).toContain(Permission.REPORT_EXPORT)
    })

    it('#5 access scope excludes subject → 403', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'viewer', owner.project.id, {
        level: AccessScopeLevel.WORKSTREAM,
        workstreamIds: ['507f1f77bcf86cd799439011'],
      })
      const res = await GET_ORG(
        buildRequest({
          method: 'GET',
          path: '/api/reports/organization',
          session: member.session,
        }),
      )
      expect(res.status).toBe(403)
    })

    it('#6 N/A — GET has no payload', () => {
      expect(true).toBe(true)
    })

    it('#7 happy path — rollup; mixed-currency excluded from totals', async () => {
      const owner = await seedOwner()
      await seedBudgetWithSpend(owner, { approved: 100_000, actual: 20_000, currency: 'USD' })

      const eurProject = await projectsRepo.createProject(owner.ctx, {
        name: 'EUR Project',
        code: `EUR-${Date.now().toString(16)}`,
      })
      await upsertBudgetFields(owner.ctx, eurProject.id, {
        currency: 'EUR',
        approvedAmount: 50_000,
      })
      await appendEntry(owner.ctx, {
        projectId: eurProject.id,
        type: BudgetEntryType.APPROVAL,
        amount: 50_000,
        currency: 'EUR',
        sourceType: BudgetEntrySourceType.MANUAL,
        sourceId: 'eur-approval',
        createdBy: owner.user.id,
      })
      await appendEntry(owner.ctx, {
        projectId: eurProject.id,
        type: BudgetEntryType.ACTUAL,
        amount: 5_000,
        currency: 'EUR',
        sourceType: BudgetEntrySourceType.MANUAL,
        sourceId: 'eur-actual',
        createdBy: owner.user.id,
      })

      const res = await GET_ORG(
        buildRequest({
          method: 'GET',
          path: '/api/reports/organization',
          session: owner.session,
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, reportContracts.organization.output)

      expect(body.currency).toBe('USD')
      expect(body.projects.length).toBeGreaterThanOrEqual(2)
      const usdRow = body.projects.find((p) => p.projectId === owner.project.id)
      const eurRow = body.projects.find((p) => p.projectId === eurProject.id)
      expect(usdRow).toMatchObject({ approved: 100_000, actual: 20_000 })
      expect(eurRow).toMatchObject({ approved: 50_000, actual: 5_000 })

      // EUR excluded from single-currency totals
      expect(body.totals.approved).toBe(100_000)
      expect(body.totals.actual).toBe(20_000)
      expect(body.totals.remaining).toBe(usdRow!.remaining)
    })

    it('#8 N/A — org report has no resource id', () => {
      expect(true).toBe(true)
    })

    it('#9 N/A — GET has no idempotency key', () => {
      expect(true).toBe(true)
    })

    it('#10 N/A — GET does not write audit', async () => {
      const owner = await seedOwner()
      const before = await AuditLogModel.countDocuments({ orgId: owner.ctx.orgId }).exec()
      const res = await GET_ORG(
        buildRequest({
          method: 'GET',
          path: '/api/reports/organization',
          session: owner.session,
        }),
      )
      expect(res.status).toBe(200)
      const after = await AuditLogModel.countDocuments({ orgId: owner.ctx.orgId }).exec()
      expect(after).toBe(before)
    })

    it('MEMBER with report.export sees only granting projects', async () => {
      const owner = await seedOwner()
      await seedBudgetWithSpend(owner, { approved: 10_000, actual: 1_000 })

      const other = await projectsRepo.createProject(owner.ctx, {
        name: 'Other',
        code: `OTH-${Date.now().toString(16)}`,
      })
      await upsertBudgetFields(owner.ctx, other.id, {
        currency: 'USD',
        approvedAmount: 99_000,
      })
      await appendEntry(owner.ctx, {
        projectId: other.id,
        type: BudgetEntryType.APPROVAL,
        amount: 99_000,
        currency: 'USD',
        sourceType: BudgetEntrySourceType.MANUAL,
        sourceId: 'other-approval',
        createdBy: owner.user.id,
      })

      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'viewer', owner.project.id)

      const res = await GET_ORG(
        buildRequest({
          method: 'GET',
          path: '/api/reports/organization',
          session: member.session,
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, reportContracts.organization.output)
      expect(body.projects.map((p) => p.projectId)).toEqual([owner.project.id])
      expect(body.totals.approved).toBe(10_000)
    })
  })
})
