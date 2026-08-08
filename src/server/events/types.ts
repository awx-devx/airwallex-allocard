/**
 * Domain event types — ARCHITECTURE.md §7, plus B1 identity events
 * (`organization.created`, `member.invited`, `member.joined`).
 */
export const DomainEventType = {
  ORGANIZATION_CREATED: 'organization.created',
  PROJECT_CREATED: 'project.created',
  PROJECT_APPROVED: 'project.approved',
  PROJECT_LAUNCHED: 'project.launched',
  PROJECT_CLOSING: 'project.closing',
  PROJECT_CLOSED: 'project.closed',
  BUDGET_APPROVED: 'budget.approved',
  BUDGET_UPDATED: 'budget.updated',
  BUDGET_THRESHOLD_CROSSED: 'budget.threshold_crossed',
  MEMBER_INVITED: 'member.invited',
  MEMBER_JOINED: 'member.joined',
  MEMBER_ADDED: 'member.added',
  MEMBER_ROLE_CHANGED: 'member.role_changed',
  MEMBER_SCOPE_CHANGED: 'member.scope_changed',
  MEMBER_REMOVED: 'member.removed',
  CARD_CREATED: 'card.created',
  CARD_STATUS_CHANGED: 'card.status_changed',
  CARD_LIMIT_UPDATED: 'card.limit_updated',
  REQUEST_CREATED: 'request.created',
  REQUEST_APPROVED: 'request.approved',
  REQUEST_REJECTED: 'request.rejected',
  REQUEST_ESCALATED: 'request.escalated',
  TRANSACTION_AUTHORIZED: 'transaction.authorized',
  TRANSACTION_CLEARED: 'transaction.cleared',
  TRANSACTION_DECLINED: 'transaction.declined',
  TRANSACTION_REVERSED: 'transaction.reversed',
  ATTRIBUTE_UPDATED: 'attribute.updated',
  SCHEDULE_TICK: 'schedule.tick',
} as const

export type DomainEventType = (typeof DomainEventType)[keyof typeof DomainEventType]

/** Envelope carried on every domain event (ARCHITECTURE.md §7). */
export type DomainEvent<TType extends DomainEventType = DomainEventType, TPayload = unknown> = {
  type: TType
  orgId: string
  projectId?: string
  subjectType: string
  subjectId: string
  payload: TPayload
  emittedAt: Date
}

export type OrganizationCreatedPayload = {
  organizationId: string
  createdBy: string
  slug: string
}

export type MemberInvitedPayload = {
  inviteId: string
  email: string
  orgRole: string
  invitedBy: string
}

export type MemberJoinedPayload = {
  membershipId: string
  userId: string
  orgRole: string
  inviteId: string
}

export type MemberRemovedPayload = {
  membershipId: string
  userId: string
  orgRole: string
}

export type ProjectCreatedPayload = {
  projectId: string
  code: string
  createdBy: string
}
