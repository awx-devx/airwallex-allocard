import { authContracts } from '@/shared/contracts/auth'
import { ok } from '@/server/http/respond'
import type { AuthSession } from '@/server/http/types'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { getMe, updateMe } from '@/server/services/auth/me'

export const GET = withAuth(async (session, req) => ok(await getMe(session.userId, req)), {
  requireOnboarded: false,
})

export const PATCH = withAuth(
  withValidation(authContracts.updateMe.input, async (session: AuthSession, input, req) =>
    ok(await updateMe(session, input, req)),
  ),
  { requireOnboarded: false },
)
