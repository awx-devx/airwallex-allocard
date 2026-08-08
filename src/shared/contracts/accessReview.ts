import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
  accessReviewSchema,
  listAccessReviewsQuery,
  resolveAccessReviewInput,
} from '@/shared/schemas/accessReview'

export const accessReviewContracts = {
  list: defineContract({
    method: 'GET',
    path: '/api/access-reviews',
    input: listAccessReviewsQuery,
    output: z.array(accessReviewSchema),
  }),
  resolve: defineContract({
    method: 'POST',
    path: '/api/access-reviews/:id/resolve',
    input: resolveAccessReviewInput,
    output: accessReviewSchema,
  }),
} as const

export type AccessReviewContracts = typeof accessReviewContracts
