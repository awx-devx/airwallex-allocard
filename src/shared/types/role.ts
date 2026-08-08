import { z } from 'zod'
import {
  createRoleInput,
  roleSchema,
  roleSummarySchema,
  updateRoleInput,
} from '@/shared/schemas/role'

export type Role = z.infer<typeof roleSchema>
export type RoleSummary = z.infer<typeof roleSummarySchema>
export type CreateRoleInput = z.infer<typeof createRoleInput>
export type UpdateRoleInput = z.infer<typeof updateRoleInput>
