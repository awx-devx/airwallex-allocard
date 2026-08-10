# B5 — Airwallex Client, Cardholders & Cards

**Track:** Backend · **Depends on:** B4 · **Powers:** A5, and everything B6 reconciles

## Goal

Issue and manage real cards in the Airwallex sandbox, with controls set explicitly. B6 will later compute those controls; this phase proves the whole path works when a human supplies them.

Read [`../../AIRWALLEX-INTEGRATION.md`](../../AIRWALLEX-INTEGRATION.md) before starting — most of this phase is implementing what it specifies.

## Deliverables

### Airwallex client

`server/airwallex/` per §10 of the integration guide:

- Token caching in Redis behind a refresh mutex, one retry on `credentials_expired`
- `forAccount(accountId | null)` — always `null` for now, per the tenancy decision in §2
- Idempotent creates via a stable `request_id` derived from the local document id
- Backoff with jitter on `429` and `5xx`, never on `4xx`
- **A fixture mode**, enabled by env flag, replaying recorded responses. Tests never hit the network.
- Structured logging of method, endpoint, `request_id`, status, duration — never bodies

Record fixtures for every call against the real sandbox once, then commit them.

### Models

| Model        | Notes                                                                                                                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Cardholder` | orgId, userId?, airwallexCardholderId, type, status; unique on `(orgId, userId)`                                                                                                                 |
| `Card`       | orgId, projectId?, categoryId?, cardholderId, airwallexCardId, maskedNumber, nickName, purpose, status, `desiredControls`, `appliedControls`, lastReconciledAt, managedByRuleIds[], accessList[] |

`desiredControls` and `appliedControls` both exist from day one. In B5 a human sets desired and the reconciler applies it; in B6 rules set desired and nothing else changes.

### Cardholder provisioning

Create the cardholder when a member is **added to a project**, not when a card is requested. Screening is asynchronous and a cardholder can sit in `PENDING`, so lazy creation would stall B6's "issue cards on launch" rule. Treat `status != READY` as a retryable skip, never a failure.

Type selection: `INDIVIDUAL` for per-member cards; `DELEGATE` for shared, vendor, and one-time cards, which avoids collecting personal KYC data for cards that carry the business name.

### Controls mapping

`server/services/cards/controls.ts` maps the domain control shape to `authorization_controls`. Two traps to encode as assertions:

1. **The empty-array trap.** `null`, absent, and `[]` all mean _allow everything_ for every Airwallex allowlist. A computed empty intersection must raise a conflict, never be pushed. This is the most likely security bug in the entire build.
2. **`allowed_transaction_count` is immutable.** Single-use versus multi-use is decided at creation and can never change. Vendor and one-time cards are `SINGLE`; everything else is `MULTIPLE`.

Also clamp every amount against the per-currency maximum from `GET /issuing/config`, cached at boot — an over-large computed limit should be clamped and flagged, not sent and rejected.

### Reconciler

`server/services/cards/reconciler.ts` — diff `desiredControls` against `appliedControls`, push the minimum patch, under `lock:card:{cardId}`. B6 calls this; B5 exercises it directly. On failure, leave `desiredControls` intact so the next attempt converges.

### PAN reveal

`POST /api/cards/:id/pan-token` creates a short-lived Airwallex PAN token for the secure iframe. Gate on `card.viewDetails` **and** the access scope, and write an audit entry for every reveal. The application never sees a PAN; the iframe is the PCI boundary.

## Endpoints

| Method  | Path                       | Permission         | Notes                                       |
| ------- | -------------------------- | ------------------ | ------------------------------------------- |
| `GET`   | `/api/cardholders`         | `card.view`        |                                             |
| `POST`  | `/api/cardholders`         | `member.manage`    | Usually called by the member-add flow       |
| `GET`   | `/api/cardholders/:id`     | `card.view`        | Includes screening status                   |
| `GET`   | `/api/cards`               | `card.view`        | Org-wide, scope-filtered, paginated         |
| `GET`   | `/api/projects/:id/cards`  | `card.view`        |                                             |
| `POST`  | `/api/projects/:id/cards`  | `card.create`      | Purpose, cardholder, initial controls       |
| `GET`   | `/api/cards/:id`           | `card.view`        | Local mirror plus live status               |
| `PATCH` | `/api/cards/:id`           | `card.manage`      | Nickname, access list, `desiredControls`    |
| `POST`  | `/api/cards/:id/freeze`    | `card.manage`      | → `INACTIVE`                                |
| `POST`  | `/api/cards/:id/unfreeze`  | `card.manage`      | → `ACTIVE`                                  |
| `POST`  | `/api/cards/:id/close`     | `card.manage`      | → `CLOSED`, terminal, requires confirmation |
| `GET`   | `/api/cards/:id/limits`    | `card.view`        | Live from Airwallex, cached ~30s            |
| `POST`  | `/api/cards/:id/pan-token` | `card.viewDetails` | Short-lived token for the iframe            |
| `POST`  | `/api/cards/:id/reconcile` | `card.manage`      | Force a diff-and-push; ops affordance       |

Read available-to-spend from `GET /issuing/cards/:id/limits`, not from a local sum — refunds restore limit balance and a local calculation will drift.

## Events

`card.created`, `card.status_changed`, `card.limit_updated`

## Tests

Beyond the standard matrix, all against fixtures:

- Card creation sends `metadata.orgId` and `metadata.projectId` on every request
- `cards.list` filters by `metadata.orgId`; the unfiltered method is unreachable from a request path
- A computed empty allowlist intersection raises a conflict and does **not** call Airwallex
- Creating a card for a `PENDING` cardholder is skipped with a retryable reason, not failed
- A retried create with the same `request_id` produces one card
- The controls diff produces a minimal patch, and a no-op diff makes no call
- An amount above the configured per-currency maximum is clamped and flagged
- `SINGLE` cards reject any attempt to change transaction count
- Closing a card is irreversible; further mutations are rejected
- A `5xx` from Airwallex leaves `desiredControls` intact and the card retryable
- PAN token creation is denied without `card.viewDetails`, denied out of scope, and audited when allowed
- No test reaches the network — assert this with a network guard in the test setup

## Review checklist

- [x] Fixture mode is on by default in tests, and CI would fail if a real call were attempted
- [x] Every allowlist path has an explicit empty-intersection guard
- [x] `metadata.orgId` is written on create and filtered on every read
- [x] `request_id` is deterministic from the local document id
- [x] The per-card lock wraps every Airwallex patch
- [x] PAN details never appear in a log, a response, or a database field
- [x] `desiredControls` / `appliedControls` are both persisted and diffable
- [x] Cardholders are provisioned at member-add time

## Out of scope

Computed controls (B6), transaction ingestion (B8), physical cards, digital wallet provisioning, disputes.
