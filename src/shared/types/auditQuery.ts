import { z } from 'zod'
import { auditEntrySchema, auditPageSchema, listAuditQuery } from '@/shared/schemas/auditQuery'

export type AuditEntry = z.infer<typeof auditEntrySchema>
export type ListAuditQuery = z.infer<typeof listAuditQuery>
export type AuditPage = z.infer<typeof auditPageSchema>
