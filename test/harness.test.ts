import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AuditLogModel } from '@/server/models/AuditLog'
import { audit } from '@/server/services/audit/log'
import { ok } from '@/server/http/respond'
import { withAuth } from '@/server/http/withAuth'
import { expectMatchesContract } from './helpers/contract'
import { useTestDb } from './helpers/db'
import { makeMember, makeOrg, makeUser } from './helpers/factories'
import { buildRequest, getRequestParams, readBody } from './helpers/request'

const sampleOutput = z.object({
  greeting: z.string(),
  orgId: z.string(),
})

describe('test harness', () => {
  useTestDb()

  it('wires factories, buildRequest, db, and expectMatchesContract', async () => {
    const user = await makeUser({ name: 'Ada' })
    const org = await makeOrg({ name: 'Acme' })
    const admin = await makeMember(org, { orgRole: 'OWNER', user })

    const handler = withAuth(async (ctx, req) => {
      const params = getRequestParams(req)
      await audit(ctx, {
        action: 'harness.sample',
        subjectType: 'org',
        subjectId: ctx.orgId,
        metadata: { routeParam: params.id },
      })
      return ok({ greeting: `hello ${admin.user.name}`, orgId: ctx.orgId })
    })

    const res = await handler(
      buildRequest({
        method: 'GET',
        path: '/api/sample',
        session: admin,
        params: { id: 'param_1' },
        query: { ping: true },
      }),
    )

    expect(res.status).toBe(200)
    const body = await expectMatchesContract(res, sampleOutput)
    expect(body).toEqual({ greeting: 'hello Ada', orgId: org.id })

    const again = await readBody<z.infer<typeof sampleOutput>>(res)
    expect(again.orgId).toBe(org.id)

    const logs = await AuditLogModel.find({ orgId: org.id }).exec()
    expect(logs).toHaveLength(1)
    expect(logs[0]?.action).toBe('harness.sample')
  })

  it('network guard fails real fetch', async () => {
    await expect(fetch('https://example.com/airwallex')).rejects.toThrow(
      /Network disabled in tests/,
    )
  })
})
