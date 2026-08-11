import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import type { PolicyDecision } from '@/shared/types/purchaseRequest'

/** Minimal approval-rule shape needed for threshold matching. */
export type PolicyApprovalRule = {
  threshold: number
  requiredCount: number
}

/**
 * Facts the caller has already resolved from permissions, scope, and rules.
 * This function is pure — no I/O.
 */
export type PolicyEvaluationInput = {
  /** Integer minor units. */
  amount: number
  /** Role / permission check (e.g. payment.make). */
  rolePermitted: boolean
  /** Named reason when rolePermitted is false. */
  roleDenialReason?: string
  /** Access scope covers this project / subject. */
  accessScopePermitted: boolean
  accessScopeDenialReason?: string
  /**
   * Spending-rule denials (B6 spend controls, remaining budget, etc.).
   * Each string names the failing check. Empty = allowed.
   */
  spendingRuleDenials?: string[]
  /** Applicable rules (project + org defaults), any order. */
  approvalRules: readonly PolicyApprovalRule[]
}

const DEFAULT_ROLE_DENIAL = 'Role does not permit creating purchase requests'
const DEFAULT_SCOPE_DENIAL = 'Access scope does not permit this project'

/**
 * Pure policy check — same function for preview and submit.
 *
 * Order: role → access scope → spending rules → thresholds.
 * `NOT_PERMITTED` always names which check failed.
 *
 * Threshold: highest rule where `amount >= threshold` wins; its `requiredCount`
 * becomes `requiredApprovals`. No matching rule → `NO_APPROVAL_REQUIRED`.
 */
export function evaluatePolicy(input: PolicyEvaluationInput): PolicyDecision {
  if (!input.rolePermitted) {
    return {
      outcome: PolicyOutcome.NOT_PERMITTED,
      reasons: [input.roleDenialReason ?? DEFAULT_ROLE_DENIAL],
      requiredApprovals: 0,
    }
  }

  if (!input.accessScopePermitted) {
    return {
      outcome: PolicyOutcome.NOT_PERMITTED,
      reasons: [input.accessScopeDenialReason ?? DEFAULT_SCOPE_DENIAL],
      requiredApprovals: 0,
    }
  }

  const spendingDenials = input.spendingRuleDenials ?? []
  if (spendingDenials.length > 0) {
    return {
      outcome: PolicyOutcome.NOT_PERMITTED,
      reasons: spendingDenials,
      requiredApprovals: 0,
    }
  }

  const matching = input.approvalRules
    .filter((rule) => input.amount >= rule.threshold)
    .sort((a, b) => b.threshold - a.threshold || b.requiredCount - a.requiredCount)

  const rule = matching[0]
  if (!rule) {
    return {
      outcome: PolicyOutcome.NO_APPROVAL_REQUIRED,
      reasons: [],
      requiredApprovals: 0,
    }
  }

  return {
    outcome: PolicyOutcome.APPROVAL_REQUIRED,
    reasons: [],
    requiredApprovals: rule.requiredCount,
  }
}
