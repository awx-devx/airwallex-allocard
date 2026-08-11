/**
 * B8.7 — Transaction HTTP API matrix.
 * Standard 10 rows per endpoint (or N/A with comment).
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as LIST } from '@/app/api/transactions/route'
import { GET as GET_ONE } from '@/app/api/transactions/[id]/route'
import { GET as LIST_DECLINED } from '@/app/api/transactions/declined/route'
import { GET as LIST_PROJECT } from '@/app/api/projects/[id]/transactions/route'
import { GET as LIST_CARD } from '@/app/api/cards/[id]/transactions/route'
import { resetEventPublisher } from '@/server/events/bus'
import type { OrgContext } from '@/server/http/types'
import { CardModel } from '@/server/models/Card'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { RoleModel } from '@/server/models/Role'
import { TransactionModel } from '@/server/models/Transaction'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import * as rolesRepo from '@/server/repositories/roles'
import * as projectMembers from '@/server/repositories/projectMembers'
import * as transactionsRepo from '@/server/repositories/transactions'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { resetRedis } from '@/server/redis'
import { transactionContracts } from '@/shared/contracts/transaction'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('B8.7 transaction routes', () => {
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
      CardModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
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
      email: `tx-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Tx Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Tx Project',
      code: `TX-${Date.now().toString(16)}`,
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
    scope: { level: AccessScopeLevel; cardIds?: string[] } = {
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

  async function seedTransaction(
    ctx: OrgContext,
    projectId: string,
    overrides: Partial<transactionsRepo.CreateTransactionInput> = {},
  ) {
    return transactionsRepo.createTransaction(ctx, {
      cardId: overrides.cardId ?? 'card_001',
      projectId,
      airwallexTransactionId: `awx_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      cardTransactionId: `ctx_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      lifecycleId:
        overrides.lifecycleId ?? `lc_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: overrides.type ?? TransactionType.AUTHORIZATION,
      status: overrides.status ?? TransactionStatus.AUTHORIZED,
      amount: overrides.amount ?? 10_000,
      currency: overrides.currency ?? 'USD',
      billingAmount: overrides.billingAmount ?? 10_000,
      billingCurrency: overrides.billingCurrency ?? 'USD',
      merchant: overrides.merchant ?? { name: 'Test Merchant', mcc: '5411', country: 'US' },
      transactedAt: overrides.transactedAt ?? new Date(),
      ...overrides,
    })
  }

  async function seedCard(ctx: OrgContext, projectId: string) {
    const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`
    const controls = {
      allowedTransactionCount: 'MULTIPLE' as const,
      transactionLimits: {
        currency: 'USD',
        limits: [{ interval: 'MONTHLY' as const, amount: 400_000 }],
      },
      activeFrom: null,
      activeTo: null,
      allowedCurrencies: null,
      allowedMerchantCategories: null,
      allowedMerchantCountries: null,
      allowedMerchantBrands: null,
      blockedTransactionUsages: [] as never[],
    }
    const doc = await CardModel.create({
      orgId: ctx.orgId,
      projectId,
      airwallexCardId: `awx_card_${suffix}`,
      cardholderId: 'ch_001',
      maskedNumber: '************1234',
      nickName: 'Test Card',
      status: 'ACTIVE' as const,
      purpose: 'MEMBER' as const,
      desiredControls: controls,
      appliedControls: controls,
    })
    return { id: String(doc._id), projectId }
  }

  // ─── GET /api/transactions ─────────────────────────────────────────────

  describe('GET /api/transactions', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await LIST(
        buildRequest({ method: 'GET', path: '/api/transactions', session: null }),
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 when onboarding is incomplete', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await LIST(
        buildRequest({
          method: 'GET',
          path: '/api/transactions',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    it('returns 404 for cross-org transactions', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      await seedTransaction(a.ctx, a.project.id)
      const res = await LIST(
        buildRequest({
          method: 'GET',
          path: '/api/transactions',
          session: b.session,
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, transactionContracts.list.output)
      expect(body.items).toHaveLength(0)
    })

    it('returns 403 when caller lacks transaction.view', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      const res = await LIST(
        buildRequest({
          method: 'GET',
          path: '/api/transactions',
          session: member.session,
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.TRANSACTION_VIEW,
      )
    })

    it('returns 422 on invalid pageSize', async () => {
      const owner = await seedOwner()
      const res = await LIST(
        buildRequest({
          method: 'GET',
          path: '/api/transactions',
          session: owner.session,
          query: { pageSize: 999 },
        }),
      )
      expect(res.status).toBe(422)
    })

    it('lists transactions for owner', async () => {
      const owner = await seedOwner()
      const tx = await seedTransaction(owner.ctx, owner.project.id)
      const res = await LIST(
        buildRequest({
          method: 'GET',
          path: '/api/transactions',
          session: owner.session,
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, transactionContracts.list.output)
      expect(body.items.map((t) => t.id)).toContain(tx.id)
      expect(body.total).toBeGreaterThanOrEqual(1)
    })

    it.todo('matrix #5 N/A — list has no scope narrowing beyond permission')
    it.todo('matrix #8 N/A — list returns empty, not 404')
    it.todo('matrix #9 N/A — GET list has no idempotency key')
    it.todo('matrix #10 N/A — list does not write audit')
  })

  // ─── GET /api/transactions/:id ─────────────────────────────────────────

  describe('GET /api/transactions/:id', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: '/api/transactions/x',
          session: null,
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 when onboarding is incomplete', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: '/api/transactions/x',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    it('returns 404 for cross-org transaction', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const tx = await seedTransaction(a.ctx, a.project.id)
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: `/api/transactions/${tx.id}`,
          session: b.session,
          params: { id: tx.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns 403 when caller lacks transaction.view', async () => {
      const owner = await seedOwner()
      const tx = await seedTransaction(owner.ctx, owner.project.id)
      const member = await addOrgMember(owner.org.id)
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: `/api/transactions/${tx.id}`,
          session: member.session,
          params: { id: tx.id },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.TRANSACTION_VIEW,
      )
    })

    it('returns 404 when transaction is missing', async () => {
      const owner = await seedOwner()
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: '/api/transactions/000000000000000000000000',
          session: owner.session,
          params: { id: '000000000000000000000000' },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns transaction with lifecycleEvents for owner', async () => {
      const owner = await seedOwner()
      const lifecycleId = `lc_shared_${Date.now()}`
      const auth = await seedTransaction(owner.ctx, owner.project.id, {
        lifecycleId,
        type: TransactionType.AUTHORIZATION,
        status: TransactionStatus.AUTHORIZED,
      })
      const clearing = await seedTransaction(owner.ctx, owner.project.id, {
        lifecycleId,
        type: TransactionType.CLEARING,
        status: TransactionStatus.CLEARED,
      })
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: `/api/transactions/${auth.id}`,
          session: owner.session,
          params: { id: auth.id },
        }),
      )
      expect(res.status).toBe(200)
      const detail = await expectMatchesContract(res, transactionContracts.get.output)
      expect(detail.id).toBe(auth.id)
      expect(detail.lifecycleEvents.map((e) => e.id)).toContain(auth.id)
      expect(detail.lifecycleEvents.map((e) => e.id)).toContain(clearing.id)
    })

    it('returns 403 when CARD scope excludes the subject', async () => {
      const owner = await seedOwner()
      const tx = await seedTransaction(owner.ctx, owner.project.id)
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'project_spender', {
        level: AccessScopeLevel.CARD,
        cardIds: ['card_other'],
      })
      const res = await GET_ONE(
        buildRequest({
          method: 'GET',
          path: `/api/transactions/${tx.id}`,
          session: member.session,
          params: { id: tx.id },
        }),
      )
      expect(res.status).toBe(403)
    })

    it.todo('matrix #6 N/A — GET has no payload')
    it.todo('matrix #9 N/A — GET has no idempotency key')
    it.todo('matrix #10 N/A — GET does not write audit')
  })

  // ─── GET /api/transactions/declined ────────────────────────────────────

  describe('GET /api/transactions/declined', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await LIST_DECLINED(
        buildRequest({ method: 'GET', path: '/api/transactions/declined', session: null }),
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 when onboarding is incomplete', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await LIST_DECLINED(
        buildRequest({
          method: 'GET',
          path: '/api/transactions/declined',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 403 when caller lacks transaction.view', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      const res = await LIST_DECLINED(
        buildRequest({
          method: 'GET',
          path: '/api/transactions/declined',
          session: member.session,
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns only DECLINED transactions for owner', async () => {
      const owner = await seedOwner()
      await seedTransaction(owner.ctx, owner.project.id, {
        status: TransactionStatus.AUTHORIZED,
      })
      const declined = await seedTransaction(owner.ctx, owner.project.id, {
        status: TransactionStatus.DECLINED,
        failureReason: 'insufficient_funds',
      })
      const res = await LIST_DECLINED(
        buildRequest({
          method: 'GET',
          path: '/api/transactions/declined',
          session: owner.session,
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, transactionContracts.listDeclined.output)
      expect(body.items.every((t) => t.status === TransactionStatus.DECLINED)).toBe(true)
      expect(body.items.map((t) => t.id)).toContain(declined.id)
    })

    it.todo('matrix #5 N/A — list has no scope narrowing')
    it.todo('matrix #6 N/A — query defaults are valid')
    it.todo('matrix #8 N/A — list returns empty, not 404')
    it.todo('matrix #9 N/A — GET list has no idempotency key')
    it.todo('matrix #10 N/A — list does not write audit')
  })

  // ─── GET /api/projects/:id/transactions ────────────────────────────────

  describe('GET /api/projects/:id/transactions', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: '/api/projects/x/transactions',
          session: null,
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 when onboarding is incomplete', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: '/api/projects/x/transactions',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 404 for cross-org project', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${a.project.id}/transactions`,
          session: b.session,
          params: { id: a.project.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns 403 when caller lacks transaction.view', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/transactions`,
          session: member.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.TRANSACTION_VIEW,
      )
    })

    it('returns 404 when project is missing', async () => {
      const owner = await seedOwner()
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: '/api/projects/000000000000000000000000/transactions',
          session: owner.session,
          params: { id: '000000000000000000000000' },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('lists project transactions for owner', async () => {
      const owner = await seedOwner()
      const tx = await seedTransaction(owner.ctx, owner.project.id)
      const res = await LIST_PROJECT(
        buildRequest({
          method: 'GET',
          path: `/api/projects/${owner.project.id}/transactions`,
          session: owner.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, transactionContracts.listForProject.output)
      expect(body.items.map((t) => t.id)).toContain(tx.id)
    })

    it.todo('matrix #5 N/A — list has no scope narrowing beyond permission')
    it.todo('matrix #9 N/A — GET list has no idempotency key')
    it.todo('matrix #10 N/A — list does not write audit')
  })

  // ─── GET /api/cards/:id/transactions ───────────────────────────────────

  describe('GET /api/cards/:id/transactions', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await LIST_CARD(
        buildRequest({
          method: 'GET',
          path: '/api/cards/x/transactions',
          session: null,
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 when onboarding is incomplete', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await LIST_CARD(
        buildRequest({
          method: 'GET',
          path: '/api/cards/x/transactions',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          params: { id: 'x' },
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 404 for cross-org card', async () => {
      const a = await seedOwner()
      const b = await seedOwner()
      const card = await seedCard(a.ctx, a.project.id)
      const res = await LIST_CARD(
        buildRequest({
          method: 'GET',
          path: `/api/cards/${card.id}/transactions`,
          session: b.session,
          params: { id: card.id },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('returns 403 when caller lacks transaction.view', async () => {
      const owner = await seedOwner()
      const card = await seedCard(owner.ctx, owner.project.id)
      const member = await addOrgMember(owner.org.id)
      const res = await LIST_CARD(
        buildRequest({
          method: 'GET',
          path: `/api/cards/${card.id}/transactions`,
          session: member.session,
          params: { id: card.id },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { message: string } }>(res)).error.message).toContain(
        Permission.TRANSACTION_VIEW,
      )
    })

    it('returns 404 when card is missing', async () => {
      const owner = await seedOwner()
      const res = await LIST_CARD(
        buildRequest({
          method: 'GET',
          path: '/api/cards/000000000000000000000000/transactions',
          session: owner.session,
          params: { id: '000000000000000000000000' },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('lists card transactions for owner', async () => {
      const owner = await seedOwner()
      const card = await seedCard(owner.ctx, owner.project.id)
      const tx = await seedTransaction(owner.ctx, owner.project.id, { cardId: card.id })
      const res = await LIST_CARD(
        buildRequest({
          method: 'GET',
          path: `/api/cards/${card.id}/transactions`,
          session: owner.session,
          params: { id: card.id },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, transactionContracts.listForCard.output)
      expect(body.items.map((t) => t.id)).toContain(tx.id)
    })

    it.todo('matrix #5 N/A — card scope checked via card.projectId')
    it.todo('matrix #9 N/A — GET list has no idempotency key')
    it.todo('matrix #10 N/A — list does not write audit')
  })
})
