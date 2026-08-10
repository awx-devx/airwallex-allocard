import { attributeContracts } from '@/shared/contracts/attribute'
import { AppError } from '@/server/http/errors'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { getRouteParams, withRouteParams } from '@/server/http/routeParams'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import { updateAttributeRegistryEntry } from '@/server/services/attributes/definitions'
import { Permission } from '@/shared/enums/permissions'

function requireKey(req: Request): string {
  const { key } = getRouteParams(req)
  if (!key) {
    throw AppError.notFound()
  }
  return decodeURIComponent(key)
}

/** Update a custom attribute definition — `control.edit`. */
export const PATCH = withRouteParams(
  withAuth(
    withValidation(attributeContracts.update.input, async (ctx, input, req) => {
      await requirePermission(ctx, Permission.CONTROL_EDIT)
      return ok(await updateAttributeRegistryEntry(ctx, requireKey(req), input))
    }),
  ),
)
