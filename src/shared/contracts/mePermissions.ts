import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import { mePermissionsSchema } from '@/shared/schemas/mePermissions'

/**
 * Caller effective permissions per project — feeds client `can()`.
 * Authenticated + onboarded; no permission string required.
 */
export const mePermissionsContracts = {
  get: defineContract({
    method: 'GET',
    path: '/api/me/permissions',
    input: z.void(),
    output: mePermissionsSchema,
  }),
} as const

export type MePermissionsContracts = typeof mePermissionsContracts
