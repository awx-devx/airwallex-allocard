import { z } from 'zod'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

/**
 * Export request body. Kind is path-implied (`/api/exports/{kind}`).
 * Contract output is `z.void()` — handlers stream `text/csv` via ReadableStream,
 * not a JSON body.
 */
export const exportInput = z.object({
  projectId: idSchema.optional(),
  from: isoDateSchema.optional(),
  to: isoDateSchema.optional(),
})
