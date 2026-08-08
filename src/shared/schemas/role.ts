import { z } from 'zod'
import { Permission } from '@/shared/enums/permissions'
import { accessScopeSchema } from '@/shared/schemas/accessScope'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

export const permissionSchema = z.enum(Permission)

export const roleSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  key: z
    .string()
    .min(1)
    .max(64)
    .regex(
      /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/,
      'Key must be lowercase alphanumeric with hyphens or underscores',
    ),
  name: z.string().min(1).max(120),
  isTemplate: z.boolean(),
  permissions: z.array(permissionSchema),
  defaultScope: accessScopeSchema.optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
})

/** Compact role for populated member rows. */
export const roleSummarySchema = roleSchema.pick({
  id: true,
  key: true,
  name: true,
  isTemplate: true,
})

export const createRoleInput = z.object({
  name: z.string().min(1).max(120),
  key: roleSchema.shape.key.optional(),
  permissions: z.array(permissionSchema).min(1),
  defaultScope: accessScopeSchema.optional(),
})

export const updateRoleInput = z
  .object({
    name: z.string().min(1).max(120).optional(),
    key: roleSchema.shape.key.optional(),
    permissions: z.array(permissionSchema).min(1).optional(),
    defaultScope: accessScopeSchema.nullable().optional(),
    /** Required to edit a template that is currently assigned. */
    force: z.boolean().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined ||
      value.key !== undefined ||
      value.permissions !== undefined ||
      value.defaultScope !== undefined,
    { message: 'At least one field is required' },
  )
