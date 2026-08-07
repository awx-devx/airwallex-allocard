import { z } from 'zod'
import { invitePreviewSchema } from '@/shared/schemas/invite'
import { membershipSchema } from '@/shared/schemas/membership'
import { organizationSchema } from '@/shared/schemas/organization'
import { userSchema } from '@/shared/schemas/user'

/**
 * `GET /api/me` — everything the app shell and route guards need.
 *
 * - `onboarded` is derived (has ≥1 ACTIVE membership), never stored.
 * - `activeOrg` is absent when the user is not onboarded.
 * - `memberships` are the raw membership records; org names for a switcher
 *   come from a follow-up or from enriching this shape (review open).
 */
export const meResponseSchema = z.object({
  user: userSchema,
  memberships: z.array(membershipSchema),
  activeOrg: organizationSchema.optional(),
  onboarded: z.boolean(),
})

/** Powers A1's onboarding fork screen. */
export const onboardingStatusSchema = z.object({
  onboarded: z.boolean(),
  pendingInvites: z.array(invitePreviewSchema),
})
