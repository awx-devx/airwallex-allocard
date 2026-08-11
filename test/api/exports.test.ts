/**
 * B9.3 — Streaming CSV exports.
 * Stream headers; one audit per export; scope 403/404; progressive chunks (O(1) buffering).
 *
 * Streaming assertion approach: pull-based `rowsToCsvStream` only advances the async
 * generator when the consumer reads. After header + first data chunk, `generated`
 * must be 1 (not N) — proves we do not buffer all rows before emitting.
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
import { appendEntry } from '@/server/repositories/budgetEntries'
import { createTransaction } from '@/server/repositories/transactions'
import { rowsToCsvStream } from '@/server/services/exports/csv'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { resetRedis } from '@/server/redis'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { TransactionStatus } from '@/shared/enums/transactionStatus'
import { TransactionType } from '@/shared/enums/transactionType'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

type ExportHandler = (req: Request) => Promise<Response>

const KINDS: Array<{
  name: string
  path: string
  handler: ExportHandler
  action: string
}> = [
  {
    name: 'budget',
    path: '/api/exports/budget',
    handler: EXPORT_BUDGET,
    action: 'export.budget',
  },
  {
    name: 'transactions',
    path: '/api/exports/transactions',
    handler: EXPORT_TRANSACTIONS,
    action: 'export.transactions',
  },
  {
    name: 'cards',
    path: '/api/exports/cards',
    handler: EXPORT_CARDS,
    action: 'export.cards',
  },
  {
    name: 'audit',
    path: '/api/exports/audit',
    handler: EXPORT_AUDIT,
    action: 'export.audit',
  },
]

describe('B9.3 streaming CSV exports', () => {
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
      email: `exp-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Export Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await projectsRepo.createProject(ctx, {
      name: 'Export Project',
      code: `EXP-${Date.now().toString(16)}`,
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

  async function countExportAudits(ctx: OrgContext, action: string): Promise<number> {
    return AuditLogModel.countDocuments({ orgId: ctx.orgId, action }).exec()
  }

  describe('rowsToCsvStream (streaming / O(1) buffer)', () => {
    it('emits progressive chunks without buffering all N rows', async () => {
      const N = 500
      let generated = 0
      const rows = (async function* () {
        for (let i = 0; i < N; i++) {
          generated += 1
          yield [i, `row-${i}`] as const
        }
      })()

      const stream = rowsToCsvStream(['n', 'label'], rows)
      const reader = stream.getReader()
      const decoder = new TextDecoder()

      const header = await reader.read()
      expect(header.done).toBe(false)
      expect(decoder.decode(header.value)).toContain('n,label')
      expect(generated).toBe(0)

      const first = await reader.read()
      expect(first.done).toBe(false)
      expect(decoder.decode(first.value)).toContain('0,row-0')
      // Pull-based: only one data row generated so far — not all N.
      expect(generated).toBe(1)
      expect(generated).toBeLessThan(N)

      let chunks = 2
      while (true) {
        const next = await reader.read()
        if (next.done) break
        chunks += 1
      }
      expect(generated).toBe(N)
      // header + N data rows = N+1 enqueues
      expect(chunks).toBe(N + 1)
    })

    it('escapes commas, quotes, and newlines', async () => {
      const rows = (async function* () {
        yield ['a,b', 'say "hi"', 'line1\nline2'] as const
      })()
      const stream = rowsToCsvStream(['x', 'y', 'z'], rows)
      const text = await new Response(stream).text()
      expect(text).toBe('x,y,z\n"a,b","say ""hi""","line1\nline2"\n')
    })
  })

  for (const kind of KINDS) {
    describe(`POST ${kind.path}`, () => {
      it('#1 unauthenticated → 401', async () => {
        const res = await kind.handler(
          buildRequest({
            method: 'POST',
            path: kind.path,
            session: null,
            body: {},
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
        const res = await kind.handler(
          buildRequest({
            method: 'POST',
            path: kind.path,
            session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
            body: {},
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
        const res = await kind.handler(
          buildRequest({
            method: 'POST',
            path: kind.path,
            session: a.session,
            body: { projectId: b.project.id },
          }),
        )
        expect(res.status).toBe(404)
      })

      it('#4 lacks report.export → 403', async () => {
        const owner = await seedOwner()
        const member = await addOrgMember(owner.org.id)
        // Approver has no REPORT_EXPORT
        await assignProjectRole(owner, member.user.id, 'approver')
        const res = await kind.handler(
          buildRequest({
            method: 'POST',
            path: kind.path,
            session: member.session,
            body: { projectId: owner.project.id },
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
        // Viewer has REPORT_EXPORT but WORKSTREAM scope cannot cover a bare project subject.
        await assignProjectRole(owner, member.user.id, 'viewer', owner.project.id, {
          level: AccessScopeLevel.WORKSTREAM,
          workstreamIds: ['507f1f77bcf86cd799439011'],
        })
        const res = await kind.handler(
          buildRequest({
            method: 'POST',
            path: kind.path,
            session: member.session,
            body: { projectId: owner.project.id },
          }),
        )
        expect(res.status).toBe(403)
      })

      it('#6 invalid payload → 422', async () => {
        const owner = await seedOwner()
        const res = await kind.handler(
          buildRequest({
            method: 'POST',
            path: kind.path,
            session: owner.session,
            body: { from: 'not-an-iso-date' },
          }),
        )
        expect(res.status).toBe(422)
      })

      it('#7 happy path → text/csv stream', async () => {
        const owner = await seedOwner()
        const res = await kind.handler(
          buildRequest({
            method: 'POST',
            path: kind.path,
            session: owner.session,
            body: { projectId: owner.project.id },
          }),
        )
        expect(res.status).toBe(200)
        expect(res.headers.get('Content-Type')).toMatch(/text\/csv/)
        expect(res.body).not.toBeNull()
        const text = await res.text()
        expect(text.length).toBeGreaterThan(0)
        expect(text.split('\n')[0]).toBeTruthy()
      })

      it('#8 unknown project → 404', async () => {
        const owner = await seedOwner()
        const res = await kind.handler(
          buildRequest({
            method: 'POST',
            path: kind.path,
            session: owner.session,
            body: { projectId: '507f1f77bcf86cd799439099' },
          }),
        )
        expect(res.status).toBe(404)
      })

      it('#9 N/A — each export is a new extraction (no idempotency key)', () => {
        expect(true).toBe(true)
      })

      it('#10 exactly one audit entry after successful export', async () => {
        const owner = await seedOwner()
        const before = await countExportAudits(owner.ctx, kind.action)
        const res = await kind.handler(
          buildRequest({
            method: 'POST',
            path: kind.path,
            session: owner.session,
            body: { projectId: owner.project.id },
          }),
        )
        expect(res.status).toBe(200)
        // Must consume the stream so onComplete writes the audit.
        await res.text()
        const after = await countExportAudits(owner.ctx, kind.action)
        expect(after - before).toBe(1)

        const entry = await AuditLogModel.findOne({
          orgId: owner.ctx.orgId,
          action: kind.action,
        })
          .sort({ at: -1 })
          .lean()
          .exec()
        expect(entry).not.toBeNull()
        expect(entry!.actorId).toBe(owner.user.id)
        expect(entry!.subjectType).toBe('export')
        expect(entry!.metadata).toMatchObject({
          projectId: owner.project.id,
          rowCount: expect.any(Number),
        })
      })
    })
  }

  describe('content + filters', () => {
    it('budget export includes amount_minor as integer', async () => {
      const owner = await seedOwner()
      await appendEntry(owner.ctx, {
        projectId: owner.project.id,
        type: BudgetEntryType.APPROVAL,
        amount: 402_350,
        currency: 'USD',
        sourceType: BudgetEntrySourceType.MANUAL,
        sourceId: 'seed',
        createdBy: owner.user.id,
        note: 'initial',
      })
      const res = await EXPORT_BUDGET(
        buildRequest({
          method: 'POST',
          path: '/api/exports/budget',
          session: owner.session,
          body: { projectId: owner.project.id },
        }),
      )
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text.split('\n')[0]).toContain('amount_minor')
      expect(text).toContain('402350')
    })

    it('transactions export includes amount_minor', async () => {
      const owner = await seedOwner()
      await createTransaction(owner.ctx, {
        cardId: '507f1f77bcf86cd799439011',
        projectId: owner.project.id,
        airwallexTransactionId: `awx-${Date.now()}`,
        cardTransactionId: `ct-${Date.now()}`,
        lifecycleId: `lc-${Date.now()}`,
        type: TransactionType.CLEARING,
        status: TransactionStatus.CLEARED,
        amount: 12_50,
        currency: 'USD',
        billingAmount: 12_50,
        billingCurrency: 'USD',
        merchant: { name: 'Acme', mcc: '5411', country: 'US' },
        transactedAt: new Date('2026-02-01T00:00:00.000Z'),
      })
      const res = await EXPORT_TRANSACTIONS(
        buildRequest({
          method: 'POST',
          path: '/api/exports/transactions',
          session: owner.session,
          body: {
            projectId: owner.project.id,
            from: '2026-01-01T00:00:00.000Z',
            to: '2026-12-31T23:59:59.999Z',
          },
        }),
      )
      expect(res.status).toBe(200)
      const text = await res.text()
      expect(text.split('\n')[0]).toContain('amount_minor')
      expect(text).toContain('1250')
      expect(text).toContain('Acme')
    })

    it('viewer with report.export can export their project', async () => {
      const owner = await seedOwner()
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'viewer')
      const res = await EXPORT_BUDGET(
        buildRequest({
          method: 'POST',
          path: '/api/exports/budget',
          session: member.session,
          body: { projectId: owner.project.id },
        }),
      )
      expect(res.status).toBe(200)
      await res.text()
    })

    it('finance_admin on other project does not grant this project', async () => {
      const owner = await seedOwner()
      const other = await projectsRepo.createProject(owner.ctx, {
        name: 'Other',
        code: `OTH-${Date.now().toString(16)}`,
      })
      const member = await addOrgMember(owner.org.id)
      await assignProjectRole(owner, member.user.id, 'finance_administrator', other.id)
      const res = await EXPORT_BUDGET(
        buildRequest({
          method: 'POST',
          path: '/api/exports/budget',
          session: member.session,
          body: { projectId: owner.project.id },
        }),
      )
      expect(res.status).toBe(403)
    })
  })
})
