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
  REQUEST_SUBMITTED: 'request.submitted',
  REQUEST_APPROVED: 'request.approved',
  REQUEST_REJECTED: 'request.rejected',
  REQUEST_ESCALATED: 'request.escalated',
  REQUEST_CANCELLED: 'request.cancelled',
  TRANSACTION_AUTHORIZED: 'transaction.authorized',
  TRANSACTION_CLEARED: 'transaction.cleared',
  TRANSACTION_DECLINED: 'transaction.declined',
  TRANSACTION_REVERSED: 'transaction.reversed',
  ATTRIBUTE_UPDATED: 'attribute.updated',
  RULE_EVALUATED: 'rule.evaluated',
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

/** Project-scoped member events (B3). */
export type ProjectMemberAddedPayload = {
  projectMemberId: string
  projectId: string
  userId: string
  roleId: string
  addedBy: string
}

export type ProjectMemberRoleChangedPayload = {
  projectMemberId: string
  projectId: string
  userId: string
  fromRoleId: string
  toRoleId: string
}

export type ProjectMemberScopeChangedPayload = {
  projectMemberId: string
  projectId: string
  userId: string
}

export type ProjectMemberRemovedPayload = {
  projectMemberId: string
  projectId: string
  userId: string
  removedBy: string
}

export type ProjectCreatedPayload = {
  projectId: string
  code: string
  createdBy: string
}

export type BudgetUpdatedPayload = {
  projectId: string
  entryId: string
  entryType: string
  approved: number
  committed: number
  actual: number
  remaining: number
  utilisationPct: number
  overCommitted: boolean
}

export type BudgetApprovedPayload = {
  projectId: string
  entryId: string
  approved: number
}

export type BudgetThresholdCrossedPayload = {
  projectId: string
  thresholdPct: number
  previousUtilisationPct: number
  utilisationPct: number
}

export type CardCreatedPayload = {
  cardId: string
  projectId: string | null
  purpose: string
  cardholderId: string
}

export type CardStatusChangedPayload = {
  cardId: string
  projectId: string | null
  from: string
  to: string
}

export type CardLimitUpdatedPayload = {
  cardId: string
  projectId: string | null
}

export type RuleEvaluatedPayload = {
  ruleRunId: string
  ruleId: string
  projectId: string | null
  status: string
  matched: boolean
  /** Cards whose desired state actually changed. */
  changedCardIds: string[]
}

export type AttributeUpdatedPayload = {
  key: string
  subjectType: string
  subjectId: string
  source: string
  observedAt: string
}
