import { attributeContracts } from '@/shared/contracts/attribute'
import { ok } from '@/server/http/respond'
import { withPublicValidation } from '@/server/http/withPublic'
import {
  ATTRIBUTE_SECRET_HEADER,
  ingestWebhookAttributeValue,
} from '@/server/services/attributes/values'

/**
 * WEBHOOK ingest — auth is `x-allocard-attribute-secret`, not a session.
 * Org is recovered from the definition matched by key + secret hash.
 */
export const POST = withPublicValidation(attributeContracts.ingest.input, async (input, req) =>
  ok(await ingestWebhookAttributeValue(input, req.headers.get(ATTRIBUTE_SECRET_HEADER))),
)
