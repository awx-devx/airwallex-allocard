/**
 * B6.13 — attribute.updated, rule.evaluated, card.limit_updated as applicable.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST as CREATE_ATTR } from '@/app/api/attributes/route'
import { PUT as PUT_VALUE } from '@/app/api/attributes/values/route'
import { POST as CREATE_RULE } from '@/app/api/rules/route'
import { POST as ENABLE_RULE } from '@/app/api/rules/[id]/enable/route'
import type { AirwallexClient } from '@/server/airwallex/client'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import type { OrgContext } from '@/server/http/types'
import { AttributeDefinitionModel } from '@/server/models/AttributeDefinition'
import { AttributeValueModel } from '@/server/models/AttributeValue'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { RuleModel } from '@/server/models/Rule'
import { RuleRunModel } from '@/server/models/RuleRun'
import { UserModel } from '@/server/models/User'
import { resetRedis } from '@/server/redis'
import { appendEntry } from '@/server/repositories/budgetEntries'
import { upsertBudgetFields } from '@/server/repositories/budgets'
import { createCard } from '@/server/repositories/cards'
import { createCardholder } from '@/server/repositories/cardholders'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import { addProjectMember } from '@/server/repositories/projectMembers'
import { createProject, updateStatus } from '@/server/repositories/projects'
import { createRole } from '@/server/repositories/roles'
import * as users from '@/server/repositories/users'
import { evaluateAndApply } from '@/server/services/rules/evaluateAndApply'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { AttributeScope } from '@/shared/enums/attributeScope'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { AttributeType } from '@/shared/enums/attributeType'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { CardControls } from '@/shared/types/cardControls'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver } from '../helpers/request'

const NOW = new Date('2026-08-11T00:00:00.000Z')

function controls(): CardControls {
  return {
    allowedTransactionCount: AllowedTransactionCount.MULTIPLE,
    transactionLimits: {
      currency: 'USD',
      limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 400_000 }],
    },
    activeFrom: null,
    activeTo: null,
    allowedCurrencies: null,
    allowedMerchantCategories: null,
    allowedMerchantCountries: null,
    allowedMerchantBrands: null,
    blockedTransactionUsages: [],
  }
}

function mockClient(): AirwallexClient {
  return {
    accountId: null,
    forAccount: () => mockClient(),
    request: vi.fn(),
    cardholders: {} as AirwallexClient['cardholders'],
    cards: {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      listAllTenantsUnsafe: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      limits: vi.fn(),
      activate: vi.fn(),
      details: vi.fn(),
    },
    transactions: {} as AirwallexClient['transactions'],
    config: {} as AirwallexClient['config'],
    panTokens: {} as AirwallexClient['panTokens'],
  }
}

describe('events/rules', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      AttributeDefinitionModel.syncIndexes(),
      AttributeValueModel.syncIndexes(),
      RuleModel.syncIndexes(),
      RuleRunModel.syncIndexes(),
      CardModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
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
    vi.restoreAllMocks()
  })

  async function seed() {
    const user = await users.createUser({
      email: `ev-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Events',
    })
    const org = await organizations.createOrganization({
      name: 'Events Org',
      slug: `ev-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    const session = {
      userId: user.id,
      orgId: org.id,
      orgRole: OrgRole.OWNER,
      onboarded: true as const,
    }
    const project = await createProject(ctx, { name: 'P', code: 'P1' })
    await updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ACTIVE, {
      approvedAt: new Date(),
    })
    await upsertBudgetFields(ctx, project.id, { currency: 'USD', approvedAmount: 1_000_000 })
    await appendEntry(ctx, {
      projectId: project.id,
      type: BudgetEntryType.APPROVAL,
      amount: 1_000_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'seed',
      createdBy: user.id,
    })
    const role = await createRole(ctx, {
      key: 'spender',
      name: 'Spender',
      permissions: [],
      isTemplate: false,
    })
    await addProjectMember(ctx, {
      projectId: project.id,
      userId: 'member_1',
      roleId: role.id,
      scope: { level: AccessScopeLevel.OWN },
      effectivePermissions: [],
      addedBy: user.id,
    })
    const cardholder = await createCardholder(ctx, {
      userId: 'member_1',
      airwallexCardholderId: 'aw_ch',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.READY,
    })
    const card = await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'aw_card',
      maskedNumber: '************9999',
      nickName: 'P',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.ACTIVE,
      desiredControls: controls(),
      appliedControls: controls(),
    })
    return { ctx, session, project, card }
  }

  it('emits attribute.updated on MANUAL put', async () => {
    const { session } = await seed()
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
    resetEventPublisher()

    await PUT_VALUE(
      buildRequest({
        method: 'PUT',
        path: '/api/attributes/values',
        session,
        body: {
          key: 'campaign.roas',
          subjectType: AttributeSubjectType.PROJECT,
          subjectId: 'project_x',
          value: 3.1,
        },
      }),
    )

    const events = getPublishedEvents().filter((e) => e.type === DomainEventType.ATTRIBUTE_UPDATED)
    expect(events).toHaveLength(1)
    expect(events[0]?.payload).toMatchObject({
      key: 'campaign.roas',
      source: AttributeSource.MANUAL,
    })
  })

  it('emits rule.evaluated and card.limit_updated when a rule changes limits', async () => {
    const { ctx, session, project } = await seed()
    const created = await CREATE_RULE(
      buildRequest({
        method: 'POST',
        path: '/api/rules',
        session,
        body: {
          scope: { level: RuleScopeLevel.PROJECT, projectId: project.id },
          name: 'Cap',
          trigger: { events: ['budget.updated'] },
          when: { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
          then: [
            {
              action: RuleActionType.CARD_SET_CONTROLS,
              target: { select: RuleTargetSelect.PROJECT_CARDS },
              params: {
                transactionLimits: {
                  currency: 'USD',
                  limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 55_000 }],
                },
              },
            },
          ],
        },
      }),
    )
    const rule = (await created.json()) as { id: string }
    await ENABLE_RULE(
      buildRequest({
        method: 'POST',
        path: `/api/rules/${rule.id}/enable`,
        session,
        params: { id: rule.id },
        body: { enabled: true },
      }),
    )
    resetEventPublisher()

    await evaluateAndApply(
      ctx,
      { triggerEvent: 'budget.updated', projectId: project.id, now: NOW },
      { airwallex: mockClient() },
    )

    const types = getPublishedEvents().map((e) => e.type)
    expect(types).toContain(DomainEventType.RULE_EVALUATED)
    expect(types).toContain(DomainEventType.CARD_LIMIT_UPDATED)
  })
})
