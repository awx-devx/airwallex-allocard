/**
 * Hook conventions (F1):
 * 1. Queries/mutations go through useCall() / call + qk.* — never hand-written URLs.
 * 2. On mutation settle, call invalidateFor(queryClient, 'useX', { variables, data }).
 * 3. Response/input types are only z.infer / contract outputs — no hand-written DTOs.
 * 4. Optimistic updates only for freeze/unfreeze and receipt attach/delete.
 * 5. Per-hook overrides below; global defaults live in createAppQueryClient.
 */

export const cardLimitsQueryOptions = {
  staleTime: 15_000,
} as const

export const approvalCountQueryOptions = {
  staleTime: 30_000,
  refetchInterval: 30_000,
} as const

export const ruleRunsInFlightQueryOptions = {
  staleTime: 10_000,
  refetchInterval: 10_000,
} as const

export const attributeValuesQueryOptions = {
  staleTime: 5_000,
} as const
