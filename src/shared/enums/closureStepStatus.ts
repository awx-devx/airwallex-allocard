export const ClosureStepStatus = {
  PENDING: 'PENDING',
  IN_PROGRESS: 'IN_PROGRESS',
  BLOCKED: 'BLOCKED',
  DONE: 'DONE',
  SKIPPED: 'SKIPPED',
} as const

export type ClosureStepStatus = (typeof ClosureStepStatus)[keyof typeof ClosureStepStatus]
