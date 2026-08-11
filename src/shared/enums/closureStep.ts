export const ClosureStep = {
  PREFLIGHT: 'PREFLIGHT',
  FREEZE: 'FREEZE',
  SETTLE: 'SETTLE',
  REVOKE: 'REVOKE',
  CLOSE_CARDS: 'CLOSE_CARDS',
  FINAL_REPORT: 'FINAL_REPORT',
  ARCHIVE: 'ARCHIVE',
} as const

export type ClosureStep = (typeof ClosureStep)[keyof typeof ClosureStep]
