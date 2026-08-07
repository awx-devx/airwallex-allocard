import { z } from 'zod'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

/** Public user — never includes `passwordHash`. */
export const userSchema = z.object({
  id: idSchema,
  email: z.email(),
  name: z.string().min(1).max(120),
  image: z.string().min(1).optional(),
  defaultOrgId: idSchema.optional(),
  createdAt: isoDateSchema,
})

export const signUpInput = z.object({
  email: z.email(),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(120),
})

export const updateMeInput = z
  .object({
    name: z.string().min(1).max(120).optional(),
    image: z.string().min(1).nullable().optional(),
    defaultOrgId: idSchema.nullable().optional(),
  })
  .refine(
    (value) =>
      value.name !== undefined || value.image !== undefined || value.defaultOrgId !== undefined,
    { message: 'At least one field is required' },
  )
