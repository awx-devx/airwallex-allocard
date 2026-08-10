import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PATCH } from '@/app/api/attributes/[key]/route'
import { POST as ingest } from '@/app/api/attributes/ingest/route'
import { GET, POST } from '@/app/api/attributes/route'
import { GET as getValues, PUT as putValue } from '@/app/api/attributes/values/route'
import { getPublishedEvents, resetEventPublisher } from '@/server/events/bus'
import { DomainEventType } from '@/server/events/types'
import { AttributeDefinitionModel } from '@/server/models/AttributeDefinition'
import { AttributeValueModel } from '@/server/models/AttributeValue'
import { AuditLogModel } from '@/server/models/AuditLog'
import { MembershipModel } from '@/server/models/Membership'
import { OrganizationModel } from '@/server/models/Organization'
import { UserModel } from '@/server/models/User'
import * as memberships from '@/server/repositories/memberships'
import * as organizations from '@/server/repositories/organizations'
import * as users from '@/server/repositories/users'
import { attributeContracts } from '@/shared/contracts/attribute'
import { AttributeScope } from '@/shared/enums/attributeScope'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { AttributeType } from '@/shared/enums/attributeType'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { expectMatchesContract } from '../helpers/contract'
import { useTestDb } from '../helpers/db'
import { buildRequest, installTestSessionResolver, readBody } from '../helpers/request'

const WEBHOOK_SECRET = 'webhook-secret-at-least-16'
const ATTRIBUTE_HEADER = 'x-allocard-attribute-secret'

describe('/api/attributes', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([
      UserModel.syncIndexes(),
      OrganizationModel.syncIndexes(),
      MembershipModel.syncIndexes(),
      AttributeDefinitionModel.syncIndexes(),
      AttributeValueModel.syncIndexes(),
      AuditLogModel.syncIndexes(),
    ])
  })

  beforeEach(() => {
    resetEventPublisher()
    vi.spyOn(console, 'info').mockImplementation(() => {})
  })

  afterEach(() => {
    installTestSessionResolver()
    resetEventPublisher()
    vi.restoreAllMocks()
  })

  async function seedUser(name = 'User') {
    return users.createUser({
      email: `user-${Date.now()}-${Math.random().toString(16).slice(2)}@example.com`,
      name,
    })
  }

  async function seedMember(opts?: { role?: OrgRole }) {
    const user = await seedUser()
    const org = await organizations.createOrganization({
      name: 'Attr Org',
      slug: `org-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      country: 'US',
      baseCurrency: 'USD',
      createdBy: user.id,
    })
    const role = opts?.role ?? OrgRole.OWNER
    await memberships.createMembership(
      { orgId: org.id, userId: user.id, orgRole: role },
      { userId: user.id, orgRole: role },
    )
    return {
      user,
      org,
      session: {
        userId: user.id,
        orgId: org.id,
        orgRole: role,
        onboarded: true as const,
      },
    }
  }

  describe('GET /api/attributes', () => {
    it('returns 401 when unauthenticated', async () => {
      const res = await GET(buildRequest({ method: 'GET', path: '/api/attributes', session: null }))
      expect(res.status).toBe(401)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.UNAUTHENTICATED,
      )
    })

    it('returns 403 when MEMBER lacks control.edit', async () => {
      const { session } = await seedMember({ role: OrgRole.MEMBER })
      const res = await GET(buildRequest({ method: 'GET', path: '/api/attributes', session }))
      expect(res.status).toBe(403)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.PERMISSION_DENIED,
      )
    })

    it('lists definitions for the org', async () => {
      const { session } = await seedMember()
      await POST(
        buildRequest({
          method: 'POST',
          path: '/api/attributes',
          session,
          body: {
            key: 'campaign.roas',
            label: 'Campaign ROAS',
            type: AttributeType.NUMBER,
            scope: AttributeScope.PROJECT,
            source: AttributeSource.MANUAL,
          },
        }),
      )

      const res = await GET(buildRequest({ method: 'GET', path: '/api/attributes', session }))
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, attributeContracts.list.output)
      expect(body.items.map((item) => item.key)).toContain('campaign.roas')
    })
  })

  describe('POST /api/attributes', () => {
    it('creates a MANUAL attribute and audits', async () => {
      const { session, org } = await seedMember()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/attributes',
          session,
          body: {
            key: 'campaign.roas',
            label: 'Campaign ROAS',
            type: AttributeType.NUMBER,
            scope: AttributeScope.PROJECT,
            source: AttributeSource.MANUAL,
            unit: 'ratio',
          },
        }),
      )
      expect(res.status).toBe(201)
      const body = await expectMatchesContract(res, attributeContracts.create.output)
      expect(body).toMatchObject({
        key: 'campaign.roas',
        source: AttributeSource.MANUAL,
        hasWebhookSecret: false,
        unit: 'ratio',
      })

      const audits = await AuditLogModel.find({
        orgId: org.id,
        action: 'attribute.definition.created',
      }).exec()
      expect(audits).toHaveLength(1)
    })

    it('creates a WEBHOOK attribute with hasWebhookSecret and never echoes the secret', async () => {
      const { session } = await seedMember()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/attributes',
          session,
          body: {
            key: 'campaign.spend',
            label: 'Campaign spend',
            type: AttributeType.NUMBER,
            scope: AttributeScope.PROJECT,
            source: AttributeSource.WEBHOOK,
            webhookSecret: WEBHOOK_SECRET,
          },
        }),
      )
      expect(res.status).toBe(201)
      const body = await expectMatchesContract(res, attributeContracts.create.output)
      expect(body.hasWebhookSecret).toBe(true)
      expect(JSON.stringify(body)).not.toContain(WEBHOOK_SECRET)
    })

    it('rejects built-in keys', async () => {
      const { session } = await seedMember()
      const res = await POST(
        buildRequest({
          method: 'POST',
          path: '/api/attributes',
          session,
          body: {
            key: 'project.budget.remaining',
            label: 'Shadow',
            type: AttributeType.NUMBER,
            scope: AttributeScope.PROJECT,
            source: AttributeSource.MANUAL,
          },
        }),
      )
      expect(res.status).toBe(409)
    })
  })

  describe('PATCH /api/attributes/:key', () => {
    it('updates label and returns 404 for unknown keys', async () => {
      const { session } = await seedMember()
      await POST(
        buildRequest({
          method: 'POST',
          path: '/api/attributes',
          session,
          body: {
            key: 'campaign.roas',
            label: 'ROAS',
            type: AttributeType.NUMBER,
            scope: AttributeScope.PROJECT,
            source: AttributeSource.MANUAL,
          },
        }),
      )

      const okRes = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/attributes/campaign.roas',
          session,
          params: { key: 'campaign.roas' },
          body: { label: 'Campaign ROAS' },
        }),
      )
      expect(okRes.status).toBe(200)
      expect((await expectMatchesContract(okRes, attributeContracts.update.output)).label).toBe(
        'Campaign ROAS',
      )

      const missing = await PATCH(
        buildRequest({
          method: 'PATCH',
          path: '/api/attributes/nope.missing',
          session,
          params: { key: 'nope.missing' },
          body: { label: 'Nope' },
        }),
      )
      expect(missing.status).toBe(404)
    })
  })

  describe('PUT /api/attributes/values', () => {
    it('writes a MANUAL value, emits attribute.updated, and audits', async () => {
      const { session, org } = await seedMember()
      await POST(
        buildRequest({
          method: 'POST',
          path: '/api/attributes',
          session,
          body: {
            key: 'campaign.roas',
            label: 'ROAS',
            type: AttributeType.NUMBER,
            scope: AttributeScope.PROJECT,
            source: AttributeSource.MANUAL,
          },
        }),
      )

      const res = await putValue(
        buildRequest({
          method: 'PUT',
          path: '/api/attributes/values',
          session,
          body: {
            key: 'campaign.roas',
            subjectType: AttributeSubjectType.PROJECT,
            subjectId: 'project_1',
            value: 4.2,
            ttlSec: 3600,
          },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, attributeContracts.putValue.output)
      expect(body.value).toBe(4.2)
      expect(body.source).toBe(AttributeSource.MANUAL)

      const events = getPublishedEvents().filter(
        (event) => event.type === DomainEventType.ATTRIBUTE_UPDATED,
      )
      expect(events).toHaveLength(1)
      expect(events[0]?.payload).toMatchObject({
        key: 'campaign.roas',
        subjectId: 'project_1',
        source: AttributeSource.MANUAL,
      })

      const audits = await AuditLogModel.find({
        orgId: org.id,
        action: 'attribute.value.put',
      }).exec()
      expect(audits).toHaveLength(1)
    })

    it('rejects MANUAL put against a WEBHOOK definition', async () => {
      const { session } = await seedMember()
      await POST(
        buildRequest({
          method: 'POST',
          path: '/api/attributes',
          session,
          body: {
            key: 'campaign.spend',
            label: 'Spend',
            type: AttributeType.NUMBER,
            scope: AttributeScope.PROJECT,
            source: AttributeSource.WEBHOOK,
            webhookSecret: WEBHOOK_SECRET,
          },
        }),
      )

      const res = await putValue(
        buildRequest({
          method: 'PUT',
          path: '/api/attributes/values',
          session,
          body: {
            key: 'campaign.spend',
            subjectType: AttributeSubjectType.PROJECT,
            subjectId: 'project_1',
            value: 100,
          },
        }),
      )
      expect(res.status).toBe(409)
    })
  })

  describe('GET /api/attributes/values', () => {
    it('lists values filtered by key', async () => {
      const { session } = await seedMember()
      await POST(
        buildRequest({
          method: 'POST',
          path: '/api/attributes',
          session,
          body: {
            key: 'campaign.roas',
            label: 'ROAS',
            type: AttributeType.NUMBER,
            scope: AttributeScope.PROJECT,
            source: AttributeSource.MANUAL,
          },
        }),
      )
      await putValue(
        buildRequest({
          method: 'PUT',
          path: '/api/attributes/values',
          session,
          body: {
            key: 'campaign.roas',
            subjectType: AttributeSubjectType.PROJECT,
            subjectId: 'project_1',
            value: 3.5,
          },
        }),
      )

      const res = await getValues(
        buildRequest({
          method: 'GET',
          path: '/api/attributes/values',
          session,
          query: { key: 'campaign.roas' },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, attributeContracts.listValues.output)
      expect(body.items).toHaveLength(1)
      expect(body.items[0]?.value).toBe(3.5)
    })
  })

  describe('POST /api/attributes/ingest', () => {
    it('accepts a signed push without a session and emits attribute.updated', async () => {
      const { session, org } = await seedMember()
      await POST(
        buildRequest({
          method: 'POST',
          path: '/api/attributes',
          session,
          body: {
            key: 'campaign.spend',
            label: 'Spend',
            type: AttributeType.NUMBER,
            scope: AttributeScope.PROJECT,
            source: AttributeSource.WEBHOOK,
            webhookSecret: WEBHOOK_SECRET,
          },
        }),
      )
      resetEventPublisher()

      const res = await ingest(
        buildRequest({
          method: 'POST',
          path: '/api/attributes/ingest',
          session: null,
          headers: { [ATTRIBUTE_HEADER]: WEBHOOK_SECRET },
          body: {
            key: 'campaign.spend',
            subjectType: AttributeSubjectType.PROJECT,
            subjectId: 'project_1',
            value: 250_000,
          },
        }),
      )
      expect(res.status).toBe(200)
      const body = await expectMatchesContract(res, attributeContracts.ingest.output)
      expect(body).toMatchObject({
        orgId: org.id,
        value: 250_000,
        source: AttributeSource.WEBHOOK,
      })

      const events = getPublishedEvents().filter(
        (event) => event.type === DomainEventType.ATTRIBUTE_UPDATED,
      )
      expect(events).toHaveLength(1)
    })

    it('returns 401 for a wrong secret without confirming the key exists', async () => {
      const { session } = await seedMember()
      await POST(
        buildRequest({
          method: 'POST',
          path: '/api/attributes',
          session,
          body: {
            key: 'campaign.spend',
            label: 'Spend',
            type: AttributeType.NUMBER,
            scope: AttributeScope.PROJECT,
            source: AttributeSource.WEBHOOK,
            webhookSecret: WEBHOOK_SECRET,
          },
        }),
      )

      const res = await ingest(
        buildRequest({
          method: 'POST',
          path: '/api/attributes/ingest',
          session: null,
          headers: { 'x-allocard-attribute-secret': 'definitely-the-wrong-secret' },
          body: {
            key: 'campaign.spend',
            subjectType: AttributeSubjectType.PROJECT,
            subjectId: 'project_1',
            value: 1,
          },
        }),
      )
      expect(res.status).toBe(401)
      expect((await readBody<{ error: { code: string } }>(res)).error.code).toBe(
        ErrorCode.UNAUTHENTICATED,
      )
    })
  })
})
