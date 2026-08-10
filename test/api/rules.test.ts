import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { DELETE, PATCH } from '@/app/api/rules/[id]/route'
import { POST as enable } from '@/app/api/rules/[id]/enable/route'
import { GET, POST } from '@/app/api/rules/route'
import { POST as validate } from '@/app/api/rules/validate/route'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { RuleModel } from '@/server/models/Rule'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { ruleContracts } from '@/shared/contracts/rule'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

function sampleRule(projectId?: string) {
  return {
    scope: projectId ? { level: RuleScopeLevel.PROJECT, projectId } : { level: RuleScopeLevel.ORG },
    name: 'Cap member cards',
    description: null as string | null,
    priority: 10,
    trigger: { events: ['budget.updated'] },
    when: { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
    then: [
      {
        action: RuleActionType.CARD_SET_CONTROLS,
        target: { select: RuleTargetSelect.PROJECT_CARDS },
        params: {
          transactionLimits: {
            currency: 'USD',
            limits: [
              {
                interval: TransactionLimitInterval.MONTHLY,
                amount: 'project.budget.remaining * 0.10',
              },
            ],
          },
        },
      },
    ],
  }
}

describe('/api/rules', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      RuleModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    vi.restoreAllMocks()
  })

  async function seedUser() {
    return users.createUser({
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Rules User',
    })
  }

  async function seedMember(opts?: { role?: OrgRole }) {
    const user = await seedUser()
    const org = await organizations.createOrganization({
      name: 'Rules Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const role = opts?.role ?? OrgRole.OWNER
    await memberships.createMembership(
      { orgId: org.id, userId: user.id, orgRole: role },
      { userId: user.id, orgRole: role },
    )
    return {
      user,
      org,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: role,
        onboarded: true as const,
      },
    }
  }

  describe('GET /api/rules', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await GET(buildRequest({ method: 'GET', path: '/api/rules', session: null }))
      expect(res.status).toBe(401)
    })

    it('returns 403 when MEMBER lacks control.edit', async () => {
      const { session } = await seedMember({ role: OrgRole.MEMBER })
      const res = await GET(buildRequest({ method: 'GET', path: '/api/rules', session }))
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.PERMISSION_DENIED,
      )
    })

    it('lists rules for the org', async () => {
      const { session } = await seedMember()
      await POST(buildRequest({ method: 'POST', path: '/api/rules', session, body: sampleRule() }))
      const res = await GET(buildRequest({ method: 'GET', path: '/api/rules', session }))
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, ruleContracts.list.output)
      expect(body.total).toBe(1)
      expect(body.items[0]?.name).toBe('Cap member cards')
    })
  })

  describe('POST /api/rules', () => {
    it('creates a disabled rule and audits', async () => {
      const { session, org } = await seedMember()
      const res = await POST(
        buildRequest({ method: 'POST', path: '/api/rules', session, body: sampleRule() }),
      )
      expect(res.status).toBe(201)
      const body = await expectMatchesContract(res, ruleContracts.create.output)
      expect(body.enabled).toBe(false)
      expect(body.version).toBe(1)

      const audits = await AuditLogModel.find({ orgId: org.id, action: 'rule.created' }).exec()
      expect(audits).toHaveLength(1)
    })
  })

  describe('PATCH /api/rules/:id', () => {
    it('bumps version on content change and 404s cross-org', async () => {
      const a = await seedMember()
      const b = await seedMember()
      const created = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/rules',
          session: a.session,
          body: sampleRule(),
        }),
      )
      const rule = await expectMatchesContract(created, ruleContracts.create.output)

      const patched = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/rules/${rule.id}`,
          session: a.session,
          params: { id: rule.id },
          body: { name: 'Renamed cap' },
        }),
      )
      expect(patched.status).toBe(200)
      const updated = await expectMatchesContract(patched, ruleContracts.update.output)
      expect(updated.name).toBe('Renamed cap')
      expect(updated.version).toBe(2)

      const cross = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: `/api/rules/${rule.id}`,
          session: b.session,
          params: { id: rule.id },
          body: { name: 'Stolen' },
        }),
      )
      expect(cross.status).toBe(404)
    })
  })

  describe('POST /api/rules/:id/enable', () => {
    it('toggles enabled without bumping version', async () => {
      const { session } = await seedMember()
      const created = await POST(
        buildRequest({ method: 'POST', path: '/api/rules', session, body: sampleRule() }),
      )
      const rule = await expectMatchesContract(created, ruleContracts.create.output)

      const enabled = await enable(
        buildRequest({
          method: 'POST',
          path: `/api/rules/${rule.id}/enable`,
          session,
          params: { id: rule.id },
          body: { enabled: true },
        }),
      )
      expect(enabled.status).toBe(200)
      const body = await expectMatchesContract(enabled, ruleContracts.enable.output)
      expect(body.enabled).toBe(true)
      expect(body.version).toBe(1)
    })
  })

  describe('DELETE /api/rules/:id', () => {
    it('deletes and audits', async () => {
      const { session, org } = await seedMember()
      const created = await POST(
        buildRequest({ method: 'POST', path: '/api/rules', session, body: sampleRule() }),
      )
      const rule = await expectMatchesContract(created, ruleContracts.create.output)

      const res = await DELETE(
        buildRequest({
          method: 'DELETE',
          path: `/api/rules/${rule.id}`,
          session,
          params: { id: rule.id },
        }),
      )
      expect(res.status).toBe(204)

      const list = await GET(buildRequest({ method: 'GET', path: '/api/rules', session }))
      expect((await expectMatchesContract(list, ruleContracts.list.output)).total).toBe(0)

      const audits = await AuditLogModel.find({ orgId: org.id, action: 'rule.deleted' }).exec()
      expect(audits).toHaveLength(1)
    })
  })

  describe('POST /api/rules/validate', () => {
    it('accepts a well-formed draft', async () => {
      const { session } = await seedMember()
      const res = await validate(
        buildRequest({
          method: 'POST',
          path: '/api/rules/validate',
          session,
          body: sampleRule(),
        }),
      )
      expect(res.status).toBe(200)
      expect(await expectMatchesContract(res, ruleContracts.validate.output)).toEqual({ ok: true })
    })

    it('returns formula errors for the builder', async () => {
      const { session } = await seedMember()
      const res = await validate(
        buildRequest({
          method: 'POST',
          path: '/api/rules/validate',
          session,
          body: {
            when: { expr: '1 + + 2' },
            then: [
              {
                action: RuleActionType.CARD_SET_CONTROLS,
                target: { select: RuleTargetSelect.PROJECT_CARDS },
                params: {
                  transactionLimits: {
                    currency: 'USD',
                    limits: [
                      {
                        interval: TransactionLimitInterval.MONTHLY,
                        amount: 'project.budget.remaining *',
                      },
                    ],
                  },
                },
              },
            ],
          },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, ruleContracts.validate.output)
      expect(body.ok).toBe(false)
      if (body.ok === false) {
        expect(body.errors.length).toBeGreaterThan(0)
        expect(body.errors.some((error) => error.path.includes('amount'))).toBe(true)
      }
    })
  })
})
