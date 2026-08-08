import { connectDb } from '@/server/db/connect'
import type { OrgContext } from '@/server/http/types'
import { listProjects } from '@/server/repositories/projects'
import type { ListProjectsQuery, ProjectList } from '@/shared/types/project'

/** List projects in the caller's org with filters, pagination, and sort. */
export async function listProjectsForOrg(
  ctx: OrgContext,
  query: ListProjectsQuery,
): Promise<ProjectList> {
  await connectDb()
  return listProjects(ctx, {
    status: query.status,
    ownerId: query.ownerId,
    costCentre: query.costCentre,
    page: query.page,
    pageSize: query.pageSize,
    sort: query.sort,
  })
}
