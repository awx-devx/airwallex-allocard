import { z } from 'zod'
import {
  inviteSchema,
  invitePreviewSchema,
  createInviteInput,
  createInviteOutput,
  acceptInviteInput,
} from '@/shared/schemas/invite'

export type Invite = z.infer<typeof inviteSchema>
export type InvitePreview = z.infer<typeof invitePreviewSchema>
export type CreateInviteInput = z.infer<typeof createInviteInput>
export type CreateInviteOutput = z.infer<typeof createInviteOutput>
export type AcceptInviteInput = z.infer<typeof acceptInviteInput>
