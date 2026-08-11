import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { CardPolicySnapshot } from '@/server/services/rules/apply'
import { getRedis, resetRedis } from '@/server/redis'
import {
  decideRemoteAuth,
  evaluateHardStops,
  POLICY_SNAPSHOT_MAX_AGE_MS,
} from '@/server/services/remoteAuth/decide'
import { RemoteAuthResponseStatus } from '@/shared/enums/remoteAuthResponseStatus'
import type { RemoteAuthInput } from '@/shared/types/remoteAuth'

function baseInput(overrides: Partial<RemoteAuthInput> = {}): RemoteAuthInput {
  return {
    version: 2,
    account_id: 'acct_1',
    card_id: 'card_1',
    card_transaction_event_id: 'evt_1',
    card_transaction_id: 'ct_1',
    card_transaction_lifecycle_id: 'lc_1',
    transaction_type: 'AUTHORIZATION',
    transaction_date: '2026-08-11T10:00:00.000+0000',
    transaction_amount: 50,
    transaction_currency: 'USD',
    merchant: {
      name: 'ACME',
      country: 'US',
      category_code: '5411',
    },
    ...overrides,
  }
}

function snapshot(overrides: Partial<CardPolicySnapshot> = {}): CardPolicySnapshot {
  return {
    cardId: 'card_1',
    projectId: 'proj_1',
    orgId: 'org_1',
    version: 1,
    hardStops: {
      projectRemaining: 100_000,
      memberMtdCap: null,
      memberMtdSpent: null,
      allowedMcc: null,
      allowedCountries: null,
      requireApprovalAbove: null,
      approvedRequestIds: [],
    },
    refreshedAt: new Date().toISOString(),
    ...overrides,
  }
}

describe('remoteAuth', () => {
  beforeEach(() => {
    resetRedis()
    getRedis({ url: null })
  })

  afterEach(() => {
    resetRedis()
  })

  describe('evaluateHardStops', () => {
    it('declines disallowed MCC and over-budget amounts', () => {
      const snap = snapshot({
        hardStops: {
          projectRemaining: 1_000,
          memberMtdCap: null,
          memberMtdSpent: null,
          allowedMcc: ['5411'],
          allowedCountries: ['US'],
          requireApprovalAbove: null,
          approvedRequestIds: [],
        },
      })
      expect(
        evaluateHardStops(snap, {
          amountMinor: 500,
          currency: 'USD',
          mcc: '7995',
          country: 'US',
        }),
      ).toMatchObject({
        responseStatus: RemoteAuthResponseStatus.DECLINED,
        statusReason: 'mcc_not_allowed',
      })
      expect(
        evaluateHardStops(snap, {
          amountMinor: 5_000,
          currency: 'USD',
          mcc: '5411',
          country: 'US',
        }),
      ).toMatchObject({
        responseStatus: RemoteAuthResponseStatus.DECLINED,
        statusReason: 'project_budget_exceeded',
      })
    })

    it('authorizes when hard stops pass', () => {
      expect(
        evaluateHardStops(snapshot(), {
          amountMinor: 5_000,
          currency: 'USD',
          mcc: '5411',
          country: 'US',
        }),
      ).toMatchObject({
        responseStatus: RemoteAuthResponseStatus.AUTHORIZED,
        statusReason: 'ok',
      })
    })
  })

  describe('decideRemoteAuth', () => {
    it('performs zero database reads (mongoose unused)', async () => {
      const mongoose = await import('mongoose')
      const findSpy = vi.spyOn(mongoose.Model, 'find')
      const findOneSpy = vi.spyOn(mongoose.Model, 'findOne')

      const result = await decideRemoteAuth(baseInput(), {
        getSnapshot: async () => snapshot(),
        rateLimit: false,
      })

      expect(result.decision.response_status).toBe(RemoteAuthResponseStatus.AUTHORIZED)
      expect(findSpy).not.toHaveBeenCalled()
      expect(findOneSpy).not.toHaveBeenCalled()
      findSpy.mockRestore()
      findOneSpy.mockRestore()
    })

    it('approves and flags when snapshot is missing (fail-open)', async () => {
      const result = await decideRemoteAuth(baseInput(), {
        getSnapshot: async () => null,
        failMode: 'open',
        rateLimit: false,
      })
      expect(result.decision).toMatchObject({
        response_status: RemoteAuthResponseStatus.AUTHORIZED,
        status_reason: 'policy_snapshot_unavailable',
      })
      expect(result.flagged).toBe(true)
    })

    it('approves and flags when snapshot is stale (fail-open)', async () => {
      const stale = snapshot({
        refreshedAt: new Date(Date.now() - POLICY_SNAPSHOT_MAX_AGE_MS - 1).toISOString(),
      })
      const result = await decideRemoteAuth(baseInput(), {
        getSnapshot: async () => stale,
        failMode: 'open',
        rateLimit: false,
      })
      expect(result.flagged).toBe(true)
      expect(result.decision.status_reason).toBe('policy_snapshot_unavailable')
    })

    it('meets warm latency budget (< 300ms p99 proxy)', async () => {
      const snap = snapshot()
      const durations: number[] = []
      for (let i = 0; i < 50; i += 1) {
        const result = await decideRemoteAuth(baseInput(), {
          getSnapshot: async () => snap,
          rateLimit: false,
        })
        durations.push(result.durationMs)
      }
      durations.sort((a, b) => a - b)
      const p99 = durations[Math.floor(durations.length * 0.99)] ?? durations[durations.length - 1]!
      expect(p99).toBeLessThan(300)
    })

    it('converts major-unit amount before comparing remaining', async () => {
      const result = await decideRemoteAuth(baseInput({ transaction_amount: 200 }), {
        getSnapshot: async () =>
          snapshot({
            hardStops: {
              projectRemaining: 10_000, // $100
              memberMtdCap: null,
              memberMtdSpent: null,
              allowedMcc: null,
              allowedCountries: null,
              requireApprovalAbove: null,
              approvedRequestIds: [],
            },
          }),
        rateLimit: false,
      })
      // $200 = 20_000 minor > 10_000 remaining
      expect(result.decision.response_status).toBe(RemoteAuthResponseStatus.DECLINED)
      expect(result.decision.status_reason).toBe('project_budget_exceeded')
    })
  })
})
