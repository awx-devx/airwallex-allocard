import { z } from 'zod'
import {
  organizationSchema,
  organizationSettingsSchema,
  createOrganizationInput,
  updateOrganizationInput,
} from '@/shared/schemas/organization'

export type Organization = z.infer<typeof organizationSchema>
export type OrganizationSettings = z.infer<typeof organizationSettingsSchema>
export type CreateOrganizationInput = z.infer<typeof createOrganizationInput>
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationInput>
