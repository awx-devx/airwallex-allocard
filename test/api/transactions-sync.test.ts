/**
 * B8.9 — Sync backstop + admin route tests.
 * Proves admin gate (OWNER + secret) and that the worker job runs.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '@/app/api/admin/sync-transactions/route'
import { resetEventPublisher } from '@/server/events/bus'
import type { OrgContext } from '@/server/http/types'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as projectsRepo from '@/server/repositories/projects'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'
import { syncTransactions } from '@/server/services/transactions/sync'
import { resetRedis } from '@/server/redis'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

vi.mock('@/server/env', () => ({
  loadServerEnv: () => ({
    ADMIN_JOB_SECRET: 'test-admin-secret',
    MONGODB_URI: 'mongodb://localhost/test',
    MONGODB_DB: 'test',
    AUTH_SECRET: 'secret',
    AIRWALLEX_CLIENT_ID: 'cid',
    AIRWALLEX_API_KEY: 'key',
    AIRWALLEX_WEBHOOK_SECRET: 'whsec',
    AIRWALLEX_BASE_URL: 'https://api-demo.airwallex.com',
    AIRWALLEX_API_VERSION: '2024-02-22',
    AIRWALLEX_USE_FIXTURES: true,
    REMOTE_AUTH_MODE: 'simulate',
  }),
  serverEnv: undefined,
  publicEnv: undefined,
}))

describe('B8.9 sync-transactions', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetEventPublisher()
    resetRedis()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    resetEventPublisher()
    resetRedis()
    vi.restoreAllMocks()
  })

  async function seedOwner() {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `sync-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Owner',
    })
    const org = await organizations.createOrganization({
      name: 'Sync Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const ctx: OrgContext = { orgId: org.id, userId: user.id, orgRole: OrgRole.OWNER }
    await memberships.createMembership(ctx, { userId: user.id, orgRole: OrgRole.OWNER })
    await seedRoleTemplates(org.id)
    await projectsRepo.createProject(ctx, {
      name: 'Sync Project',
      code: `SY-${Date.now().toString(16)}`,
    })
    return {
      user,
      org,
      ctx,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: OrgRole.OWNER,
        onboarded: true as const,
      },
    }
  }

  async function seedMember(orgId: string) {
    const user = await (
      await import('@/server/repositories/users')
    ).createUser({
      email: `m-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Member',
    })
    await memberships.createMembership(
      { orgId, userId: user.id, orgRole: OrgRole.MEMBER },
      { userId: user.id, orgRole: OrgRole.MEMBER },
    )
    return {
      user,
      session: {
        userId: user.id,
        orgId,
        orgRole: OrgRole.MEMBER,
        onboarded: true as const,
      },
    }
  }

  // ─── POST /api/admin/sync-transactions ─────────────────────────────────

  describe('POST /api/admin/sync-transactions', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/admin/sync-transactions',
          session: null,
          headers: { 'x-allocard-admin-secret': 'test-admin-secret' },
        }),
      )
      expect(res.status).toBe(401)
    })

    it('returns 403 when onboarding is incomplete', async () => {
      const user = await (
        await import('@/server/repositories/users')
      ).createUser({
        email: `u-${Date.now()}@example.com`,
        name: 'U',
      })
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/admin/sync-transactions',
          session: { userId: user.id, orgId: null, orgRole: null, onboarded: false },
          headers: { 'x-allocard-admin-secret': 'test-admin-secret' },
        }),
      )
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.ONBOARDING_INCOMPLETE,
      )
    })

    it('returns 403 when caller is not OWNER', async () => {
      const owner = await seedOwner()
      const member = await seedMember(owner.org.id)
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/admin/sync-transactions',
          session: member.session,
          headers: { 'x-allocard-admin-secret': 'test-admin-secret' },
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 403 when admin secret is wrong', async () => {
      const owner = await seedOwner()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/admin/sync-transactions',
          session: owner.session,
          headers: { 'x-allocard-admin-secret': 'wrong-secret' },
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 403 when admin secret header is missing', async () => {
      const owner = await seedOwner()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/admin/sync-transactions',
          session: owner.session,
        }),
      )
      expect(res.status).toBe(403)
    })

    it('returns 204 for OWNER with correct secret', async () => {
      const owner = await seedOwner()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/admin/sync-transactions',
          session: owner.session,
          headers: { 'x-allocard-admin-secret': 'test-admin-secret' },
        }),
      )
      expect(res.status).toBe(204)
    })
  })

  // ─── syncTransactions service ──────────────────────────────────────────

  describe('syncTransactions service', () => {
    it('runs without error (stub — returns zeros)', async () => {
      const result = await syncTransactions()
      expect(result.synced).toBe(0)
      expect(result.errors).toBe(0)
    })
  })
})
