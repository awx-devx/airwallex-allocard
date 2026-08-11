import { ConditionOperator } from '@/shared/enums/conditionOperator'
import { RuleActionType } from '@/shared/enums/ruleActionType'

export function operatorLabel(op: ConditionOperator): string {
  switch (op) {
    case ConditionOperator.EQ:
      return 'equals'
    case ConditionOperator.NEQ:
      return 'does not equal'
    case ConditionOperator.GT:
      return 'is greater than'
    case ConditionOperator.GTE:
      return 'is greater than or equal to'
    case ConditionOperator.LT:
      return 'is less than'
    case ConditionOperator.LTE:
      return 'is less than or equal to'
    case ConditionOperator.IN:
      return 'is in'
    case ConditionOperator.NIN:
      return 'is not in'
    case ConditionOperator.CONTAINS:
      return 'contains'
    case ConditionOperator.BETWEEN:
      return 'is between'
    case ConditionOperator.CHANGED_BY:
      return 'changed by'
    case ConditionOperator.CROSSED_BELOW:
      return 'crosses below'
    case ConditionOperator.CROSSED_ABOVE:
      return 'crosses above'
    default: {
      const _exhaustive: never = op
      return String(_exhaustive)
    }
  }
}

export function actionLabel(action: RuleActionType): string {
  switch (action) {
    case RuleActionType.CARD_CREATE:
      return 'create card(s)'
    case RuleActionType.CARD_SET_CONTROLS:
      return 'set card controls'
    case RuleActionType.CARD_FREEZE:
      return 'freeze card(s)'
    case RuleActionType.CARD_UNFREEZE:
      return 'unfreeze card(s)'
    case RuleActionType.CARD_CLOSE:
      return 'close card(s)'
    case RuleActionType.ACCESS_GRANT:
      return 'grant access'
    case RuleActionType.ACCESS_REVOKE:
      return 'revoke access'
    case RuleActionType.ACCESS_EXPIRE:
      return 'expire access'
    case RuleActionType.BUDGET_ALLOCATE:
      return 'allocate budget'
    case RuleActionType.APPROVAL_REQUIRE:
      return 'require approval'
    case RuleActionType.NOTIFY:
      return 'send notification'
    case RuleActionType.FLAG_REVIEW:
      return 'flag for review'
    default: {
      const _exhaustive: never = action
      return String(_exhaustive)
    }
  }
}
