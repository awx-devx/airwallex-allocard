/**
 * Pipeline step 1 — select rules (RULES-ENGINE §4). Pure.
 *
 * A rule runs when it is enabled, its scope covers the subject, and its trigger
 * matches. The event path is the mechanism; `SCHEDULED_SWEEP` is the backstop
 * that only picks up rules carrying a `schedule`.
 */
import { RuleScopeLevel } from '@/shared/enums/ruleScopeLevel'
import type { Rule } from '@/shared/types/rule'

/** Trigger event used by the periodic sweep rather than a domain event. */
export const SCHEDULED_SWEEP = 'schedule'

export type SelectRulesInput = {
  rules: readonly Rule[]
  triggerEvent: string
  projectId?: string | null
}

export function scopeMatches(rule: Rule, projectId?: string | null): boolean {
  if (rule.scope.level === RuleScopeLevel.ORG) {
    return true
  }
  return Boolean(projectId) && rule.scope.projectId === projectId
}

export function triggerMatches(rule: Rule, triggerEvent: string): boolean {
  if (triggerEvent === SCHEDULED_SWEEP) {
    return rule.trigger.schedule !== undefined
  }
  return (rule.trigger.events ?? []).includes(triggerEvent)
}

/**
 * Selected rules in merge order: ascending `priority`, then id.
 *
 * Merge itself is commutative — most-restrictive-wins gives the same answer in
 * any order — so this ordering exists for determinism and readable explanations,
 * not for correctness. A low-priority freeze beats a high-priority limit because
 * `INACTIVE` is more restrictive than `ACTIVE`, not because it ran last.
 */
export function selectRules(input: SelectRulesInput): Rule[] {
  return input.rules
    .filter(
      (rule) =>
        rule.enabled &&
        scopeMatches(rule, input.projectId) &&
        triggerMatches(rule, input.triggerEvent),
    )
    .sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
}
