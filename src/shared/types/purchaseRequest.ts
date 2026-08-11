import { z } from 'zod'
import {
  approvalEntrySchema,
  approvalsCountSchema,
  createPurchaseRequestInput,
  decidePurchaseRequestInput,
  listApprovalsQuery,
  listPurchaseRequestsQuery,
  policyDecisionSchema,
  policyPreviewInput,
  purchaseRequestListSchema,
  purchaseRequestSchema,
  updatePurchaseRequestInput,
} from '@/shared/schemas/purchaseRequest'

export type PolicyDecision = z.infer<typeof policyDecisionSchema>
export type ApprovalEntry = z.infer<typeof approvalEntrySchema>
export type PurchaseRequest = z.infer<typeof purchaseRequestSchema>
export type PolicyPreviewInput = z.infer<typeof policyPreviewInput>
export type CreatePurchaseRequestInput = z.infer<typeof createPurchaseRequestInput>
export type UpdatePurchaseRequestInput = z.infer<typeof updatePurchaseRequestInput>
export type DecidePurchaseRequestInput = z.infer<typeof decidePurchaseRequestInput>
export type ListPurchaseRequestsQuery = z.infer<typeof listPurchaseRequestsQuery>
export type PurchaseRequestList = z.infer<typeof purchaseRequestListSchema>
export type ListApprovalsQuery = z.infer<typeof listApprovalsQuery>
export type ApprovalsCount = z.infer<typeof approvalsCountSchema>
