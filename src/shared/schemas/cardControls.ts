import { z } from 'zod'
import { AllowedTransactionCount } from '@/shared/enums/allowedTransactionCount'
import { TransactionLimitInterval } from '@/shared/enums/transactionLimitInterval'
import { isoDateSchema } from '@/shared/schemas/base'

/**
 * Allowlist on the wire: `null` = unconstrained (omit at Airwallex).
 * Empty array is invalid → 422 (never push [] / null / absent as a lockdown).
 */
export const allowlistSchema = z.union([z.null(), z.array(z.string().min(1)).min(1)])

export const blockedTransactionUsageSchema = z.object({
  transactionScope: z.string().min(1),
  usageScope: z.string().min(1),
})

export const transactionLimitEntrySchema = z.object({
  interval: z.enum(TransactionLimitInterval),
  /** Integer minor units. */
  amount: z.number().int().nonnegative(),
})

export const transactionLimitsSchema = z.object({
  currency: z.string().length(3),
  limits: z.array(transactionLimitEntrySchema).min(1),
})

/**
 * Domain authorization controls (desiredControls / appliedControls).
 * CamelCase; maps to Airwallex `authorization_controls` in services/cards/controls.ts.
 * Amounts are integer minor units — convert to/from Airwallex major units only in controls.ts.
 */
export const cardControlsSchema = z.object({
  allowedTransactionCount: z.enum(AllowedTransactionCount),
  transactionLimits: transactionLimitsSchema,
  activeFrom: isoDateSchema.nullable(),
  activeTo: isoDateSchema.nullable(),
  allowedCurrencies: allowlistSchema,
  allowedMerchantCategories: allowlistSchema,
  allowedMerchantCountries: allowlistSchema,
  allowedMerchantBrands: allowlistSchema,
  blockedTransactionUsages: z.array(blockedTransactionUsageSchema),
})

/**
 * Create-time controls: service derives SINGLE/MULTIPLE from purpose when omitted
 * (VENDOR/ONE_TIME → SINGLE; SHARED/MEMBER → MULTIPLE).
 */
export const createCardControlsInput = cardControlsSchema
  .omit({ allowedTransactionCount: true })
  .extend({
    allowedTransactionCount: z.enum(AllowedTransactionCount).optional(),
  })

/**
 * Update controls — `allowedTransactionCount` cannot appear (immutable after create).
 */
export const updateCardControlsInput = cardControlsSchema
  .omit({ allowedTransactionCount: true })
  .partial()
  .refine(
    (value) =>
      value.transactionLimits !== undefined ||
      value.activeFrom !== undefined ||
      value.activeTo !== undefined ||
      value.allowedCurrencies !== undefined ||
      value.allowedMerchantCategories !== undefined ||
      value.allowedMerchantCountries !== undefined ||
      value.allowedMerchantBrands !== undefined ||
      value.blockedTransactionUsages !== undefined,
    { message: 'At least one controls field is required' },
  )
