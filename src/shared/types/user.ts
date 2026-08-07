import { z } from 'zod'
import { userSchema, signUpInput, updateMeInput } from '@/shared/schemas/user'

export type User = z.infer<typeof userSchema>
export type SignUpInput = z.infer<typeof signUpInput>
export type UpdateMeInput = z.infer<typeof updateMeInput>
