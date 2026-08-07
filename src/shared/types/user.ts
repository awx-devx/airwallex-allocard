import { z } from 'zod'
import { userSchema, userSummarySchema, signUpInput, updateMeInput } from '@/shared/schemas/user'

export type User = z.infer<typeof userSchema>
export type UserSummary = z.infer<typeof userSummarySchema>
export type SignUpInput = z.infer<typeof signUpInput>
export type UpdateMeInput = z.infer<typeof updateMeInput>
