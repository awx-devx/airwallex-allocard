# B5 — Airwallex Client, Cardholders & Cards · Tasks

**Spec:** [B5-cards.md](./B5-cards.md)

**Model:** mid — first external API + PCI boundary; tasks written for **LOW** execution (every file named, every field inlined, copy B1/B4 patterns). Follow `docs/AIRWALLEX-INTEGRATION.md` literally; fixtures only in tests.

**Depends on:** B4, complete and verified

Read [`../../AIRWALLEX-INTEGRATION.md`](../../AIRWALLEX-INTEGRATION.md) before B5.0. Also skim `docs/ARCHITECTURE.md` §5 Cards & money + §10 Redis keys, and `docs/RULES-ENGINE.md` §4 merge field names (controls shape must match B6).

## Contracts first

### B5.0 — Schemas and contracts

- [x] **B5.0**
  - **Files:**
    - `src/shared/enums/cardholderType.ts` — `INDIVIDUAL | DELEGATE`
    - `src/shared/enums/cardholderStatus.ts` — `INCOMPLETE | PENDING | READY | DISABLED | DELETED` (per ARCHITECTURE + integration §3)
    - `src/shared/enums/cardStatus.ts` — `PENDING | ACTIVE | INACTIVE | CLOSED | BLOCKED | LOST | STOLEN | FAILED` (mirrors Airwallex; B5 mutates only ACTIVE ⇄ INACTIVE → CLOSED)
    - `src/shared/enums/cardPurpose.ts` — `SHARED | MEMBER | VENDOR | ONE_TIME` (**not** `PER_MEMBER` — matches ARCHITECTURE + RULES-ENGINE; maps from `Project.cardStructure.perMember`)
    - `src/shared/enums/transactionLimitInterval.ts` — `PER_TRANSACTION | DAILY | WEEKLY | MONTHLY | QUARTERLY | YEARLY | ALL_TIME`
    - `src/shared/enums/allowedTransactionCount.ts` — `SINGLE | MULTIPLE`
    - `src/shared/schemas/cardControls.ts` — domain controls (same shape for `desiredControls` and `appliedControls`)
    - `src/shared/schemas/cardholder.ts`, `src/shared/schemas/card.ts`
    - `src/shared/types/cardholder.ts`, `src/shared/types/card.ts`, `src/shared/types/cardControls.ts`
    - `src/shared/contracts/cardholder.ts`, `src/shared/contracts/card.ts`
  - **Do:** Every endpoint in the spec's table gets a contract entry. Inline shapes (domain money = integer **minor units**, never float):
    - `cardholder`: `id, orgId, userId` (nullable string — null for DELEGATE without a user), `airwallexCardholderId` string, `type` CardholderType, `status` CardholderStatus, `createdAt, updatedAt` ISO
    - `card`: `id, orgId, projectId` nullable, `categoryId` nullable, `cardholderId`, `airwallexCardId`, `maskedNumber` string (e.g. `************1234` — never full PAN), `nickName` string 1–100, `purpose` CardPurpose, `status` CardStatus, `desiredControls` CardControls, `appliedControls` CardControls, `lastReconciledAt` nullable ISO, `managedByRuleIds` string[] (empty in B5), `accessList` string[] (user ids who may view/use), `createdAt, updatedAt`
    - `cardControls` (domain — camelCase; RULES-ENGINE field names):
      - `allowedTransactionCount`: `SINGLE | MULTIPLE` — **required**, immutable after create
      - `transactionLimits`: `{ currency: string length 3, limits: { interval: TransactionLimitInterval, amount: nonnegative int minor units }[] }` — **required**, at least one limit
      - `activeFrom` / `activeTo`: nullable ISO datetime
      - `allowedCurrencies`: `string[] | null` — `null` = unconstrained (omit at Airwallex); **never store or accept `[]` as a value to push**
      - `allowedMerchantCategories`: `string[] | null` (MCC codes) — same empty semantics
      - `allowedMerchantCountries`: `string[] | null` (ISO-3166) — same
      - `allowedMerchantBrands`: `string[] | null` — same
      - `blockedTransactionUsages`: `{ transactionScope: string, usageScope: string }[]` (union semantics in B6; B5 stores as given)
    - Inputs:
      - `createCardholderInput`: `{ userId?: string, type: CardholderType }` — INDIVIDUAL requires userId; DELEGATE may omit
      - `createCardInput`: `{ purpose, cardholderId, nickName?, categoryId?, accessList?, desiredControls }` — service derives SINGLE/MULTIPLE from purpose if omitted (VENDOR/ONE_TIME → SINGLE; else MULTIPLE)
      - `updateCardInput`: partial `{ nickName?, accessList?, desiredControls? }` — must **not** allow changing `allowedTransactionCount`
      - `closeCardInput`: `{ confirm: true }` — literal true required
      - `panTokenOutput`: `{ token: string, expiresAt: ISO }` — **no** PAN/CVV/expiry/card number fields ever
      - `cardLimitsOutput`: `{ currency, limits: { interval, amount, remaining }[], cachedAt: ISO }` — amounts in **minor units** on the wire to the client; convert from Airwallex major units in the service
    - Lists: `listCardholdersQuery` / `listCardsQuery` — page default 1, pageSize default 20 max 100 → `{ items, page, pageSize, total }`; org cards may filter `projectId?`, `status?`, `purpose?`
  - **Contracts table (every row):**
    - GET `/api/cardholders` → list
    - POST `/api/cardholders` → createCardholderInput → cardholder
    - GET `/api/cardholders/:id` → cardholder
    - GET `/api/cards` → list (org-wide, scope-filtered)
    - GET `/api/projects/:id/cards` → list
    - POST `/api/projects/:id/cards` → createCardInput → card
    - GET `/api/cards/:id` → card
    - PATCH `/api/cards/:id` → updateCardInput → card
    - POST `/api/cards/:id/freeze` → card
    - POST `/api/cards/:id/unfreeze` → card
    - POST `/api/cards/:id/close` → closeCardInput → card
    - GET `/api/cards/:id/limits` → cardLimitsOutput
    - POST `/api/cards/:id/pan-token` → panTokenOutput
    - POST `/api/cards/:id/reconcile` → card
  - **Pattern:** `src/shared/contracts/budget.ts`, `src/shared/schemas/budget.ts`, `src/shared/schemas/base.ts`
  - **STOP and get reviewed before implementing.** Highest-risk: empty-allowlist semantics, controls camelCase vs Airwallex snake_case, purpose `MEMBER` (not PER_MEMBER), minor↔major conversion, PAN token response (no PAN fields ever).
  - **Locked policies (do not reopen in later tasks):**
    1. Purpose enum is `SHARED | MEMBER | VENDOR | ONE_TIME` (ARCHITECTURE / RULES-ENGINE). `cardStructure.perMember` ↔ purpose `MEMBER`.
    2. Allowlists: domain `null` = unconstrained (omit field when calling Airwallex). Wire `[]` → `422 VALIDATION_FAILED`. Computed empty intersection → conflict, never push `[]`/`null`/absent as a lockdown.
    3. `allowedTransactionCount` immutable after create; VENDOR/ONE_TIME → SINGLE; SHARED/MEMBER → MULTIPLE.
    4. Domain amounts are integer minor units; Airwallex Issuing limit amounts are **major** currency units — convert only in `controls.ts` (÷/× 100 for 2-decimal currencies; document zero-decimal currencies if config lists any).
    5. Never call `GET /issuing/cards/{id}/details` (PCI). PAN only via pantoken + iframe.
    6. `request_id` for creates: `allocard-card-{localCardDocId}` / `allocard-cardholder-{localCardholderDocId}`.
    7. Cross-org → 404 never 403. Scope miss → 403. CLOSED card → further mutations 409.
    8. Card create when cardholder `status != READY` → **409 CONFLICT** with message naming the status and `details: { retryable: true, cardholderStatus }` — no Airwallex card create, no local card left half-issued. (B6 maps the same condition to rule-run `SKIPPED`; do not invent a new ErrorCode.)
  - **Accept:** `pnpm typecheck`
  - **Notes:** Locked in review: PENDING/non-READY cardholder on card create → 409 CONFLICT + `details: { retryable: true, cardholderStatus }` (policy #8). Contracts + enums + schemas shipped; `pnpm verify` green.

## Implementation tasks

### B5.1 — Cardholder + Card models

- [x] **B5.1**
  - **Files:** `src/server/models/Cardholder.ts`, `src/server/models/Card.ts`, colocated tests `src/server/models/cardholder.test.ts`, `src/server/models/card.test.ts`
  - **Do:** Tenant-scoped via `tenantScoped`. Indexes (ARCHITECTURE §5):
    - Cardholder: unique `(orgId, userId)` **partial where userId exists**
    - Card: unique `(orgId, airwallexCardId)`; compound `(orgId, projectId, status)`; also `(orgId, cardholderId)` for lookups
    - Persist both `desiredControls` and `appliedControls` as Mixed/subdocs matching cardControls schema
    - Never store PAN, CVV, or expiry — only `maskedNumber`
    - Storage: Dates in Mongo; `toDomain` → ISO on the wire (same as Project/Budget)
  - **Pattern:** `src/server/models/Budget.ts`, `src/server/models/Membership.ts` (B1 tenant plugin)
  - **Accept:** `pnpm test models/card`
  - **Notes:** Single `card.test.ts` covers both models. Partial unique on cardholder userId; multiple null-userId DELEGATEs allowed. Controls subdocs with Date windows.

### B5.2 — Airwallex client skeleton + fixture mode + FundingSource

- [x] **B5.2**
  - **Files:**
    - `src/server/airwallex/client.ts` — `AirwallexClient` + `forAccount(accountId: string | null)`
    - `src/server/airwallex/auth.ts` — login + Redis token cache + refresh mutex
    - `src/server/airwallex/http.ts` — request helper: backoff+jitter on 429/5xx only; one retry on `credentials_expired`
    - `src/server/airwallex/errors.ts` — typed Airwallex errors
    - `src/server/airwallex/logging.ts` — structured logs: method, endpoint, request_id, status, duration — **never bodies**
    - `src/server/airwallex/fixtures/load.ts` — replay recorded JSON by method+path(+request_id)
    - `src/server/services/cards/funding.ts` — `FundingSource` interface + single-wallet impl (`resolve` → `{}`, `availableBalance` via balances later / stub returning 0 until B8)
    - extend `src/server/env.ts` with `AIRWALLEX_USE_FIXTURES: z.enum(['true','false']).default(...)` — **default `true` when `VITEST===true`, else `false`**
    - tests under `src/server/airwallex/*.test.ts`
  - **Do:** Implement integration guide §10 + §2 forward-compat #1/#5/#6:
    - Token Redis key: `redisKeys.awToken()` → `aw:token` when accountId null; if accountId set use `aw:token:{accountId}` (add helper if needed)
    - Config cache keyed by account id (prepare key helper now; fill in B5.3)
    - Demo always `forAccount(null)`
    - Fixture mode replays recordings; under Vitest fixtures are required — network guard in `test/setup.ts` already rejects real fetch; assert fixture-miss surfaces a clear error (not a network attempt)
    - **Do not** implement `GET .../details`
  - **Pattern:** `src/server/redis.ts` (`awToken`, `lockCard`); `src/server/env.ts` Zod style from B0/B1
  - **Accept:** `pnpm test airwallex` — fixture hit; missing fixture does not call network; token cache mutex smoke
  - **Notes:** Fixture recordings under `fixtures/recordings/`. `awConfig` + `cardLimits` redis keys added. Vitest unit project includes `airwallex/**/*.test.ts`.

### B5.3 — Issuing API wrappers (cardholders, cards, limits, pan token, config)

- [x] **B5.3**
  - **Files:**
    - `src/server/airwallex/cardholders.ts` — create/get/update
    - `src/server/airwallex/cards.ts` — create/get/list/update/limits/activate
    - `src/server/airwallex/config.ts` — get issuing config (per-currency default + maximum)
    - `src/server/airwallex/panTokens.ts` — create pantoken
    - `src/server/airwallex/transactions.ts` — **stub only** with `TODO(B8)` exports that throw (keeps client shape per §10)
    - fixtures under `src/server/airwallex/fixtures/` for each method used in B5 (commit recorded JSON)
    - tests `src/server/airwallex/issuing.test.ts`
  - **Do:**
    - Idempotent creates take caller `request_id` (format locked in B5.0)
    - `cards.list(ctx, …)` **requires OrgContext** and **always** filters `metadata.orgId` internally — expose **no** unfiltered list; if a raw list is ever needed name it `listAllTenantsUnsafe` and do not call it from request paths
    - Always write `metadata.orgId`, `metadata.projectId`, `metadata.cardDocId` on create
    - Cache `GET /issuing/config` at first use (keyed by account id); expose `getMaxLimit(currency)` for clamp
    - Never add a `details` method
  - **Pattern:** B5.2 client; method split mirrors `docs/ARCHITECTURE.md` tree (`airwallex/cardholders.ts`, `cards.ts`, …)
  - **Accept:** `pnpm test airwallex/issuing` — request_id stable; list always org-filtered; config max readable
  - **Notes:** Client namespaces wired; `list` org-filters; `listAllTenantsUnsafe` escape hatch; config Redis-cached; no `details`; transactions stub TODO(B8). `pnpm verify` green.

### B5.4 — Cardholder + Card repositories

- [x] **B5.4**
  - **Files:** `src/server/repositories/cardholders.ts`, `src/server/repositories/cards.ts`, `src/server/repositories/cardholders.test.ts`, `src/server/repositories/cards.test.ts` (or colocated `repositories/card*.test.ts`)
  - **Do:** `OrgContext` first on every method. Include: create/findById/findByAirwallexId/list (pagination + filters), updateStatus, updateDesiredControls, updateAppliedControls (set applied + lastReconciledAt), updateNickname/accessList, countNonClosedByProject (for noActiveCards). Cross-org find → null (handler maps to 404).
  - **Pattern:** `src/server/repositories/budgets.ts`, `src/server/repositories/memberships.ts` (B1)
  - **Accept:** `pnpm test repositories/card`
  - **Notes:** Cross-org null; countNonClosedByProject for B5.12; controls Dates ↔ ISO at boundary. `pnpm verify` green.

### B5.5 — Controls mapping (domain ↔ authorization_controls)

- [ ] **B5.5**
  - **Files:** `src/server/services/cards/controls.ts`, `src/server/services/cards/controls.test.ts`
  - **Do:** Pure functions, no I/O:
    - `toAirwallexControls(domain): authorization_controls` — camelCase → snake_case; minor → major; omit allowlist fields when domain value is `null`; **throw typed conflict** if any allowlist is `[]` or would push empty
    - `fromAirwallexControls(aw): CardControls` — reverse; major → minor
    - `purposeToTransactionCount(purpose): SINGLE | MULTIPLE` — VENDOR/ONE_TIME → SINGLE; else MULTIPLE
    - `clampLimits(controls, maxByCurrency): { controls, clamped: boolean }` — clamp each amount to config maximum (compare in the same unit; convert max if Airwallex returns major)
    - `assertTransactionCountImmutable(existing, next)` — reject changes
    - Empty-array trap tests are mandatory
  - **Pattern:** pure style of `src/server/services/budget/projectProjection.ts`
  - **Accept:** `pnpm test cards/controls` — empty intersection/[] conflict; clamp flagged; SINGLE immutability; minor↔major round-trip for USD
  - **Notes:**

### B5.6 — Card reconciler

- [ ] **B5.6**
  - **Files:** `src/server/services/cards/reconciler.ts`, `src/server/services/cards/reconciler.test.ts`
  - **Do:** `reconcileCard(ctx, cardId)` under `redisKeys.lockCard(cardId)` (`lock:card:{cardId}`, SET NX PX 10000, retry like budget ledger):
    1. Load card; if CLOSED → 409
    2. Diff `desiredControls` vs `appliedControls` (and status only if this path is used — B5 freeze/close use dedicated services)
    3. If no-op → return card, **no Airwallex call**
    4. Else map via controls.ts, push minimal `POST .../update` patch
    5. On success: write `appliedControls = desiredControls`, set `lastReconciledAt`
    6. On Airwallex 5xx: leave `desiredControls` intact, rethrow/retryable error
    7. Emit `card.limit_updated` when limits changed
  - **Pattern:** lock + unit-of-work style of `src/server/services/budget/ledger.ts`
  - **Accept:** `pnpm test cards/reconciler` — minimal patch; no-op; 5xx preserves desired
  - **Notes:**

### B5.7 — Cardholder provisioning on member-add + cardholder service

- [ ] **B5.7**
  - **Files:**
    - `src/server/services/cardholders/ensure.ts` (or `provision.ts`) — ensure INDIVIDUAL cardholder for a user
    - `src/server/services/cardholders/create.ts` — explicit create (DELEGATE path)
    - extend `src/server/services/projectMembers/mutate.ts` — after successful `addProjectMember`, call ensure (do not fail member-add if Airwallex screening is PENDING; persist local PENDING mirror)
    - tests: `src/server/services/cardholders/*.test.ts`, extend `test/api/project-members.test.ts`
  - **Do:** Create cardholder at **member-add**, not card-create. Type `INDIVIDUAL` when tying to a user; `DELEGATE` for shared/vendor/one-time card flows (create at card-create if no cardholder yet). Treat `status != READY` at card-issue time as **retryable skip**, never hard failure. Idempotent ensure on `(orgId, userId)`.
  - **Pattern:** `src/server/services/projectMembers/mutate.ts` (extend); B1 membership create for audit/event style
  - **Accept:** `pnpm test api/project-members` and `pnpm test services/cardholders` green
  - **Notes:**

### B5.8 — Cardholder HTTP API

- [ ] **B5.8**
  - **Files:**
    - `src/app/api/cardholders/route.ts` — GET list, POST create
    - `src/app/api/cardholders/[id]/route.ts` — GET :id
    - `src/server/services/cardholders/list.ts`, `get.ts` (create in B5.7)
    - `test/api/cardholders.test.ts`
  - **Do:** GET list / GET :id require `card.view`; POST requires `member.manage`. Cross-org → 404. Response includes screening `status`. Matrix #1–#4, #7, #8; #10 on POST.
  - **Pattern:** `src/app/api/roles/route.ts`, `src/app/api/organizations/[id]/members/route.ts` (B1)
  - **Accept:** `pnpm test api/cardholders` — matrix #1–#4, #7, #8
  - **Notes:**

### B5.9 — Cards HTTP API (list/create/get/patch)

- [ ] **B5.9**
  - **Files:**
    - `src/app/api/cards/route.ts` — GET org list
    - `src/app/api/projects/[id]/cards/route.ts` — GET list + POST create
    - `src/app/api/cards/[id]/route.ts` — GET + PATCH
    - `src/server/services/cards/create.ts`, `list.ts`, `get.ts`, `update.ts`
    - `test/api/cards.test.ts`
    - optional: extend `test/helpers/factories/index.ts` with `makeCardControls()` defaults (minor-unit limits)
  - **Do:**
    - Lists: `card.view`, scope-filtered (CARD scope / accessList / project membership — follow `requirePermission` subject `{ projectId, cardId }`)
    - POST create: `card.create` with subject `{ projectId }`; persist local card first → Airwallex create with `request_id` + metadata.orgId/projectId/cardDocId; form_factor VIRTUAL; `is_personalized` true for MEMBER else false; set `allowed_transaction_count` from purpose
    - PENDING (or any non-READY) cardholder → **409 CONFLICT** per locked policy #8; never 500; never half-issue a local card
    - Empty allowlist on input → 422 and **zero** Airwallex calls
    - PATCH: `card.manage` + subject; update nickName/accessList/desiredControls then reconcile
    - GET :id: local mirror; optionally refresh status from Airwallex get (fixture); never call details
  - **Pattern:** `src/app/api/projects/[id]/budget/route.ts`, `src/server/services/budget/put.ts`
  - **Accept:** `pnpm test api/cards` — metadata on create; PENDING skip; empty allowlist never calls Airwallex; matrix rows that apply including #5 scope
  - **Notes:**

### B5.10 — Freeze / unfreeze / close

- [ ] **B5.10**
  - **Files:**
    - `src/app/api/cards/[id]/freeze/route.ts`
    - `src/app/api/cards/[id]/unfreeze/route.ts`
    - `src/app/api/cards/[id]/close/route.ts`
    - `src/server/services/cards/lifecycle.ts`
    - `test/api/card-lifecycle.test.ts`
  - **Do:** All require `card.manage` + scope subject `{ projectId, cardId }`. freeze → INACTIVE; unfreeze → ACTIVE; close → CLOSED with `{ confirm: true }` (else 422). CLOSED is terminal — further freeze/unfreeze/patch/reconcile → 409. Push status via Airwallex update under `lock:card:{cardId}`. Emit `card.status_changed`. Exactly one audit per call.
  - **Pattern:** `src/app/api/projects/[id]/transition/route.ts` (B2 state machine style)
  - **Accept:** `pnpm test api/card-lifecycle` — irreversible close; mutations on CLOSED rejected
  - **Notes:**

### B5.11 — Limits + pan-token + reconcile endpoints

- [ ] **B5.11**
  - **Files:**
    - `src/app/api/cards/[id]/limits/route.ts`
    - `src/app/api/cards/[id]/pan-token/route.ts`
    - `src/app/api/cards/[id]/reconcile/route.ts`
    - `src/server/services/cards/limits.ts`, `panToken.ts`, (reconcile reuses B5.6)
    - `test/api/card-limits.test.ts`, `test/api/card-pan-token.test.ts`, `test/api/card-reconcile.test.ts` (or fold reconcile into cards tests)
  - **Do:**
    - Limits: `card.view` + scope; live from Airwallex `GET .../limits`; Redis cache ~30s (add `redisKeys.cardLimits(cardId)` → `card:limits:{cardId}`); convert major→minor for response; **never** compute from local ledger
    - PAN token: `card.viewDetails` **and** scope (accessList / CARD scope); audit every reveal; response = panTokenOutput only
    - Denied without viewDetails → 403; out of scope → 403; cross-org → 404
    - Reconcile: `card.manage` + scope; force B5.6 diff-and-push
  - **Pattern:** permission+audit style of `src/app/api/projects/[id]/members/[userId]/route.ts` (B3)
  - **Accept:** `pnpm test api/card-limits` and `pnpm test api/card-pan-token` — deny without viewDetails; deny out of scope; audit on success
  - **Notes:**

### B5.12 — Harden B2 noActiveCards + overview card counts

- [ ] **B5.12**
  - **Files:** `src/server/services/projects/transition.ts` (`applyNoActiveCards`), `src/server/services/projects/get.ts` (`activeCardCount`), extend `test/api/project-transition.test.ts` and `test/api/projects.test.ts`
  - **Do:** Block ACTIVE→CLOSING while any project card has `status != CLOSED` (count via cards repo). Overview `activeCardCount` = count of non-CLOSED cards on the project (or strictly ACTIVE — **prefer non-CLOSED** so PENDING/INACTIVE still block close; lock in Notes). Clear `TODO(B5)` comments.
  - **Pattern:** B4.12 hasBudget hardening in the same files
  - **Accept:** `pnpm test api/project-transition` and `pnpm test api/projects` green
  - **Notes:**

### B5.13 — Events + audit coverage

- [ ] **B5.13**
  - **Files:** `test/events/cards.test.ts`, `test/audit/b5.test.ts`; payload types in `src/server/events/types.ts` if missing (event names already exist: `card.created`, `card.status_changed`, `card.limit_updated`)
  - **Do:** Each event once with right payload/subject. One audit assertion per mutating card/cardholder endpoint **including pan-token**. Exactly one audit per successful mutation.
  - **Pattern:** `test/events/budget.test.ts`, `test/audit/b4.test.ts`
  - **Accept:** `pnpm test events/cards` and `pnpm test audit/b5`
  - **Notes:**

### B5.14 — Seed extension

- [ ] **B5.14**
  - **Files:** `scripts/seed.ts`, `test/seed.test.ts`
  - **Do:** `seedB5` — under fixture mode, idempotent: at least one READY INDIVIDUAL cardholder for a SEED-ACTIVE member; one DELEGATE if useful; at least one ACTIVE card on SEED-ACTIVE with `desiredControls === appliedControls` (MEMBER purpose). Do not duplicate on re-run.
  - **Pattern:** `seedB4` in `scripts/seed.ts`
  - **Accept:** `pnpm test seed`
  - **Notes:**

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Standard endpoint matrix passing for every B5 endpoint (#1–#10 as applicable; #5 on card-scoped routes; #9 where request_id retries apply)
- [ ] Fixture mode on by default in tests; network guard fails real calls (`test/setup.ts` + fixture loader)
- [ ] Every allowlist path has empty-intersection / empty-array guard
- [ ] `metadata.orgId` on create and filtered on every Airwallex list read
- [ ] `request_id` deterministic from local document id
- [ ] Per-card lock wraps every Airwallex patch (`lock:card:{cardId}`)
- [ ] PAN never in logs, responses, or DB; no `details` client method
- [ ] `desiredControls` / `appliedControls` both persisted and diffable
- [ ] Cardholders provisioned at member-add time
- [ ] Minor units on Allocard wire; major units only inside Airwallex mapping
- [ ] Purpose enum is `MEMBER` not `PER_MEMBER`
- [ ] B2 `TODO(B5)` noActiveCards / activeCardCount cleared in STATUS.md
- [ ] Spec's review checklist signed off
- [ ] STATUS.md updated: active phase B6, generate B6-TASKS.md
