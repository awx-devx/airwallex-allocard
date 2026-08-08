import { z } from 'zod'
import { mePermissionsSchema, meProjectPermissionsSchema } from '@/shared/schemas/mePermissions'

export type MeProjectPermissions = z.infer<typeof meProjectPermissionsSchema>
export type MePermissions = z.infer<typeof mePermissionsSchema>
