/**
 * Flat permission strings from the product permission matrix.
 * Values are dotted identifiers; keys are SCREAMING_SNAKE for TypeScript.
 */
export const Permission = {
  PROJECT_VIEW: 'project.view',
  PROJECT_EDIT: 'project.edit',
  PROJECT_CREATE: 'project.create',
  PROJECT_CLOSE: 'project.close',
  BUDGET_VIEW: 'budget.view',
  BUDGET_EDIT: 'budget.edit',
  BUDGET_REQUEST: 'budget.request',
  MEMBER_VIEW: 'member.view',
  MEMBER_MANAGE: 'member.manage',
  ROLE_ASSIGN: 'role.assign',
  CARD_CREATE: 'card.create',
  CARD_VIEW: 'card.view',
  CARD_VIEW_DETAILS: 'card.viewDetails',
  CARD_MANAGE: 'card.manage',
  PAYMENT_MAKE: 'payment.make',
  REQUEST_APPROVE: 'request.approve',
  CONTROL_EDIT: 'control.edit',
  TRANSACTION_VIEW: 'transaction.view',
  REPORT_EXPORT: 'report.export',
} as const

export type Permission = (typeof Permission)[keyof typeof Permission]
