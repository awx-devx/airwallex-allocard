# B8 — Webhooks, Transactions & Remote Authorization · Tasks

**Spec:** [B8-money-in-motion.md](./B8-money-in-motion.md)

**Model:** mid — money correctness + webhook/remote-auth latency; write tasks for **LOW** execution (every file named, shapes inlined, copy B4/B5/B7 patterns). Follow `docs/AIRWALLEX-INTEGRATION.md` and ARCHITECTURE §5/§8/§10 literally. Fixtures only in tests — never hit the network.

**Depends on:** B7, complete and verified

Read [`../../AIRWALLEX-INTEGRATION.md`](../../AIRWALLEX-INTEGRATION.md) (webhooks + transactions + remote auth sections) and [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) §5 (`transactions`, `webhookEvents`), §8 (streams + `sync-transactions`), §10 (Redis keys) before B8.0.

## Contracts first

- [x] **B8.0** — Schemas and contracts
  - **Files:**
    - `src/shared/enums/webhookEventStatus.ts` — invent status set for ingest lifecycle (e.g. `RECEIVED | PROCESSED | FAILED`) — **STOP for review if unclear**
    - `src/shared/enums/transactionType.ts` — `AUTHORIZATION | CLEARING | REVERSAL_AUTH` (extend if integration docs add partial/refund types as domain enums)
    - `src/shared/enums/transactionStatus.ts` — mirror Airwallex statuses needed on the wire (inline from integration docs)
    - `src/shared/enums/remoteAuthResponseStatus.ts` — `AUTHORIZED | DECLINED` (Airwallex `response_status`)
    - `src/shared/schemas/webhookEvent.ts`, `src/shared/schemas/transaction.ts`, `src/shared/schemas/remoteAuth.ts`
    - `src/shared/types/webhookEvent.ts`, `src/shared/types/transaction.ts`, `src/shared/types/remoteAuth.ts`
    - `src/shared/contracts/webhook.ts`, `src/shared/contracts/transaction.ts`, `src/shared/contracts/remoteAuth.ts` (split OK)
  - **Do:** Every endpoint in the spec's table gets a contract entry. Amounts = integer **minor units** + currency length 3. Inline:
    - `webhookEvent`: `id, eventId` (unique), `name`, `accountId` nullable, `payload` unknown/record, `receivedAt` ISO, `processedAt` nullable ISO, `status`, `attempts` int ≥ 0, `error` nullable string
    - `transaction`: `id, orgId, cardId, projectId`, `airwallexTransactionId`, `cardTransactionId`, `lifecycleId`, `type`, `status`, `amount` int, `currency` length 3, `billingAmount` int, `billingCurrency` length 3, `merchant: { name, mcc, country }`, `failureReason` nullable, `receiptFileId` nullable, `transactedAt` ISO, `createdAt, updatedAt`
    - Remote-auth request/response shapes per Airwallex remote-auth docs (decision + reason codes); simulator input for `POST /api/simulate/purchase`
    - Lists: page default 1, pageSize default 20 max 100 → `{ items, page, pageSize, total }`; filters as needed (`cardId?`, `projectId?`, `status?`, `from?`, `to?`)
  - **Contracts table (every row):**
    - POST `/api/webhooks/airwallex` → raw body (no Zod body parse before HMAC) → `200` void/ack
    - POST `/api/remote-auth` → remoteAuthInput → remoteAuthDecision
    - GET `/api/transactions` → list
    - GET `/api/projects/:id/transactions` → list
    - GET `/api/transactions/:id` → transaction (+ lifecycle chain if separate schema)
    - GET `/api/cards/:id/transactions` → list
    - POST `/api/transactions/:id/receipt` → upload input → transaction
    - DELETE `/api/transactions/:id/receipt` → void
    - GET `/api/transactions/declined` → list
    - POST `/api/simulate/purchase` → simulatePurchaseInput → remoteAuthDecision (or ack)
    - POST `/api/admin/sync-transactions` → void/ack
  - **Pattern:** `src/shared/contracts/card.ts`, `src/shared/schemas/budget.ts`
  - **STOP and get reviewed before implementing.** Highest-risk: ledger mapping table shapes, `lifecycleId` nullability, remote-auth fail-open config, webhook status enum, money major↔minor conversion boundary.
  - **Accept:** `pnpm typecheck`
  - **Notes:** Locked in B8.0 (reviewed):
    1. `WebhookEventStatus` = `RECEIVED | PROCESSED | FAILED` (ingest lifecycle only).
    2. `TransactionType` extends the ARCHITECTURE trio with Airwallex subtypes needed for ledger mapping: `INCREMENTAL_AUTHORIZATION`, `PARTIAL_REVERSAL`, `PARTIAL_CLEARING`, `EXPIRED_AUTHORIZATION`, `CLEARING_REVERSAL`.
    3. `TransactionStatus` mirrors card-transaction lifecycle statuses: `AUTHORIZED | VERIFIED | CLEARED | REVERSED | EXPIRED | DECLINED` (not legacy APPROVED/PENDING/FAILED).
    4. `lifecycleId` is **required** (non-null) on Transaction; budget `lifecycleId` stays nullable until B8.4 writes it.
    5. Money boundary: domain `transaction` amounts = integer minor units; `remoteAuthInput` keeps Airwallex **major-unit** floats on the wire — convert in decide/ingest (same as `controls.ts`). Never persist remote-auth floats.
    6. Fail-open is env/config (not a schema field); missing/stale snapshot → `AUTHORIZED` + `status_reason: policy_snapshot_unavailable`, flag async.
    7. Get-by-id returns `transactionDetail` = transaction + `lifecycleEvents[]`. Receipt upload = `{ fileName, contentType, contentBase64 }` (invented; B8.8 stores). Simulator input = minor-unit domain shape → same decide path.

## Implementation tasks

### B8.1 — Models

- [x] **B8.1** — WebhookEvent + Transaction models
  - **Files:** `src/server/models/WebhookEvent.ts`, `src/server/models/Transaction.ts`, colocated tests
  - **Do:** WebhookEvent unique `eventId`. Transaction unique `(orgId, airwallexTransactionId)`; indexes `(orgId, cardId, transactedAt)`, `(orgId, projectId, transactedAt)`, `(orgId, lifecycleId)`. Amounts Number integers. `tenantScoped` on Transaction; WebhookEvent may be global by `eventId` — document tenancy choice in Notes (Airwallex account is shared — see ARCHITECTURE D1).
  - **Pattern:** `src/server/models/BudgetEntry.ts`, `src/server/models/PurchaseRequest.ts`
  - **Accept:** `pnpm test models/transaction` (or webhook+transaction)
  - **Notes:** WebhookEvent is **not** tenant-scoped — shared Airwallex account (D1); org routing at process time via card mirror. Transaction is `tenantScoped`.

### B8.2 — Repositories

- [x] **B8.2** — WebhookEvent + Transaction repositories
  - **Files:** `src/server/repositories/webhookEvents.ts`, `src/server/repositories/transactions.ts`, tests
  - **Do:** `OrgContext` first on Transaction methods. `insertWebhookEvent` idempotent on `eventId` (duplicate → existing). `findByLifecycleId`, list/filter helpers for HTTP. Cross-org → null.
  - **Pattern:** `src/server/repositories/budgetEntries.ts`
  - **Accept:** `pnpm test repositories/transaction`

### B8.3 — Webhook HMAC + ingest

- [x] **B8.3** — Signature verify + `POST /api/webhooks/airwallex`
  - **Files:** `src/server/services/webhooks/verify.ts`, `src/app/api/webhooks/airwallex/route.ts`, tests
  - **Do:** Four non-negotiables from the spec: HMAC raw body (`req.text()`), verify before `JSON.parse`, persist + `XADD` webhooks stream + `200` immediately, dedupe Redis `SET NX` + unique `eventId`. Sandbox test-event path uses payload `client-secret-key` header. Invalid sig → 400, persist nothing. Stale timestamp rejected.
  - **Pattern:** route-handler webhook exception in `.cursor/rules/route-handlers.mdc`; Redis `redisKeys.webhook`
  - **Accept:** `pnpm test webhooks/airwallex` — raw vs re-serialised HMAC; duplicate once; 200 before processing

### B8.4 — Webhook consumer + ledger mapping

- [x] **B8.4** — Process webhooks → ledger
  - **Files:** `src/server/services/webhooks/process.ts`, `src/server/services/transactions/ledgerMap.ts`, wire worker `onWebhookEvent`, tests
  - **Do:** Map Airwallex events to B4 ledger per spec table (`AUTHORIZATION`→COMMITMENT, `CLEARING`→RELEASE+ACTUAL, partials, reversals/expiry, refunds as negative ACTUAL). Every entry carries `lifecycleId`. Out-of-order clearing before auth must converge. Emit `transaction.*` domain events for B6. Never invent float money.
  - **Pattern:** `src/server/services/budget/ledger.ts` `appendBudgetEntry`; worker consumers already have webhook stream
  - **Accept:** `pnpm test transactions/ledgerMap` — each mapping row; out-of-order convergence; partial remainder; expired auth RELEASE via lifecycleId

### B8.5 — Remote authorization

- [x] **B8.5** — `POST /api/remote-auth`
  - **Files:** `src/server/services/remoteAuth/decide.ts`, `src/app/api/remote-auth/route.ts`, tests
  - **Do:** One Redis GET of policy snapshot → pure comparisons → respond. **No DB reads** (spy in tests). Hard ceiling 2.5s; target p99 < 300ms warm. Missing/stale snapshot → **approve and flag** (configurable fail-open, log loudly). Record decision async. Rate-limit via `redisKeys.rateRemoteAuth`.
  - **Pattern:** policy snapshot written in `src/server/services/rules/apply.ts`
  - **Accept:** `pnpm test remoteAuth` — zero DB reads; missing snapshot approve+flag; latency budget asserted in test harness

### B8.6 — Simulator

- [x] **B8.6** — `POST /api/simulate/purchase`
  - **Files:** `src/app/api/simulate/purchase/route.ts`, service glue, tests
  - **Do:** `REMOTE_AUTH_MODE=simulate` (and/or OWNER+secret) posts synthetic auth into the **same** decide handler as live. Demo-only. Identical decision logic.
  - **Accept:** `pnpm test api/simulate`

### B8.7 — Transaction HTTP API

- [ ] **B8.7** — List/get transactions + declined
  - **Files:** `src/app/api/transactions/route.ts`, `src/app/api/transactions/[id]/route.ts`, `src/app/api/transactions/declined/route.ts`, `src/app/api/projects/[id]/transactions/route.ts`, `src/app/api/cards/[id]/transactions/route.ts`, matrix tests
  - **Do:** Permissions per spec. Scoped views. Get-by-id includes lifecycle event chain.
  - **Pattern:** `src/app/api/requests/` matrix style
  - **Accept:** `pnpm test api/transactions`

### B8.8 — Receipts

- [ ] **B8.8** — Receipt upload/delete + missing-receipt sweep
  - **Files:** receipt routes under `transactions/[id]/receipt`, `src/server/services/transactions/receipts.ts`, worker job or schedule hook, tests
  - **Do:** Upload attach; DELETE per permissions; sweep requests missing receipts above threshold (persist request / flag — no OCR).
  - **Accept:** `pnpm test transactions/receipts`

### B8.9 — Sync backstop + admin

- [ ] **B8.9** — Wire `sync-transactions` + `POST /api/admin/sync-transactions`
  - **Files:** `src/server/services/transactions/sync.ts`, update `src/worker/index.ts`, admin route, tests
  - **Do:** Replace noop with real job. OWNER+secret for admin trigger. Idempotent with webhook path.
  - **Pattern:** `src/server/services/approvals/escalate.ts`
  - **Accept:** `pnpm test transactions/sync`

### B8.10 — Events + audit + seed + budget:verify

- [ ] **B8.10** — Events, audit, seed, projection reconcile
  - **Files:** `test/events/b8.test.ts`, `test/audit/b8.test.ts`, extend `scripts/seed.ts`, assert `budget:verify` (or equivalent script) after mixed sequence
  - **Do:** Emit `transaction.authorized | cleared | declined | reversed`; B6 consumes. Audit mutations. Seed sample transactions + one webhook fixture. Long mixed sequence still reconciles projection.
  - **Accept:** `pnpm test events/b8` && `pnpm test audit/b8` && `pnpm test seed`

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Standard endpoint matrix passing for every B8 endpoint
- [ ] Raw-body HMAC verified before parse; 200 before processing
- [ ] Dedup at Redis + unique index
- [ ] `lifecycleId` on every ledger entry; releases find commitments
- [ ] Out-of-order handling tested
- [ ] Remote auth Redis-only; fail-open configurable and logged
- [ ] Simulator and live share one handler
- [ ] Spec's review checklist signed off
- [ ] STATUS.md updated: active phase B9, generate B9-TASKS.md
