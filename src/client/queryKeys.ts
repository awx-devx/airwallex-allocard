import type { ListAccessReviewsQuery } from '@/shared/types/accessReview'
import type { ListAttributeValuesQuery } from '@/shared/types/attribute'
import type { ListAuditQuery } from '@/shared/types/auditQuery'
import type { ListBudgetEntriesQuery } from '@/shared/types/budget'
import type { ListCardsQuery, ListProjectCardsQuery } from '@/shared/types/card'
import type { ListCardholdersQuery } from '@/shared/types/cardholder'
import type { ListProjectsQuery } from '@/shared/types/project'
import type { ListPurchaseRequestsQuery } from '@/shared/types/purchaseRequest'
import type { ListRulesQuery } from '@/shared/types/rule'
import type { ListRuleRunsQuery } from '@/shared/types/ruleRun'
import type {
  ListDeclinedTransactionsQuery,
  ListTransactionsQuery,
} from '@/shared/types/transaction'

export type ProjectFilter = ListProjectsQuery
export type EntryFilter = ListBudgetEntriesQuery
export type CardFilter = ListCardsQuery
export type ProjectCardFilter = ListProjectCardsQuery
export type RuleFilter = ListRulesQuery
export type RunFilter = ListRuleRunsQuery
export type RequestFilter = ListPurchaseRequestsQuery
export type TxFilter = ListTransactionsQuery
export type DeclinedTxFilter = ListDeclinedTransactionsQuery
export type AuditFilter = ListAuditQuery
export type CardholderFilter = ListCardholdersQuery
export type AttributeValueFilter = ListAttributeValuesQuery
export type AccessReviewFilter = ListAccessReviewsQuery

/**
 * Single authority for TanStack Query keys.
 * Hierarchical prefixes are deliberate: invalidating `['projects', id]` clears
 * that project's members, budget, and nested resources in one call.
 */
export const qk = {
  me: () => ['me'] as const,
  permissions: () => ['me', 'permissions'] as const,
  onboardingStatus: () => ['onboarding', 'status'] as const,

  org: (id: string) => ['organizations', id] as const,
  orgMembers: (id: string) => ['organizations', id, 'members'] as const,
  invites: () => ['invites'] as const,
  invitePreview: (token: string) => ['invites', 'preview', token] as const,

  projects: (f?: ProjectFilter) => ['projects', f ?? {}] as const,
  project: (id: string) => ['projects', id] as const,
  projectMembers: (id: string) => ['projects', id, 'members'] as const,
  workstreams: (id: string) => ['projects', id, 'workstreams'] as const,
  projectHistory: (id: string) => ['projects', id, 'history'] as const,
  accessHistory: (id: string) => ['projects', id, 'access-history'] as const,
  budget: (id: string) => ['projects', id, 'budget'] as const,
  budgetCategories: (id: string) => ['projects', id, 'budget', 'categories'] as const,
  budgetEntries: (id: string, f?: EntryFilter) =>
    ['projects', id, 'budget', 'entries', f ?? {}] as const,
  budgetHistory: (id: string) => ['projects', id, 'budget', 'history'] as const,
  budgetChangeRequests: (id: string) => ['projects', id, 'budget', 'change-requests'] as const,
  cardsForProject: (id: string, f?: ProjectCardFilter) =>
    ['projects', id, 'cards', f ?? {}] as const,
  approvalRules: (projectId: string) => ['projects', projectId, 'approval-rules'] as const,
  closurePreflight: (id: string) => ['projects', id, 'closure', 'preflight'] as const,
  closureStatus: (id: string) => ['projects', id, 'closure', 'status'] as const,

  cards: (f?: CardFilter) => ['cards', f ?? {}] as const,
  card: (id: string) => ['cards', id] as const,
  cardLimits: (id: string) => ['cards', id, 'limits'] as const,
  cardExplain: (id: string) => ['cards', id, 'explain'] as const,

  cardholders: (f?: CardholderFilter) => ['cardholders', f ?? {}] as const,
  cardholder: (id: string) => ['cardholders', id] as const,

  roles: () => ['roles'] as const,
  accessReviews: (f?: AccessReviewFilter) => ['accessReviews', f ?? {}] as const,

  rules: (f?: RuleFilter) => ['rules', f ?? {}] as const,
  ruleRuns: (f?: RunFilter) => ['ruleRuns', f ?? {}] as const,
  ruleRun: (id: string) => ['ruleRuns', id] as const,
  attributes: () => ['attributes'] as const,
  attributeValues: (f?: AttributeValueFilter) => ['attributes', 'values', f ?? {}] as const,

  requests: (f?: RequestFilter) => ['requests', f ?? {}] as const,
  request: (id: string) => ['requests', id] as const,
  approvals: () => ['approvals'] as const,
  approvalCount: () => ['approvals', 'count'] as const,

  transactions: (f?: TxFilter) => ['transactions', f ?? {}] as const,
  transaction: (id: string) => ['transactions', id] as const,
  declinedTransactions: (f?: DeclinedTxFilter) => ['transactions', 'declined', f ?? {}] as const,

  activity: (id?: string) => ['activity', id ?? 'org'] as const,
  audit: (f?: AuditFilter) => ['audit', f ?? {}] as const,

  projectReport: (id: string) => ['reports', 'project', id] as const,
  organizationReport: () => ['reports', 'organization'] as const,
  finalReport: (id: string) => ['reports', 'final', id] as const,
} as const
