/**
 * RULES-ENGINE §6 worked examples — end-to-end against fixtures.
 * Amounts are integer minor units (invariant 2); the doc's illustrative
 * major-unit figures are scaled ×100 for USD.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import type { AirwallexClient } from '@/server/airwallex/client'
import { handleDomainEventForRules } from '@/server/events/handlers/rules'
import { DomainEventType } from '@/server/events/types'
import type { OrgContext } from '@/server/http/types'
import { AttributeDefinitionModel } from '@/server/models/AttributeDefinition'
import { AttributeValueModel } from '@/server/models/AttributeValue'
import { CardModel } from '@/server/models/Card'
import { RuleModel } from '@/server/models/Rule'
import { RuleRunModel } from '@/server/models/RuleRun'
import { resetEventPublisher } from '@/server/events/bus'
import { resetRedis } from '@/server/redis'
import { createAttributeDefinition } from '@/server/repositories/attributeDefinitions'
import { putAttributeValue } from '@/server/repositories/attributeValues'
import { appendEntry } from '@/server/repositories/budgetEntries'
import { upsertBudgetFields } from '@/server/repositories/budgets'
import { createCard, findCardById } from '@/server/repositories/cards'
import { createCardholder } from '@/server/repositories/cardholders'
import { createOrganization } from '@/server/repositories/organizations'
import { addProjectMember } from '@/server/repositories/projectMembers'
import { createProject, updateStatus } from '@/server/repositories/projects'
import { createRole } from '@/server/repositories/roles'
import { createRule, setRuleEnabled } from '@/server/repositories/rules'
import { createRuleRun } from '@/server/repositories/ruleRuns'
import { evaluateAndApply } from '@/server/services/rules/evaluateAndApply'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ActionResultStatus } from '@/shared/enums/actionResultStatus'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { AttributeScope } from '@/shared/enums/attributeScope'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { AttributeType } from '@/shared/enums/attributeType'
import { ActorType } from '@/shared/enums/audit'
import { BudgetEntrySourceType } from '@/shared/enums/budgetEntrySourceType'
import { BudgetEntryType } from '@/shared/enums/budgetEntryType'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { CardStatus } from '@/shared/enums/cardStatus'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { DesiredCardStatus } from '@/shared/enums/desiredCardStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { CardControls } from '@/shared/types/cardControls'

const NOW = new Date('2026-08-11T12:00:00.000Z')

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

async function seedBase() {
  const org = await createOrganization({
    name: 'Examples Org',
    slug: `org-${Math.random().toString(36).slice(2)}`,
    country: 'AU',
    baseCurrency: 'USD',
    createdBy: 'user_1',
  })
  const ctx: OrgContext = { orgId: org.id, userId: 'user_1', orgRole: OrgRole.OWNER }
  const project = await createProject(ctx, {
    name: 'APAC Launch',
    code: 'APAC',
    startDate: new Date('2026-08-01T00:00:00.000Z'),
    endDate: new Date('2026-12-31T00:00:00.000Z'),
  })
  await updateStatus(ctx, project.id, ProjectStatus.DRAFT, ProjectStatus.ACTIVE, {
    approvedAt: new Date('2026-07-25T00:00:00.000Z'),
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
  return { ctx, project }
}

describe('rules/examples (RULES-ENGINE §6)', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      CardModel.syncIndexes(),
      RuleModel.syncIndexes(),
      RuleRunModel.syncIndexes(),
      AttributeDefinitionModel.syncIndexes(),
      AttributeValueModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetRedis()
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  it('A — card.create resolves member targets on project.launched', async () => {
    const { ctx, project } = await seedBase()
    const role = await createRole(ctx, {
      key: 'project_spender',
      name: 'Project Spender',
      permissions: [],
      isTemplate: false,
    })
    await addProjectMember(ctx, {
      projectId: project.id,
      userId: 'user_spender',
      roleId: role.id,
      scope: { level: AccessScopeLevel.OWN },
      effectivePermissions: [],
      addedBy: 'user_1',
    })

    const rule = await createRule(ctx, {
      scope: { level: RuleScopeLevel.PROJECT, projectId: project.id },
      name: 'Issue member cards on project launch',
      trigger: { events: [DomainEventType.PROJECT_LAUNCHED] },
      when: {
        all: [
          { attr: 'project.status', op: ConditionOperator.EQ, value: 'ACTIVE' },
          { attr: 'project.budget.approved', op: ConditionOperator.GT, value: 0 },
        ],
      },
      then: [
        {
          action: RuleActionType.CARD_CREATE,
          target: {
            select: RuleTargetSelect.PROJECT_MEMBERS,
            filter: { roleKeys: ['project_spender'] },
          },
          params: {
            formFactor: 'VIRTUAL',
            purpose: CardPurpose.MEMBER,
            allowedTransactionCount: AllowedTransactionCount.MULTIPLE,
            transactionLimits: {
              currency: 'USD',
              limits: [
                {
                  interval: TransactionLimitInterval.MONTHLY,
                  amount: 'project.budget.approved / max(project.headcount, 1) * 0.25',
                },
              ],
            },
            activeFrom: 'project.startDate',
            activeTo: 'project.endDate',
          },
        },
      ],
      createdBy: 'user_1',
    })
    await setRuleEnabled(ctx, rule.id, true)

    const result = await evaluateAndApply(
      ctx,
      { triggerEvent: DomainEventType.PROJECT_LAUNCHED, projectId: project.id, now: NOW },
      { airwallex: mockClient() },
    )

    expect(result.runs[0]?.matched).toBe(true)
    expect(result.runs[0]?.status).toBe(RuleRunStatus.SUCCESS)
    const createAction = result.runs[0]?.actions.find(
      (a) => a.action === RuleActionType.CARD_CREATE,
    )
    expect(createAction?.status).toBe(ActionResultStatus.WOULD_APPLY)
    expect(createAction?.targetId).toBe('user_spender')
    expect(createAction?.details).toMatchObject({
      controls: {
        transactionLimits: {
          limits: [{ amount: 250_000 }], // 1_000_000 / 1 * 0.25
        },
      },
    })
  })

  it('B — crossedAbove utilisation freezes MEMBER cards', async () => {
    const { ctx, project } = await seedBase()
    // Push utilisation through 90%: 910_000 committed of 1_000_000 → 91%.
    await appendEntry(ctx, {
      projectId: project.id,
      type: BudgetEntryType.COMMITMENT,
      amount: 910_000,
      currency: 'USD',
      sourceType: BudgetEntrySourceType.MANUAL,
      sourceId: 'commit',
      createdBy: 'user_1',
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
      nickName: 'Member',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.ACTIVE,
      desiredControls: controls(),
      appliedControls: controls(),
    })

    const rule = await createRule(ctx, {
      scope: { level: RuleScopeLevel.PROJECT, projectId: project.id },
      name: 'Freeze member cards when budget drops below 10%',
      priority: 10,
      trigger: { events: [DomainEventType.BUDGET_UPDATED] },
      when: {
        attr: 'project.budget.utilisationPct',
        op: ConditionOperator.CROSSED_ABOVE,
        value: 90,
      },
      then: [
        {
          action: RuleActionType.CARD_FREEZE,
          target: {
            select: RuleTargetSelect.PROJECT_CARDS,
            filter: { purpose: CardPurpose.MEMBER },
          },
          params: { reason: 'Project budget below 10% remaining' },
        },
        {
          action: RuleActionType.NOTIFY,
          target: {
            select: RuleTargetSelect.PROJECT_MEMBERS,
            filter: { roleKeys: ['project_manager'] },
          },
          params: { template: 'budget_floor_breached' },
        },
      ],
      createdBy: 'user_1',
    })
    await setRuleEnabled(ctx, rule.id, true)

    // Previous run saw 80% — the crossing is what fires, not the absolute value.
    await createRuleRun(ctx, {
      ruleId: rule.id,
      triggeredBy: 'system',
      triggeredByType: ActorType.SYSTEM,
      triggerEvent: DomainEventType.BUDGET_UPDATED,
      inputs: [
        {
          key: 'project.budget.utilisationPct',
          subjectType: AttributeSubjectType.PROJECT,
          subjectId: project.id,
          value: 80,
          observedAt: new Date('2026-08-10T00:00:00.000Z').toISOString(),
          ttlSec: null,
          stale: false,
        },
      ],
      matched: false,
      desiredState: { cards: [] },
      diff: { cards: [] },
      actions: [],
      conflicts: [],
      status: RuleRunStatus.SUCCESS,
      durationMs: 1,
      startedAt: new Date('2026-08-10T00:00:00.000Z'),
      finishedAt: new Date('2026-08-10T00:00:00.000Z'),
      projectId: project.id,
    })

    const result = await evaluateAndApply(
      ctx,
      { triggerEvent: DomainEventType.BUDGET_UPDATED, projectId: project.id, now: NOW },
      { airwallex: mockClient() },
    )

    expect(result.runs[0]?.matched).toBe(true)
    expect(result.pipeline.desiredState.cards[0]?.cardStatus).toBe(DesiredCardStatus.INACTIVE)
    expect((await findCardById(ctx, card.id))?.status).toBe(CardStatus.INACTIVE)
    expect(result.runs[0]?.actions.find((a) => a.action === RuleActionType.NOTIFY)?.status).toBe(
      ActionResultStatus.SKIPPED,
    )
  })

  it('C — campaign ROAS drives the weekly limit (else branch when low)', async () => {
    const { ctx, project } = await seedBase()
    const cardholder = await createCardholder(ctx, {
      userId: 'user_mkt',
      airwallexCardholderId: 'aw_ch_c',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.READY,
    })
    const card = await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'aw_card_c',
      maskedNumber: '************2222',
      nickName: 'Campaign APAC',
      purpose: CardPurpose.SHARED,
      status: CardStatus.ACTIVE,
      desiredControls: controls({
        transactionLimits: {
          currency: 'USD',
          limits: [{ interval: TransactionLimitInterval.WEEKLY, amount: 50_000 }],
        },
      }),
      appliedControls: controls({
        transactionLimits: {
          currency: 'USD',
          limits: [{ interval: TransactionLimitInterval.WEEKLY, amount: 50_000 }],
        },
      }),
    })

    for (const def of [
      {
        key: 'campaign.roas',
        label: 'ROAS',
        type: AttributeType.NUMBER,
        scope: AttributeScope.PROJECT,
      },
      {
        key: 'campaign.status',
        label: 'Status',
        type: AttributeType.STRING,
        scope: AttributeScope.PROJECT,
      },
    ] as const) {
      await createAttributeDefinition(ctx, {
        ...def,
        source: AttributeSource.MANUAL,
      })
    }

    const rule = await createRule(ctx, {
      scope: { level: RuleScopeLevel.PROJECT, projectId: project.id },
      name: 'Scale campaign card with ROAS',
      trigger: { events: [DomainEventType.ATTRIBUTE_UPDATED] },
      when: {
        all: [
          { attr: 'campaign.roas', op: ConditionOperator.GTE, value: 2.0 },
          { attr: 'campaign.status', op: ConditionOperator.EQ, value: 'RUNNING' },
        ],
      },
      then: [
        {
          action: RuleActionType.CARD_SET_CONTROLS,
          target: { select: RuleTargetSelect.CARD, cardId: card.id },
          params: {
            transactionLimits: {
              currency: 'USD',
              // Doc used major units; Allocard stores minor units.
              limits: [
                {
                  interval: TransactionLimitInterval.WEEKLY,
                  amount: 'clamp(campaign.roas * 200000, 100000, 2500000)',
                },
              ],
            },
          },
        },
      ],
      else: [
        {
          action: RuleActionType.CARD_SET_CONTROLS,
          target: { select: RuleTargetSelect.CARD, cardId: card.id },
          params: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.WEEKLY, amount: 100_000 }],
            },
          },
        },
      ],
      createdBy: 'user_1',
    })
    await setRuleEnabled(ctx, rule.id, true)

    await putAttributeValue(ctx, {
      key: 'campaign.roas',
      subjectType: AttributeSubjectType.PROJECT,
      subjectId: project.id,
      value: 4.0,
      source: AttributeSource.MANUAL,
    })
    await putAttributeValue(ctx, {
      key: 'campaign.status',
      subjectType: AttributeSubjectType.PROJECT,
      subjectId: project.id,
      value: 'RUNNING',
      source: AttributeSource.MANUAL,
    })

    const hot = await evaluateAndApply(
      ctx,
      { triggerEvent: DomainEventType.ATTRIBUTE_UPDATED, projectId: project.id, now: NOW },
      { airwallex: mockClient() },
    )
    expect(hot.runs[0]?.matched).toBe(true)
    expect(
      (await findCardById(ctx, card.id))?.appliedControls.transactionLimits.limits[0]?.amount,
    ).toBe(800_000) // clamp(4 * 200000, …) = 800_000

    await putAttributeValue(ctx, {
      key: 'campaign.roas',
      subjectType: AttributeSubjectType.PROJECT,
      subjectId: project.id,
      value: 1.2,
      source: AttributeSource.MANUAL,
    })
    const cold = await evaluateAndApply(
      ctx,
      { triggerEvent: DomainEventType.ATTRIBUTE_UPDATED, projectId: project.id, now: NOW },
      { airwallex: mockClient() },
    )
    expect(cold.runs[0]?.matched).toBe(false)
    expect(
      (await findCardById(ctx, card.id))?.appliedControls.transactionLimits.limits[0]?.amount,
    ).toBe(100_000)
  })

  it('D — vendor card create with offset window and EVENT_SUBJECT', async () => {
    const { ctx, project } = await seedBase()

    for (const def of [
      { key: 'request.type', label: 'Type', type: AttributeType.STRING, scope: AttributeScope.ORG },
      {
        key: 'request.amount',
        label: 'Amount',
        type: AttributeType.NUMBER,
        scope: AttributeScope.ORG,
      },
      {
        key: 'request.currency',
        label: 'Currency',
        type: AttributeType.STRING,
        scope: AttributeScope.ORG,
      },
      {
        key: 'request.vendor.mccList',
        label: 'MCC list',
        type: AttributeType.STRING,
        scope: AttributeScope.ORG,
      },
    ] as const) {
      await createAttributeDefinition(ctx, { ...def, source: AttributeSource.MANUAL })
    }

    const requestId = 'req_vendor_1'
    await putAttributeValue(ctx, {
      key: 'request.type',
      subjectType: AttributeSubjectType.ORG,
      subjectId: ctx.orgId,
      value: 'VENDOR_PAYMENT',
      source: AttributeSource.MANUAL,
    })
    await putAttributeValue(ctx, {
      key: 'request.amount',
      subjectType: AttributeSubjectType.ORG,
      subjectId: ctx.orgId,
      value: 2_000_000,
      source: AttributeSource.MANUAL,
    })
    await putAttributeValue(ctx, {
      key: 'request.currency',
      subjectType: AttributeSubjectType.ORG,
      subjectId: ctx.orgId,
      value: 'USD',
      source: AttributeSource.MANUAL,
    })
    await putAttributeValue(ctx, {
      key: 'request.vendor.mccList',
      subjectType: AttributeSubjectType.ORG,
      subjectId: ctx.orgId,
      value: '5732,5045',
      source: AttributeSource.MANUAL,
    })

    const rule = await createRule(ctx, {
      scope: { level: RuleScopeLevel.ORG },
      name: 'One-time vendor card on approved purchase request',
      trigger: { events: [DomainEventType.REQUEST_APPROVED] },
      when: {
        all: [
          { attr: 'request.type', op: ConditionOperator.EQ, value: 'VENDOR_PAYMENT' },
          { attr: 'request.amount', op: ConditionOperator.LTE, value: 2_500_000 },
        ],
      },
      then: [
        {
          action: RuleActionType.CARD_CREATE,
          target: { select: RuleTargetSelect.EVENT_SUBJECT },
          params: {
            formFactor: 'VIRTUAL',
            purpose: CardPurpose.ONE_TIME,
            allowedTransactionCount: AllowedTransactionCount.SINGLE,
            transactionLimits: {
              currency: 'request.currency',
              limits: [
                {
                  interval: TransactionLimitInterval.PER_TRANSACTION,
                  amount: 'request.amount * 1.02',
                },
              ],
            },
            allowedMerchantCategories: 'request.vendor.mccList',
            activeToOffsetDays: 7,
          },
        },
      ],
      createdBy: 'user_1',
    })
    await setRuleEnabled(ctx, rule.id, true)

    const result = await evaluateAndApply(
      ctx,
      {
        triggerEvent: DomainEventType.REQUEST_APPROVED,
        projectId: project.id,
        eventSubject: { memberIds: [requestId] },
        now: NOW,
      },
      { airwallex: mockClient() },
    )

    expect(result.runs[0]?.matched).toBe(true)
    const action = result.runs[0]?.actions[0]
    expect(action?.status).toBe(ActionResultStatus.WOULD_APPLY)
    expect(action?.targetId).toBe(requestId)
    const details = action?.details as {
      controls: { transactionLimits: { limits: { amount: number }[] }; activeTo: string }
    }
    expect(details.controls.transactionLimits.limits[0]?.amount).toBe(2_040_000)
    expect(details.controls.activeTo).toBe('2026-08-18T12:00:00.000Z')
  })

  it('E — role change re-derives card limits; access/flag stay SKIPPED', async () => {
    const { ctx, project } = await seedBase()
    const role = await createRole(ctx, {
      key: 'project_spender',
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
      addedBy: 'user_1',
    })
    const cardholder = await createCardholder(ctx, {
      userId: 'user_member',
      airwallexCardholderId: 'aw_ch_e',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.READY,
    })
    const card = await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'aw_card_e',
      maskedNumber: '************3333',
      nickName: 'Member',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.ACTIVE,
      desiredControls: controls(),
      appliedControls: controls(),
    })

    await createAttributeDefinition(ctx, {
      key: 'member.status',
      label: 'Member status',
      type: AttributeType.STRING,
      scope: AttributeScope.MEMBER,
      source: AttributeSource.MANUAL,
    })
    await createAttributeDefinition(ctx, {
      key: 'role.monthlyCap',
      label: 'Role monthly cap',
      type: AttributeType.NUMBER,
      scope: AttributeScope.MEMBER,
      source: AttributeSource.MANUAL,
    })
    await putAttributeValue(ctx, {
      key: 'member.status',
      subjectType: AttributeSubjectType.MEMBER,
      subjectId: 'user_member',
      value: 'ACTIVE',
      source: AttributeSource.MANUAL,
    })
    await putAttributeValue(ctx, {
      key: 'role.monthlyCap',
      subjectType: AttributeSubjectType.MEMBER,
      subjectId: 'user_member',
      value: 150_000,
      source: AttributeSource.MANUAL,
    })

    const rule = await createRule(ctx, {
      scope: { level: RuleScopeLevel.PROJECT, projectId: project.id },
      name: 'Recalculate access on role change',
      trigger: {
        events: [DomainEventType.MEMBER_ROLE_CHANGED, DomainEventType.MEMBER_SCOPE_CHANGED],
      },
      when: { attr: 'member.status', op: ConditionOperator.EQ, value: 'ACTIVE' },
      then: [
        {
          action: RuleActionType.ACCESS_GRANT,
          target: { select: RuleTargetSelect.EVENT_SUBJECT },
          params: { recompute: true },
        },
        {
          action: RuleActionType.CARD_SET_CONTROLS,
          target: { select: RuleTargetSelect.MEMBER_CARDS },
          params: {
            transactionLimits: {
              currency: 'USD',
              limits: [
                {
                  interval: TransactionLimitInterval.MONTHLY,
                  amount: 'min(role.monthlyCap, project.budget.remaining * 0.1)',
                },
              ],
            },
          },
        },
        {
          action: RuleActionType.FLAG_REVIEW,
          target: { select: RuleTargetSelect.EVENT_SUBJECT },
          params: { reason: 'role change' },
        },
      ],
      createdBy: 'user_1',
    })
    await setRuleEnabled(ctx, rule.id, true)

    const result = await evaluateAndApply(
      ctx,
      {
        triggerEvent: DomainEventType.MEMBER_ROLE_CHANGED,
        projectId: project.id,
        eventSubject: { memberIds: ['user_member'] },
        now: NOW,
      },
      { airwallex: mockClient() },
    )

    expect(result.runs[0]?.matched).toBe(true)
    expect(
      result.runs[0]?.actions.find((a) => a.action === RuleActionType.ACCESS_GRANT)?.status,
    ).toBe(ActionResultStatus.SKIPPED)
    expect(
      result.runs[0]?.actions.find((a) => a.action === RuleActionType.FLAG_REVIEW)?.status,
    ).toBe(ActionResultStatus.SKIPPED)
    expect(
      (await findCardById(ctx, card.id))?.appliedControls.transactionLimits.limits[0]?.amount,
    ).toBe(100_000) // min(150_000, 1_000_000 * 0.1)
  })

  it('event path: attribute.updated handler evaluates matching rules', async () => {
    const { ctx, project } = await seedBase()
    const cardholder = await createCardholder(ctx, {
      userId: 'user_h',
      airwallexCardholderId: 'aw_ch_h',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.READY,
    })
    const card = await createCard(ctx, {
      projectId: project.id,
      cardholderId: cardholder.id,
      airwallexCardId: 'aw_card_h',
      maskedNumber: '************4444',
      nickName: 'H',
      purpose: CardPurpose.MEMBER,
      status: CardStatus.ACTIVE,
      desiredControls: controls(),
      appliedControls: controls(),
    })
    const rule = await createRule(ctx, {
      scope: { level: RuleScopeLevel.PROJECT, projectId: project.id },
      name: 'On attribute',
      trigger: { events: [DomainEventType.ATTRIBUTE_UPDATED] },
      when: { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
      then: [
        {
          action: RuleActionType.CARD_SET_CONTROLS,
          target: { select: RuleTargetSelect.PROJECT_CARDS },
          params: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 77_000 }],
            },
          },
        },
      ],
      createdBy: 'user_1',
    })
    await setRuleEnabled(ctx, rule.id, true)

    await handleDomainEventForRules(
      {
        type: DomainEventType.ATTRIBUTE_UPDATED,
        orgId: ctx.orgId,
        projectId: project.id,
        subjectType: 'attribute',
        subjectId: 'campaign.roas',
        payload: {},
        emittedAt: NOW,
      },
      { airwallex: mockClient() },
    )

    expect(
      (await findCardById(ctx, card.id))?.appliedControls.transactionLimits.limits[0]?.amount,
    ).toBe(77_000)
  })
})
