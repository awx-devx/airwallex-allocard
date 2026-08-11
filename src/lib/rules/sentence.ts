/**
 * Display-only rule sentence renderer — does not validate the DSL tree.
 */
import { attributeLabel } from '@/lib/rules/attributes'
import { actionLabel, operatorLabel } from '@/lib/rules/operators'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { RuleActionType } from '@/shared/enums/ruleActionType'
import { RuleTargetSelect } from '@/shared/enums/ruleTargetSelect'
import type { Condition, ConditionValue, RuleAction } from '@/shared/types/rule'

export type RuleSentenceInput = Pick<
  { when: Condition; then: RuleAction[]; else?: RuleAction[]; name?: string },
  'when' | 'then' | 'else' | 'name'
>

function formatLiteral(value: unknown): string {
  if (typeof value === 'string') {
    return `"${value}"`
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value === null) {
    return 'null'
  }
  return String(value)
}

function formatConditionValue(value: ConditionValue | undefined): string {
  if (value === undefined) {
    return ''
  }
  if (Array.isArray(value)) {
    return value.map((v) => formatLiteral(v)).join(', ')
  }
  if (typeof value === 'object' && value !== null && 'attr' in value) {
    return attributeLabel(value.attr)
  }
  return formatLiteral(value)
}

function conditionPhrase(condition: Condition): string {
  if (condition.all !== undefined) {
    return condition.all.map((c) => conditionPhrase(c)).join(' and ')
  }
  if (condition.any !== undefined) {
    return `any of (${condition.any.map((c) => conditionPhrase(c)).join(', ')})`
  }
  if (condition.not !== undefined) {
    return `not (${conditionPhrase(condition.not)})`
  }
  if (condition.expr !== undefined) {
    return `expression ${condition.expr}`
  }
  if (condition.attr !== undefined && condition.op !== undefined) {
    const attr = attributeLabel(condition.attr)
    const op = condition.op
    const valueText = formatConditionValue(condition.value)

    if (op === ConditionOperator.CROSSED_BELOW) {
      return `${attr} crosses below ${valueText}`
    }
    if (op === ConditionOperator.CROSSED_ABOVE) {
      return `${attr} crosses above ${valueText}`
    }
    if (op === ConditionOperator.BETWEEN && Array.isArray(condition.value)) {
      const [low, high] = condition.value
      return `${attr} is between ${formatLiteral(low)} and ${formatLiteral(high)}`
    }
    if (op === ConditionOperator.IN || op === ConditionOperator.NIN) {
      return `${attr} ${operatorLabel(op)} (${valueText})`
    }
    return `${attr} ${operatorLabel(op)} ${valueText}`
  }
  return 'condition'
}

function targetPhrase(select: RuleTargetSelect): string {
  switch (select) {
    case RuleTargetSelect.PROJECT_CARDS:
      return 'project cards'
    case RuleTargetSelect.MEMBER_CARDS:
      return 'member cards'
    case RuleTargetSelect.CARD:
      return 'card'
    case RuleTargetSelect.PROJECT_MEMBERS:
      return 'project members'
    case RuleTargetSelect.EVENT_SUBJECT:
      return 'event subject'
    default: {
      const _exhaustive: never = select
      return String(_exhaustive)
    }
  }
}

function actionPhrase(action: RuleAction): string {
  return `${actionLabel(action.action)} on ${targetPhrase(action.target.select)}`
}

function actionsPhrase(actions: RuleAction[]): string {
  return actions.map((a) => actionPhrase(a)).join('; ')
}

export function ruleToSentence(rule: RuleSentenceInput): string {
  const whenText = conditionPhrase(rule.when)
  const thenText = actionsPhrase(rule.then)
  const prefix = rule.name ? `${rule.name}: ` : ''
  if (rule.else && rule.else.length > 0) {
    const elseText = actionsPhrase(rule.else)
    return `${prefix}When ${whenText}, ${thenText}; otherwise ${elseText}`
  }
  return `${prefix}When ${whenText}, ${thenText}`
}

/** Minimal condition stub for a single operator — used in tests. */
export function stubConditionForOperator(
  op: ConditionOperator,
  value: ConditionValue = 10,
): Condition {
  return { attr: 'project.budget.utilisationPct', op, value }
}

/** Minimal action stub for a single action type — used in tests. */
export function stubActionForType(action: RuleActionType): RuleAction {
  return {
    action,
    target: { select: RuleTargetSelect.MEMBER_CARDS },
    params: {},
  }
}
