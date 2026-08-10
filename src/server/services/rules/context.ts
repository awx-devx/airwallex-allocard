/**
 * Pipeline step 2 — build the evaluation context (RULES-ENGINE §4). Pure.
 *
 * The I/O already happened in `services/attributes/resolve.ts`; this step works
 * out which keys a rule actually reads, projects them into a formula context,
 * and reports missing vs stale so the caller can fail or skip with the key named.
 *
 * Distinguishing a *formula* from a *literal* in the DSL is by field, never by
 * guesswork: `"USD"` is a currency, `"project.startDate"` is an attribute, and
 * both are strings. The rules are documented on each helper below.
 */
import { FormulaError, ruleFormulaIdentifiers } from '@/server/lib/formula'
import { buildRuleFormulaContext } from '@/server/lib/formula/rules'
import type { FormulaContext } from '@/server/lib/formula/evaluate'
import type { AttributeContext } from '@/server/services/attributes/resolve'
import type { Condition, Rule, RuleAction, RuleControlsParams } from '@/shared/types/rule'
import type { RuleRunInputValue } from '@/shared/types/ruleRun'

const ISO_4217 = /^[A-Z]{3}$/
const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]|$)/

/** A currency param is a literal ISO-4217 code; anything else is an expression. */
export function isCurrencyLiteral(value: string): boolean {
  return ISO_4217.test(value)
}

/** A date param is a literal when it is an ISO timestamp; otherwise an expression. */
export function isDateLiteral(value: string): boolean {
  return ISO_DATE.test(value)
}

function identifiersOf(expression: string): string[] {
  try {
    return ruleFormulaIdentifiers(expression)
  } catch (error) {
    if (error instanceof FormulaError) {
      return []
    }
    throw error
  }
}

function conditionKeys(condition: Condition, out: Set<string>): void {
  if (condition.all) {
    condition.all.forEach((child) => conditionKeys(child, out))
  }
  if (condition.any) {
    condition.any.forEach((child) => conditionKeys(child, out))
  }
  if (condition.not) {
    conditionKeys(condition.not, out)
  }
  if (condition.attr) {
    out.add(condition.attr)
  }
  if (
    condition.value !== undefined &&
    condition.value !== null &&
    typeof condition.value === 'object' &&
    !Array.isArray(condition.value) &&
    'attr' in condition.value
  ) {
    out.add(condition.value.attr)
  }
  if (condition.expr) {
    identifiersOf(condition.expr).forEach((key) => out.add(key))
  }
}

function paramKeys(params: RuleControlsParams, out: Set<string>): void {
  for (const limit of params.transactionLimits?.limits ?? []) {
    if (typeof limit.amount === 'string') {
      identifiersOf(limit.amount).forEach((key) => out.add(key))
    }
  }
  const currency = params.transactionLimits?.currency
  if (currency !== undefined && !isCurrencyLiteral(currency)) {
    identifiersOf(currency).forEach((key) => out.add(key))
  }
  for (const window of [params.activeFrom, params.activeTo]) {
    if (typeof window === 'string' && !isDateLiteral(window)) {
      identifiersOf(window).forEach((key) => out.add(key))
    }
  }
  for (const allowlist of [
    params.allowedCurrencies,
    params.allowedMerchantCategories,
    params.allowedMerchantCountries,
    params.allowedMerchantBrands,
  ]) {
    if (typeof allowlist === 'string') {
      out.add(allowlist)
    }
  }
  if (params.when !== undefined) {
    identifiersOf(params.when).forEach((key) => out.add(key))
  }
}

function actionKeys(actions: readonly RuleAction[], out: Set<string>): void {
  for (const action of actions) {
    paramKeys(action.params, out)
  }
}

/** Every attribute key a rule reads, across conditions and action params. */
export function collectRuleAttributeKeys(rule: Pick<Rule, 'when' | 'then' | 'else'>): string[] {
  const out = new Set<string>()
  conditionKeys(rule.when, out)
  actionKeys(rule.then, out)
  actionKeys(rule.else ?? [], out)
  // `now` is supplied by the formula context, not resolved as an attribute.
  out.delete('now')
  return [...out]
}

export type RuleContextResolution = {
  keys: string[]
  /** Readings consumed, recorded verbatim on the RuleRun for explainability. */
  inputs: RuleRunInputValue[]
  /** Keys with no reading at all — the run FAILS naming them. */
  missing: string[]
  /** Keys past their TTL — the run is SKIPPED naming them. */
  stale: string[]
  formulaContext: FormulaContext
}

/** Project the resolved attributes a rule needs into an evaluation context. */
export function resolveRuleContext(
  rule: Pick<Rule, 'when' | 'then' | 'else'>,
  attributes: AttributeContext,
  now: Date,
): RuleContextResolution {
  const keys = collectRuleAttributeKeys(rule)
  const inputs: RuleRunInputValue[] = []
  const missing: string[] = []
  const stale: string[] = []

  for (const key of keys) {
    const reading = attributes.readings.find((entry) => entry.key === key)
    if (!reading) {
      missing.push(key)
      continue
    }
    inputs.push({
      key: reading.key,
      subjectType: reading.subjectType,
      subjectId: reading.subjectId,
      value: reading.value,
      observedAt: reading.observedAt,
      ttlSec: reading.ttlSec,
      stale: reading.stale,
    })
    if (reading.stale) {
      stale.push(key)
    }
  }

  return {
    keys,
    inputs,
    missing,
    stale,
    formulaContext: buildRuleFormulaContext(attributes.readings, now),
  }
}
