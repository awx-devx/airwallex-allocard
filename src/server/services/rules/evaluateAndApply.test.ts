import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import type { AirwallexClient } from '@/server/airwallex/client'
import { AuditLogModel } from '@/server/models/AuditLog'
import { CardModel } from '@/server/models/Card'
import { RuleModel } from '@/server/models/Rule'
import { RuleRunModel } from '@/server/models/RuleRun'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
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
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
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
      details: vi.fn(),
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

describe('rules/evaluateAndApply', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      CardModel.syncIndexes(),
      RuleModel.syncIndexes(),
      RuleRunModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetRedis()
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  it('applies the merged limit, writes a snapshot, records the run, and emits rule.evaluated', async () => {
    const { ctx, project, card } = await seedWorld()
    const rule = await createRule(ctx, limitRule(project.id))
    await setRuleEnabled(ctx, rule.id, true)
    const update = vi.fn().mockResolvedValue({})

    const result = await evaluateAndApply(
      ctx,
      { triggerEvent: 'budget.updated', projectId: project.id, now: NOW },
      { airwallex: mockClient(update) },
    )

    // 10% of 1,000,000 minor units remaining.
    const stored = await findCardById(ctx, card.id)
    expect(stored?.appliedControls.transactionLimits.limits[0]?.amount).toBe(100_000)

    expect(result.runs).toHaveLength(1)
    expect(result.runs[0]?.status).toBe(RuleRunStatus.SUCCESS)
    expect(result.runs[0]?.matched).toBe(true)
    expect(result.runs[0]?.inputs.map((entry) => entry.key)).toContain('project.budget.remaining')
    expect(result.runs[0]?.diff.cards[0]?.changed).toBe(true)

    const snapshot = await getRedis().get(redisKeys.policyCard(card.id))
    expect(snapshot).not.toBeNull()

    const events = getPublishedEvents().filter(
      (event) => event.type === DomainEventType.RULE_EVALUATED,
    )
    expect(events).toHaveLength(1)
    expect(events[0]?.payload).toMatchObject({ ruleId: rule.id, matched: true })

    const audits = await AuditLogModel.find({ orgId: ctx.orgId, action: 'rule.applied' }).exec()
    expect(audits).toHaveLength(1)
  })

  it('records a run but makes no Airwallex call when nothing changed', async () => {
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
                limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 400_000 }],
              },
            },
          },
        ],
      }),
    )
    await setRuleEnabled(ctx, rule.id, true)
    const update = vi.fn().mockResolvedValue({})

    const result = await evaluateAndApply(
      ctx,
      { triggerEvent: 'budget.updated', projectId: project.id, now: NOW },
      { airwallex: mockClient(update) },
    )

    expect(update).not.toHaveBeenCalled()
    expect(result.runs[0]?.diff.cards[0]?.changed).toBe(false)
    expect((await listRuleRuns(ctx)).total).toBe(1)

    const audits = await AuditLogModel.find({ orgId: ctx.orgId, action: 'rule.applied' }).exec()
    expect(audits).toHaveLength(0)
  })

  it('records one run per rule and one bad rule does not stop the other', async () => {
    const { ctx, project, card } = await seedWorld()
    const good = await createRule(ctx, limitRule(project.id))
    const broken = await createRule(
      ctx,
      limitRule(project.id, {
        name: 'Broken rule',
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
    await setRuleEnabled(ctx, good.id, true)
    await setRuleEnabled(ctx, broken.id, true)

    const result = await evaluateAndApply(
      ctx,
      { triggerEvent: 'budget.updated', projectId: project.id, now: NOW },
      { airwallex: mockClient(vi.fn().mockResolvedValue({})) },
    )

    expect(result.runs).toHaveLength(2)
    const brokenRun = result.runs.find((run) => run.ruleId === broken.id)
    expect(brokenRun?.status).toBe(RuleRunStatus.FAILED)
    expect(brokenRun?.failureReason).toContain('nope.missing')

    expect(result.runs.find((run) => run.ruleId === good.id)?.status).toBe(RuleRunStatus.SUCCESS)
    expect(
      (await findCardById(ctx, card.id))?.appliedControls.transactionLimits.limits[0]?.amount,
    ).toBe(100_000)
  })

  it('records the previous run values so crossedAbove can fire on the next pass', async () => {
    const { ctx, project } = await seedWorld()
    const rule = await createRule(ctx, limitRule(project.id))
    await setRuleEnabled(ctx, rule.id, true)

    await evaluateAndApply(
      ctx,
      { triggerEvent: 'budget.updated', projectId: project.id, now: NOW },
      { airwallex: mockClient(vi.fn().mockResolvedValue({})) },
    )
    const runs = await listRuleRuns(ctx, { ruleId: rule.id })

    expect(runs.items[0]?.inputs.find((i) => i.key === 'project.budget.remaining')?.value).toBe(
      1_000_000,
    )
  })

  it('records PARTIAL on an impossible merge and makes no Airwallex call', async () => {
    const { ctx, project, card } = await seedWorld()

    const usd = await createRule(
      ctx,
      limitRule(project.id, {
        name: 'USD only',
        then: [
          {
            action: RuleActionType.CARD_SET_CONTROLS,
            target: { select: RuleTargetSelect.PROJECT_CARDS },
            params: {
              allowedCurrencies: ['USD'],
              transactionLimits: {
                currency: 'USD',
                limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 100_000 }],
              },
            },
          },
        ],
      }),
    )
    const eur = await createRule(
      ctx,
      limitRule(project.id, {
        name: 'EUR only',
        then: [
          {
            action: RuleActionType.CARD_SET_CONTROLS,
            target: { select: RuleTargetSelect.PROJECT_CARDS },
            params: {
              allowedCurrencies: ['EUR'],
              transactionLimits: {
                currency: 'USD',
                limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 100_000 }],
              },
            },
          },
        ],
      }),
    )
    await setRuleEnabled(ctx, usd.id, true)
    await setRuleEnabled(ctx, eur.id, true)

    const update = vi.fn().mockResolvedValue({})
    const result = await evaluateAndApply(
      ctx,
      { triggerEvent: 'budget.updated', projectId: project.id, now: NOW },
      { airwallex: mockClient(update) },
    )

    expect(result.pipeline.conflicts.some((c) => c.kind === 'EMPTY_CURRENCY_INTERSECTION')).toBe(
      true,
    )
    expect(result.runs.every((run) => run.status === RuleRunStatus.PARTIAL)).toBe(true)
    expect(update).not.toHaveBeenCalled()
    // Applied controls unchanged — conflict means nothing pushed.
    expect(
      (await findCardById(ctx, card.id))?.appliedControls.transactionLimits.limits[0]?.amount,
    ).toBe(400_000)
  })
})
