import { afterEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { ErrorCode } from '@/shared/enums/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { setSessionResolver, withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import type { AuthSession, OrgContext } from '@/server/http/types'
import { installTestSessionResolver } from '../../../test/helpers/request'

const createInput = z.object({
  name: z.string().min(1),
})

function session(partial: Partial<AuthSession> & Pick<AuthSession, 'userId'>): AuthSession {
  return {
    orgId: 'org_1',
    orgRole: 'OWNER',
    onboarded: true,
    ...partial,
  }
}

afterEach(() => {
  installTestSessionResolver()
})

describe('withAuth', () => {
  it('returns 401 without a session', async () => {
    const handler = withAuth(async () => ok({ ok: true }))
    const res = await handler(new Request('http://localhost/api/x', { method: 'GET' }))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({
      error: { code: ErrorCode.UNAUTHENTICATED, message: 'Unauthenticated' },
    })
  })

  it('returns 403 when the session has no organisation', async () => {
    setSessionResolver(async () =>
      session({ userId: 'user_1', orgId: null, orgRole: null, onboarded: false }),
    )

    const handler = withAuth(async () => ok({ ok: true }))
    const res = await handler(new Request('http://localhost/api/x', { method: 'GET' }))
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.error.code).toBe(ErrorCode.ONBOARDING_INCOMPLETE)
  })

  it('passes OrgContext to the handler when onboarded', async () => {
    setSessionResolver(async () => session({ userId: 'user_1' }))

    let seen: OrgContext | undefined
    const handler = withAuth(async (ctx) => {
      seen = ctx
      return ok({ ok: true })
    })

    const res = await handler(new Request('http://localhost/api/x', { method: 'GET' }))
    expect(res.status).toBe(200)
    expect(seen).toEqual({
      orgId: 'org_1',
      userId: 'user_1',
      orgRole: 'OWNER',
    })
  })

  it('skips the onboarding gate when requireOnboarded is false', async () => {
    setSessionResolver(async () =>
      session({ userId: 'user_1', orgId: null, orgRole: null, onboarded: false }),
    )

    let seen: AuthSession | undefined
    const handler = withAuth(
      async (authSession) => {
        seen = authSession
        return ok({ ok: true })
      },
      { requireOnboarded: false },
    )

    const res = await handler(new Request('http://localhost/api/x', { method: 'GET' }))
    expect(res.status).toBe(200)
    expect(seen).toEqual({
      userId: 'user_1',
      orgId: null,
      orgRole: null,
      onboarded: false,
    })
  })
})

describe('withValidation', () => {
  it('returns 422 on a bad payload with the error envelope', async () => {
    setSessionResolver(async () => session({ userId: 'user_1' }))

    const handler = withAuth(withValidation(createInput, async (_ctx, input) => ok(input)))

    const res = await handler(
      new Request('http://localhost/api/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: '' }),
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(422)
    expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED)
    expect(body.error.details).toEqual(
      expect.objectContaining({
        fieldErrors: expect.objectContaining({
          name: expect.any(Array),
        }),
      }),
    )
  })

  it('parses a valid body into typed input', async () => {
    setSessionResolver(async () => session({ userId: 'user_1' }))

    const handler = withAuth(withValidation(createInput, async (_ctx, input) => ok(input)))

    const res = await handler(
      new Request('http://localhost/api/x', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Alpha' }),
      }),
    )

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ name: 'Alpha' })
  })
})

describe('requirePermission', () => {
  it('allows OWNER and ADMIN short-circuit without a project subject', async () => {
    await expect(
      requirePermission({ orgId: 'o', userId: 'u', orgRole: 'OWNER' }, 'project.create'),
    ).resolves.toBeUndefined()

    await expect(
      requirePermission({ orgId: 'o', userId: 'u', orgRole: 'ADMIN' }, 'project.create'),
    ).resolves.toBeUndefined()
  })
})
