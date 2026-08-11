/**
 * B6.13 — one audit assertion per mutating attribute/rule endpoint.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH as PATCH_ATTR } from '@/app/api/attributes/[key]/route'
import { POST as CREATE_ATTR } from '@/app/api/attributes/route'
import { PUT as PUT_VALUE } from '@/app/api/attributes/values/route'
import { DELETE as DELETE_RULE, PATCH as PATCH_RULE } from '@/app/api/rules/[id]/route'
import { POST as ENABLE_RULE } from '@/app/api/rules/[id]/enable/route'
import { POST as CREATE_RULE } from '@/app/api/rules/route'
import { resetEventPublisher } from '@/server/events/bus'
import { AttributeDefinitionModel } from '@/server/models/AttributeDefinition'
import { AttributeValueModel } from '@/server/models/AttributeValue'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { RuleModel } from '@/server/models/Rule'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { AttributeScope } from '@/shared/enums/attributeScope'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { AttributeType } from '@/shared/enums/attributeType'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { OrgRole } from '@/shared/enums/orgRole'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver } from '../helpers/request'

describe('audit/b6', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      AttributeDefinitionModel.syncIndexes(),
      AttributeValueModel.syncIndexes(),
      RuleModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    vi.restoreAllMocks()
  })

  async function seedOwner() {
    const user = await users.createUser({
      email: `a6-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Audit B6',
      slug: `a6-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    await memberships.createMembership(
      { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER },
      { userId: user.id, orgRole: OrgRole.OWNER },
    )
    return {
      org,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  function ruleBody() {
    return {
      scope: { level: RuleScopeLevel.ORG },
      name: 'Audit rule',
      trigger: { events: ['budget.updated'] },
      when: { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
      then: [
        {
          action: RuleActionType.NOTIFY,
          target: { select: RuleTargetSelect.PROJECT_MEMBERS },
          params: { template: 'x' },
        },
      ],
    }
  }

  it('audits attribute definition create/update and MANUAL value put', async () => {
    const { session, org } = await seedOwner()

    await CREATE_ATTR(
      buildRequest({
        method: 'POST',
        path: '/api/attributes',
        session,
        body: {
          key: 'campaign.roas',
          label: 'ROAS',
          type: AttributeType.NUMBER,
          scope: AttributeScope.PROJECT,
          source: AttributeSource.MANUAL,
        },
      }),
    )
    expect(
      await AuditLogModel.countDocuments({ orgId: org.id, action: 'attribute.definition.created' }),
    ).toBe(1)

    await PATCH_ATTR(
      buildRequest({
        method: 'PATCH',
        path: '/api/attributes/campaign.roas',
        session,
        params: { key: 'campaign.roas' },
        body: { label: 'Campaign ROAS' },
      }),
    )
    expect(
      await AuditLogModel.countDocuments({ orgId: org.id, action: 'attribute.definition.updated' }),
    ).toBe(1)

    await PUT_VALUE(
      buildRequest({
        method: 'PUT',
        path: '/api/attributes/values',
        session,
        body: {
          key: 'campaign.roas',
          subjectType: AttributeSubjectType.PROJECT,
          subjectId: 'project_1',
          value: 2.5,
        },
      }),
    )
    expect(
      await AuditLogModel.countDocuments({ orgId: org.id, action: 'attribute.value.put' }),
    ).toBe(1)
  })

  it('audits rule create/update/enable/delete', async () => {
    const { session, org } = await seedOwner()

    const created = await CREATE_RULE(
      buildRequest({ method: 'POST', path: '/api/rules', session, body: ruleBody() }),
    )
    const rule = (await created.json()) as { id: string }
    expect(await AuditLogModel.countDocuments({ orgId: org.id, action: 'rule.created' })).toBe(1)

    await PATCH_RULE(
      buildRequest({
        method: 'PATCH',
        path: `/api/rules/${rule.id}`,
        session,
        params: { id: rule.id },
        body: { name: 'Renamed' },
      }),
    )
    expect(await AuditLogModel.countDocuments({ orgId: org.id, action: 'rule.updated' })).toBe(1)

    await ENABLE_RULE(
      buildRequest({
        method: 'POST',
        path: `/api/rules/${rule.id}/enable`,
        session,
        params: { id: rule.id },
        body: { enabled: true },
      }),
    )
    expect(await AuditLogModel.countDocuments({ orgId: org.id, action: 'rule.enabled' })).toBe(1)

    await DELETE_RULE(
      buildRequest({
        method: 'DELETE',
        path: `/api/rules/${rule.id}`,
        session,
        params: { id: rule.id },
      }),
    )
    expect(await AuditLogModel.countDocuments({ orgId: org.id, action: 'rule.deleted' })).toBe(1)
  })
})
