import { describe, expect, it, beforeEach, afterEach } from 'vitest'
import { resetRedis, getRedis } from '@/server/redis'
import {
  simulatePurchase,
  buildSyntheticRemoteAuthInput,
} from '@/server/services/remoteAuth/simulate'
import { RemoteAuthResponseStatus } from '@/shared/enums/remoteAuthResponseStatus'
import type { CardPolicySnapshot } from '@/server/services/rules/apply'
import { redisKeys } from '@/server/redis'

describe('api/simulate', () => {
  beforeEach(() => {
    resetRedis()
    getRedis({ url: null })
  })

  afterEach(() => {
    resetRedis()
  })

  it('builds major-unit remote-auth input from minor-unit domain shape', () => {
    const input = buildSyntheticRemoteAuthInput({
      cardId: 'card_1',
      amount: 12_500,
      currency: 'USD',
      merchant: { name: 'ACME', mcc: '5411', country: 'US' },
    })
    expect(input.version).toBe(2)
    expect(input.card_id).toBe('card_1')
    expect(input.transaction_amount).toBe(125)
    expect(input.transaction_currency).toBe('USD')
    expect(input.merchant.category_code).toBe('5411')
  })

  it('uses the same decide path as live remote-auth', async () => {
    const snap: CardPolicySnapshot = {
      cardId: 'card_1',
      projectId: 'proj_1',
      orgId: 'org_1',
      version: 1,
      hardStops: {
        projectRemaining: 1_000,
        memberMtdCap: null,
        memberMtdSpent: null,
        allowedMcc: null,
        allowedCountries: null,
        requireApprovalAbove: null,
        approvedRequestIds: [],
      },
      refreshedAt: new Date().toISOString(),
    }
    await getRedis().set(redisKeys.policyCard('card_1'), JSON.stringify(snap))

    const declined = await simulatePurchase({
      cardId: 'card_1',
      amount: 50_000,
      currency: 'USD',
      merchant: { name: 'ACME', mcc: '5411', country: 'US' },
    })
    expect(declined.response_status).toBe(RemoteAuthResponseStatus.DECLINED)
    expect(declined.status_reason).toBe('project_budget_exceeded')
  })
})
