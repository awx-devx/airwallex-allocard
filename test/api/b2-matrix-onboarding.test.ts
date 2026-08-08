/**
 * B2 phase-exit matrix gaps: every B2 endpoint returns 403 ONBOARDING_INCOMPLETE
 * when authenticated but not onboarded (matrix #2).
 *
 * Matrix #5 (access scope) — N/A until B3.
 * Matrix #9 (idempotency key) — N/A; B2 endpoints do not take idempotency keys.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { GET as GET_HISTORY } from '@/app/api/projects/[id]/history/route'
import { PATCH as CHANGE_OWNER } from '@/app/api/projects/[id]/owner/route'
import { GET as GET_ONE, PATCH as UPDATE } from '@/app/api/projects/[id]/route'
import { POST as TRANSITION } from '@/app/api/projects/[id]/transition/route'
import {
  DELETE as DELETE_WS,
  PATCH as UPDATE_WS,
} from '@/app/api/projects/[id]/workstreams/[wsId]/route'
import { GET as LIST_WS, POST as CREATE_WS } from '@/app/api/projects/[id]/workstreams/route'
import { GET as LIST, POST as CREATE } from '@/app/api/projects/route'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { ProjectModel } from '@/server/models/Project'
import { UserModel } from '@/server/models/User'
import * as users from '@/server/repositories/users'
import { ErrorCode } from '@/shared/enums/errors'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

describe('B2 matrix #2 — onboarding incomplete on every endpoint', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      ProjectModel.syncIndexes(),
    ])
  })

  afterEach(() => {
    installTestSessionResolver()
  })

  async function incompleteSession() {
    const user = await users.createUser({
      email: `pre-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name: 'Pre-onboard',
    })
    return {
      userId: user.id,
      orgId: null,
      orgRole: null,
      onboarded: false as const,
    }
  }

  async function expectOnboardingIncomplete(res: Response) {
    expect(res.status).toBe(403)
    const body = await readBody<{ error: { code: string } }>(res)
    expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
  }

  it('POST /api/projects', async () => {
    const session = await incompleteSession()
    const res = await CREATE(
      buildRequest({
        method: 'POST',
        path: '/api/projects',
        session,
        body: { name: 'X', code: 'X-1' },
      }),
    )
    await expectOnboardingIncomplete(res)
  })

  it('GET /api/projects', async () => {
    const session = await incompleteSession()
    const res = await LIST(buildRequest({ method: 'GET', path: '/api/projects', session }))
    await expectOnboardingIncomplete(res)
  })

  it('GET /api/projects/:id', async () => {
    const session = await incompleteSession()
    const res = await GET_ONE(
      buildRequest({
        method: 'GET',
        path: '/api/projects/x',
        session,
        params: { id: 'x' },
      }),
    )
    await expectOnboardingIncomplete(res)
  })

  it('PATCH /api/projects/:id', async () => {
    const session = await incompleteSession()
    const res = await UPDATE(
      buildRequest({
        method: 'PATCH',
        path: '/api/projects/x',
        session,
        params: { id: 'x' },
        body: { name: 'X' },
      }),
    )
    await expectOnboardingIncomplete(res)
  })

  it('POST /api/projects/:id/transition', async () => {
    const session = await incompleteSession()
    const res = await TRANSITION(
      buildRequest({
        method: 'POST',
        path: '/api/projects/x/transition',
        session,
        params: { id: 'x' },
        body: { to: ProjectStatus.CANCELLED },
      }),
    )
    await expectOnboardingIncomplete(res)
  })

  it('GET /api/projects/:id/workstreams', async () => {
    const session = await incompleteSession()
    const res = await LIST_WS(
      buildRequest({
        method: 'GET',
        path: '/api/projects/x/workstreams',
        session,
        params: { id: 'x' },
      }),
    )
    await expectOnboardingIncomplete(res)
  })

  it('POST /api/projects/:id/workstreams', async () => {
    const session = await incompleteSession()
    const res = await CREATE_WS(
      buildRequest({
        method: 'POST',
        path: '/api/projects/x/workstreams',
        session,
        params: { id: 'x' },
        body: { name: 'Retail' },
      }),
    )
    await expectOnboardingIncomplete(res)
  })

  it('PATCH /api/projects/:id/workstreams/:wsId', async () => {
    const session = await incompleteSession()
    const res = await UPDATE_WS(
      buildRequest({
        method: 'PATCH',
        path: '/api/projects/x/workstreams/y',
        session,
        params: { id: 'x', wsId: 'y' },
        body: { name: 'Retail' },
      }),
    )
    await expectOnboardingIncomplete(res)
  })

  it('DELETE /api/projects/:id/workstreams/:wsId', async () => {
    const session = await incompleteSession()
    const res = await DELETE_WS(
      buildRequest({
        method: 'DELETE',
        path: '/api/projects/x/workstreams/y',
        session,
        params: { id: 'x', wsId: 'y' },
      }),
    )
    await expectOnboardingIncomplete(res)
  })

  it('PATCH /api/projects/:id/owner', async () => {
    const session = await incompleteSession()
    const res = await CHANGE_OWNER(
      buildRequest({
        method: 'PATCH',
        path: '/api/projects/x/owner',
        session,
        params: { id: 'x' },
        body: { ownerId: 'y' },
      }),
    )
    await expectOnboardingIncomplete(res)
  })

  it('GET /api/projects/:id/history', async () => {
    const session = await incompleteSession()
    const res = await GET_HISTORY(
      buildRequest({
        method: 'GET',
        path: '/api/projects/x/history',
        session,
        params: { id: 'x' },
      }),
    )
    await expectOnboardingIncomplete(res)
  })
})
