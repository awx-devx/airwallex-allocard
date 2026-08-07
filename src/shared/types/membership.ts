import { z } from 'zod'
import { membershipSchema, updateMemberInput } from '@/shared/schemas/membership'

export type Membership = z.infer<typeof membershipSchema>
export type UpdateMemberInput = z.infer<typeof updateMemberInput>
