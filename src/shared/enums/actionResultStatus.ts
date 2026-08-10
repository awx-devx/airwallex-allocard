/** Per-action outcome recorded on a RuleRun. */
export const ActionResultStatus = {
  APPLIED: 'APPLIED',
  SKIPPED: 'SKIPPED',
  FAILED: 'FAILED',
  CONFLICT: 'CONFLICT',
  /** Would apply — simulation only. */
  WOULD_APPLY: 'WOULD_APPLY',
} as const

export type ActionResultStatus = (typeof ActionResultStatus)[keyof typeof ActionResultStatus]
