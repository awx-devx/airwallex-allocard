import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../../test/helpers/db'
import { ROLE_TEMPLATES } from '@/shared/constants/roleTemplates'
import { Permission } from '@/shared/enums/permissions'
import { RoleModel } from '@/server/models/Role'
import { seedRoleTemplates } from '@/server/services/organizations/seedRoleTemplates'

describe('services/seedRoleTemplates', () => {
  useTestDb()

  beforeAll(async () => {
    await RoleModel.syncIndexes()
  })

  it('seeds all seven templates as isTemplate copies for the org', async () => {
    await seedRoleTemplates('org_1')

    const roles = await RoleModel.find({ orgId: 'org_1' }).sort({ key: 1 }).exec()
    expect(roles).toHaveLength(ROLE_TEMPLATES.length)
    expect(roles.every((role) => role.isTemplate)).toBe(true)

    const byKey = new Map(roles.map((role) => [role.key, role]))
    for (const template of ROLE_TEMPLATES) {
      const role = byKey.get(template.key)
      expect(role).toBeDefined()
      expect(role!.name).toBe(template.name)
      expect(role!.permissions).toEqual([...template.permissions])
    }
  })

  it('is idempotent on (orgId, key) and does not overwrite edits', async () => {
    await seedRoleTemplates('org_1')

    await RoleModel.updateOne(
      { orgId: 'org_1', key: 'viewer' },
      { $set: { name: 'Custom Viewer', permissions: [Permission.PROJECT_VIEW] } },
    ).exec()

    await seedRoleTemplates('org_1')

    const roles = await RoleModel.find({ orgId: 'org_1' }).exec()
    expect(roles).toHaveLength(ROLE_TEMPLATES.length)

    const viewer = roles.find((role) => role.key === 'viewer')
    expect(viewer?.name).toBe('Custom Viewer')
    expect(viewer?.permissions).toEqual([Permission.PROJECT_VIEW])
  })

  it('seeds independent per-org copies', async () => {
    await seedRoleTemplates('org_a')
    await seedRoleTemplates('org_b')

    const a = await RoleModel.find({ orgId: 'org_a' }).exec()
    const b = await RoleModel.find({ orgId: 'org_b' }).exec()
    expect(a).toHaveLength(ROLE_TEMPLATES.length)
    expect(b).toHaveLength(ROLE_TEMPLATES.length)
    expect(a.map((role) => role.id).sort()).not.toEqual(b.map((role) => role.id).sort())
  })

  it('includes every Permission on finance_administrator', async () => {
    await seedRoleTemplates('org_1')

    const finance = await RoleModel.findOne({ orgId: 'org_1', key: 'finance_administrator' }).exec()
    expect(finance).not.toBeNull()
    expect(new Set(finance!.permissions)).toEqual(new Set(Object.values(Permission)))
  })
})
