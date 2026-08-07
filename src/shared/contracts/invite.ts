import { z } from 'zod'
import { defineContract } from '@/shared/contracts/types'
import {
  acceptInviteInput,
  createInviteInput,
  createInviteOutput,
  invitePreviewSchema,
  inviteSchema,
} from '@/shared/schemas/invite'
import { membershipSchema } from '@/shared/schemas/membership'

export const inviteContracts = {
  create: defineContract({
    method: 'POST',
    path: '/api/invites',
    input: createInviteInput,
    output: createInviteOutput,
  }),
  list: defineContract({
    method: 'GET',
    path: '/api/invites',
    input: z.void(),
    output: z.array(inviteSchema),
  }),
  revoke: defineContract({
    method: 'DELETE',
    path: '/api/invites/:id',
    input: z.void(),
    output: z.void(),
  }),
  preview: defineContract({
    method: 'GET',
    path: '/api/invites/preview/:token',
    input: z.void(),
    output: invitePreviewSchema,
  }),
  accept: defineContract({
    method: 'POST',
    path: '/api/invites/accept',
    input: acceptInviteInput,
    output: membershipSchema,
  }),
} as const

export type InviteContracts = typeof inviteContracts
