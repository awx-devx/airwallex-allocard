import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { z } from 'zod'
import { createMongooseAdapter } from '@/server/auth/adapter'
import { verifyPassword } from '@/server/auth/password'
import { connectDb } from '@/server/db/connect'
import type { ServerEnv } from '@/server/env'
import { loadServerEnv } from '@/server/env'
import {
  findMembershipInOrg,
  hasActiveMembership,
  listMembershipsForUser,
} from '@/server/repositories/memberships'
import { findUserById, findUserCredentialsByEmail } from '@/server/repositories/users'
import { MembershipStatus } from '@/shared/enums/membershipStatus'
import type { OrgRole } from '@/shared/enums/orgRole'

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export type AuthEnv = Pick<
  ServerEnv,
  'AUTH_SECRET' | 'AUTH_URL' | 'AUTH_GOOGLE_ID' | 'AUTH_GOOGLE_SECRET'
>

/** Credentials `authorize` — exported for tests. */
export async function authorizeCredentials(
  credentials: Partial<Record<'email' | 'password', unknown>> | undefined,
): Promise<{ id: string; email: string; name: string; image: string | null } | null> {
  const parsed = credentialsSchema.safeParse(credentials)
  if (!parsed.success) {
    return null
  }

  await connectDb()
  const user = await findUserCredentialsByEmail(parsed.data.email)
  if (!user?.passwordHash) {
    return null
  }

  const valid = await verifyPassword(user.passwordHash, parsed.data.password)
  if (!valid) {
    return null
  }

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image ?? null,
  }
}

/**
 * Resolve org context cached on the JWT.
 * Full request-level resolution (explicit orgId header) is B1.4.
 */
export async function resolveTokenOrgContext(userId: string): Promise<{
  orgId: string | null
  orgRole: OrgRole | null
  onboarded: boolean
}> {
  const onboarded = await hasActiveMembership(userId)
  if (!onboarded) {
    return { orgId: null, orgRole: null, onboarded: false }
  }

  const user = await findUserById(userId)
  if (user?.defaultOrgId) {
    const membership = await findMembershipInOrg(user.defaultOrgId, userId)
    if (membership && membership.status === MembershipStatus.ACTIVE) {
      return {
        orgId: membership.orgId,
        orgRole: membership.orgRole,
        onboarded: true,
      }
    }
  }

  const memberships = (await listMembershipsForUser(userId)).filter(
    (m) => m.status === MembershipStatus.ACTIVE,
  )
  if (memberships.length === 1) {
    const sole = memberships[0]!
    return { orgId: sole.orgId, orgRole: sole.orgRole, onboarded: true }
  }

  // Multiple memberships and no usable default — leave org unset until B1.4 / client picks.
  return { orgId: null, orgRole: null, onboarded: true }
}

export function createAuthConfig(env: AuthEnv = loadServerEnv()): NextAuthConfig {
  const providers: NextAuthConfig['providers'] = [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        return authorizeCredentials(
          credentials as Partial<Record<'email' | 'password', unknown>> | undefined,
        )
      },
    }),
  ]

  if (env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET) {
    providers.push(
      Google({
        clientId: env.AUTH_GOOGLE_ID,
        clientSecret: env.AUTH_GOOGLE_SECRET,
        allowDangerousEmailAccountLinking: true,
      }),
    )
  }

  return {
    secret: env.AUTH_SECRET,
    trustHost: true,
    adapter: createMongooseAdapter(),
    session: { strategy: 'jwt' },
    providers,
    callbacks: {
      async jwt({ token, user }) {
        const userId = user?.id ?? (typeof token.userId === 'string' ? token.userId : undefined)
        if (!userId) {
          return token
        }

        await connectDb()
        token.userId = userId
        const ctx = await resolveTokenOrgContext(userId)
        token.orgId = ctx.orgId
        token.orgRole = ctx.orgRole
        token.onboarded = ctx.onboarded
        return token
      },
      async session({ session, token }) {
        session.userId = typeof token.userId === 'string' ? token.userId : ''
        session.orgId = typeof token.orgId === 'string' ? token.orgId : null
        session.orgRole =
          token.orgRole === 'OWNER' || token.orgRole === 'ADMIN' || token.orgRole === 'MEMBER'
            ? token.orgRole
            : null
        session.onboarded = Boolean(token.onboarded)
        if (session.user) {
          session.user.id = session.userId
        }
        return session
      },
    },
  }
}

/** True when Google OAuth is configured (UI can show the button). */
export function isGoogleAuthEnabled(env: AuthEnv = loadServerEnv()): boolean {
  return Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET)
}
