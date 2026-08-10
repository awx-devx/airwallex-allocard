/**
 * B6 rule-formula dialect (RULES-ENGINE §3).
 *
 * Differences from the B4 budget dialect, and why they are safe:
 *
 * 1. **Dotted attribute keys** (`project.budget.remaining`) are single
 *    identifiers resolved from the evaluation context. There is still no
 *    property access — a dot that does not join two identifier characters is
 *    rejected exactly as before.
 * 2. **Decimals and float intermediates** are allowed, because rules multiply
 *    money by rates (`* 0.25`) and read float attributes (`campaign.roas`).
 *    Money is still integer minor units *at rest*: `evaluateMoneyFormula`
 *    truncates once, at the boundary, and nothing else stores a formula result.
 * 3. **Three more functions** — `abs`, `daysBetween`, `coalesce`.
 *
 * Every DoS cap (length, node count, timeout) is unchanged, and a missing
 * attribute still fails the run rather than resolving to zero.
 *
 * Dates enter the context as epoch milliseconds under their own key, plus a
 * `now` identifier. There is deliberately no `now()` function and no duration
 * literal: relative card windows are an action parameter, not an expression.
 */
import {
  collectIdentifiers,
  parse,
  type AstNode,
  type ParseOptions,
} from '@/server/lib/formula/parse'
import { evaluate, truncInt, type FormulaContext } from '@/server/lib/formula/evaluate'
import type { AttributeLiteral } from '@/shared/types/attribute'

export const RULE_FUNCTIONS: ReadonlySet<string> = new Set([
  'min',
  'max',
  'round',
  'floor',
  'ceil',
  'clamp',
  'pct',
  'abs',
  'daysBetween',
  'coalesce',
])

export const RULE_FORMULA_OPTIONS: ParseOptions = {
  allowDottedIdentifiers: true,
  allowDecimals: true,
  functions: RULE_FUNCTIONS,
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}/

export function parseRuleFormula(expression: string): AstNode {
  return parse(expression, RULE_FORMULA_OPTIONS)
}

/** Attribute keys a formula reads — what the pipeline must resolve for it. */
export function ruleFormulaIdentifiers(expression: string): string[] {
  return collectIdentifiers(parseRuleFormula(expression))
}

export type AttributeReadingLike = {
  key: string
  value: AttributeLiteral
}

/**
 * Project attribute readings into a numeric context.
 * Numbers pass through, ISO dates become epoch milliseconds, and anything else
 * (strings, booleans) is null — usable in a condition, not in arithmetic.
 */
export function buildRuleFormulaContext(
  readings: readonly AttributeReadingLike[],
  now: Date = new Date(),
): FormulaContext {
  const context: FormulaContext = { now: now.getTime() }

  for (const reading of readings) {
    const { value } = reading
    if (typeof value === 'number') {
      context[reading.key] = value
      continue
    }
    if (typeof value === 'string' && ISO_DATE.test(value)) {
      const parsed = new Date(value).getTime()
      context[reading.key] = Number.isNaN(parsed) ? null : parsed
      continue
    }
    context[reading.key] = null
  }

  return context
}

/** Exact result — no truncation. Use for ratios and intermediate values. */
export function evaluateRuleFormula(expression: string, context: FormulaContext): number {
  return evaluate(parseRuleFormula(expression), context, { integerOnly: false })
}

/**
 * Result destined for a money field. Truncating toward zero exactly once, here,
 * is what keeps stored amounts integer minor units.
 */
export function evaluateMoneyFormula(expression: string, context: FormulaContext): number {
  return truncInt(evaluateRuleFormula(expression, context))
}
