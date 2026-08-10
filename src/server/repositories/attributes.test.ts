import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { AttributeScope } from '@/shared/enums/attributeScope'
import { AttributeSource } from '@/shared/enums/attributeSource'
import { AttributeSubjectType } from '@/shared/enums/attributeSubjectType'
import { AttributeType } from '@/shared/enums/attributeType'
import { OrgRole } from '@/shared/enums/orgRole'
import { AttributeDefinitionModel } from '@/server/models/AttributeDefinition'
import { AttributeValueModel } from '@/server/models/AttributeValue'
import type { OrgContext } from '@/server/http/types'
import * as definitions from '@/server/repositories/attributeDefinitions'
import * as values from '@/server/repositories/attributeValues'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

function definitionInput(
  overrides: Partial<definitions.CreateAttributeDefinitionFields> = {},
): definitions.CreateAttributeDefinitionFields {
  return {
    key: 'campaign.roas',
    label: 'Campaign ROAS',
    type: AttributeType.NUMBER,
    scope: AttributeScope.PROJECT,
    source: AttributeSource.WEBHOOK,
    ...overrides,
  }
}

const projectSubject = {
  subjectType: AttributeSubjectType.PROJECT,
  subjectId: 'proj_1',
}

describe('repositories/attributes', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([AttributeDefinitionModel.syncIndexes(), AttributeValueModel.syncIndexes()])
  })

  describe('attributeDefinitions', () => {
    it('creates and finds by key; cross-org returns null', async () => {
      const orgCtx = ctx('org_1')
      const created = await definitions.createAttributeDefinition(orgCtx, definitionInput())

      expect(created.key).toBe('campaign.roas')
      expect(created.hasWebhookSecret).toBe(false)
      expect(created).not.toHaveProperty('webhookSecretHash')

      expect(await definitions.findAttributeDefinitionByKey(orgCtx, 'campaign.roas')).toEqual(
        created,
      )
      expect(
        await definitions.findAttributeDefinitionByKey(ctx('org_other'), 'campaign.roas'),
      ).toBeNull()
    })

    it('exposes hasWebhookSecret but never the hash on the domain object', async () => {
      const orgCtx = ctx('org_1')
      const created = await definitions.createAttributeDefinition(
        orgCtx,
        definitionInput({ webhookSecretHash: 'hashed-secret' }),
      )

      expect(created.hasWebhookSecret).toBe(true)
      expect(JSON.stringify(created)).not.toContain('hashed-secret')

      expect(await definitions.findWebhookSecretHash(orgCtx, 'campaign.roas')).toBe('hashed-secret')
      expect(await definitions.findWebhookSecretHash(ctx('org_other'), 'campaign.roas')).toBeNull()
    })

    it('lists with scope and source filters, paginated', async () => {
      const orgCtx = ctx('org_1')
      await definitions.createAttributeDefinition(orgCtx, definitionInput())
      await definitions.createAttributeDefinition(
        orgCtx,
        definitionInput({
          key: 'member.seniority',
          label: 'Seniority',
          type: AttributeType.STRING,
          scope: AttributeScope.MEMBER,
          source: AttributeSource.MANUAL,
        }),
      )
      await definitions.createAttributeDefinition(ctx('org_2'), definitionInput())

      const all = await definitions.listAttributeDefinitions(orgCtx)
      expect(all.total).toBe(2)

      const manual = await definitions.listAttributeDefinitions(orgCtx, {
        source: AttributeSource.MANUAL,
      })
      expect(manual.total).toBe(1)
      expect(manual.items[0]?.key).toBe('member.seniority')

      const memberScoped = await definitions.listAttributeDefinitions(orgCtx, {
        scope: AttributeScope.MEMBER,
      })
      expect(memberScoped.total).toBe(1)
    })

    it('updates label and rotates the secret; unknown key returns null', async () => {
      const orgCtx = ctx('org_1')
      await definitions.createAttributeDefinition(orgCtx, definitionInput())

      const updated = await definitions.updateAttributeDefinition(orgCtx, 'campaign.roas', {
        label: 'Return on ad spend',
        webhookSecretHash: 'rotated',
      })
      expect(updated?.label).toBe('Return on ad spend')
      expect(updated?.hasWebhookSecret).toBe(true)
      expect(await definitions.findWebhookSecretHash(orgCtx, 'campaign.roas')).toBe('rotated')

      expect(
        await definitions.updateAttributeDefinition(orgCtx, 'nope.missing', { label: 'x' }),
      ).toBeNull()
      expect(
        await definitions.updateAttributeDefinition(ctx('org_other'), 'campaign.roas', {
          label: 'x',
        }),
      ).toBeNull()
    })

    it('finds many by keys within the org only', async () => {
      const orgCtx = ctx('org_1')
      await definitions.createAttributeDefinition(orgCtx, definitionInput())
      await definitions.createAttributeDefinition(ctx('org_2'), definitionInput())

      const found = await definitions.findAttributeDefinitionsByKeys(orgCtx, [
        'campaign.roas',
        'missing.key',
      ])
      expect(found).toHaveLength(1)
      expect(await definitions.findAttributeDefinitionsByKeys(orgCtx, [])).toEqual([])
    })
  })

  describe('attributeValues', () => {
    it('upserts one row per (key, subject) and preserves observedAt from the source', async () => {
      const orgCtx = ctx('org_1')
      const first = await values.putAttributeValue(orgCtx, {
        key: 'campaign.roas',
        ...projectSubject,
        value: 2.4,
        observedAt: '2026-08-11T00:00:00.000Z',
        source: AttributeSource.WEBHOOK,
        ttlSec: 900,
      })

      expect(first.value).toBe(2.4)
      expect(first.observedAt).toBe('2026-08-11T00:00:00.000Z')

      const second = await values.putAttributeValue(orgCtx, {
        key: 'campaign.roas',
        ...projectSubject,
        value: 3.1,
        observedAt: '2026-08-11T01:00:00.000Z',
        source: AttributeSource.WEBHOOK,
      })

      expect(second.id).toBe(first.id)
      expect(second.value).toBe(3.1)
      expect(second.ttlSec).toBeNull()
      expect((await values.listAttributeValues(orgCtx)).total).toBe(1)
    })

    it('keeps string, boolean, and null values distinct from zero', async () => {
      const orgCtx = ctx('org_1')
      const asBoolean = await values.putAttributeValue(orgCtx, {
        key: 'campaign.active',
        ...projectSubject,
        value: false,
        source: AttributeSource.MANUAL,
      })
      const asNull = await values.putAttributeValue(orgCtx, {
        key: 'campaign.notes',
        ...projectSubject,
        value: null,
        source: AttributeSource.MANUAL,
      })

      expect(asBoolean.value).toBe(false)
      expect(asNull.value).toBeNull()
    })

    it('batch loads values for many keys and subjects in one call', async () => {
      const orgCtx = ctx('org_1')
      await values.putAttributeValue(orgCtx, {
        key: 'campaign.roas',
        ...projectSubject,
        value: 2.4,
        source: AttributeSource.WEBHOOK,
      })
      await values.putAttributeValue(orgCtx, {
        key: 'campaign.roas',
        subjectType: AttributeSubjectType.PROJECT,
        subjectId: 'proj_2',
        value: 1.1,
        source: AttributeSource.WEBHOOK,
      })
      await values.putAttributeValue(ctx('org_2'), {
        key: 'campaign.roas',
        ...projectSubject,
        value: 9.9,
        source: AttributeSource.WEBHOOK,
      })

      const loaded = await values.findAttributeValuesForSubjects(
        orgCtx,
        ['campaign.roas'],
        [projectSubject, { subjectType: AttributeSubjectType.PROJECT, subjectId: 'proj_2' }],
      )

      expect(loaded).toHaveLength(2)
      expect(loaded.map((entry) => entry.value).sort()).toEqual([1.1, 2.4])
      expect(await values.findAttributeValuesForSubjects(orgCtx, [], [projectSubject])).toEqual([])
    })

    it('finds and deletes a single value, scoped to the org', async () => {
      const orgCtx = ctx('org_1')
      await values.putAttributeValue(orgCtx, {
        key: 'campaign.roas',
        ...projectSubject,
        value: 2.4,
        source: AttributeSource.WEBHOOK,
      })

      expect(
        await values.findAttributeValue(orgCtx, 'campaign.roas', projectSubject),
      ).not.toBeNull()
      expect(
        await values.findAttributeValue(ctx('org_other'), 'campaign.roas', projectSubject),
      ).toBeNull()

      expect(
        await values.deleteAttributeValue(ctx('org_other'), 'campaign.roas', projectSubject),
      ).toBe(false)
      expect(await values.deleteAttributeValue(orgCtx, 'campaign.roas', projectSubject)).toBe(true)
      expect(await values.findAttributeValue(orgCtx, 'campaign.roas', projectSubject)).toBeNull()
    })
  })
})
