import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
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

export const purchaseRequestContracts = {
  policyPreview: defineContract({
    method: 'POST',
    path: '/api/policy/preview',
    input: policyPreviewInput,
    output: policyDecisionSchema,
  }),
  list: defineContract({
    method: 'GET',
    path: '/api/projects/:id/requests',
    input: listPurchaseRequestsQuery,
    output: purchaseRequestListSchema,
  }),
  create: defineContract({
    method: 'POST',
    path: '/api/projects/:id/requests',
    input: createPurchaseRequestInput,
    output: purchaseRequestSchema,
  }),
  get: defineContract({
    method: 'GET',
    path: '/api/requests/:id',
    input: z.void(),
    output: purchaseRequestSchema,
  }),
  update: defineContract({
    method: 'PATCH',
    path: '/api/requests/:id',
    input: updatePurchaseRequestInput,
    output: purchaseRequestSchema,
  }),
  submit: defineContract({
    method: 'POST',
    path: '/api/requests/:id/submit',
    input: z.void(),
    output: purchaseRequestSchema,
  }),
  cancel: defineContract({
    method: 'POST',
    path: '/api/requests/:id/cancel',
    input: z.void(),
    output: purchaseRequestSchema,
  }),
  decide: defineContract({
    method: 'POST',
    path: '/api/requests/:id/decide',
    input: decidePurchaseRequestInput,
    output: purchaseRequestSchema,
  }),
  listApprovals: defineContract({
    method: 'GET',
    path: '/api/approvals',
    input: listApprovalsQuery,
    output: purchaseRequestListSchema,
  }),
  approvalsCount: defineContract({
    method: 'GET',
    path: '/api/approvals/count',
    input: z.void(),
    output: approvalsCountSchema,
  }),
} as const

export type PurchaseRequestContracts = typeof purchaseRequestContracts
