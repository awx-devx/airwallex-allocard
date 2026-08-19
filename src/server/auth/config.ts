import type { NextAuthConfig } from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import Google from 'next-auth/providers/google'
import { z } from 'zod'
import { createMongooseAdapter } from '@/server/auth/adapter'
import { resolveOrgContextForUser } from '@/server/auth/session'
import { verifyPassword } from '@/server/auth/password'
import { connectDb } from '@/server/db/connect'
import type { ServerEnv } from '@/server/env'
import { loadServerEnv } from '@/server/env'
import { findUserCredentialsByEmail } from '@/server/repositories/users'

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
 * B1 caches org claims on the JWT and recomputes on org create / invite accept
 * (`update()`), not on every SessionProvider poll. A Mongo blip in jwt() becomes
 * JWTSessionError and the next mutation (e.g. create project) is 401.
 */
export function shouldRefreshOrgClaims(
  token: { onboarded?: boolean },
  trigger: string | undefined,
  hasUser: boolean,
): boolean {
  if (hasUser || trigger === 'update') return true
  return typeof token.onboarded !== 'boolean'
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
      async jwt({ token, user, trigger }) {
        const userId = user?.id ?? (typeof token.userId === 'string' ? token.userId : undefined)
        if (!userId) {
          return token
        }

        token.userId = userId
        if (!shouldRefreshOrgClaims(token, trigger, Boolean(user))) {
          return token
        }

        try {
          await connectDb()
          const ctx = await resolveOrgContextForUser(userId)
          token.orgId = ctx.orgId
          token.orgRole = ctx.orgRole
          token.onboarded = ctx.onboarded
        } catch {
          // Keep cached claims. Throwing here logs the user out (JWTSessionError).
        }
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
