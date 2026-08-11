import { describe, expect, it, vi } from 'vitest'
import { invalidateFor, invalidationMap, type MutationName } from '@/client/hooks/invalidationMap'
import { qk } from '@/client/queryKeys'
import { createAppQueryClient } from '@/client/providers/queryClient'

/** Every mutation hook name that later F1 tasks must register. */
const EXPECTED_MUTATIONS: MutationName[] = [
  'useCreateProject',
  'useUpdateProject',
  'useTransitionProject',
  'useCreateWorkstream',
  'useUpdateWorkstream',
  'useDeleteWorkstream',
  'useChangeProjectOwner',
  'useCreateOrganization',
  'useUpdateOrganization',
  'useUpdateOrgMember',
  'useRemoveOrgMember',
  'useCreateInvite',
  'useRevokeInvite',
  'useAcceptInvite',
  'useAddMember',
  'useUpdateMember',
  'useRemoveMember',
  'useCreateRole',
  'useUpdateRole',
  'useDeleteRole',
  'useResolveAccessReview',
  'usePreviewMember',
  'useSetBudget',
  'useCreateBudgetCategory',
  'useUpdateBudgetCategory',
  'useDeleteBudgetCategory',
  'useCreateBudgetEntry',
  'useCreateChangeRequest',
  'useDecideChangeRequest',
  'useValidateFormula',
  'useCreateCard',
  'useUpdateCard',
  'useFreezeCard',
  'useUnfreezeCard',
  'useCloseCard',
  'useReconcileCard',
  'useCreateCardholder',
  'usePanToken',
  'useCreateRule',
  'useUpdateRule',
  'useDeleteRule',
  'useEnableRule',
  'useValidateRule',
  'useSimulateRules',
  'useSimulatePurchase',
  'useSetAttributeValue',
  'useCreateAttribute',
  'useUpdateAttribute',
  'useCreateRequest',
  'useUpdateRequest',
  'useSubmitRequest',
  'useCancelRequest',
  'useDecideRequest',
  'usePutApprovalRules',
  'usePolicyPreview',
  'useUploadReceipt',
  'useDeleteReceipt',
  'useSyncTransactionsAdmin',
  'useStartClosure',
  'useCompleteClosure',
  'useUpdateMe',
  'useSignUp',
]

describe('invalidationMap', () => {
  it('covers every expected mutation name', () => {
    const keys = Object.keys(invalidationMap).sort()
    expect(keys).toEqual([...EXPECTED_MUTATIONS].sort())
  })

  it('ephemeral mutations invalidate nothing', () => {
    expect(invalidationMap.useSimulateRules).toEqual([])
    expect(invalidationMap.useValidateRule).toEqual([])
    expect(invalidationMap.useValidateFormula).toEqual([])
    expect(invalidationMap.usePreviewMember).toEqual([])
    expect(invalidationMap.usePolicyPreview).toEqual([])
    expect(invalidationMap.usePanToken).toEqual([])
  })

  it('invalidateFor resolves idFrom variables and data', () => {
    const client = createAppQueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')

    invalidateFor(client, 'useDecideChangeRequest', {
      data: { projectId: 'p1' },
    })

    const keys = spy.mock.calls.map((c) => c[0]?.queryKey)
    expect(keys).toContainEqual(qk.budget('p1'))
    expect(keys).toContainEqual(qk.budgetEntries('p1'))
    expect(keys).toContainEqual(qk.budgetChangeRequests('p1'))
    expect(keys).toContainEqual(qk.cards())
  })

  it('invalidateFor skips entries when id is missing', () => {
    const client = createAppQueryClient()
    const spy = vi.spyOn(client, 'invalidateQueries')
    invalidateFor(client, 'useUpdateProject', { variables: {} })
    // projects() has no id — still fires; project(id) skipped
    expect(spy).toHaveBeenCalledWith({ queryKey: qk.projects() })
    expect(
      spy.mock.calls.some(
        (c) => c[0]?.queryKey?.[0] === 'projects' && c[0]?.queryKey?.[1] === 'p1',
      ),
    ).toBe(false)
  })
})
