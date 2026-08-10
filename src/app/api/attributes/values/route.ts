import { attributeContracts } from '@/shared/contracts/attribute'
import { ok } from '@/server/http/respond'
import { requirePermission } from '@/server/http/requirePermission'
import { withAuth } from '@/server/http/withAuth'
import { withValidation } from '@/server/http/withValidation'
import {
  listStoredAttributeValues,
  putManualAttributeValue,
} from '@/server/services/attributes/values'
import { Permission } from '@/shared/enums/permissions'

/** List stored attribute values — `control.edit`. */
export const GET = withAuth(
  withValidation(attributeContracts.listValues.input, async (ctx, query) => {
    await requirePermission(ctx, Permission.CONTROL_EDIT)
    return ok(await listStoredAttributeValues(ctx, query))
  }),
)

/** Set a MANUAL attribute value — `control.edit`. */
export const PUT = withAuth(
  withValidation(attributeContracts.putValue.input, async (ctx, input) => {
    await requirePermission(ctx, Permission.CONTROL_EDIT)
    return ok(await putManualAttributeValue(ctx, input))
  }),
)
