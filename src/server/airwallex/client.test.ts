import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAuthLocks } from '@/server/airwallex/auth'
import { createAirwallexClient } from '@/server/airwallex/client'
import { AirwallexFixtureNotFoundError } from '@/server/airwallex/errors'
import { fixtureFileName, loadFixture } from '@/server/airwallex/fixtures/load'
import { createMemoryRedis, resetRedis } from '@/server/redis'
import { loadServerEnv } from '@/server/env'
import { SingleWalletFundingSource } from '@/server/services/cards/funding'

const testEnv = loadServerEnv({
  MONGODB_URI: 'mongodb://127.0.0.1:27017/allocard',
  AUTH_SECRET: 'test-secret',
  AIRWALLEX_CLIENT_ID: 'client-id',
  AIRWALLEX_API_KEY: 'api-key',
  AIRWALLEX_WEBHOOK_SECRET: 'webhook-secret',
  AIRWALLEX_USE_FIXTURES: 'true',
})

describe('airwallex', () => {
  afterEach(() => {
    resetAuthLocks()
    resetRedis()
    vi.restoreAllMocks()
  })

  it('replays a recorded fixture without hitting the network', async () => {
    const fetchSpy = vi.fn()
    const client = createAirwallexClient(null, {
      env: testEnv,
      redis: createMemoryRedis(),
      useFixtures: true,
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })

    const body = await client.request<{ ok: boolean; fixture: string }>({
      method: 'GET',
      path: '/api/v1/issuing/config',
    })

    expect(body).toEqual({ ok: true, fixture: 'ping' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('throws a clear error when a fixture is missing (no network call)', async () => {
    const fetchSpy = vi.fn()
    const client = createAirwallexClient(null, {
      env: testEnv,
      redis: createMemoryRedis(),
      useFixtures: true,
      fetchImpl: fetchSpy as unknown as typeof fetch,
    })

    await expect(
      client.request({
        method: 'GET',
        path: '/api/v1/issuing/cards/does-not-exist',
      }),
    ).rejects.toBeInstanceOf(AirwallexFixtureNotFoundError)

    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('caches login tokens behind a refresh mutex', async () => {
    const redis = createMemoryRedis()
    const loginCalls: number[] = []
    const loginFetch = vi.fn(async () => {
      loginCalls.push(1)
      await new Promise((r) => setTimeout(r, 20))
      return new Response(
        JSON.stringify({
          token: 'live-token',
          expires_at: new Date(Date.now() + 3_600_000).toISOString(),
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      )
    }) as unknown as typeof fetch

    const env = { ...testEnv, AIRWALLEX_USE_FIXTURES: false }
    const { getAccessToken } = await import('@/server/airwallex/auth')

    const [a, b] = await Promise.all([
      getAccessToken(null, { env, redis, useFixtures: false, loginFetch }),
      getAccessToken(null, { env, redis, useFixtures: false, loginFetch }),
    ])

    expect(a).toBe('live-token')
    expect(b).toBe('live-token')
    expect(loginCalls).toHaveLength(1)
  })

  it('forAccount returns a client scoped to the account id', () => {
    const root = createAirwallexClient(null, { env: testEnv, useFixtures: true })
    const scoped = root.forAccount('acct_demo')
    expect(root.accountId).toBeNull()
    expect(scoped.accountId).toBe('acct_demo')
  })

  it('names fixture files deterministically', () => {
    expect(
      fixtureFileName({
        method: 'POST',
        path: '/api/v1/issuing/cards/create',
        requestId: 'allocard-card-abc',
      }),
    ).toBe('POST__api_v1_issuing_cards_create__req_allocard-card-abc.json')
  })

  it('loads the login fixture used by auth', () => {
    const login = loadFixture<{ token: string }>({
      method: 'POST',
      path: '/api/v1/authentication/login',
    })
    expect(login.token).toBe('fixture-aw-token')
  })

  it('SingleWalletFundingSource resolves empty funding source', async () => {
    const funding = new SingleWalletFundingSource()
    const ctx = { orgId: 'org_1', userId: 'user_1', orgRole: 'OWNER' as const }
    expect(await funding.resolve(ctx)).toEqual({})
    expect(await funding.availableBalance(ctx, 'USD')).toBe(0)
  })
})
