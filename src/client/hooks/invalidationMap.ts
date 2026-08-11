import type { QueryClient } from '@tanstack/react-query'
import { qk } from '@/client/queryKeys'

/** Where to read a path-param id for invalidation. */
export type IdSource =
  'variables.id' | 'variables.projectId' | 'variables.orgId' | 'data.id' | 'data.projectId'

export type InvalidationEntry =
  | { key: 'me' }
  | { key: 'permissions' }
  | { key: 'onboardingStatus' }
  | { key: 'invites' }
  | { key: 'roles' }
  | { key: 'attributes' }
  | { key: 'attributeValues' }
  | { key: 'approvals' }
  | { key: 'approvalCount' }
  | { key: 'cards' }
  | { key: 'cardholders' }
  | { key: 'rules' }
  | { key: 'ruleRuns' }
  | { key: 'requests' }
  | { key: 'transactions' }
  | { key: 'accessReviews' }
  | { key: 'projects' }
  | { key: 'organizationReport' }
  | { key: 'org'; idFrom: IdSource }
  | { key: 'orgMembers'; idFrom: IdSource }
  | { key: 'project'; idFrom: IdSource }
  | { key: 'projectMembers'; idFrom: IdSource }
  | { key: 'workstreams'; idFrom: IdSource }
  | { key: 'budget'; idFrom: IdSource }
  | { key: 'budgetCategories'; idFrom: IdSource }
  | { key: 'budgetEntries'; idFrom: IdSource }
  | { key: 'budgetChangeRequests'; idFrom: IdSource }
  | { key: 'cardsForProject'; idFrom: IdSource }
  | { key: 'approvalRules'; idFrom: IdSource }
  | { key: 'closurePreflight'; idFrom: IdSource }
  | { key: 'closureStatus'; idFrom: IdSource }
  | { key: 'finalReport'; idFrom: IdSource }
  | { key: 'activity'; idFrom: IdSource }
  | { key: 'card'; idFrom: IdSource }
  | { key: 'cardLimits'; idFrom: IdSource }
  | { key: 'cardExplain'; idFrom: IdSource }
  | { key: 'request'; idFrom: IdSource }
  | { key: 'transaction'; idFrom: IdSource }

export type InvalidationContext = {
  variables?: unknown
  data?: unknown
}

function readPath(root: unknown, path: string): unknown {
  if (root === null || root === undefined) return undefined
  const parts = path.split('.')
  let cur: unknown = root
  for (const part of parts) {
    if (typeof cur !== 'object' || cur === null) return undefined
    cur = (cur as Record<string, unknown>)[part]
  }
  return cur
}

function resolveId(ctx: InvalidationContext, idFrom: IdSource): string | undefined {
  const [root, ...rest] = idFrom.split('.') as [keyof InvalidationContext, ...string[]]
  const value = readPath(ctx[root], rest.join('.'))
  return typeof value === 'string' ? value : undefined
}

function toQueryKey(entry: InvalidationEntry, ctx: InvalidationContext): readonly unknown[] | null {
  switch (entry.key) {
    case 'me':
      return qk.me()
    case 'permissions':
      return qk.permissions()
    case 'onboardingStatus':
      return qk.onboardingStatus()
    case 'invites':
      return qk.invites()
    case 'roles':
      return qk.roles()
    case 'attributes':
      return qk.attributes()
    case 'attributeValues':
      return qk.attributeValues()
    case 'approvals':
      return qk.approvals()
    case 'approvalCount':
      return qk.approvalCount()
    case 'cards':
      return qk.cards()
    case 'cardholders':
      return qk.cardholders()
    case 'rules':
      return qk.rules()
    case 'ruleRuns':
      return qk.ruleRuns()
    case 'requests':
      return qk.requests()
    case 'transactions':
      return qk.transactions()
    case 'accessReviews':
      return qk.accessReviews()
    case 'projects':
      return qk.projects()
    case 'organizationReport':
      return qk.organizationReport()
    case 'org': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.org(id) : null
    }
    case 'orgMembers': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.orgMembers(id) : null
    }
    case 'project': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.project(id) : null
    }
    case 'projectMembers': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.projectMembers(id) : null
    }
    case 'workstreams': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.workstreams(id) : null
    }
    case 'budget': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.budget(id) : null
    }
    case 'budgetCategories': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.budgetCategories(id) : null
    }
    case 'budgetEntries': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.budgetEntries(id) : null
    }
    case 'budgetChangeRequests': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.budgetChangeRequests(id) : null
    }
    case 'cardsForProject': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.cardsForProject(id) : null
    }
    case 'approvalRules': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.approvalRules(id) : null
    }
    case 'closurePreflight': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.closurePreflight(id) : null
    }
    case 'closureStatus': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.closureStatus(id) : null
    }
    case 'finalReport': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.finalReport(id) : null
    }
    case 'activity': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.activity(id) : null
    }
    case 'card': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.card(id) : null
    }
    case 'cardLimits': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.cardLimits(id) : null
    }
    case 'cardExplain': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.cardExplain(id) : null
    }
    case 'request': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.request(id) : null
    }
    case 'transaction': {
      const id = resolveId(ctx, entry.idFrom)
      return id ? qk.transaction(id) : null
    }
    default: {
      const _exhaustive: never = entry
      return _exhaustive
    }
  }
}

const projectIdVar = { key: 'project' as const, idFrom: 'variables.id' as const }
const cards = { key: 'cards' as const }
const me = { key: 'me' as const }
const permissions = { key: 'permissions' as const }
const projects = { key: 'projects' as const }

/** Mutation hook name → keys to invalidate. Ephemeral mutations use `[]`. */
export const invalidationMap = {
  useCreateProject: [{ key: 'projects' }],
  useUpdateProject: [projectIdVar, projects],
  useTransitionProject: [projectIdVar, projects, { key: 'activity', idFrom: 'variables.id' }],
  useCreateWorkstream: [{ key: 'workstreams', idFrom: 'variables.id' }, projectIdVar],
  useUpdateWorkstream: [{ key: 'workstreams', idFrom: 'variables.id' }, projectIdVar],
  useDeleteWorkstream: [{ key: 'workstreams', idFrom: 'variables.id' }, projectIdVar],
  useChangeProjectOwner: [projectIdVar, projects, { key: 'activity', idFrom: 'variables.id' }],

  useCreateOrganization: [me],
  useUpdateOrganization: [{ key: 'org', idFrom: 'variables.id' }, me],
  useUpdateOrgMember: [{ key: 'orgMembers', idFrom: 'variables.id' }, me, permissions],
  useRemoveOrgMember: [{ key: 'orgMembers', idFrom: 'variables.id' }, me, permissions],
  useCreateInvite: [{ key: 'invites' }],
  useRevokeInvite: [{ key: 'invites' }],
  useAcceptInvite: [me, { key: 'onboardingStatus' }, { key: 'invites' }],

  useAddMember: [{ key: 'projectMembers', idFrom: 'variables.id' }, projectIdVar, permissions],
  useUpdateMember: [{ key: 'projectMembers', idFrom: 'variables.id' }, permissions, cards],
  useRemoveMember: [
    { key: 'projectMembers', idFrom: 'variables.id' },
    projectIdVar,
    permissions,
    cards,
  ],
  useCreateRole: [{ key: 'roles' }, permissions],
  useUpdateRole: [{ key: 'roles' }, permissions],
  useDeleteRole: [{ key: 'roles' }, permissions],
  useResolveAccessReview: [
    { key: 'accessReviews' },
    { key: 'projectMembers', idFrom: 'data.projectId' },
    permissions,
    cards,
  ],
  usePreviewMember: [],

  useSetBudget: [{ key: 'budget', idFrom: 'variables.id' }, projectIdVar, cards],
  useCreateBudgetCategory: [
    { key: 'budgetCategories', idFrom: 'variables.id' },
    { key: 'budget', idFrom: 'variables.id' },
    cards,
  ],
  useUpdateBudgetCategory: [
    { key: 'budgetCategories', idFrom: 'variables.id' },
    { key: 'budget', idFrom: 'variables.id' },
    cards,
  ],
  useDeleteBudgetCategory: [
    { key: 'budgetCategories', idFrom: 'variables.id' },
    { key: 'budget', idFrom: 'variables.id' },
    cards,
  ],
  useCreateBudgetEntry: [
    { key: 'budgetEntries', idFrom: 'variables.id' },
    { key: 'budget', idFrom: 'variables.id' },
    cards,
  ],
  useCreateChangeRequest: [{ key: 'budgetChangeRequests', idFrom: 'variables.id' }],
  useDecideChangeRequest: [
    { key: 'budget', idFrom: 'data.projectId' },
    { key: 'budgetEntries', idFrom: 'data.projectId' },
    { key: 'budgetChangeRequests', idFrom: 'data.projectId' },
    cards,
  ],
  useValidateFormula: [],

  useCreateCard: [cards, { key: 'cardsForProject', idFrom: 'variables.id' }, projectIdVar],
  useUpdateCard: [
    { key: 'card', idFrom: 'variables.id' },
    { key: 'cardLimits', idFrom: 'variables.id' },
    { key: 'cardExplain', idFrom: 'variables.id' },
    cards,
  ],
  useFreezeCard: [{ key: 'card', idFrom: 'variables.id' }, cards],
  useUnfreezeCard: [{ key: 'card', idFrom: 'variables.id' }, cards],
  useCloseCard: [{ key: 'card', idFrom: 'variables.id' }, cards],
  useReconcileCard: [
    { key: 'card', idFrom: 'variables.id' },
    { key: 'cardLimits', idFrom: 'variables.id' },
    cards,
  ],
  useCreateCardholder: [{ key: 'cardholders' }],
  usePanToken: [],

  useCreateRule: [{ key: 'rules' }, cards],
  useUpdateRule: [{ key: 'rules' }, cards],
  useDeleteRule: [{ key: 'rules' }, cards],
  useEnableRule: [{ key: 'rules' }, cards],
  useValidateRule: [],
  useSimulateRules: [],
  useSimulatePurchase: [{ key: 'transactions' }, cards],
  useSetAttributeValue: [
    { key: 'attributeValues' },
    { key: 'attributes' },
    cards,
    { key: 'ruleRuns' },
  ],
  useCreateAttribute: [{ key: 'attributes' }],
  useUpdateAttribute: [{ key: 'attributes' }],

  useCreateRequest: [{ key: 'requests' }, { key: 'approvals' }, { key: 'approvalCount' }],
  useUpdateRequest: [
    { key: 'request', idFrom: 'variables.id' },
    { key: 'requests' },
    { key: 'approvals' },
    { key: 'approvalCount' },
  ],
  useSubmitRequest: [
    { key: 'request', idFrom: 'variables.id' },
    { key: 'requests' },
    { key: 'approvals' },
    { key: 'approvalCount' },
  ],
  useCancelRequest: [
    { key: 'request', idFrom: 'variables.id' },
    { key: 'requests' },
    { key: 'approvals' },
    { key: 'approvalCount' },
  ],
  useDecideRequest: [
    { key: 'requests' },
    { key: 'approvals' },
    { key: 'approvalCount' },
    { key: 'budget', idFrom: 'data.projectId' },
    cards,
  ],
  usePutApprovalRules: [{ key: 'approvalRules', idFrom: 'variables.id' }],
  usePolicyPreview: [],

  useUploadReceipt: [{ key: 'transactions' }, { key: 'transaction', idFrom: 'variables.id' }],
  useDeleteReceipt: [{ key: 'transactions' }, { key: 'transaction', idFrom: 'variables.id' }],
  useSyncTransactionsAdmin: [{ key: 'transactions' }],

  useStartClosure: [
    { key: 'closureStatus', idFrom: 'variables.id' },
    { key: 'closurePreflight', idFrom: 'variables.id' },
    projectIdVar,
    projects,
    cards,
    { key: 'finalReport', idFrom: 'variables.id' },
  ],
  useCompleteClosure: [
    { key: 'closureStatus', idFrom: 'variables.id' },
    { key: 'closurePreflight', idFrom: 'variables.id' },
    projectIdVar,
    projects,
    cards,
    { key: 'finalReport', idFrom: 'variables.id' },
  ],

  useUpdateMe: [me, { key: 'onboardingStatus' }],
  useSignUp: [me, { key: 'onboardingStatus' }],
} as const satisfies Record<string, readonly InvalidationEntry[]>

export type MutationName = keyof typeof invalidationMap

export function invalidateFor(
  queryClient: QueryClient,
  mutationName: MutationName,
  ctx: InvalidationContext = {},
): void {
  const entries = invalidationMap[mutationName]
  for (const entry of entries) {
    const queryKey = toQueryKey(entry, ctx)
    if (queryKey) {
      void queryClient.invalidateQueries({ queryKey })
    }
  }
}
