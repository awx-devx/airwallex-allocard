import { z } from 'zod'
import { ApprovalDecision } from '@/shared/enums/approvalDecision'
import { PolicyOutcome } from '@/shared/enums/policyOutcome'
import { PurchaseRequestStatus } from '@/shared/enums/purchaseRequestStatus'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

/**
 * Policy check result. `NOT_PERMITTED` must name the failing check in `reasons`.
 * `requiredApprovals` is 0 when no approval is needed or not permitted.
 */
export const policyDecisionSchema = z
  .object({
    outcome: z.enum(PolicyOutcome),
    reasons: z.array(z.string().min(1)),
    requiredApprovals: z.number().int().nonnegative(),
  })
  .superRefine((value, ctx) => {
    if (value.outcome === PolicyOutcome.NOT_PERMITTED && value.reasons.length < 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'reasons must have at least one entry when outcome is NOT_PERMITTED',
        path: ['reasons'],
      })
    }
  })

export const approvalEntrySchema = z.object({
  approverId: idSchema,
  decision: z.enum(ApprovalDecision),
  reason: z.string().min(1).max(2000).nullable(),
  at: isoDateSchema,
})

/**
 * Purchase request. Amounts are integer minor units.
 * `policyDecision` is null until submit (or preview-only responses).
 */
export const purchaseRequestSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  projectId: idSchema,
  requestedBy: idSchema,
  /** Integer minor units. */
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  categoryId: idSchema.nullable(),
  vendor: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  justification: z.string().min(1).max(2000),
  policyDecision: policyDecisionSchema.nullable(),
  status: z.enum(PurchaseRequestStatus),
  cardId: idSchema.nullable(),
  approvals: z.array(approvalEntrySchema),
  escalatedAt: isoDateSchema.nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

export const policyPreviewInput = z.object({
  projectId: idSchema,
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  categoryId: idSchema.optional(),
})

/** Create always yields DRAFT; submit runs policy (locked B7.0). */
export const createPurchaseRequestInput = z.object({
  amount: z.number().int().nonnegative(),
  currency: z.string().length(3),
  vendor: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  justification: z.string().min(1).max(2000),
  categoryId: idSchema.nullable().optional(),
})

export const updatePurchaseRequestInput = z
  .object({
    amount: z.number().int().nonnegative().optional(),
    currency: z.string().length(3).optional(),
    vendor: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(2000).optional(),
    justification: z.string().min(1).max(2000).optional(),
    categoryId: idSchema.nullable().optional(),
  })
  .refine(
    (value) =>
      value.amount !== undefined ||
      value.currency !== undefined ||
      value.vendor !== undefined ||
      value.description !== undefined ||
      value.justification !== undefined ||
      value.categoryId !== undefined,
    { message: 'At least one field is required' },
  )

/** Reason required on REJECT. */
export const decidePurchaseRequestInput = z
  .object({
    decision: z.enum(ApprovalDecision),
    reason: z.string().min(1).max(2000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === ApprovalDecision.REJECT && value.reason === undefined) {
      ctx.addIssue({
        code: 'custom',
        message: 'reason is required when decision is REJECT',
        path: ['reason'],
      })
    }
  })

export const listPurchaseRequestsQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
})

export const purchaseRequestListSchema = z.object({
  items: z.array(purchaseRequestSchema),
  page: z.number().int().min(1),
  pageSize: z.number().int().min(1),
  total: z.number().int().min(0),
})

/** Approver queue — same pagination envelope as project request lists. */
export const listApprovalsQuery = listPurchaseRequestsQuery

export const approvalsCountSchema = z.object({
  count: z.number().int().nonnegative(),
})
