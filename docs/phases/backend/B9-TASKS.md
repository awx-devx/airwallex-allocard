# B9 — Activity, Audit, Reports & Closure · Tasks

**Spec:** [B9-reporting-closure.md](./B9-reporting-closure.md)

**Model:** cheap / LOW — read-mostly aggregations + one resumable closure state machine. Name every file, inline every field, copy B1/B2/B7/B8 patterns. Money = integer **minor units** only. Cursor pagination on feeds (not offset). Exports must **stream**.

**Depends on:** B8, complete and verified

Read [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) §5 (`auditLogs`, project status), §4 (cursor pagination helpers in `schemas/base.ts`), and B2 project transition graph before B9.0. Access-review **list/resolve already shipped in B3** — do not reinvent those endpoints; B9 only adds a stale-access **sweep** that creates `AccessReview` rows.

## Contracts first

- [x] **B9.0** — Schemas and contracts
  - **Files:**
    - `src/shared/enums/activityItemType.ts` — `TRANSACTION | PURCHASE_REQUEST | APPROVAL | CARD | ACCESS | RULE_RUN | AUDIT`
    - `src/shared/enums/closureStep.ts` — `PREFLIGHT | FREEZE | SETTLE | REVOKE | CLOSE_CARDS | FINAL_REPORT | ARCHIVE`
    - `src/shared/enums/closureStepStatus.ts` — `PENDING | IN_PROGRESS | BLOCKED | DONE | SKIPPED`
    - `src/shared/enums/exportKind.ts` — `BUDGET | TRANSACTIONS | CARDS | AUDIT`
    - `src/shared/schemas/activity.ts`
    - `src/shared/schemas/auditQuery.ts` (public audit list shape — distinct from internal `AuditLog` model)
    - `src/shared/schemas/export.ts`
    - `src/shared/schemas/report.ts`
    - `src/shared/schemas/closure.ts`
    - `src/shared/types/activity.ts`, `auditQuery.ts`, `export.ts`, `report.ts`, `closure.ts`
    - `src/shared/contracts/activity.ts`, `audit.ts`, `export.ts`, `report.ts`, `closure.ts` (split OK)
  - **Do:** Every endpoint in the spec's table gets a contract entry. Inline shapes (amounts = integer **minor units**):
    - `activityItem`: `{ id, orgId, projectId` nullable, `type: ActivityItemType`, `at: ISO`, `actorType: ActorType`, `actorId: id`, `subjectType: string`, `subjectId: id`, `summary: string` 1–500, `payload: record` (small denormalised facts for the feed row) `}`
    - `listActivityQuery`: `{ type?: ActivityItemType, actorId?: id, projectId?: id, from?: ISO, to?: ISO, cursor?: string, limit?: int 1–100 default 20 }` — **cursor**, not page
    - `activityPage`: `{ items: activityItem[], nextCursor: string | null }` — use `cursorPageSchema`
    - `auditEntry` (wire): `{ id, orgId, projectId` nullable, `actorType, actorId, action, subjectType, subjectId, before` unknown nullable, `after` unknown nullable, `metadata: record, at: ISO }`
    - `listAuditQuery`: `{ subjectType?, subjectId?, actorId?, action?, projectId?, from?, to?, cursor?, limit? }` → `auditPage` cursor envelope
    - `exportInput`: `{ projectId?: id, from?: ISO, to?: ISO }` (kind is path-implied) → response is **streaming CSV** — contract `output: z.void()` with a Notes lock that handlers return `ReadableStream` / `text/csv` (not JSON); do not force Zod body output for the stream
    - `projectReport`: `{ projectId, currency length 3, approved int, committed int, actual int, remaining int, utilisationPct int, byCategory: [{ categoryId, name, allocated int, actual int }], byMember: [{ userId, actual int }], generatedAt: ISO }`
    - `organizationReport`: `{ currency length 3` (primary; multi-currency projects listed separately if needed), `projects: [{ projectId, name, approved, committed, actual, remaining, utilisationPct }], totals: { approved, committed, actual, remaining }, generatedAt: ISO }`
    - `closureBlockingItem`: `{ kind: OPEN_TRANSACTION | PENDING_AUTHORIZATION | PENDING_REQUEST | ACTIVE_CARD | ACTIVE_ACCESS`, `subjectType, subjectId, summary: string }`
    - `closurePreflight`: `{ projectId, canStart: boolean, blockers: closureBlockingItem[] }`
    - `closureStepState`: `{ step: ClosureStep, status: ClosureStepStatus, startedAt` nullable ISO, `completedAt` nullable ISO, `detail` nullable string `}`
    - `closureStatus`: `{ projectId, projectStatus: ProjectStatus, currentStep: ClosureStep, steps: closureStepState[], resumable: boolean }`
    - `startClosureInput`: `z.void()` (or empty object) — transitions project → `CLOSING`, runs FREEZE
    - `completeClosureInput`: `{ confirmCloseCards: literal true, confirmArchive: literal true }` — both required; irreversible card close + archive
    - `finalReport`: projectReport + `{ closedAt: ISO, archivedAt` nullable ISO, `transactionCount int, accessHistoryCount int }`
  - **Contracts table (every row):**
    - GET `/api/projects/:id/activity` → listActivityQuery (projectId from path) → activityPage
    - GET `/api/activity` → listActivityQuery → activityPage
    - GET `/api/audit` → listAuditQuery → auditPage
    - GET `/api/projects/:id/audit` → listAuditQuery → auditPage
    - POST `/api/exports/budget` → exportInput → streamed CSV (void contract)
    - POST `/api/exports/transactions` → exportInput → streamed CSV
    - POST `/api/exports/cards` → exportInput → streamed CSV
    - POST `/api/exports/audit` → exportInput → streamed CSV
    - GET `/api/reports/project/:id` → void → projectReport
    - GET `/api/reports/organization` → void → organizationReport
    - GET `/api/projects/:id/closure/preflight` → void → closurePreflight
    - POST `/api/projects/:id/closure/start` → startClosureInput → closureStatus
    - GET `/api/projects/:id/closure/status` → void → closureStatus
    - POST `/api/projects/:id/closure/complete` → completeClosureInput → closureStatus (+ final report id in detail)
    - GET `/api/projects/:id/report/final` → void → finalReport
  - **Pattern:** `src/shared/contracts/purchaseRequest.ts`, `src/shared/schemas/base.ts` (`cursorPageSchema`), `src/shared/contracts/accessReview.ts` (do not duplicate)
  - **STOP and get reviewed before implementing.** Highest-risk: cursor encoding, export streaming vs JSON contracts, closure step persistence shape, confirm literals on complete, whether CLOSING is entered only via `/closure/start` (not generic `/transition`).
  - **Accept:** `pnpm typecheck`
  - **Notes:** Locked (user approved 2026-08-11):
    1. Cursor = opaque `{ at, id }` base64url JSON — never offset pages on activity/audit feeds.
    2. Export contracts use `output: z.void()`; handlers return streamed `text/csv` (`ReadableStream`), not JSON bodies.
    3. Closure progress lives in a separate `ProjectClosure` collection (unique `projectId`), not embedded on Project.
    4. Enter `CLOSING` only via `POST /api/projects/:id/closure/start` — generic `/transition` must not start closure.
    5. Org report: single-currency `totals`; mixed-currency projects listed per-row and excluded from rollup totals.
    6. Preflight is fully blocking: `canStart === (blockers.length === 0)`.
    7. Complete requires both `confirmCloseCards: true` and `confirmArchive: true`.
    8. Access-review HTTP stays B3; B9 only adds the stale/elevated **sweep**.

## Implementation tasks

### B9.1 — Activity feed service + HTTP

- [x] **B9.1** — Unified activity feed
  - **Files:**
    - `src/server/services/activity/feed.ts`
    - `src/app/api/activity/route.ts`
    - `src/app/api/projects/[id]/activity/route.ts`
    - `test/api/activity.test.ts`
  - **Do:**
    1. Merge sources into `activityItem[]` sorted by `at` desc, then `id` desc: transactions (`transactedAt`), purchase requests / approvals (`updatedAt` / approval `at`), card status changes (audit `card.*` or card `updatedAt`), access changes (audit `member.*` / projectMember), rule runs (`startedAt`). Prefer reading **auditLogs** + transactions + ruleRuns rather than inventing a new collection — document choice in Notes.
    2. Cursor = opaque string encoding `{ at, id }` (base64url JSON). Stable when new items arrive at the head (test asserts mid-scroll insert does not skip/duplicate).
    3. Permissions: `transaction.view` scoped; `OWN` scope → only items where `actorId === ctx.userId` OR subject is the caller's own request/card.
    4. Cross-org project → 404.
  - **Pattern:** `src/app/api/projects/[id]/requests/route.ts`, `src/shared/schemas/base.ts` cursor helpers
  - **Accept:** `pnpm test api/activity` — merge order; cursor stability; OWN filter; matrix rows that apply
  - **Notes:** Feed merges transactions + purchaseRequests (+ embedded approvals) + auditLogs (`card.*` → CARD, `member.*` → ACCESS, residual → AUDIT) + ruleRuns. No new collection. Cursor = base64url `{ at, id }`.

### B9.2 — Audit query HTTP

- [x] **B9.2** — Filterable audit list
  - **Files:**
    - `src/server/repositories/auditLogs.ts` (extend if list helpers missing — check existing first)
    - `src/server/services/audit/query.ts`
    - `src/app/api/audit/route.ts`
    - `src/app/api/projects/[id]/audit/route.ts`
    - `test/api/audit.test.ts`
  - **Do:**
    1. List with filters: subjectType, subjectId, actorId, action, projectId, from, to. Cursor pagination.
    2. Permission: `member.manage`. Cross-org → 404.
    3. Response includes `actorType` so RULE vs USER is visible; `before`/`after` passed through for diff UI.
  - **Pattern:** `src/server/services/audit/log.ts`, `src/app/api/projects/[id]/history/route.ts`
  - **Accept:** `pnpm test api/audit` — actorType present; rule vs human distinguishable; matrix
  - **Notes:** Cursor shared via `opaqueCursor.ts` (`{ at, id }` base64url). Repo cursor keeps `orgId` top-level for `tenantScoped` (no wrapping `$and`).

### B9.3 — CSV export streaming

- [x] **B9.3** — Streaming exports
  - **Files:**
    - `src/server/services/exports/csv.ts` — row serializer + async iterable → `ReadableStream`
    - `src/server/services/exports/budget.ts`
    - `src/server/services/exports/transactions.ts`
    - `src/server/services/exports/cards.ts`
    - `src/server/services/exports/audit.ts`
    - `src/app/api/exports/budget/route.ts`
    - `src/app/api/exports/transactions/route.ts`
    - `src/app/api/exports/cards/route.ts`
    - `src/app/api/exports/audit/route.ts`
    - `test/api/exports.test.ts`
  - **Do:**
    1. Permission `report.export` + scope filter (projectId when provided).
    2. Stream CSV (`Content-Type: text/csv`); **do not** `await` full row array into memory. Test: generate N fake rows via async generator and assert peak retained buffer stays O(1) / does not hold all N (spy or chunk-count assertion — document approach in Notes).
    3. Every successful export writes **exactly one** audit entry: action `export.{kind}`, metadata `{ rowCount?, projectId?, from?, to? }`.
    4. Amounts in CSV = integer minor units (or a documented major-unit column with explicit header `amount_minor` — prefer `amount_minor` int).
  - **Pattern:** `src/server/services/audit/log.ts` for audit; route pattern from `src/app/api/reports/` if none — copy `withAuth` from B7 routes
  - **Accept:** `pnpm test api/exports` — stream headers; one audit per export; scope 403/404
  - **Notes:** Pull-based `rowsToCsvStream` — after header + first data chunk, generator has yielded 1 of N (not all N). Audit `export.{kind}` written in stream `onComplete` after full consume. `amount_minor` on budget/transactions. `REPORT_EXPORT` added to org-wide via membership for org-scoped POST without projectId.

### B9.4 — Reports

- [x] **B9.4** — Project + organization reports
  - **Files:**
    - `src/server/services/reports/project.ts`
    - `src/server/services/reports/organization.ts`
    - `src/app/api/reports/project/[id]/route.ts`
    - `src/app/api/reports/organization/route.ts`
    - `test/api/reports.test.ts`
  - **Do:**
    1. Project report from budget projection + category allocations + member actuals (sum ACTUAL ledger / transactions by cardholder userId — prefer ledger+transactions join; lock in Notes).
    2. Org report = rollup of projects in `ctx.orgId` (same currency only in v1; mixed-currency projects appear with their own currency and are excluded from `totals` — **STOP for review if unclear**, default: require single currency or null totals with per-project rows).
    3. Permission `report.export`. Totals must match `projectBudget` / `budget:verify` for the project.
  - **Pattern:** `src/server/services/budget/projectProjection.ts`, `src/app/api/projects/[id]/budget/route.ts`
  - **Accept:** `pnpm test api/reports` — totals reconcile; matrix
  - **Notes:** Totals always from `projectBudget(entries)`. Category/member actuals: ACTUAL ledger → `lifecycleId` → transaction → card → `categoryId` / `cardholder.userId` (ledger+transactions join; not transaction-sum alone). Org `currency` = `org.baseCurrency`; mixed-currency projects listed in `projects[]` but excluded from `totals`. MEMBER org report filtered to projects granting `report.export`.

### B9.5 — Closure model + repository

- [x] **B9.5** — Persist closure progress
  - **Files:**
    - `src/server/models/ProjectClosure.ts` (or embed `closure` on Project — **prefer separate collection** keyed by `projectId` for resumability)
    - `src/server/repositories/projectClosures.ts`
    - `src/server/models/projectClosure.test.ts` or `repositories/projectClosure.test.ts`
  - **Do:**
    1. Fields: `orgId, projectId` unique, `currentStep: ClosureStep`, `steps: ClosureStepState[]` (all seven steps), `startedBy: id`, `startedAt`, `completedAt` nullable, `finalReportSnapshot` nullable (store finalReport JSON when done), timestamps.
    2. `tenantScoped`. Methods: `upsertStart`, `findByProject`, `updateStep`, `markComplete`. Cross-org → null.
  - **Pattern:** `src/server/models/PurchaseRequest.ts`, `src/server/repositories/purchaseRequests.ts`
  - **Accept:** `pnpm test models/projectClosure` or `repositories/projectClosure`
  - **Notes:** Separate `projectClosures` collection; unique `projectId`. `upsertStart` is insert-only (`$setOnInsert`) so resume does not reset steps.

### B9.6 — Closure preflight + start (freeze)

- [ ] **B9.6** — Preflight + start
  - **Files:**
    - `src/server/services/closure/preflight.ts`
    - `src/server/services/closure/start.ts`
    - `src/app/api/projects/[id]/closure/preflight/route.ts`
    - `src/app/api/projects/[id]/closure/start/route.ts`
    - `test/api/closure-preflight.test.ts`
    - `test/api/closure-start.test.ts`
  - **Do:**
    1. Preflight lists blockers independently: open/pending transactions (AUTHORIZED not terminal), pending purchase requests, non-CLOSED cards, access scopes with `validTo` in future / active members with spend perms. `canStart` true only when blockers empty **OR** document that start is allowed with warnings — **spec says surfaced for review, blocking** → `canStart === blockers.length === 0`.
    2. Start requires `project.close`, project `ACTIVE`, `canStart`. Sets status → `CLOSING` via existing transition helpers if possible; freezes all project cards → `INACTIVE` (reuse card freeze service). Emit `project.closing`. Create/resume `ProjectClosure` at FREEZE→DONE, currentStep SETTLE.
    3. Idempotent resume: if already `CLOSING` with closure doc, return status without re-freezing DONE steps.
  - **Pattern:** `src/server/services/projects/transition.ts`, `src/server/services/cards/` freeze
  - **Accept:** `pnpm test api/closure-preflight` && `pnpm test api/closure-start` — each blocker type; happy start; resume

### B9.7 — Closure status + settle/revoke helpers

- [ ] **B9.7** — Status + settle/revoke
  - **Files:**
    - `src/server/services/closure/status.ts`
    - `src/server/services/closure/settle.ts`
    - `src/server/services/closure/revoke.ts`
    - `src/app/api/projects/[id]/closure/status/route.ts`
    - `test/api/closure-status.test.ts`
    - `src/server/services/closure/settle.test.ts`
  - **Do:**
    1. GET status returns `closureStatus` for `project.close`.
    2. Settle: mark SETTLE DONE when no PENDING/AUTHORIZED uncleared auths remain for project cards; else BLOCKED with detail count. Callable from status poll or complete.
    3. Revoke: expire project access scopes / remove spend permissions (reuse B3 member/scope helpers); mark REVOKE DONE.
    4. Do not close cards here.
  - **Pattern:** `src/server/services/projectMembers/`, access scope updates from B3
  - **Accept:** `pnpm test api/closure-status` && `pnpm test services/closure/settle`

### B9.8 — Closure complete (close cards, report, archive)

- [ ] **B9.8** — Complete closure
  - **Files:**
    - `src/server/services/closure/complete.ts`
    - `src/app/api/projects/[id]/closure/complete/route.ts`
    - `src/app/api/projects/[id]/report/final/route.ts`
    - `test/api/closure-complete.test.ts`
  - **Do:**
    1. Requires `completeClosureInput` with **both** confirm literals. Permission `project.close`.
    2. Advance SETTLE/REVOKE if not done; then CLOSE_CARDS: call card close with confirm for each non-CLOSED card (never from rules — only this path). Tolerate post-close clearing webhooks (already B8) — test that a CLEARING after CLOSED still records.
    3. FINAL_REPORT: build `finalReport`, store on closure doc.
    4. ARCHIVE: project → `CLOSED` then `ARCHIVED` (or CLOSING→CLOSED→ARCHIVED per graph); emit `project.closed` / `project.archived`. Reject mutations on ARCHIVED (already B2 — assert).
    5. Resumable: re-calling complete skips DONE steps.
  - **Pattern:** `src/server/services/cards/` close, `src/server/services/projects/transition.ts`
  - **Accept:** `pnpm test api/closure-complete` — confirms required; resume; archived rejects PATCH; final report totals match ledger

### B9.9 — Stale access sweep (access reviews)

- [ ] **B9.9** — Flag stale/elevated access
  - **Files:**
    - `src/server/services/accessReviews/sweep.ts`
    - wire `expire-access` or new schedule in `src/worker/index.ts` (replace noop if still noop)
    - `src/server/services/accessReviews/sweep.test.ts`
  - **Do:**
    1. Create `AccessReview` rows for: scopes past `validTo`; members inactive N days (define N=30 in Notes); subjects flagged by existing `flag.review` rule actions if not already open.
    2. Idempotent: do not duplicate OPEN reviews for same `(orgId, subjectId, reason)` key.
    3. Resolve path already exists — do not rebuild HTTP.
  - **Pattern:** `src/server/services/approvals/escalate.ts`, `src/server/repositories/accessReviews.ts`
  - **Accept:** `pnpm test accessReviews/sweep`

### B9.10 — Events + audit + seed + budget:verify on closed project

- [ ] **B9.10** — Events, audit, seed, reconcile
  - **Files:**
    - `test/events/b9.test.ts`
    - `test/audit/b9.test.ts`
    - extend `scripts/seed.ts` with `seedB9`
    - `test/budget-verify.test.ts` (add closed-project case) or `test/closure-reconcile.test.ts`
  - **Do:**
    1. Assert `project.closing`, `project.closed`, `project.archived` emit once per successful path.
    2. Audit: closure start/complete, each export kind, final report generation.
    3. Seed: one CLOSING project mid-flow + one ARCHIVED with final report; sample activity sources.
    4. After full closure sequence, `verifyBudgets()` / final report totals match ledger.
  - **Pattern:** `test/events/b8.test.ts`, `test/audit/b8.test.ts`, `scripts/seed.ts` `seedB8`
  - **Accept:** `pnpm test events/b9` && `pnpm test audit/b9` && `pnpm test seed`

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Standard endpoint matrix passing for every B9 endpoint
- [ ] Cursor pagination on every feed (no offset)
- [ ] Exports stream and write audit
- [ ] Closure resumable; card close confirmed and not rule-triggered
- [ ] Post-closure transaction still reconciles
- [ ] Final report totals tie to ledger (`budget:verify`)
- [ ] Spec's review checklist signed off
- [ ] `STATUS.md` updated: backend track complete / next is F0; do **not** invent F0-TASKS unless asked
