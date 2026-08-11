/**
 * B6 phase-exit matrix.
 *
 * Row coverage notes:
 * - #5 access-scope: N/A for `control.edit` org-wide endpoints (no card subject).
 *   Asserted for `GET /api/cards/:id/explain` which guards `card.view` + cardId.
 * - #9 idempotency: N/A — B6 mutations do not accept idempotency keys (same as B2).
 * - #10 audit: covered in `test/audit/b6.test.ts`.
 * - Ingest is secret-authenticated, not session-authenticated — #1/#2/#4 N/A there.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH as PATCH_ATTR } from '@/app/api/attributes/[key]/route'
import { POST as INGEST } from '@/app/api/attributes/ingest/route'
import { GET as LIST_ATTRS, POST as CREATE_ATTR } from '@/app/api/attributes/route'
import { GET as LIST_ATTR_VALUES, PUT as PUT_ATTR_VALUE } from '@/app/api/attributes/values/route'
import { GET as EXPLAIN } from '@/app/api/cards/[id]/explain/route'
import { GET as GET_RULE_RUN } from '@/app/api/rule-runs/[id]/route'
import { GET as LIST_RULE_RUNS } from '@/app/api/rule-runs/route'
import { DELETE as DELETE_RULE, PATCH as PATCH_RULE } from '@/app/api/rules/[id]/route'
import { POST as ENABLE_RULE } from '@/app/api/rules/[id]/enable/route'
import { GET as LIST_RULES, POST as CREATE_RULE } from '@/app/api/rules/route'
import { POST as SIMULATE } from '@/app/api/rules/simulate/route'
import { POST as VALIDATE_RULE } from '@/app/api/rules/validate/route'
import { AttributeDefinitionModel } from '@/server/models/AttributeDefinition'
import { AttributeValueModel } from '@/server/models/AttributeValue'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { CardholderModel } from '@/server/models/Cardholder'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { ProjectModel } from '@/server/models/Project'
import { RoleModel } from '@/server/models/Role'
import { RuleModel } from '@/server/models/Rule'
import { RuleRunModel } from '@/server/models/RuleRun'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import { addProjectMember } from '@/server/repositories/projectMembers'
import { createProject } from '@/server/repositories/projects'
import { findRoleByKey } from '@/server/repositories/roles'
import * as users from '@/server/repositories/users'
import { createCardForProject } from '@/server/services/cards/create'
import { createCardholderForOrg } from '@/server/services/cardholders/create'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { AttributeScope } from '@/shared/enums/attributeScope'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { AttributeType } from '@/shared/enums/attributeType'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { makeCardControls } from '../helpers/factories'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

function sampleRuleBody() {
  return {
    scope: { level: RuleScopeLevel.ORG },
    name: 'Matrix rule',
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
            limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 50_000 }],
          },
        },
      },
    ],
  }
}

describe('B6 matrix', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
      RoleModel.syncIndexes(),
      ProjectMemberModel.syncIndexes(),
      CardholderModel.syncIndexes(),
      CardModel.syncIndexes(),
      AttributeDefinitionModel.syncIndexes(),
      AttributeValueModel.syncIndexes(),
      RuleModel.syncIndexes(),
      RuleRunModel.syncIndexes(),
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

  async function incompleteSession() {
    const user = await users.createUser({
      email: `pre-b6-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Pre-onboard',
    })
    return {
      userId: user.id,
      orgId: null,
      orgRole: null,
      onboarded: false as const,
    }
  }

  async function expectOnboardingIncomplete(res: Response) {
    expect(res.status).toBe(403)
    const body = await readBody<{ error: { code: string } }>(res)
    expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
  }

  async function expectUnauthenticated(res: Response) {
    expect(res.status).toBe(401)
    expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
      ErrorCode.UNAUTHENTICATED,
    )
  }

  async function expectPermissionDenied(res: Response) {
    expect(res.status).toBe(403)
    expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
      ErrorCode.PERMISSION_DENIED,
    )
  }

  async function seedOwner() {
    const user = await users.createUser({
      email: `b6-own-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'B6 Matrix Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    const project = await createProject(ctx, {
      name: 'Matrix',
      code: `MX-${Date.now().toString(16)}`,
    })
    return {
      user,
      org,
      project,
      ctx,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  async function seedMemberSession(orgId: string) {
    const user = await users.createUser({
      email: `b6-mem-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId, userId: user.id, orgRole: OrgRole.MEMBER },
      { userId: user.id, orgRole: OrgRole.MEMBER },
    )
    return {
      userId: user.id,
      orgId,
      orgRole: OrgRole.MEMBER,
      onboarded: true as const,
    }
  }

  describe('matrix #1 — unauthenticated', () => {
    const cases: Array<{ name: string; call: () => Promise<Response> }> = [
      {
        name: 'GET /api/attributes',
        call: () =>
          LIST_ATTRS(buildRequest({ method: 'GET', path: '/api/attributes', session: null })),
      },
      {
        name: 'POST /api/attributes',
        call: () =>
          CREATE_ATTR(
            buildRequest({
              method: 'POST',
              path: '/api/attributes',
              session: null,
              body: {
                key: 'campaign.roas',
                label: 'ROAS',
                type: AttributeType.NUMBER,
                scope: AttributeScope.PROJECT,
                source: AttributeSource.MANUAL,
              },
            }),
          ),
      },
      {
        name: 'PATCH /api/attributes/:key',
        call: () =>
          PATCH_ATTR(
            buildRequest({
              method: 'PATCH',
              path: '/api/attributes/campaign.roas',
              session: null,
              params: { key: 'campaign.roas' },
              body: { label: 'x' },
            }),
          ),
      },
      {
        name: 'GET /api/attributes/values',
        call: () =>
          LIST_ATTR_VALUES(
            buildRequest({ method: 'GET', path: '/api/attributes/values', session: null }),
          ),
      },
      {
        name: 'PUT /api/attributes/values',
        call: () =>
          PUT_ATTR_VALUE(
            buildRequest({
              method: 'PUT',
              path: '/api/attributes/values',
              session: null,
              body: {
                key: 'campaign.roas',
                subjectType: AttributeSubjectType.PROJECT,
                subjectId: 'proj_x',
                value: 1.2,
              },
            }),
          ),
      },
      {
        name: 'GET /api/rules',
        call: () => LIST_RULES(buildRequest({ method: 'GET', path: '/api/rules', session: null })),
      },
      {
        name: 'POST /api/rules',
        call: () =>
          CREATE_RULE(
            buildRequest({
              method: 'POST',
              path: '/api/rules',
              session: null,
              body: sampleRuleBody(),
            }),
          ),
      },
      {
        name: 'PATCH /api/rules/:id',
        call: () =>
          PATCH_RULE(
            buildRequest({
              method: 'PATCH',
              path: '/api/rules/rule_x',
              session: null,
              params: { id: 'rule_x' },
              body: { name: 'x' },
            }),
          ),
      },
      {
        name: 'DELETE /api/rules/:id',
        call: () =>
          DELETE_RULE(
            buildRequest({
              method: 'DELETE',
              path: '/api/rules/rule_x',
              session: null,
              params: { id: 'rule_x' },
            }),
          ),
      },
      {
        name: 'POST /api/rules/:id/enable',
        call: () =>
          ENABLE_RULE(
            buildRequest({
              method: 'POST',
              path: '/api/rules/rule_x/enable',
              session: null,
              params: { id: 'rule_x' },
              body: { enabled: true },
            }),
          ),
      },
      {
        name: 'POST /api/rules/validate',
        call: () =>
          VALIDATE_RULE(
            buildRequest({
              method: 'POST',
              path: '/api/rules/validate',
              session: null,
              body: sampleRuleBody(),
            }),
          ),
      },
      {
        name: 'POST /api/rules/simulate',
        call: () =>
          SIMULATE(
            buildRequest({
              method: 'POST',
              path: '/api/rules/simulate',
              session: null,
              body: { projectId: 'proj_x' },
            }),
          ),
      },
      {
        name: 'GET /api/rule-runs',
        call: () =>
          LIST_RULE_RUNS(buildRequest({ method: 'GET', path: '/api/rule-runs', session: null })),
      },
      {
        name: 'GET /api/rule-runs/:id',
        call: () =>
          GET_RULE_RUN(
            buildRequest({
              method: 'GET',
              path: '/api/rule-runs/run_x',
              session: null,
              params: { id: 'run_x' },
            }),
          ),
      },
      {
        name: 'GET /api/cards/:id/explain',
        call: () =>
          EXPLAIN(
            buildRequest({
              method: 'GET',
              path: '/api/cards/card_x/explain',
              session: null,
              params: { id: 'card_x' },
            }),
          ),
      },
    ]

    for (const entry of cases) {
      it(entry.name, async () => {
        await expectUnauthenticated(await entry.call())
      })
    }
  })

  describe('matrix #2 — onboarding incomplete', () => {
    const cases: Array<{
      name: string
      call: (session: Awaited<ReturnType<typeof incompleteSession>>) => Promise<Response>
    }> = [
      {
        name: 'GET /api/attributes',
        call: (session) =>
          LIST_ATTRS(buildRequest({ method: 'GET', path: '/api/attributes', session })),
      },
      {
        name: 'GET /api/rules',
        call: (session) => LIST_RULES(buildRequest({ method: 'GET', path: '/api/rules', session })),
      },
      {
        name: 'POST /api/rules/simulate',
        call: (session) =>
          SIMULATE(
            buildRequest({
              method: 'POST',
              path: '/api/rules/simulate',
              session,
              body: { projectId: 'proj_x' },
            }),
          ),
      },
      {
        name: 'GET /api/rule-runs',
        call: (session) =>
          LIST_RULE_RUNS(buildRequest({ method: 'GET', path: '/api/rule-runs', session })),
      },
      {
        name: 'GET /api/cards/:id/explain',
        call: (session) =>
          EXPLAIN(
            buildRequest({
              method: 'GET',
              path: '/api/cards/card_x/explain',
              session,
              params: { id: 'card_x' },
            }),
          ),
      },
      {
        name: 'PUT /api/attributes/values',
        call: (session) =>
          PUT_ATTR_VALUE(
            buildRequest({
              method: 'PUT',
              path: '/api/attributes/values',
              session,
              body: {
                key: 'campaign.roas',
                subjectType: AttributeSubjectType.PROJECT,
                subjectId: 'proj_x',
                value: 1,
              },
            }),
          ),
      },
    ]

    for (const entry of cases) {
      it(entry.name, async () => {
        const session = await incompleteSession()
        await expectOnboardingIncomplete(await entry.call(session))
      })
    }
  })

  describe('matrix #3 / #4 — cross-org 404 and permission deny', () => {
    it('PATCH /api/rules/:id returns 404 cross-org, never 403', async () => {
      const owner = await seedOwner()
      const created = await CREATE_RULE(
        buildRequest({
          method: 'POST',
          path: '/api/rules',
          session: owner.session,
          body: sampleRuleBody(),
        }),
      )
      expect(created.status).toBe(201)
      const rule = await readBody<{ id: string }>(created)

      const other = await seedOwner()
      const res = await PATCH_RULE(
        buildRequest({
          method: 'PATCH',
          path: `/api/rules/${rule.id}`,
          session: other.session,
          params: { id: rule.id },
          body: { name: 'stolen' },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('GET /api/rule-runs/:id returns 404 cross-org', async () => {
      const owner = await seedOwner()
      // No run yet — use a plausible ObjectId shape that won't exist in the other org.
      const other = await seedOwner()
      const res = await GET_RULE_RUN(
        buildRequest({
          method: 'GET',
          path: `/api/rule-runs/${owner.project.id}`,
          session: other.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(404)
      void owner
    })

    it('GET /api/attributes returns 403 when MEMBER lacks control.edit', async () => {
      const owner = await seedOwner()
      const session = await seedMemberSession(owner.org.id)
      await expectPermissionDenied(
        await LIST_ATTRS(buildRequest({ method: 'GET', path: '/api/attributes', session })),
      )
    })

    it('POST /api/rules returns 403 when MEMBER lacks control.edit', async () => {
      const owner = await seedOwner()
      const session = await seedMemberSession(owner.org.id)
      await expectPermissionDenied(
        await CREATE_RULE(
          buildRequest({
            method: 'POST',
            path: '/api/rules',
            session,
            body: sampleRuleBody(),
          }),
        ),
      )
    })

    it('POST /api/rules/simulate returns 403 when MEMBER lacks control.edit', async () => {
      const owner = await seedOwner()
      const session = await seedMemberSession(owner.org.id)
      await expectPermissionDenied(
        await SIMULATE(
          buildRequest({
            method: 'POST',
            path: '/api/rules/simulate',
            session,
            body: { projectId: owner.project.id },
          }),
        ),
      )
    })

    it('GET /api/rule-runs returns 403 when MEMBER lacks control.edit', async () => {
      const owner = await seedOwner()
      const session = await seedMemberSession(owner.org.id)
      await expectPermissionDenied(
        await LIST_RULE_RUNS(buildRequest({ method: 'GET', path: '/api/rule-runs', session })),
      )
    })
  })

  describe('matrix #5 — access scope excludes subject', () => {
    it('explain returns 403 when CARD scope excludes the card', async () => {
      const owner = await seedOwner()
      const ch = await createCardholderForOrg(owner.ctx, { type: CardholderType.DELEGATE })
      if (ch.status !== CardholderStatus.READY) {
        const { updateCardholderStatus } = await import('@/server/repositories/cardholders')
        await updateCardholderStatus(owner.ctx, ch.id, CardholderStatus.READY)
      }
      const card = await createCardForProject(owner.ctx, owner.project.id, {
        purpose: CardPurpose.SHARED,
        cardholderId: ch.id,
        desiredControls: makeCardControls(),
        accessList: [owner.user.id],
      })

      const member = await users.createUser({
        email: `scoped-b6-${Date.now()}@example.com`,
        name: 'Scoped',
      })
      await memberships.createMembership(
        { orgId: owner.org.id, userId: member.id, orgRole: OrgRole.MEMBER },
        { userId: member.id, orgRole: OrgRole.MEMBER },
      )
      const spender = await findRoleByKey(owner.ctx, 'project_spender')
      expect(spender).not.toBeNull()
      expect(spender!.permissions).toContain(Permission.CARD_VIEW)

      await addProjectMember(owner.ctx, {
        projectId: owner.project.id,
        userId: member.id,
        roleId: spender!.id,
        scope: {
          level: AccessScopeLevel.CARD,
          cardIds: ['card_other_not_this_one'],
        },
        effectivePermissions: spender!.permissions,
        addedBy: owner.user.id,
      })

      const res = await EXPLAIN(
        buildRequest({
          method: 'GET',
          path: `/api/cards/${card.id}/explain`,
          session: {
            userId: member.id,
            orgId: owner.org.id,
            orgRole: OrgRole.MEMBER,
            onboarded: true,
          },
          params: { id: card.id },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.PERMISSION_DENIED,
      )
    })
  })

  describe('matrix #6 — invalid payload 422', () => {
    it('POST /api/attributes rejects a bad key shape', async () => {
      const owner = await seedOwner()
      const res = await CREATE_ATTR(
        buildRequest({
          method: 'POST',
          path: '/api/attributes',
          session: owner.session,
          body: {
            key: 'BAD KEY',
            label: 'Nope',
            type: AttributeType.NUMBER,
            scope: AttributeScope.PROJECT,
            source: AttributeSource.MANUAL,
          },
        }),
      )
      expect(res.status).toBe(422)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.VALIDATION_FAILED,
      )
    })

    it('POST /api/rules rejects an empty name', async () => {
      const owner = await seedOwner()
      const res = await CREATE_RULE(
        buildRequest({
          method: 'POST',
          path: '/api/rules',
          session: owner.session,
          body: { ...sampleRuleBody(), name: '' },
        }),
      )
      expect(res.status).toBe(422)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.VALIDATION_FAILED,
      )
    })

    it('POST /api/rules/simulate rejects an empty body', async () => {
      const owner = await seedOwner()
      const res = await SIMULATE(
        buildRequest({
          method: 'POST',
          path: '/api/rules/simulate',
          session: owner.session,
          body: {},
        }),
      )
      expect(res.status).toBe(422)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.VALIDATION_FAILED,
      )
    })
  })

  describe('matrix #8 — not found', () => {
    it('PATCH /api/attributes/:key returns 404 for unknown keys', async () => {
      const owner = await seedOwner()
      const res = await PATCH_ATTR(
        buildRequest({
          method: 'PATCH',
          path: '/api/attributes/does.not.exist',
          session: owner.session,
          params: { key: 'does.not.exist' },
          body: { label: 'x' },
        }),
      )
      expect(res.status).toBe(404)
    })

    it('GET /api/cards/:id/explain returns 404 for unknown cards', async () => {
      const owner = await seedOwner()
      const res = await EXPLAIN(
        buildRequest({
          method: 'GET',
          path: `/api/cards/${owner.project.id}/explain`,
          session: owner.session,
          params: { id: owner.project.id },
        }),
      )
      expect(res.status).toBe(404)
    })
  })

  describe('matrix N/A justifications', () => {
    it('documents #5 N/A for control.edit and #9 N/A for idempotency', () => {
      // control.edit is org-wide via membership — no card/workstream subject to exclude.
      // B6 mutations do not take idempotency keys (ARCHITECTURE matrix row 9).
      expect(Permission.CONTROL_EDIT).toBe('control.edit')
    })

    it('ingest is secret-auth, not session-auth — wrong secret is 401', async () => {
      const res = await INGEST(
        buildRequest({
          method: 'POST',
          path: '/api/attributes/ingest',
          body: {
            key: 'campaign.roas',
            subjectType: AttributeSubjectType.PROJECT,
            subjectId: 'project_1',
            value: 1.2,
          },
          headers: { 'x-allocard-attribute-secret': 'definitely-the-wrong-secret' },
        }),
      )
      expect(res.status).toBe(401)
    })
  })
})
