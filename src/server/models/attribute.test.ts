import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { AttributeScope } from '@/shared/enums/attributeScope'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { AttributeType } from '@/shared/enums/attributeType'
import { toDomain } from '@/server/models/base'
import { AttributeDefinitionModel } from '@/server/models/AttributeDefinition'
import { AttributeValueModel } from '@/server/models/AttributeValue'
import type { AttributeDefinition, AttributeValue } from '@/shared/types/attribute'

async function syncIndexes(): Promise<void> {
  await Promise.all([AttributeDefinitionModel.syncIndexes(), AttributeValueModel.syncIndexes()])
}

function minimalDefinition(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    key: 'campaign.roas',
    label: 'Campaign ROAS',
    type: AttributeType.NUMBER,
    scope: AttributeScope.PROJECT,
    source: AttributeSource.WEBHOOK,
    ...overrides,
  }
}

function minimalValue(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    key: 'campaign.roas',
    subjectType: AttributeSubjectType.PROJECT,
    subjectId: 'proj_1',
    value: 2.4,
    observedAt: new Date('2026-08-11T00:00:00.000Z'),
    source: AttributeSource.WEBHOOK,
    ...overrides,
  }
}

describe('models/attribute', () => {
  useTestDb()

  beforeAll(async () => {
    await syncIndexes()
  })

  describe('AttributeDefinition', () => {
    it('defaults optional registry fields', async () => {
      const doc = await AttributeDefinitionModel.create(minimalDefinition())

      expect(doc.unit).toBeNull()
      expect(doc.connectorId).toBeNull()
      expect(doc.refreshIntervalSec).toBeNull()
      expect(doc.enumValues).toBeNull()
      expect(doc.hasWebhookSecret).toBe(false)
    })

    it('enforces unique (orgId, key) and allows the same key in another org', async () => {
      await AttributeDefinitionModel.create(minimalDefinition())

      await expect(
        AttributeDefinitionModel.create(minimalDefinition({ label: 'Duplicate' })),
      ).rejects.toMatchObject({ code: 11000 })

      const other = await AttributeDefinitionModel.create(minimalDefinition({ orgId: 'org_2' }))
      expect(other.orgId).toBe('org_2')
    })

    it('never returns webhookSecretHash — not selected and stripped from toJSON', async () => {
      await AttributeDefinitionModel.create(
        minimalDefinition({ hasWebhookSecret: true, webhookSecretHash: 'hashed-secret' }),
      )

      const doc = await AttributeDefinitionModel.findOne({
        orgId: 'org_1',
        key: 'campaign.roas',
      }).exec()
      expect(doc?.webhookSecretHash).toBeUndefined()

      const withSecret = await AttributeDefinitionModel.findOne({ orgId: 'org_1' })
        .select('+webhookSecretHash')
        .exec()
      expect(withSecret?.webhookSecretHash).toBe('hashed-secret')

      const json = withSecret?.toJSON() as Record<string, unknown>
      expect(json).not.toHaveProperty('webhookSecretHash')
      expect(json.hasWebhookSecret).toBe(true)
    })

    it('requires orgId on queries (tenantScoped)', async () => {
      await expect(AttributeDefinitionModel.find({}).exec()).rejects.toThrow(
        /Tenant scope missing on AttributeDefinition\.find/,
      )

      await AttributeDefinitionModel.create(minimalDefinition())
      const docs = await AttributeDefinitionModel.find({ orgId: 'org_1' }).exec()
      expect(docs).toHaveLength(1)
    })

    it('emits id and ISO dates via toDomain', async () => {
      const doc = await AttributeDefinitionModel.create(minimalDefinition())
      const domain = toDomain<AttributeDefinition>(doc)

      expect(domain.id).toEqual(expect.any(String))
      expect(typeof domain.createdAt).toBe('string')
      expect(typeof domain.updatedAt).toBe('string')
      expect(domain.key).toBe('campaign.roas')
    })
  })

  describe('AttributeValue', () => {
    it('enforces unique (orgId, key, subjectType, subjectId)', async () => {
      await AttributeValueModel.create(minimalValue())

      await expect(AttributeValueModel.create(minimalValue({ value: 3.1 }))).rejects.toMatchObject({
        code: 11000,
      })
    })

    it('allows the same key for a different subject', async () => {
      await AttributeValueModel.create(minimalValue())
      const other = await AttributeValueModel.create(minimalValue({ subjectId: 'proj_2' }))

      expect(other.subjectId).toBe('proj_2')
    })

    it('stores string, boolean, and null values without coercion', async () => {
      const asString = await AttributeValueModel.create(
        minimalValue({ key: 'vendor.riskTier', value: 'LOW' }),
      )
      const asBoolean = await AttributeValueModel.create(
        minimalValue({ key: 'campaign.active', value: false }),
      )
      const asNull = await AttributeValueModel.create(
        minimalValue({ key: 'campaign.notes', value: null }),
      )

      expect(asString.value).toBe('LOW')
      expect(asBoolean.value).toBe(false)
      expect(asNull.value).toBeNull()
    })

    it('defaults ttlSec to null and emits ISO observedAt via toDomain', async () => {
      const doc = await AttributeValueModel.create(minimalValue({ ttlSec: 900 }))
      const domain = toDomain<AttributeValue>(doc)

      expect(domain.observedAt).toBe('2026-08-11T00:00:00.000Z')
      expect(domain.ttlSec).toBe(900)

      const withoutTtl = await AttributeValueModel.create(minimalValue({ key: 'revenue.mrr' }))
      expect(withoutTtl.ttlSec).toBeNull()
    })

    it('requires orgId on queries (tenantScoped)', async () => {
      await expect(AttributeValueModel.find({}).exec()).rejects.toThrow(
        /Tenant scope missing on AttributeValue\.find/,
      )
    })
  })
})
