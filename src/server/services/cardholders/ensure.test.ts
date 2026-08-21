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
  ensureIndividualCardholder,
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
    expect(created.status).toBe(CardholderStatus.READY)
    expect(created.airwallexCardholderId).toBe('ch_mobile_001')
  })
})
