import { z } from 'zod'
import {
  membershipSchema,
  membershipWithOrgSchema,
  membershipWithUserSchema,
  updateMemberInput,
} from '@/shared/schemas/membership'

export type Membership = z.infer<typeof membershipSchema>
export type MembershipWithOrg = z.infer<typeof membershipWithOrgSchema>
export type MembershipWithUser = z.infer<typeof membershipWithUserSchema>
export type UpdateMemberInput = z.infer<typeof updateMemberInput>
