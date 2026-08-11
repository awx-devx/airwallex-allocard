import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
  finalReportSchema,
  organizationReportSchema,
  projectReportSchema,
} from '@/shared/schemas/report'

export const reportContracts = {
  project: defineContract({
    method: 'GET',
    path: '/api/reports/project/:id',
    input: z.void(),
    output: projectReportSchema,
  }),
  organization: defineContract({
    method: 'GET',
    path: '/api/reports/organization',
    input: z.void(),
    output: organizationReportSchema,
  }),
  final: defineContract({
    method: 'GET',
    path: '/api/projects/:id/report/final',
    input: z.void(),
    output: finalReportSchema,
  }),
} as const

export type ReportContracts = typeof reportContracts
