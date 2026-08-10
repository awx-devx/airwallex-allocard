/**
 * Pipeline step 3 — evaluate conditions (RULES-ENGINE §3/§4). Pure.
 *
 * Stateless operators compare the current reading to a literal or another
 * attribute. The three stateful ones compare against the previous run's recorded
 * value — that is what makes `crossedBelow` fire once as a threshold is passed
 * rather than on every evaluation while it stays below.
 */
import { evaluateRuleFormula } from '@/server/lib/formula/rules'
import type { FormulaContext } from '@/server/lib/formula/evaluate'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import type { AttributeLiteral } from '@/shared/types/attribute'
import type { Condition, ConditionValue } from '@/shared/types/rule'

export type ConditionContext = {
  /** Current readings by attribute key. */
  values: Map<string, AttributeLiteral>
  /** Values recorded by this rule's previous run — empty on first evaluation. */
  previous: Map<string, AttributeLiteral>
  formulaContext: FormulaContext
}

export class ConditionEvaluationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ConditionEvaluationError'
  }
}

function numeric(value: AttributeLiteral | undefined, label: string): number {
  if (typeof value === 'number') {
    return value
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  throw new ConditionEvaluationError(`${label} is not comparable as a number`)
}

function resolveOperand(value: ConditionValue, context: ConditionContext): unknown {
  if (value !== null && typeof value === 'object' && !Array.isArray(value) && 'attr' in value) {
    if (!context.values.has(value.attr)) {
      throw new ConditionEvaluationError(`missing attribute: ${value.attr}`)
    }
    return context.values.get(value.attr)
  }
  return value
}

function compare(
  op: ConditionOperator,
  attr: string,
  current: AttributeLiteral,
  operand: unknown,
  context: ConditionContext,
): boolean {
  switch (op) {
    case ConditionOperator.EQ:
      return current === operand
    case ConditionOperator.NEQ:
      return current !== operand
    case ConditionOperator.GT:
      return numeric(current, attr) > numeric(operand as AttributeLiteral, 'value')
    case ConditionOperator.GTE:
      return numeric(current, attr) >= numeric(operand as AttributeLiteral, 'value')
    case ConditionOperator.LT:
      return numeric(current, attr) < numeric(operand as AttributeLiteral, 'value')
    case ConditionOperator.LTE:
      return numeric(current, attr) <= numeric(operand as AttributeLiteral, 'value')
    case ConditionOperator.IN:
      return Array.isArray(operand) && operand.includes(current)
    case ConditionOperator.NIN:
      return Array.isArray(operand) && !operand.includes(current)
    case ConditionOperator.CONTAINS:
      if (Array.isArray(current)) {
        return current.includes(operand as never)
      }
      return typeof current === 'string' && current.includes(String(operand))
    case ConditionOperator.BETWEEN: {
      if (!Array.isArray(operand) || operand.length !== 2) {
        throw new ConditionEvaluationError(`${attr}: between requires a [low, high] pair`)
      }
      const value = numeric(current, attr)
      const low = numeric(operand[0] as AttributeLiteral, 'low')
      const high = numeric(operand[1] as AttributeLiteral, 'high')
      return value >= low && value <= high
    }
    case ConditionOperator.CHANGED_BY: {
      const before = context.previous.get(attr)
      if (before === undefined) {
        return false
      }
      const delta = Math.abs(numeric(current, attr) - numeric(before, attr))
      return delta >= numeric(operand as AttributeLiteral, 'value')
    }
    case ConditionOperator.CROSSED_BELOW: {
      const before = context.previous.get(attr)
      if (before === undefined) {
        return false
      }
      const threshold = numeric(operand as AttributeLiteral, 'value')
      return numeric(before, attr) >= threshold && numeric(current, attr) < threshold
    }
    case ConditionOperator.CROSSED_ABOVE: {
      const before = context.previous.get(attr)
      if (before === undefined) {
        return false
      }
      const threshold = numeric(operand as AttributeLiteral, 'value')
      return numeric(before, attr) <= threshold && numeric(current, attr) > threshold
    }
  }
}

/**
 * Evaluate a condition tree. Throws `ConditionEvaluationError` when an
 * attribute it needs is absent — a rule never silently reads a default.
 *
 * `expr` conditions evaluate the numeric formula and treat a non-zero result as
 * true. The sandbox has no boolean operators by design (B6.4), so comparisons
 * belong in `attr`/`op` conditions.
 */
export function evaluateCondition(condition: Condition, context: ConditionContext): boolean {
  if (condition.all) {
    return condition.all.every((child) => evaluateCondition(child, context))
  }
  if (condition.any) {
    return condition.any.some((child) => evaluateCondition(child, context))
  }
  if (condition.not) {
    return !evaluateCondition(condition.not, context)
  }
  if (condition.expr) {
    return evaluateRuleFormula(condition.expr, context.formulaContext) !== 0
  }
  if (condition.attr && condition.op) {
    if (!context.values.has(condition.attr)) {
      throw new ConditionEvaluationError(`missing attribute: ${condition.attr}`)
    }
    const current = context.values.get(condition.attr) as AttributeLiteral
    const operand = resolveOperand(condition.value as ConditionValue, context)
    return compare(condition.op, condition.attr, current, operand, context)
  }

  throw new ConditionEvaluationError('Condition has no evaluable branch')
}
