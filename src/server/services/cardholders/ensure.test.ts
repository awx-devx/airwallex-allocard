import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { CardholderModel } from '@/server/models/Cardholder'
import { UserModel } from '@/server/models/User'
import { OrgRole } from '@/shared/enums/orgRole'
import { CardholderType } from '@/shared/enums/cardholderType'
import type { OrgContext } from '@/server/http/types'
import * as users from '@/server/repositories/users'
import { createCardholderForOrg } from '@/server/services/cardholders/create'
import { ensureIndividualCardholder } from '@/server/services/cardholders/ensure'
import { findCardholderByUserId } from '@/server/repositories/cardholders'
import { resetRedis } from '@/server/redis'
import { createAirwallexClient } from '@/server/airwallex/client'
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
})
