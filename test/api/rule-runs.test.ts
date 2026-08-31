import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { GET as getRun } from '@/app/api/rule-runs/[id]/route'
import { GET as listRuns } from '@/app/api/rule-runs/route'
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
import { ruleRunContracts } from '@/shared/contracts/ruleRun'
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
      details: vi.fn(),
    },
    transactions: {} as AirwallexClient['transactions'],
    config: {} as AirwallexClient['config'],
    panTokens: {} as AirwallexClient['panTokens'],
  }
}

describe('/api/rule-runs', () => {
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

  async function seedAndEvaluate() {
    const user = await users.createUser({
      email: `u-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Runs User',
    })
    const org = await organizations.createOrganization({
      name: 'Runs Org',
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

    const result = await evaluateAndApply(
      ctx,
      { triggerEvent: 'budget.updated', projectId: project.id, now: NOW },
      { airwallex: mockClient() },
    )

    return { session, project, card, rule, run: result.runs[0]! }
  }

  it('lists and gets rule runs with enough detail for why-is-my-limit', async () => {
    const { session, project, card, rule, run } = await seedAndEvaluate()

    const list = await listRuns(
      buildRequest({
        method: 'GET',
        path: '/api/rule-runs',
        session,
        query: { projectId: project.id, ruleId: rule.id },
      }),
    )
    expect(list.status).toBe(200)
    const listed = await expectMatchesContract(list, ruleRunContracts.list.output)
    expect(listed.total).toBe(1)
    expect(listed.items[0]?.inputs.some((entry) => entry.key === 'project.budget.remaining')).toBe(
      true,
    )
    expect(listed.items[0]?.diff.cards[0]?.cardId).toBe(card.id)

    const byCard = await listRuns(
      buildRequest({
        method: 'GET',
        path: '/api/rule-runs',
        session,
        query: { cardId: card.id },
      }),
    )
    expect((await expectMatchesContract(byCard, ruleRunContracts.list.output)).total).toBe(1)

    const get = await getRun(
      buildRequest({
        method: 'GET',
        path: `/api/rule-runs/${run.id}`,
        session,
        params: { id: run.id },
      }),
    )
    expect(get.status).toBe(200)
    const body = await expectMatchesContract(get, ruleRunContracts.get.output)
    expect(body.id).toBe(run.id)
    expect(body.matched).toBe(true)
  })

  it('lists runs whose stored desiredState omitted cards', async () => {
    const { session, project, rule } = await seedAndEvaluate()
    await RuleRunModel.create({
      orgId: session.orgId,
      ruleId: rule.id,
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
      cardIds: [],
      projectId: project.id,
    })

    const list = await listRuns(
      buildRequest({
        method: 'GET',
        path: '/api/rule-runs',
        session,
        query: { projectId: project.id },
      }),
    )
    expect(list.status).toBe(200)
    const listed = await expectMatchesContract(list, ruleRunContracts.list.output)
    expect(listed.total).toBe(2)
    expect(listed.items.every((item) => Array.isArray(item.desiredState.cards))).toBe(true)
  })

  it('returns 404 for another org', async () => {
    const { run } = await seedAndEvaluate()
    const otherUser = await users.createUser({
      email: `o-${Date.now()}@example.com`,
      name: 'Other',
    })
    const otherOrg = await organizations.createOrganization({
      name: 'Other',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: otherUser.id,
    })
    await memberships.createMembership(
      { orgId: otherOrg.id, userId: otherUser.id, orgRole: OrgRole.OWNER },
      { userId: otherUser.id, orgRole: OrgRole.OWNER },
    )

    const res = await getRun(
      buildRequest({
        method: 'GET',
        path: `/api/rule-runs/${run.id}`,
        session: {
          userId: otherUser.id,
          orgId: otherOrg.id,
          orgRole: OrgRole.OWNER,
          onboarded: true,
        },
        params: { id: run.id },
      }),
    )
    expect(res.status).toBe(404)
  })
})
