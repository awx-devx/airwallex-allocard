import { connectDb } from '@/server/db/connect'
import type { OrgContext } from '@/server/http/types'
import { listActiveProjectMembersForUser } from '@/server/repositories/projectMembers'
import { listProjects } from '@/server/repositories/projects'
import { findRoleById } from '@/server/repositories/roles'
import { computeEffectivePermissions } from '@/server/services/access/computeEffectivePermissions'
import { ALL_PERMISSIONS } from '@/shared/constants/roleTemplates'
import { AccessScopeLevel } from '@/shared/enums/accessScopeLevel'
import { OrgRole } from '@/shared/enums/orgRole'
import type { MePermissions } from '@/shared/types/mePermissions'
import type { Project } from '@/shared/types/project'

/**
 * Effective permissions per project for the caller — feeds client `can()`.
 * UX only, never a control.
 *
 * OWNER/ADMIN: every org project with full permissions and PROJECT scope.
 * MEMBER: active project memberships, recomputed via computeEffectivePermissions.
 */
async function listAllOrgProjects(ctx: OrgContext): Promise<Project[]> {
  const pageSize = 100
  const first = await listProjects(ctx, { page: 1, pageSize })
  const items = [...first.items]
  const totalPages = Math.max(1, Math.ceil(first.total / pageSize))
  for (let page = 2; page <= totalPages; page += 1) {
    const next = await listProjects(ctx, { page, pageSize })
    items.push(...next.items)
  }
  return items
}

export async function getMePermissions(ctx: OrgContext): Promise<MePermissions> {
  await connectDb()

  if (ctx.orgRole === OrgRole.OWNER || ctx.orgRole === OrgRole.ADMIN) {
    const projects = await listAllOrgProjects(ctx)
    return {
      projects: projects.map((project) => ({
        projectId: project.id,
        permissions: [...ALL_PERMISSIONS],
        scope: { level: AccessScopeLevel.PROJECT },
      })),
    }
  }

  const memberships = await listActiveProjectMembersForUser(ctx, ctx.userId)
  const now = new Date()
  const projects: MePermissions['projects'] = []

  for (const membership of memberships) {
    const role = await findRoleById(ctx, membership.roleId)
    if (!role) {
      continue
    }
    const effective = computeEffectivePermissions({
      orgRole: ctx.orgRole,
      role,
      scope: membership.scope,
      now,
    })
    projects.push({
      projectId: membership.projectId,
      permissions: effective.permissions,
      scope: effective.scope,
    })
  }

  return { projects }
}
