import { organizationContracts } from '@/shared/contracts/organization'
import { created } from '@/server/http/respond'
import type { AuthSession } from '@/server/http/types'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { createOrganizationForUser } from '@/server/services/organizations/create'

/** Create org — authenticated, not org-scoped (onboarding path). */
export const POST = withAuth(
  withValidation(organizationContracts.create.input, async (session: AuthSession, input) =>
    created(await createOrganizationForUser(session.userId, input)),
  ),
  { requireOnboarded: false },
)
