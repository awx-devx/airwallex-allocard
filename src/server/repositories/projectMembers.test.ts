import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import type { OrgContext } from '@/server/http/types'
import * as projectMembers from '@/server/repositories/projectMembers'

function ctx(orgId: string, userId = 'user_1'): OrgContext {
  return { orgId, userId, orgRole: OrgRole.OWNER }
}

function addInput(
  overrides: Partial<projectMembers.AddProjectMemberInput> = {},
): projectMembers.AddProjectMemberInput {
  return {
    projectId: 'proj_1',
    userId: 'user_a',
    roleId: 'role_1',
    scope: { level: AccessScopeLevel.PROJECT },
    effectivePermissions: [Permission.PROJECT_VIEW],
    addedBy: 'admin_1',
    ...overrides,
  }
}

describe('repositories/projectMembers', () => {
  useTestDb()

  beforeAll(async () => {
    await ProjectMemberModel.syncIndexes()
  })

  it('adds and finds active member by project+user within org', async () => {
    const orgCtx = ctx('org_1')
    const created = await projectMembers.addProjectMember(
      orgCtx,
      addInput({
        scope: {
          level: AccessScopeLevel.CARD,
          cardIds: ['card_x'],
          validTo: '2026-12-31T00:00:00.000Z',
        },
        effectivePermissions: [Permission.PROJECT_VIEW, Permission.PAYMENT_MAKE],
      }),
    )

    expect(created.removedAt).toBeNull()
    expect(created.scope.validTo).toBe('2026-12-31T00:00:00.000Z')
    expect(created.effectivePermissions).toEqual([Permission.PROJECT_VIEW, Permission.PAYMENT_MAKE])

    const found = await projectMembers.findActiveProjectMember(orgCtx, 'proj_1', 'user_a')
    expect(found).toEqual(created)
    expect(
      await projectMembers.findActiveProjectMember(ctx('org_other'), 'proj_1', 'user_a'),
    ).toBeNull()
  })

  it('enforces unique active (project, user); allows re-add after soft-remove', async () => {
    const orgCtx = ctx('org_unique')
    await projectMembers.addProjectMember(orgCtx, addInput({ userId: 'user_dup' }))

    await expect(
      projectMembers.addProjectMember(orgCtx, addInput({ userId: 'user_dup', roleId: 'role_2' })),
    ).rejects.toMatchObject({ code: 11000 })

    const removed = await projectMembers.softRemoveProjectMember(orgCtx, 'proj_1', 'user_dup')
    expect(removed?.removedAt).toEqual(expect.any(String))
    expect(await projectMembers.findActiveProjectMember(orgCtx, 'proj_1', 'user_dup')).toBeNull()

    const readded = await projectMembers.addProjectMember(
      orgCtx,
      addInput({
        userId: 'user_dup',
        roleId: 'role_new',
        effectivePermissions: [Permission.CARD_VIEW],
      }),
    )
    expect(readded.removedAt).toBeNull()
    expect(readded.roleId).toBe('role_new')
  })

  it('lists active members for a project and by role', async () => {
    const orgCtx = ctx('org_list')
    await projectMembers.addProjectMember(
      orgCtx,
      addInput({ userId: 'u1', roleId: 'role_pm', projectId: 'proj_a' }),
    )
    await projectMembers.addProjectMember(
      orgCtx,
      addInput({ userId: 'u2', roleId: 'role_viewer', projectId: 'proj_a' }),
    )
    await projectMembers.addProjectMember(
      orgCtx,
      addInput({ userId: 'u3', roleId: 'role_pm', projectId: 'proj_b' }),
    )
    await projectMembers.softRemoveProjectMember(orgCtx, 'proj_a', 'u2')

    const onProject = await projectMembers.listActiveProjectMembers(orgCtx, 'proj_a')
    expect(onProject.map((m) => m.userId)).toEqual(['u1'])

    const byRole = await projectMembers.listActiveProjectMembersByRole(orgCtx, 'role_pm')
    expect(byRole.map((m) => m.userId).sort()).toEqual(['u1', 'u3'])
    expect(await projectMembers.countActiveProjectMembersByRole(orgCtx, 'role_pm')).toBe(2)
    expect(await projectMembers.countActiveProjectMembersByRole(orgCtx, 'role_viewer')).toBe(0)
  })

  it('updates role/scope and rewrites effectivePermissions wholesale', async () => {
    const orgCtx = ctx('org_upd')
    const created = await projectMembers.addProjectMember(
      orgCtx,
      addInput({
        userId: 'user_upd',
        effectivePermissions: [Permission.PROJECT_VIEW],
      }),
    )

    const updated = await projectMembers.updateProjectMember(orgCtx, created.id, {
      roleId: 'role_spender',
      scope: { level: AccessScopeLevel.OWN },
      effectivePermissions: [Permission.PROJECT_VIEW, Permission.PAYMENT_MAKE],
    })

    expect(updated?.roleId).toBe('role_spender')
    expect(updated?.scope.level).toBe(AccessScopeLevel.OWN)
    expect(updated?.effectivePermissions).toEqual([
      Permission.PROJECT_VIEW,
      Permission.PAYMENT_MAKE,
    ])

    const rewritten = await projectMembers.rewriteEffectivePermissions(orgCtx, created.id, [
      Permission.CARD_VIEW,
    ])
    expect(rewritten?.effectivePermissions).toEqual([Permission.CARD_VIEW])
  })

  it('rewrites effectivePermissions for many members holding a role', async () => {
    const orgCtx = ctx('org_bulk')
    const a = await projectMembers.addProjectMember(
      orgCtx,
      addInput({ userId: 'bulk_a', roleId: 'role_shared', projectId: 'p1' }),
    )
    const b = await projectMembers.addProjectMember(
      orgCtx,
      addInput({ userId: 'bulk_b', roleId: 'role_shared', projectId: 'p2' }),
    )

    const written = await projectMembers.rewriteEffectivePermissionsForMembers(orgCtx, [
      { memberId: a.id, effectivePermissions: [Permission.BUDGET_VIEW] },
      { memberId: b.id, effectivePermissions: [Permission.BUDGET_VIEW, Permission.REPORT_EXPORT] },
    ])
    expect(written).toBe(2)

    expect(
      (await projectMembers.findProjectMemberById(orgCtx, a.id))?.effectivePermissions,
    ).toEqual([Permission.BUDGET_VIEW])
    expect(
      (await projectMembers.findProjectMemberById(orgCtx, b.id))?.effectivePermissions,
    ).toEqual([Permission.BUDGET_VIEW, Permission.REPORT_EXPORT])
  })

  it('soft-remove is a no-op when already removed or cross-org', async () => {
    const orgCtx = ctx('org_rm')
    await projectMembers.addProjectMember(orgCtx, addInput({ userId: 'gone' }))
    await projectMembers.softRemoveProjectMember(orgCtx, 'proj_1', 'gone')

    expect(await projectMembers.softRemoveProjectMember(orgCtx, 'proj_1', 'gone')).toBeNull()
    expect(
      await projectMembers.softRemoveProjectMember(ctx('org_other'), 'proj_1', 'gone'),
    ).toBeNull()
  })
})
