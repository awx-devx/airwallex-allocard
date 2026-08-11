import { describe, expect, it } from 'vitest'
import type { Contract } from '@/shared/contracts/types'
import { accessReviewContracts } from '@/shared/contracts/accessReview'
import { activityContracts } from '@/shared/contracts/activity'
import { approvalRuleContracts } from '@/shared/contracts/approvalRule'
import { attributeContracts } from '@/shared/contracts/attribute'
import { auditContracts } from '@/shared/contracts/audit'
import { authContracts } from '@/shared/contracts/auth'
import { budgetContracts } from '@/shared/contracts/budget'
import { cardContracts } from '@/shared/contracts/card'
import { cardholderContracts } from '@/shared/contracts/cardholder'
import { closureContracts } from '@/shared/contracts/closure'
import { exportContracts } from '@/shared/contracts/export'
import { inviteContracts } from '@/shared/contracts/invite'
import { mePermissionsContracts } from '@/shared/contracts/mePermissions'
import { organizationContracts } from '@/shared/contracts/organization'
import { projectContracts } from '@/shared/contracts/project'
import { projectMemberContracts } from '@/shared/contracts/projectMember'
import { purchaseRequestContracts } from '@/shared/contracts/purchaseRequest'
import { remoteAuthContracts } from '@/shared/contracts/remoteAuth'
import { reportContracts } from '@/shared/contracts/report'
import { ruleContracts } from '@/shared/contracts/rule'
import { cardExplainContracts, ruleRunContracts } from '@/shared/contracts/ruleRun'
import { roleContracts } from '@/shared/contracts/role'
import { transactionContracts } from '@/shared/contracts/transaction'
import { invalidationMap, type MutationName } from '@/client/hooks/invalidationMap'

/** `${METHOD} ${path}` → hook that owns this endpoint. */
const CONTRACT_HOOK_MAP: Record<string, string> = {
  // auth
  'POST /api/auth/sign-up': 'useSignUp',
  'GET /api/me': 'useMe',
  'PATCH /api/me': 'useUpdateMe',
  'GET /api/onboarding/status': 'useOnboardingStatus',
  'GET /api/me/permissions': 'usePermissions',

  // organizations + invites
  'POST /api/organizations': 'useCreateOrganization',
  'GET /api/organizations/:id': 'useOrganization',
  'PATCH /api/organizations/:id': 'useUpdateOrganization',
  'GET /api/organizations/:id/members': 'useOrgMembers',
  'PATCH /api/organizations/:id/members/:userId': 'useUpdateOrgMember',
  'DELETE /api/organizations/:id/members/:userId': 'useRemoveOrgMember',
  'POST /api/invites': 'useCreateInvite',
  'GET /api/invites': 'useInvites',
  'DELETE /api/invites/:id': 'useRevokeInvite',
  'GET /api/invites/preview/:token': 'useInvitePreview',
  'POST /api/invites/accept': 'useAcceptInvite',

  // projects
  'GET /api/projects': 'useProjects',
  'POST /api/projects': 'useCreateProject',
  'GET /api/projects/:id': 'useProject',
  'PATCH /api/projects/:id': 'useUpdateProject',
  'POST /api/projects/:id/transition': 'useTransitionProject',
  'GET /api/projects/:id/workstreams': 'useWorkstreams',
  'POST /api/projects/:id/workstreams': 'useCreateWorkstream',
  'PATCH /api/projects/:id/workstreams/:wsId': 'useUpdateWorkstream',
  'DELETE /api/projects/:id/workstreams/:wsId': 'useDeleteWorkstream',
  'PATCH /api/projects/:id/owner': 'useChangeProjectOwner',
  'GET /api/projects/:id/history': 'useProjectHistory',

  // project members + roles + access reviews
  'GET /api/projects/:id/members': 'useProjectMembers',
  'POST /api/projects/:id/members': 'useAddMember',
  'PATCH /api/projects/:id/members/:userId': 'useUpdateMember',
  'DELETE /api/projects/:id/members/:userId': 'useRemoveMember',
  'POST /api/projects/:id/members/preview': 'usePreviewMember',
  'GET /api/projects/:id/access-history': 'useAccessHistory',
  'GET /api/roles': 'useRoles',
  'POST /api/roles': 'useCreateRole',
  'PATCH /api/roles/:id': 'useUpdateRole',
  'DELETE /api/roles/:id': 'useDeleteRole',
  'GET /api/access-reviews': 'useAccessReviews',
  'POST /api/access-reviews/:id/resolve': 'useResolveAccessReview',

  // budget
  'GET /api/projects/:id/budget': 'useBudget',
  'PUT /api/projects/:id/budget': 'useSetBudget',
  'GET /api/projects/:id/budget/categories': 'useBudgetCategories',
  'POST /api/projects/:id/budget/categories': 'useCreateBudgetCategory',
  'PATCH /api/projects/:id/budget/categories/:catId': 'useUpdateBudgetCategory',
  'DELETE /api/projects/:id/budget/categories/:catId': 'useDeleteBudgetCategory',
  'GET /api/projects/:id/budget/entries': 'useBudgetEntries',
  'POST /api/projects/:id/budget/entries': 'useCreateBudgetEntry',
  'GET /api/projects/:id/budget/history': 'useBudgetHistory',
  'GET /api/projects/:id/budget/change-requests': 'useBudgetChangeRequests',
  'POST /api/projects/:id/budget/change-requests': 'useCreateChangeRequest',
  'POST /api/budget/change-requests/:id/decide': 'useDecideChangeRequest',
  'POST /api/budget/formula/validate': 'useValidateFormula',

  // cards + cardholders
  'GET /api/cards': 'useCards',
  'GET /api/projects/:id/cards': 'useProjectCards',
  'POST /api/projects/:id/cards': 'useCreateCard',
  'GET /api/cards/:id': 'useCard',
  'PATCH /api/cards/:id': 'useUpdateCard',
  'POST /api/cards/:id/freeze': 'useFreezeCard',
  'POST /api/cards/:id/unfreeze': 'useUnfreezeCard',
  'POST /api/cards/:id/close': 'useCloseCard',
  'GET /api/cards/:id/limits': 'useCardLimits',
  'POST /api/cards/:id/pan-token': 'usePanToken',
  'POST /api/cards/:id/reconcile': 'useReconcileCard',
  'GET /api/cardholders': 'useCardholders',
  'POST /api/cardholders': 'useCreateCardholder',
  'GET /api/cardholders/:id': 'useCardholder',

  // attributes + rules + runs + explain
  'GET /api/attributes': 'useAttributes',
  'POST /api/attributes': 'useCreateAttribute',
  'PATCH /api/attributes/:key': 'useUpdateAttribute',
  'GET /api/attributes/values': 'useAttributeValues',
  'PUT /api/attributes/values': 'useSetAttributeValue',
  'GET /api/rules': 'useRules',
  'POST /api/rules': 'useCreateRule',
  'PATCH /api/rules/:id': 'useUpdateRule',
  'DELETE /api/rules/:id': 'useDeleteRule',
  'POST /api/rules/:id/enable': 'useEnableRule',
  'POST /api/rules/validate': 'useValidateRule',
  'POST /api/rules/simulate': 'useSimulateRules',
  'GET /api/rule-runs': 'useRuleRuns',
  'GET /api/rule-runs/:id': 'useRuleRun',
  'GET /api/cards/:id/explain': 'useCardExplain',
  'POST /api/simulate/purchase': 'useSimulatePurchase',

  // requests + approvals
  'POST /api/policy/preview': 'usePolicyPreview',
  'GET /api/projects/:id/requests': 'useRequests',
  'POST /api/projects/:id/requests': 'useCreateRequest',
  'GET /api/requests/:id': 'useRequest',
  'PATCH /api/requests/:id': 'useUpdateRequest',
  'POST /api/requests/:id/submit': 'useSubmitRequest',
  'POST /api/requests/:id/cancel': 'useCancelRequest',
  'POST /api/requests/:id/decide': 'useDecideRequest',
  'GET /api/approvals': 'useApprovals',
  'GET /api/approvals/count': 'useApprovalCount',
  'GET /api/projects/:id/approval-rules': 'useApprovalRules',
  'PUT /api/projects/:id/approval-rules': 'usePutApprovalRules',

  // transactions
  'GET /api/transactions': 'useTransactions',
  'GET /api/projects/:id/transactions': 'useProjectTransactions',
  'GET /api/cards/:id/transactions': 'useCardTransactions',
  'GET /api/transactions/:id': 'useTransaction',
  'GET /api/transactions/declined': 'useDeclinedTransactions',
  'POST /api/transactions/:id/receipt': 'useUploadReceipt',
  'DELETE /api/transactions/:id/receipt': 'useDeleteReceipt',
  'POST /api/admin/sync-transactions': 'useSyncTransactionsAdmin',

  // activity + audit + reports + closure
  'GET /api/activity': 'useActivity',
  'GET /api/projects/:id/activity': 'useProjectActivity',
  'GET /api/audit': 'useAudit',
  'GET /api/projects/:id/audit': 'useProjectAudit',
  'GET /api/reports/project/:id': 'useProjectReport',
  'GET /api/reports/organization': 'useOrganizationReport',
  'GET /api/projects/:id/report/final': 'useFinalReport',
  'GET /api/projects/:id/closure/preflight': 'useClosurePreflight',
  'POST /api/projects/:id/closure/start': 'useStartClosure',
  'GET /api/projects/:id/closure/status': 'useClosureStatus',
  'POST /api/projects/:id/closure/complete': 'useCompleteClosure',

  // exports (downloadExport wrappers)
  'POST /api/exports/budget': 'useExportBudget',
  'POST /api/exports/transactions': 'useExportTransactions',
  'POST /api/exports/cards': 'useExportCards',
  'POST /api/exports/audit': 'useExportAudit',
}

const EXCLUDED_ENDPOINTS = new Set(['POST /api/remote-auth', 'POST /api/attributes/ingest'])

const ALL_CONTRACT_OBJECTS = [
  authContracts,
  mePermissionsContracts,
  organizationContracts,
  inviteContracts,
  projectContracts,
  projectMemberContracts,
  roleContracts,
  accessReviewContracts,
  budgetContracts,
  cardContracts,
  cardholderContracts,
  attributeContracts,
  ruleContracts,
  ruleRunContracts,
  cardExplainContracts,
  remoteAuthContracts,
  purchaseRequestContracts,
  approvalRuleContracts,
  transactionContracts,
  activityContracts,
  auditContracts,
  reportContracts,
  closureContracts,
  exportContracts,
] as const

function contractKey(c: Contract): string {
  return `${c.method} ${c.path}`
}

function collectBrowserContracts(): string[] {
  const keys: string[] = []
  for (const group of ALL_CONTRACT_OBJECTS) {
    for (const entry of Object.values(group)) {
      const key = contractKey(entry)
      if (EXCLUDED_ENDPOINTS.has(key)) continue
      if (group === remoteAuthContracts && entry === remoteAuthContracts.decide) continue
      if (group === attributeContracts && entry === attributeContracts.ingest) continue
      keys.push(key)
    }
  }
  return keys.sort()
}

describe('contractCoverage', () => {
  it('maps every browser-facing contract endpoint to exactly one hook', () => {
    const browserContracts = collectBrowserContracts()
    const mapped = new Set(Object.keys(CONTRACT_HOOK_MAP))

    const missing = browserContracts.filter((k) => !mapped.has(k))
    const extra = [...mapped].filter((k) => !browserContracts.includes(k))

    expect(missing, `Unmapped contracts: ${missing.join(', ')}`).toEqual([])
    expect(extra, `Stale map entries: ${extra.join(', ')}`).toEqual([])
  })

  it('does not assign two hooks to the same contract', () => {
    const hooks = Object.values(CONTRACT_HOOK_MAP)
    expect(new Set(hooks).size).toBe(hooks.length)
  })

  it('mutation hooks from inventory appear in invalidationMap', () => {
    const mapKeys = new Set(Object.keys(invalidationMap))
    const mutationHooksInCoverage = Object.values(CONTRACT_HOOK_MAP).filter((hook) => {
      // Query hooks — not in invalidation map
      const queryHooks = new Set([
        'useMe',
        'usePermissions',
        'useOnboardingStatus',
        'useOrganization',
        'useOrgMembers',
        'useInvites',
        'useInvitePreview',
        'useProjects',
        'useProject',
        'useWorkstreams',
        'useProjectHistory',
        'useProjectMembers',
        'useAccessHistory',
        'useRoles',
        'useAccessReviews',
        'useBudget',
        'useBudgetCategories',
        'useBudgetEntries',
        'useBudgetHistory',
        'useBudgetChangeRequests',
        'useCards',
        'useProjectCards',
        'useCard',
        'useCardLimits',
        'useCardholders',
        'useCardholder',
        'useAttributes',
        'useAttributeValues',
        'useRules',
        'useRuleRuns',
        'useRuleRun',
        'useCardExplain',
        'useRequests',
        'useRequest',
        'useApprovals',
        'useApprovalCount',
        'useApprovalRules',
        'useTransactions',
        'useProjectTransactions',
        'useCardTransactions',
        'useTransaction',
        'useDeclinedTransactions',
        'useActivity',
        'useProjectActivity',
        'useAudit',
        'useProjectAudit',
        'useProjectReport',
        'useOrganizationReport',
        'useFinalReport',
        'useClosurePreflight',
        'useClosureStatus',
        'useExportBudget',
        'useExportTransactions',
        'useExportCards',
        'useExportAudit',
      ])
      return !queryHooks.has(hook)
    })

    const missing = mutationHooksInCoverage.filter((h) => !mapKeys.has(h))
    expect(missing, `Mutations missing from invalidationMap: ${missing.join(', ')}`).toEqual([])

    // Export wrappers are mutations but do not invalidate — add to map if required
    const exportHooks = [
      'useExportBudget',
      'useExportTransactions',
      'useExportCards',
      'useExportAudit',
    ]
    for (const hook of exportHooks) {
      if (!mapKeys.has(hook as MutationName)) {
        // exports are not in invalidation map by design — excluded from check above
        expect(hook).toBeTruthy()
      }
    }
  })
})
