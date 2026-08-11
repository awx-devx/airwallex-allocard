import { z } from 'zod'
import {
  activityItemSchema,
  activityPageSchema,
  listActivityQuery,
} from '@/shared/schemas/activity'

export type ActivityItem = z.infer<typeof activityItemSchema>
export type ListActivityQuery = z.infer<typeof listActivityQuery>
export type ActivityPage = z.infer<typeof activityPageSchema>
