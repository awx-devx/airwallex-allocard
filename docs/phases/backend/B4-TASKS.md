# B4 — Budget Ledger · Tasks

**Spec:** [B4-budget.md](./B4-budget.md)

**Model:** cheap — pattern-match B1/B2 models/repos/handlers; money is integer minor units only; do not invent float arithmetic or mutate balances in place.

**Depends on:** B3, complete and verified

## Contracts first

- [x] **B4.0** — Schemas and contracts
  - **Files:**
    - `src/shared/enums/budgetEntryType.ts`
    - `src/shared/enums/budgetEntrySourceType.ts`
    - `src/shared/enums/budgetChangeRequestStatus.ts`
    - `src/shared/schemas/budget.ts`
    - `src/shared/types/budget.ts`
    - `src/shared/contracts/budget.ts`
    - extend `src/shared/schemas/project.ts` with `budgetSnapshot` (nullable on project until first ledger write)
  - **Do:** Every endpoint in the spec's table gets a contract entry. Inline shapes (amounts = integer **minor units**, never float):
    - `BudgetEntryType`: `APPROVAL | COMMITMENT | ACTUAL | RELEASE | ADJUSTMENT`
    - `BudgetEntrySourceType`: `PURCHASE_REQUEST | AUTHORIZATION | TRANSACTION | MANUAL | RULE`
    - `BudgetChangeRequestStatus`: `PENDING | APPROVED | REJECTED`
    - `budgetCategory`: id, name (1-120), workstreamId optional/nullable, allocated nonnegative int (minor units), formula optional/nullable
    - `budget`: id, orgId, projectId, currency length 3, approvedAmount nonnegative int, formula optional, categories[], thresholdPcts int 1-1000[] (default 80/90/100), createdAt, updatedAt
    - `budgetProjection` / `budgetSnapshot`: approved, committed, actual, remaining (may be negative), utilisationPct nonnegative int (floor((committed+actual)*100/approved); if approved is 0 then 100 if committed+actual positive else 0), overCommitted (true when remaining negative), updatedAt
    - `budgetDetail` (GET budget response): budget (nullable) + projection
    - `putBudgetInput`: currency, approvedAmount, optional formula/thresholdPcts — creates budget if missing; always appends one APPROVAL entry (ledger rules owned by B4.5)
    - `createBudgetCategoryInput`: name, optional workstreamId, allocated, optional formula — if both allocated and formula, formula wins at write
    - `updateBudgetCategoryInput`: partial name/workstreamId/allocated/formula
    - `budgetEntry`: id, orgId, projectId, categoryId nullable, type, amount int (signed for ADJUSTMENT; other types nonnegative at service), currency, sourceType, sourceId, lifecycleId nullable (required field, null until B8), createdBy, note nullable, createdAt
    - `listBudgetEntriesQuery`: optional type/from/to, page default 1, pageSize default 20 max 100 → items/page/pageSize/total
    - `createBudgetEntryInput` (public): amount, optional note/categoryId — service forces ADJUSTMENT + MANUAL (no type on the wire)
    - `budgetChangeRequest`: id, orgId, projectId, requestedBy, deltaAmount nonzero int (may be negative), reason 1-2000, status, decidedBy/decidedAt nullable, createdAt, updatedAt
    - `createBudgetChangeRequestInput`: nonzero deltaAmount + reason
    - `decideBudgetChangeRequestInput`: decision APPROVE or REJECT, optional note
    - `validateFormulaInput`: expression max 500, optional context map of string to int
    - `validateFormulaOutput`: ok true + value int, or ok false + error string
    - `budgetHistoryItem`: same shape as project history (`at`, not createdAt)
  - **Contracts table (every row):**
    - GET `/api/projects/:id/budget` → budgetDetail
    - PUT `/api/projects/:id/budget` → putBudgetInput → budgetDetail
    - GET/POST `/api/projects/:id/budget/categories`
    - PATCH/DELETE `/api/projects/:id/budget/categories/:catId`
    - GET/POST `/api/projects/:id/budget/entries`
    - GET `/api/projects/:id/budget/history`
    - GET/POST `/api/projects/:id/budget/change-requests`
    - POST `/api/budget/change-requests/:id/decide`
    - POST `/api/budget/formula/validate`
  - **Pattern:** `src/shared/contracts/project.ts`, `src/shared/schemas/project.ts`, `src/shared/schemas/base.ts`
  - **STOP and get reviewed before implementing.** Highest-risk: projection field meanings, putBudgetInput vs APPROVAL append semantics, lifecycleId nullability, category over-allocation policy (locked below).
  - **Locked policies (do not reopen in later tasks):**
    1. Sum of category.allocated must not exceed budget.approvedAmount → 422 VALIDATION_FAILED or 409 CONFLICT (prefer 422; locked in Notes).
    2. remaining may be negative; overCommitted when remaining is negative — never clamp silently.
    3. Public API cannot create COMMITMENT, ACTUAL, RELEASE, or APPROVAL via POST entries — only ADJUSTMENT.
  - **Accept:** `pnpm typecheck`
  - **Notes:** Locked in B4.0:
    1. Sum of category.allocated exceeds approvedAmount → 422 VALIDATION_FAILED.
    2. remaining may be negative; overCommitted when remaining is negative — never clamp.
    3. Public POST entries accept only amount/note/categoryId — service forces ADJUSTMENT+MANUAL; no type on the wire.
    4. GET with no budget → budget null + zero projection (budgetDetail.budget nullable).
    5. Category create: if both allocated and formula, formula wins (evaluated into allocated at write).
    6. History mirrors projectHistoryEntrySchema (`at`, not createdAt).
    7. lifecycleId required on entry schema, nullable until B8.
    8. thresholdPcts default 80/90/100 when omitted on PUT (service).
    9. Project.budgetSnapshot on public project schema (null until first ledger write); repo maps missing field → null until B4.1 model.

## Implementation tasks

B4.0 is done. Remaining work below.

### B4.1 — Budget models + Project.budgetSnapshot

- [x] **B4.1**
- **Files:** `src/server/models/Budget.ts`, `src/server/models/BudgetEntry.ts`, `src/server/models/BudgetChangeRequest.ts`, `src/server/models/Project.ts` (add budgetSnapshot subdoc, nullable), colocated model tests under `src/server/models/`
- **Do:** Tenant-scoped via tenantScoped on all three budget models. Indexes: Budget unique (orgId, projectId); BudgetEntry (orgId, projectId, createdAt desc), (orgId, projectId, type, createdAt desc), (orgId, lifecycleId) sparse/partial where lifecycleId non-null; BudgetChangeRequest (orgId, projectId, status, createdAt desc). Embed categories[] on Budget with `_id: false` and explicit string id (same pattern as Project workstreams). Storage: Dates in Mongo; toDomain → ISO on the wire. amount / allocated / approvedAmount / deltaAmount are Number integers — never Decimal128 floats. lifecycleId field exists on BudgetEntry (String or null, default null).
- **Pattern:** `src/server/models/Project.ts`, `src/server/models/Membership.ts`
- **Accept:** `pnpm test models/budget`
- **Notes:** Budget unique (orgId, projectId); categories `_id: false` + explicit id; BudgetEntry partial index on lifecycleId when string; Project.budgetSnapshot nullable subdoc (Date updatedAt in Mongo). Amounts are Number integers.

### B4.2 — Formula parser (lib/formula)

- [x] **B4.2**
- **Files:** `src/server/lib/formula/parse.ts`, `src/server/lib/formula/evaluate.ts`, `src/server/lib/formula/index.ts`, `src/server/lib/formula/formula.test.ts`
- **Do:** Sandboxed expression evaluator for B4 category formulas (B6 will extend attribute resolution later). Support: + - * /, parentheses, min, max, round, floor, ceil, clamp, pct, and identifiers that resolve from a string→number context of integer sibling budget fields (e.g. approvedAmount). Rules: no eval, no Function, no property access (dot / brackets), no assignment. Node-count cap (e.g. 64) and evaluation timeout (e.g. 25ms) — document constants in file header. Division by zero → typed error. Unknown identifier → typed error. Oversized expression → typed error. All intermediate and final values are integers (truncate toward zero after each op, or use integer-only ops — state the rule in Notes; never introduce IEEE floats into stored amounts).
- **Pattern:** pure-function style of `src/server/services/access/computeEffectivePermissions.ts` (no I/O)
- **Accept:** `pnpm test lib/formula` — precedence; each allowlisted function; div-by-zero; unknown id; oversized; property-access attempt; eval attempt; integer-only results
- **Notes:** Hand-rolled recursive-descent parser (no eval/Function). Caps: length 500, nodes 64, eval 25ms. Integer rule: Math.trunc toward zero after every op/function. pct(x,p)=trunc(x*p/100). clamp(x,lo,hi). Vitest unit include for `src/server/lib/**/*.test.ts`.

### B4.3 — Projection pure function

- [x] **B4.3**
- **Files:** `src/server/services/budget/projectProjection.ts`, `src/server/services/budget/projectProjection.test.ts`
- **Do:** Export projectBudget(entries) returning a budget snapshot without updatedAt. Formulas: approved = sum(APPROVAL) + sum(ADJUSTMENT); committed = sum(COMMITMENT) - sum(RELEASE); actual = sum(ACTUAL); remaining = approved - committed - actual; plus utilisationPct and overCommitted per B4.0. No I/O. Property-style test: random sequences of entries → snapshot equals recompute-from-scratch (same function twice is fine; later ledger tests compare DB snapshot to this function).
- **Pattern:** `src/server/services/projects/transitions.ts` (pure, table-driven tests)
- **Accept:** `pnpm test budget/projectProjection` — long mixed sequence; negative remaining flagged; RELEASE reduces committed
- **Notes:** utilisationPct uses Math.floor; approved===0 → 100 if utilised>0 else 0. remaining never clamped; overCommitted = remaining < 0.

### B4.4 — Budget repositories

- [x] **B4.4**
- **Files:** `src/server/repositories/budgets.ts`, `src/server/repositories/budgetEntries.ts`, `src/server/repositories/budgetChangeRequests.ts`, matching tests; extend `src/server/repositories/projects.ts`
- **Do:** OrgContext first on every method. Include: findBudgetByProject, upsertBudgetFields, replaceCategories / category helpers, appendEntry (insert only — no update of amount), listEntries (filters + pagination), findEntriesByProject (for recompute), countEntriesReferencingCategory, createChangeRequest, listChangeRequests, decideChangeRequest (conditional on PENDING). Also updateProjectBudgetSnapshot(ctx, projectId, snapshot) in projects repo.
- **Pattern:** `src/server/repositories/projects.ts`, `src/server/repositories/memberships.ts`
- **Accept:** `pnpm test repositories/budget`
- **Notes:** Append-only entries; decideChangeRequest conditional on PENDING. updateProjectBudgetSnapshot stores Date updatedAt. Category helpers: add/update/delete/replaceCategories.

### B4.5 — Ledger write path (single mutation authority)

- [x] **B4.5**
- **Files:** `src/server/services/budget/ledger.ts`, `src/server/services/budget/ledger.test.ts`, extend `src/server/redis.ts` with redisKeys.lockBudget(projectId) → `lock:budget:` + projectId
- **Do:** One service function used by all writers, e.g. appendBudgetEntry(ctx, projectId, entryInput) returns entry + projection: (1) acquire per-project Redis lock (SET NX + PX, same pattern as card locks); (2) insert entry append-only; (3) load all entries → projectBudget → write Project.budgetSnapshot + Redis `budget:project:` + projectId in the same unit of work (await both; if Redis fails, fail the request); (4) compare previous vs new utilisationPct against budget.thresholdPcts; on edge cross upward emit budget.threshold_crossed (crossing only — not while merely above); (5) emit budget.updated (and budget.approved when type is APPROVAL / first approval); (6) write exactly one audit entry for the mutation that called the ledger (prefer audit in the HTTP-facing service after ledger returns). Concurrent double-append test: final projection matches full recompute.
- **Pattern:** lock usage in `src/server/redis.test.ts`; event publish in `src/server/services/projects/create.ts`
- **Accept:** `pnpm test budget/ledger` — snapshot==recompute; threshold edge-triggered; concurrent writes; Redis key shape `budget:project:` + id
- **Notes:** Per-project Redis lock `lock:budget:{id}` (NX+PX, retry). Audit deferred to HTTP services. Emits budget.updated always; budget.approved on APPROVAL; threshold_crossed edge-up only. Mongo snapshot then Redis; Redis failure fails the request.

### B4.6 — GET + PUT project budget

- [x] **B4.6**
- **Files:** `src/app/api/projects/[id]/budget/route.ts`, `src/server/services/budget/get.ts`, `src/server/services/budget/put.ts`, `test/api/budget.test.ts`
- **Do:** GET requires budget.view with projectId; 404 if project missing (cross-org → 404); if no budget yet return budget null + zero projection (locked in B4.0). PUT requires budget.edit; upsert currency/approvedAmount/formula/thresholds; append APPROVAL via ledger (sourceType MANUAL); return budgetDetail.
- **Pattern:** `src/app/api/projects/[id]/route.ts`, `src/server/services/projects/get.ts`
- **Accept:** `pnpm test api/budget` — matrix rows #1 auth, #2 onboarding, #3 cross-org 404, #4 under-permission, #6 validation, #7 happy path
- **Notes:** GET with no budget → `{ budget: null, projection: zeros }`. PUT upserts header then appends delta: APPROVAL if delta≥0, ADJUSTMENT if delta<0 (keeps APPROVAL amounts nonnegative). Audit budget.created/updated.

### B4.7 — Categories CRUD

- [x] **B4.7**
- **Files:** `src/app/api/projects/[id]/budget/categories/route.ts`, `src/app/api/projects/[id]/budget/categories/[catId]/route.ts`, `src/server/services/budget/categories.ts`, `test/api/budget-categories.test.ts`
- **Do:** List/create/update/delete. Permissions budget.view / budget.edit + projectId. Create may evaluate formula via lib/formula with integer context. Reject create/update when sum(allocated) exceeds approvedAmount. DELETE rejected if any entry references categoryId (409 CONFLICT). If workstreamId set, must exist on the project.
- **Pattern:** `src/app/api/projects/[id]/workstreams/route.ts`, `src/server/services/projects/workstreams.ts`
- **Accept:** `pnpm test api/budget-categories`
- **Notes:**

### B4.8 — Entries list + manual ADJUSTMENT

- [x] **B4.8**
- **Files:** `src/app/api/projects/[id]/budget/entries/route.ts`, `src/server/services/budget/entries.ts`, `test/api/budget-entries.test.ts`
- **Do:** GET paginated/filterable (budget.view). POST only ADJUSTMENT + MANUAL via ledger (budget.edit). Contract input must not accept type; add a service-level test that internal ledger can write COMMITMENT but HTTP cannot.
- **Pattern:** `src/app/api/projects/route.ts` list pagination
- **Accept:** `pnpm test api/budget-entries` — COMMITMENT/ACTUAL unreachable from HTTP
- **Notes:**

### B4.9 — Budget history

- [x] **B4.9**
- **Files:** `src/app/api/projects/[id]/budget/history/route.ts`, `src/server/services/budget/history.ts`, `test/api/budget-history.test.ts`
- **Do:** GET change history with actor and reason from audit logs for this project's budget subjects (budget.view). Newest first.
- **Pattern:** `src/app/api/projects/[id]/history/route.ts`, `src/server/services/projects/history.ts`
- **Accept:** `pnpm test api/budget-history`
- **Notes:**

### B4.10 — Change requests

- [x] **B4.10**
- **Files:** `src/app/api/projects/[id]/budget/change-requests/route.ts`, `src/app/api/budget/change-requests/[id]/decide/route.ts`, `src/server/services/budget/changeRequests.ts`, `test/api/budget-change-requests.test.ts`
- **Do:** POST change-requests requires budget.request + projectId; creates PENDING. GET requires budget.view. POST decide requires budget.edit with subject projectId from the request; APPROVE → append ADJUSTMENT for deltaAmount via ledger + set status; REJECT → status only. Concurrent double-decide → one wins, other 409.
- **Pattern:** `src/app/api/access-reviews/[id]/resolve/route.ts`, `src/server/services/accessReviews/resolve.ts`
- **Accept:** `pnpm test api/budget-change-requests`
- **Notes:**

### B4.11 — Formula validate endpoint

- [x] **B4.11**
- **Files:** `src/app/api/budget/formula/validate/route.ts`, `src/server/services/budget/validateFormula.ts`, `test/api/budget-formula.test.ts`
- **Do:** POST budget.edit — org-wide capability (prefer org-wide via membership like project.view). Parses and dry-evaluates; returns validateFormulaOutput.
- **Pattern:** `src/app/api/roles/route.ts` (org-level POST)
- **Accept:** `pnpm test api/budget-formula`
- **Notes:**

### B4.12 — Harden B2 budget TODOs

- [x] **B4.12**
- **Files:** `src/server/services/projects/transition.ts` (hasBudget), `src/server/services/projects/get.ts` (overview remaining/spent), `src/server/services/projects/workstreams.ts` (delete guard), extend existing api tests (do not rewrite)
- **Do:** hasBudget true iff project has a Budget with approvedAmount greater than 0 (or snapshot.approved greater than 0). Overview budgetRemaining / budgetSpent from budgetSnapshot as moneySchema; null if no snapshot. Workstream delete 409 if any budget category references workstreamId.
- **Pattern:** existing B2 services; keep diffs minimal
- **Accept:** `pnpm test api/project-transition` and `pnpm test api/workstreams` and `pnpm test api/projects` green
- **Notes:**

### B4.13 — budget:verify script

- [ ] **B4.13**
- **Files:** `scripts/budget-verify.ts`, package.json script budget:verify, `test/budget-verify.test.ts`
- **Do:** For every project with entries: recompute via projectBudget, compare to Project.budgetSnapshot and Redis key `budget:project:` + id. Exit non-zero on drift. Cover via test so pnpm verify includes it.
- **Pattern:** `scripts/seed.ts`
- **Accept:** `pnpm test budget-verify`
- **Notes:**

### B4.14 — Events + audit coverage

- [ ] **B4.14**
- **Files:** `src/server/events/types.ts` (payload types if missing), `test/events/budget.test.ts`, `test/audit/b4.test.ts`
- **Do:** budget.approved, budget.updated, budget.threshold_crossed once each with right payload. One audit assertion per mutating B4 endpoint (PUT budget, category CUD, POST entry, change-request create, decide).
- **Pattern:** `test/events/members.test.ts`, `test/audit/b3.test.ts`
- **Accept:** `pnpm test events/budget` and `pnpm test audit/b4`
- **Notes:**

### B4.15 — Seed extension

- [ ] **B4.15**
- **Files:** `scripts/seed.ts`, `test/seed.test.ts`
- **Do:** Append seedB4(orgId, ownerId, activeProjectId) — idempotent budget on SEED-ACTIVE with approved amount, at least 2 categories (one formula optional), one APPROVAL entry, one ADJUSTMENT, matching snapshot. Do not duplicate on re-run.
- **Pattern:** seedB2 / seedB3 in `scripts/seed.ts`
- **Accept:** `pnpm test seed`
- **Notes:**

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Standard endpoint matrix passing for every B4 endpoint
- [ ] No code path mutates a balance directly (append-only entries only)
- [ ] lifecycleId exists on BudgetEntry
- [ ] Snapshot + Redis update in the same unit of work as each entry
- [ ] pnpm budget:verify exists and is covered under pnpm verify via tests
- [ ] Formula parser allowlist reviewed (no arbitrary code execution)
- [ ] COMMITMENT / ACTUAL unreachable from the public API
- [ ] Threshold crossing is edge-triggered
- [ ] All amounts are integer minor units end to end
- [ ] B2 TODO(B4) markers cleared or updated in STATUS.md
- [ ] Spec's review checklist signed off
- [ ] STATUS.md updated: active phase B5, generate B5-TASKS.md
