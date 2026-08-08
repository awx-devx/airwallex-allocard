import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { POST } from '@/app/api/auth/sign-up/route'
import { verifyPassword } from '@/server/auth/password'
import { AuditLogModel } from '@/server/models/AuditLog'
import { UserModel } from '@/server/models/User'
import { findUserCredentialsByEmail } from '@/server/repositories/users'
import { getRedis, resetRedis } from '@/server/redis'
import { PLATFORM_ORG_ID } from '@/server/services/auth/signUp'
import { authContracts } from '@/shared/contracts/auth'
import { ErrorCode } from '@/shared/enums/errors'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, readBody } from '../helpers/request'

describe('POST /api/auth/sign-up', () => {
  useTestDb()

  beforeAll(async () => {
    await UserModel.syncIndexes()
  })

  afterEach(() => {
    resetRedis()
  })

  it('creates a user without an organisation and matches the contract', async () => {
    getRedis({ url: null })

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/auth/sign-up',
        body: {
          email: 'New.User@Example.com',
          password: 'password123',
          name: 'New User',
        },
      }),
    )

    expect(res.status).toBe(201)
    const body = await expectMatchesContract(res, authContracts.signUp.output)
    expect(body.email).toBe('new.user@example.com')
    expect(body.name).toBe('New User')
    expect(body).not.toHaveProperty('passwordHash')
    expect(body.defaultOrgId).toBeUndefined()

    const creds = await findUserCredentialsByEmail('new.user@example.com')
    expect(creds).not.toBeNull()
    expect(await verifyPassword(creds!.passwordHash, 'password123')).toBe(true)

    const audits = await AuditLogModel.find({ orgId: PLATFORM_ORG_ID }).exec()
    expect(audits).toHaveLength(1)
    expect(audits[0]?.action).toBe('user.signed_up')
    expect(audits[0]?.subjectId).toBe(body.id)
  })

  it('returns a neutral conflict for a duplicate email', async () => {
    getRedis({ url: null })

    const payload = {
      email: 'taken@example.com',
      password: 'password123',
      name: 'First',
    }
    expect(
      (await POST(buildRequest({ method: 'POST', path: '/api/auth/sign-up', body: payload })))
        .status,
    ).toBe(201)

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/auth/sign-up',
        body: { ...payload, name: 'Second' },
      }),
    )
    const body = await readBody<{ error: { code: string; message: string } }>(res)

    expect(res.status).toBe(409)
    expect(body.error.code).toBe(ErrorCode.CONFLICT)
    expect(body.error.message).toBe('Unable to complete sign-up')
    expect(body.error.message.toLowerCase()).not.toMatch(/exist|taken|already/)
  })

  it('returns 422 for an invalid payload', async () => {
    getRedis({ url: null })

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/auth/sign-up',
        body: { email: 'not-an-email', password: 'short', name: '' },
      }),
    )
    const body = await readBody<{ error: { code: string } }>(res)

    expect(res.status).toBe(422)
    expect(body.error.code).toBe(ErrorCode.VALIDATION_FAILED)
  })

  it('rate limits by IP', async () => {
    getRedis({ url: null })

    const headers = { 'x-forwarded-for': '203.0.113.10' }
    for (let i = 0; i < 10; i += 1) {
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/auth/sign-up',
          headers,
          body: {
            email: `user${i}@example.com`,
            password: 'password123',
            name: `User ${i}`,
          },
        }),
      )
      expect(res.status).toBe(201)
    }

    const res = await POST(
      buildRequest({
        method: 'POST',
        path: '/api/auth/sign-up',
        headers,
        body: {
          email: 'overflow@example.com',
          password: 'password123',
          name: 'Overflow',
        },
      }),
    )
    const body = await readBody<{ error: { code: string } }>(res)

    expect(res.status).toBe(429)
    expect(body.error.code).toBe(ErrorCode.RATE_LIMITED)
  })
})
