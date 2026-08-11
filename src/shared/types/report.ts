import { z } from 'zod'
import {
  finalReportSchema,
  organizationReportSchema,
  projectReportSchema,
} from '@/shared/schemas/report'

export type ProjectReport = z.infer<typeof projectReportSchema>
export type OrganizationReport = z.infer<typeof organizationReportSchema>
export type FinalReport = z.infer<typeof finalReportSchema>
