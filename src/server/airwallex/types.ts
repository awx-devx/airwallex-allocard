/**
 * Airwallex Issuing wire types (snake_case). Domain ↔ wire mapping lives in
 * services/cards/controls.ts — amounts here are Airwallex major units.
 */

import type { AirwallexRequestOptions } from '@/server/airwallex/http'

/** Minimal client surface used by domain API modules (avoids circular imports). */
export type AirwallexRequester = {
  readonly accountId: string | null
  request<T>(opts: Omit<AirwallexRequestOptions, 'accountId'>): Promise<T>
}

export type AirwallexCardMetadata = {
  orgId: string
  projectId?: string
  cardDocId?: string
  ruleId?: string
  [key: string]: string | undefined
}

export type AirwallexBlockedTransactionUsage = {
  transaction_scope: string
  usage_scope: string
}

export type AirwallexTransactionLimit = {
  interval: string
  /** Major currency units. */
  amount: number
}

export type AirwallexAuthorizationControls = {
  allowed_transaction_count: 'SINGLE' | 'MULTIPLE'
  transaction_limits: {
    currency: string
    limits: AirwallexTransactionLimit[]
  }
  active_from?: string | null
  active_to?: string | null
  allowed_currencies?: string[]
  allowed_merchant_categories?: string[]
  allowed_merchant_countries?: string[]
  allowed_merchant_brands?: string[]
  blocked_transaction_usages?: AirwallexBlockedTransactionUsage[]
}

export type AirwallexCardholderStatus = 'PENDING' | 'READY' | 'INCOMPLETE' | 'DISABLED' | 'DELETED'

export type AirwallexCardholderType = 'INDIVIDUAL' | 'DELEGATE'

export type AirwallexCardholder = {
  cardholder_id: string
  /** Absent on API versions before 2024-03-31. */
  type?: AirwallexCardholderType
  status: AirwallexCardholderStatus
  email?: string
  /** E.164-style digits; some sandbox accounts require this on create. */
  mobile_number?: string
  individual?: {
    name?: { first_name?: string; last_name?: string }
    date_of_birth?: string
    address?: Record<string, string>
  }
  created_at?: string
  updated_at?: string
}

export type CreateCardholderBody = {
  request_id: string
  type: AirwallexCardholderType
  /** Required on API `2024-02-22` for every cardholder, including DELEGATE. */
  email: string
  mobile_number: string
  /** Top-level on `2024-02-22`; later versions nest this under `individual`. */
  address: Record<string, string>
  individual: {
    name: { first_name: string; last_name: string }
    date_of_birth: string
    address: Record<string, string>
    express_consent_obtained: 'yes'
  }
  metadata?: AirwallexCardMetadata
}

export type UpdateCardholderBody = {
  email?: string
  individual?: {
    name?: { first_name?: string; last_name?: string }
    date_of_birth?: string
    address?: Record<string, string>
  }
}

export type AirwallexCardStatus =
  'PENDING' | 'ACTIVE' | 'INACTIVE' | 'CLOSED' | 'BLOCKED' | 'LOST' | 'STOLEN' | 'FAILED'

export type AirwallexIssueTo = 'INDIVIDUAL' | 'ORGANISATION'

export type AirwallexCard = {
  card_id: string
  /** Null on `issue_to: ORGANISATION` cards. */
  cardholder_id: string | null
  /** Masked only on GET card — never full PAN here. */
  card_number?: string
  card_status: AirwallexCardStatus
  nick_name?: string
  form_factor?: string
  is_personalized?: boolean
  /** Required on API versions before 2024-03-31. */
  issue_to?: AirwallexIssueTo
  metadata?: AirwallexCardMetadata
  authorization_controls?: AirwallexAuthorizationControls
  created_at?: string
  updated_at?: string
}

/**
 * GET /issuing/cards/{id}/details — organisation / non-personalized cards only.
 * Never persist, log, or audit these fields.
 */
export type AirwallexCardDetails = {
  card_number: string
  cvv: string
  expiry_month: string | number
  expiry_year: string | number
  name_on_card?: string
}

export type AirwallexCardUsagePurpose =
  | 'BUSINESS_EXPENSES'
  | 'CLIENT_EXPENSES'
  | 'MARKETING_EXPENSES'
  | 'OFFICE_SUPPLIES'
  | 'ONLINE_PURCHASING'
  | 'OTHER'
  | 'SUBSCRIPTIONS'
  | 'TEAM_EXPENSES'
  | 'TRAVEL_EXPENSES'

/**
 * Create-card body for pinned API `2024-02-22` (before `2024-03-31`).
 * Do not send `program` or `is_personalized` — those exist only on later
 * versions. `purpose` is ORGANISATION-only on this version.
 */
export type CreateCardBody = {
  request_id: string
  /** Required when `issue_to` is `INDIVIDUAL`. Must be absent for `ORGANISATION`. */
  cardholder_id?: string
  created_by: string
  form_factor: 'VIRTUAL'
  issue_to: AirwallexIssueTo
  nick_name?: string
  metadata: AirwallexCardMetadata
  authorization_controls: AirwallexAuthorizationControls
  /** Only when `issue_to` is `ORGANISATION`. */
  purpose?: AirwallexCardUsagePurpose
  primary_contact_details?: {
    email: string
    full_name: string
    mobile_number: string
  }
  alert_settings?: {
    low_remaining_transaction_limit?: { enabled: boolean; percent: number }
  }
}

export type UpdateCardBody = {
  nick_name?: string
  card_status?: 'ACTIVE' | 'INACTIVE' | 'CLOSED'
  authorization_controls?: Partial<AirwallexAuthorizationControls>
  metadata?: AirwallexCardMetadata
}

export type AirwallexCardLimits = {
  currency: string
  limits: Array<{
    interval: string
    /** Major units. */
    amount: number
    remaining: number
  }>
}

export type AirwallexCardListResponse = {
  has_more: boolean
  items: AirwallexCard[]
}

export type AirwallexPerTransactionLimitSetting = {
  currency: string
  /** Major units. */
  default: number
  /** Major units. */
  maximum: number
}

export type AirwallexIssuingConfig = {
  primary_currency?: string
  spending_limit_settings: {
    per_transaction_limits: AirwallexPerTransactionLimitSetting[]
  }
  blocked_transaction_usages?: AirwallexBlockedTransactionUsage[]
  remote_auth_config?: {
    enabled?: boolean
    default_action?: string
    url?: string
  }
}

export type CreatePanTokenBody = {
  card_id: string
}

export type AirwallexPanToken = {
  token: string
  expires_at: string
}

/** Deterministic create request_id from local document id (B5.0 locked). */
export function cardRequestId(localCardDocId: string): string {
  return `allocard-card-${localCardDocId}`
}

export function cardholderRequestId(localCardholderDocId: string): string {
  return `allocard-cardholder-${localCardholderDocId}`
}

/** Live Issuing cardholder ids are UUIDs. Fixture leftovers (`ch_fixture_…`) are not. */
export function isAirwallexCardholderUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
}

/** Recorded fixture ids are valid only when `AIRWALLEX_USE_FIXTURES` is on. */
export function isFixtureCardholderId(id: string): boolean {
  return id.startsWith('ch_fixture_')
}

export function isIssuableCardholderId(id: string, useFixtures: boolean): boolean {
  return isAirwallexCardholderUuid(id) || (useFixtures && isFixtureCardholderId(id))
}
