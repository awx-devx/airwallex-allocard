import { connectDb } from '@/server/db/connect'
import type { OrgContext } from '@/server/http/types'
import { listRoles } from '@/server/repositories/roles'
import type { Role } from '@/shared/types/role'

/** List templates and custom roles for the org. */
export async function listRolesForOrg(ctx: OrgContext): Promise<Role[]> {
  await connectDb()
  return listRoles(ctx)
}
