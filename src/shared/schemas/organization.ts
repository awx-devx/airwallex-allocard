import { z } from 'zod'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

/** Org settings — `defaultApprovalPolicy` stays null until B7 defines policies. */
export const organizationSettingsSchema = z.object({
  defaultApprovalPolicy: z.string().nullable(),
  notifications: z.record(z.string(), z.boolean()),
})

/**
 * Public organisation.
 * `airwallexAccountId` is the connected-account seam (null under D1); kept on the
 * wire so a later migration never has to add the field.
 */
export const organizationSchema = z.object({
  id: idSchema,
  name: z.string().min(1).max(120),
  slug: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug must be lowercase alphanumeric with hyphens'),
  country: z.string().length(2),
  baseCurrency: z.string().length(3),
  costCentres: z.array(z.string().min(1)),
  settings: organizationSettingsSchema,
  airwallexAccountId: z.string().nullable(),
  createdAt: isoDateSchema,
})

export const createOrganizationInput = z.object({
  name: z.string().min(1).max(120),
  /** Optional — server derives from name when omitted. */
  slug: organizationSchema.shape.slug.optional(),
  country: z.string().length(2),
  baseCurrency: z.string().length(3),
  costCentres: z.array(z.string().min(1)).default([]),
})

export const updateOrganizationInput = organizationSchema
  .pick({
    name: true,
    country: true,
    baseCurrency: true,
    costCentres: true,
    settings: true,
  })
  .partial()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.country !== undefined ||
      value.baseCurrency !== undefined ||
      value.costCentres !== undefined ||
      value.settings !== undefined,
    { message: 'At least one field is required' },
  )
