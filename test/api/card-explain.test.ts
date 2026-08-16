import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as explain } from '@/app/api/cards/[id]/explain/route'
import type { AirwallexClient } from '@/server/airwallex/client'
import { resetEventPublisher } from '@/server/events/bus'
import type { OrgContext } from '@/server/http/types'
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
import { createRule, setRuleEnabled } from '@/server/repositories/rules'
import * as users from '@/server/repositories/users'
import { evaluateAndApply } from '@/server/services/rules/evaluateAndApply'
import { cardExplainContracts } from '@/shared/contracts/ruleRun'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { ActorType } from '@/shared/enums/audit'
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
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { CardControls } from '@/shared/types/cardControls'
import { expectMatchesContract } from '../helpers/contract'
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
    },
    transactions: {} as AirwallexClient['transactions'],
    config: {} as AirwallexClient['config'],
    panTokens: {} as AirwallexClient['panTokens'],
  }
}

describe('/api/cards/:id/explain', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      RuleModel.syncIndexes(),
      RuleRunModel.syncIndexes(),
      CardModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetRedis()
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    vi.restoreAllMocks()
  })

  async function seedWorld() {
    const user = await users.createUser({
      email: `u-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Explain User',
    })
    const org = await organizations.createOrganization({
      name: 'Explain Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    await memberships.createMembership(
      { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER },
      { userId: user.id, orgRole: OrgRole.OWNER },
    )
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    const session = {
      userId: user.id,
      orgId: org.id,
      orgRole: OrgRole.OWNER,
      onboarded: true as const,
    }

    const project = await createProject(ctx, { name: 'APAC', code: 'APAC' })
    await updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ACTIVE, {
      approvedAt: new Date('2026-07-25T00:00:00.000Z'),
    })
    const role = await createRole(ctx, {
      key: 'spender',
      name: 'Spender',
      permissions: [],
      isTemplate: false,
    })
    await addProjectMember(ctx, {
      projectId: project.id,
      userId: 'user_member',
      roleId: role.id,
      scope: { level: AccessScopeLevel.OWN },
      effectivePermissions: [],
      addedBy: user.id,
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
    const cardholder = await createCardholder(ctx, {
      userId: 'user_member',
      airwallexCardholderId: 'aw_ch',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.READY,
    })
    const card = await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'aw_card',
      maskedNumber: '************1111',
      nickName: 'APAC',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.ACTIVE,
      desiredControls: controls(),
      appliedControls: controls(),
    })
    const rule = await createRule(ctx, {
      scope: { level: RuleScopeLevel.PROJECT, projectId: project.id },
      name: '10% of remaining',
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
      createdBy: user.id,
    })
    await setRuleEnabled(ctx, rule.id, true)

    return { ctx, session, project, card, rule }
  }

  it('explains governing rules, attribute values, and merge for a card', async () => {
    const { ctx, session, project, card, rule } = await seedWorld()

    const evaluated = await evaluateAndApply(
      ctx,
      { triggerEvent: 'budget.updated', projectId: project.id, now: NOW },
      { airwallex: mockClient() },
    )

    const res = await explain(
      buildRequest({
        method: 'GET',
        path: `/api/cards/${card.id}/explain`,
        session,
        params: { id: card.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, cardExplainContracts.explain.output)

    expect(body.cardId).toBe(card.id)
    expect(body.projectId).toBe(project.id)
    expect(body.finalControls.transactionLimits.limits[0]?.amount).toBe(100_000)
    expect(body.governingRules.some((entry) => entry.ruleId === rule.id && entry.matched)).toBe(
      true,
    )
    expect(body.merge.some((entry) => entry.field.startsWith('transactionLimits'))).toBe(true)
    expect(body.attributeValues.some((entry) => entry.key === 'project.budget.remaining')).toBe(
      true,
    )
    expect(body.lastRuleRunId).toBe(evaluated.runs[0]?.id)
    expect(body.lastEvaluatedAt).not.toBeNull()
  })

  it('reports merged desired limits even when appliedControls have not been pushed', async () => {
    const { session, card } = await seedWorld()
    const res = await explain(
      buildRequest({
        method: 'GET',
        path: `/api/cards/${card.id}/explain`,
        session,
        params: { id: card.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, cardExplainContracts.explain.output)
    expect(body.finalControls.transactionLimits.limits[0]?.amount).toBe(100_000)
    expect(body.lastRuleRunId).toBeNull()
  })

  it('ignores a later unmatched empty SKIPPED run when attaching lastRuleRunId', async () => {
    const { ctx, session, project, card } = await seedWorld()
    const evaluated = await evaluateAndApply(
      ctx,
      { triggerEvent: 'budget.updated', projectId: project.id, now: NOW },
      { airwallex: mockClient() },
    )
    await RuleRunModel.create({
      orgId: session.orgId,
      ruleId: evaluated.runs[0]?.ruleId ?? 'rule',
      triggeredBy: session.userId,
      triggeredByType: ActorType.USER,
      triggerEvent: 'seed_b9_activity_run',
      inputs: [],
      matched: false,
      desiredState: {},
      diff: {},
      actions: [],
      conflicts: [],
      status: RuleRunStatus.SKIPPED,
      skipReason: 'SEED activity sample',
      failureReason: null,
      durationMs: 1,
      startedAt: new Date('2026-08-11T06:00:00.000Z'),
      finishedAt: new Date('2026-08-11T06:00:00.001Z'),
      cardIds: [card.id],
      projectId: project.id,
    })

    const res = await explain(
      buildRequest({
        method: 'GET',
        path: `/api/cards/${card.id}/explain`,
        session,
        params: { id: card.id },
      }),
    )
    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, cardExplainContracts.explain.output)
    expect(body.lastRuleRunId).toBe(evaluated.runs[0]?.id)
    expect(body.finalControls.transactionLimits.limits[0]?.amount).toBe(100_000)
  })

  it('returns 404 for unknown cards', async () => {
    const { session } = await seedWorld()
    const res = await explain(
      buildRequest({
        method: 'GET',
        path: '/api/cards/000000000000000000000000/explain',
        session,
        params: { id: '000000000000000000000000' },
      }),
    )
    expect(res.status).toBe(404)
  })
})
