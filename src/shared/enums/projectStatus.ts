export const ProjectStatus = {
  DRAFT: 'DRAFT',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  ACTIVE: 'ACTIVE',
  CLOSING: 'CLOSING',
  CLOSED: 'CLOSED',
  ARCHIVED: 'ARCHIVED',
  CANCELLED: 'CANCELLED',
} as const

export type ProjectStatus = (typeof ProjectStatus)[keyof typeof ProjectStatus]
