/** Condition operators in the rule DSL (RULES-ENGINE §3). */
export const ConditionOperator = {
  EQ: 'eq',
  NEQ: 'neq',
  GT: 'gt',
  GTE: 'gte',
  LT: 'lt',
  LTE: 'lte',
  IN: 'in',
  NIN: 'nin',
  CONTAINS: 'contains',
  BETWEEN: 'between',
  CHANGED_BY: 'changedBy',
  CROSSED_BELOW: 'crossedBelow',
  CROSSED_ABOVE: 'crossedAbove',
} as const

export type ConditionOperator = (typeof ConditionOperator)[keyof typeof ConditionOperator]
