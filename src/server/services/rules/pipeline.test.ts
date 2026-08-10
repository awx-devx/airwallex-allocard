import { describe, expect, it } from 'vitest'
import { SCHEDULED_SWEEP, selectRules } from '@/server/services/rules/select'
import { collectRuleAttributeKeys } from '@/server/services/rules/context'
import { mergeContributions, type CardContribution } from '@/server/services/rules/merge'
import { diffCard } from '@/server/services/rules/diff'
import { resolveTarget } from '@/server/services/rules/targets'
import {
  runPipeline,
  type PipelineCard,
  type PipelineInput,
} from '@/server/services/rules/pipeline'
import type { AttributeContext } from '@/server/services/attributes/resolve'
import type { ResolvedAttribute } from '@/server/services/attributes/builtins'
import { ActionResultStatus } from '@/shared/enums/actionResultStatus'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { CardPurpose } from '@/shared/enums/cardPurpose'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { DesiredCardStatus } from '@/shared/enums/desiredCardStatus'
import { MergeStrategy } from '@/shared/enums/mergeStrategy'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import type { AttributeLiteral } from '@/shared/types/attribute'
import type { CardControls } from '@/shared/types/cardControls'
import type { Rule, RuleAction } from '@/shared/types/rule'

const NOW = new Date('2026-08-11T00:00:00.000Z')

function reading(
  key: string,
  value: AttributeLiteral,
  overrides: Partial<ResolvedAttribute> = {},
): ResolvedAttribute {
  return {
    key,
    subjectType: AttributeSubjectType.PROJECT,
    subjectId: 'proj_1',
    value,
    observedAt: NOW.toISOString(),
    ttlSec: null,
    source: AttributeSource.COMPUTED,
    stale: false,
    ...overrides,
  }
}

function attributes(readings: ResolvedAttribute[]): AttributeContext {
  return {
    now: NOW.toISOString(),
    readings,
    index: new Map(
      readings.map((entry) => [`${entry.key}|${entry.subjectType}|${entry.subjectId}`, entry]),
    ),
  }
}

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

function card(overrides: Partial<PipelineCard> = {}): PipelineCard {
  return {
    cardId: 'card_1',
    projectId: 'proj_1',
    purpose: CardPurpose.MEMBER,
    userId: 'user_1',
    controls: controls(),
    cardStatus: DesiredCardStatus.ACTIVE,
    ...overrides,
  }
}

const setControlsAction = (amount: string | number, overrides: Partial<RuleAction> = {}) =>
  ({
    action: RuleActionType.CARD_SET_CONTROLS,
    target: { select: RuleTargetSelect.PROJECT_CARDS },
    params: {
      transactionLimits: {
        currency: 'USD',
        limits: [{ interval: TransactionLimitInterval.MONTHLY, amount }],
      },
    },
    ...overrides,
  }) as RuleAction

function rule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'rule_1',
    orgId: 'org_1',
    scope: { level: RuleScopeLevel.PROJECT, projectId: 'proj_1' },
    name: 'Member limits track remaining budget',
    description: null,
    enabled: true,
    priority: 100,
    trigger: { events: ['budget.updated'] },
    when: { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
    then: [setControlsAction('project.budget.remaining * 0.10')],
    createdBy: 'user_1',
    version: 1,
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    ...overrides,
  }
}

function pipelineInput(overrides: Partial<PipelineInput> = {}): PipelineInput {
  return {
    rules: [rule()],
    attributes: attributes([reading('project.budget.remaining', 600_000)]),
    cards: [card()],
    members: [{ userId: 'user_1', roleKey: 'project_spender' }],
    triggerEvent: 'budget.updated',
    projectId: 'proj_1',
    now: NOW,
    ...overrides,
  }
}

describe('rules/pipeline', () => {
  describe('step 1 — select', () => {
    it('takes enabled rules whose scope and trigger match', () => {
      const orgRule = rule({ id: 'r_org', scope: { level: RuleScopeLevel.ORG }, priority: 10 })
      const otherProject = rule({
        id: 'r_other',
        scope: { level: RuleScopeLevel.PROJECT, projectId: 'proj_2' },
      })
      const disabled = rule({ id: 'r_off', enabled: false })
      const otherEvent = rule({ id: 'r_evt', trigger: { events: ['project.launched'] } })

      const selected = selectRules({
        rules: [rule(), orgRule, otherProject, disabled, otherEvent],
        triggerEvent: 'budget.updated',
        projectId: 'proj_1',
      })

      expect(selected.map((entry) => entry.id)).toEqual(['r_org', 'rule_1'])
    })

    it('only picks up scheduled rules on a sweep — the event path is the mechanism', () => {
      const scheduled = rule({ id: 'r_cron', trigger: { schedule: '*/15 * * * *' } })

      expect(
        selectRules({
          rules: [rule(), scheduled],
          triggerEvent: SCHEDULED_SWEEP,
          projectId: 'proj_1',
        }).map((entry) => entry.id),
      ).toEqual(['r_cron'])
    })
  })

  describe('step 2 — context', () => {
    it('collects attribute keys from conditions and formulas, ignoring literals', () => {
      const keys = collectRuleAttributeKeys(
        rule({
          when: {
            all: [
              { attr: 'project.status', op: ConditionOperator.EQ, value: 'ACTIVE' },
              { attr: 'campaign.roas', op: ConditionOperator.GTE, value: 2 },
            ],
          },
          then: [
            setControlsAction('min(project.budget.remaining * 0.1, role.monthlyCap)', {
              params: {
                transactionLimits: {
                  currency: 'USD',
                  limits: [
                    {
                      interval: TransactionLimitInterval.MONTHLY,
                      amount: 'min(project.budget.remaining * 0.1, role.monthlyCap)',
                    },
                  ],
                },
                activeFrom: 'project.startDate',
                activeTo: '2026-12-31T00:00:00.000Z',
              },
            }),
          ],
        }),
      )

      expect(keys.sort()).toEqual([
        'campaign.roas',
        'project.budget.remaining',
        'project.startDate',
        'project.status',
        'role.monthlyCap',
      ])
    })
  })

  describe('step 3 — evaluate', () => {
    it('fails the rule naming a missing attribute rather than resolving zero', () => {
      const result = runPipeline(pipelineInput({ attributes: attributes([]) }))
      const [outcome] = result.outcomes

      expect(outcome?.status).toBe(RuleRunStatus.FAILED)
      expect(outcome?.failureReason).toBe('missing attribute: project.budget.remaining')
      expect(result.desiredState.cards).toEqual([])
    })

    it('skips the rule naming a stale attribute', () => {
      const result = runPipeline(
        pipelineInput({
          attributes: attributes([
            reading('project.budget.remaining', 600_000, {
              observedAt: '2026-08-10T00:00:00.000Z',
              ttlSec: 900,
              stale: true,
            }),
          ]),
        }),
      )
      const [outcome] = result.outcomes

      expect(outcome?.status).toBe(RuleRunStatus.SKIPPED)
      expect(outcome?.skipReason).toBe('stale input: project.budget.remaining')
      expect(outcome?.inputs[0]?.value).toBe(600_000)
    })

    it('takes the else branch when the condition does not match', () => {
      const result = runPipeline(
        pipelineInput({
          rules: [
            rule({
              when: { attr: 'project.budget.remaining', op: ConditionOperator.GT, value: 0 },
              else: [
                {
                  action: RuleActionType.CARD_FREEZE,
                  target: { select: RuleTargetSelect.PROJECT_CARDS },
                  params: { reason: 'Budget exhausted' },
                },
              ],
            }),
          ],
          attributes: attributes([reading('project.budget.remaining', 0)]),
        }),
      )

      expect(result.outcomes[0]?.matched).toBe(false)
      expect(result.desiredState.cards[0]?.cardStatus).toBe(DesiredCardStatus.INACTIVE)
    })

    it('fires crossedAbove once, on the run that crosses the threshold', () => {
      const crossing = rule({
        when: {
          attr: 'project.budget.utilisationPct',
          op: ConditionOperator.CROSSED_ABOVE,
          value: 90,
        },
        then: [
          {
            action: RuleActionType.CARD_FREEZE,
            target: { select: RuleTargetSelect.PROJECT_CARDS },
            params: { reason: 'Budget below 10% remaining' },
          },
        ],
      })
      const at = (pct: number, previous?: number) =>
        runPipeline(
          pipelineInput({
            rules: [crossing],
            attributes: attributes([reading('project.budget.utilisationPct', pct)]),
            previousValues:
              previous === undefined
                ? undefined
                : new Map([['rule_1', new Map([['project.budget.utilisationPct', previous]])]]),
          }),
        )

      // First ever observation is not a crossing.
      expect(at(95).outcomes[0]?.matched).toBe(false)
      // 85 → 95 crosses.
      expect(at(95, 85).outcomes[0]?.matched).toBe(true)
      // 95 → 96 stays above; it does not fire again.
      expect(at(96, 95).outcomes[0]?.matched).toBe(false)
    })

    it('isolates a failing rule so the others still produce desired state', () => {
      const broken = rule({
        id: 'rule_broken',
        priority: 50,
        then: [setControlsAction('missing.attribute * 2')],
      })

      const result = runPipeline(pipelineInput({ rules: [broken, rule()] }))

      expect(result.outcomes.find((o) => o.rule.id === 'rule_broken')?.status).toBe(
        RuleRunStatus.FAILED,
      )
      expect(result.outcomes.find((o) => o.rule.id === 'rule_1')?.status).toBe(
        RuleRunStatus.SUCCESS,
      )
      expect(result.desiredState.cards[0]?.controls?.transactionLimits?.limits[0]?.amount).toBe(
        60_000,
      )
    })
  })

  describe('step 4 — targets', () => {
    const pool = {
      cards: [
        { cardId: 'card_1', projectId: 'proj_1', purpose: CardPurpose.MEMBER, userId: 'user_1' },
        { cardId: 'card_2', projectId: 'proj_1', purpose: CardPurpose.SHARED, userId: 'user_2' },
        { cardId: 'card_3', projectId: 'proj_1', purpose: CardPurpose.MEMBER, userId: null },
      ],
      members: [
        { userId: 'user_1', roleKey: 'project_spender' },
        { userId: 'user_2', roleKey: 'project_manager' },
      ],
    }

    it('filters project cards by purpose and by member role', () => {
      expect(
        resolveTarget(
          { select: RuleTargetSelect.PROJECT_CARDS, filter: { purpose: CardPurpose.MEMBER } },
          pool,
        ).cardIds,
      ).toEqual(['card_1', 'card_3'])

      expect(
        resolveTarget(
          {
            select: RuleTargetSelect.PROJECT_CARDS,
            filter: { roleKeys: ['project_spender'] },
          },
          pool,
        ).cardIds,
      ).toEqual(['card_1'])
    })

    it('resolves CARD, PROJECT_MEMBERS, and EVENT_SUBJECT', () => {
      expect(
        resolveTarget({ select: RuleTargetSelect.CARD, cardId: 'card_2' }, pool).cardIds,
      ).toEqual(['card_2'])
      expect(
        resolveTarget({ select: RuleTargetSelect.CARD, cardId: 'card_missing' }, pool).cardIds,
      ).toEqual([])
      expect(
        resolveTarget(
          { select: RuleTargetSelect.PROJECT_MEMBERS, filter: { roleKeys: ['project_manager'] } },
          pool,
        ).memberIds,
      ).toEqual(['user_2'])
      expect(
        resolveTarget(
          { select: RuleTargetSelect.EVENT_SUBJECT },
          { ...pool, eventSubject: { cardIds: ['card_9'] } },
        ).cardIds,
      ).toEqual(['card_9'])
    })
  })

  describe('step 5 — merge', () => {
    const base = (overrides: Partial<CardContribution>): CardContribution => ({
      ruleId: 'rule_a',
      ruleName: 'Rule A',
      priority: 100,
      cardId: 'card_1',
      ...overrides,
    })

    it('takes the minimum limit per interval', () => {
      const merged = mergeContributions([
        base({
          controls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 400_000 }],
            },
          },
        }),
        base({
          ruleId: 'rule_b',
          controls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 250_000 }],
            },
          },
        }),
      ])

      expect(merged.desiredState.cards[0]?.controls?.transactionLimits?.limits).toEqual([
        { interval: TransactionLimitInterval.MONTHLY, amount: 250_000 },
      ])
      expect(merged.conflicts).toEqual([])
    })

    it('intersects allowlists and unions blocklists', () => {
      const merged = mergeContributions([
        base({
          controls: {
            allowedCurrencies: ['USD', 'AUD', 'SGD'],
            blockedTransactionUsages: [{ transactionScope: 'ATM', usageScope: 'ALL' }],
          },
        }),
        base({
          ruleId: 'rule_b',
          controls: {
            allowedCurrencies: ['USD', 'SGD'],
            blockedTransactionUsages: [{ transactionScope: 'ONLINE', usageScope: 'ALL' }],
          },
        }),
      ])
      const result = merged.desiredState.cards[0]?.controls

      expect(result?.allowedCurrencies).toEqual(['SGD', 'USD'])
      expect(result?.blockedTransactionUsages).toHaveLength(2)
    })

    it('treats an empty or null allowlist as no constraint from that rule', () => {
      const merged = mergeContributions([
        base({ controls: { allowedCurrencies: ['USD'] } }),
        base({ ruleId: 'rule_b', controls: { allowedCurrencies: [] } }),
        base({ ruleId: 'rule_c', controls: { allowedCurrencies: null } }),
      ])

      expect(merged.desiredState.cards[0]?.controls?.allowedCurrencies).toEqual(['USD'])
      expect(merged.conflicts).toEqual([])
    })

    it('records a conflict and pushes nothing when an intersection is empty', () => {
      const merged = mergeContributions([
        base({ controls: { allowedCurrencies: ['USD'] } }),
        base({ ruleId: 'rule_b', controls: { allowedCurrencies: ['EUR'] } }),
      ])

      expect(merged.conflicts[0]?.kind).toBe('EMPTY_CURRENCY_INTERSECTION')
      expect(merged.desiredState.cards[0]?.controls?.allowedCurrencies).toBeUndefined()
    })

    it('takes max activeFrom and min activeTo, flagging an inverted window', () => {
      const ok = mergeContributions([
        base({ controls: { activeFrom: '2026-08-01T00:00:00.000Z' } }),
        base({ ruleId: 'rule_b', controls: { activeTo: '2026-12-31T00:00:00.000Z' } }),
      ])
      expect(ok.desiredState.cards[0]?.controls?.activeFrom).toBe('2026-08-01T00:00:00.000Z')
      expect(ok.desiredState.cards[0]?.controls?.activeTo).toBe('2026-12-31T00:00:00.000Z')

      const inverted = mergeContributions([
        base({ controls: { activeFrom: '2026-12-01T00:00:00.000Z' } }),
        base({ ruleId: 'rule_b', controls: { activeTo: '2026-08-31T00:00:00.000Z' } }),
      ])
      expect(inverted.conflicts[0]?.kind).toBe('ACTIVE_WINDOW_INVERTED')
      expect(inverted.desiredState.cards[0]?.controls?.activeFrom).toBeUndefined()
      expect(inverted.desiredState.cards[0]?.controls?.activeTo).toBeUndefined()
    })

    it('takes the most restrictive status — freeze beats a limit', () => {
      const merged = mergeContributions([
        base({
          controls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 400_000 }],
            },
          },
          cardStatus: DesiredCardStatus.ACTIVE,
        }),
        base({ ruleId: 'rule_freeze', priority: 10, cardStatus: DesiredCardStatus.INACTIVE }),
      ])

      expect(merged.desiredState.cards[0]?.cardStatus).toBe(DesiredCardStatus.INACTIVE)
      expect(merged.desiredState.cards[0]?.controls?.transactionLimits?.limits[0]?.amount).toBe(
        400_000,
      )
    })

    it('is order independent — merge is commutative', () => {
      const a = base({
        controls: { allowedCurrencies: ['USD', 'AUD'] },
        cardStatus: DesiredCardStatus.ACTIVE,
      })
      const b = base({
        ruleId: 'rule_b',
        priority: 10,
        controls: { allowedCurrencies: ['USD'] },
        cardStatus: DesiredCardStatus.CLOSED,
      })

      expect(mergeContributions([a, b])).toEqual(mergeContributions([b, a]))
    })

    it('explains each field with its strategy and contributing rules', () => {
      const merged = mergeContributions([
        base({
          controls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 400_000 }],
            },
          },
        }),
        base({
          ruleId: 'rule_b',
          ruleName: 'Rule B',
          controls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 250_000 }],
            },
          },
        }),
      ])
      const entry = merged.explanations.find((e) => e.field === 'transactionLimits.MONTHLY')

      expect(entry?.strategy).toBe(MergeStrategy.MIN)
      expect(entry?.result).toBe(250_000)
      expect(entry?.contributions.map((c) => c.ruleName)).toEqual(['Rule A', 'Rule B'])
    })
  })

  describe('step 6 — diff', () => {
    it('reports changed only for fields the rules contributed', () => {
      const unchanged = diffCard(
        {
          cardId: 'card_1',
          controls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 400_000 }],
            },
          },
        },
        { cardId: 'card_1', controls: controls(), cardStatus: DesiredCardStatus.ACTIVE },
      )
      expect(unchanged.changed).toBe(false)

      const changed = diffCard(
        {
          cardId: 'card_1',
          controls: {
            transactionLimits: {
              currency: 'USD',
              limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 250_000 }],
            },
          },
        },
        { cardId: 'card_1', controls: controls(), cardStatus: DesiredCardStatus.ACTIVE },
      )
      expect(changed.changed).toBe(true)
      expect(changed.before.controls?.transactionLimits.limits[0]?.amount).toBe(400_000)
    })

    it('does not treat an uncontributed allowlist as a clear', () => {
      const diff = diffCard(
        { cardId: 'card_1', controls: { activeTo: null } },
        {
          cardId: 'card_1',
          controls: controls({ allowedMerchantCategories: ['5734'] }),
          cardStatus: DesiredCardStatus.ACTIVE,
        },
      )

      expect(diff.changed).toBe(false)
    })
  })

  describe('end to end', () => {
    it('three rules on one card merge to the most restrictive desired state', () => {
      const result = runPipeline(
        pipelineInput({
          rules: [
            rule({ id: 'r_a', then: [setControlsAction('project.budget.remaining * 0.10')] }),
            rule({ id: 'r_b', priority: 50, then: [setControlsAction(45_000)] }),
            rule({
              id: 'r_c',
              priority: 10,
              then: [
                setControlsAction(90_000, {
                  params: {
                    transactionLimits: {
                      currency: 'USD',
                      limits: [{ interval: TransactionLimitInterval.MONTHLY, amount: 90_000 }],
                    },
                    allowedCurrencies: ['USD', 'AUD'],
                  },
                }),
              ],
            }),
          ],
        }),
      )
      const desired = result.desiredState.cards[0]

      expect(result.outcomes).toHaveLength(3)
      expect(desired?.controls?.transactionLimits?.limits[0]?.amount).toBe(45_000)
      expect(desired?.controls?.allowedCurrencies).toEqual(['AUD', 'USD'])
      expect(result.diff.cards[0]?.changed).toBe(true)
    })

    it('marks contributing rules PARTIAL when the merge conflicts', () => {
      const result = runPipeline(
        pipelineInput({
          rules: [
            rule({
              id: 'r_usd',
              then: [
                setControlsAction(100, {
                  params: { allowedCurrencies: ['USD'] },
                }),
              ],
            }),
            rule({
              id: 'r_eur',
              then: [
                setControlsAction(100, {
                  params: { allowedCurrencies: ['EUR'] },
                }),
              ],
            }),
          ],
        }),
      )

      expect(result.conflicts[0]?.kind).toBe('EMPTY_CURRENCY_INTERSECTION')
      expect(result.outcomes.every((o) => o.status === RuleRunStatus.PARTIAL)).toBe(true)
      expect(result.desiredState.cards[0]?.controls?.allowedCurrencies).toBeUndefined()
    })

    it('records card.create against members and leaves unwired actions SKIPPED', () => {
      const result = runPipeline(
        pipelineInput({
          rules: [
            rule({
              then: [
                {
                  action: RuleActionType.CARD_CREATE,
                  target: {
                    select: RuleTargetSelect.PROJECT_MEMBERS,
                    filter: { roleKeys: ['project_spender'] },
                  },
                  params: { purpose: CardPurpose.MEMBER },
                },
                {
                  action: RuleActionType.NOTIFY,
                  target: { select: RuleTargetSelect.PROJECT_MEMBERS },
                  params: { template: 'budget_floor_breached' },
                },
              ],
            }),
          ],
        }),
      )
      const [outcome] = result.outcomes

      expect(outcome?.actions).toEqual([
        expect.objectContaining({
          action: RuleActionType.CARD_CREATE,
          targetId: 'user_1',
          status: ActionResultStatus.WOULD_APPLY,
        }),
        expect.objectContaining({
          action: RuleActionType.NOTIFY,
          status: ActionResultStatus.SKIPPED,
        }),
      ])
    })

    it('resolves a relative active window from activeToOffsetDays', () => {
      const result = runPipeline(
        pipelineInput({
          rules: [
            rule({
              then: [setControlsAction(1000, { params: { activeToOffsetDays: 7 } })],
            }),
          ],
        }),
      )

      expect(result.desiredState.cards[0]?.controls?.activeTo).toBe('2026-08-18T00:00:00.000Z')
    })

    it('is deterministic across many runs with identical inputs', () => {
      const input = pipelineInput({
        rules: [
          rule({ id: 'r_a', then: [setControlsAction('project.budget.remaining * 0.10')] }),
          rule({ id: 'r_b', priority: 10, then: [setControlsAction(45_000)] }),
        ],
      })
      const first = runPipeline(input)

      for (let i = 0; i < 50; i += 1) {
        expect(runPipeline(input)).toEqual(first)
      }
    })
  })
})
