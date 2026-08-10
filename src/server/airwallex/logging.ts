export type AirwallexLogFields = {
  method: string
  endpoint: string
  request_id?: string
  status: number
  durationMs: number
  accountId: string | null
}

/** Structured Airwallex client logs — never include request/response bodies. */
export function logAirwallexRequest(fields: AirwallexLogFields): void {
  console.info('[airwallex]', {
    method: fields.method,
    endpoint: fields.endpoint,
    request_id: fields.request_id,
    status: fields.status,
    durationMs: fields.durationMs,
    accountId: fields.accountId,
  })
}
