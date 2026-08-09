import { beforeAll, describe, expect, it } from 'vitest'
import { useTestDb } from '../../../test/helpers/db'
import { requirePermission, requiresProjectSubject } from '@/server/http/requirePermission'
import type { OrgContext } from '@/server/http/types'
import { ProjectMemberModel } from '@/server/models/ProjectMember'
import { RoleModel } from '@/server/models/Role'
import * as projectMembers from '@/server/repositories/projectMembers'
import * as roles from '@/server/repositories/roles'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { ErrorCode } from '@/shared/enums/errors'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'

function ctx(orgRole: OrgRole, overrides: Partial<OrgContext> = {}): OrgContext {
  return {
    orgId: 'org_1',
    userId: 'user_member',
    orgRole,
    ...overrides,
  }
}

describe('http/requirePermission', () => {
  useTestDb()

  beforeAll(async () => {
    await Promise.all([RoleModel.syncIndexes(), ProjectMemberModel.syncIndexes()])
  })

  it('documents OWNER/ADMIN short-circuit with full access', async () => {
    await expect(
      requirePermission(ctx(OrgRole.OWNER), Permission.CARD_MANAGE, {
        projectId: 'missing',
        cardId: 'card_x',
      }),
    ).resolves.toBeUndefined()

    await expect(requirePermission(ctx(OrgRole.ADMIN), 'org.manage')).resolves.toBeUndefined()
  })

  it('denies MEMBER org-only permissions; project.create needs a membership grant', async () => {
    await expect(requirePermission(ctx(OrgRole.MEMBER), 'org.manage')).rejects.toMatchObject({
      code: ErrorCode.PERMISSION_DENIED,
    })
    await expect(
      requirePermission(ctx(OrgRole.MEMBER), Permission.PROJECT_CREATE),
    ).rejects.toMatchObject({ code: ErrorCode.PERMISSION_DENIED })
  })

  it('rejects resource-scoped permissions when projectId is omitted', async () => {
    expect(requiresProjectSubject(Permission.CARD_MANAGE)).toBe(true)
    expect(requiresProjectSubject(Permission.PROJECT_VIEW)).toBe(false)
    expect(requiresProjectSubject(Permission.PROJECT_CREATE)).toBe(false)
    expect(requiresProjectSubject(Permission.MEMBER_VIEW)).toBe(false)
    expect(requiresProjectSubject(Permission.BUDGET_EDIT)).toBe(false)
    expect(requiresProjectSubject('org.manage')).toBe(false)

    await expect(
      requirePermission(ctx(OrgRole.MEMBER), Permission.CARD_MANAGE),
    ).rejects.toMatchObject({ code: ErrorCode.PERMISSION_DENIED })
  })

  it('allows MEMBER org-wide capability when any membership grants it', async () => {
    const orgCtx = ctx(OrgRole.OWNER, { userId: 'admin_1' })
    const role = await roles.createRole(orgCtx, {
      key: 'viewer_wide',
      name: 'Viewer Wide',
      permissions: [Permission.PROJECT_VIEW, Permission.MEMBER_VIEW],
    })

    await projectMembers.addProjectMember(orgCtx, {
      projectId: 'proj_wide',
      userId: 'user_member',
      roleId: role.id,
      scope: { level: AccessScopeLevel.PROJECT },
      effectivePermissions: [...role.permissions],
      addedBy: 'admin_1',
    })

    const memberCtx = ctx(OrgRole.MEMBER)
    await expect(requirePermission(memberCtx, Permission.MEMBER_VIEW)).resolves.toBeUndefined()
    await expect(requirePermission(memberCtx, Permission.PROJECT_VIEW)).resolves.toBeUndefined()
    await expect(requirePermission(memberCtx, Permission.ROLE_ASSIGN)).rejects.toMatchObject({
      code: ErrorCode.PERMISSION_DENIED,
    })
  })

  it('allows MEMBER when ProjectMember grants the permission under PROJECT scope', async () => {
    const orgCtx = ctx(OrgRole.OWNER, { userId: 'admin_1' })
    const role = await roles.createRole(orgCtx, {
      key: 'contractor',
      name: 'Contractor',
      permissions: [
        Permission.PROJECT_VIEW,
        Permission.CARD_VIEW,
        Permission.CARD_VIEW_DETAILS,
        Permission.PAYMENT_MAKE,
        Permission.TRANSACTION_VIEW,
      ],
    })

    await projectMembers.addProjectMember(orgCtx, {
      projectId: 'proj_1',
      userId: 'user_member',
      roleId: role.id,
      scope: { level: AccessScopeLevel.PROJECT },
      effectivePermissions: [...role.permissions],
      addedBy: 'admin_1',
    })

    const memberCtx = ctx(OrgRole.MEMBER)
    await expect(
      requirePermission(memberCtx, Permission.PAYMENT_MAKE, { projectId: 'proj_1' }),
    ).resolves.toBeUndefined()

    await expect(
      requirePermission(memberCtx, Permission.CARD_MANAGE, { projectId: 'proj_1' }),
    ).rejects.toMatchObject({ code: ErrorCode.PERMISSION_DENIED })
  })

  it('CARD scope permits card X and denies card Y', async () => {
    const orgCtx = ctx(OrgRole.OWNER, { userId: 'admin_1' })
    const role = await roles.createRole(orgCtx, {
      key: 'card_holder',
      name: 'Card Holder',
      permissions: [Permission.CARD_MANAGE, Permission.PROJECT_VIEW],
    })

    await projectMembers.addProjectMember(orgCtx, {
      projectId: 'proj_card',
      userId: 'user_member',
      roleId: role.id,
      scope: { level: AccessScopeLevel.CARD, cardIds: ['card_x'] },
      effectivePermissions: [...role.permissions],
      addedBy: 'admin_1',
    })

    const memberCtx = ctx(OrgRole.MEMBER)
    await expect(
      requirePermission(memberCtx, Permission.CARD_MANAGE, {
        projectId: 'proj_card',
        cardId: 'card_x',
      }),
    ).resolves.toBeUndefined()

    await expect(
      requirePermission(memberCtx, Permission.CARD_MANAGE, {
        projectId: 'proj_card',
        cardId: 'card_y',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.PERMISSION_DENIED })
  })

  it('OWN scope permits the caller’s own subject and denies others', async () => {
    const orgCtx = ctx(OrgRole.OWNER, { userId: 'admin_1' })
    const role = await roles.createRole(orgCtx, {
      key: 'own_viewer',
      name: 'Own Viewer',
      permissions: [Permission.TRANSACTION_VIEW, Permission.PROJECT_VIEW],
    })

    await projectMembers.addProjectMember(orgCtx, {
      projectId: 'proj_own',
      userId: 'user_member',
      roleId: role.id,
      scope: { level: AccessScopeLevel.OWN },
      effectivePermissions: [...role.permissions],
      addedBy: 'admin_1',
    })

    const memberCtx = ctx(OrgRole.MEMBER)
    await expect(
      requirePermission(memberCtx, Permission.TRANSACTION_VIEW, {
        projectId: 'proj_own',
        userId: 'user_member',
      }),
    ).resolves.toBeUndefined()

    await expect(
      requirePermission(memberCtx, Permission.TRANSACTION_VIEW, {
        projectId: 'proj_own',
        userId: 'user_other',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.PERMISSION_DENIED })
  })

  it('denies when the access scope time window has expired', async () => {
    const orgCtx = ctx(OrgRole.OWNER, { userId: 'admin_1' })
    const role = await roles.createRole(orgCtx, {
      key: 'temp',
      name: 'Temp',
      permissions: [Permission.PROJECT_VIEW],
    })

    await projectMembers.addProjectMember(orgCtx, {
      projectId: 'proj_expired',
      userId: 'user_member',
      roleId: role.id,
      scope: {
        level: AccessScopeLevel.PROJECT,
        validTo: '2020-01-01T00:00:00.000Z',
      },
      effectivePermissions: [Permission.PROJECT_VIEW],
      addedBy: 'admin_1',
    })

    await expect(
      requirePermission(
        ctx(OrgRole.MEMBER),
        Permission.PROJECT_VIEW,
        { projectId: 'proj_expired' },
        new Date('2026-06-15T00:00:00.000Z'),
      ),
    ).rejects.toMatchObject({ code: ErrorCode.PERMISSION_DENIED })
  })

  it('denies when the caller has no active project membership', async () => {
    await expect(
      requirePermission(ctx(OrgRole.MEMBER), Permission.PROJECT_VIEW, {
        projectId: 'proj_nobody',
      }),
    ).rejects.toMatchObject({ code: ErrorCode.PERMISSION_DENIED })
  })
})
