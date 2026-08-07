import { z } from 'zod'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'
import { organizationSummarySchema } from '@/shared/schemas/organization'
import { userSummarySchema } from '@/shared/schemas/user'

export const membershipSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  userId: idSchema,
  orgRole: z.enum(OrgRole),
  status: z.enum(MembershipStatus),
  joinedAt: isoDateSchema,
})

/** Membership with populated org summary — used by `GET /api/me`. */
export const membershipWithOrgSchema = membershipSchema.extend({
  org: organizationSummarySchema,
})

/** Membership with populated user summary — used by org members list. */
export const membershipWithUserSchema = membershipSchema.extend({
  user: userSummarySchema,
})

export const updateMemberInput = z
  .object({
    orgRole: z.enum(OrgRole).optional(),
    status: z.enum(MembershipStatus).optional(),
  })
  .refine((value) => value.orgRole !== undefined || value.status !== undefined, {
    message: 'At least one field is required',
  })
