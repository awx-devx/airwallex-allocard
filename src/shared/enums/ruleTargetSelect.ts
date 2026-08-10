/** Target selectors for rule actions (RULES-ENGINE §3). */
export const RuleTargetSelect = {
  PROJECT_CARDS: 'PROJECT_CARDS',
  MEMBER_CARDS: 'MEMBER_CARDS',
  CARD: 'CARD',
  PROJECT_MEMBERS: 'PROJECT_MEMBERS',
  EVENT_SUBJECT: 'EVENT_SUBJECT',
} as const

export type RuleTargetSelect = (typeof RuleTargetSelect)[keyof typeof RuleTargetSelect]
