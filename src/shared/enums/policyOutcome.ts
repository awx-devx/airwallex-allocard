export const PolicyOutcome = {
  NO_APPROVAL_REQUIRED: 'NO_APPROVAL_REQUIRED',
  APPROVAL_REQUIRED: 'APPROVAL_REQUIRED',
  NOT_PERMITTED: 'NOT_PERMITTED',
} as const

export type PolicyOutcome = (typeof PolicyOutcome)[keyof typeof PolicyOutcome]
