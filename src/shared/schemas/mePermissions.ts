import { z } from 'zod'
import { accessScopeSchema } from '@/shared/schemas/accessScope'
import { idSchema } from '@/shared/schemas/base'
import { permissionSchema } from '@/shared/schemas/role'

/**
 * Effective permissions per project for the authenticated caller.
 * Consumed by the client `can()` helper — UX only, never a control.
 */
export const meProjectPermissionsSchema = z.object({
  projectId: idSchema,
  permissions: z.array(permissionSchema),
  scope: accessScopeSchema,
})

export const mePermissionsSchema = z.object({
  projects: z.array(meProjectPermissionsSchema),
})
