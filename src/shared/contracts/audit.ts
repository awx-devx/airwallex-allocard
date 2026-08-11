import { defineContract } from '@/shared/contracts/types'
import { auditPageSchema, listAuditQuery } from '@/shared/schemas/auditQuery'

export const auditContracts = {
  list: defineContract({
    method: 'GET',
    path: '/api/audit',
    input: listAuditQuery,
    output: auditPageSchema,
  }),
  listForProject: defineContract({
    method: 'GET',
    path: '/api/projects/:id/audit',
    input: listAuditQuery,
    output: auditPageSchema,
  }),
} as const

export type AuditContracts = typeof auditContracts
