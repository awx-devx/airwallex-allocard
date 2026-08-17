# A9 — Reports, Audit & Closure · Tasks

**Spec:** [A9-reports-closure.md](./A9-reports-closure.md)
**Model:** cheap / LOW — name every file, inline every field with type and constraints, copy the cited A1/A8/A7/A5/A3/A2/F1/B9 file; do not invent endpoints, change B9 contracts, add primitives, reopen AppShell collapse, recompute ledger totals on the client, rebuild `/settings/access-reviews`, or hide a control without a Sheet/menu replacement.
**Depends on:** A8, complete and verified

No new API contracts. B9 already shipped `reportContracts`, `auditContracts`, `exportContracts`, `closureContracts`. Access-review HTTP already shipped in B3 / A3. The review gate is the policies + helper shapes below.

**Powers:** B9 · **Hooks (F1, already exist):** `useProjectReport`, `useOrganizationReport`, `useFinalReport`, `useAudit`, `useExportBudget`, `useExportTransactions`, `useExportCards`, `useExportAudit`, `useClosurePreflight`, `useClosureStatus`, `useStartClosure`, `useCompleteClosure`, `useProjects`, `useProject`, `useProjectMembers`, `useMe`, `usePermissions`, `useCan` · **Do not call:** `useProjectAudit`, `useActivity`, `useProjectActivity`, `useSyncTransactionsAdmin`, `useSimulatePurchase`, `usePanToken`, `useCreateCard`, `useTransitionProject` (not for CLOSING / CLOSED / ARCHIVED from the closure flow), `useBudget` on report screens (do not dual-source totals) · **Guards (F0, already exist):** `requireApp` on `(app)/layout.tsx`

Recipe: [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Visual tokens: [`../../VISUAL-DIRECTION.md`](../../VISUAL-DIRECTION.md). Backend semantics: [`../backend/B9-reporting-closure.md`](../backend/B9-reporting-closure.md) (read, do not reimplement).

**AppShell collapse is already done (A2.1).** Aside is `hidden w-56 shrink-0 flex-col md:flex`; Menu opens the same `SideNav` / `OrgSwitcher` in F3 `Sheet`. Do **not** reopen collapse. Do **not** build `MobileNav.tsx`. Do **not** add `sm:` / `lg:` / `xl:` / `2xl:` on A9 screens. A9.1 may **insert** one SideNav href (`/audit`) only. `/reports` is already in `DEFAULT_NAV` (A2). `/settings/access-reviews` is already in `DEFAULT_NAV` and `SETTINGS_NAV` (A3).

There is **no** A9 AppShell-collapse task. A2.1 owns it. Every screen task still checks 375px / 768px don’t-break, including that the existing Menu `Sheet` still works below `md`.

---

## A9.0 locked policies (do not reopen)

Approved 2026-08-17. Implementers follow these; do not re-litigate. A9.0 still implements the helpers below and STOPs before A9.1 screens.

### 1. No new contracts, no new primitives, no AppShell collapse, no client ledger

- Do **not** add or rename fields in `src/shared/schemas/*` or `src/shared/contracts/*`. That includes **not** adding `currency` on `organizationReport.projects[]` (the wire has none — policy §7).
- Do **not** rebuild `/settings/access-reviews`. A3.8 already shipped `AccessReviewList.tsx`. A9 may **Link** to it. Do **not** edit `src/app/(app)/settings/access-reviews/**`.
- Do **not** add `/projects/[id]/audit` as a product URL (the API exists; the workspace has no Audit tab). Product audit is `/audit?...`. Do **not** call `useProjectAudit`.
- Do **not** add a seventh workspace tab. `WORKSPACE_TAB_HREFS` stays six. Closure is `/projects/[id]/closure` (not a tab). Final report is `/projects/[id]/report/final` (not a tab).
- Do **not** add a shadcn/pattern file. Do **not** edit `src/components/patterns/Timeline.tsx`, `DiffView.tsx`, `StepWizard.tsx`, `BudgetBar.tsx`, or `ConfirmDialog.tsx`. `DiffView` already stacks `grid-cols-1 md:grid-cols-3`. `StepWizard` rail already `flex-wrap`. Confirm type-to-confirm is already case-sensitive (`matchesConfirmPhrase`).
- Do **not** import `@/server/*` from any `'use client'` file. That includes `src/server/services/reports/*`, `src/server/services/closure/*`, `src/server/services/budget/projectProjection.ts`. Do **not** recompute `approved` / `committed` / `actual` / `remaining` as `approved - committed - actual` on the client. Show the ints the report hook returns.
- Do **not** call `call()` or `fetch` from a screen. Use F1 hooks. Exports: `useExportBudget` / `useExportTransactions` / `useExportCards` / `useExportAudit` only. Do **not** import `downloadExport` from `src/client/api/download.ts` or `src/client/lib/download.ts` in a screen.
- Do **not** edit `src/client/api/download.ts` (F1 already `fetch`es the stream and triggers a blob download). Pending `Alert` is the progress UI. Do **not** invent a percent.
- Do **not** edit `src/client/hooks/invalidationMap.ts`. F1 already invalidates closure + project + cards + finalReport on start/complete.
- Do **not** edit F1 hooks (`src/client/hooks/useReports.ts` included). Closure status polling is `refetch()` from the screen (policy §9).
- Do **not** edit `src/client/shell/AppShell.tsx` except the `DEFAULT_NAV` array in A9.1.
- Do **not** add `@testing-library/react`.
- Do **not** use `type="number"` or `parseFloat` on amounts. A9 has **no** amount inputs. Display through `MoneyDisplay` / F3 `BudgetBar` / F2 `formatMoney` only.
- **Never PAN / CVV / expiry.**

### 2. Routes (A9 spec wins)

| URL                           | Files                                                                    | Guard                 | Shell                       |
| ----------------------------- | ------------------------------------------------------------------------ | --------------------- | --------------------------- |
| `/reports`                    | `src/app/(app)/reports/page.tsx` + `ReportCatalogue.tsx`                 | `requireApp` (layout) | `AppShell`                  |
| `/reports/organization`       | `src/app/(app)/reports/organization/page.tsx` + `OrganizationReport.tsx` | same                  | `AppShell`                  |
| `/reports/project/[id]`       | `src/app/(app)/reports/project/[id]/page.tsx` + `ProjectReport.tsx`      | same                  | `AppShell` (no workspace)   |
| `/audit`                      | `src/app/(app)/audit/page.tsx` + `AuditList.tsx`                         | same                  | `AppShell`                  |
| `/projects/[id]/closure`      | `src/app/(app)/projects/[id]/closure/page.tsx` + `ClosureFlow.tsx`       | same                  | `AppShell` + workspace tabs |
| `/projects/[id]/report/final` | `src/app/(app)/projects/[id]/report/final/page.tsx` + `FinalReport.tsx`  | same                  | `AppShell` + workspace tabs |
| `/settings/access-reviews`    | **already A3.8** — do not recreate                                       | same                  | `AppShell` + settings tabs  |

`/reports/organization` is a **static** segment. Do **not** put organization under `[id]`. Next.js `organization/page.tsx` must win.

`/reports/project/[id]` is **not** inside `projects/[id]/layout.tsx` — no workspace tabs there. Back `Link` to the project overview. Closure and final report **are** inside the project layout — workspace tabs stay the existing six.

A9.1 inserts SideNav `{ href: '/audit', label: 'Audit' }` **immediately after** `{ href: '/reports', label: 'Reports' }` and **before** Roles. Do **not** remove or rename Reports. Do **not** add Audit / Reports / Closure to `SETTINGS_NAV`. Closure is **not** a SideNav item — header / list / overview `Link`s (A9.8).

Dashboard `/dashboard` stays four cards (`grid-cols-1 md:grid-cols-2`). Do not add a fifth. Reports is already in SideNav.

Wizard has no reports/closure deferred step. Do **not** edit `ProjectWizard.tsx`.

### 3. Layout — one breakpoint `md`, four patterns (collapse already exists)

Copy [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Do not add `sm:` / `lg:` / `xl:` / `2xl:` (ignore pre-existing `sm:` inside F3 `Sheet` / `UserMenu` / `/dev/ui` / `DateRangePicker` — do not edit those files).

**Do not hide** the closure step rail, Next / confirm, blocker Links, audit diffs, export buttons, or report figures on narrow. Stack them. Spec Layout: closure is `StepWizard` (rail already wraps); report and audit tables scroll inside; filter bars wrap; **do not** give the final report a fixed width (`max-w-md` / `max-w-3xl` / `max-w-5xl` forbidden on that page).

| Screen                        | Narrow                                                                                          | Desktop (`md:`)                                      |
| ----------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| `/reports`                    | stack: catalogue Links, then export card; toolbar `flex-wrap`                                   | same stack; **no** page `md:grid` that hides exports |
| `/reports/project/[id]`       | `BudgetBar` already `md:grid-cols-4`; category/member `DataTable` inside overflow               | same; figures wrap                                   |
| `/reports/organization`       | totals stack; `DataTable` inside overflow; mixed-currency `Alert` not `hidden`                  | same table, **not** a card list                      |
| `/audit`                      | `DataTable` + wrap toolbar; Diff `Sheet` `side="right"`                                         | same table; Sheet is the diff surface                |
| `/projects/[id]/closure`      | `StepWizard` rail wrap; body **one column** `flex flex-col gap-4`; confirms are `ConfirmDialog` | same; **no** `md:grid` of steps                      |
| `/projects/[id]/report/final` | stack, **no max-width**; `BudgetBar` + tables inside overflow                                   | same stack; still no fixed width                     |
| Export in progress            | `Alert` + that Button disabled; page stays usable                                               | same                                                 |
| Org SideNav                   | Audit appears inside existing Menu `Sheet`                                                      | same item in the `hidden md:flex` aside              |

Workspace tabs already `flex flex-wrap` in `ProjectWorkspace.tsx`. Do not switch them to Radix `Tabs`. Do not add a seventh tab.

Chrome Links: `buttonVariants({ variant: 'ghost' })` + `Link` for wrap-nav (A3 Slot crash — do **not** `Button asChild` for new wrap-nav Links). `Button asChild` + `Link` is OK for primary actions (A2.3 Create).

### 4. Existing contracts (copy these fields; do not redeclare)

All amounts that are numbers are **integer minor units**. Currency is ISO 4217 `string` length 3. Never `parseFloat`, never `type="number"`. **Never PAN / CVV / expiry.** `remaining` / `approved` / `committed` / `actual` are `z.number().int()` — **not** nonnegative (`remaining` may be negative when over-committed). `utilisationPct` is `z.number().int().nonnegative()` and **may exceed 100**. Do not clamp.

**Permissions** (server is the control; client `can()` is UX only):

| Action              | Permission      | Hook / note                                                                                       |
| ------------------- | --------------- | ------------------------------------------------------------------------------------------------- |
| Project report      | `report.export` | `useProjectReport(id)` — path id; cross-org 404                                                   |
| Organization report | `report.export` | `useOrganizationReport()` — MEMBER filtered to granting projects; 403 if none                     |
| CSV exports         | `report.export` | `useExportBudget` / `useExportTransactions` / `useExportCards` / `useExportAudit`                 |
| Audit list          | `member.manage` | `useAudit(filter?)` — `member.manage` is in `ORG_WIDE_VIA_MEMBERSHIP`; no required project Select |
| Closure preflight   | `project.close` | `useClosurePreflight(id)` — **not** org-wide; always a project id                                 |
| Closure start       | `project.close` | `useStartClosure().mutate({ id })` — body `z.void()`; do not send a JSON object                   |
| Closure status      | `project.close` | `useClosureStatus(id)` — **409 unless project is CLOSING**; do not call on ACTIVE (policy §9)     |
| Closure complete    | `project.close` | `useCompleteClosure().mutate({ id, input })` — both confirm literals                              |
| Final report        | `project.view`  | `useFinalReport(id)` — 404 until a snapshot exists                                                |
| Access reviews      | `member.manage` | **A3** `useAccessReviews` — do not call from A9 screens except existing overview tile             |

`PermissionGate` requires `projectId: string`. On org `/reports` and `/audit` with **no** selected project: do **not** pass `''`. Use `holdsReportExport` / `holdsMemberManage` + `PermissionGateView`. When a project **is** selected, `PermissionGate` `projectId={projectId}` is OK. Closure always has a project id.

`report.export` and `member.manage` are in `ORG_WIDE_VIA_MEMBERSHIP` (`src/server/http/requirePermission.ts`). MEMBER may load org report / org export / org audit **without** `projectId`. Do **not** copy A8’s `requiresProjectIdOnTxList` here. `project.close` is **not** in that set — always pass the project id.

---

**`projectReportSchema`** (`src/shared/schemas/report.ts`) — `GET /api/reports/project/:id` — `reportContracts.project` — input `z.void()`:

```
{
  projectId: string min 1,
  currency: string length 3,
  approved: int,                 // minor units; not nonnegative
  committed: int,
  actual: int,
  remaining: int,                // may be negative; do not clamp
  utilisationPct: int >= 0,      // may exceed 100
  byCategory: Array<{
    categoryId: string min 1,
    name: string min 1,
    allocated: int,
    actual: int
  }>,
  byMember: Array<{
    userId: string min 1,
    actual: int                  // no name on the wire — join via useProjectMembers
  }>,
  generatedAt: iso datetime
}
```

---

**`organizationReportSchema`** — `GET /api/reports/organization` — `reportContracts.organization` — input `z.void()`:

```
{
  currency: string length 3,     // org.baseCurrency; totals are this currency only
  projects: Array<{
    projectId: string min 1,
    name: string min 1,
    approved: int,
    committed: int,
    actual: int,
    remaining: int,
    utilisationPct: int >= 0
    // NO currency field — do not invent one
  }>,
  totals: {
    approved: int,
    committed: int,
    actual: int,
    remaining: int
  },
  generatedAt: iso datetime
}
```

Mixed-currency projects appear in `projects[]` and are **excluded from `totals`** (B9.0). Detect with `orgTotalsExcludeSomeProjects` (sum of `projects[].approved` !== `totals.approved`). `MoneyDisplay` every figure with `report.currency`. Do not invent a per-row currency.

---

**`finalReportSchema`** = `projectReportSchema` + `{ closedAt: iso datetime, archivedAt: iso datetime | null, transactionCount: int >= 0, accessHistoryCount: int >= 0 }`. `GET /api/projects/:id/report/final` — `reportContracts.final` — permission `project.view`. Missing snapshot → 404.

---

**`exportInput`** (`src/shared/schemas/export.ts`) — body for all four POSTs:

```
{
  projectId?: string min 1,
  from?: iso datetime,
  to?: iso datetime
}
```

Kind is **path-implied**. Contract `output: z.void()` — handlers stream `text/csv`, not JSON. F1 `downloadExport` kind literals (not the shared enum): `'budget' | 'transactions' | 'cards' | 'audit'`. Hooks: `useExportBudget` → `'budget'`, `useExportTransactions` → `'transactions'`, `useExportCards` → `'cards'`, `useExportAudit` → `'audit'`. Do **not** send `ExportKind.BUDGET` (`'BUDGET'`) as the download kind.

Omit empty `projectId` / `from` / `to`. Do not send `cursor`, `page`, or `kind` in the body.

---

**`auditEntrySchema`** (`src/shared/schemas/auditQuery.ts`):

```
{
  id: string min 1,
  orgId: string min 1,
  projectId: string min 1 | null,
  actorType: 'USER' | 'RULE' | 'SYSTEM' | 'AIRWALLEX',   // native enum ActorType
  actorId: string min 1,
  action: string min 1,
  subjectType: string min 1,     // free string — not an enum; do not invent a closed list
  subjectId: string min 1,
  before: unknown | null,        // opaque diff; pass to DiffView
  after: unknown | null,
  metadata: record string → unknown,
  at: iso datetime
}
```

**`listAuditQuery`:**

```
{
  subjectType?: string min 1,
  subjectId?: string min 1,
  actorId?: string min 1,
  action?: string min 1,
  projectId?: string min 1,
  from?: iso datetime,
  to?: iso datetime,
  cursor?: string min 1,         // opaque { at, id } base64url — never an offset
  limit: coerce int min 1 max 100 default 20
}
```

Output `{ items: auditEntrySchema[], nextCursor: string | null }` (`cursorPageSchema`).

**`GET /api/audit`** — `auditContracts.list` — hook `useAudit(filter?)`. Pass `cursor` only as the infinite `pageParam`. Do **not** put `cursor` in the URL. Flatten `data.pages.flatMap(p => p.items)`.

**`GET /api/projects/:id/audit`** — `.listForProject` — **A9 screens do not call this hook.**

---

**`closureBlockingItemSchema`:**

```
{
  kind: 'OPEN_TRANSACTION' | 'PENDING_AUTHORIZATION' | 'PENDING_REQUEST' | 'ACTIVE_CARD' | 'ACTIVE_ACCESS',
  subjectType: string min 1,     // preflight uses: 'transaction' | 'purchaseRequest' | 'card' | 'projectMember'
  subjectId: string min 1,
  summary: string min 1
}
```

**`closurePreflightSchema`:** `{ projectId: string min 1, canStart: boolean, blockers: closureBlockingItem[] }`. **`canStart === (blockers.length === 0)`**. Do not call start when `canStart` is false.

**`closureStepStateSchema`:** `{ step: ClosureStep, status: ClosureStepStatus, startedAt: iso | null, completedAt: iso | null, detail: string | null }`.

`ClosureStep`: `PREFLIGHT | FREEZE | SETTLE | REVOKE | CLOSE_CARDS | FINAL_REPORT | ARCHIVE` (`src/shared/enums/closureStep.ts`).

`ClosureStepStatus`: `PENDING | IN_PROGRESS | BLOCKED | DONE | SKIPPED` (`src/shared/enums/closureStepStatus.ts`).

**`closureStatusSchema`:** `{ projectId, projectStatus: ProjectStatus, currentStep: ClosureStep, steps: closureStepState[], resumable: boolean }`.

**`POST /api/projects/:id/closure/start`** — input `z.void()` — output `closureStatusSchema`. Hook `useStartClosure` takes `{ id: string }` only. Enters `CLOSING`, runs FREEZE. Idempotent if already CLOSING.

**`GET /api/projects/:id/closure/status`** — input `z.void()`. **409 unless `projectStatus === CLOSING`**. Polls SETTLE server-side. `resumable` is true when CLOSING and not yet completed.

**`POST /api/projects/:id/closure/complete`** — input `completeClosureInput`:

```
{
  confirmCloseCards: literal true,
  confirmArchive: literal true
}
```

Both required (422 otherwise). Advances SETTLE/REVOKE if needed, closes cards via `closeCard({ confirm: true })` only, writes final report, CLOSING → CLOSED → ARCHIVED. 409 if SETTLE is not DONE.

**`GET /api/projects/:id/closure/preflight`** — input `z.void()`.

Do **not** enter CLOSING via `POST /api/projects/:id/transition` `{ to: 'CLOSING' }` — that 409s. Do **not** call `useTransitionProject` from `ClosureFlow.tsx`.

---

**Also used, already shipped:**

- `GET /api/projects` — `useProjects({ page: 1, pageSize: 100 })` for project Selects.
- `GET /api/projects/:id` — `useProject(id)` for status (ACTIVE / CLOSING / CLOSED / ARCHIVED).
- `GET /api/projects/:id/members` — `useProjectMembers(id)` to resolve `byMember.userId` → `user.name`. Fallback: show `userId`.
- `GET /api/me` — `user.id`, `activeOrg.baseCurrency`, `memberships[].orgRole`, `projects[].permissions`.
- `projectionToBudgetBarProps` from `src/client/lib/budget.ts` — pass report figures + `overCommitted: remaining < 0`. Do not clamp remaining.
- `budgetHref(projectId)` from `src/client/lib/budget.ts` — `/projects/${id}/budget` (final report “matches budget tab” Link).
- `cardHref` / `transactionHref` / `transactionListHref` / `requestHref` / `peopleHref` / `accessReviewListHref` — re-export, do not duplicate.
- `timelineActorChipLabel` from `src/components/patterns/timelineActor.ts` for audit actorType labels. Do not edit `Timeline.tsx`.
- `DiffView` from `src/components/patterns/DiffView.tsx` — pass `before` / `after` as-is (including `null`).
- `StepWizard` from `src/components/patterns/StepWizard.tsx` — `nextLabel` already exists (A2.7). Do not add props.
- `ConfirmDialog` `typeToConfirm: { phrase: string, prompt: string }` — phrase match is **case-sensitive** after trim.

**Do not use `useAudit` for the activity feed** (A8 already owns `/activity`). Audit is the accountability log with diffs; activity is the merged feed.

### 5. Closure is a guided, resumable wizard (not a button)

Walk the admin through B9’s seven steps. `activeStepId` is **derived**, never a local “I clicked step 3” index:

| `useProject().status` | Wizard `activeStepId`     | What Next does                                                      |
| --------------------- | ------------------------- | ------------------------------------------------------------------- |
| `ACTIVE`              | `PREFLIGHT`               | if `canStart`: `useStartClosure({ id })`; else disabled             |
| `CLOSING`             | `status.currentStep`      | if `CLOSE_CARDS` and SETTLE is `DONE`: open confirms; else disabled |
| `CLOSED` / `ARCHIVED` | do **not** run the wizard | `Link` to final report; archived Alert                              |

- **Do not** call `useClosureStatus` while status is `ACTIVE` / `CLOSED` / `ARCHIVED` (409). Pass `id: ''` so `enabled: Boolean(id)` is false, or skip the hook. Call it only when `status === 'CLOSING'`.
- Always call `useClosurePreflight(id)` on ACTIVE (and on CLOSING if you still list leftover blockers). 403 → `ErrorState` `error.message`.
- After start, start() invalidates project → status becomes CLOSING → then status hook runs.
- Resume: if already CLOSING, **hide** Start. Show locked resume copy. Do not re-start as a blank wizard. `resumable` from status is informational; the derived `activeStepId` is the resume.
- SETTLE `BLOCKED`: show `detail` (e.g. `N pending authorization(s)`) plus `Link` `transactionListHref({ projectId, status: 'AUTHORIZED' })`. Refresh: `Button` calling `status.refetch()`, plus `SETTLE_POLL_MS` interval `refetch` while SETTLE is `BLOCKED` or `IN_PROGRESS` (policy §9).
- Pre-flight blockers are **actionable Links** via `blockerHref` (policy §6). `canStart` false → Next disabled. Do **not** freeze cards on this screen — `ACTIVE_CARD` Links to `/cards/[id]` (A5 Freeze). Start is blocked until those are gone; start’s FREEZE step then freezes remaining non-CLOSED cards.
- Card close is irreversible at Airwallex. Complete uses **two** `ConfirmDialog`s in sequence, then **one** mutate:
  1. Phrase `CLOSE` (exact, case-sensitive). Description includes locked post-clearing copy.
  2. Phrase `ARCHIVE` (exact, case-sensitive).
  3. `useCompleteClosure().mutate({ id, input: { confirmCloseCards: true, confirmArchive: true } })`.
     Do not send the mutate after only one dialog. Do not send `confirmCloseCards: false`.
- `onBack` on `StepWizard` is a **no-op**. Back must not call start or complete. Next is the only mutation trigger (`nextLabel` `Start closure` / `Close cards and archive`).
- `isStepValid`: true only when Next should fire (PREFLIGHT + `canStart` + ACTIVE, or CLOSE_CARDS + SETTLE `DONE` + CLOSING). Otherwise false (Next disabled).
- After complete succeeds → `router.push(finalReportHref(id))`.

Do **not** close individual cards with `useCloseCard` from this flow. Complete closes them.

Existing workspace **Archive** on `CLOSED` via `useTransitionProject` (A2) stays. A9 does not remove it. A9 adds **Close project** on `ACTIVE` (Link to closure) and **Resume closure** on `CLOSING`. Do not offer Close on `DRAFT` / `PENDING_APPROVAL` / `CANCELLED` / `ARCHIVED`.

### 6. Blocker Links (do not just show a count)

`subjectType` values preflight actually writes (`src/server/services/closure/preflight.ts`):

| `kind`                  | `subjectType`     | Href                                    |
| ----------------------- | ----------------- | --------------------------------------- |
| `OPEN_TRANSACTION`      | `transaction`     | `transactionHref(subjectId)`            |
| `PENDING_AUTHORIZATION` | `transaction`     | `transactionHref(subjectId)`            |
| `PENDING_REQUEST`       | `purchaseRequest` | `requestHref(subjectId)`                |
| `ACTIVE_CARD`           | `card`            | `cardHref(subjectId)`                   |
| `ACTIVE_ACCESS`         | `projectMember`   | `peopleHref(projectId)` (no member URL) |

Unknown `subjectType` → `peopleHref(projectId)` if `projectId` min 1, else `'#'`. Render `summary` as the Link text (`min-w-0 break-words`). Do not hide the list below `md`.

### 7. Org rollup mixed currency (no per-row currency on the wire)

Do **not** add a field. Display every project amount with `report.currency`. If `orgTotalsExcludeSomeProjects(projects, totals)` is true, show locked mixed-currency `Alert`. Totals `MoneyDisplay` uses `report.currency`. Do not sum project rows in the UI for a headline (use `totals.*`).

### 8. Exports stream without blocking the page

Each export button calls its hook `mutate(exportBody(filter))`. While **that** mutation `isPending`: disable **that** button and show locked `exportInProgressMessage()` `Alert`. Other buttons, filters, and Links stay enabled. Do not `window.alert`. Do not `await` in a way that replaces the whole page with `LoadingState`. On error: `Alert` `error.message`. On success: F1 triggers the download; no extra toast required.

Do not parallel-spam: if you prefer, disable all four while any is pending — **locked:** disable only the in-flight kind so the page is not blocked.

### 9. Status poll — do not edit F1

`useClosureStatus` has no `refetchInterval`. Do **not** patch `closureStatusQueryOptions`. In `ClosureFlow.tsx`:

- `SETTLE_POLL_MS = 5000`
- `useEffect` that `setInterval(() => { void refetch() }, SETTLE_POLL_MS)` while `currentStep === 'SETTLE'` and that step’s status is `BLOCKED` or `IN_PROGRESS`
- clear the interval on unmount or when SETTLE is `DONE`

This is `refetch()`, not `fetch()`.

### 10. Archived is read-only in A9 chrome; do not rewrite A3–A8

When `status === 'ARCHIVED'`:

- `ProjectWorkspace` shows locked archived `Alert` (always visible, not `hidden`).
- No Start / Complete / export on A9 screens (hide those actions; show the Alert + final report Link).
- Do **not** batch-edit Budget / Cards / People / Controls / Requests mutation buttons in this phase. API already 409s. Workspace Alert is the UI explanation.

`isProjectArchived(status)` / `isProjectReadOnly(status)` true only for `ARCHIVED` (not `CLOSED` — CLOSED still has Archive + final report).

### 11. Extra invalidation, money, PAN, testing, ESLint

- Do not edit `invalidationMap.ts`.
- Amounts are **never** clamped. Negative `remaining` via `MoneyDisplay` `colorBySign` and `BudgetBar` `overCommitted`.
- Tests: pure helpers in `src/client/lib/reports.ts` with vitest **node**.
- Screen Accept always includes `pnpm verify` plus **375px and 768px**: no page-level horizontal scrollbar; primary actions reachable; tables may scroll **inside**; closure Next / confirm reachable by **vertical** scroll (stacked, not `hidden`).
- `(app)` already bans `call()` / `fetch`. Do not add a `@/server` ban (server layout still uses `requireApp`).
- Barrel: **named** exports from `src/client/lib/index.ts` (do **not** `export * from '@/client/lib/reports'` — `parseOptionalIdParam` would clash with A6/A7/A8). Do **not** re-export `parseIsoQueryParam` (already from `transactions.ts`).

### 12. Locked copy (do not paraphrase)

| Situation                  | Surface                | Copy                                                                                                                                        |
| -------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot export reports      | `PermissionGateView`   | `You don't have permission to export reports.`                                                                                              |
| Cannot view audit          | `PermissionGateView`   | `You don't have permission to view the audit log.`                                                                                          |
| Cannot close project       | `PermissionGateView`   | `You don't have permission to close this project.`                                                                                          |
| No reports yet             | `EmptyState`           | title `No report yet` / description `Budget versus actual appears once a project has a ledger.`                                             |
| No org projects in report  | `EmptyState`           | title `No projects to roll up` / description `Projects you can export will appear here.`                                                    |
| No audit (empty filter)    | `EmptyState`           | title `No audit entries` / description `Try a wider filter, or pick a subject.`                                                             |
| Project not found          | `ErrorState`           | `This project is not available.`                                                                                                            |
| Final report missing       | `ErrorState`           | `No final report yet.`                                                                                                                      |
| Mixed-currency org totals  | `Alert`                | `Some projects are in another currency and are excluded from totals.`                                                                       |
| Export in progress         | `Alert`                | `Export in progress — you can keep using the page.`                                                                                         |
| Closure blocked            | heading + list         | `Cannot start until these are resolved.`                                                                                                    |
| Closure resume             | `Alert`                | `This closure is in progress. Continuing from the current step.`                                                                            |
| SETTLE waiting             | `Alert`                | `Waiting for pending authorizations to clear or expire.`                                                                                    |
| Post-close clearing        | `ConfirmDialog` desc   | `Pending transactions will still clear after cards are closed.`                                                                             |
| Close cards confirm title  | `ConfirmDialog`        | title `Close all project cards?` confirm `Close cards` variant `destructive` phrase `CLOSE` prompt `Type CLOSE to close all project cards.` |
| Archive confirm title      | `ConfirmDialog`        | title `Archive this project?` confirm `Archive` variant `destructive` phrase `ARCHIVE` prompt `Type ARCHIVE to archive this project.`       |
| Archived project           | `Alert`                | `This project is archived. It is read-only.`                                                                                                |
| Start closure              | Button / nextLabel     | `Start closure`                                                                                                                             |
| Close cards and archive    | nextLabel              | `Close cards and archive`                                                                                                                   |
| Close project (chrome)     | Link                   | `Close project`                                                                                                                             |
| Resume closure             | Link                   | `Resume closure`                                                                                                                            |
| Final report               | Link                   | `Final report`                                                                                                                              |
| View in audit              | Link                   | `View in audit`                                                                                                                             |
| Organization report        | Link                   | `Organization`                                                                                                                              |
| Project report             | Link                   | `Project`                                                                                                                                   |
| Access reviews (catalogue) | Link                   | `Access reviews`                                                                                                                            |
| Refresh settle             | Button                 | `Refresh`                                                                                                                                   |
| Load more                  | Button                 | `Load more`                                                                                                                                 |
| Budget CSV                 | Button                 | `Export budget`                                                                                                                             |
| Transactions CSV           | Button                 | `Export transactions`                                                                                                                       |
| Cards CSV                  | Button                 | `Export cards`                                                                                                                              |
| Audit CSV                  | Button                 | `Export audit`                                                                                                                              |
| 403 / 409 / 422            | `Alert` / `ErrorState` | server `error.message`                                                                                                                      |

Step rail labels (exact): `Pre-flight`, `Freeze`, `Settle`, `Revoke access`, `Close cards`, `Final report`, `Archive`.

---

## Contracts first

- [x] **A9.0** — Report / audit / closure helpers (STOP for review)
  - **Files:**
    - `src/client/lib/reports.ts` (create)
    - `src/client/lib/reports.test.ts` (create)
    - `src/client/lib/index.ts` (edit — **named** exports only, same style as A8 `transactions`)
  - **Do:** No React screens. No AppShell / catalogue / wizard changes yet. Implement the locked helper API (pure, no React, no `call()`, no `fetch`, no `FileReader`):
    1. `SETTLE_POLL_MS`: `5000`.
    2. `CLOSE_CONFIRM_PHRASE`: `'CLOSE'`.
    3. `ARCHIVE_CONFIRM_PHRASE`: `'ARCHIVE'`.
    4. `CLOSURE_STEPS`: readonly `{ id: ClosureStep, label: string }[]` in enum order: `PREFLIGHT`/`Pre-flight`, `FREEZE`/`Freeze`, `SETTLE`/`Settle`, `REVOKE`/`Revoke access`, `CLOSE_CARDS`/`Close cards`, `FINAL_REPORT`/`Final report`, `ARCHIVE`/`Archive`.
    5. `reportsHref(): string` — `'/reports'`.
    6. `organizationReportHref(): string` — `'/reports/organization'`.
    7. `projectReportHref(projectId: string): string` — `/reports/project/${projectId}`. Throw if `projectId.length < 1`.
    8. `auditHref(): string` — `'/audit'`.
    9. `auditListHref(filter: { subjectType?: string; subjectId?: string; actorId?: string; action?: string; projectId?: string; from?: string; to?: string }): string` — path `/audit`; omit empty / undefined keys; do **not** accept `cursor` / `limit` / `page`.
    10. `closureHref(projectId: string): string` — `/projects/${projectId}/closure`. Throw if empty.
    11. `finalReportHref(projectId: string): string` — `/projects/${projectId}/report/final`. Throw if empty.
    12. Re-export `cardHref` from `src/client/lib/cards.ts`, `requestHref` from `src/client/lib/requests.ts`, `peopleHref` / `accessReviewListHref` from `src/client/lib/access.ts`, `budgetHref` from `src/client/lib/budget.ts`, `transactionHref` / `transactionListHref` from `src/client/lib/transactions.ts`. Do not duplicate.
    13. `parseOptionalIdParam(input: string | string[] | undefined): string | undefined` — arrays use `[0]`; empty → undefined. Copy A8.0 behaviour; do **not** import it from `transactions.ts` / `requests.ts` / `rules.ts`.
    14. `parseIsoQueryParam(input: string | string[] | undefined): string | undefined` — same as A8.0 (`isoDateSchema.safeParse`); do **not** export this name from the barrel (clash with `transactions.ts`).
    15. `parseAuditSearchParams(input: { subjectType?: string | string[]; subjectId?: string | string[]; actorId?: string | string[]; action?: string | string[]; projectId?: string | string[]; from?: string | string[]; to?: string | string[] }): { subjectType?: string; subjectId?: string; actorId?: string; action?: string; projectId?: string; from?: string; to?: string }` — drop `cursor`, `limit`, `page`, unknown keys. `subjectType` / `action`: first param, min 1, else omit (free strings, no enum). Ids via `parseOptionalIdParam`. Dates via `parseIsoQueryParam`.
    16. `parseExportSearchParams(input: { projectId?: string | string[]; from?: string | string[]; to?: string | string[] }): { projectId?: string; from?: string; to?: string }` — drop unknown keys.
    17. `exportCatalogueHref(filter: { projectId?: string; from?: string; to?: string }): string` — path `/reports`; omit empties.
    18. `exportBody(filter: { projectId?: string; from?: string; to?: string }): { projectId?: string; from?: string; to?: string }` — omit empty; this is the mutation input (`exportInput`).
    19. `holdsReportExport(orgRole: string | undefined, projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined): boolean` — `OWNER`/`ADMIN` OR any project `permissions.includes('report.export')`. Copy `holdsRequestApprove` in `src/client/lib/requests.ts` (local `holdsPermission`; do not import it).
    20. `holdsMemberManage` — same shape, permission `'member.manage'`.
    21. `holdsProjectClose` — same shape, permission `'project.close'`.
    22. `isProjectArchived(status: string): boolean` — `status === 'ARCHIVED'`.
    23. `isProjectClosing(status: string): boolean` — `status === 'CLOSING'`.
    24. `isProjectCloseable(status: string): boolean` — `status === 'ACTIVE'`.
    25. `closureActiveStep(status: string, currentStep: string | undefined): 'PREFLIGHT' | ClosureStep` — if `status === 'ACTIVE'` return `'PREFLIGHT'`; if `status === 'CLOSING'` and `currentStep` is a `ClosureStep`, return it; else `'PREFLIGHT'`.
    26. `stepStatusOf(steps: ReadonlyArray<{ step: string; status: string }>, step: string): string | undefined` — find `step`, return `status`.
    27. `settleIsDone(steps): boolean` — `stepStatusOf(..., 'SETTLE') === 'DONE'`.
    28. `shouldPollSettle(currentStep: string, steps): boolean` — `currentStep === 'SETTLE'` and step status is `'BLOCKED'` or `'IN_PROGRESS'`.
    29. `canClickStart(input: { projectStatus: string; canStart: boolean; archived: boolean }): boolean` — `projectStatus === 'ACTIVE' && canStart && !archived`.
    30. `canClickComplete(input: { projectStatus: string; steps: ReadonlyArray<{ step: string; status: string }>; archived: boolean }): boolean` — `projectStatus === 'CLOSING' && settleIsDone(steps) && !archived`.
    31. `blockerHref(item: { subjectType: string; subjectId: string }, projectId: string): string` — table in policy §6. Throw if `projectId.length < 1`. `transaction` → `transactionHref(subjectId)` (throw if subjectId empty via that helper); `purchaseRequest` → `requestHref`; `card` → `cardHref`; `projectMember` → `peopleHref(projectId)`; else `peopleHref(projectId)`.
    32. `orgTotalsExcludeSomeProjects(projects: ReadonlyArray<{ approved: number }>, totals: { approved: number }): boolean` — sum `approved` !== `totals.approved`. Do not clamp. Empty projects + totals.approved `0` → false.
    33. `reportOverCommitted(remaining: number): boolean` — `remaining < 0`. Do not clamp.
    34. `reportToBudgetBar(report: { approved: number; committed: number; actual: number; remaining: number; utilisationPct: number; currency: string })` — return `projectionToBudgetBarProps({ ...figures, overCommitted: reportOverCommitted(remaining) }, currency)`. Re-export `projectionToBudgetBarProps` usage; do not reimplement BudgetBar math.
    35. `memberDisplayName(userId: string, members: ReadonlyArray<{ userId: string; user?: { name?: string } }>): string` — matching `user.name` min 1, else `userId`.
    36. `completeClosureInput(): { confirmCloseCards: true; confirmArchive: true }` — exactly those literals.
    37. Copy functions for locked §12 sentences: `exportReportsDenialMessage()`, `viewAuditDenialMessage()`, `closeProjectDenialMessage()`, `projectNotFoundMessage()`, `finalReportMissingMessage()`, `mixedCurrencyMessage()`, `exportInProgressMessage()`, `closureBlockedHeading()`, `closureResumeMessage()`, `settleWaitingMessage()`, `postCloseClearingMessage()`, `archivedProjectMessage()`, `startClosureLabel()`, `closeCardsAndArchiveLabel()`, `closeProjectLink()`, `resumeClosureLink()`, `finalReportLink()`, `viewInAuditLink()`, plus EmptyState pairs `noReportEmpty()`, `noOrgProjectsEmpty()`, `noAuditEmpty()` returning `{ title, description }`. Confirm copy helpers `closeCardsConfirm()` / `archiveConfirm()` returning `{ title, confirmLabel, phrase, prompt }` using the locked strings (description for close-cards includes `postCloseClearingMessage()`).
  - **Pattern:** A1-equivalent **A1.0** `src/client/lib/auth.ts` (first Track A helper file). Copy the recent shape from A8.0 `src/client/lib/transactions.ts` + `src/client/lib/transactions.test.ts` (hrefs, `firstParam`, `appendQuery`, `holdsX`, EmptyState pairs, named barrel). URL parse: `parseTransactionListSearchParams` in that file. Holds: `holdsRequestApprove` in `src/client/lib/requests.ts`. Budget bar: `projectionToBudgetBarProps` in `src/client/lib/budget.ts`. Contracts to copy fields from: `src/shared/schemas/report.ts`, `src/shared/schemas/export.ts`, `src/shared/schemas/auditQuery.ts`, `src/shared/schemas/closure.ts`, `src/shared/contracts/report.ts`, `src/shared/contracts/export.ts`, `src/shared/contracts/audit.ts`, `src/shared/contracts/closure.ts`. Enums: `src/shared/enums/closureStep.ts`, `src/shared/enums/closureStepStatus.ts`, `src/shared/enums/closureBlockingKind.ts`, `src/shared/enums/audit.ts` (`ActorType`), `src/shared/enums/exportKind.ts` (do not pass these uppercase values into `downloadExport`). Confirm phrases: A5.5 `CLOSE` in `src/client/lib/cards.ts` / `ConfirmDialog`.
  - **STOP and get this reviewed before A9.1+.** An invented `GET /api/receipts`-style queue, a client `projectBudget`, hiding the wizard rail below `md`, treating audit as page-offset, rebuilding access-reviews, calling `useClosureStatus` on ACTIVE, or adding `currency` to org project rows is a rewrite.
  - **Accept:** `pnpm test client/lib/reports` — cover: `projectReportHref('p1')` is `/reports/project/p1`; `projectReportHref('')` throws; `organizationReportHref()` is `/reports/organization`; `closureHref('p')` is `/projects/p/closure`; `finalReportHref('p')` is `/projects/p/report/final`; `auditListHref({ subjectType: 'card', subjectId: 'c1' })` is `/audit?subjectType=card&subjectId=c1`; `auditListHref({ cursor: 'x' } as never)` has no `cursor` in the string; `parseAuditSearchParams({ cursor: 'abc', page: '2', subjectType: 'card' } as never)` has `subjectType: 'card'` and no `cursor`/`page`; `holdsReportExport('MEMBER', [{ permissions: ['report.export'] }])` true; `holdsReportExport('MEMBER', [{ permissions: ['transaction.view'] }])` false; `holdsReportExport('OWNER', [])` true; `isProjectArchived('ARCHIVED')` true; `isProjectCloseable('ACTIVE')` true; `isProjectCloseable('CLOSING')` false; `closureActiveStep('ACTIVE', 'SETTLE')` is `'PREFLIGHT'`; `closureActiveStep('CLOSING', 'SETTLE')` is `'SETTLE'`; `canClickStart({ projectStatus: 'ACTIVE', canStart: true, archived: false })` true; `canClickStart({ ..., canStart: false })` false; `canClickComplete({ projectStatus: 'CLOSING', steps: [{ step: 'SETTLE', status: 'DONE' }], archived: false })` true; `canClickComplete({ ..., steps: [{ step: 'SETTLE', status: 'BLOCKED' }] })` false; `blockerHref({ subjectType: 'transaction', subjectId: 't1' }, 'p')` is `/transactions/t1`; `blockerHref({ subjectType: 'card', subjectId: 'c1' }, 'p')` is `/cards/c1`; `blockerHref({ subjectType: 'purchaseRequest', subjectId: 'r1' }, 'p')` is `/requests/r1`; `blockerHref({ subjectType: 'projectMember', subjectId: 'm1' }, 'p')` is `/projects/p/people`; `orgTotalsExcludeSomeProjects([{ approved: 100 }, { approved: 50 }], { approved: 100 })` true; `orgTotalsExcludeSomeProjects([{ approved: 100 }], { approved: 100 })` false; `reportOverCommitted(-1)` true; `reportOverCommitted(0)` false; `reportToBudgetBar({ approved: 10, committed: 4, actual: 7, remaining: -1, utilisationPct: 110, currency: 'USD' }).remaining` is `-1` and `overCommitted` true and `utilisationPct` is `110`; `memberDisplayName('u1', [{ userId: 'u1', user: { name: 'Ada' } }])` is `Ada`; `memberDisplayName('u2', [])` is `u2`; `completeClosureInput()` equals `{ confirmCloseCards: true, confirmArchive: true }`; `CLOSE_CONFIRM_PHRASE` is `CLOSE`; `ARCHIVE_CONFIRM_PHRASE` is `ARCHIVE`; `SETTLE_POLL_MS` is `5000`; `shouldPollSettle('SETTLE', [{ step: 'SETTLE', status: 'BLOCKED' }])` true; `shouldPollSettle('SETTLE', [{ step: 'SETTLE', status: 'DONE' }])` false.
  - **Notes:** Helpers in `src/client/lib/reports.ts` (14 unit tests). Remaining unclamped; org mixed-currency via approved-sum; no `useBudget` / `projectBudget`; complete input both literals; audit href drops `cursor`. Barrel named-exports (clash with A6–A8 `parseOptionalIdParam` / `parseIsoQueryParam`). `pnpm verify` green (1767 tests). STOP before A9.1 screens.

---

## Tasks

### A9.1 — SideNav + route shells

- [x] **A9.1** — Insert Audit; placeholders so Reports / Audit links do not 404
  - **Files:**
    - `src/client/shell/AppShell.tsx` (edit — `DEFAULT_NAV` only)
    - `src/app/(app)/reports/page.tsx` (create — placeholder until A9.2)
    - `src/app/(app)/reports/organization/page.tsx` (create — placeholder until A9.4)
    - `src/app/(app)/reports/project/[id]/page.tsx` (create — placeholder until A9.3)
    - `src/app/(app)/audit/page.tsx` (create — placeholder until A9.5)
    - `src/app/(app)/projects/[id]/closure/page.tsx` (create — placeholder until A9.6; so A9.3 / A9.8 Links do not 404)
    - `src/app/(app)/projects/[id]/report/final/page.tsx` (create — placeholder until A9.7)
  - **Do:**
    1. `DEFAULT_NAV`: after `{ href: '/reports', label: 'Reports' }` insert `{ href: '/audit', label: 'Audit' }`, then existing Roles. Do **not** change aside `hidden md:flex` / Menu / Sheet / `w-56`. Do **not** touch `SETTINGS_NAV`. Do **not** add Closure to the nav.
    2. Placeholders: `<main className="min-w-0">{label} — not built yet</main>` for Reports catalogue, Organization report, Project report, Audit, Closure, Final report. Must **not** 404. Static `organization/page.tsx` must win over any future `[id]` (there is none under `/reports` except `project/[id]`).
    3. Do not edit `AccessReviewList.tsx`. Do not replace `/activity`. Do not add a workspace tab.
  - **Layout:** n/a for placeholders (stack `min-w-0`). Shell collapse unchanged. New Audit href is in the aside at `md` and in the Menu `Sheet` below `md` (same `SideNav`).
  - **Pattern:** A1-equivalent **A1.1** `src/app/(auth)/layout.tsx` (first Track A route chrome — centred column; A9 still uses AppShell). Copy A8.1 `src/client/shell/AppShell.tsx` `DEFAULT_NAV` insert. Collapse already A2.1 — `docs/RESPONSIVENESS.md` §1; do **not** copy A2.1’s aside rewrite. Placeholders: A8.1 `/transactions` pages. Static segment win: A8.1 `transactions/declined/page.tsx` vs `[id]`.
  - **Accept:** `pnpm verify`. `/reports`, `/reports/organization`, `/reports/project/any-id`, `/audit`, `/projects/any-id/closure`, `/projects/any-id/report/final` are not 404. `/reports/organization` is **not** a project-report page. SideNav at 768px shows Reports, then Audit, then Roles; at 375px those labels appear inside the existing Menu Sheet. 375px and 768px: no page-level horizontal scrollbar; Menu/Sheet still works below `md`. Aside still `hidden md:flex`. `AppShell.tsx` does not lose `hidden` or `md:flex`. `SETTINGS_NAV` still four hrefs (no Audit / Reports / Closure). `WORKSPACE_TAB_HREFS` still six.
  - **Notes:** SideNav Audit immediately after Reports, before Roles. Placeholders `/reports`, `/reports/organization`, `/reports/project/[id]`, `/audit`, `/projects/[id]/closure`, `/projects/[id]/report/final`. Static `organization` wins over any `[id]`. Aside still `hidden md:flex`. SETTINGS_NAV four hrefs. WORKSPACE_TAB_HREFS still six. `pnpm verify` green (1767 tests).

### A9.2 — Report catalogue + exports

- [x] **A9.2** — `/reports` catalogue Links; streamed CSV without blocking
  - **Files:**
    - `src/app/(app)/reports/page.tsx` (replace placeholder)
    - `src/app/(app)/reports/ReportCatalogue.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<ReportCatalogue />` only.
    2. `parseExportSearchParams` from `useSearchParams`. `useMe` for `memberships[].orgRole` and `projects`. `useProjects({ page: 1, pageSize: 100 })` for optional project `Select`.
    3. Toolbar `flex flex-wrap gap-2 min-w-0`: Project `Select` with `__all__` (omit `projectId` when all); `DateRangePicker` `from`/`to` (F3 `src/components/ui/date-range-picker.tsx`); writing `exportCatalogueHref`.
    4. Catalogue Links (`buttonVariants` + `Link`, wrap): `organizationReportHref()` label `Organization`; if `filter.projectId` min 1, `projectReportHref(filter.projectId)` label `Project`; `auditHref()` / `auditListHref({ projectId: filter.projectId })` label from `viewInAuditLink()`; `accessReviewListHref({})` label `Access reviews`. Do **not** fetch access reviews here.
    5. If `!holdsReportExport(orgRole, me.projects)`: `PermissionGateView` `allowed={false}` `denialMessage={exportReportsDenialMessage()}` wrapping the export buttons (still show Links). Do **not** pass `projectId=""`.
    6. Four Buttons: `Export budget` → `useExportBudget().mutate(exportBody(filter))`; same for transactions / cards / audit hooks. While a given mutation `isPending`: disable **that** Button + `Alert` `exportInProgressMessage()`. Do not replace the page with `LoadingState`. Error → `Alert` `error.message`.
    7. Do not call `useProjectReport` / `useOrganizationReport` here (those are A9.3 / A9.4). Do not import `downloadExport`. Do not `type="number"`.
  - **Layout:** stack. Toolbar wrap. No `md:grid`. No Sheet. Export `Alert` not `hidden`. Filters wrap.
  - **Pattern:** A1-equivalent **A1.5** `src/app/(onboarding)/onboarding/page.tsx` (first Track A list). Copy A8.3 `src/app/(app)/transactions/TransactionList.tsx` toolbar wrap + URL filters. Hooks: `useExportBudget` / `useExportTransactions` / `useExportCards` / `useExportAudit` in `src/client/hooks/useReports.ts` (B9 `exportContracts`). `DateRangePicker` F3.5. Access-reviews Link: A3.8 route already exists.
  - **Accept:** `pnpm verify`. `ReportCatalogue.tsx` contains `useExportBudget` and does **not** contain `downloadExport`, `fetch(`, `call(`, `parseFloat`, or `type="number"`. Export pending does not unmount the catalogue. 375px and 768px: no page-level horizontal scrollbar; Organization / Access reviews / export Buttons reachable; filters wrap. Menu/Sheet still works below `md`.
  - **Notes:** Catalogue wrap-Links (Organization / Project when selected / View in audit / Access reviews). Four F1 export mutates; only the in-flight kind disables. `usePermissions` projects for `holdsReportExport` (me has no projects[]). `pnpm verify` green (1767 tests).

### A9.3 — Project budget versus actual

- [ ] **A9.3** — `/reports/project/[id]` figures, category and member tables
  - **Files:**
    - `src/app/(app)/reports/project/[id]/page.tsx` (replace placeholder)
    - `src/app/(app)/reports/project/[id]/ProjectReport.tsx` (`'use client'`)
  - **Do:**
    1. `parseOptionalIdParam` on `useParams().id`. `useProjectReport(id)`. `useProjectMembers(id)` for names only. 403 → `error.message`. `NOT_FOUND` → `projectNotFoundMessage()`. Loading: `LoadingState`.
    2. Header wrap `flex flex-wrap gap-2 min-w-0`: Back `Link` `exportCatalogueHref({})` (`buttonVariants` + `Link`); `Link` `/projects/${id}` ; `Link` `budgetHref(id)`; `Link` `closureHref(id)` (placeholder from A9.1 until A9.6).
    3. `BudgetBar` `{...reportToBudgetBar(data)}` — remaining unclamped; `utilisationPct` may be > 100. Do **not** call `useBudget`.
    4. Four figures also as wrapping `MoneyDisplay` `{ amount: data.approved | committed | actual | remaining, currency: data.currency }` `colorBySign` on remaining. Do not compute remaining.
    5. Category `DataTable`: `name`, `allocated` `MoneyDisplay`, `actual` `MoneyDisplay`. `getRowId: (row) => row.categoryId`. Member `DataTable`: `memberDisplayName(userId, members)`, `actual` `MoneyDisplay`. `getRowId: (row) => row.userId`. Empty arrays: `EmptyState` `noReportEmpty()` only when **both** tables empty **and** `approved === 0 && actual === 0` is optional — **locked:** if `byCategory.length === 0 && byMember.length === 0`, still show BudgetBar + figures (do not empty-state the whole page).
    6. `generatedAt` via `formatDateTime` `src/lib/dates.ts`.
    7. Do not client-refilter. Do not clamp. Do not add `max-w-*` on the page root.
  - **Layout:** stack. `BudgetBar` already `grid-cols-1` / `md:grid-cols-4` inside the F3 component — do not restyle it. Tables scroll **inside**. No page `md:grid`. No Sheet. Figures wrap, never `whitespace-nowrap`.
  - **Pattern:** A1-equivalent **A1.4** `src/app/(invite)/invite/[token]/page.tsx` (first Track A detail). Copy A4.2 `src/app/(app)/projects/[id]/budget/BudgetHome.tsx` (`BudgetBar` + `MoneyDisplay`). Hook: `useProjectReport` (B9 `.project`). Members: `useProjectMembers` `src/client/hooks/useMembers.ts`.
  - **Accept:** `pnpm verify`. `ProjectReport.tsx` contains `useProjectReport` and `reportToBudgetBar` / `BudgetBar` and does **not** contain `useBudget`, `projectBudget`, `parseFloat`, `Math.max(0`, or `type="number"`. Remaining can render negative. 375px and 768px: no page-level horizontal scrollbar; Back + figures + tables reachable; tables may scroll inside. Menu/Sheet still works below `md`.
  - **Notes:** _{filled in on completion}_

### A9.4 — Organization rollup

- [ ] **A9.4** — `/reports/organization` totals; mixed-currency Alert
  - **Files:**
    - `src/app/(app)/reports/organization/page.tsx` (replace placeholder)
    - `src/app/(app)/reports/organization/OrganizationReport.tsx` (`'use client'`)
  - **Do:**
    1. `useOrganizationReport()`. 403 → `error.message` (MEMBER with no granting project). Loading: `LoadingState`. Empty `projects.length === 0`: `EmptyState` `noOrgProjectsEmpty()`.
    2. Totals wrap: four `MoneyDisplay` with `data.currency` (`colorBySign` on remaining). Do not sum rows for a headline.
    3. If `orgTotalsExcludeSomeProjects(data.projects, data.totals)`: `Alert` `mixedCurrencyMessage()` — not `hidden`.
    4. `DataTable` columns: `name` (`Link` `projectReportHref(row.projectId)`, `min-w-0 break-words`), approved / committed / actual / remaining `MoneyDisplay` `{ amount, currency: data.currency }`, `utilisationPct` as text `${row.utilisationPct}%` (may exceed 100). `getRowId: (row) => row.projectId`. No client refilter. Do not add a currency column.
    5. Toolbar wrap: Back `Link` `reportsHref()`; `Link` `auditHref()`.
    6. Do not call `useProjectReport` in a loop. Do not invent `currency` on the row type.
  - **Layout:** stack totals, then table inside overflow. Toolbar wrap. No `md:grid`. No Sheet. Mixed-currency Alert not `hidden`.
  - **Pattern:** A1-equivalent **A1.5**. Copy A8.3 `TransactionList.tsx` / A5.2 `OrgCardList.tsx`. Hook: `useOrganizationReport` (B9 `.organization`). `MoneyDisplay` F3.10.
  - **Accept:** `pnpm verify`. `OrganizationReport.tsx` contains `useOrganizationReport` and `orgTotalsExcludeSomeProjects` and does **not** contain `useProjectReport`, `parseFloat`, or a `currency` property read on a project row. 375px and 768px: no page-level horizontal scrollbar; totals + Alert + table reachable; table may scroll inside. Menu/Sheet still works below `md`. Static `/reports/organization` still not a `[id]` page.
  - **Notes:** _{filled in on completion}_

### A9.5 — Audit log

- [ ] **A9.5** — `/audit` filters, actorType, DiffView Sheet, cursor Load more
  - **Files:**
    - `src/app/(app)/audit/page.tsx` (replace placeholder)
    - `src/app/(app)/audit/AuditList.tsx` (`'use client'`)
  - **Do:**
    1. `parseAuditSearchParams` from `useSearchParams`. `useMe` for `holdsMemberManage`. If false: `PermissionGateView` denial `viewAuditDenialMessage()` and **do not** call `useAudit`.
    2. Else `useAudit({ ...filter, limit: 20 })` — omit empty keys; **omit** `cursor`. Flatten pages. **No client-side refilter.** 403 → `error.message`.
    3. Toolbar `flex flex-wrap gap-2 min-w-0`: Project `Select` (`__all__` omits `projectId`; `useProjects({ page: 1, pageSize: 100 })`); Inputs or Selects writing URL for `subjectType`, `subjectId`, `actorId`, `action` (free strings, `encodeURIComponent` via the href helper); `DateRangePicker` `from`/`to`. Changing a filter uses `auditListHref` + `router.replace`. Do not put `cursor` in the URL.
    4. Empty: `noAuditEmpty()` when `!isPending && !hasNextPage && items.length === 0`.
    5. `DataTable` columns: `at` (`formatDateTime`), `actorType` (`Badge variant="outline"` + `timelineActorChipLabel(actorType, undefined)` — **do not hide** `RULE` / `SYSTEM` / `AIRWALLEX`), `action` (`min-w-0 break-words`, `title` = full string), `subjectType` + `subjectId` (wrap; if `subjectType === 'card'` `Link` `cardHref(subjectId)`; if `transaction` `Link` `transactionHref`; else text), row action `Button` `Diff` opens F3 `Sheet` `side="right"`. `getRowId: (row) => row.id`. Pagination `mode: 'cursor'` sentinel `nextCursor: hasNextPage ? 'next' : null` + `fetchNextPage` (A5.8 / A8.3). Load more reachable.
    6. Sheet: `DiffView` `before={row.before}` `after={row.after}`. Heading `action` + actor chip. Do not JSON-dump `metadata` as the primary view (optional `<pre className="min-w-0 break-all">` below the diff is OK).
    7. Do **not** call `useProjectAudit` or `useActivity`. Do not edit `Timeline.tsx` / `DiffView.tsx`.
  - **Layout:** table scrolls **inside**; toolbar wrap. Diff is **Sheet**, not a page `md:grid`. ActorType + Diff not `hidden` below `md` (table may scroll inside to reach them).
  - **Pattern:** A1-equivalent **A1.5**. Copy A8.3 `TransactionList.tsx` (URL filters, infinite cursor table) + A3.5 `PeopleList.tsx` Edit **Sheet**. Hook: `useAudit` `src/client/hooks/useReports.ts` (B9 `auditContracts.list`). `DiffView` F3.18. Actor labels: `src/components/patterns/timelineActor.ts`.
  - **Accept:** `pnpm verify`. `AuditList.tsx` contains `useAudit` and `DiffView` and does **not** contain `useProjectAudit`, `useActivity`, `parseFloat`, or `cursor` inside `auditListHref`. RULE rows are not filtered out. 375px and 768px: no page-level horizontal scrollbar; filters wrap; Diff Sheet reachable; Load more reachable; table may scroll inside. Menu/Sheet (nav) still works below `md`.
  - **Notes:** _{filled in on completion}_

### A9.6 — Closure wizard (preflight, start, resume, settle)

- [ ] **A9.6** — `/projects/[id]/closure` StepWizard; blockers link; resumable
  - **Files:**
    - `src/app/(app)/projects/[id]/closure/page.tsx` (replace placeholder)
    - `src/app/(app)/projects/[id]/closure/ClosureFlow.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<ClosureFlow />` only. Lives under project layout (workspace tabs stay six).
    2. `parseOptionalIdParam` on `useParams().id`. `useProject(id)`. 404 → `projectNotFoundMessage()`. Loading: `LoadingState`.
    3. If `isProjectArchived(status)`: `Alert` `archivedProjectMessage()` + `Link` `finalReportHref(id)`; **do not** call start/complete; **do not** call `useClosureStatus`. Preflight optional skip.
    4. If `CLOSED` (not archived): `Alert` + `Link` `finalReportHref(id)` (snapshot may 404 — A9.7 handles that). No start.
    5. If `ACTIVE`: `useClosurePreflight(id)`. **Do not** call `useClosureStatus` (`id` for that hook `''`). Render `StepWizard` `steps={CLOSURE_STEPS}` `activeStepId="PREFLIGHT"` `nextLabel={startClosureLabel()}` `isStepValid={() => canClickStart({ projectStatus, canStart: preflight.canStart, archived: false })}` `onNext` → `useStartClosure().mutateAsync({ id })` `onBack` no-op. Body: if `!canStart`, heading `closureBlockedHeading()` + list of `Link` `blockerHref(item, id)` with `item.summary` (`flex flex-col gap-2 min-w-0`). If `canStart`, short line that start will freeze cards. `PermissionGate` `permission="project.close"` `projectId={id}` `denialMessage={closeProjectDenialMessage()}` around Next is UX only — wizard Next is the Button inside StepWizard; wrap the whole wizard in the gate with `fallback` explaining denial.
    6. If `CLOSING`: `Alert` `closureResumeMessage()`. `useClosureStatus(id)` (real id). `activeStepId={closureActiveStep('CLOSING', status.currentStep)}`. Show each step’s `status` as `Badge variant="outline"` in the body (stack). SETTLE `BLOCKED`/`IN_PROGRESS`: `Alert` `settleWaitingMessage()` + `detail` text + `Link` `transactionListHref({ projectId: id, status: 'AUTHORIZED' })` + `Button` `Refresh` `refetch`. `useEffect` poll per policy §9 (`SETTLE_POLL_MS`, clear on unmount). `nextLabel={closeCardsAndArchiveLabel()}` `isStepValid={() => canClickComplete({ projectStatus: 'CLOSING', steps: status.steps, archived: false })}` `onNext` → open CLOSE `ConfirmDialog` (do not mutate yet). Complete dialogs + mutate may live in this file (A9.7 still owns the **final report page**). If you open confirms here: sequence policy §5 then `useCompleteClosure().mutate({ id, input: completeClosureInput() })` then `router.push(finalReportHref(id))`. 409 SETTLE → `Alert` `error.message`.
    7. Do **not** call `useTransitionProject`. Do **not** call `useCloseCard`. Do **not** edit `StepWizard.tsx`. Do not hide the rail below `md`.
  - **Layout:** `StepWizard` rail wrap (already). Body **stack** `flex flex-col gap-4 min-w-0`. No page `md:grid`. Confirms are **Dialog**, not a second page. Blocker list stack, not `hidden`. Next / confirm reachable.
  - **Pattern:** A1-equivalent **A1.6** `src/app/(onboarding)/onboarding/create-organization/page.tsx` (first Track A form). Copy A2.4–A2.7 `src/app/(app)/projects/new/` `StepWizard` + `nextLabel`. Confirms: A5.5 `src/app/(app)/cards/[id]/CardDetail.tsx` type-to-confirm `CLOSE`. Hooks: `useClosurePreflight` / `useClosureStatus` / `useStartClosure` / `useCompleteClosure` in `src/client/hooks/useReports.ts` (B9 `closureContracts`). Freeze UX: A5.5 (link out, do not duplicate).
  - **Accept:** `pnpm verify`. `ClosureFlow.tsx` contains `useClosurePreflight` and `StepWizard` and `blockerHref` and does **not** contain `useTransitionProject`, `useCloseCard`, `usePanToken`, `parseFloat`, or `type="number"`. ACTIVE path does not call `useClosureStatus` with a real id. `canStart === false` disables Start. 375px and 768px: no page-level horizontal scrollbar; step rail wraps; blocker Links + Next / confirm reachable by vertical scroll (not `hidden`); Menu/Sheet still works; workspace tabs still wrap and still six.
  - **Notes:** _{filled in on completion}_

### A9.7 — Complete confirms + final report

- [ ] **A9.7** — Type-to-confirm CLOSE then ARCHIVE; `/projects/[id]/report/final` no fixed width
  - **Files:**
    - `src/app/(app)/projects/[id]/closure/ClosureFlow.tsx` (edit — confirm dialogs if not finished in A9.6)
    - `src/app/(app)/projects/[id]/report/final/page.tsx` (replace placeholder)
    - `src/app/(app)/projects/[id]/report/final/FinalReport.tsx` (`'use client'`)
  - **Do:**
    1. Closure complete: two `ConfirmDialog`s, phrases `CLOSE` then `ARCHIVE`, descriptions per §12 (`postCloseClearingMessage()` on the cards dialog). Then `completeClosureInput()` mutate. Loading on the confirm `loading={complete.isPending}`. Do not skip a phrase.
    2. Final page: `useFinalReport(id)` + `useProjectMembers(id)` for names. 404 → `finalReportMissingMessage()`. 403 → `error.message`.
    3. Stack **without** `max-w-md` / `max-w-3xl` / `max-w-5xl` / `max-w-prose` on the page root or main column. `BudgetBar` `{...reportToBudgetBar(data)}`. Same four `MoneyDisplay` figures as A9.3. `closedAt` / `archivedAt` via `formatDateTime` (`archivedAt` null → em dash). `transactionCount` / `accessHistoryCount` as wrapping text ints (not money).
    4. Category + member tables as A9.3. Link wrap: `budgetHref(id)` (budget tab), `projectReportHref(id)`, `auditListHref({ projectId: id })`.
    5. Totals are the snapshot ints — do **not** call `useBudget` to “fix” them. Spec “match the budget tab” means the same ledger fields through `MoneyDisplay` / `BudgetBar`, plus a Link to the budget tab.
    6. If archived: `Alert` `archivedProjectMessage()`; no mutation buttons on this page.
  - **Layout:** stack, **no fixed width**. Tables inside overflow. `BudgetBar` existing `md:grid-cols-4`. No Sheet required. Confirms are Dialogs on the closure route. Figures wrap.
  - **Pattern:** A1-equivalent **A1.4** detail + **A1.6** confirm. Copy A9.3 `ProjectReport.tsx` (same file family as A4.2). Confirms: A5.5 `CLOSE`. Hook: `useFinalReport` / `useCompleteClosure` (B9 `.final` / `.complete`).
  - **Accept:** `pnpm verify` and `pnpm test client/lib/reports`. Complete payload is exactly `{ confirmCloseCards: true, confirmArchive: true }`. `FinalReport.tsx` contains `useFinalReport` and does **not** contain `max-w-md`, `max-w-3xl`, `useBudget`, `parseFloat`, or `Math.max(0`. 375px and 768px: no page-level horizontal scrollbar; final report figures + tables reachable; closure confirm Inputs + confirm Buttons reachable; Menu/Sheet still works.
  - **Notes:** _{filled in on completion}_

### A9.8 — Chrome Links + archived Alert + View in audit

- [ ] **A9.8** — Close / Resume / Final report Links; archived Alert; card audit Link
  - **Files:**
    - `src/app/(app)/projects/[id]/ProjectWorkspace.tsx` (edit — header actions + archived Alert)
    - `src/app/(app)/projects/ProjectList.tsx` (edit — row actions)
    - `src/app/(app)/projects/[id]/ProjectOverview.tsx` (edit — Status tile href when CLOSING / ARCHIVED)
    - `src/app/(app)/cards/[id]/CardDetail.tsx` (edit — one `View in audit` Link)
  - **Do:**
    1. `ProjectWorkspace`: if `isProjectArchived(header.status)` → `Alert` `archivedProjectMessage()` above tabs (not `hidden`). If `isProjectCloseable(status)` → `PermissionGate` `project.close` `Link` `closureHref(id)` label `Close project` (`buttonVariants` + `Link` or `Button asChild` primary — **locked:** outline `Button asChild` + `Link` is OK). If `isProjectClosing(status)` → `Link` `resumeClosureLink()` / `closureHref(id)`. If `CLOSED` or `ARCHIVED` → `Link` `finalReportHref(id)`. Keep existing DRAFT Cancel / PENDING Launch / CLOSED Archive. Do **not** add `useTransitionProject({ to: CLOSING })`. Aside collapse unchanged.
    2. `ProjectList` row actions: same Close / Resume / Final report Links (wrap `flex-wrap`). Do not add a seventh column that `whitespace-nowrap`s the page.
    3. `ProjectOverview` Status tile: if CLOSING, `href={closureHref(id)}`; if ARCHIVED or CLOSED, `href={finalReportHref(id)}`; else keep today’s DRAFT wizard / activity href. Do not add a fifth overview tile. Grid stays `grid-cols-1 md:grid-cols-2`.
    4. `CardDetail`: heading wrap `Link` `auditListHref({ subjectType: 'card', subjectId: id })` label `View in audit`. Do not call `useAudit` on the card page. Do not touch reveal / PAN.
    5. Do not edit `AccessReviewList.tsx`. Do not add workspace tabs. Do not edit `AppShell.tsx`.
  - **Layout:** header actions `flex flex-wrap gap-2`. Overview grid unchanged. Card Link wraps. Archived Alert stack. No new Sheet. No `hidden` Close below `md`.
  - **Pattern:** A1-equivalent **A1.5** (list actions) + **A1.4** (detail Link). Copy A3.1 `ProjectOverview.tsx` tile hrefs. Workspace header: existing Cancel/Launch in `ProjectWorkspace.tsx`. Card Link: A8.6 `CardDetail.tsx` `View in transactions`.
  - **Accept:** `pnpm verify`. `ProjectWorkspace.tsx` still has `hidden` + `md:flex` only in AppShell (this file has no aside). `WORKSPACE_TAB_HREFS` still six. ACTIVE shows Close project Link to `/projects/{id}/closure`. ARCHIVED shows the locked Alert. `CardDetail.tsx` still has no `cvv` / `card_number` / `usePanToken`. 375px and 768px: no page-level horizontal scrollbar; Close / Resume / Final report reachable; overview tiles wrap; Menu/Sheet still works.
  - **Notes:** _{filled in on completion}_

### A9.9 — Don’t-break + invariant proofs

- [ ] **A9.9** — Unclamped remaining, no client ledger, 375/768, shell unchanged, access-reviews not rebuilt
  - **Files:**
    - `src/client/lib/reports.test.ts` (extend)
    - `src/client/lib/projects.test.ts` (assert `WORKSPACE_TAB_HREFS` still six, still includes `/activity`, still no settings, still no `/projects/${id}/closure` **tab**, still no `/audit` tab)
    - `src/client/lib/access.test.ts` (`SETTINGS_NAV` still four hrefs — no Audit / Reports / Closure)
    - screens listed above — **read only** unless a §12 string or layout class is missing
  - **Do:**
    1. Assert `reportOverCommitted(-1)` true; `reportToBudgetBar({ remaining: -1, utilisationPct: 110, ... }).remaining === -1` and `utilisationPct === 110`.
    2. Assert `orgTotalsExcludeSomeProjects` true only when sums differ; false when equal.
    3. Assert `parseAuditSearchParams` drops `cursor` / `page` / `limit`.
    4. Assert `completeClosureInput()` both literals true; phrases `CLOSE` / `ARCHIVE`.
    5. Assert `canClickStart` / `canClickComplete` / `closureActiveStep` / `blockerHref` cases from A9.0.
    6. Grep A9 screen files (`src/app/(app)/reports`, `src/app/(app)/audit`, `src/app/(app)/projects/[id]/closure`, `src/app/(app)/projects/[id]/report`): no `projectBudget`, no `from '@/server/`, no `type="number"`, no `parseFloat`, no `Math.max(0`, no `downloadExport`, no `useProjectAudit`, no `useTransitionProject`, no `usePanToken`, no `useBudget`. PAN scan: no `cvv`, `card_number`, `\bPAN\b` (same style as A8.8).
    7. Confirm `(app)/layout.tsx` still `requireApp()` + `AppShellFrame`. Confirm `AppShell.tsx` aside class still includes `hidden` and `md:flex`. Confirm `DEFAULT_NAV` is Reports then Audit then Roles.
    8. Confirm `WORKSPACE_TAB_HREFS` length 6 and includes `/activity` and does not include `closure` or `report/final` as a tab href.
    9. Confirm `src/app/(app)/settings/access-reviews/AccessReviewList.tsx` still exists and A9 did not replace it.
    10. Manual don’t-break: `/reports` (exports + wrap Links), `/reports/organization` (Alert + table), `/reports/project/[id]` (BudgetBar + tables), `/audit` (filters + Diff Sheet), `/projects/[id]/closure` (rail + Next / confirm), `/projects/[id]/report/final` (no fixed width, tables), archived project workspace Alert, at 375px and 768px.
  - **Layout:** n/a (proof) plus the manual resize check.
  - **Pattern:** A1-equivalent **A1.7** `src/client/lib/auth.ts` tests / A1 proofs. Copy A8.8 `src/client/lib/transactions.test.ts`. A2.1 shell classes (read-only).
  - **Accept:** `pnpm test client/lib/reports` and `pnpm test client/lib/projects` and `pnpm test client/lib/access` and `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar on catalogue (exports), org report (Alert + table), project report (figures), audit (Diff Sheet), closure (Next / confirm reachable, rail wraps), final report (no page-level sideways scroll, no fixed width clipping actions); Menu/Sheet still works below `md`; tables may scroll inside. Aside still `hidden md:flex`.
  - **Notes:** _{filled in on completion}_

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Spec’s review checklist in `A9-reports-closure.md` signed off:
  - [ ] Closure is guided, resumable, and shows per-step progress
  - [ ] Pre-flight blockers link to the items blocking
  - [ ] Card closure uses type-to-confirm and explains post-closure clearing
  - [ ] Audit distinguishes rule actors from human ones and renders usable diffs
  - [ ] Archived projects reject every mutation in the UI as well as the API
  - [ ] Exports stream without blocking
  - [ ] Final report totals match the budget tab exactly
  - [ ] 375px and 768px: no page-level horizontal scrollbar; closure Next / confirm reachable; report tables may scroll internally
- [ ] `/dev/shell` still works (unchanged collapse)
- [ ] No new F3 primitive files
- [ ] No `call()` / `fetch` / `@/server` in `'use client'` screens
- [ ] `/settings/access-reviews` still the A3 screen (not rebuilt)
- [ ] `STATUS.md` updated — Track A complete; next is whatever the user names (do not invent a phase)

## Out of scope (do not do in A9)

- AppShell collapse / second nav (A2.1)
- `/projects/[id]/settings` or a seventh workspace tab
- `/projects/[id]/audit` product URL / `useProjectAudit`
- Rebuilding `/settings/access-reviews` (A3.8)
- New or changed B9 contracts (including per-project `currency` on the org report)
- Client `projectBudget` / importing `src/server/services/reports/*` or `closure/*`
- Editing F3 `StepWizard` / `DiffView` / `Timeline` / `BudgetBar` / `download.ts` / `invalidationMap.ts` / F1 `useReports.ts`
- `useTransitionProject` to `CLOSING`
- Scheduled report delivery, ERP write-back, PDF generation (B9 out of scope)
- `@testing-library/react`
- `sm:` / `lg:` / `xl:` / `2xl:` on A9 screens
- Creating cards or typing PANs
