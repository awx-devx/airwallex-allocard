import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import { createRoleInput, roleSchema, updateRoleInput } from '@/shared/schemas/role'

export const roleContracts = {
  list: defineContract({
    method: 'GET',
    path: '/api/roles',
    input: z.void(),
    output: z.array(roleSchema),
  }),
  create: defineContract({
    method: 'POST',
    path: '/api/roles',
    input: createRoleInput,
    output: roleSchema,
  }),
  update: defineContract({
    method: 'PATCH',
    path: '/api/roles/:id',
    input: updateRoleInput,
    output: roleSchema,
  }),
  delete: defineContract({
    method: 'DELETE',
    path: '/api/roles/:id',
    input: z.void(),
    output: z.void(),
  }),
} as const

export type RoleContracts = typeof roleContracts
