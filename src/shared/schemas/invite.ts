import { z } from 'zod'
import { InviteStatus } from '@/shared/enums/inviteStatus'
import { OrgRole } from '@/shared/enums/orgRole'
import { idSchema, isoDateSchema } from '@/shared/schemas/base'

/** Public invite — never includes the raw token or `tokenHash`. */
export const inviteSchema = z.object({
  id: idSchema,
  orgId: idSchema,
  email: z.email(),
  orgRole: z.enum(OrgRole),
  expiresAt: isoDateSchema,
  status: z.enum(InviteStatus),
  invitedBy: idSchema,
})

/** Public preview for the accept screen — deliberately minimal. */
export const invitePreviewSchema = z.object({
  orgName: z.string().min(1),
  invitedByName: z.string().min(1),
  orgRole: z.enum(OrgRole),
  expiresAt: isoDateSchema,
})

export const createInviteInput = z.object({
  email: z.email(),
  orgRole: z.enum(OrgRole),
})

/** Create response only — raw token appears nowhere else. */
export const createInviteOutput = inviteSchema.extend({
  token: z.string().min(1),
})

export const acceptInviteInput = z.object({
  token: z.string().min(1),
})
