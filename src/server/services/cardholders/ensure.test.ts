import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { CardholderModel } from '@/server/models/Cardholder'
import { UserModel } from '@/server/models/User'
import { OrgRole } from '@/shared/enums/orgRole'
import { CardholderStatus } from '@/shared/enums/cardholderStatus'
import { CardholderType } from '@/shared/enums/cardholderType'
import type { OrgContext } from '@/server/http/types'
import * as users from '@/server/repositories/users'
import { createCardholderForOrg } from '@/server/services/cardholders/create'
import {
  delegateCardholderEmail,
  ensureIndividualCardholder,
  ensureOrgDelegateCardholder,
  SANDBOX_CARDHOLDER_ADDRESS,
  SANDBOX_CARDHOLDER_DOB,
  SANDBOX_CARDHOLDER_MOBILE,
} from '@/server/services/cardholders/ensure'
import { createCardholder, findCardholderByUserId } from '@/server/repositories/cardholders'
import { resetRedis } from '@/server/redis'
import { createAirwallexClient, type AirwallexClient } from '@/server/airwallex/client'
import type { CreateCardholderBody } from '@/server/airwallex/types'
import { loadServerEnv } from '@/server/env'
import { createMemoryRedis } from '@/server/redis'

const testEnv = loadServerEnv({
  MONGODB_URI: 'mongodb://127.0.0.1:27017/allocard',
  AUTH_SECRET: 'test-secret',
  AIRWALLEX_CLIENT_ID: 'client-id',
  AIRWALLEX_API_KEY: 'api-key',
  AIRWALLEX_WEBHOOK_SECRET: 'webhook-secret',
  AIRWALLEX_USE_FIXTURES: 'true',
})

function ctx(orgId: string, userId: string): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

describe('services/cardholders', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([UserModel.syncIndexes(), CardholderModel.syncIndexes()])
  })

  beforeEach(() => {
    resetRedis()
  })

  it('ensureIndividualCardholder is idempotent on (orgId, userId)', async () => {
    const user = await users.createUser({
      email: `ch-${Date.now()}@example.com`,
      name: 'Priya Sharma',
    })
    const orgCtx = ctx('org_ensure', user.id)
    const redis = createMemoryRedis()
    const aw = createAirwallexClient(null, {
      env: testEnv,
      redis,
      useFixtures: true,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })

    const first = await ensureIndividualCardholder(orgCtx, user.id, { airwallex: aw })
    const second = await ensureIndividualCardholder(orgCtx, user.id, { airwallex: aw })

    expect(second.id).toBe(first.id)
    expect(first.type).toBe(CardholderType.INDIVIDUAL)
    expect(first.userId).toBe(user.id)
    expect(await findCardholderByUserId(orgCtx, user.id)).toEqual(second)
  })

  it('createCardholderForOrg creates DELEGATE without userId', async () => {
    const orgCtx = ctx('org_delegate', 'admin_1')
    const redis = createMemoryRedis()
    const aw = createAirwallexClient(null, {
      env: testEnv,
      redis,
      useFixtures: true,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })

    const created = await createCardholderForOrg(
      orgCtx,
      { type: CardholderType.DELEGATE },
      { airwallex: aw },
    )
    expect(created.type).toBe(CardholderType.DELEGATE)
    expect(created.userId).toBeNull()
  })

  it('retries Airwallex create when the local id is still provisional', async () => {
    const user = await users.createUser({
      email: `ch-retry-${Date.now()}@example.com`,
      name: 'Retry User',
    })
    const orgCtx = ctx('org_retry', user.id)
    await createCardholder(orgCtx, {
      userId: user.id,
      airwallexCardholderId: 'pending:local-uuid',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.PENDING,
    })
    const redis = createMemoryRedis()
    const aw = createAirwallexClient(null, {
      env: testEnv,
      redis,
      useFixtures: true,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })

    const refreshed = await ensureIndividualCardholder(orgCtx, user.id, { airwallex: aw })
    expect(refreshed.status).toBe(CardholderStatus.READY)
    expect(refreshed.airwallexCardholderId.startsWith('pending:')).toBe(false)
  })

  it('GETs Airwallex status when the local cardholder is PENDING with a real id', async () => {
    const user = await users.createUser({
      email: `ch-get-${Date.now()}@example.com`,
      name: 'Get User',
    })
    const orgCtx = ctx('org_get', user.id)
    await createCardholder(orgCtx, {
      userId: user.id,
      airwallexCardholderId: 'ch_fixture_ready_001',
      type: CardholderType.INDIVIDUAL,
      status: CardholderStatus.PENDING,
    })
    const redis = createMemoryRedis()
    const aw = createAirwallexClient(null, {
      env: testEnv,
      redis,
      useFixtures: true,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })

    const refreshed = await ensureIndividualCardholder(orgCtx, user.id, { airwallex: aw })
    expect(refreshed.status).toBe(CardholderStatus.READY)
    expect(refreshed.airwallexCardholderId).toBe('ch_fixture_ready_001')
  })

  it('sends a sandbox placeholder mobile_number on INDIVIDUAL create', async () => {
    const user = await users.createUser({
      email: `ch-mobile-${Date.now()}@example.com`,
      name: 'Mobile User',
    })
    const orgCtx = ctx('org_mobile', user.id)
    const bodies: CreateCardholderBody[] = []
    const aw = {
      cardholders: {
        create: async (body: CreateCardholderBody) => {
          bodies.push(body)
          return {
            cardholder_id: 'ch_mobile_001',
            type: 'INDIVIDUAL' as const,
            status: 'READY' as const,
          }
        },
      },
    } as unknown as AirwallexClient

    const created = await ensureIndividualCardholder(orgCtx, user.id, { airwallex: aw })

    expect(bodies).toHaveLength(1)
    expect(bodies[0]?.mobile_number).toBe(SANDBOX_CARDHOLDER_MOBILE)
    expect(bodies[0]?.email).toBe(user.email)
    expect(bodies[0]?.address).toEqual(SANDBOX_CARDHOLDER_ADDRESS)
    expect(bodies[0]?.individual.express_consent_obtained).toBe('yes')
    expect(created.status).toBe(CardholderStatus.READY)
    expect(created.airwallexCardholderId).toBe('ch_mobile_001')
  })

  it('sends email, mobile, address, and individual on DELEGATE create', async () => {
    const orgCtx = ctx('org_delegate_kyc', 'admin_1')
    const bodies: CreateCardholderBody[] = []
    const aw = {
      cardholders: {
        create: async (body: CreateCardholderBody) => {
          bodies.push(body)
          return {
            cardholder_id: 'ch_delegate_001',
            type: 'DELEGATE' as const,
            status: 'READY' as const,
          }
        },
      },
    } as unknown as AirwallexClient

    const created = await ensureOrgDelegateCardholder(orgCtx, { airwallex: aw })

    expect(bodies).toHaveLength(1)
    expect(bodies[0]?.type).toBe('DELEGATE')
    expect(bodies[0]?.email).toBe(delegateCardholderEmail(orgCtx.orgId))
    expect(bodies[0]?.mobile_number).toBe(SANDBOX_CARDHOLDER_MOBILE)
    expect(bodies[0]?.address).toEqual(SANDBOX_CARDHOLDER_ADDRESS)
    expect(bodies[0]?.individual.name.first_name).toBe('Allocard')
    expect(bodies[0]?.individual.name.last_name).toBe('Delegate')
    expect(bodies[0]?.individual.date_of_birth).toBe(SANDBOX_CARDHOLDER_DOB)
    expect(bodies[0]?.individual.express_consent_obtained).toBe('yes')
    expect(created.status).toBe(CardholderStatus.READY)
    expect(created.airwallexCardholderId).toBe('ch_delegate_001')
  })

  it('ensureOrgDelegateCardholder is idempotent per org', async () => {
    const orgCtx = ctx('org_delegate_ensure', 'admin_1')
    const redis = createMemoryRedis()
    const aw = createAirwallexClient(null, {
      env: testEnv,
      redis,
      useFixtures: true,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })

    const first = await ensureOrgDelegateCardholder(orgCtx, { airwallex: aw })
    const second = await ensureOrgDelegateCardholder(orgCtx, { airwallex: aw })

    expect(second.id).toBe(first.id)
    expect(first.type).toBe(CardholderType.DELEGATE)
    expect(first.userId).toBeNull()
  })
})
