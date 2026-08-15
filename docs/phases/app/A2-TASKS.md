# A2 — Dashboard & Projects · Tasks

**Spec:** [A2-dashboard-projects.md](./A2-dashboard-projects.md)
**Model:** cheap / LOW — name every file, inline every field with type and constraints, copy the cited A1/F3/F1/B2 file; do not invent endpoints, change B2–B9 contracts, add primitives (except the one `nextLabel` prop in A2.7), or hide a control without a Sheet/menu replacement.
**Depends on:** A1, complete and verified

No new API contracts. B2 already shipped `projectContracts`. Budget step uses existing `budgetContracts.put`. Approvals/activity use existing F1 hooks. The review gate is the locked policies + helper shapes below.

**Powers:** B2 (and B4 `PUT` budget for wizard step 2) · **Hooks (F1, already exist):** `useProjects`, `useProject`, `useCreateProject`, `useUpdateProject`, `useTransitionProject`, `useWorkstreams`, `useCreateWorkstream`, `useMe`, `usePermissions`, `useApprovalCount`, `useApprovals`, `useActivity`, `useProjectActivity`, `useBudget`, `useSetBudget`, `useCan` · **Guards (F0, already exist):** `requireApp` on `(app)/layout.tsx`

Recipe: [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Visual tokens: [`../../VISUAL-DIRECTION.md`](../../VISUAL-DIRECTION.md).

---

## A2.0 locked policies (do not reopen)

Approved 2026-08-15. Implementers follow these; do not re-litigate. A2.0 still implements the helpers below and STOPs before A2.1 screens.

### 1. No new contracts, no new primitives (one F3 prop later)

- Do **not** add or rename fields in `src/shared/schemas/*` or `src/shared/contracts/*`.
- Do **not** add a shadcn/pattern file. A2 screens compose F3 files listed in each task’s **Pattern**.
- Do **not** import `@/server/*` from any `'use client'` file. Exception: A2.0 **moves** the already-pure `canTransition` / `permissionForTransition` into `src/shared/projectLifecycle.ts` so the client can hide invalid status actions. That is a relocate, not a wire-shape change. Server files re-import; existing `pnpm test projects/transitions` must stay green.
- Do **not** call `call()` or `fetch` from a screen. Use F1 hooks. Auth.js `signOut` / `useSession` from `next-auth/react` are allowed (they are not `call()`).
- A2.7 may add **one optional prop** `nextLabel?: string` (default `'Continue'`) to existing `StepWizardProps` / `StepWizard`. That is not a new primitive. Do not add a second wizard, a mobile nav, or a `<select>` of steps.

### 2. Routes (A2 spec wins)

| URL              | Files                                                 | Guard                 | Shell                       |
| ---------------- | ----------------------------------------------------- | --------------------- | --------------------------- |
| `/dashboard`     | `src/app/(app)/dashboard/page.tsx`                    | `requireApp` (layout) | `AppShell`                  |
| `/projects`      | `src/app/(app)/projects/page.tsx`                     | same                  | `AppShell`                  |
| `/projects/new`  | `src/app/(app)/projects/new/page.tsx`                 | same                  | `AppShell`                  |
| `/projects/[id]` | `src/app/(app)/projects/[id]/layout.tsx` + `page.tsx` | same                  | `AppShell` + workspace tabs |
| `/approvals`     | placeholder page only                                 | same                  | `AppShell`                  |
| `/activity`      | placeholder page only                                 | same                  | `AppShell`                  |

Resume an abandoned `DRAFT` at `/projects/new?draftId=<project id>` (`idSchema`: string min 1). Do **not** add `/projects/[id]/edit`.

Workspace tab hrefs (create thin placeholders in A2.8 so tabs do not 404):

| Tab      | Href                      | Lands in |
| -------- | ------------------------- | -------- |
| Overview | `/projects/[id]`          | A3       |
| People   | `/projects/[id]/people`   | A3       |
| Budget   | `/projects/[id]/budget`   | A4       |
| Cards    | `/projects/[id]/cards`    | A5       |
| Controls | `/projects/[id]/controls` | A6       |
| Activity | `/projects/[id]/activity` | A8       |

**No Settings tab.** PRD lists one; A3–A9 do not name `/projects/[id]/settings`. Do not invent it.

Placeholder copy (locked): `{Tab} lands in {phase}.` e.g. `Overview lands in A3.`

### 3. Layout — one breakpoint `md`, AppShell collapse, four patterns

Copy [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Do not add `sm:` / `lg:` / `xl:` / `2xl:` (ignore pre-existing `sm:` inside F3 `Sheet` / `UserMenu` — do not edit those files to remove them).

**A2.1 owns shell collapse** (first task that mounts the product shell):

```tsx
<aside className="hidden w-56 shrink-0 flex-col md:flex">…existing OrgSwitcher + SideNav…</aside>
{/* in header */}
<Button type="button" className="md:hidden" aria-label="Open menu" onClick={() => setOpen(true)}>Menu</Button>
<Sheet open={open} onOpenChange={setOpen}>
  <SheetContent side="left">
    <SheetHeader><SheetTitle>Menu</SheetTitle></SheetHeader>
    {/* same OrgSwitcher, same SideNav — do not build MobileNav.tsx */}
  </SheetContent>
</Sheet>
```

- Desktop aside keeps today’s `w-56 shrink-0 flex-col gap-4 border-r …` classes; only visibility becomes `hidden … md:flex`.
- Header stays. Main column already has `min-w-0`.
- Close the Sheet when `usePathname()` changes.
- `/dev/shell` keeps using `mockShellData` and must still render (it will inherit collapse).

Per-screen layouts (repeat on the task):

| Screen              | Narrow                                                                                | Desktop (`md:`)             |
| ------------------- | ------------------------------------------------------------------------------------- | --------------------------- |
| Dashboard summaries | `grid-cols-1`                                                                         | `md:grid-cols-2`            |
| Project list        | `DataTable` + internal `overflow-x-auto`; toolbar `flex flex-wrap gap-2`              | same table, not a card list |
| Wizard              | `StepWizard` rail already `flex-wrap`; step body **one column** `flex flex-col gap-4` | same; no `md:grid`          |
| Workspace tabs      | `flex flex-wrap gap-2` **Links**, not Radix `Tabs` (these are routes)                 | same wrap                   |

### 4. Existing contracts (copy these fields; do not redeclare)

**`GET /api/projects`** — `projectContracts.list`

- input `listProjectsQuery` (`src/shared/schemas/project.ts`): `{ status?: ProjectStatus, ownerId?: string min 1, costCentre?: string min 1, page: coerce int min 1 default 1, pageSize: coerce int min 1 max 100 default 20, sort?: projectSortSchema }`
- `projectSortSchema`: `'updatedAt' \| '-updatedAt' \| 'name' \| '-name' \| 'createdAt' \| '-createdAt' \| 'startDate' \| '-startDate' \| 'status' \| '-status'`
- output `projectListSchema`: `{ items: projectSchema[], page: int min 1, pageSize: int min 1, total: int min 0 }`
- **No client-side refilter.** URL search params map 1:1 onto this input via `parseProjectListSearchParams`.

**`POST /api/projects`** — `projectContracts.create` — permission `project.create`

- input `createProjectInput`: `{ name: string min 1 max 120, code: string min 1 max 64 matching /^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/, description?: string max 2000, ownerId?: string min 1, costCentre?: string min 1, startDate?: iso datetime, endDate?: iso datetime, cardStructure?: partial { shared?: boolean, perMember?: boolean, vendor?: boolean, oneTime?: boolean } }`
- output `projectSchema` (status always `DRAFT`). Server default `description` to `''`; `ownerId` / dates / costCentre to `null` if omitted; card flags default `false`.
- Duplicate `code` in the org → `409 CONFLICT`, message `Project code is already taken in this organisation`.

**`GET /api/projects/:id`** — `.get` → `projectDetailSchema` = `projectSchema` + `overview: { memberCount, activeCardCount, pendingApprovalCount, alertCount: int min 0, budgetRemaining: money \| null, budgetSpent: money \| null }`. Overview counts may still stub to 0 (`TODO(B7)` on approval count). Do not invent a second overview fetch.

**`PATCH /api/projects/:id`** — `.update` — permission `project.edit`

- input `updateProjectInput`: partial of `{ name, code, description, costCentre (string min 1 \| null), startDate (iso \| null), endDate (iso \| null), cardStructure: { shared, perMember, vendor, oneTime } }` with **at least one** key. Does **not** include `ownerId` or `status` or `workstreams`.
- `CLOSED` / `ARCHIVED` / `CANCELLED` → `409`.

**`POST /api/projects/:id/transition`** — `.transition`

- input `{ to: ProjectStatus, reason?: string max 500 }`
- output `projectSchema`
- **There is no `DRAFT → ACTIVE` edge.** Graph (already in `canTransition`):
  - `DRAFT → PENDING_APPROVAL` (guard `readyForApproval`) or `DRAFT → CANCELLED`
  - `PENDING_APPROVAL → ACTIVE`
  - `CLOSING → CLOSED`, `CLOSED → ARCHIVED`
  - `ACTIVE → CLOSING` is **not** offered here (B9 `POST /api/projects/:id/closure/start` only). If the API is called with `to: CLOSING` it 409s.
- `projectReadyForApproval` (DRAFT → PENDING_APPROVAL only): `{ name min 1 max 120, ownerId min 1, startDate iso, endDate iso, hasBudget: boolean }` and `endDate >= startDate` and `hasBudget === true`. `hasBudget` is true when budget `approvedAmount > 0` or snapshot `approved > 0`.
- Permission by target (`permissionForTransition`): `PENDING_APPROVAL` / `CANCELLED` → `project.edit`; `ACTIVE` → `request.approve`; `CLOSED` / `ARCHIVED` → `project.close`.

**`projectSchema` fields (list + detail):** `id, orgId, name min 1 max 120, code (regex above), description max 2000, status: DRAFT \| PENDING_APPROVAL \| ACTIVE \| CLOSING \| CLOSED \| ARCHIVED \| CANCELLED, ownerId: string \| null, costCentre: string min 1 \| null, startDate: iso \| null, endDate: iso \| null, workstreams: { id, name min 1 max 120 }[], cardStructure: { shared, perMember, vendor, oneTime: boolean }, budgetSnapshot: { approved, committed, actual, remaining: int, utilisationPct: int min 0, overCommitted: boolean, updatedAt: iso } \| null, approvedAt \| launchedAt \| closedAt: iso \| null, createdAt, updatedAt`.

**`PUT /api/projects/:id/budget`** — `budgetContracts.put` — permission `budget.edit`

- input `putBudgetInput`: `{ currency: string length 3, approvedAmount: int >= 0, formula?: string \| null, thresholdPcts?: int[] each 1–1000 }`
- output `budgetDetailSchema`: `{ budget: budgetSchema \| null, projection: { approved, committed, actual, remaining: int, utilisationPct, overCommitted, updatedAt } }`
- A2 budget step sends **only** `currency` + `approvedAmount` (no formula, no categories). `currency` = `useMe().data.activeOrg.baseCurrency` (length 3). Do not let the user pick a different currency.

**`GET /api/me`** — `authContracts.me` → `{ user: { id, email, name min 1 max 120, image?, defaultOrgId?, createdAt }, memberships: { id, orgId, userId, orgRole: OWNER \| ADMIN \| MEMBER, status, joinedAt, org: { id, name, slug } }[], activeOrg?: organizationSchema, onboarded: boolean }`. `organizationSchema` includes `costCentres: string[]` and `baseCurrency` length 3.

**`GET /api/me/permissions`** — `{ projects: { projectId, permissions: Permission[], scope }[] }`. OWNER/ADMIN get every org project with all permissions — **but zero projects ⇒ `projects: []`**. Create-gating therefore **must** use org role, not only this list.

**`GET /api/approvals/count`** — `{ count: int >= 0 }` via `useApprovalCount()`.

**`GET /api/approvals`** — `useApprovals({ page, pageSize })` → `{ items: purchaseRequestSchema[], page, pageSize, total }`.

**`GET /api/activity`** — `useActivity({ limit?: coerce 1–100 default 20, cursor? })` infinite; page `{ items: activityItemSchema[], nextCursor: string \| null }`. `activityItemSchema`: `{ id, orgId, projectId: string \| null, type: TRANSACTION \| PURCHASE_REQUEST \| APPROVAL \| CARD \| ACCESS \| RULE_RUN \| AUDIT, at: iso, actorType, actorId, subjectType min 1, subjectId, summary min 1 max 500, payload: Record<string, unknown> }`.

### 5. Wizard — nine steps, ownership, save, launch

Kitchen-sink ids (already in `src/app/dev/ui/PatternGallery.tsx`): `details`, `budget`, `members`, `roles`, `card-structure`, `controls`, `approval-rules`, `review`, `launch`.

| id               | Label          | A2 behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `optional` |
| ---------------- | -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- |
| `details`        | Details        | Real form. First Next **creates** the DRAFT (`useCreateProject`) then `router.replace('/projects/new?draftId='+id)`. Later Next **PATCHes**.                                                                                                                                                                                                                                                                                                                                                     | `false`    |
| `budget`         | Budget         | Real `useSetBudget` (`approvedAmount` + org `baseCurrency`). Minimum so `hasBudget` can become true. A4 may enrich (categories/formulas) later.                                                                                                                                                                                                                                                                                                                                                  | `false`    |
| `members`        | Members        | `DeferredStep` copy `Members land in A3.` Not a fake member table.                                                                                                                                                                                                                                                                                                                                                                                                                               | `true`     |
| `roles`          | Roles          | `Roles land in A3.`                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | `true`     |
| `card-structure` | Card structure | Real four **boolean** `Switch`es → PATCH `cardStructure`. This is B2 project config, not A5 card issuance. Defaults all `false`.                                                                                                                                                                                                                                                                                                                                                                 | `false`    |
| `controls`       | Controls       | `Controls land in A6.`                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `true`     |
| `approval-rules` | Approval rules | `Approval rules land in A7.`                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | `true`     |
| `review`         | Review         | Read-only summary of everything on the draft (details, budget projection, card-structure flags, deferred-step notices). Must show which card **kinds** Launch will request (`shared` / `perMember` / `vendor` / `oneTime`) and the **budget** they will draw from. Do **not** invent numeric card limits (those come from A6 rules). If a flag is false, say `Not issuing {kind} cards.` If deferred steps are empty, say the locked “lands in” sentence — never `$0` limits that look finished. | `false`    |
| `launch`         | Launch         | Primary runs transitions (below). Then `Timeline` of `useProjectActivity(id)`, not a success toast.                                                                                                                                                                                                                                                                                                                                                                                              | `false`    |

**Save:** on Next of a real step, mutate then advance. Do not PATCH on every keystroke. `isDirty={form.formState.isDirty}` into `StepWizard` (already calls `useUnsavedChangesGuard`). **No App Router navigation blocker** — `beforeunload` only. Cancel: if dirty, F3 `ConfirmDialog` (ordinary confirm, **not** type-to-confirm) title `Discard unsaved changes?` action `Discard` then `router.push('/projects')`; if not dirty, push immediately.

**Launch (no new endpoint, no new graph edge):**

1. If status is `DRAFT`: `useTransitionProject({ id, input: { to: 'PENDING_APPROVAL' } })`. On `VALIDATION_FAILED`, stay on `review`/`launch` and `applyServerErrorsFromApiError` / `Alert` with `error.message` (do not advance).
2. If that succeeds (or status was already `PENDING_APPROVAL`): `useTransitionProject({ id, input: { to: 'ACTIVE' } })`.
3. `403 PERMISSION_DENIED` on step 2: **not a failure of the wizard.** Show `Alert` variant `info` copy `Submitted for approval. You need request.approve to launch.` plus the activity timeline.
4. `409 CONFLICT` on an invalid edge: `Alert` destructive with `error.message`. Do not offer the button if `canTransition` is false.
5. Success to `ACTIVE`: still no toast. Show `Timeline` + Button `Open project` → `/projects/[id]`.

`StepWizard` last-step button: `nextLabel="Launch"` (A2.7). Until that prop exists, do not fork a second footer.

### 6. Create permission (UX only)

`PermissionGate` / `useCan` require a `projectId`. Creating a project has none, and OWNER/ADMIN with **zero** projects have `me.permissions.projects === []`.

Use `PermissionGateView` + `canCreateProject` from A2.0:

- `orgRole` `OWNER` or `ADMIN` → allowed (even with zero projects).
- `MEMBER` → allowed iff some `me.projects[].permissions` includes `'project.create'`.
- missing me / unknown role → denied.

Locked denial: `You don't have permission to create a project.` Always show the control (disabled + tooltip) — never hide it. Server still rejects.

Org role comes from `useMe().data.memberships` row whose `orgId` equals `useActiveOrg().orgId` (fallback `activeOrg.id`).

### 7. Dashboard cards are links (not dead summaries)

Four cards, `grid grid-cols-1 gap-4 md:grid-cols-2`. Every card is a `<Link>` (or Card-as-child Link). Do not invent an alerts API (list items have no `overview.alertCount`).

| Card              | Data                                                                                                                                                                                          | Href                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Active projects   | `useProjects({ status: 'ACTIVE', page: 1, pageSize: 6, sort: '-updatedAt' })`                                                                                                                 | `/projects?status=ACTIVE` ; each row → `/projects/[id]`                                                |
| Pending approvals | `useApprovalCount()` + `useApprovals({ page: 1, pageSize: 5 })`                                                                                                                               | `/approvals`                                                                                           |
| Recent activity   | `useActivity({ limit: 8 })` first page `items`                                                                                                                                                | `/activity`                                                                                            |
| Alerts            | `useProjects({ status: 'DRAFT', page: 1, pageSize: 5, sort: '-updatedAt' })` (abandoned wizards) plus `useProjects({ status: 'PENDING_APPROVAL', page: 1, pageSize: 5, sort: '-updatedAt' })` | DRAFT rows → `draftWizardHref(id)`; PENDING → `/projects/[id]`; card chrome → `/projects?status=DRAFT` |

Zero projects org-wide: dashboard Active card uses `EmptyState` title `No projects yet` description `Create a project to get started.` action `Create project` → `/projects/new` (still gated by §6).

### 8. Lifecycle actions offered in the UI

Use shared `canTransition`. Never show a button for a false edge. Never show Close/CLOSING (wrong endpoint).

| Status                   | Buttons (if `can` the permission)                                                           |
| ------------------------ | ------------------------------------------------------------------------------------------- |
| `DRAFT`                  | `Resume` → `draftWizardHref(id)`; `Cancel project` → `{ to: 'CANCELLED' }` (`project.edit`) |
| `PENDING_APPROVAL`       | `Launch` → `{ to: 'ACTIVE' }` (`request.approve`)                                           |
| `ACTIVE` / `CLOSING`     | none in A2                                                                                  |
| `CLOSED`                 | `Archive` → `{ to: 'ARCHIVED' }` (`project.close`)                                          |
| `ARCHIVED` / `CANCELLED` | none                                                                                        |

Gate with `PermissionGate` when `projectId` exists. Invalid 409 still `Alert` / toast via existing error behaviour if somehow attempted.

### 9. Workspace header from cache

`src/app/(app)/projects/[id]/layout.tsx` owns name / code / `StatusBadge kind="project"` / tab links. Do **not** thread `AppShell.project` (leave it `null` in product; `/dev/shell` still passes a mock).

```ts
const cached = projectFromListCache(queryClient.getQueriesData({ queryKey: ['projects'] }), id)
const detail = useProject(id)
const header = detail.data ?? cached
```

If neither: `LoadingState` for the header. Tab `{children}` load independently — do not block the whole layout on `useProject`. `NOT_FOUND` → `ErrorState` (no Retry). `min-w-0` on the content column.

### 10. Money, dates, PAN, testing, ESLint

- Amounts: integer minor units. Budget input is `Input type="text"` + `parseMoneyInput(raw, currency)` from `src/lib/money.ts`. **Never** `type="number"`, **never** `parseFloat`. Display via `MoneyDisplay` / `BudgetBar`.
- Dates: F3 `DateRangePicker` (`from`/`to` already UTC midnight ISO `YYYY-MM-DDT00:00:00.000Z`).
- **Never touch a PAN.** A2 has no reveal, no card number, no CVV, no expiry.
- Tests: pure helpers in `src/client/lib/projects.ts` + `src/shared/projectLifecycle.ts` with vitest **node**. Do **not** add `@testing-library/react`.
- Screen Accept always includes `pnpm verify` plus **375px and 768px**: no page-level horizontal scrollbar; primary actions reachable; no overlapping chrome.
- `(app)` already bans `call()` / `fetch`. Do not add a `@/server` ban (server layout still uses `requireApp`).

### 11. Live AppShell data (A2.1)

Replace `mockShellData` in `src/app/(app)/layout.tsx` with a client `AppShellFrame`:

- `memberships`: `useMe().data.memberships.map(m => ({ orgId: m.orgId, name: m.org.name, slug: m.org.slug }))`
- `activeOrgId`: `useActiveOrg().orgId`
- `user`: `useMe().data.user` (`name`, `email`, `image?`)
- `approvalsCount`: `useApprovalCount().data.count ?? 0`
- `onSignOut`: `signOut({ callbackUrl: '/sign-in' })` from `next-auth/react`. Do **not** run `/sign-in` through `isSafeCallbackUrl` (that allowlist is post-auth dests, not the sign-in page).
- While `useMe` is loading, still render `AppShell` (empty memberships ok); do not unmount children.

Keep `src/client/shell/mockShellData.ts` for `/dev/shell` only.

### 12. Locked copy (do not paraphrase)

| Situation               | Surface                      | Copy                                                                                               |
| ----------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| Cannot create project   | `PermissionGateView` tooltip | `You don't have permission to create a project.`                                                   |
| Zero projects           | `EmptyState`                 | title `No projects yet` / description `Create a project to get started.` / action `Create project` |
| Duplicate code          | `Alert` destructive          | server message (`Project code is already taken in this organisation`)                              |
| Launch 403 on `ACTIVE`  | `Alert` info                 | `Submitted for approval. You need request.approve to launch.`                                      |
| Dirty cancel            | `ConfirmDialog`              | title `Discard unsaved changes?` confirm `Discard`                                                 |
| Deferred wizard step    | body text                    | `{Label} land in {A3\|A6\|A7}.` (Members/Roles → A3; Controls → A6; Approval rules → A7)           |
| Card kind off on review | body text                    | `Not issuing {shared\|per-member\|vendor\|one-time} cards.`                                        |
| Tab placeholder         | page                         | `{Tab} lands in {phase}.`                                                                          |

---

## Contracts first

- [x] **A2.0** — Project helpers + shared lifecycle (STOP for review)
  - **Files:**
    - `src/shared/projectLifecycle.ts` (create)
    - `src/shared/projectLifecycle.test.ts` (create)
    - `vitest.config.mts` (edit — add `'src/shared/projectLifecycle.test.ts'` to the **unit** `include` array next to `src/shared/access/**/*.test.ts`)
    - `src/server/services/projects/transitions.ts` (edit — import + re-export `canTransition` from shared; keep `TransitionGuard` / `TransitionResult` types here or re-export them from shared; **do not** change the graph)
    - `src/server/services/projects/transition.ts` (edit — delete local `permissionForTransition`; import it from `@/shared/projectLifecycle`)
    - `src/client/lib/projects.ts` (create)
    - `src/client/lib/projects.test.ts` (create)
    - re-export from `src/client/lib/index.ts` (`export * from '@/client/lib/projects'`). If that would cycle, skip the barrel and import `@/client/lib/projects` from screens.
  - **Do:** No React screens. No `AppShell` collapse yet. Implement the locked helper API:
    1. **Shared lifecycle** — copy the `EDGES` table from `src/server/services/projects/transitions.ts` verbatim:
       - `DRAFT`: `PENDING_APPROVAL` (guards `['readyForApproval']`), `CANCELLED` (guards `[]`)
       - `PENDING_APPROVAL`: `ACTIVE` (`[]`)
       - `ACTIVE`: `[]` (CLOSING is not an edge here)
       - `CLOSING`: `CLOSED`
       - `CLOSED`: `ARCHIVED`
       - `ARCHIVED` / `CANCELLED`: `[]`
       - `from === to` → `{ ok: false, reason: 'INVALID_TRANSITION' }`
    2. `canTransition(from: ProjectStatus, to: ProjectStatus): { ok: true; guards: readonly ('readyForApproval')[] } \| { ok: false; reason: 'INVALID_TRANSITION' }`
    3. `offeredTransitions(from: ProjectStatus): ProjectStatus[]` — targets where `canTransition` is ok.
    4. `permissionForTransition(to: ProjectStatus): Permission` — exact map in policy §4 (`PENDING_APPROVAL`/`CANCELLED` → `project.edit`; `ACTIVE` → `request.approve`; `CLOSING`/`CLOSED`/`ARCHIVED` → `project.close`; default `project.edit`).
    5. `WIZARD_STEPS` as `readonly { id: string; label: string; optional: boolean; filledBy: 'A2' \| 'A3' \| 'A4' \| 'A5' \| 'A6' \| 'A7' }[]` in the kitchen-sink order. `optional: true` only for `members`, `roles`, `controls`, `approval-rules`. `filledBy`: details/budget/card-structure/review/launch → `A2`; members/roles → `A3`; controls → `A6`; approval-rules → `A7`. (Budget stays `A2` for the minimum PUT; A4 may replace the step body later.)
    6. `wizardStepIndex(id: string): number` / `nextWizardStepId(id: string): string \| null` / `prevWizardStepId(id: string): string \| null` — null at ends; throw if `id` unknown.
    7. `canCreateProject(input: { orgRole: OrgRole \| undefined; me: MePermissions \| undefined }): boolean` and `createProjectDenialMessage(): string` returning the locked sentence in §12. OWNER/ADMIN true even if `me.projects` is `[]`.
    8. `activeOrgRole(memberships: { orgId: string; orgRole: OrgRole }[], activeOrgId: string \| null): OrgRole \| undefined` — match `orgId`; else `undefined`.
    9. `draftWizardHref(projectId: string): string` — `/projects/new?draftId=` + projectId (no encode that would change the id). If `projectId` length `< 1`, throw.
    10. `parseDraftId(input: { draftId?: string \| string[] \| undefined }): string \| null` — array → `[0]`; empty/missing → null.
    11. `parseProjectListSearchParams(input: { status?: string \| string[]; ownerId?: string \| string[]; costCentre?: string \| string[]; page?: string \| string[]; pageSize?: string \| string[]; sort?: string \| string[] }): ListProjectsQuery` — arrays use `[0]`. Run `listProjectsQuery.safeParse` on the coerced object; on failure return `{ page: 1, pageSize: 20 }` only. Do not invent extra keys.
    12. `projectListHref(filter: { status?: ProjectStatus; ownerId?: string; costCentre?: string; page?: number; pageSize?: number; sort?: ProjectSort }): string` — path `/projects`; omit defaults (`page` 1, `pageSize` 20, undefined optionals). `encodeURIComponent` values.
    13. `sortingToProjectSort(sorting: { id: string; direction: 'asc' \| 'desc' } \| null): ProjectSort \| undefined` — `id` must be one of `updatedAt`/`name`/`createdAt`/`startDate`/`status`; `desc` prefixes `-`; else `undefined`.
    14. `projectSortToSorting(sort: ProjectSort \| undefined): { id: string; direction: 'asc' \| 'desc' } \| null`
    15. `projectFromListCache(entries: ReadonlyArray<readonly [unknown, unknown]>, id: string): Project \| undefined` — skip values that are not `{ items: Project[] }`; return the first matching `items[].id`.
    16. `isReadyForApprovalInput(project: { name: string; ownerId: string \| null; startDate: string \| null; endDate: string \| null }, hasBudget: boolean): boolean` — `projectReadyForApproval.safeParse({ name, ownerId, startDate, endDate, hasBudget }).success` (import the schema; do not reimplement the refine).
    17. `hasBudgetFrom(project: { budgetSnapshot: { approved: number } \| null }, budgetApprovedAmount: number \| null): boolean` — true if `(budgetApprovedAmount ?? 0) > 0 \|\| (project.budgetSnapshot?.approved ?? 0) > 0`.
    18. `toTimelineItem(item: { id: string; at: string; actorType: ActorType; actorId: string; summary: string; subjectType: string; subjectId: string }): TimelineItem` — pass through those fields; do not put `payload` on the timeline item.
    19. `cardStructureReviewLines(cs: { shared: boolean; perMember: boolean; vendor: boolean; oneTime: boolean }): string[]` — one line per flag; true → `Will issue {shared\|per-member\|vendor\|one-time} cards.`; false → locked `Not issuing …` sentence.
  - **Pattern:** `src/client/lib/auth.ts` + `src/client/lib/auth.test.ts` (A1.0 allowlists). Lifecycle move: `src/shared/access/scope.ts` (F2 extracted pure server helpers; server re-imports). `canTransition` source: `src/server/services/projects/transitions.ts`. `permissionForTransition` source: `src/server/services/projects/transition.ts`. `listProjectsQuery`: `src/shared/schemas/project.ts`.
  - **STOP and get this reviewed before A2.1+.** Wrong launch graph or create-gate after screens land is a rewrite.
  - **Accept:** `pnpm test client/lib/projects` and `pnpm test shared/projectLifecycle` and `pnpm test projects/transitions` — cover: every `(from, to)` pair still matches the server matrix; `ACTIVE → CLOSING` is **not** ok; OWNER + empty `me.projects` **can** create; MEMBER without `project.create` **cannot**; unsafe/unknown list params dropped; `draftId` arrays use `[0]`; `sortingToProjectSort` ignores unknown column ids; `isReadyForApprovalInput` false when `ownerId` or dates null or `hasBudget` false; `cardStructureReviewLines` length 4.
  - **Notes:** Helpers in `src/shared/projectLifecycle.ts` (server `transitions.ts` re-exports) and `src/client/lib/projects.ts`. Graph unchanged; OWNER + empty `me.projects` can create. `pnpm verify` green (1561 tests).

---

## Tasks

### A2.1 — AppShell collapse (first product-shell task)

- [x] **A2.1** — Sidebar `hidden md:flex`; same nav in F3 `Sheet`; live `useMe` / `useApprovalCount`
  - **Files:**
    - `src/client/shell/AppShell.tsx` (edit)
    - `src/client/shell/AppShellFrame.tsx` (create, `'use client'`)
    - `src/app/(app)/layout.tsx` (edit — render `AppShellFrame`, drop `mockShellData`)
    - `src/client/lib/projects.test.ts` (optional: no new helpers required; skip if unused)
  - **Do:**
    1. `AppShell`: keep the existing aside class string **except** prepend `hidden` and add `md:flex` (final must include `hidden w-56 shrink-0 flex-col md:flex`). Do not change `w-56`. Do not remove `OrgSwitcher` / `SideNav` from the aside.
    2. `useState` for Sheet `open`. Header: first control is `Button` `type="button"` `className="md:hidden"` `aria-label="Open menu"` label `Menu`. Do not `hidden` this button at `md` without the aside as replacement (the aside **is** the replacement).
    3. `Sheet` + `SheetContent side="left"` + `SheetHeader` / `SheetTitle` children `Menu`. Inside: the **same** `OrgSwitcher` and `SideNav` components (second instance is OK; do not create `MobileNav.tsx` or a different `navItems` list).
    4. `usePathname()` from `next/navigation`: when pathname changes, `setOpen(false)`.
    5. Do not edit `src/components/ui/sheet.tsx`. Do not edit `SideNav.tsx` / `OrgSwitcher.tsx` / `UserMenu.tsx`.
    6. `AppShellFrame`: hooks per policy §11. Pass `project={null}`. `onSignOut` → `signOut({ callbackUrl: '/sign-in' })`.
    7. `(app)/layout.tsx`: keep `requireApp()` + `redirect`. Children: `<AppShellFrame>{children}</AppShellFrame>` only. Stop importing `mockShellData` here.
    8. `/dev/shell` (`src/app/dev/shell/page.tsx`) stays on `mockShellData` + `AppShell` directly — still must collapse at 375px because it uses `AppShell`.
  - **Layout:** wrap vs Sheet. Desktop `md:flex` aside; narrow Sheet `side="left"`. Header + main `min-w-0` unchanged. No `sm:` / `lg:`.
  - **Pattern:** snippet in `docs/RESPONSIVENESS.md` §1. `Sheet` API: `src/components/ui/sheet.tsx` (F3.6). `AppShell` props: `src/client/shell/AppShell.tsx` (F0.12 / F3.23). Live session: `useMe` in `src/client/hooks/useSession.ts`; `useApprovalCount` in `src/client/hooks/useRequests.ts`. Sign-out: `src/app/(auth)/sign-in/SignInForm.tsx` uses `next-auth/react` (A1.3) — copy the import style, not the form.
  - **Accept:** `pnpm verify`. 375px: aside not in layout flow (no page-level horizontal scrollbar from `w-56`); Menu button visible; opening Sheet shows Dashboard/Projects links and OrgSwitcher; those links reachable. 768px: aside visible; Menu button not shown; no Sheet required to navigate. `/dev/shell` still renders.
  - **Notes:** Aside `hidden … md:flex`; Menu + left `Sheet` reuses `OrgSwitcher`/`SideNav`. Sheet closes when pathname changes (open tied to path, not `useEffect` setState). `AppShellFrame` wires `useMe` / `useActiveOrg` / `useApprovalCount` / `signOut({ callbackUrl: '/sign-in' })`. `/dev/shell` still uses `mockShellData`. `pnpm verify` green (1561 tests).

### A2.2 — Dashboard

- [ ] **A2.2** — `/dashboard`
  - **Files:**
    - `src/app/(app)/dashboard/page.tsx` (replace placeholder)
    - `src/app/(app)/dashboard/DashboardHome.tsx` (`'use client'`)
    - `src/app/(app)/approvals/page.tsx` (create placeholder)
    - `src/app/(app)/activity/page.tsx` (create placeholder)
  - **Do:**
    1. Server `dashboard/page.tsx` renders `<DashboardHome />` only (no data fetch on the server).
    2. Four summary `Card`s in `grid grid-cols-1 gap-4 md:grid-cols-2`. Each card’s title is a `Link` per policy §7. Compose F3 `Card` / `CardHeader` / `CardTitle` / `CardContent`.
    3. Active projects: `useProjects({ status: 'ACTIVE', page: 1, pageSize: 6, sort: '-updatedAt' })`. Loading → `LoadingState`. Error retryable → `ErrorState` with `onRetry={refetch}`. Rows: `name`, `code`, `StatusBadge kind="project"`. Each row is a `Link` to `/projects/${id}`.
    4. Pending approvals: `useApprovalCount()` for the title count; `useApprovals({ page: 1, pageSize: 5 })` lists `vendor` + `MoneyDisplay` of `{ amount, currency }` + `StatusBadge kind="request"`. Card links `/approvals`.
    5. Recent activity: `useActivity({ limit: 8 })`; flatten `data.pages[0]?.items ?? []` through `toTimelineItem`; render F3 `Timeline`. Card links `/activity`.
    6. Alerts: two `useProjects` calls (`DRAFT` and `PENDING_APPROVAL`) per §7. DRAFT row links `draftWizardHref(id)` label `Resume`. PENDING row links `/projects/${id}`.
    7. Zero ACTIVE items: `EmptyState` locked copy; action gated with `PermissionGateView` `allowed={canCreateProject({ orgRole: activeOrgRole(...), me })}` `denialMessage={createProjectDenialMessage()}` wrapping the Button/link to `/projects/new`.
    8. Placeholder pages: `<main>Approvals land in A7.</main>` and `<main>Activity land in A8.</main>` (A7/A8 replace them). Do not fetch on those pages.
  - **Layout:** stack on narrow, `md:grid-cols-2`. Cards stack their rows (`flex flex-col gap-2`). No Sheet (shell already has it). No `DataTable` on the dashboard.
  - **Pattern:** Card/Empty/Error/Loading: A1.5 `OnboardingFork.tsx`. `StatusBadge`: `src/components/patterns/StatusBadge.tsx`. `Timeline`: `src/components/patterns/Timeline.tsx`. `MoneyDisplay`: `src/components/patterns/MoneyDisplay.tsx`. Hooks: `src/client/hooks/useProjects.ts`, `useRequests.ts` (`useApprovals`, `useApprovalCount`), `useReports.ts` (`useActivity`). Helpers: `src/client/lib/projects.ts`.
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; all four cards visible by scrolling **vertically**; Create / project links reachable without sideways window scroll. Dashboard cards are `<a>`/`Link`, not static `<div>` summaries.
  - **Notes:** _{filled in on completion}_

### A2.3 — Project list + table overflow

- [ ] **A2.3** — `/projects` + `overflow-x-auto` on `DataTable` root
  - **Files:**
    - `src/components/patterns/DataTable.tsx` (edit — add `overflow-x-auto` on the table wrapper so A3–A9 inherit)
    - `src/app/(app)/projects/page.tsx` (create)
    - `src/app/(app)/projects/ProjectList.tsx` (`'use client'`)
  - **Do:**
    1. `DataTable`: wrap the existing `<Table>…</Table>` in `<div className="overflow-x-auto">`. Toolbar row: add `flex-wrap` to the `flex items-center justify-between gap-2` container. Do not restyle rows as cards. Do not change sorting/pagination behaviour.
    2. `page.tsx` renders `<ProjectList />`.
    3. `ProjectList` reads `useSearchParams()`, `parseProjectListSearchParams`, passes the result to `useProjects(filter)` — **no** `.filter()` on `items`.
    4. Toolbar `flex flex-wrap gap-2`:
       - Status `Select`: options All (omit `status`) + every `ProjectStatus` value. Changing status sets `page` to 1 and `router.replace(projectListHref({ ...filter, status, page: 1 }))`.
       - Cost centre `Select`: All + `useMe().data.activeOrg.costCentres` (each string min 1).
       - Create control: `PermissionGateView` as in A2.2 → `/projects/new`.
    5. Columns (`DataTableColumn<Project>`): `name` (Link to `/projects/${id}`, `sortable: true`), `code`, `status` (`StatusBadge kind="project"`, sortable), `costCentre` (render `—` when null), `updatedAt` (`formatDate` from `src/lib/dates.ts`, sortable). `getRowId: (row) => row.id`.
    6. Sorting controlled: `sorting={projectSortToSorting(filter.sort)}` `onSortingChange` → `projectListHref` with `sortingToProjectSort`.
    7. Pagination `mode: 'page'` with `page`, `pageSize`, `total` from the response; `onPageChange` writes `page` into the URL via `projectListHref`.
    8. `empty`: locked zero-projects copy; action same gated Create. When the list is empty **because a filter matches nothing**, still use `empty` but title `No projects match` description `Try a different status or cost centre.` (no Create action required).
    9. `loading={query.isPending}` `error` from `query.error` with `onRetry={refetch}`.
    10. Row actions (toolbar not required — last column `id: 'actions'`, not sortable): per policy §8. `Resume` only when `status === 'DRAFT'`. `Cancel project` / `Launch` / `Archive` wrap `useTransitionProject` and `PermissionGate` (`projectId={row.id}`, permission from `permissionForTransition(to)`). After success, `query.refetch` is unnecessary if F1 invalidation runs — still rely on `invalidateFor`. Confirm cancel with `ConfirmDialog` title `Cancel this draft?` confirm `Cancel project` (not type-to-confirm).
  - **Layout:** table scrolls **inside**; page does not. Toolbar `flex-wrap`. No `md:grid`. No second card-list layout below `md`.
  - **Pattern:** `DataTable` `src/components/patterns/DataTable.tsx` (F3.22) + kitchen sink in `src/app/dev/ui/PatternGallery.tsx`. `Select`: `src/components/ui/select.tsx`. `formatDate`: `src/lib/dates.ts`. Form/filter URL: helpers from A2.0. Transition hook: `useTransitionProject` in `src/client/hooks/useProjects.ts`. `PermissionGate`: `src/components/patterns/PermissionGate.tsx`.
  - **Accept:** `pnpm verify` and `pnpm test components/patterns/dataTable`. 375px: page has no horizontal scrollbar; table may scroll inside; Create / filters / pagination reachable (wrap or in-table scroll). 768px: same, aside visible from A2.1. `/projects?status=ACTIVE` must hit the API with `status=ACTIVE` (no extra client filter).
  - **Notes:** _{filled in on completion}_

### A2.4 — Wizard shell + details

- [ ] **A2.4** — `/projects/new` details step (create DRAFT, PATCH, resume)
  - **Files:**
    - `src/app/(app)/projects/new/page.tsx` (create)
    - `src/app/(app)/projects/new/ProjectWizard.tsx` (`'use client'`)
    - `src/app/(app)/projects/new/steps/DetailsStep.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<ProjectWizard />`.
    2. `ProjectWizard` uses `StepWizard` with `steps={WIZARD_STEPS.map(({ id, label, optional }) => ({ id, label, optional }))}`, `activeStepId` in React state starting at `details`. `onBack` → `prevWizardStepId`. `onCancel` per policy §5. `isStepValid`: details/budget/card-structure/review/launch use the step’s own validity; deferred optional steps **always true** (so Next is not stuck on Members). Until A2.5–A2.7 exist, Next from `details` may stop at `budget` with a one-line child `Budget lands in A2.5.` **only if** you have not reached those tasks yet — prefer wiring `children` as a switch on `activeStepId` and render Details only in this task; other ids render `null` plus disabled Next except details. **Locked for this task:** implement details fully; for any later `activeStepId` render `<p>{label} — not built yet</p>` and `isStepValid` true for optional ids, false for `budget` / `card-structure` / `review` / `launch` until those tasks. That is an explicit unfinished branch, not a fake form.
    3. `draftId = parseDraftId` from `useSearchParams()`. If set, `useProject(draftId)` and hydrate the details form. If `NOT_FOUND`, `ErrorState` `This project is not available.` no Retry. If status is not `DRAFT`, `Alert` info + `Link` to `/projects/${id}` — do not PATCH a launched project from the wizard.
    4. `DetailsStep` form `useZodForm` on a **local** object that matches create fields (import `createProjectInput` from `src/shared/schemas/project.ts` for the first submit). `defaultValues`: `{ name: '', code: '', description: '', ownerId: me.user.id, costCentre: undefined, startDate: undefined, endDate: undefined }`. Do not send `cardStructure` from this step.
    5. Fields:
       - `name`: `Input` min 1 max 120
       - `code`: `Input`; helper text `Letters, numbers, hyphens.` Enforce schema regex.
       - `description`: `Textarea` max 2000; empty string allowed
       - dates: `DateRangePicker` `from={startDate ?? null}` `to={endDate ?? null}` `onChange` writes `startDate`/`endDate` (iso or undefined)
       - `costCentre`: `Combobox` options from `activeOrg.costCentres.map(c => ({ value: c, label: c }))`, `null` → omit on create / PATCH `null` only if the user clears and a draft exists
       - owner: read-only text `Owner: {me.user.name}` — always submit `ownerId: me.user.id` on create. Do not call `useChangeProjectOwner` in A2.
    6. After draft exists, workstreams: `useWorkstreams(id)` list; `Input` + Button `Add` calling `useCreateWorkstream({ id, input: { name } })` (`name` min 1 max 120). Stack, `flex flex-wrap gap-2` for chips. Optional — empty is valid.
    7. Next on details: if no `draftId`, `useCreateProject(input)` then `router.replace(draftWizardHref(project.id))` and `setActive('budget')` (or stay if later steps not valid yet). If `draftId`, `useUpdateProject({ id, input: { name, code, description, costCentre, startDate, endDate } })` (only defined keys; at least `name`). `CONFLICT` → Alert destructive server message. `VALIDATION_FAILED` → `applyServerErrorsFromApiError`.
    8. `isDirty` from the details form until A2.5 adds others.
  - **Layout:** wizard rail `flex-wrap` (already in `StepWizard`). Step body `flex flex-col gap-4` one column. No `md:grid`. No Sheet. DateRangePicker trigger `w-full`.
  - **Pattern:** A1.6 `CreateOrganizationForm.tsx` (useZodForm + Combobox + Alert). `DateRangePicker`: `src/components/ui/date-range-picker.tsx` (F3.5). `StepWizard`: `src/components/patterns/StepWizard.tsx` (F3.21) + `WIZARD_STEPS` in PatternGallery. `createProjectInput`: `src/shared/schemas/project.ts`. Hooks: `useCreateProject` / `useUpdateProject` / `useCreateWorkstream` in `src/client/hooks/useProjects.ts`.
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; Next / Cancel / Add workstream reachable; step rail wraps instead of overflowing the page. Creating without `draftId` produces a `DRAFT` and the URL gains `draftId`.
  - **Notes:** _{filled in on completion}_

### A2.5 — Budget step

- [ ] **A2.5** — Wizard `budget` step (`PUT` approved amount)
  - **Files:**
    - `src/app/(app)/projects/new/steps/BudgetStep.tsx` (`'use client'`)
    - `src/app/(app)/projects/new/ProjectWizard.tsx` (edit — render BudgetStep; `isStepValid('budget')`)
  - **Do:**
    1. Require `draftId` (if missing, Back to details). `useBudget(draftId)` + `useSetBudget`.
    2. Currency **read-only** `activeOrg.baseCurrency` (length 3). Show it with `MoneyDisplay` of `{ amount: 0, currency }` or plain text `{currency}` — do not use a Combobox.
    3. Amount: `Input type="text"` `inputMode="decimal"` `autoComplete="off"`. On Next, `parseMoneyInput(raw, currency)` → `{ amount, currency }`. Catch thrown `Invalid money input` → `FormMessage` `Enter a valid amount.` `approvedAmount` must be `> 0` to count as `hasBudget` (0 is schema-valid but fails ready-for-approval).
    4. Submit `useSetBudget({ id: draftId, input: { currency, approvedAmount: amount } })`. Do not send `formula` or `thresholdPcts`.
    5. After load, if `budget.budget` is non-null, prefill the input from `budget.budget.approvedAmount` via `formatMoney` stripped of currency symbol **or** leave the raw major-unit string; do not use `parseFloat`. Showing `MoneyDisplay` of current approved next to the input is OK.
    6. Optional `BudgetBar` when projection exists (`approved/committed/actual/remaining` ints, `currency`). Do not locally recompute remaining.
    7. `isStepValid('budget')` true when parsed amount `> 0` or existing `hasBudgetFrom(project, budget.budget?.approvedAmount ?? null)`.
    8. Explicit comment at the top of `BudgetStep.tsx`: `A4 may replace this step with categories and formulas. A2 only PUTs approvedAmount + currency.`
  - **Layout:** one column `flex flex-col gap-4`. `BudgetBar` already stacks figures — do not add breakpoints. No `type="number"`.
  - **Pattern:** F3.3 money input rule on `src/components/ui/input.tsx` header. `parseMoneyInput` / `formatMoney`: `src/lib/money.ts`. `BudgetBar`: `src/components/patterns/BudgetBar.tsx`. `useSetBudget`: `src/client/hooks/useBudget.ts`. `putBudgetInput`: `src/shared/schemas/budget.ts`.
  - **Accept:** `pnpm verify`. 375px and 768px: amount field, Next, and Back reachable; no page-level horizontal scrollbar. JPY (0-decimal) still goes through `parseMoneyInput` — no `.` fraction.
  - **Notes:** _{filled in on completion}_

### A2.6 — Card structure, deferred steps, review

- [ ] **A2.6** — Remaining wizard bodies except Launch
  - **Files:**
    - `src/app/(app)/projects/new/steps/DeferredStep.tsx` (`'use client'`)
    - `src/app/(app)/projects/new/steps/CardStructureStep.tsx` (`'use client'`)
    - `src/app/(app)/projects/new/steps/ReviewStep.tsx` (`'use client'`)
    - `src/app/(app)/projects/new/ProjectWizard.tsx` (edit)
  - **Do:**
    1. `DeferredStep({ title, phase }: { title: string; phase: 'A3' \| 'A6' \| 'A7' })` renders `Alert` variant `info` with locked `{title} land in {phase}.` and a short line `Nothing is saved on this step.` Next stays enabled (`optional: true`). **Do not** render empty member tables, fake role matrices, or `$0` limits.
    2. `CardStructureStep`: four `Switch` + `Label` bound to `cardStructure.shared` / `perMember` / `vendor` / `oneTime`. On Next, `useUpdateProject({ id, input: { cardStructure } })` (all four booleans required by `cardStructureSchema`). Prefill from `useProject`. `isStepValid('card-structure')` always true.
    3. `ReviewStep`: stack sections — details (`name`, `code`, `description`, `formatRange(start,end)` or `Dates not set`, cost centre, owner id), `BudgetBar` or `MoneyDisplay` of approved, `cardStructureReviewLines` as a `<ul>`, then one `Alert` per deferred step using the locked sentence. If dates/owner/budget missing, `Alert` warning `Launch will fail until name, owner, dates, and budget are set.` using `isReadyForApprovalInput` + `hasBudgetFrom`.
    4. Wire `ProjectWizard` children switch for all nine ids. `isStepValid('review')` true. Launch child can stay a stub paragraph until A2.7; `isStepValid('launch')` false until A2.7 so Next on review still advances but Launch’s Next stays disabled if you land there early — **or** don’t advance past review until A2.7. Locked: `onNext` from review sets `activeStepId` to `launch` even if LaunchStep is a stub.
  - **Layout:** one column. Switches stacked (`flex flex-col gap-3`). Review sections stack; wrap any long code with `break-all` / `min-w-0`. Rail still `flex-wrap`.
  - **Pattern:** `Switch` `src/components/ui/switch.tsx`. `Alert` A1.5. `Review` as read-only Cards like A1.4 invite preview. Helpers `cardStructureReviewLines` / `isReadyForApprovalInput`.
  - **Accept:** `pnpm verify`. 375px and 768px: Next/Back reachable on deferred + review; four switches reachable; review shows card-kind sentences and does **not** show invented card limits. Members step is obviously unfinished (info Alert), not a blank table.
  - **Notes:** _{filled in on completion}_

### A2.7 — Launch + `nextLabel`

- [ ] **A2.7** — Launch transitions + activity; `StepWizard` `nextLabel`
  - **Files:**
    - `src/components/patterns/types.ts` (edit — add `nextLabel?: string` to `StepWizardProps`)
    - `src/components/patterns/StepWizard.tsx` (edit — Continue button children `{nextLabel ?? 'Continue'}`)
    - `src/app/(app)/projects/new/steps/LaunchStep.tsx` (`'use client'`)
    - `src/app/(app)/projects/new/ProjectWizard.tsx` (edit)
  - **Do:**
    1. `nextLabel` optional, default Continue. Kitchen sink `/dev/ui` may stay on default. Product wizard: `nextLabel={activeStepId === 'launch' ? 'Launch' : 'Continue'}`.
    2. `isStepValid('launch')` true when `isReadyForApprovalInput` + `hasBudgetFrom` **or** project.status is already `PENDING_APPROVAL`.
    3. `onNext` when `activeStepId === 'launch'`: run policy §5 Launch sequence (`PENDING_APPROVAL` then `ACTIVE`). Disable double-submit with `useTransitionProject().isPending`.
    4. `LaunchStep`: before success, short copy `Launch moves this project to ACTIVE and emits project.launched, which is what causes cards to appear.` After mutate: `useProjectActivity(id)` → `Timeline` via `toTimelineItem` on flattened pages. Button `Open project` → `/projects/${id}`. 403 on ACTIVE → locked info Alert + timeline. 422 → field errors / Alert, stay. 409 → destructive Alert.
    5. Do **not** `toastStore.success('Launched')` as the only feedback. A toast in addition to Timeline is OK; Timeline is required.
    6. List `Launch` on `PENDING_APPROVAL` rows already in A2.3 — confirm it uses `{ to: 'ACTIVE' }` only (one hop).
  - **Layout:** one column. Timeline is a column (already). Launch / Open project in `flex flex-wrap gap-2`.
  - **Pattern:** `useTransitionProject` `src/client/hooks/useProjects.ts`. `useProjectActivity` `src/client/hooks/useReports.ts`. `Timeline` F3.16. Error mapping: A1.2 `applyServerErrorsFromApiError`. `StepWizard` F3.21 (only the label prop changes).
  - **Accept:** `pnpm verify` and `pnpm typecheck`. 375px and 768px: Launch button reachable; after success, Timeline and Open project reachable; no page-level horizontal scrollbar. `/dev/ui` StepWizard still works (default Continue).
  - **Notes:** _{filled in on completion}_

### A2.8 — Workspace shell

- [ ] **A2.8** — `/projects/[id]` tab shell; header from list cache
  - **Files:**
    - `src/app/(app)/projects/[id]/layout.tsx` (create, client wrapper OK)
    - `src/app/(app)/projects/[id]/ProjectWorkspace.tsx` (`'use client'`)
    - `src/app/(app)/projects/[id]/page.tsx` (create — overview placeholder)
    - `src/app/(app)/projects/[id]/people/page.tsx` (placeholder)
    - `src/app/(app)/projects/[id]/budget/page.tsx` (placeholder)
    - `src/app/(app)/projects/[id]/cards/page.tsx` (placeholder)
    - `src/app/(app)/projects/[id]/controls/page.tsx` (placeholder)
    - `src/app/(app)/projects/[id]/activity/page.tsx` (placeholder)
    - `src/app/(app)/projects/[id]/ComingSoonTab.tsx` (`'use client'` — shared placeholder)
  - **Do:**
    1. Over the usual 5-file cap because placeholders are identical: `ComingSoonTab` takes `tab` + `phase` and renders locked `{Tab} lands in {phase}.`
    2. `ProjectWorkspace`: `useParams().id` as string. `useQueryClient` + `projectFromListCache(getQueriesData({ queryKey: ['projects'] }), id)`. `useProject(id)` for the live detail. Header uses `detail.data ?? cached` (`name`, `code`, `StatusBadge kind="project"`). Content column `min-w-0 flex-1`.
    3. Tab row: `nav` `flex flex-wrap gap-2` of `Link`s (policy §2 table). Active tab: `pathname === href` or prefix for nested routes — Overview is exact `/projects/${id}` only (not a prefix of `/people`). Use `buttonVariants({ variant: 'ghost' })` or similar F3 `Button asChild` — do **not** use Radix `Tabs` (those are not route tabs).
    4. Header actions `flex flex-wrap gap-2`: same lifecycle buttons as A2.3 (§8) for this status. Resume on DRAFT → `draftWizardHref(id)`.
    5. Loading: if no cached and `useProject` pending → `LoadingState` in the header only is OK; still render tab row so A3 can load a child later. `NOT_FOUND` → `ErrorState` no Retry, no tabs.
    6. `layout.tsx` wraps `children` with `ProjectWorkspace`. Overview `page.tsx` uses `ComingSoonTab tab="Overview" phase="A3"`. Other pages as in the file list.
    7. Do not pass `project` into `AppShell`. Do not fetch tab bodies here.
  - **Layout:** tabs `flex flex-wrap`. Header `flex flex-wrap items-center gap-2`. Body `min-w-0`. No `md:grid` for tabs.
  - **Pattern:** `ProjectContext.tsx` display of name/code/StatusBadge (copy markup, don’t reuse AppShell plumbing). `buttonVariants` from `src/components/ui/button.tsx`. Cache helper from A2.0. `useProject` `src/client/hooks/useProjects.ts`.
  - **Accept:** `pnpm verify`. Open `/projects/[id]` after visiting `/projects` (list cached): header name appears without waiting on a slow detail if cache has the row (simulate by checking `placeholder` path in code). 375px and 768px: no page-level horizontal scrollbar; tabs wrap; Resume/Launch/Archive (when offered) reachable. Each tab href renders the locked placeholder, not a 404.
  - **Notes:** _{filled in on completion}_

### A2.9 — Lifecycle + don’t-break proofs

- [ ] **A2.9** — Invalid transitions not offered; 375/768 shell+list+wizard; no PAN
  - **Files:**
    - `src/client/lib/projects.test.ts` (extend)
    - `src/shared/projectLifecycle.test.ts` (extend if needed)
    - `src/app/(app)/projects/ProjectList.tsx` / `ProjectWorkspace.tsx` / `ProjectWizard.tsx` — **read only** unless a §8 button is missing
  - **Do:**
    1. Helper test: for each `ProjectStatus`, `offeredTransitions(status)` equals the graph in A2.0 and **never** includes `CLOSING` as a target from `ACTIVE`.
    2. Grep-style unit assertion (string includes on source or a tiny exported `WORKSPACE_TAB_HREFS` list): workspace tabs are exactly the six hrefs in §2 — no `/settings`.
    3. Assert `createProjectDenialMessage()` does not contain `password`. Assert no file under `src/app/(app)/projects` or `dashboard` contains `PAN`, `cvv`, or `card_number` (comment test reading fixtures, or skip if grepping source is awkward — then add a one-line file header on `CardStructureStep.tsx`: `Card structure flags only — never a PAN.`).
    4. Confirm `(app)/layout.tsx` still calls `requireApp()` and `AppShellFrame` (unavoidable product gate). Do not weaken `src/app/_lib/guards.test.ts`.
    5. Manual don’t-break: `/dashboard`, `/projects`, `/projects/new`, `/projects/[id]` at 375px and 768px.
  - **Layout:** n/a (proof task) plus the manual resize check.
  - **Pattern:** A1.7 `src/app/_lib/guards.test.ts` + `src/client/lib/auth.test.ts`.
  - **Accept:** `pnpm test client/lib/projects` and `pnpm test shared/projectLifecycle` and `pnpm test projects/transitions` and `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar on dashboard, list, wizard, workspace; Menu/Sheet works below `md`; wizard Next/Launch and list Create reachable.
  - **Notes:** _{filled in on completion}_

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Spec’s review checklist in `A2-dashboard-projects.md` signed off:
  - [ ] The wizard saves per step and is resumable
  - [ ] Invalid lifecycle transitions aren't offered in the UI, and are handled if attempted
  - [ ] The review step shows the cards and limits that Launch will create (kinds + budget; no invented per-card limits)
  - [ ] Launch surfaces what happened, not just success
  - [ ] The shell renders the header from cache while tabs load
  - [ ] List filters map to B2's query parameters without client-side refiltering
  - [ ] `AppShell` sidebar is a `Sheet` below `md`; same `SideNav`, no second nav
  - [ ] 375px and 768px: no page-level horizontal scrollbar; wizard Next/Launch and list actions reachable
- [ ] `/dev/shell` still works
- [ ] No new F3 primitive files; only optional `nextLabel` on `StepWizard`
- [ ] No `call()` / `fetch` / `@/server` in `'use client'` screens
- [ ] `STATUS.md` updated with the next phase (**A3**)

## Out of scope (do not do in A2)

- Overview tab body, people, roles, permission preview (A3)
- Budget categories, formulas, change requests (A4) — A2 only PUTs `approvedAmount` + `currency`
- Real cards, Airwallex iframes, PAN reveal (A5)
- Rule builder / controls step body (A6)
- Approvals queue body (A7) — dashboard links to a placeholder
- Org-wide activity/transactions body (A8)
- Closure / reports (A9)
- `DRAFT → ACTIVE` edge or a new transition endpoint
- `ACTIVE → CLOSING` via `/transition` (B9 closure)
- Settings tab / `/projects/[id]/settings`
- App Router in-app unsaved-navigation blocker beyond `beforeunload` + Cancel `ConfirmDialog`
- New accept/create-permission field on `GET /api/me/permissions`
- Changing B2 list to include `overview.alertCount`
- A second nav component, extra breakpoints, or restyling tables as card lists
