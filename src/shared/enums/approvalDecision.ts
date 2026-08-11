export const ApprovalDecision = {
  APPROVE: 'APPROVE',
  REJECT: 'REJECT',
} as const

export type ApprovalDecision = (typeof ApprovalDecision)[keyof typeof ApprovalDecision]
