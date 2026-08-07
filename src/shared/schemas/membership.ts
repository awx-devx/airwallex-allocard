import { z } from 'zod'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

export const membershipSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  userId: idSchema,
  orgRole: z.enum(OrgRole),
  status: z.enum(MembershipStatus),
  joinedAt: isoDateSchema,
})

export const updateMemberInput = z
  .object({
    orgRole: z.enum(OrgRole).optional(),
    status: z.enum(MembershipStatus).optional(),
  })
  .refine((value) => value.orgRole !== undefined || value.status !== undefined, {
    message: 'At least one field is required',
  })
