import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withPublic } from '@/server/http/withPublic'
import { previewInvite } from '@/server/services/invites/preview'

function requireToken(req: Request): string {
  const { token } = getRouteParams(req)
  if (!token) {
    throw AppError.notFound()
  }
  return token
}

/** Public invite preview — no session. */
export const GET = withRouteParams(
  withPublic(async (req) => ok(await previewInvite(requireToken(req)))),
)
