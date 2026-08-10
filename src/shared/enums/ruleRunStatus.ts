/**
 * Outcome of one rule evaluation (ARCHITECTURE §5).
 * DRY_RUN is simulate-only and is never persisted.
 */
export const RuleRunStatus = {
  SUCCESS: 'SUCCESS',
  PARTIAL: 'PARTIAL',
  FAILED: 'FAILED',
  SKIPPED: 'SKIPPED',
  DRY_RUN: 'DRY_RUN',
} as const

export type RuleRunStatus = (typeof RuleRunStatus)[keyof typeof RuleRunStatus]
