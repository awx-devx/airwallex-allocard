/**
 * Pipeline steps 1–6 (RULES-ENGINE §4). **Pure — no I/O anywhere in this file.**
 *
 * That purity is the whole point: simulation is this same function, stopped
 * after step 6. If anything here ever needs the database or the network, it
 * belongs in `apply.ts` instead.
 *
 * Failure isolation follows §4: one rule that throws is recorded `FAILED` and
 * the others still produce their desired state.
 */
import { FormulaError, evaluateMoneyFormula, evaluateRuleFormula } from '@/server/lib/formula'
import type { AttributeContext } from '@/server/services/attributes/resolve'
import {
  isCurrencyLiteral,
  isDateLiteral,
  resolveRuleContext,
  type RuleContextResolution,
} from '@/server/services/rules/context'
import {
  ConditionEvaluationError,
  evaluateCondition,
  type ConditionContext,
} from '@/server/services/rules/evaluate'
import { diffDesiredState, type AppliedCardState } from '@/server/services/rules/diff'
import {
  mergeContributions,
  type CardContribution,
  type ContributedControls,
} from '@/server/services/rules/merge'
import { selectRules } from '@/server/services/rules/select'
import {
  resolveTarget,
  type EventSubject,
  type TargetMember,
} from '@/server/services/rules/targets'
import { MS_PER_DAY } from '@/server/lib/formula/evaluate'
import { ActionResultStatus } from '@/shared/enums/actionResultStatus'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { DesiredCardStatus } from '@/shared/enums/desiredCardStatus'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleRunStatus } from '@/shared/enums/ruleRunStatus'
import type { CardPurpose } from '@/shared/enums/cardPurpose'
import type { AttributeLiteral } from '@/shared/types/attribute'
import type { CardControls } from '@/shared/types/cardControls'
import type { Rule, RuleAction, RuleControlsParams } from '@/shared/types/rule'
import type {
  ActionResult,
  DesiredState,
  MergeConflict,
  MergeExplanationEntry,
  RuleRunDiff,
  RuleRunInputValue,
} from '@/shared/types/ruleRun'

export type PipelineCard = {
  cardId: string
  projectId: string | null
  purpose: CardPurpose
  userId: string | null
  controls: CardControls
  cardStatus: DesiredCardStatus | null
}

export type PipelineInput = {
  rules: readonly Rule[]
  attributes: AttributeContext
  cards: readonly PipelineCard[]
  members: readonly TargetMember[]
  triggerEvent: string
  projectId?: string | null
  /** Simulation only — evaluate in-scope rules whatever their trigger. */
  ignoreTrigger?: boolean
  eventSubject?: EventSubject
  /** Values recorded by each rule's previous run, for crossedAbove / crossedBelow. */
  previousValues?: Map<string, Map<string, AttributeLiteral>>
  now?: Date
}

export type RuleOutcome = {
  rule: Rule
  matched: boolean
  status: RuleRunStatus
  skipReason: string | null
  failureReason: string | null
  inputs: RuleRunInputValue[]
  contributions: CardContribution[]
  actions: ActionResult[]
}

export type PipelineResult = {
  outcomes: RuleOutcome[]
  desiredState: DesiredState
  diff: RuleRunDiff
  conflicts: MergeConflict[]
  explanations: MergeExplanationEntry[]
}

/** Actions whose owning phase has not wired an effect yet. */
const UNWIRED_ACTIONS = new Set<RuleActionType>([
  RuleActionType.ACCESS_GRANT,
  RuleActionType.ACCESS_REVOKE,
  RuleActionType.ACCESS_EXPIRE,
  RuleActionType.BUDGET_ALLOCATE,
  RuleActionType.APPROVAL_REQUIRE,
  RuleActionType.NOTIFY,
  // FLAG_REVIEW is wired in B9.9 — records WOULD_APPLY; sweep creates AccessReview rows.
])

const STATUS_ACTIONS: Partial<Record<RuleActionType, DesiredCardStatus>> = {
  [RuleActionType.CARD_FREEZE]: DesiredCardStatus.INACTIVE,
  [RuleActionType.CARD_UNFREEZE]: DesiredCardStatus.ACTIVE,
  [RuleActionType.CARD_CLOSE]: DesiredCardStatus.CLOSED,
}

class ParamResolutionError extends Error {}

function literalString(value: AttributeLiteral | undefined, key: string): string {
  if (typeof value !== 'string') {
    throw new ParamResolutionError(`attribute '${key}' is not a string`)
  }
  return value
}

/**
 * `"USD"` is a currency; anything else is an attribute reference resolving to one.
 */
function resolveCurrency(raw: string, values: Map<string, AttributeLiteral>): string {
  if (isCurrencyLiteral(raw)) {
    return raw
  }
  if (!values.has(raw)) {
    throw new ParamResolutionError(`missing attribute: ${raw}`)
  }
  return literalString(values.get(raw), raw)
}

/**
 * `"2026-08-01T00:00:00Z"` is a date; anything else is an expression. An
 * expression yielding epoch milliseconds (an ISO date attribute, via
 * `buildRuleFormulaContext`) becomes an ISO string again here.
 */
function resolveDate(
  raw: string,
  context: RuleContextResolution,
  values: Map<string, AttributeLiteral>,
): string {
  if (isDateLiteral(raw)) {
    return raw
  }
  if (values.has(raw)) {
    return literalString(values.get(raw), raw)
  }
  const epochMs = evaluateRuleFormula(raw, context.formulaContext)
  return new Date(epochMs).toISOString()
}

/**
 * An allowlist given as a string names an attribute holding the list.
 * Attribute values are scalars, so a comma-separated string is the list form.
 */
function resolveAllowlist(raw: string, values: Map<string, AttributeLiteral>): string[] {
  if (!values.has(raw)) {
    throw new ParamResolutionError(`missing attribute: ${raw}`)
  }
  const entries = literalString(values.get(raw), raw)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
  if (entries.length === 0) {
    throw new ParamResolutionError(`attribute '${raw}' produced an empty allowlist`)
  }
  return entries
}

function offsetDays(days: number, now: Date): string {
  return new Date(now.getTime() + days * MS_PER_DAY).toISOString()
}

/** Turn DSL params (formulas, attribute refs, literals) into concrete controls. */
export function resolveControlsParams(
  params: RuleControlsParams,
  context: RuleContextResolution,
  values: Map<string, AttributeLiteral>,
  now: Date,
): ContributedControls {
  const controls: ContributedControls = {}

  if (params.allowedTransactionCount) {
    controls.allowedTransactionCount = params.allowedTransactionCount as AllowedTransactionCount
  }

  if (params.transactionLimits) {
    controls.transactionLimits = {
      currency: resolveCurrency(params.transactionLimits.currency, values),
      limits: params.transactionLimits.limits.map((limit) => ({
        interval: limit.interval,
        amount:
          typeof limit.amount === 'number'
            ? limit.amount
            : evaluateMoneyFormula(limit.amount, context.formulaContext),
      })),
    }
  }

  if (typeof params.activeFrom === 'string') {
    controls.activeFrom = resolveDate(params.activeFrom, context, values)
  }
  if (typeof params.activeTo === 'string') {
    controls.activeTo = resolveDate(params.activeTo, context, values)
  }
  if (params.activeFromOffsetDays !== undefined) {
    controls.activeFrom = offsetDays(params.activeFromOffsetDays, now)
  }
  if (params.activeToOffsetDays !== undefined) {
    controls.activeTo = offsetDays(params.activeToOffsetDays, now)
  }

  for (const field of [
    'allowedCurrencies',
    'allowedMerchantCategories',
    'allowedMerchantCountries',
    'allowedMerchantBrands',
  ] as const) {
    const value = params[field]
    if (typeof value === 'string') {
      controls[field] = resolveAllowlist(value, values)
    } else if (Array.isArray(value)) {
      controls[field] = value
    }
  }

  if (params.blockedTransactionUsages) {
    controls.blockedTransactionUsages = params.blockedTransactionUsages
  }

  return controls
}

function currentValues(attributes: AttributeContext): Map<string, AttributeLiteral> {
  const values = new Map<string, AttributeLiteral>()
  for (const reading of attributes.readings) {
    if (!values.has(reading.key)) {
      values.set(reading.key, reading.value)
    }
  }
  return values
}

function applyAction(
  rule: Rule,
  action: RuleAction,
  input: PipelineInput,
  context: RuleContextResolution,
  values: Map<string, AttributeLiteral>,
  now: Date,
  contributions: CardContribution[],
  results: ActionResult[],
): void {
  if (UNWIRED_ACTIONS.has(action.action)) {
    results.push({
      action: action.action,
      targetId: null,
      status: ActionResultStatus.SKIPPED,
      message: `${action.action} has no effect wired yet`,
    })
    return
  }

  const target = resolveTarget(action.target, {
    cards: input.cards,
    members: input.members,
    eventSubject: input.eventSubject,
  })

  if (action.action === RuleActionType.CARD_CREATE) {
    // Provisioning is an apply-time effect (step 7); step 4 only names the subjects.
    const resolved = resolveControlsParams(action.params, context, values, now)
    for (const memberId of target.memberIds) {
      results.push({
        action: action.action,
        targetId: memberId,
        status: ActionResultStatus.WOULD_APPLY,
        message: null,
        details: { controls: resolved, purpose: action.params.purpose ?? null },
      })
    }
    return
  }

  if (action.action === RuleActionType.FLAG_REVIEW) {
    // Access-review creation is a worker sweep (B9.9); pipeline only names subjects.
    const reason =
      typeof action.params.reason === 'string' && action.params.reason.length > 0
        ? action.params.reason
        : 'Flagged by rule for review'
    for (const memberId of target.memberIds) {
      results.push({
        action: action.action,
        targetId: memberId,
        status: ActionResultStatus.WOULD_APPLY,
        message: null,
        details: { reason, targetKind: 'member' },
      })
    }
    for (const cardId of target.cardIds) {
      results.push({
        action: action.action,
        targetId: cardId,
        status: ActionResultStatus.WOULD_APPLY,
        message: null,
        details: { reason, targetKind: 'card' },
      })
    }
    return
  }

  const status = STATUS_ACTIONS[action.action]
  const controls =
    action.action === RuleActionType.CARD_SET_CONTROLS
      ? resolveControlsParams(action.params, context, values, now)
      : undefined

  for (const cardId of target.cardIds) {
    contributions.push({
      ruleId: rule.id,
      ruleName: rule.name,
      priority: rule.priority,
      cardId,
      ...(controls ? { controls } : {}),
      ...(status ? { cardStatus: status } : {}),
    })
    results.push({
      action: action.action,
      targetId: cardId,
      status: ActionResultStatus.WOULD_APPLY,
      message: null,
    })
  }
}

function evaluateRule(rule: Rule, input: PipelineInput, now: Date): RuleOutcome {
  const context = resolveRuleContext(rule, input.attributes, now)
  const base = {
    rule,
    inputs: context.inputs,
    contributions: [] as CardContribution[],
    actions: [] as ActionResult[],
  }

  if (context.missing.length > 0) {
    return {
      ...base,
      matched: false,
      status: RuleRunStatus.FAILED,
      skipReason: null,
      failureReason: `missing attribute: ${context.missing.join(', ')}`,
    }
  }

  if (context.stale.length > 0) {
    return {
      ...base,
      matched: false,
      status: RuleRunStatus.SKIPPED,
      skipReason: `stale input: ${context.stale.join(', ')}`,
      failureReason: null,
    }
  }

  const values = currentValues(input.attributes)
  const conditionContext: ConditionContext = {
    values,
    previous: input.previousValues?.get(rule.id) ?? new Map(),
    formulaContext: context.formulaContext,
  }

  let matched: boolean
  try {
    matched = evaluateCondition(rule.when, conditionContext)
  } catch (error) {
    return {
      ...base,
      matched: false,
      status: RuleRunStatus.FAILED,
      skipReason: null,
      failureReason:
        error instanceof ConditionEvaluationError || error instanceof FormulaError
          ? error.message
          : 'condition evaluation failed',
    }
  }

  const contributions: CardContribution[] = []
  const actions: ActionResult[] = []
  const branch = matched ? rule.then : (rule.else ?? [])

  for (const action of branch) {
    try {
      applyAction(rule, action, input, context, values, now, contributions, actions)
    } catch (error) {
      if (error instanceof ParamResolutionError || error instanceof FormulaError) {
        return {
          ...base,
          matched,
          status: RuleRunStatus.FAILED,
          skipReason: null,
          failureReason: error.message,
        }
      }
      throw error
    }
  }

  return {
    rule,
    matched,
    status: RuleRunStatus.SUCCESS,
    skipReason: null,
    failureReason: null,
    inputs: context.inputs,
    contributions,
    actions,
  }
}

function appliedStates(cards: readonly PipelineCard[]): AppliedCardState[] {
  return cards.map((card) => ({
    cardId: card.cardId,
    controls: card.controls,
    cardStatus: card.cardStatus,
  }))
}

/**
 * Run steps 1–6 and return the desired state, the diff, and per-rule outcomes.
 * Identical inputs always produce an identical result.
 */
export function runPipeline(input: PipelineInput): PipelineResult {
  const now = input.now ?? new Date()

  const selected = selectRules({
    rules: input.rules,
    triggerEvent: input.triggerEvent,
    projectId: input.projectId,
    ...(input.ignoreTrigger === true ? { ignoreTrigger: true } : {}),
  })

  const outcomes = selected.map((rule) => {
    try {
      return evaluateRule(rule, input, now)
    } catch (error) {
      // A rule that throws is its own failure; the rest of the engine continues.
      return {
        rule,
        matched: false,
        status: RuleRunStatus.FAILED,
        skipReason: null,
        failureReason: error instanceof Error ? error.message : 'rule evaluation failed',
        inputs: [],
        contributions: [],
        actions: [],
      }
    }
  })

  const { desiredState, conflicts, explanations } = mergeContributions(
    outcomes.flatMap((outcome) => outcome.contributions),
  )

  const conflictedCards = new Set(
    conflicts.map((conflict) => conflict.cardId).filter((id): id is string => Boolean(id)),
  )
  for (const outcome of outcomes) {
    if (
      outcome.status === RuleRunStatus.SUCCESS &&
      outcome.contributions.some((contribution) => conflictedCards.has(contribution.cardId))
    ) {
      outcome.status = RuleRunStatus.PARTIAL
    }
  }

  return {
    outcomes,
    desiredState,
    diff: diffDesiredState(desiredState.cards, appliedStates(input.cards)),
    conflicts,
    explanations,
  }
}
