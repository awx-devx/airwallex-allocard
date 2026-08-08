import { connectDb } from '@/server/db/connect'
import type { OrgContext } from '@/server/http/types'
import { projectIdsGrantingPermission } from '@/server/http/requirePermission'
import { listProjects } from '@/server/repositories/projects'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import type { ListProjectsQuery, ProjectList } from '@/shared/types/project'

/** List projects in the caller's org with filters, pagination, and sort. */
export async function listProjectsForOrg(
  ctx: OrgContext,
  query: ListProjectsQuery,
): Promise<ProjectList> {
  await connectDb()

  const elevated = ctx.orgRole === OrgRole.OWNER || ctx.orgRole === OrgRole.ADMIN
  const ids = elevated
    ? undefined
    : await projectIdsGrantingPermission(ctx, Permission.PROJECT_VIEW)

  return listProjects(ctx, {
    status: query.status,
    ownerId: query.ownerId,
    costCentre: query.costCentre,
    ids,
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
  })
}
