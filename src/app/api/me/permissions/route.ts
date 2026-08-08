import { ok } from '@/server/http/respond'
import { withAuth } from '@/server/http/withAuth'
import { getMePermissions } from '@/server/services/auth/mePermissions'

/** Effective permissions per project for the caller — authenticated + onboarded. */
export const GET = withAuth(async (ctx) => ok(await getMePermissions(ctx)))
