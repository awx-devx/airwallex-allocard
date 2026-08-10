import { attributeContracts } from '@/shared/contracts/attribute'
import { ok, created } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import {
  createAttributeRegistryEntry,
  listAttributeRegistry,
} from '@/server/services/attributes/definitions'
import { Permission } from '@/shared/enums/permissions'

/** List custom attribute definitions — `control.edit`. */
export const GET = withAuth(
  withValidation(attributeContracts.list.input, async (ctx, query) => {
    await requirePermission(ctx, Permission.CONTROL_EDIT)
    return ok(await listAttributeRegistry(ctx, query))
  }),
)

/** Create a custom attribute definition — `control.edit`. */
export const POST = withAuth(
  withValidation(attributeContracts.create.input, async (ctx, input) => {
    await requirePermission(ctx, Permission.CONTROL_EDIT)
    return created(await createAttributeRegistryEntry(ctx, input))
  }),
)
