import { z } from 'zod'
import {
  accessReviewSchema,
  listAccessReviewsQuery,
  resolveAccessReviewInput,
} from '@/shared/schemas/accessReview'

export type AccessReview = z.infer<typeof accessReviewSchema>
export type ResolveAccessReviewInput = z.infer<typeof resolveAccessReviewInput>
export type ListAccessReviewsQuery = z.infer<typeof listAccessReviewsQuery>
