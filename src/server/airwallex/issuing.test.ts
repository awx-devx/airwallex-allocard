import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetAuthLocks } from '@/server/airwallex/auth'
import { createAirwallexClient } from '@/server/airwallex/client'
import { cardRequestId, cardholderRequestId, type CreateCardBody } from '@/server/airwallex/types'
import { createMemoryRedis, redisKeys, resetRedis } from '@/server/redis'
import { loadServerEnv } from '@/server/env'
import type { OrgContext } from '@/server/http/types'

const testEnv = loadServerEnv({
  MONGODB_URI: 'mongodb://127.0.0.1:27017/allocard',
  AUTH_SECRET: 'test-secret',
  AIRWALLEX_CLIENT_ID: 'client-id',
  AIRWALLEX_API_KEY: 'api-key',
  AIRWALLEX_WEBHOOK_SECRET: 'webhook-secret',
  AIRWALLEX_USE_FIXTURES: 'true',
})

const orgA: OrgContext = { orgId: 'org_fixture_a', userId: 'user_1', orgRole: 'OWNER' }
const orgB: OrgContext = { orgId: 'org_fixture_b', userId: 'user_2', orgRole: 'OWNER' }

function makeClient(redis = createMemoryRedis()) {
  return createAirwallexClient(null, {
    env: testEnv,
    redis,
    useFixtures: true,
    fetchImpl: vi.fn() as unknown as typeof fetch,
  })
}

const sampleCreateBody = (requestId: string): CreateCardBody => ({
  request_id: requestId,
  cardholder_id: 'ch_fixture_ready_001',
  created_by: 'Test User',
  form_factor: 'VIRTUAL',
  issue_to: 'INDIVIDUAL',
  nick_name: 'APAC Brand Launch — Priya',
  metadata: {
    orgId: 'org_fixture_a',
    projectId: 'proj_fixture_1',
    cardDocId: 'carddoc001',
  },
  authorization_controls: {
    allowed_transaction_count: 'MULTIPLE',
    transaction_limits: {
      currency: 'USD',
      limits: [
        { interval: 'MONTHLY', amount: 4000 },
        { interval: 'PER_TRANSACTION', amount: 800 },
      ],
    },
  },
})

describe('airwallex/issuing', () => {
  afterEach(() => {
    resetAuthLocks()
    resetRedis()
    vi.restoreAllMocks()
  })

  it('uses a stable request_id for cardholder create', async () => {
    const client = makeClient()
    const requestId = cardholderRequestId('chdoc001')
    expect(requestId).toBe('allocard-cardholder-chdoc001')

    const created = await client.cardholders.create({
      request_id: requestId,
      type: 'INDIVIDUAL',
      email: 'priya@example.com',
      mobile_number: '14155550100',
      address: {
        line1: '1 Market St',
        city: 'San Francisco',
        state: 'CA',
        postcode: '94105',
        country: 'US',
      },
      individual: {
        name: { first_name: 'Priya', last_name: 'Sharma' },
        date_of_birth: '1990-04-12',
        address: {
          line1: '1 Market St',
          city: 'San Francisco',
          state: 'CA',
          postcode: '94105',
          country: 'US',
        },
        express_consent_obtained: 'yes',
      },
    })

    expect(created.cardholder_id).toBe('ch_fixture_ready_001')
    expect(created.status).toBe('READY')
  })

  it('uses a stable request_id for card create and writes metadata', async () => {
    const client = makeClient()
    const requestId = cardRequestId('carddoc001')
    expect(requestId).toBe('allocard-card-carddoc001')

    const created = await client.cards.create(sampleCreateBody(requestId))
    expect(created.card_id).toBe('card_fixture_001')
    expect(created.metadata?.orgId).toBe('org_fixture_a')
    expect(created.metadata?.projectId).toBe('proj_fixture_1')
    expect(created.metadata?.cardDocId).toBe('carddoc001')
    expect(created.card_number).toMatch(/^\*+\d{4}$/)
  })

  it('retried create with the same request_id returns the same Airwallex card', async () => {
    const client = makeClient()
    const requestId = cardRequestId('carddoc001')
    const first = await client.cards.create(sampleCreateBody(requestId))
    const second = await client.cards.create(sampleCreateBody(requestId))
    expect(first.card_id).toBe(second.card_id)
    expect(first.card_id).toBe('card_fixture_001')
  })

  it('cards.list always filters by metadata.orgId', async () => {
    const client = makeClient()

    const forA = await client.cards.list(orgA)
    expect(forA.items).toHaveLength(1)
    expect(forA.items[0]?.card_id).toBe('card_fixture_001')
    expect(forA.items.every((c) => c.metadata?.orgId === orgA.orgId)).toBe(true)

    const forB = await client.cards.list(orgB)
    expect(forB.items).toHaveLength(1)
    expect(forB.items[0]?.card_id).toBe('card_fixture_other_org')
    expect(forB.items.every((c) => c.metadata?.orgId === orgB.orgId)).toBe(true)
  })

  it('listAllTenantsUnsafe returns unfiltered items (not for request paths)', async () => {
    const client = makeClient()
    const all = await client.cards.listAllTenantsUnsafe()
    expect(all.items.length).toBeGreaterThanOrEqual(2)
    const orgIds = new Set(all.items.map((c) => c.metadata?.orgId))
    expect(orgIds.has('org_fixture_a')).toBe(true)
    expect(orgIds.has('org_fixture_b')).toBe(true)
  })

  it('exposes config max limit from cached issuing config', async () => {
    const redis = createMemoryRedis()
    const client = makeClient(redis)

    const maxUsd = await client.config.getMaxLimit('USD')
    expect(maxUsd).toBe(50000)

    const cached = await redis.get(redisKeys.awConfig(null))
    expect(cached).toBeTruthy()

    // Second call hits Redis — no need for another fixture load path.
    const maxAgain = await client.config.getMaxLimit('usd')
    expect(maxAgain).toBe(50000)
  })

  it('get / limits / update / activate / panTokens work via fixtures', async () => {
    const client = makeClient()

    const card = await client.cards.get('card_fixture_001')
    expect(card.card_status).toBe('ACTIVE')

    const limits = await client.cards.limits('card_fixture_001')
    expect(limits.currency).toBe('USD')
    expect(limits.limits[0]?.remaining).toBe(3500)

    const updated = await client.cards.update('card_fixture_001', { card_status: 'INACTIVE' })
    expect(updated.card_status).toBe('INACTIVE')

    const activated = await client.cards.activate('card_fixture_001')
    expect(activated.card_status).toBe('ACTIVE')

    const pan = await client.panTokens.create({ card_id: 'card_fixture_001' })
    expect(pan.token).toBe('pan_token_fixture_abc123')
    expect(Date.parse(pan.expires_at)).toBeGreaterThan(Date.now())
    expect(pan).not.toHaveProperty('card_number')
    expect(pan).not.toHaveProperty('cvv')

    const details = await client.cards.details('card_fixture_001')
    expect(details.card_number).toMatch(/^\d{13,19}$/)
    expect(String(details.cvv).length).toBeGreaterThan(0)
    expect(String(details.expiry_month).length).toBeGreaterThan(0)
    expect(String(details.expiry_year).length).toBeGreaterThan(0)
  })

  it('transactions stubs throw TODO(B8)', async () => {
    const client = makeClient()
    await expect(client.transactions.list(orgA)).rejects.toThrow(/TODO\(B8\)/)
    await expect(client.transactions.get(orgA, 'tx_1')).rejects.toThrow(/TODO\(B8\)/)
    await expect(client.transactions.events(orgA, 'tx_1')).rejects.toThrow(/TODO\(B8\)/)
  })

  it('exposes a details method on cards for organisation reveal', () => {
    const client = makeClient()
    expect('details' in client.cards).toBe(true)
  })
})
