import { describe, expect, it } from 'vitest'
import { actionLabel, operatorLabel } from '@/lib/rules/operators'
import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { RuleActionType } from '@/shared/enums/ruleActionType'

describe('lib/rules/operators', () => {
  it('labels every ConditionOperator', () => {
    const expected: Record<ConditionOperator, string> = {
      [ConditionOperator.EQ]: 'equals',
      [ConditionOperator.NEQ]: 'does not equal',
      [ConditionOperator.GT]: 'is greater than',
      [ConditionOperator.GTE]: 'is greater than or equal to',
      [ConditionOperator.LT]: 'is less than',
      [ConditionOperator.LTE]: 'is less than or equal to',
      [ConditionOperator.IN]: 'is in',
      [ConditionOperator.NIN]: 'is not in',
      [ConditionOperator.CONTAINS]: 'contains',
      [ConditionOperator.BETWEEN]: 'is between',
      [ConditionOperator.CHANGED_BY]: 'changed by',
      [ConditionOperator.CROSSED_BELOW]: 'crosses below',
      [ConditionOperator.CROSSED_ABOVE]: 'crosses above',
    }
    for (const op of Object.values(ConditionOperator)) {
      expect(operatorLabel(op)).toBe(expected[op])
    }
  })

  it('labels every RuleActionType', () => {
    const expected: Record<RuleActionType, string> = {
      [RuleActionType.CARD_CREATE]: 'create card(s)',
      [RuleActionType.CARD_SET_CONTROLS]: 'set card controls',
      [RuleActionType.CARD_FREEZE]: 'freeze card(s)',
      [RuleActionType.CARD_UNFREEZE]: 'unfreeze card(s)',
      [RuleActionType.CARD_CLOSE]: 'close card(s)',
      [RuleActionType.ACCESS_GRANT]: 'grant access',
      [RuleActionType.ACCESS_REVOKE]: 'revoke access',
      [RuleActionType.ACCESS_EXPIRE]: 'expire access',
      [RuleActionType.BUDGET_ALLOCATE]: 'allocate budget',
      [RuleActionType.APPROVAL_REQUIRE]: 'require approval',
      [RuleActionType.NOTIFY]: 'send notification',
      [RuleActionType.FLAG_REVIEW]: 'flag for review',
    }
    for (const action of Object.values(RuleActionType)) {
      expect(actionLabel(action)).toBe(expected[action])
    }
  })
})
