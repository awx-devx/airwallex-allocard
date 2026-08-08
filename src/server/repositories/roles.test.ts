import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { RoleModel } from '@/server/models/Role'
import type { OrgContext } from '@/server/http/types'
import * as roles from '@/server/repositories/roles'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

describe('repositories/roles', () => {
  useTestDb()

  beforeAll(async () => {
    await RoleModel.syncIndexes()
  })

  it('creates and finds by id / key within org', async () => {
    const orgCtx = ctx('org_1')
    const created = await roles.createRole(orgCtx, {
      key: 'project_manager',
      name: 'Project Manager',
      permissions: [Permission.PROJECT_VIEW, Permission.PROJECT_EDIT],
      isTemplate: true,
      defaultScope: {
        level: AccessScopeLevel.WORKSTREAM,
        workstreamIds: ['ws_1'],
        validFrom: '2026-01-01T00:00:00.000Z',
      },
    })

    expect(created.orgId).toBe('org_1')
    expect(created.isTemplate).toBe(true)
    expect(created.defaultScope?.validFrom).toBe('2026-01-01T00:00:00.000Z')

    expect(await roles.findRoleById(orgCtx, created.id)).toEqual(created)
    expect(await roles.findRoleByKey(orgCtx, 'project_manager')).toEqual(created)
    expect(await roles.findRoleById(ctx('org_other'), created.id)).toBeNull()
    expect(await roles.findRoleById(orgCtx, 'not-an-id')).toBeNull()
  })

  it('rejects duplicate key in the same org; allows it in another', async () => {
    await roles.createRole(ctx('org_1'), {
      key: 'viewer',
      name: 'Viewer',
      permissions: [Permission.PROJECT_VIEW],
    })

    await expect(
      roles.createRole(ctx('org_1'), {
        key: 'viewer',
        name: 'Other',
        permissions: [Permission.PROJECT_VIEW],
      }),
    ).rejects.toMatchObject({ code: 11000 })

    const other = await roles.createRole(ctx('org_2'), {
      key: 'viewer',
      name: 'Viewer',
      permissions: [Permission.PROJECT_VIEW],
    })
    expect(other.orgId).toBe('org_2')
  })

  it('lists templates and custom roles', async () => {
    const orgCtx = ctx('org_list')
    await roles.createRole(orgCtx, {
      key: 'custom_a',
      name: 'Custom A',
      permissions: [Permission.PROJECT_VIEW],
      isTemplate: false,
    })
    await roles.createRole(orgCtx, {
      key: 'tmpl_b',
      name: 'Template B',
      permissions: [Permission.PROJECT_VIEW],
      isTemplate: true,
    })
    await roles.createRole(orgCtx, {
      key: 'tmpl_a',
      name: 'Template A',
      permissions: [Permission.PROJECT_VIEW],
      isTemplate: true,
    })

    const listed = await roles.listRoles(orgCtx)
    expect(listed.map((r) => r.key)).toEqual(['tmpl_a', 'tmpl_b', 'custom_a'])
  })

  it('updates fields and clears defaultScope', async () => {
    const orgCtx = ctx('org_upd')
    const created = await roles.createRole(orgCtx, {
      key: 'approver',
      name: 'Approver',
      permissions: [Permission.REQUEST_APPROVE],
      defaultScope: { level: AccessScopeLevel.PROJECT },
    })

    const updated = await roles.updateRole(orgCtx, created.id, {
      name: 'Senior Approver',
      permissions: [Permission.REQUEST_APPROVE, Permission.PROJECT_VIEW],
      defaultScope: null,
    })

    expect(updated?.name).toBe('Senior Approver')
    expect(updated?.permissions).toEqual([Permission.REQUEST_APPROVE, Permission.PROJECT_VIEW])
    expect(updated?.defaultScope).toBeUndefined()
  })

  it('deletes within org only', async () => {
    const orgCtx = ctx('org_del')
    const created = await roles.createRole(orgCtx, {
      key: 'temp',
      name: 'Temp',
      permissions: [Permission.PROJECT_VIEW],
    })

    expect(await roles.deleteRole(ctx('org_other'), created.id)).toBe(false)
    expect(await roles.deleteRole(orgCtx, created.id)).toBe(true)
    expect(await roles.findRoleById(orgCtx, created.id)).toBeNull()
  })
})
