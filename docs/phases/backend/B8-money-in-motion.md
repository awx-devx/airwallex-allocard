# B8 — Webhooks, Transactions & Remote Authorization

**Track:** Backend · **Depends on:** B7 · **Powers:** A8

## Goal

Close the loop. Money moves at Airwallex, Allocard learns about it, the budget updates, rules re-evaluate, and limits move. This is the phase where the demo becomes a live system rather than a set of screens.

## Deliverables

### Models

| Model | Notes |
| --- | --- |
| `WebhookEvent` | eventId (unique), name, accountId?, payload, receivedAt, processedAt?, status, attempts, error? |
| `Transaction` | orgId, cardId, projectId, airwallexTransactionId (unique), cardTransactionId, lifecycleId, type, status, amount, currency, billingAmount, billingCurrency, merchant{ name, mcc, country }, failureReason?, receiptFileId?, transactedAt |

### Webhook ingest

`POST /api/webhooks/airwallex`, in the `web` service. Four non-negotiables, each a test:

1. **HMAC the raw body string.** `await req.text()`, then `HMAC(timestamp + rawBody)`. Parsing and re-serialising changes key order and whitespace, and the signature will never match.
2. **Verify before parsing.** Signature check first, `JSON.parse` second.
3. **Return `200` immediately.** Persist, `XADD` to the webhooks stream, respond. Anything slower is treated as a delivery failure and retried.
4. **Deduplicate on `event.id`.** Redis `SET NX`, backed by the unique index. Events arrive more than once and out of order.

Handle the sandbox test-event path too: test signatures use the secret from the payload's `client-secret-key` header rather than the configured webhook secret.

### Ledger mapping

The heart of the phase, and the easiest thing to get subtly wrong. An authorization is not a spend, and a clearing amount may differ from its authorization.

| Airwallex event | Ledger entry |
| --- | --- |
| `AUTHORIZATION` | `COMMITMENT` for the authorized amount |
| `CLEARING` | `RELEASE` of the matching commitment, then `ACTUAL` for the cleared amount |
| `PARTIAL_CLEARING` | Partial `RELEASE` + `ACTUAL`; the remainder stays committed |
| `REVERSAL_AUTH` / `EXPIRED_AUTHORIZATION` | `RELEASE` of the commitment |
| `CLEARING_REVERSAL` / refund | Negative `ACTUAL` |

Every entry carries `lifecycleId` (from `card_transaction_data.card_transaction_lifecycle_id`) so releases can find their commitments. Without it, an expired authorization holds budget hostage forever.

**Ordering is not guaranteed.** A clearing can arrive before its authorization has been processed. Make the mapping commutative, or gate it on the lifecycle so out-of-order events resolve to the same final state either way.

### Remote authorization

`POST /api/remote-auth`, with a **2.5 second hard ceiling** including network round trip.

```
one Redis GET → pure comparisons → respond
```

Rules: no database reads, no rule pipeline, no blocking on logging. Record the decision asynchronously. If the snapshot is missing or stale, **approve and flag** — a bug in Allocard must not decline a legitimate purchase. Make the posture configurable and log every fail-open loudly.

### Simulator

`REMOTE_AUTH_MODE=simulate` posts a synthetic authorization payload to the same handler from a demo action. Identical decision logic, different caller. Build this first; live mode is a config flip once Airwallex enables the account.

### Receipts

Upload, attach to a transaction, and a sweep that requests missing receipts above a threshold.

## Endpoints

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/webhooks/airwallex` | signature | Verify, persist, enqueue, 200 |
| `POST` | `/api/remote-auth` | signature | Sub-2.5s decision |
| `GET` | `/api/transactions` | `transaction.view` scoped | Org-wide, filterable |
| `GET` | `/api/projects/:id/transactions` | `transaction.view` scoped | |
| `GET` | `/api/transactions/:id` | scoped | Includes the full lifecycle event chain |
| `GET` | `/api/cards/:id/transactions` | scoped | |
| `POST` | `/api/transactions/:id/receipt` | own or `transaction.view` | Upload and attach |
| `DELETE` | `/api/transactions/:id/receipt` | own or `card.manage` | |
| `GET` | `/api/transactions/declined` | `transaction.view` | With decline reasons |
| `POST` | `/api/simulate/purchase` | `OWNER` + secret | Demo-only synthetic authorization |
| `POST` | `/api/admin/sync-transactions` | `OWNER` + secret | Backstop resync |

## Events

`transaction.authorized`, `transaction.cleared`, `transaction.declined`, `transaction.reversed` — each re-triggering B6 evaluation.

## Tests

Beyond the standard matrix:

- Signature verification succeeds on the raw body and **fails** on a re-serialised one — assert both directions
- An invalid signature returns `400` and persists nothing
- A stale timestamp is rejected
- Duplicate `event.id` processes exactly once
- Out-of-order delivery (clearing before authorization) converges to the same final ledger state
- Each row of the ledger mapping table, asserted on the resulting projection
- Partial clearing leaves the correct remainder committed
- An expired authorization releases its commitment via `lifecycleId`
- A refund produces a negative `ACTUAL` and restores remaining budget
- A cleared transaction triggers rule re-evaluation and a limit change, end to end
- Remote auth responds in under 300ms at p99 against a warm snapshot
- Remote auth with a missing snapshot approves and flags
- Remote auth performs zero database reads — assert with a spy
- The handler returns `200` before processing completes

## Review checklist

- [ ] Raw-body HMAC, verified before parsing
- [ ] `200` returned immediately; all work is out of band
- [ ] Deduplication works at both the Redis and index layers
- [ ] `lifecycleId` is populated on every entry and releases find their commitments
- [ ] Out-of-order handling is tested, not assumed
- [ ] Remote auth touches only Redis
- [ ] Fail-open is deliberate, configurable, and loudly logged
- [ ] The simulator and live mode share one handler
- [ ] The budget projection still reconciles after a long mixed event sequence — run `budget:verify`

## Out of scope

Disputes and chargebacks, multi-currency FX reporting beyond storing billing amounts, receipt OCR.
