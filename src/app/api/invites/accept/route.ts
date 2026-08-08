import { inviteContracts } from '@/shared/contracts/invite'
import type { AuthSession } from '@/server/http/types'
import { created } from '@/server/http/respond'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { acceptInvite } from '@/server/services/invites/accept'

/** Accept invite — authenticated, not org-scoped (onboarding path). */
export const POST = withAuth(
  withValidation(inviteContracts.accept.input, async (session: AuthSession, input) =>
    created(await acceptInvite(session, input.token)),
  ),
  { requireOnboarded: false },
)
