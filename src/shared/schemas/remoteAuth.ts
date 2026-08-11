import { z } from 'zod'
import { RemoteAuthResponseStatus } from '@/shared/enums/remoteAuthResponseStatus'
import { idSchema } from '@/shared/schemas/base'

/**
 * Airwallex remote-auth merchant object (wire shape, snake_case fields where
 * Airwallex uses them). Amounts elsewhere on the request are **major units**.
 */
export const remoteAuthMerchantSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  city: z.string().optional(),
  country: z.string().min(1),
  state: z.string().optional(),
  postcode: z.string().optional(),
  category_code: z.string().min(1),
})

/**
 * Airwallex remote authorization request — Version 2 wire shape.
 * `transaction_amount` / billing amounts are Airwallex **major units** (floats).
 * Convert to minor units inside the decide service before comparing to the
 * policy snapshot (which stores minor units). Never store these floats in Mongo.
 *
 * @see https://www.airwallex.com/docs/issuing/card-controls/remote-authorization/respond-to-authorization-requests
 */
export const remoteAuthInput = z.object({
  version: z.literal(2),
  account_id: z.string().min(1),
  card_id: z.string().min(1),
  card_transaction_event_id: z.string().min(1),
  card_transaction_id: z.string().min(1),
  card_transaction_lifecycle_id: z.string().min(1),
  transaction_type: z.string().min(1),
  transaction_category: z.string().optional(),
  transaction_date: z.string().min(1),
  /** Airwallex major units — not domain minor units. */
  transaction_amount: z.number(),
  transaction_currency: z.string().length(3),
  merchant: remoteAuthMerchantSchema,
  auth_code: z.string().optional(),
  masked_card_number: z.string().optional(),
  retrieval_ref: z.string().optional(),
  client_data: z.string().optional(),
  card_nickname: z.string().optional(),
  network_transaction_id: z.string().optional(),
  acquiring_institution_id: z.string().optional(),
  merchant_id: z.string().optional(),
  billing_order: z
    .array(
      z.object({
        currency: z.string().length(3),
        /** Airwallex major units. */
        amount: z.number(),
      }),
    )
    .optional(),
})

/**
 * Response Airwallex expects. `status_reason` is a free-form log string
 * (e.g. `policy_snapshot_unavailable` on fail-open).
 */
export const remoteAuthDecisionSchema = z.object({
  card_transaction_event_id: z.string().min(1),
  response_status: z.enum(RemoteAuthResponseStatus),
  status_reason: z.string().min(1).max(500),
})

/**
 * Demo simulator input — domain-friendly minor units.
 * Handler builds a Version-2 `remoteAuthInput` and calls the same decide path.
 */
export const simulatePurchaseInput = z.object({
  cardId: idSchema,
  /** Integer minor units. */
  amount: z.number().int().positive(),
  currency: z.string().length(3),
  merchant: z.object({
    name: z.string().min(1).max(500),
    mcc: z.string().min(1).max(8),
    country: z.string().min(1).max(3),
  }),
})
