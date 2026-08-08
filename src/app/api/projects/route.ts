import { projectContracts } from '@/shared/contracts/project'
import { created, ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { createProjectForOrg } from '@/server/services/projects/create'
import { listProjectsForOrg } from '@/server/services/projects/list'

/** List projects — `project.view`. */
export const GET = withAuth(
  withValidation(projectContracts.list.input, async (ctx, query) => {
    await requirePermission(ctx, 'project.view')
    return ok(await listProjectsForOrg(ctx, query))
  }),
)

/** Create DRAFT project — `project.create`. */
export const POST = withAuth(
  withValidation(projectContracts.create.input, async (ctx, input) => {
    await requirePermission(ctx, 'project.create')
    return created(await createProjectForOrg(ctx, input))
  }),
)
