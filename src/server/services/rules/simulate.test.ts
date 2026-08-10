import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import type { AirwallexClient } from '@/server/airwallex/client'
import { AttributeValueModel } from '@/server/models/AttributeValue'
import { CardModel } from '@/server/models/Card'
import { RuleModel } from '@/server/models/Rule'
import { RuleRunModel } from '@/server/models/RuleRun'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import type { OrgContext } from '@/server/http/types'
import { getRedis, redisKeys, resetRedis } from '@/server/redis'
import { appendEntry } from '@/server/repositories/budgetEntries'
import { upsertBudgetFields } from '@/server/repositories/budgets'
import { createCard, findCardById } from '@/server/repositories/cards'
import { createCardholder } from '@/server/repositories/cardholders'
import { createOrganization } from '@/server/repositories/organizations'
import { addProjectMember } from '@/server/repositories/projectMembers'
import { createProject, updateStatus } from '@/server/repositories/projects'
import { createRole } from '@/server/repositories/roles'
import { createRule, setRuleEnabled } from '@/server/repositories/rules'
import { listRuleRuns } from '@/server/repositories/ruleRuns'
import { evaluateAndApply } from '@/server/services/rules/evaluateAndApply'
import { simulateRules } from '@/server/services/rules/simulate'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
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
import type { CreateRuleFields } from '@/server/repositories/rules'

const NOW = new Date('2026-08-11T00:00:00.000Z')

function controls(overrides: Partial<CardControls> = {}): CardControls {
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
    ...overrides,
  }
}

function mockClient(updateImpl: AirwallexClient['cards']['update']): AirwallexClient {
  return {
    accountId: null,
    forAccount: () => mockClient(updateImpl),
    request: vi.fn(),
    cardholders: {} as AirwallexClient['cardholders'],
    cards: {
      create: vi.fn(),
      get: vi.fn(),
      list: vi.fn(),
      listAllTenantsUnsafe: vi.fn(),
      update: updateImpl,
      limits: vi.fn(),
      activate: vi.fn(),
    },
    transactions: {} as AirwallexClient['transactions'],
    config: {} as AirwallexClient['config'],
    panTokens: {} as AirwallexClient['panTokens'],
  }
}

function limitRule(projectId: string, overrides: Partial<CreateRuleFields> = {}): CreateRuleFields {
  return {
    scope: { level: RuleScopeLevel.PROJECT, projectId },
    name: 'Member limits track remaining budget',
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
    createdBy: 'user_1',
    ...overrides,
  }
}

async function seedWorld() {
  const org = await createOrganization({
    name: 'Test Org',
    slug: `org-${Math.random().toString(36).slice(2)}`,
    country: 'AU',
    baseCurrency: 'USD',
    createdBy: 'user_1',
  })
  const ctx: OrgContext = { orgId: org.id, userId: 'user_1', orgRole: OrgRole.OWNER }

  const project = await createProject(ctx, { name: 'APAC Launch', code: 'APAC-1' })
  await updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ACTIVE, {
    approvedAt: new Date('2026-07-25T00:00:00.000Z'),
  })

  const role = await createRole(ctx, {
    key: 'project_spender',
    name: 'Project Spender',
    permissions: [],
    isTemplate: false,
  })
  await addProjectMember(ctx, {
    projectId: project.id,
    userId: 'user_member',
    roleId: role.id,
    scope: { level: AccessScopeLevel.OWN },
    effectivePermissions: [],
    addedBy: 'user_1',
  })

  await upsertBudgetFields(ctx, project.id, { currency: 'USD', approvedAmount: 1_000_000 })
  await appendEntry(ctx, {
    projectId: project.id,
    type: BudgetEntryType.APPROVAL,
    amount: 1_000_000,
    currency: 'USD',
    sourceType: BudgetEntrySourceType.MANUAL,
    sourceId: 'seed',
    createdBy: 'user_1',
  })

  const cardholder = await createCardholder(ctx, {
    userId: 'user_member',
    airwallexCardholderId: 'aw_ch_1',
    type: CardholderType.INDIVIDUAL,
    status: CardholderStatus.READY,
  })
  const card = await createCard(ctx, {
    projectId: project.id,
    cardholderId: cardholder.id,
    airwallexCardId: 'aw_card_1',
    maskedNumber: '************1234',
    nickName: 'APAC Launch',
    purpose: CardPurpose.MEMBER,
    status: CardStatus.ACTIVE,
    desiredControls: controls(),
    appliedControls: controls(),
  })

  return { ctx, project, card }
}

describe('rules/simulate', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      CardModel.syncIndexes(),
      RuleModel.syncIndexes(),
      RuleRunModel.syncIndexes(),
      AttributeValueModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetRedis()
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  it('produces the same card diff as evaluateAndApply without writing anything', async () => {
    const { ctx, project, card } = await seedWorld()
    const rule = await createRule(ctx, limitRule(project.id))
    await setRuleEnabled(ctx, rule.id, true)

    const simulated = await simulateRules(ctx, {
      projectId: project.id,
      triggerEvent: 'budget.updated',
      now: NOW,
    })

    // Simulation must not touch cards, RuleRuns, Redis, or the event bus.
    expect(
      (await findCardById(ctx, card.id))?.appliedControls.transactionLimits.limits[0]?.amount,
    ).toBe(400_000)
    expect((await listRuleRuns(ctx)).total).toBe(0)
    expect(await getRedis().get(redisKeys.policyCard(card.id))).toBeNull()
    expect(getPublishedEvents()).toHaveLength(0)

    expect(simulated.runs).toHaveLength(1)
    expect(simulated.runs[0]?.status).toBe(RuleRunStatus.DRY_RUN)
    expect(simulated.runs[0]?.matched).toBe(true)
    expect(simulated.cardDiffs[0]?.changed).toBe(true)
    expect(simulated.cardDiffs[0]?.after.controls?.transactionLimits?.limits[0]?.amount).toBe(
      100_000,
    )

    // Same fixtures, same trigger → same diff as a real evaluation.
    const applied = await evaluateAndApply(
      ctx,
      { triggerEvent: 'budget.updated', projectId: project.id, now: NOW },
      { airwallex: mockClient(vi.fn().mockResolvedValue({})) },
    )

    expect(applied.pipeline.diff).toEqual(simulated.pipeline.diff)
    expect(applied.pipeline.desiredState).toEqual(simulated.pipeline.desiredState)
  })

  it('applies attribute overrides without persisting them', async () => {
    const { ctx, project } = await seedWorld()
    const rule = await createRule(ctx, limitRule(project.id))
    await setRuleEnabled(ctx, rule.id, true)

    const simulated = await simulateRules(ctx, {
      projectId: project.id,
      triggerEvent: 'budget.updated',
      now: NOW,
      attributeOverrides: [
        {
          key: 'project.budget.remaining',
          subjectType: AttributeSubjectType.PROJECT,
          subjectId: project.id,
          value: 500_000,
        },
      ],
    })

    expect(simulated.cardDiffs[0]?.after.controls?.transactionLimits?.limits[0]?.amount).toBe(
      50_000,
    )
    expect(await AttributeValueModel.countDocuments({ orgId: ctx.orgId }).exec()).toBe(0)
  })

  it('evaluates a draft rule that is not stored', async () => {
    const { ctx, project } = await seedWorld()

    const simulated = await simulateRules(ctx, {
      projectId: project.id,
      now: NOW,
      draftRule: {
        scope: { level: RuleScopeLevel.PROJECT, projectId: project.id },
        name: 'Draft freeze',
        trigger: { events: ['budget.updated'] },
        when: { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
        then: [
          {
            action: RuleActionType.CARD_FREEZE,
            target: { select: RuleTargetSelect.PROJECT_CARDS },
            params: {},
          },
        ],
      },
    })

    expect(simulated.runs).toHaveLength(1)
    expect(simulated.runs[0]?.ruleId).toBe('draft')
    expect(simulated.runs[0]?.status).toBe(RuleRunStatus.DRY_RUN)
    expect(simulated.cardDiffs[0]?.after.cardStatus).toBe('INACTIVE')
    expect(await RuleModel.countDocuments({ orgId: ctx.orgId }).exec()).toBe(0)
  })

  it('keeps FAILED / SKIPPED diagnostic statuses instead of masking them as DRY_RUN', async () => {
    const { ctx, project } = await seedWorld()
    const rule = await createRule(
      ctx,
      limitRule(project.id, {
        then: [
          {
            action: RuleActionType.CARD_SET_CONTROLS,
            target: { select: RuleTargetSelect.PROJECT_CARDS },
            params: {
              transactionLimits: {
                currency: 'USD',
                limits: [
                  { interval: TransactionLimitInterval.MONTHLY, amount: 'nope.missing * 2' },
                ],
              },
            },
          },
        ],
      }),
    )
    await setRuleEnabled(ctx, rule.id, true)

    const simulated = await simulateRules(ctx, {
      projectId: project.id,
      triggerEvent: 'budget.updated',
      now: NOW,
    })

    expect(simulated.runs[0]?.status).toBe(RuleRunStatus.FAILED)
    expect(simulated.runs[0]?.failureReason).toContain('nope.missing')
  })
})
