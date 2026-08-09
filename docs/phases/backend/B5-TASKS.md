# B5 — Airwallex Client, Cardholders & Cards · Tasks

**Spec:** [B5-cards.md](./B5-cards.md)

**Model:** mid — first external API + PCI boundary; follow `docs/AIRWALLEX-INTEGRATION.md` literally; fixtures only in tests.

**Depends on:** B4, complete and verified

Read [`../../AIRWALLEX-INTEGRATION.md`](../../AIRWALLEX-INTEGRATION.md) before B5.0.

## Contracts first

### B5.0 — Schemas and contracts

- [ ] **B5.0**
- **Files:**
  - `src/shared/enums/cardholderType.ts` (`INDIVIDUAL | DELEGATE`)
  - `src/shared/enums/cardholderStatus.ts` (`PENDING | READY | DISABLED | …` per integration guide)
  - `src/shared/enums/cardStatus.ts` (`PENDING | ACTIVE | INACTIVE | CLOSED` — map Airwallex statuses explicitly)
  - `src/shared/enums/cardPurpose.ts` (`SHARED | PER_MEMBER | VENDOR | ONE_TIME` — align with Project.cardStructure)
  - `src/shared/schemas/cardControls.ts` — domain `desiredControls` / `appliedControls` shape (limits, allowlists, transaction count)
  - `src/shared/schemas/cardholder.ts`, `src/shared/schemas/card.ts`
  - `src/shared/types/cardholder.ts`, `src/shared/types/card.ts`
  - `src/shared/contracts/cardholder.ts`, `src/shared/contracts/card.ts`
- **Do:** Every endpoint in the spec's table gets a contract entry. Inline at minimum:
  - `cardholder`: id, orgId, userId nullable, airwallexCardholderId, type, status, createdAt, updatedAt
  - `card`: id, orgId, projectId nullable, categoryId nullable, cardholderId, airwallexCardId, maskedNumber, nickName, purpose, status, desiredControls, appliedControls, lastReconciledAt nullable, managedByRuleIds string[], accessList (user ids), createdAt, updatedAt
  - Controls: integer minor-unit limits + currency; allowlists as string arrays (empty = conflict at compute time, never push); `allowedTransactionCount: SINGLE | MULTIPLE` immutable after create
  - Inputs: createCardholder, createCard (purpose, cardholderId, initial desiredControls), updateCard (nickName?, accessList?, desiredControls?), closeCard confirmation, pan-token void→token payload
  - Lists: org cards + project cards paginated; cardholders list
- **Pattern:** `src/shared/contracts/budget.ts`, `src/shared/schemas/budget.ts`
- **STOP and get reviewed before implementing.** Highest-risk: empty-allowlist semantics, controls shape vs Airwallex `authorization_controls`, PAN token response (no PAN fields ever).
- **Accept:** `pnpm typecheck`
- **Notes:**

## Implementation tasks

### B5.1 — Cardholder + Card models

- [ ] **B5.1**
- **Files:** `src/server/models/Cardholder.ts`, `src/server/models/Card.ts`, colocated model tests
- **Do:** Tenant-scoped. Cardholder unique `(orgId, userId)` where userId set. Card indexes `(orgId, projectId)`, `(orgId, cardholderId)`, `(orgId, status)`. Persist both `desiredControls` and `appliedControls`. Never store PAN/CVV/expiry.
- **Pattern:** `src/server/models/Budget.ts`, `src/server/models/Project.ts`
- **Accept:** `pnpm test models/card`
- **Notes:**

### B5.2 — Airwallex client skeleton + fixture mode

- [ ] **B5.2**
- **Files:** `src/server/airwallex/` (client, auth/token cache, errors, logging, fixture loader), env flags, network-guard test helper
- **Do:** Implement per integration guide §10: Redis token cache + refresh mutex; one retry on `credentials_expired`; `forAccount(accountId | null)` always null for now; backoff+jitter on 429/5xx only; structured logs (method, endpoint, request_id, status, duration — never bodies). Fixture mode (env) replays recorded responses; tests default to fixtures; add a guard that fails if a real HTTP call is attempted under Vitest.
- **Pattern:** `src/server/redis.ts` token key `aw:token`; `docs/AIRWALLEX-INTEGRATION.md`
- **Accept:** `pnpm test airwallex` — fixture hit; network guard fires when fixture missing
- **Notes:**

### B5.3 — Issuing API wrappers (cardholders, cards, limits, pan token, config)

- [ ] **B5.3**
- **Files:** under `src/server/airwallex/` — cardholders/cards/limits/config methods + fixtures for each
- **Do:** Idempotent creates via `request_id` derived from local document id. `cards.list` always filters `metadata.orgId`. Expose config max amounts for clamp. Record fixtures once; commit them.
- **Pattern:** B5.2 client
- **Accept:** `pnpm test airwallex/issuing` — request_id stable; list always org-filtered
- **Notes:**

### B5.4 — Cardholder + Card repositories

- [ ] **B5.4**
- **Files:** `src/server/repositories/cardholders.ts`, `src/server/repositories/cards.ts`, tests
- **Do:** OrgContext first. CRUD helpers; find by airwallex ids; list with pagination/filters; update desired/applied controls; status transitions.
- **Pattern:** `src/server/repositories/budgets.ts`
- **Accept:** `pnpm test repositories/card`
- **Notes:**

### B5.5 — Controls mapping (domain ↔ authorization_controls)

- [ ] **B5.5**
- **Files:** `src/server/services/cards/controls.ts`, `controls.test.ts`
- **Do:** Pure map domain controls → Airwallex `authorization_controls`. **Empty-array trap:** computed empty allowlist intersection → conflict (never push `[]`/`null`/absent as "allow all" from a merge). Clamp amounts to per-currency max from config. `SINGLE` vs `MULTIPLE` by purpose (VENDOR/ONE_TIME → SINGLE; else MULTIPLE). Reject attempts to change transaction count after create.
- **Pattern:** pure style of `src/server/services/budget/projectProjection.ts`
- **Accept:** `pnpm test cards/controls` — empty intersection conflict; clamp; SINGLE immutability
- **Notes:**

### B5.6 — Card reconciler

- [ ] **B5.6**
- **Files:** `src/server/services/cards/reconciler.ts`, tests
- **Do:** Under `lock:card:{cardId}`, diff desired vs applied, push minimal Airwallex patch, update applied on success. On Airwallex 5xx leave desired intact. No-op diff → no call.
- **Pattern:** `src/server/services/budget/ledger.ts` lock pattern
- **Accept:** `pnpm test cards/reconciler` — minimal patch; no-op; 5xx preserves desired
- **Notes:**

### B5.7 — Cardholder provisioning on member-add

- [ ] **B5.7**
- **Files:** extend `src/server/services/projectMembers/` (or members add), cardholder create service, tests
- **Do:** On project member add, create/ensure cardholder (`INDIVIDUAL` for member user). Screening async — PENDING is OK. Type `DELEGATE` path for shared/vendor/one-time when those cards are created. Treat `status != READY` as retryable skip at card-create time, never hard failure.
- **Pattern:** existing member-add service
- **Accept:** `pnpm test api/project-members` and `pnpm test services/cardholders` green
- **Notes:**

### B5.8 — Cardholder HTTP API

- [ ] **B5.8**
- **Files:** `src/app/api/cardholders/route.ts`, `src/app/api/cardholders/[id]/route.ts`, services, `test/api/cardholders.test.ts`
- **Do:** GET list / GET :id (`card.view`); POST create (`member.manage`). Cross-org → 404.
- **Pattern:** `src/app/api/roles/route.ts`
- **Accept:** `pnpm test api/cardholders` — matrix #1–#4, #7
- **Notes:**

### B5.9 — Cards HTTP API (list/create/get/patch)

- [ ] **B5.9**
- **Files:** `src/app/api/cards/route.ts`, `src/app/api/projects/[id]/cards/route.ts`, `src/app/api/cards/[id]/route.ts`, services, `test/api/cards.test.ts`
- **Do:** Org list + project list (`card.view`, scope-filtered). POST create (`card.create`) with metadata.orgId/projectId. PATCH nickName/accessList/desiredControls (`card.manage`) then reconcile. PENDING cardholder → skip/retryable, not 500. Idempotent create via request_id.
- **Pattern:** `src/app/api/projects/[id]/budget/route.ts`
- **Accept:** `pnpm test api/cards` — metadata on create; PENDING skip; empty allowlist never calls Airwallex
- **Notes:**

### B5.10 — Freeze / unfreeze / close

- [ ] **B5.10**
- **Files:** `src/app/api/cards/[id]/freeze/route.ts`, `unfreeze/route.ts`, `close/route.ts`, services, tests
- **Do:** freeze → INACTIVE; unfreeze → ACTIVE; close → CLOSED terminal with confirmation; further mutations rejected. Emit `card.status_changed`. Audit each.
- **Accept:** `pnpm test api/card-lifecycle`
- **Notes:**

### B5.11 — Limits + pan-token + reconcile endpoints

- [ ] **B5.11**
- **Files:** `src/app/api/cards/[id]/limits/route.ts`, `pan-token/route.ts`, `reconcile/route.ts`, tests
- **Do:** Limits from Airwallex (cache ~30s) — never local sum. PAN token requires `card.viewDetails` + scope; audit every reveal; response never includes PAN/CVV/expiry. Reconcile is ops force-diff (`card.manage`).
- **Accept:** `pnpm test api/card-limits` and `pnpm test api/card-pan-token`
- **Notes:**

### B5.12 — Harden B2 noActiveCards + overview card counts

- [ ] **B5.12**
- **Files:** `src/server/services/projects/transition.ts` (`noActiveCards`), `src/server/services/projects/get.ts` (activeCardCount), extend existing tests
- **Do:** Block ACTIVE→CLOSING while non-CLOSED cards exist on the project. Overview `activeCardCount` from real cards.
- **Accept:** `pnpm test api/project-transition` and `pnpm test api/projects` green
- **Notes:**

### B5.13 — Events + audit coverage

- [ ] **B5.13**
- **Files:** `test/events/cards.test.ts`, `test/audit/b5.test.ts`; payload types in `src/server/events/types.ts` if missing
- **Do:** `card.created`, `card.status_changed`, `card.limit_updated` once each with right payload. One audit per mutating card/cardholder endpoint including pan-token.
- **Pattern:** `test/events/budget.test.ts`, `test/audit/b4.test.ts`
- **Accept:** `pnpm test events/cards` and `pnpm test audit/b5`
- **Notes:**

### B5.14 — Seed extension

- [ ] **B5.14**
- **Files:** `scripts/seed.ts`, `test/seed.test.ts`
- **Do:** `seedB5` — idempotent cardholder(s) + at least one ACTIVE card on SEED-ACTIVE with desired=applied controls (fixture mode). Do not duplicate on re-run.
- **Pattern:** `seedB4` in `scripts/seed.ts`
- **Accept:** `pnpm test seed`
- **Notes:**

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Standard endpoint matrix passing for every B5 endpoint
- [ ] Fixture mode on by default in tests; network guard fails real calls
- [ ] Every allowlist path has empty-intersection guard
- [ ] `metadata.orgId` on create and filtered on every read
- [ ] `request_id` deterministic from local document id
- [ ] Per-card lock wraps every Airwallex patch
- [ ] PAN never in logs, responses, or DB
- [ ] `desiredControls` / `appliedControls` both persisted
- [ ] Cardholders provisioned at member-add time
- [ ] Spec's review checklist signed off
- [ ] STATUS.md updated: active phase B6, generate B6-TASKS.md
