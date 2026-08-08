# B4 — Budget Ledger · Tasks

**Spec:** [B4-budget.md](./B4-budget.md)
**Model:** cheap — pattern-match B1/B2 models/repos/handlers; money is integer minor units only; do not invent float arithmetic or mutate balances in place.
**Depends on:** B3, complete and verified

---

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
    - `budgetCategory`: `{ id: string, name: string (1–120), workstreamId?: string | null, allocated: number.int().nonnegative() /* minor units */, formula?: string | null }`
    - `budget`: `{ id, orgId, projectId, currency: string.length(3), approvedAmount: number.int().nonnegative(), formula?: string | null, categories: budgetCategory[], thresholdPcts: number.int().min(1).max(1000)[] /* utilisation % boundaries; default [80, 90, 100] */, createdAt, updatedAt }`
    - `budgetProjection` / `budgetSnapshot`: `{ approved: number.int(), committed: number.int(), actual: number.int(), remaining: number.int() /* may be negative */, utilisationPct: number.int().nonnegative() /* floor((committed+actual)*100/approved); if approved===0 then (committed+actual>0 ? 100 : 0) */, overCommitted: boolean /* remaining < 0 */, updatedAt: IsoDate }`
    - `budgetDetail` (GET budget response): `{ budget, projection: budgetProjection }`
    - `putBudgetInput`: `{ currency: string.length(3), approvedAmount: number.int().nonnegative(), formula?: string | null, thresholdPcts?: number.int().min(1).max(1000)[] }` — creates budget if missing; **always appends one `APPROVAL` entry** for the new approved total semantics defined in B4.5 Notes (do not redefine here — service owns ledger rules)
    - `createBudgetCategoryInput`: `{ name: string (1–120), workstreamId?: string | null, allocated: number.int().nonnegative(), formula?: string | null }` — either fixed `allocated` or `formula` (if both, prefer formula evaluation result into `allocated` at write time — state in Notes if you pick otherwise)
    - `updateBudgetCategoryInput`: partial `{ name?, workstreamId?, allocated?, formula? }`
    - `budgetEntry`: `{ id, orgId, projectId, categoryId: string | null, type: BudgetEntryType, amount: number.int() /* signed allowed for ADJUSTMENT; APPROVAL/COMMITMENT/ACTUAL/RELEASE amounts are nonnegative */, currency: string.length(3), sourceType: BudgetEntrySourceType, sourceId: string, lifecycleId: string | null /* required on schema from day one; null until B8 */, createdBy: string, note: string | null, createdAt }`
    - `listBudgetEntriesQuery`: `{ type?: BudgetEntryType, from?: IsoDate, to?: IsoDate, page?: number.int().min(1).default(1), pageSize?: number.int().min(1).max(100).default(20) }` → `{ items: budgetEntry[], page, pageSize, total }`
    - `createBudgetEntryInput` (public): `{ amount: number.int(), note?: string | null, categoryId?: string | null }` — **service forces** `type: ADJUSTMENT`, `sourceType: MANUAL`; rejecting any other type is a service concern
    - `budgetChangeRequest`: `{ id, orgId, projectId, requestedBy: string, deltaAmount: number.int() /* nonzero minor units; may be negative */, reason: string (1–2000), status: BudgetChangeRequestStatus, decidedBy: string | null, decidedAt: IsoDate | null, createdAt, updatedAt }`
    - `createBudgetChangeRequestInput`: `{ deltaAmount: number.int().refine(n => n !== 0), reason: string (1–2000) }`
    - `decideBudgetChangeRequestInput`: `{ decision: 'APPROVE' | 'REJECT', note?: string | null }`
    - `validateFormulaInput`: `{ expression: string.max(500), context?: Record<string, number.int()> }`
    - `validateFormulaOutput`: `{ ok: true, value: number.int() } | { ok: false, error: string }`
    - `budgetHistoryItem`: reuse audit-shaped `{ id, action, actorType, actorId, subjectType, subjectId, before?, after?, metadata?, createdAt }` or project-history pattern — pick one and keep consistent with `src/shared/schemas/project.ts` history item if present
  - **Contracts table (every row):**
    - `GET /api/projects/:id/budget` → `budgetDetail`
    - `PUT /api/projects/:id/budget` → input `putBudgetInput`, output `budgetDetail`
    - `GET|POST /api/projects/:id/budget/categories` → list `budgetCategory[]` / create input+`budgetCategory`
    - `PATCH|DELETE /api/projects/:id/budget/categories/:catId`
    - `GET|POST /api/projects/:id/budget/entries`
    - `GET /api/projects/:id/budget/history`
    - `GET|POST /api/projects/:id/budget/change-requests`
    - `POST /api/budget/change-requests/:id/decide`
    - `POST /api/budget/formula/validate`
  - **Pattern:** `src/shared/contracts/project.ts`, `src/shared/schemas/project.ts`, `src/shared/schemas/base.ts` (`moneySchema` for any `{ amount, currency }` wire pairs; prefer explicit `amount`+`currency` fields on entries to match ARCHITECTURE)
  - **STOP and get reviewed before implementing.** Highest-risk: projection field meanings, `putBudgetInput` vs APPROVAL append semantics, `lifecycleId` nullability, category over-allocation policy (locked below).
  - **Locked policies (do not reopen in later tasks):**
    1. Σ(category.allocated) **must not exceed** `budget.approvedAmount` → `422 VALIDATION_FAILED` or `409 CONFLICT` (pick one in B4.0 Notes after implement; prefer `422`).
    2. `remaining` **may be negative**; set `overCommitted: true` when `remaining < 0` — never clamp silently.
    3. Public API **cannot** create `COMMITMENT` or `ACTUAL` (or `RELEASE` / `APPROVAL` via POST entries) — only `ADJUSTMENT`.
  - **Accept:** `pnpm typecheck`
  - **Notes:** Locked in B4.0:
    1. Σ(category.allocated) > approvedAmount → `422 VALIDATION_FAILED`.
    2. `remaining` may be negative; `overCommitted: remaining < 0` — never clamp.
    3. Public POST entries accept only amount/note/categoryId — service forces `ADJUSTMENT`+`MANUAL`; no `type` on the wire.
    4. GET with no budget → `{ budget: null, projection: zeros }` (`budgetDetail.budget` nullable).
    5. Category create: if both `allocated` and `formula`, formula wins (evaluated into `allocated` at write).
    6. History mirrors `projectHistoryEntrySchema` (`at`, not `createdAt`).
    7. `lifecycleId` required on entry schema, nullable until B8.
    8. `thresholdPcts` default `[80, 90, 100]` when omitted on PUT (service).
    9. `Project.budgetSnapshot` on public project schema (null until first ledger write); repo maps missing field → null until B4.1 model.

---

## Tasks

- [ ] **B4.1** — Budget models + `Project.budgetSnapshot`
  - **Files:** `src/server/models/Budget.ts`, `src/server/models/BudgetEntry.ts`, `src/server/models/BudgetChangeRequest.ts`, `src/server/models/Project.ts` (add `budgetSnapshot` subdoc, nullable), colocated `*.test.ts` under `src/server/models/`
  - **Do:** Tenant-scoped via `tenantScoped` on all three budget models. Indexes:
    - Budget: unique `(orgId, projectId)`
    - BudgetEntry: `(orgId, projectId, createdAt: -1)`, `(orgId, projectId, type, createdAt: -1)`, `(orgId, lifecycleId)` sparse/partial where `lifecycleId` non-null
    - BudgetChangeRequest: `(orgId, projectId, status, createdAt: -1)`
    - Embed `categories[]` on Budget with `_id: false` and explicit string `id` (same pattern as Project workstreams).
    - Storage: Dates in Mongo; `toDomain` → ISO on the wire. `amount` / `allocated` / `approvedAmount` / `deltaAmount` are `Number` integers — never Decimal128 floats.
    - `lifecycleId` field exists on BudgetEntry (`String | null`, default null).
  - **Pattern:** `src/server/models/Project.ts`, `src/server/models/Membership.ts`
  - **Accept:** `pnpm test models/budget`
  - **Notes:**

- [ ] **B4.2** — Formula parser (`lib/formula`)
  - **Files:** `src/server/lib/formula/parse.ts`, `src/server/lib/formula/evaluate.ts`, `src/server/lib/formula/index.ts`, `src/server/lib/formula/formula.test.ts`
  - **Do:** Sandboxed expression evaluator for B4 category formulas (B6 will extend attribute resolution later). Support: `+ - * /`, parentheses, `min`, `max`, `round`, `floor`, `ceil`, `clamp`, `pct`, and identifiers that resolve from a `Record<string, number>` context of **integer** sibling budget fields (e.g. `approvedAmount`, category keys you document). Rules:
    - No `eval`, no `Function`, no property access (`.` / `[`), no assignment.
    - Node-count cap (e.g. 64) and evaluation timeout (e.g. 25ms) — document constants in file header.
    - Division by zero → typed error.
    - Unknown identifier → typed error.
    - Oversized expression → typed error.
    - All intermediate and final values are integers (truncate toward zero after each op, or use integer-only ops — **state the rule in Notes**; never introduce IEEE floats into stored amounts).
  - **Pattern:** pure-function style of `src/server/services/access/computeEffectivePermissions.ts` (no I/O)
  - **Accept:** `pnpm test lib/formula` — precedence; each allowlisted function; div-by-zero; unknown id; oversized; property-access attempt; eval attempt; integer-only results
  - **Notes:**

- [ ] **B4.3** — Projection pure function
  - **Files:** `src/server/services/budget/projectProjection.ts`, `src/server/services/budget/projectProjection.test.ts`
  - **Do:** Export `projectBudget(entries: { type, amount }[]): Omit<budgetSnapshot, 'updatedAt'>` implementing:
    ```
    approved  = Σ(APPROVAL) + Σ(ADJUSTMENT)
    committed = Σ(COMMITMENT) − Σ(RELEASE)
    actual    = Σ(ACTUAL)
    remaining = approved − committed − actual
    ```
    plus `utilisationPct` and `overCommitted` per B4.0. No I/O. Property-style test: random sequences of entries → snapshot equals recompute-from-scratch (same function twice is fine; later ledger tests compare DB snapshot to this function).
  - **Pattern:** `src/server/services/projects/transitions.ts` (pure, table-driven tests)
  - **Accept:** `pnpm test budget/projectProjection` — long mixed sequence; negative remaining flagged; RELEASE reduces committed
  - **Notes:**

- [ ] **B4.4** — Budget repositories
  - **Files:** `src/server/repositories/budgets.ts`, `src/server/repositories/budgetEntries.ts`, `src/server/repositories/budgetChangeRequests.ts`, matching `*.test.ts`
  - **Do:** `OrgContext` first on every method. Include: `findBudgetByProject`, `upsertBudgetFields`, `replaceCategories` / category helpers, `appendEntry` (insert only — **no update of amount**), `listEntries` (filters + pagination), `findEntriesByProject` (for recompute), `countEntriesReferencingCategory`, `createChangeRequest`, `listChangeRequests`, `decideChangeRequest` (conditional on `PENDING`). Also `updateProjectBudgetSnapshot(ctx, projectId, snapshot)` in `src/server/repositories/projects.ts` (extend existing file).
  - **Pattern:** `src/server/repositories/projects.ts`, `src/server/repositories/memberships.ts`
  - **Accept:** `pnpm test repositories/budget`
  - **Notes:**

- [ ] **B4.5** — Ledger write path (single mutation authority)
  - **Files:** `src/server/services/budget/ledger.ts`, `src/server/services/budget/ledger.test.ts`, extend `src/server/redis.ts` with `redisKeys.lockBudget(projectId) => \`lock:budget:${projectId}\``
  - **Do:** One service function used by all writers, e.g. `appendBudgetEntry(ctx, projectId, entryInput) -> { entry, projection }`:
    1. Acquire per-project Redis lock (`SET NX` + PX, same pattern as card locks in `src/server/redis.ts`).
    2. Insert entry (append-only).
    3. Load all entries → `projectBudget` → write `Project.budgetSnapshot` + Redis `budget:project:{projectId}` **in the same unit of work** (await both; if Redis fails, fail the request — do not leave Mongo snapshot stale relative to entries without recording error).
    4. Compare previous vs new `utilisationPct` against `budget.thresholdPcts`; on **edge cross upward** emit `budget.threshold_crossed` (crossing only — not while merely above).
    5. Emit `budget.updated` (and `budget.approved` when type is `APPROVAL` / first approval — match spec event list).
    6. Write exactly one audit entry for the mutation that called the ledger (callers may audit at a higher level — pick one layer and stay consistent; prefer audit in the HTTP-facing service after ledger returns).
       Concurrent double-append test: final projection matches full recompute.
  - **Pattern:** lock usage in `src/server/redis.test.ts`; event publish in `src/server/services/projects/create.ts`
  - **Accept:** `pnpm test budget/ledger` — snapshot==recompute; threshold edge-triggered; concurrent writes; Redis key shape `budget:project:{id}`
  - **Notes:**

- [ ] **B4.6** — GET + PUT `/api/projects/:id/budget`
  - **Files:** `src/app/api/projects/[id]/budget/route.ts`, `src/server/services/budget/get.ts`, `src/server/services/budget/put.ts`, `test/api/budget.test.ts`
  - **Do:**
    - `GET`: `budget.view` with `{ projectId }`; 404 if project missing (cross-org → 404); if no budget yet, return empty/null budget + zero projection **or** 404 — **prefer** `{ budget: null, projection: zeros }` only if contract allows; otherwise require PUT first and GET → 404. State choice in Notes; update contract in B4.0 if needed before coding.
    - `PUT`: `budget.edit` with `{ projectId }`; upsert budget currency/approvedAmount/formula/thresholds; append `APPROVAL` via ledger (sourceType `MANUAL`, sourceId = budget id or put audit id); return `budgetDetail`.
  - **Pattern:** `src/app/api/projects/[id]/route.ts`, `src/server/services/projects/get.ts`
  - **Accept:** `pnpm test api/budget` — standard matrix rows that apply (#1 auth, #2 onboarding, #3 cross-org 404, #4 under-permission, #6 validation, #7 happy path)
  - **Notes:**

- [ ] **B4.7** — Categories CRUD
  - **Files:** `src/app/api/projects/[id]/budget/categories/route.ts`, `src/app/api/projects/[id]/budget/categories/[catId]/route.ts`, `src/server/services/budget/categories.ts`, `test/api/budget-categories.test.ts`
  - **Do:** List/create/update/delete. Permissions `budget.view` / `budget.edit` + `{ projectId }`. Create may evaluate `formula` via `lib/formula` with integer context. Reject create/update when Σ(allocated) > approvedAmount. DELETE rejected if any entry references `categoryId` (`409 CONFLICT`). If `workstreamId` set, must exist on the project.
  - **Pattern:** `src/app/api/projects/[id]/workstreams/route.ts`, `src/server/services/projects/workstreams.ts`
  - **Accept:** `pnpm test api/budget-categories`
  - **Notes:**

- [ ] **B4.8** — Entries list + manual ADJUSTMENT
  - **Files:** `src/app/api/projects/[id]/budget/entries/route.ts`, `src/server/services/budget/entries.ts`, `test/api/budget-entries.test.ts`
  - **Do:** `GET` paginated/filterable (`budget.view`). `POST` only `ADJUSTMENT` + `MANUAL` via ledger (`budget.edit`). Asserting POST with `type: COMMITMENT` (if sneaked in body) is ignored/stripped — contract input must not accept `type`; add a service-level test that internal ledger can write COMMITMENT but HTTP cannot.
  - **Pattern:** `src/app/api/projects/route.ts` list pagination
  - **Accept:** `pnpm test api/budget-entries` — COMMITMENT/ACTUAL unreachable from HTTP
  - **Notes:**

- [ ] **B4.9** — Budget history
  - **Files:** `src/app/api/projects/[id]/budget/history/route.ts`, `src/server/services/budget/history.ts`, `test/api/budget-history.test.ts`
  - **Do:** `GET` change history with actor and reason from audit logs for this project's budget subjects (`budget.view`). Newest first.
  - **Pattern:** `src/app/api/projects/[id]/history/route.ts`, `src/server/services/projects/history.ts`
  - **Accept:** `pnpm test api/budget-history`
  - **Notes:**

- [ ] **B4.10** — Change requests
  - **Files:** `src/app/api/projects/[id]/budget/change-requests/route.ts`, `src/app/api/budget/change-requests/[id]/decide/route.ts`, `src/server/services/budget/changeRequests.ts`, `test/api/budget-change-requests.test.ts`
  - **Do:**
    - `POST .../change-requests`: `budget.request` + `{ projectId }`; creates `PENDING`.
    - `GET .../change-requests`: `budget.view`.
    - `POST /api/budget/change-requests/:id/decide`: `budget.edit` with subject `{ projectId }` loaded from the request; APPROVE → append `ADJUSTMENT` for `deltaAmount` via ledger + set status; REJECT → status only. Concurrent double-decide → one wins, other `409`.
  - **Pattern:** `src/app/api/access-reviews/[id]/resolve/route.ts` (decide-style), `src/server/services/accessReviews/resolve.ts`
  - **Accept:** `pnpm test api/budget-change-requests`
  - **Notes:**

- [ ] **B4.11** — Formula validate endpoint
  - **Files:** `src/app/api/budget/formula/validate/route.ts`, `src/server/services/budget/validateFormula.ts`, `test/api/budget-formula.test.ts`
  - **Do:** `POST` `budget.edit` — org-wide capability (same grant path as other org-wide perms in `requirePermission`, or require a `projectId` query if you must pass a subject — prefer org-wide via membership like `project.view`). Parses and dry-evaluates; returns `validateFormulaOutput`.
  - **Pattern:** `src/app/api/roles/route.ts` (org-level POST)
  - **Accept:** `pnpm test api/budget-formula`
  - **Notes:**

- [ ] **B4.12** — Harden B2 budget TODOs
  - **Files:** `src/server/services/projects/transition.ts` (`projectReadyForApproval.hasBudget`), `src/server/services/projects/get.ts` (overview `budgetRemaining` / `budgetSpent`), `src/server/services/projects/workstreams.ts` (delete guard), tests under `test/api/project-transition.test.ts`, `test/api/projects.test.ts`, `test/api/workstreams.test.ts` (extend — do not rewrite)
  - **Do:**
    - `hasBudget`: true iff project has a Budget with `approvedAmount > 0` (or snapshot.approved > 0) — remove soft stub.
    - Overview: `budgetRemaining` / `budgetSpent` from `budgetSnapshot` as `moneySchema` (`{ amount: remaining|actual, currency }` from budget currency); null if no snapshot.
    - Workstream delete: `409` if any budget category references `workstreamId`.
  - **Pattern:** existing B2 services being edited; keep diffs minimal
  - **Accept:** `pnpm test api/project-transition` and `pnpm test api/workstreams` and `pnpm test api/projects` green
  - **Notes:**

- [ ] **B4.13** — `pnpm budget:verify` script
  - **Files:** `scripts/budget-verify.ts`, `package.json` (add `"budget:verify": "tsx scripts/budget-verify.ts"`), `test/budget-verify.test.ts` (runs verify logic against memory Mongo after seeding entries)
  - **Do:** For every project with entries: recompute via `projectBudget`, compare to `Project.budgetSnapshot` and Redis `budget:project:{id}`. Exit non-zero on drift. Wire into CI when CI exists; until then invoke from `test/budget-verify.test.ts` so `pnpm verify` covers it.
  - **Pattern:** `scripts/seed.ts` (tsx entry + exported functions for tests)
  - **Accept:** `pnpm test budget-verify` (and `pnpm budget:verify` against empty/memory as applicable)
  - **Notes:**

- [ ] **B4.14** — Events + audit coverage
  - **Files:** `src/server/events/types.ts` (payload types if missing), `test/events/budget.test.ts`, `test/audit/b4.test.ts`
  - **Do:** `budget.approved`, `budget.updated`, `budget.threshold_crossed` once each with right payload. One audit assertion per mutating B4 endpoint (PUT budget, category CUD, POST entry, change-request create, decide).
  - **Pattern:** `test/events/members.test.ts`, `test/audit/b3.test.ts`
  - **Accept:** `pnpm test events/budget` and `pnpm test audit/b4`
  - **Notes:**

- [ ] **B4.15** — Seed extension
  - **Files:** `scripts/seed.ts`, `test/seed.test.ts`
  - **Do:** Append `seedB3`-style `seedB4({ orgId, ownerId, activeProjectId })` — idempotent budget on `SEED-ACTIVE` with approved amount, ≥2 categories (one formula optional), one APPROVAL entry, one ADJUSTMENT, matching snapshot. Do not duplicate on re-run.
  - **Pattern:** `seedB2` / `seedB3` in `scripts/seed.ts`
  - **Accept:** `pnpm test seed`
  - **Notes:**

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Standard endpoint matrix passing for every B4 endpoint
- [ ] No code path mutates a balance directly (append-only entries only)
- [ ] `lifecycleId` exists on `BudgetEntry`
- [ ] Snapshot + Redis update in the same unit of work as each entry
- [ ] `pnpm budget:verify` exists and is covered under `pnpm verify` via tests
- [ ] Formula parser allowlist reviewed (no arbitrary code execution)
- [ ] `COMMITMENT` / `ACTUAL` unreachable from the public API
- [ ] Threshold crossing is edge-triggered
- [ ] All amounts are integer minor units end to end
- [ ] B2 `TODO(B4)` markers cleared or updated in `STATUS.md`
- [ ] Spec's review checklist signed off
- [ ] `STATUS.md` updated: active phase B5, generate `B5-TASKS.md`
