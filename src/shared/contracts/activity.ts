import { defineContract } from '@/shared/contracts/types'
import { activityPageSchema, listActivityQuery } from '@/shared/schemas/activity'

export const activityContracts = {
  listForProject: defineContract({
    method: 'GET',
    path: '/api/projects/:id/activity',
    input: listActivityQuery,
    output: activityPageSchema,
  }),
  list: defineContract({
    method: 'GET',
    path: '/api/activity',
    input: listActivityQuery,
    output: activityPageSchema,
  }),
} as const

export type ActivityContracts = typeof activityContracts
