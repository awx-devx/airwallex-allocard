import { ok } from '@/server/http/respond'
import type { AuthSession } from '@/server/http/types'
import { withAuth } from '@/server/http/withAuth'
import { getOnboardingStatus } from '@/server/services/auth/onboardingStatus'

/** Onboarding fork — authenticated, not org-scoped. */
export const GET = withAuth(
  async (session: AuthSession) => ok(await getOnboardingStatus(session)),
  { requireOnboarded: false },
)
