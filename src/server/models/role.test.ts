import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { Permission } from '@/shared/enums/permissions'
import { RoleModel } from '@/server/models/Role'
import { toDomain } from '@/server/models/base'
import type { Role } from '@/shared/types/role'

async function syncIndexes(): Promise<void> {
  await RoleModel.syncIndexes()
}

function minimalRole(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    key: 'project_manager',
    name: 'Project Manager',
    isTemplate: true,
    permissions: [Permission.PROJECT_VIEW, Permission.PROJECT_EDIT],
    ...overrides,
  }
}

describe('models/role', () => {
  useTestDb()

  beforeAll(async () => {
    await syncIndexes()
  })

  it('persists permissions and optional defaultScope', async () => {
    const validFrom = new Date('2026-01-01T00:00:00.000Z')
    const validTo = new Date('2026-12-31T00:00:00.000Z')
    const doc = await RoleModel.create(
      minimalRole({
        defaultScope: {
          level: AccessScopeLevel.WORKSTREAM,
          workstreamIds: ['ws_1'],
          validFrom,
          validTo,
        },
      }),
    )

    expect(doc.isTemplate).toBe(true)
    expect(doc.permissions).toEqual([Permission.PROJECT_VIEW, Permission.PROJECT_EDIT])
    expect(doc.defaultScope).toMatchObject({
      level: AccessScopeLevel.WORKSTREAM,
      workstreamIds: ['ws_1'],
    })
  })

  it('enforces unique (orgId, key)', async () => {
    await RoleModel.create(minimalRole({ key: 'viewer' }))

    await expect(
      RoleModel.create(minimalRole({ key: 'viewer', name: 'Other' })),
    ).rejects.toMatchObject({
      code: 11000,
    })
  })

  it('allows the same key in a different org', async () => {
    await RoleModel.create(minimalRole({ orgId: 'org_1', key: 'approver' }))
    const other = await RoleModel.create(minimalRole({ orgId: 'org_2', key: 'approver' }))

    expect(other.orgId).toBe('org_2')
    expect(other.key).toBe('approver')
  })

  it('requires orgId on queries (tenantScoped)', async () => {
    await expect(RoleModel.find({}).exec()).rejects.toThrow(/Tenant scope missing on Role\.find/)

    await RoleModel.create(minimalRole({ key: 'contractor' }))
    const docs = await RoleModel.find({ orgId: 'org_1' }).exec()
    expect(docs).toHaveLength(1)
  })

  it('embeds defaultScope without subdocument _id', async () => {
    const doc = await RoleModel.create(
      minimalRole({
        key: 'spender',
        defaultScope: {
          level: AccessScopeLevel.CARD,
          cardIds: ['card_1'],
        },
      }),
    )

    const json = doc.toJSON() as Record<string, unknown>
    const scope = json.defaultScope as Record<string, unknown>
    expect(scope).not.toHaveProperty('_id')
    expect(scope.level).toBe(AccessScopeLevel.CARD)
    expect(scope.cardIds).toEqual(['card_1'])
  })

  it('emits id and ISO dates via toJSON / toDomain', async () => {
    const validFrom = new Date('2026-03-01T00:00:00.000Z')
    const doc = await RoleModel.create(
      minimalRole({
        key: 'finance_administrator',
        name: 'Finance Administrator',
        defaultScope: {
          level: AccessScopeLevel.PROJECT,
          validFrom,
        },
      }),
    )

    const json = doc.toJSON() as Record<string, unknown>
    expect(json.id).toEqual(expect.any(String))
    expect(json).not.toHaveProperty('_id')
    expect(typeof json.createdAt).toBe('string')
    expect(typeof json.updatedAt).toBe('string')

    const scope = json.defaultScope as Record<string, unknown>
    expect(scope.validFrom).toBe('2026-03-01T00:00:00.000Z')

    const domain = toDomain<Role>(doc)
    expect(domain.id).toEqual(expect.any(String))
    expect(domain.key).toBe('finance_administrator')
    expect(domain.defaultScope?.validFrom).toBe('2026-03-01T00:00:00.000Z')
    expect(domain.permissions).toContain(Permission.PROJECT_VIEW)
  })
})
