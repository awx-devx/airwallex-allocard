import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { Permission } from '@/shared/enums/permissions'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { toDomain } from '@/server/models/base'
import type { ProjectMember } from '@/shared/types/projectMember'

async function syncIndexes(): Promise<void> {
  await ProjectMemberModel.syncIndexes()
}

function minimalMember(overrides: Record<string, unknown> = {}) {
  return {
    orgId: 'org_1',
    projectId: 'proj_1',
    userId: 'user_1',
    roleId: 'role_1',
    scope: { level: AccessScopeLevel.PROJECT },
    effectivePermissions: [Permission.PROJECT_VIEW],
    addedBy: 'admin_1',
    addedAt: new Date('2026-02-01T00:00:00.000Z'),
    ...overrides,
  }
}

describe('models/projectMember', () => {
  useTestDb()

  beforeAll(async () => {
    await syncIndexes()
  })

  it('defaults removedAt to null and embeds scope + effectivePermissions', async () => {
    const doc = await ProjectMemberModel.create(minimalMember())

    expect(doc.removedAt).toBeNull()
    expect(doc.scope.level).toBe(AccessScopeLevel.PROJECT)
    expect(doc.effectivePermissions).toEqual([Permission.PROJECT_VIEW])
  })

  it('enforces unique (orgId, projectId, userId) while removedAt is null', async () => {
    await ProjectMemberModel.create(minimalMember())

    await expect(
      ProjectMemberModel.create(minimalMember({ roleId: 'role_2' })),
    ).rejects.toMatchObject({
      code: 11000,
    })
  })

  it('allows re-add after soft-remove (partial unique index)', async () => {
    const first = await ProjectMemberModel.create(minimalMember({ userId: 'user_readd' }))
    first.removedAt = new Date('2026-04-01T00:00:00.000Z')
    await first.save()

    const second = await ProjectMemberModel.create(
      minimalMember({
        userId: 'user_readd',
        roleId: 'role_new',
        effectivePermissions: [Permission.CARD_VIEW],
      }),
    )

    expect(second.removedAt).toBeNull()
    expect(second.roleId).toBe('role_new')

    const rows = await ProjectMemberModel.find({
      orgId: 'org_1',
      projectId: 'proj_1',
      userId: 'user_readd',
    }).exec()
    expect(rows).toHaveLength(2)
  })

  it('allows the same user on a different project', async () => {
    await ProjectMemberModel.create(minimalMember({ projectId: 'proj_a', userId: 'user_shared' }))
    const other = await ProjectMemberModel.create(
      minimalMember({ projectId: 'proj_b', userId: 'user_shared' }),
    )

    expect(other.projectId).toBe('proj_b')
  })

  it('requires orgId on queries (tenantScoped)', async () => {
    await expect(ProjectMemberModel.find({}).exec()).rejects.toThrow(
      /Tenant scope missing on ProjectMember\.find/,
    )

    await ProjectMemberModel.create(minimalMember({ userId: 'user_tenant' }))
    const docs = await ProjectMemberModel.find({ orgId: 'org_1' }).exec()
    expect(docs.length).toBeGreaterThanOrEqual(1)
  })

  it('embeds scope without subdocument _id', async () => {
    const doc = await ProjectMemberModel.create(
      minimalMember({
        userId: 'user_scope',
        scope: {
          level: AccessScopeLevel.WORKSTREAM,
          workstreamIds: ['ws_1', 'ws_2'],
        },
      }),
    )

    const json = doc.toJSON() as Record<string, unknown>
    const scope = json.scope as Record<string, unknown>
    expect(scope).not.toHaveProperty('_id')
    expect(scope.workstreamIds).toEqual(['ws_1', 'ws_2'])
  })

  it('emits id and ISO dates via toJSON / toDomain', async () => {
    const validTo = new Date('2026-06-30T00:00:00.000Z')
    const doc = await ProjectMemberModel.create(
      minimalMember({
        userId: 'user_dates',
        scope: {
          level: AccessScopeLevel.OWN,
          validTo,
        },
        addedAt: new Date('2026-02-15T12:00:00.000Z'),
      }),
    )

    const json = doc.toJSON() as Record<string, unknown>
    expect(json.id).toEqual(expect.any(String))
    expect(json).not.toHaveProperty('_id')
    expect(json.addedAt).toBe('2026-02-15T12:00:00.000Z')
    expect(json.removedAt).toBeNull()

    const scope = json.scope as Record<string, unknown>
    expect(scope.validTo).toBe('2026-06-30T00:00:00.000Z')

    const domain = toDomain<ProjectMember>(doc)
    expect(domain.id).toEqual(expect.any(String))
    expect(domain.addedAt).toBe('2026-02-15T12:00:00.000Z')
    expect(domain.scope.validTo).toBe('2026-06-30T00:00:00.000Z')
    expect(domain.effectivePermissions).toEqual([Permission.PROJECT_VIEW])
  })
})
