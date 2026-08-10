import { loadServerEnv, type ServerEnv } from '@/server/env'
import { AirwallexError } from '@/server/airwallex/errors'
import { loadFixture } from '@/server/airwallex/fixtures/load'
import { logAirwallexRequest } from '@/server/airwallex/logging'
import { getRedis, redisKeys, type RedisClient } from '@/server/redis'

export type LoginResult = {
  token: string
  expires_at: string
}

export type AuthDeps = {
  env?: ServerEnv
  redis?: RedisClient
  useFixtures?: boolean
  /** Injected for tests — real login uses fetch. */
  loginFetch?: typeof fetch
}

const refreshLocks = new Map<string, Promise<string>>()

function resolveEnv(env?: ServerEnv): ServerEnv {
  return env ?? loadServerEnv()
}

async function loginWithNetwork(
  env: ServerEnv,
  accountId: string | null,
  loginFetch: typeof fetch,
): Promise<LoginResult> {
  const started = Date.now()
  const url = `${env.AIRWALLEX_BASE_URL}/api/v1/authentication/login`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-client-id': env.AIRWALLEX_CLIENT_ID,
    'x-api-key': env.AIRWALLEX_API_KEY,
    'x-api-version': env.AIRWALLEX_API_VERSION,
  }
  if (accountId) {
    headers['x-on-behalf-of'] = accountId
  }

  const res = await loginFetch(url, { method: 'POST', headers })
  logAirwallexRequest({
    method: 'POST',
    endpoint: '/api/v1/authentication/login',
    status: res.status,
    durationMs: Date.now() - started,
    accountId,
  })

  if (!res.ok) {
    throw new AirwallexError({
      status: res.status,
      code: 'login_failed',
      message: `Airwallex login failed with status ${res.status}`,
      retryable: res.status === 429 || res.status >= 500,
    })
  }

  return (await res.json()) as LoginResult
}

function loginFromFixture(): LoginResult {
  return loadFixture<LoginResult>({
    method: 'POST',
    path: '/api/v1/authentication/login',
  })
}

/**
 * Return a cached bearer token, refreshing behind an in-process mutex so a
 * burst of requests triggers one login.
 */
export async function getAccessToken(
  accountId: string | null,
  deps: AuthDeps = {},
): Promise<string> {
  const env = resolveEnv(deps.env)
  const redis = deps.redis ?? getRedis()
  const useFixtures = deps.useFixtures ?? env.AIRWALLEX_USE_FIXTURES
  const key = redisKeys.awToken(accountId)

  const cached = await redis.get(key)
  if (cached) {
    return cached
  }

  const lockKey = accountId ?? '__default__'
  let pending = refreshLocks.get(lockKey)
  if (!pending) {
    pending = (async () => {
      try {
        const again = await redis.get(key)
        if (again) {
          return again
        }

        const result = useFixtures
          ? loginFromFixture()
          : await loginWithNetwork(env, accountId, deps.loginFetch ?? fetch)

        const expiresAtMs = Date.parse(result.expires_at)
        const ttlMs = Number.isFinite(expiresAtMs)
          ? Math.max(1_000, expiresAtMs - Date.now() - 60_000)
          : 50 * 60_000
        await redis.set(key, result.token, { px: ttlMs })
        return result.token
      } finally {
        refreshLocks.delete(lockKey)
      }
    })()
    refreshLocks.set(lockKey, pending)
  }

  return pending
}

/** Invalidate cached token (e.g. after credentials_expired). */
export async function invalidateAccessToken(
  accountId: string | null,
  deps: AuthDeps = {},
): Promise<void> {
  const redis = deps.redis ?? getRedis()
  await redis.del(redisKeys.awToken(accountId))
}

/** Test helper: clear in-process refresh mutexes. */
export function resetAuthLocks(): void {
  refreshLocks.clear()
}
