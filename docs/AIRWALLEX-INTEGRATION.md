# Allocard — Airwallex Integration Guide

Everything Allocard needs from Airwallex, mapped to concrete endpoints. Sourced from the [Airwallex developer docs](https://www.airwallex.com/docs/developer-tools/overview.md).

Sandbox base URL: `https://api-demo.airwallex.com` · Production: `https://api.airwallex.com`

---

## 1. Authentication

```
POST /api/v1/authentication/login
  headers: x-client-id, x-api-key
  → { token, expires_at }
```

Include the result as `Authorization: Bearer {token}` on every subsequent call.

Cache the token in Redis under `aw:token` with a TTL of `expires_at − 60s`, and refresh behind a mutex so a burst of requests triggers one login rather than fifty. On a `401` with `credentials_expired`, invalidate and retry once.

**Multi-org.** Account context is carried by the `x-on-behalf-of` header — see §2 for the tenancy decision and what it implies.

**API version.** Pin `AIRWALLEX_API_VERSION=2024-02-22`. The v1 Issuing Cards API is documented as incompatible with Airwallex Business Account products (Borderless Cards, Expense Management); if the sandbox account uses those, this version is required.

[`llms.txt`](https://www.airwallex.com/docs/llms.txt) lists product tutorials, not the versioned API reference. The [Create cards](https://www.airwallex.com/docs/issuing/get-started/create-cards.md) page (`program` + `is_personalized`, no `issue_to`) applies only to **`2024-03-31` and later**. For this pin, use [Create individual cards (older API versions)](<https://www.airwallex.com/docs/issuing/legacy-issuing-apis/create-a-card-(older-api-versions)/create-individual-cards-(older-api-versions).md>) and [Create a card (older API versions)](<https://www.airwallex.com/docs/issuing/legacy-issuing-apis/create-a-card-(older-api-versions).md>) (business cards). The current [Create a Card](https://www.airwallex.com/docs/api/issuing/cards/create.md) reference is the latest schema — do not copy `program` / `is_personalized` from it onto `2024-02-22`.

`issue_to` is a **card type**, not tenancy. The demo still uses one Airwallex sandbox account (§2); Allocard orgs are isolated with `metadata.orgId`. Per-member cards are `issue_to: INDIVIDUAL` (named person). Shared / vendor / one-time cards are `issue_to: ORGANISATION` (business card). Do not send `purpose` on INDIVIDUAL — it is ORGANISATION-only and returns `400 Purpose can only be set when card issue_to is set to "ORGANISATION"`.

---

## 2. Tenancy model

> **Decision: the demo runs every Allocard organisation against a single Airwallex sandbox account.** Tenant separation is enforced by Allocard, using `metadata.orgId` on every card and an `orgId` filter on every read. Connected accounts are the target architecture for production but are explicitly out of scope for the build.

### The two models

|                          | **Single account** _(chosen)_   | **Connected account per org**                 |
| ------------------------ | ------------------------------- | --------------------------------------------- |
| API calls                | Identical, no header            | Identical, plus `x-on-behalf-of: {accountId}` |
| Tenant isolation         | **Enforced by Allocard's code** | Enforced by Airwallex                         |
| `GET /issuing/cards`     | Returns _every org's_ cards     | Returns only that org's cards                 |
| Org onboarding           | Create a document               | Create account + KYB + RFI handling           |
| Card issuing eligibility | Account-level                   | Requires a **Full Connected Account**         |
| Funding                  | One wallet, funded once         | Per-org wallet, via CA Transfers or PLP       |
| `issuing/config`         | One config                      | One per account                               |
| Cardholders              | One record per person           | One record per person **per account**         |

Note that sandbox versus production is a separate axis. Connected accounts work in sandbox too; choosing a single account is a tenancy decision, not an environment one.

### Why single account for the demo

Connected accounts add two whole domains that contribute nothing to the story Allocard is telling:

1. **KYB onboarding.** Every connected account is independently verified — business registration, beneficial owners at 25%+, government IDs, plus an RFI loop when Airwallex needs more. Card issuing specifically requires a Full Connected Account, the most demanding capability tier. That turns "create an organisation" into a multi-day compliance flow.
2. **Per-org funding.** Each account's cards draw on its own wallet, so you need Connected Account Transfers to push funds in and Charges to pull fees out — or the Platform Liquidity Program, which funds just-in-time from a central pool but needs an Airwallex Account Executive to provision, plus a Program Spending Account per connected account and a `funding_source_id` on every card.

Neither makes a card limit move when a budget changes, which is the entire point of the demo.

### What this costs us

**Airwallex no longer enforces the tenant boundary — Allocard does.** `GET /issuing/cards` and the transaction endpoints return every organisation's data in one list. Isolation exists only because every read path filters on `metadata.orgId`. Miss it once and you have cross-tenant leakage of card data.

Mitigate structurally, not by discipline: the Airwallex client must expose **no unfiltered list method**. `cards.list(ctx)` requires an `OrgContext` and always applies the metadata filter internally. If someone needs a raw list, they have to add a method called something like `cards.listAllTenantsUnsafe()` — and that name should never survive review.

### Forward compatibility

Build these seven things now so the migration is mechanical rather than architectural. Together they're roughly a day of work.

1. **Account context is a required client parameter from day one.** `airwallex.forAccount(accountId | null)` — the demo passes `null` everywhere, but no call site changes later.
2. **`organizations.airwallexAccountId`** exists now, nullable, unused in single-account mode.
3. **Always write `metadata.orgId` and `metadata.projectId` on every card, and always filter reads by them** — even though it becomes redundant under connected accounts. Read paths then never change.
4. **Route webhooks by resolving card → org through the local mirror**, with `account_id` as a secondary lookup. Works identically in both models.
5. **Put funding behind a `FundingSource` interface** with a single-wallet implementation, so CA Transfers or PLP can slot in without touching card provisioning.
6. **Cache `issuing/config` keyed by account ID**, not as a global singleton — the per-currency maximum that the rules engine clamps against becomes per-org later.
7. **Key cardholder records on `(orgId, userId)`**, not `userId` alone, since the same person in two orgs is two cardholder records under connected accounts.

### Before committing to connected accounts in production

The secure-iframe documentation describes cards issued to connected accounts as requiring "a Scale implementation," which indicates issuing-to-connected-accounts is a commercially enabled product tier rather than an API you can simply start calling. Raise this with Airwallex early — it gates the whole approach, and the answer may influence whether the production model is connected accounts at all.

---

## 3. Cardholders

A card must belong to a cardholder, and a cardholder must reach `READY` before an individual card can be issued.

```
POST /api/v1/issuing/cardholders/create   → 202 { cardholder_id, status }
GET  /api/v1/issuing/cardholders/{id}
POST /api/v1/issuing/cardholders/{id}/update
```

Two types:

- **`INDIVIDUAL`** — a named person. Requires name, date of birth, address, email, `mobile_number`, and `express_consent_obtained: "yes"` confirming you have their consent for name and sanction screening. Can hold personalized or non-personalized cards. Sandbox create uses placeholder KYC (DOB `1990-01-01`, SF address, `mobile_number: "14155550100"`); real identity collection is out of B5 scope.
- **`DELEGATE`** — an authorized user on non-personalized cards only; cards carry the business name. Ideal for **shared project cards** and **vendor cards**, since no personal KYC data is needed.

Status flow: `PENDING → READY` (or `INCOMPLETE` if more data is needed, `DISABLED`, `DELETED`).

### How Allocard should use this

| Allocard concept       | Cardholder type                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------- |
| Per-member card        | `INDIVIDUAL`, created when the member is added to a project with a card-eligible role |
| Shared project card    | `DELEGATE`, with project members as `additional_cardholder_ids`                       |
| Vendor / one-time card | `DELEGATE`                                                                            |

Create the cardholder **at member-add time, not card-create time**. Screening is asynchronous, so doing it lazily means the "issue cards on project launch" rule stalls waiting on `READY`. Mirror the record in the `cardholders` collection, and have the rules engine treat `cardholder.status != READY` as a `SKIPPED` reason rather than a failure — it will succeed on the next pass.

---

## 4. Cards

```
POST /api/v1/issuing/cards/create          → card_id, masked card_number, card_status
GET  /api/v1/issuing/cards                 list
GET  /api/v1/issuing/cards/{id}            details
POST /api/v1/issuing/cards/{id}/update     controls + status
GET  /api/v1/issuing/cards/{id}/limits     remaining limits per interval
POST /api/v1/issuing/cards/{id}/activate
GET  /api/v1/issuing/cards/{id}/details    sensitive — requires PCI scope, see §8
```

### Create — the fields that matter

```jsonc
{
  "request_id": "allocard-card-{cardDocId}", // stable → safe to retry
  "cardholder_id": "...",
  "created_by": "Jane Doe", // full legal name of requester
  "form_factor": "VIRTUAL",
  "issue_to": "INDIVIDUAL", // MEMBER; ORGANISATION for shared/vendor (then purpose is allowed)
  "nick_name": "APAC Brand Launch — Priya",
  "metadata": {
    "orgId": "...",
    "projectId": "...",
    "cardDocId": "...",
    "ruleId": "...",
  },
  "authorization_controls": {
    "allowed_transaction_count": "MULTIPLE", // REQUIRED, immutable after creation
    "transaction_limits": {
      // REQUIRED
      "currency": "USD",
      "limits": [
        { "interval": "MONTHLY", "amount": 4000 },
        { "interval": "PER_TRANSACTION", "amount": 800 },
      ],
    },
    "active_from": "2026-08-01T00:00:00+0000",
    "active_to": "2026-12-31T23:59:59+0000",
    "allowed_currencies": ["USD", "SGD"],
    "allowed_merchant_categories": ["5734", "7372"],
    "allowed_merchant_countries": ["US", "SG"],
    "blocked_transaction_usages": [
      { "transaction_scope": "CASH_WITHDRAWAL", "usage_scope": "ALL" },
    ],
  },
}
```

ORGANISATION create (shared / vendor) additionally sends `purpose` (`TEAM_EXPENSES` etc.) and, in Airwallex's example, `primary_contact_details`. Do not send `program` or `is_personalized` on this API version.

Two things to internalise:

- **`allowed_transaction_count` cannot be changed after creation.** A `SINGLE` card is a one-time card forever. This means the rules engine must decide single vs multiple at _creation_ time — it can never convert one into the other. `SINGLE` cards are used for vendor and one-time purposes only.
- **`transaction_limits` and `allowed_transaction_count` are mandatory.** There is no "unlimited" card. Good — it aligns with the product thesis.

**Use `metadata` aggressively.** It's 20 keys, 20-char names, 150-char values. Putting `orgId` and `projectId` there makes every webhook self-routing: you can resolve a transaction to a project without a database lookup, and it's a recovery path if local state and Airwallex ever diverge.

### Attribute → control mapping

This is the table that connects [`RULES-ENGINE.md`](./RULES-ENGINE.md) to the API.

| Allocard control          | Airwallex field                                                | Notes                                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Spend limit per interval  | `authorization_controls.transaction_limits.limits[]`           | `PER_TRANSACTION`, `DAILY`, `WEEKLY`, `MONTHLY`, `QUARTERLY`, `YEARLY`, `ALL_TIME`. All limits share one control currency; transactions are FX-converted into it in real time. |
| Project date window       | `active_from` / `active_to`                                    | Authorizations outside the window are rejected. Maps cleanly to project start/end.                                                                                             |
| Merchant restrictions     | `allowed_merchant_categories` (MCC), `allowed_merchant_brands` | Absent / null / `[]` means _all allowed_ — an empty array is not a lockdown.                                                                                                   |
| Currency restrictions     | `allowed_currencies`                                           | Same empty-array semantics.                                                                                                                                                    |
| Location restrictions     | `allowed_merchant_countries`                                   |                                                                                                                                                                                |
| Channel restrictions      | `blocked_transaction_usages[]`                                 | `transaction_scope` × `usage_scope`; most restrictive overlap applies.                                                                                                         |
| Single-use vendor card    | `allowed_transaction_count: "SINGLE"`                          | One successful debit, then dead.                                                                                                                                               |
| Low-balance alerting      | `alert_settings.low_remaining_transaction_limit`               | Fires a webhook once per interval when remaining drops below `percent`. Feed it into the rules engine as a trigger.                                                            |
| Freeze / unfreeze / close | `card_status` on update: `INACTIVE` / `ACTIVE` / `CLOSED`      |                                                                                                                                                                                |

> **The empty-array trap.** For every allowlist field, `null`, absent, and `[]` all mean "allow everything." If a rule computes an empty intersection and you push `[]`, you get the opposite of what you intended — a wide-open card. The merge step in the rules engine must treat an empty intersection as a **conflict**, not as a value to push. This is the single most likely security bug in the build.

### Update

```
POST /api/v1/issuing/cards/{id}/update
```

Only the included parameters change; omitted ones are left alone. `card_status` accepts `ACTIVE`, `INACTIVE`, `CLOSED` only.

Card status flow: `PENDING → ACTIVE ⇄ INACTIVE → CLOSED`. Also `BLOCKED` (Airwallex risk), `LOST`, `STOLEN`, `FAILED`. `CLOSED` is terminal and irreversible — the reconciler must never issue it from a computed rule without an explicit `allowDestructive` flag on the action. Note that a cancelled card still processes already-authorized, uncleared transactions.

Cards auto-renew on expiry: same `card_id`, same PAN, new expiry and CVV. Don't build expiry handling.

### Remaining limits

```
GET /api/v1/issuing/cards/{id}/limits
  → { currency, limits: [{ interval, amount, remaining }] }
```

This is the authoritative source for "available to spend" in the UI. Refunds restore limit balance. Poll it on card detail views and cache for ~30s; don't compute it locally from your own transaction mirror, which will drift.

---

## 5. Transactions

```
GET /api/v1/issuing/transactions            authorizations + clearings
GET /api/v1/issuing/transactions/{id}
GET /api/v1/issuing/authorizations
GET /api/v1/issuing/card_transactions/{id}
GET /api/v1/issuing/card_transaction_events lifecycle-level detail
```

The transaction model is three levels deep: **Lifecycle → Card Transaction → Transaction Event**. Event types are `AUTHORIZATION`, `CLEARING`, `REVERSAL_AUTH`; subtypes include `INCREMENTAL_AUTHORIZATION`, `PARTIAL_REVERSAL`, `PARTIAL_CLEARING`, `EXPIRED_AUTHORIZATION`, `CLEARING_REVERSAL`.

Webhook payloads carry a `card_transaction_data` object with `card_transaction_lifecycle_id`, `card_transaction_id`, and `card_transaction_event_id`. **Correlate on these, not on your own guesses.**

### Mapping to the budget ledger

This is where dual-message processing bites. An authorization is not a spend, and a clearing amount may differ from its authorization.

| Event                                     | Ledger entry                                                               |
| ----------------------------------------- | -------------------------------------------------------------------------- |
| `AUTHORIZATION`                           | `COMMITMENT` for the authorized amount                                     |
| `CLEARING`                                | `RELEASE` of the matching commitment, then `ACTUAL` for the cleared amount |
| `PARTIAL_CLEARING`                        | Partial `RELEASE` + `ACTUAL`; keep the remainder committed                 |
| `REVERSAL_AUTH` / `EXPIRED_AUTHORIZATION` | `RELEASE` of the commitment                                                |
| `CLEARING_REVERSAL` / refund              | Negative `ACTUAL`                                                          |

Store `card_transaction_lifecycle_id` on every ledger entry so releases can find their commitments. Without it, an expired authorization silently holds budget hostage forever.

---

## 6. Webhooks

Configure in the Airwallex web app under **Settings → Developer → Webhooks** with a notification URL and a secret.

### Events to subscribe to

**Card lifecycle** — `issuing.card.pending`, `.failed`, `.active`, `.inactive`, `.blocked`, `.lost`, `.stolen`, `.closed`, `.expired`

**Transactions** — `issuing.transaction.succeeded`, `issuing.transaction.failed`

**Card transaction lifecycle** — `issuing.card_transaction.authorized`, `.verified`, `.cleared`, `.reversed`, `.expired`, `.declined`, `.modified`, plus `issuing.card_transaction_lifecycle.created` / `.modified`

Wire each to a domain event: card status events reconcile the local `cards` mirror; transaction events write ledger entries and emit `transaction.cleared`, which re-triggers rule evaluation.

### Handler contract

```ts
// app/api/webhooks/airwallex/route.ts
export async function POST(req: Request) {
  const raw = await req.text() // RAW body — never req.json()
  const ts = req.headers.get('x-timestamp')!
  const sig = req.headers.get('x-signature')!

  const expected = createHmac('sha256', process.env.AIRWALLEX_WEBHOOK_SECRET!)
    .update(`${ts}${raw}`) // timestamp THEN body
    .digest('hex')

  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new Response('invalid signature', { status: 400 })
  }
  if (Date.now() - Number(ts) > 5 * 60_000) {
    return new Response('stale', { status: 400 })
  }

  const event = JSON.parse(raw) // parse only after verifying
  await enqueue(event) // persist + queue, do not process inline
  return new Response('ok', { status: 200 }) // acknowledge IMMEDIATELY
}
```

Non-negotiables:

1. **HMAC the raw string.** Parsing and re-serialising changes whitespace and key order, and the signature will never match.
2. **Return `200` immediately.** Anything else is treated as a delivery failure and retried. Persist to `webhookEvents`, enqueue, respond — all processing happens out of band.
3. **Deduplicate on `event.id`.** Redis `SET NX webhook:{id}`, backed by a unique index on `webhookEvents.eventId`. Events can arrive more than once and out of order.
4. **Never assume ordering.** A clearing can land before you've processed its authorization. Make ledger writes commutative or gate them on the lifecycle ID.

Airwallex sends from a fixed IP allowlist (documented separately for production and sandbox) — worth whitelisting if the deployment sits behind a firewall.

---

## 7. Remote authorization

The most compelling part of the demo, and the part with the most operational risk.

When enabled on the account, Airwallex forwards every authorization request to your endpoint and waits for an approve/decline decision. **The window is 2.5 seconds.** On timeout or error, Airwallex applies the account's default action. After your decision, Airwallex still runs its own risk and regulatory checks and may decline something you approved.

This gives Allocard something static controls cannot: a decision that accounts for the _project's_ live budget, the member's month-to-date spend, and whether an approved purchase request exists — none of which fit into `authorization_controls`.

### Implementation

```ts
// app/api/remote-auth/route.ts
export async function POST(req: Request) {
  const t0 = Date.now()
  const raw = await req.text()
  verifySignature(raw, req.headers)

  const auth = JSON.parse(raw)
  const policy = await redis.get(`policy:card:${auth.card_id}`) // single read

  if (!policy || isStale(policy)) {
    return decide('APPROVE', 'policy_snapshot_unavailable') // fail-open + flag
  }

  const decision = evaluateHardStops(policy, auth) // pure, in-memory
  void recordDecision(auth, decision, Date.now() - t0) // fire and forget
  return decide(decision.outcome, decision.reason)
}
```

Rules for this endpoint:

- **No database reads.** One Redis `GET`, then pure comparisons. Target p99 under 300ms.
- **No rule pipeline.** Evaluate the pre-flattened `hardStops` snapshot only.
- **Never block on logging.** Record the decision asynchronously.
- **Fail open by default.** A bug in Allocard must not decline a legitimate purchase during a demo. Make the posture configurable and log every fail-open loudly.

### Simulator

Remote authorization requires account enablement, so **build the simulator first and treat live mode as a config flip**:

```
REMOTE_AUTH_MODE=simulate | live
```

In simulate mode, expose an internal "attempt a purchase" action in the demo UI that posts a synthetic authorization payload to the same handler. The decision logic is identical; only the caller differs. This keeps the demo fully functional without account enablement, and makes the logic testable.

---

## 8. Displaying card details (PCI)

Allocard must **never** touch a PAN. `GET /issuing/cards/{id}/details` returns sensitive data and requires PCI compliance on your side — do not call it.

Use Airwallex secure iframes (PAN delegation) instead:

```
POST /api/v1/issuing/pantokens/create      → short-lived token
iframe src: https://airwallex.com/issuing/pci/v2/{cardId}/details#{hash}
```

Three iframes are available: card details (number, expiry, CVV), PIN display, and PIN change. They're styleable via a documented set of CSS classes (`.details__row--card-number`, `.details__value`, and so on) so they can match the product's design, and they emit `postMessage` lifecycle events for load and error states.

Server-side, the token endpoint must be behind a `card.viewDetails` permission check plus an access-scope check, and every reveal is an audit event. The iframe is the PCI boundary; permission to reach it is entirely yours to enforce.

---

## 9. Funding & configuration

```
GET /api/v1/balances/current               wallet balances
GET /api/v1/issuing/config                 per-currency default and maximum limits,
                                           remote_auth settings
POST /api/v1/issuing/config/update
```

Cards draw from the account wallet by default, or from a specific `funding_source_id` if your account manager has provisioned one. Authorizations fail on insufficient balance regardless of card limits — so the sandbox wallet must be funded before any demo transaction will succeed.

Under §2's single-account decision there is exactly one wallet to fund, and card provisioning can omit `funding_source_id` entirely. Still, keep it behind a narrow interface so the connected-account path (Connected Account Transfers per org, or a Platform Liquidity Program supplying `funding_source_id` per card) drops in without touching provisioning:

```ts
interface FundingSource {
  resolve(ctx: OrgContext): Promise<{ fundingSourceId?: string }>
  availableBalance(ctx: OrgContext, currency: string): Promise<number>
}
```

The single-wallet implementation returns `{}` and reads `GET /balances/current`. That is the whole implementation for the demo.

Call `GET /issuing/config` at startup and cache it. It returns, per currency, the **default** limit (used when you omit one) and the **maximum** limit (exceeding it rejects the request). The rules engine must clamp every computed amount to that maximum, or a formula producing an unexpectedly large number turns into a failed API call rather than a big limit.

---

## 10. Client design

```ts
// server/airwallex/client.ts
interface AirwallexClient {
  forAccount(accountId: string | null): AirwallexClient // null = single-account mode

  cardholders: { create; get; update }
  cards: { create; get; list; update; limits; activate }
  transactions: { list; get; events }
  config: { get }
  panTokens: { create }
}
```

Build in from the start:

- **Token caching** with a refresh mutex, and one automatic retry on `credentials_expired`.
- **Idempotency**: every create takes a caller-supplied `request_id` derived from the local document ID, so a retry after a network failure never double-issues a card.
- **Retries** with exponential backoff and jitter on `429` and `5xx`, never on `4xx`.
- **Account context** (`x-on-behalf-of`) as a client-level parameter, set through `forAccount()`. Under §2's decision every caller passes `null`, but the seam exists so a future migration touches the factory rather than every call site.
- **Org-scoped reads only.** `cards.list` and `transactions.list` take an `OrgContext` and always filter on `metadata.orgId`. Since all organisations share one Airwallex account, an unfiltered list is a cross-tenant data leak — see [`ARCHITECTURE.md`](./ARCHITECTURE.md) §6, invariant 3.
- **A fixture mode** driven by an env flag, replaying recorded responses. Tests must never hit the network, and the demo should survive a sandbox outage.
- **Structured logging** of method, endpoint, `request_id`, status, and duration — never request or response bodies, which may contain card data.

---

## 11. Sandbox notes

- Sandbox has [simulation APIs](https://www.airwallex.com/docs/developer-tools/sandbox-environment.md) for triggering transactions without moving real money — this is how you demo the budget-updates-and-limits-move loop.
- Virtual cards transition `PENDING → ACTIVE` automatically, so they're immediately usable.
- Cardholder screening still applies in sandbox; build the UI to tolerate a `PENDING` cardholder gracefully.
- Webhooks can be viewed and re-triggered from the web app, which is invaluable when debugging ledger reconciliation.
- Test-event signatures use the secret in the payload's `client-secret-key` header rather than the configured webhook secret — handle both paths or test events will appear to fail verification.
