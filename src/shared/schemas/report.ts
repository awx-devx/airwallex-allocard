import { z } from 'zod'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

/**
 * Project budget-vs-actual report. Amounts are integer minor units.
 * `utilisationPct` mirrors budgetProjection (may exceed 100).
 */
export const projectReportSchema = z.object({
  projectId: idSchema,
  currency: z.string().length(3),
  approved: z.number().int(),
  committed: z.number().int(),
  actual: z.number().int(),
  remaining: z.number().int(),
  utilisationPct: z.number().int().nonnegative(),
  byCategory: z.array(
    z.object({
      categoryId: idSchema,
      name: z.string().min(1),
      allocated: z.number().int(),
      actual: z.number().int(),
    }),
  ),
  byMember: z.array(
    z.object({
      userId: idSchema,
      actual: z.number().int(),
    }),
  ),
  generatedAt: isoDateSchema,
})

/**
 * Org rollup. `totals` are single-currency (primary `currency`); mixed-currency
 * projects appear in `projects` but are excluded from `totals`.
 */
export const organizationReportSchema = z.object({
  currency: z.string().length(3),
  projects: z.array(
    z.object({
      projectId: idSchema,
      name: z.string().min(1),
      approved: z.number().int(),
      committed: z.number().int(),
      actual: z.number().int(),
      remaining: z.number().int(),
      utilisationPct: z.number().int().nonnegative(),
    }),
  ),
  totals: z.object({
    approved: z.number().int(),
    committed: z.number().int(),
    actual: z.number().int(),
    remaining: z.number().int(),
  }),
  generatedAt: isoDateSchema,
})

/**
 * Post-closure final report = project report plus closure metadata.
 */
export const finalReportSchema = projectReportSchema.extend({
  closedAt: isoDateSchema,
  archivedAt: isoDateSchema.nullable(),
  transactionCount: z.number().int().nonnegative(),
  accessHistoryCount: z.number().int().nonnegative(),
})
