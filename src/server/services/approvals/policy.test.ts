import { describe, expect, it } from 'vitest'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { evaluatePolicy, type PolicyEvaluationInput } from '@/server/services/approvals/policy'

function base(overrides: Partial<PolicyEvaluationInput> = {}): PolicyEvaluationInput {
  return {
    amount: 5_000,
    rolePermitted: true,
    accessScopePermitted: true,
    spendingRuleDenials: [],
    approvalRules: [
      { threshold: 10_000, requiredCount: 1 },
      { threshold: 100_000, requiredCount: 2 },
    ],
    ...overrides,
  }
}

describe('approvals/policy', () => {
  it('returns NOT_PERMITTED naming the role check', () => {
    const decision = evaluatePolicy(
      base({
        rolePermitted: false,
        roleDenialReason: 'Missing permission payment.make',
      }),
    )
    expect(decision).toEqual({
      outcome: PolicyOutcome.NOT_PERMITTED,
      reasons: ['Missing permission payment.make'],
      requiredApprovals: 0,
    })
  })

  it('returns NOT_PERMITTED naming the access scope check', () => {
    const decision = evaluatePolicy(
      base({
        accessScopePermitted: false,
        accessScopeDenialReason: 'Access scope excludes project proj_1',
      }),
    )
    expect(decision.outcome).toBe(PolicyOutcome.NOT_PERMITTED)
    expect(decision.reasons).toEqual(['Access scope excludes project proj_1'])
  })

  it('returns NOT_PERMITTED naming spending rule failures', () => {
    const decision = evaluatePolicy(
      base({
        spendingRuleDenials: ['Remaining budget 2000 is below requested amount 5000'],
      }),
    )
    expect(decision.outcome).toBe(PolicyOutcome.NOT_PERMITTED)
    expect(decision.reasons[0]).toMatch(/Remaining budget/)
  })

  it('checks role before scope before spending', () => {
    const decision = evaluatePolicy(
      base({
        rolePermitted: false,
        accessScopePermitted: false,
        spendingRuleDenials: ['blocked'],
        roleDenialReason: 'role-fail',
      }),
    )
    expect(decision.reasons).toEqual(['role-fail'])
  })

  it('under threshold needs no approval', () => {
    const decision = evaluatePolicy(base({ amount: 9_999 }))
    expect(decision).toEqual({
      outcome: PolicyOutcome.NO_APPROVAL_REQUIRED,
      reasons: [],
      requiredApprovals: 0,
    })
  })

  it('at/over threshold requires approval with that rule requiredCount', () => {
    expect(evaluatePolicy(base({ amount: 10_000 }))).toEqual({
      outcome: PolicyOutcome.APPROVAL_REQUIRED,
      reasons: [],
      requiredApprovals: 1,
    })
    expect(evaluatePolicy(base({ amount: 100_000 }))).toEqual({
      outcome: PolicyOutcome.APPROVAL_REQUIRED,
      reasons: [],
      requiredApprovals: 2,
    })
    expect(evaluatePolicy(base({ amount: 250_000 })).requiredApprovals).toBe(2)
  })

  it('with no approval rules yields NO_APPROVAL_REQUIRED', () => {
    const decision = evaluatePolicy(base({ approvalRules: [], amount: 1_000_000 }))
    expect(decision.outcome).toBe(PolicyOutcome.NO_APPROVAL_REQUIRED)
    expect(decision.requiredApprovals).toBe(0)
  })
})
