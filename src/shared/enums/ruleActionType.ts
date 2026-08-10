/**
 * Rule action verbs (RULES-ENGINE §3).
 * B6 implements card.* apply path; access/budget/approval/notify/flag may
 * record SKIPPED until their owning phase wires them.
 */
export const RuleActionType = {
  CARD_CREATE: 'card.create',
  CARD_SET_CONTROLS: 'card.setControls',
  CARD_FREEZE: 'card.freeze',
  CARD_UNFREEZE: 'card.unfreeze',
  CARD_CLOSE: 'card.close',
  ACCESS_GRANT: 'access.grant',
  ACCESS_REVOKE: 'access.revoke',
  ACCESS_EXPIRE: 'access.expire',
  BUDGET_ALLOCATE: 'budget.allocate',
  APPROVAL_REQUIRE: 'approval.require',
  NOTIFY: 'notify',
  FLAG_REVIEW: 'flag.review',
} as const

export type RuleActionType = (typeof RuleActionType)[keyof typeof RuleActionType]
