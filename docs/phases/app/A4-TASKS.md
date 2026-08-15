# A4 — Budget · Tasks

**Spec:** [A4-budget.md](./A4-budget.md)
**Model:** cheap / LOW — name every file, inline every field with type and constraints, copy the cited A3/A2/F1/B4 file; do not invent endpoints, change B4–B9 contracts, add primitives (except the one `BudgetBar` class + tooltip pass in A4.1), reopen AppShell collapse, or hide a control without a Sheet/menu replacement.
**Depends on:** A3, complete and verified

No new API contracts. B4 already shipped `budgetContracts`. Cards already shipped `cardSchema.desiredControls.transactionLimits`. The review gate is the policies + helper shapes below.

**Powers:** B4 (and B5 card mirrors for “limits moved”) · **Hooks (F1, already exist):** `useBudget`, `useSetBudget`, `useBudgetCategories`, `useCreateBudgetCategory`, `useUpdateBudgetCategory`, `useDeleteBudgetCategory`, `useBudgetEntries`, `useCreateBudgetEntry`, `useBudgetHistory`, `useBudgetChangeRequests`, `useCreateChangeRequest`, `useDecideChangeRequest`, `useValidateFormula`, `useProject`, `useWorkstreams`, `useProjectCards`, `useMe`, `useCan`, `useAttributeValues` · **Guards (F0, already exist):** `requireApp` on `(app)/layout.tsx`

Recipe: [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Visual tokens: [`../../VISUAL-DIRECTION.md`](../../VISUAL-DIRECTION.md).

**AppShell collapse is already done (A2.1).** Aside is `hidden w-56 shrink-0 flex-col md:flex`; Menu opens the same `SideNav` / `OrgSwitcher` in F3 `Sheet`. Do **not** reopen `AppShell.tsx`. Do **not** build `MobileNav.tsx`. Do **not** add `sm:` / `lg:` / `xl:` / `2xl:` on A4 screens. The one allowed F3 edit is A4.1 replacing `BudgetBar`’s `sm:grid-cols-4` with `md:grid-cols-4`.

---

## A4.0 locked policies (do not reopen)

Approved 2026-08-16. Implementers follow these; do not re-litigate. A4.0 still implements the helpers below and STOPs before A4.1 screens.

### 1. No new contracts, no new primitives, no AppShell collapse

- Do **not** add or rename fields in `src/shared/schemas/*` or `src/shared/contracts/*`.
- Do **not** add a shadcn/pattern file. A4 screens compose F3 files listed in each task’s **Pattern**. Exception: A4.1 may edit `src/components/patterns/BudgetBar.tsx` only for `md:grid-cols-4` and the four term tooltips.
- Do **not** import `@/server/*` from any `'use client'` file. Do **not** import `@/server/lib/formula` — tokenize with `highlightFormula` from `src/lib/rules/formulaHighlight.ts`; evaluate only via `useValidateFormula`.
- Do **not** call `call()` or `fetch` from a screen. Use F1 hooks.
- Do **not** edit `src/client/shell/AppShell.tsx`.
- Do **not** edit `src/client/hooks/invalidationMap.ts`. After a mutation, a screen may `queryClient.invalidateQueries` extra `qk.budgetHistory` / `qk.budgetEntries` keys itself.
- Do **not** add `/projects/[id]/settings` or a seventh workspace tab. `WORKSPACE_TAB_HREFS` stays six.
- Do **not** send `COMMITMENT` / `ACTUAL` / `RELEASE` / `APPROVAL` via `POST .../entries`. Public create is `amount` + optional `note` / `categoryId` only.
- Do **not** expose `putBudgetInput.formula` or `thresholdPcts` on A4 screens. PUT sends `{ currency, approvedAmount }` only (same as A2.5). Category formulas are the first-class editor.
- Do **not** use `useCardLimits` / `usePanToken` as the “limits moved” source. Live Airwallex remaining is A5. A4 diffs **`desiredControls.transactionLimits`** on the card mirror.
- Do **not** rebuild the A2 wizard budget PUT. A4.8 adds a Link only.

### 2. Routes (A4 spec wins)

| URL                                | Files                                                            | Guard                 | Shell                                        |
| ---------------------------------- | ---------------------------------------------------------------- | --------------------- | -------------------------------------------- |
| `/projects/[id]/budget`            | `src/app/(app)/projects/[id]/budget/page.tsx` + `BudgetHome.tsx` | `requireApp` (layout) | `AppShell` + workspace tabs + `BudgetChrome` |
| `/projects/[id]/budget/categories` | `.../budget/categories/page.tsx` + `CategoryList.tsx`            | same                  | same                                         |
| `/projects/[id]/budget/history`    | `.../budget/history/page.tsx` + `BudgetHistory.tsx`              | same                  | same                                         |
| `/projects/[id]/budget/requests`   | `.../budget/requests/page.tsx` + `ChangeRequestList.tsx`         | same                  | same                                         |

No `/projects/[id]/budget/categories/[catId]`. Create/edit category in a F3 `Sheet` (or Dialog for create) on the categories list (A4.5).

Wizard `/projects/new` budget step already exists (`BudgetStep.tsx`). A4.8 adds a Link; do not add a second wizard.

`BudgetChrome` wrap-Links (not Radix `Tabs`), same pattern as A3.6 `SettingsChrome.tsx`.

### 3. Layout — one breakpoint `md`, four patterns (collapse already exists)

Copy [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Do not add `sm:` / `lg:` / `xl:` / `2xl:` (ignore pre-existing `sm:` inside F3 `Sheet` / `UserMenu` / `/dev/ui` — do not edit those files). **Do** change `BudgetBar` `sm:grid-cols-4` → `md:grid-cols-4`.

Per-screen layouts (repeat on the task):

| Screen              | Narrow                                                         | Desktop (`md:`)                                                                  |
| ------------------- | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| Budget home         | stack: banner, `BudgetBar`, actions `flex-wrap`, entries table | same stack; **no** `md:grid` of the four figures (those live inside `BudgetBar`) |
| `BudgetBar` figures | `grid-cols-2`                                                  | `md:grid-cols-4`                                                                 |
| Categories table    | `DataTable` + internal overflow; toolbar `flex-wrap`           | same table, **not** a card list                                                  |
| Category + formula  | `flex-col` form then preview                                   | `md:flex-row` form \| preview                                                    |
| History             | `Timeline` column                                              | same; no `md:grid`                                                               |
| Change requests     | `DataTable` + internal overflow; toolbar `flex-wrap`           | same table                                                                       |
| Edit category       | F3 `Sheet` `side="right"`                                      | same Sheet (not a page)                                                          |
| Budget sub-nav      | `flex flex-wrap gap-2` **Links**                               | same wrap                                                                        |
| Wizard budget step  | already one column `flex flex-col gap-4`                       | same; no `md:grid`                                                               |

Workspace tabs already `flex flex-wrap` in `ProjectWorkspace.tsx`. Do not switch them to Radix `Tabs`.

Chrome Links: `buttonVariants({ variant: 'ghost' })` + `Link` (A3 Slot crash — do **not** `Button asChild` for these).

### 4. Existing contracts (copy these fields; do not redeclare)

All amounts are **integer minor units**. Currency is ISO 4217 `string` length 3. Never `parseFloat`, never `type="number"`.

**`GET /api/projects/:id/budget`** — `budgetContracts.get` — permission `budget.view` — input `z.void()` — output `budgetDetailSchema`:

```
{
  budget: budgetSchema | null,   // null before first PUT
  projection: {
    approved: int,               // Σ APPROVAL + Σ ADJUSTMENT
    committed: int,              // Σ COMMITMENT − Σ RELEASE
    actual: int,                 // Σ ACTUAL
    remaining: int,              // approved − committed − actual; MAY be negative; never clamp
    utilisationPct: int >= 0,    // floor((committed+actual)*100/approved); approved===0 → 100 if utilised>0 else 0
    overCommitted: boolean,      // true iff remaining < 0
    updatedAt: iso datetime
  }
}
```

`budgetSchema`: `{ id: string min 1, orgId: string min 1, projectId: string min 1, currency: string length 3, approvedAmount: int >= 0, formula?: string | null, categories: budgetCategorySchema[], thresholdPcts: int[] each 1–1000, createdAt: iso, updatedAt: iso }`.

No budget yet → `{ budget: null, projection: zeros }`. That is the “DRAFT pre-approval” empty state. Do **not** treat `approvedAmount === 0` on an existing budget as empty.

**`PUT /api/projects/:id/budget`** — `.put` — permission `budget.edit`

- input `putBudgetInput`: `{ currency: string length 3, approvedAmount: int >= 0, formula?: string | null, thresholdPcts?: int[] each 1–1000 }`
- output `budgetDetailSchema`
- A4 sends **only** `currency` + `approvedAmount`. `currency` = `useMe().data.activeOrg.baseCurrency` (length 3). Do not let the user pick a different currency.
- Server appends APPROVAL (delta ≥ 0) or ADJUSTMENT (delta < 0). Skip the PUT if the parsed amount equals current `budget.approvedAmount`.

**`GET /api/projects/:id/budget/categories`** — `.listCategories` — `budget.view` — output `budgetCategorySchema[]`:

```
{
  id: string min 1,
  name: string min 1 max 120,
  workstreamId?: string min 1 | null,
  allocated: int >= 0,             // minor units; formula result is written here
  formula?: string | null
}
```

Empty array before any category is valid.

**`POST /api/projects/:id/budget/categories`** — `.createCategory` — `budget.edit`

- input `createBudgetCategoryInput`: `{ name: string min 1 max 120, workstreamId?: string min 1 | null, allocated: int >= 0, formula?: string | null }`
- If both `allocated` and `formula` are set, **formula wins** (server evaluates with context `{ approvedAmount }` and writes the int into `allocated`).
- Sum of `allocated` > `budget.approvedAmount` → `422 VALIDATION_FAILED` field `allocated` message `Category allocations ({sum}) exceed approved amount ({approvedAmount})`.
- Unknown `workstreamId` → `422` field `workstreamId`.
- No budget yet → `404`.

**`PATCH /api/projects/:id/budget/categories/:catId`** — `.updateCategory` — `budget.edit`

- input `updateBudgetCategoryInput`: partial `{ name?: string min 1 max 120, workstreamId?: string min 1 | null, allocated?: int >= 0, formula?: string | null }` with **at least one** key
- Same over-allocation 422.

**`DELETE /api/projects/:id/budget/categories/:catId`** — `.deleteCategory` — `budget.edit` — input `z.void()`, output `z.void()`. `409 CONFLICT` if any entry references `categoryId`.

**`GET /api/projects/:id/budget/entries`** — `.listEntries` — `budget.view`

- input `listBudgetEntriesQuery`: `{ type?: APPROVAL | COMMITMENT | ACTUAL | RELEASE | ADJUSTMENT, from?: iso datetime, to?: iso datetime, page: coerce int min 1 default 1, pageSize: coerce int min 1 max 100 default 20 }`
- output `{ items: budgetEntrySchema[], page: int min 1, pageSize: int min 1, total: int min 0 }`
- **No client-side refilter.** Home tab requests `{ page: 1, pageSize: 20 }` with no `type`.

`budgetEntrySchema`: `{ id, orgId, projectId, categoryId: string | null, type: BudgetEntryType, amount: int (signed for ADJUSTMENT), currency: string length 3, sourceType: PURCHASE_REQUEST | AUTHORIZATION | TRANSACTION | MANUAL | RULE, sourceId: string min 1, lifecycleId: string | null, createdBy: string min 1, note: string | null, createdAt: iso }`.

**`POST /api/projects/:id/budget/entries`** — `.createEntry` — `budget.edit`

- input `createBudgetEntryInput`: `{ amount: int (signed), note?: string | null, categoryId?: string min 1 | null }`
- output `budgetEntrySchema`
- Service forces `type=ADJUSTMENT`, `sourceType=MANUAL`. Disable submit when `amount === 0`.

**`GET /api/projects/:id/budget/history`** — `.history` — `budget.view` — output `budgetHistoryEntrySchema[]` newest first:

```
{
  id: string min 1,
  action: string min 1,            // e.g. budget.created, budget.updated, budget.category_created,
                                   // budget.entry_created, budget.change_request_created, budget.change_request_decided
  actorType: USER | RULE | SYSTEM | AIRWALLEX,
  actorId: string min 1,
  subjectType: string min 1,
  subjectId: string min 1,
  before?: unknown,
  after?: unknown,
  metadata: Record<string, unknown>,
  at: iso datetime                 // not createdAt
}
```

**`GET /api/projects/:id/budget/change-requests`** — `.listChangeRequests` — `budget.view` — output `budgetChangeRequestSchema[]` (no query filter — **do not invent URL filters that the API does not have**).

```
{
  id, orgId, projectId: string min 1,
  requestedBy: string min 1,
  deltaAmount: int nonzero (may be negative),
  reason: string min 1 max 2000,
  status: PENDING | APPROVED | REJECTED,
  decidedBy: string min 1 | null,
  decidedAt: iso | null,
  createdAt: iso,
  updatedAt: iso
}
```

**`POST /api/projects/:id/budget/change-requests`** — `.createChangeRequest` — `budget.request`

- input `{ deltaAmount: int ≠ 0, reason: string min 1 max 2000 }`
- `404` if no budget. Next approved < 0 → `422` field `deltaAmount`.

**`POST /api/budget/change-requests/:id/decide`** — `.decideChangeRequest` — `budget.edit` (subject is the request’s `projectId`)

- hook `useDecideChangeRequest({ id: changeRequestId, input })` — `id` is the **change-request** id, not the project id
- input `{ decision: 'APPROVE' | 'REJECT', note?: string | null }`
- APPROVE appends ADJUSTMENT for `deltaAmount`. Already decided → `409` `Change request is already decided`.

**`POST /api/budget/formula/validate`** — `.validateFormula` — `budget.edit` (org-wide)

- input `{ expression: string max 500, context?: Record<string, int> }`
- output discriminated `{ ok: true, value: int } | { ok: false, error: string }`
- `useValidateFormula` is a **mutation with no invalidation** (F1.7). Store the result in component state. Generation counter to drop stale responses.

**Formula context (locked, must match server):** `src/server/services/budget/categories.ts` `formulaContext` is `{ approvedAmount: budget.approvedAmount }` only. Preview **must** send that same object. Do **not** put committed/actual/remaining or attribute values in `context` — preview would lie relative to save.

Allowlisted functions (B4.2): `min`, `max`, `round`, `floor`, `ceil`, `clamp`, `pct`. Identifiers otherwise resolve from `context`. Unknown identifier → `{ ok: false, error }`.

**`GET /api/projects/:id/cards`** — `useProjectCards(id, { page: 1, pageSize: 100 })` → `{ items: cardSchema[], page, pageSize, total }`.

`cardSchema.desiredControls.transactionLimits`: `{ currency: string length 3, limits: { interval: PER_TRANSACTION | DAILY | WEEKLY | MONTHLY | QUARTERLY | YEARLY | ALL_TIME, amount: int >= 0 }[] min 1 }`.

Card labels: `nickName` max 100 + `maskedNumber` (masked only). **Never PAN / CVV / expiry.** No `usePanToken`.

**`GET /api/attributes/values`** — `useAttributeValues({ subjectType: 'PROJECT', subjectId: projectId, page: 1, pageSize: 100 })` → `{ items: { id, key, subjectType, subjectId, value: number | string | boolean | null, observedAt: iso, ttlSec: int > 0 | null, … }[], page, pageSize, total }`. Used only for the stale-input indicator (policy §7).

**`GET /api/me`** — `activeOrg.baseCurrency` length 3.

**Permission** values used here: `budget.view`, `budget.edit`, `budget.request`. Client `can()` is UX only.

### 5. Four figures (centrepiece visual)

Lead with F3 `BudgetBar`. Pass projection ints + `currency` — do **not** recompute remaining/utilisation on the client.

Locked tooltips (`BUDGET_TERM_TOOLTIPS`):

| Term      | Tooltip                                             |
| --------- | --------------------------------------------------- |
| Approved  | `Total approved for this project`                   |
| Committed | `Approved but not yet spent` (already on BudgetBar) |
| Actual    | `Already spent`                                     |
| Remaining | `Approved minus committed minus actual`             |

Over-committed (`projection.overCommitted === true` or `remaining < 0`): keep the bar (negative remaining uses `MoneyDisplay` `colorBySign`) **and** a page-level `Alert` variant `destructive` with locked copy §13. Do not hide remaining. Do not clamp.

### 6. Card limits that moved (product premise)

PUT/category/entry/decide do **not** return a limit diff. Diff it on the client:

1. Snapshot `desiredControls.transactionLimits` from current `useProjectCards` data **before** `mutateAsync`.
2. `await mutateAsync(...)`.
3. `await queryClient.refetchQueries({ queryKey: qk.cardsForProject(projectId) })` (do not race `onSettled`).
4. Diff with `diffCardTransactionLimits`. Render F3 `DiffView` using `cardLimitDiffToDiffView`. Money values `{ amount, currency }` so DiffView uses `MoneyDisplay`.
5. Zero diffs → locked `No card limits moved.` Zero cards → still that sentence plus `No cards yet.` `Link` to `/projects/${id}/cards` (A5 placeholder is fine).

Do not invent numeric limits. Do not call `useCardLimits` for this pane.

### 7. Formula editor — live validate, block invalid save

- Empty expression → fixed `allocated`; **do not** call validate; Save allowed if allocated parses.
- Non-empty → debounce **300ms** (`FORMULA_DEBOUNCE_MS`) + monotonic generation counter (same idea as A3.4 preview). Call `useValidateFormula().mutate({ expression, context: formulaContextFromBudget(approvedAmount) })`.
- `expression.length > 500` → do not call; locked too-long copy; Save blocked.
- Last result `ok: false` or pending with a dirty expression → Save blocked. While pending, keep the last successful `{ ok: true, value }` (do not blank the preview).
- Preview: `FormulaHighlight` of the expression + `MoneyDisplay` of `{ amount: value, currency }` when `ok`. Error string verbatim when `ok: false`.
- **Stale inputs:** `formulaIdentTokens(expression)` via `highlightFormula` (`type === 'ident'`), minus `FORMULA_FUNCTION_IDENTS`. `approvedAmount` → no `AttributeValue` (show context as `MoneyDisplay` of approved). Any other ident → look up `useAttributeValues` item with `key === ident`; if found, render F3 `AttributeValue` (`value`, `observedAt`, `ttlSec`, `label: key`). Informational only — Save still requires B4 `{ ok: true }`. Do **not** put attribute numbers into `context` (A6 owns attribute-driven formulas).

### 8. Pending change request on the main tab

`useBudgetChangeRequests(id)` then `pendingChangeRequests(rows)` (`status === 'PENDING'`). If any, `Alert` (not destructive) on **Budget home**, not only on `/requests`. Each line: `MoneyDisplay` of `{ amount: deltaAmount, currency }` + truncated `reason` + `Link` to `budgetRequestsHref(id)`.

Do not client-filter the **requests page** table — it shows the full GET array. Status is a `Badge` column.

### 9. Wizard

A2.5 already PUTs `approvedAmount` + org currency. A4.8 adds, when `draftId` is set, a `Link` (`buttonVariants`) to `budgetCategoriesHref(draftId)` with locked copy §13. Do not add category/formula fields inside `StepWizard`. Do not change `isStepValid('budget')`.

### 10. Money, PAN, permissions UX, testing, ESLint

- Amounts: `MoneyDisplay` / `BudgetBar` / `parseMoneyInput` (`src/lib/money.ts`). Input `type="text"` `inputMode="decimal"`. Signed deltas allowed (`parseMoneyInput` accepts a leading `-`).
- **Never touch a PAN.**
- `PermissionGate` / `PermissionGateView`: always show the control (disabled + tooltip). Never hide Set / Adjust / Save / Request / Approve / Reject.
- Tests: pure helpers in `src/client/lib/budget.ts` with vitest **node**. Do **not** add `@testing-library/react`.
- Screen Accept always includes `pnpm verify` plus **375px and 768px**: no page-level horizontal scrollbar; the four budget figures and primary actions visible without sideways **window** scroll; tables may scroll **inside**.
- `(app)` already bans `call()` / `fetch`. Do not add a `@/server` ban (server layout still uses `requireApp`).

### 11. Extra invalidation (screens only)

After success, also invalidate (do not edit F1’s map):

| Mutation                 | Extra keys                                     |
| ------------------------ | ---------------------------------------------- |
| `useSetBudget`           | `qk.budgetEntries(id)`, `qk.budgetHistory(id)` |
| `useCreateBudgetEntry`   | `qk.budgetHistory(id)`                         |
| category CUD             | `qk.budgetHistory(id)`                         |
| `useCreateChangeRequest` | `qk.budgetHistory(id)`                         |
| `useDecideChangeRequest` | `qk.budgetHistory(data.projectId)`             |

### 12. Locked copy (do not paraphrase)

| Situation                    | Surface              | Copy                                                                                                                                         |
| ---------------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot edit budget           | `PermissionGateView` | `You don't have permission to edit the budget.`                                                                                              |
| Cannot request change        | `PermissionGateView` | `You don't have permission to request a budget change.`                                                                                      |
| No budget yet                | `EmptyState`         | title `No budget set yet` / description `Set an approved amount. Categories and formulas come next.` / action `Set budget`                   |
| Over-committed               | `Alert` destructive  | `Remaining is negative — this project is over-committed.`                                                                                    |
| Categories exceed approved   | `Alert` destructive  | `Category allocations exceed the approved amount.`                                                                                           |
| No card limits moved         | pane                 | `No card limits moved.`                                                                                                                      |
| No cards yet                 | pane                 | `No cards yet.`                                                                                                                              |
| No categories                | `EmptyState`         | title `No categories yet` / description `Split the approved amount into categories. An allocation may be a formula.` / action `Add category` |
| No history                   | `Timeline` empty     | title `No budget changes yet` / description `Approved amount, categories, and requests will show up here.`                                   |
| No change requests           | `EmptyState`         | title `No change requests` / description `Request a change when you cannot edit the budget directly.`                                        |
| No entries                   | `DataTable` empty    | title `No ledger entries yet` / description `Approvals, commitments, actuals, and adjustments appear here.`                                  |
| Formula too long             | field error          | `Expression must be at most 500 characters.`                                                                                                 |
| Formula incomplete / invalid | preview              | server `error` string verbatim                                                                                                               |
| Attribute ident (A6)         | helper under preview | `This identifier is an attribute. Attribute formulas land in A6.`                                                                            |
| Adjustment amount 0          | field error          | `Enter a nonzero amount.`                                                                                                                    |
| Delta amount 0               | field error          | `Delta must be nonzero.`                                                                                                                     |
| Approve request              | `ConfirmDialog`      | title `Approve this budget change?` confirm `Approve`                                                                                        |
| Reject request               | `ConfirmDialog`      | title `Reject this budget change?` confirm `Reject`                                                                                          |
| Delete category              | `ConfirmDialog`      | title `Delete {name}?` description `This is rejected if ledger entries reference it.` confirm `Delete`                                       |
| Wizard → categories          | `Link`               | `Add categories on the project budget tab.`                                                                                                  |
| Pending CR banner            | `Alert`              | `A budget change is pending.` (then the MoneyDisplay + reason + link `Review requests`)                                                      |
| Duplicate / 409 / 422        | `Alert` destructive  | server `error.message` / `applyServerErrorsFromApiError`                                                                                     |

`BUDGET_NAV` labels (locked order): `Overview`, `Categories`, `History`, `Requests`.

---

## Contracts first

- [x] **A4.0** — Budget helpers (STOP for review)
  - **Files:**
    - `src/client/lib/budget.ts` (create)
    - `src/client/lib/budget.test.ts` (create)
    - `src/client/lib/index.ts` (edit — `export * from '@/client/lib/budget'`)
  - **Do:** No React screens. No AppShell / BudgetBar / wizard changes yet. Implement the locked helper API (pure, no React, no `call()`):
    1. `BUDGET_TERM_TOOLTIPS`: `Record<'approved' | 'committed' | 'actual' | 'remaining', string>` — exact §5 table.
    2. `FORMULA_FUNCTION_IDENTS`: `ReadonlySet<string>` — `min`, `max`, `round`, `floor`, `ceil`, `clamp`, `pct`.
    3. `FORMULA_DEBOUNCE_MS`: `300`. `MAX_FORMULA_LENGTH`: `500`.
    4. `BUDGET_NAV`: `readonly { suffix: '' | '/categories' | '/history' | '/requests'; label: 'Overview' | 'Categories' | 'History' | 'Requests' }[]` in that order.
    5. `budgetHref(projectId: string): string` — `/projects/${projectId}/budget`. Throw if `projectId.length < 1`. Same throw on the next four.
    6. `budgetCategoriesHref` / `budgetHistoryHref` / `budgetRequestsHref` — append `/categories`, `/history`, `/requests`.
    7. `budgetNavHref(projectId, suffix)` — `budgetHref` + suffix.
    8. `isBudgetNavActive(pathname: string, projectId: string, suffix: typeof BUDGET_NAV[number]['suffix']): boolean` — suffix `''` is exact `budgetHref` only (not a prefix of `/categories`). Other suffixes: `pathname === href || pathname.startsWith(href + '/')`.
    9. `formulaContextFromBudget(approvedAmount: number): { approvedAmount: number }` — that key only.
    10. `formulaIdentTokens(expression: string): string[]` — `highlightFormula` from `src/lib/rules/formulaHighlight.ts`; keep `type === 'ident'`; drop `FORMULA_FUNCTION_IDENTS`; unique, stable order.
    11. `formulaExpressionTooLong(expression: string): boolean` — `expression.length > 500`.
    12. `isFormulaExpressionEmpty(expression: string): boolean` — `expression.trim().length === 0`.
    13. `allocationsSum(categories: ReadonlyArray<{ allocated: number }>): number` — integer add, no floats.
    14. `allocationsExceedApproved(sum: number, approvedAmount: number): boolean` — `sum > approvedAmount`.
    15. `pendingChangeRequests<T extends { status: string }>(rows: readonly T[]): T[]` — `status === 'PENDING'`.
    16. `snapshotCardTransactionLimits(cards: ReadonlyArray<{ id: string; nickName: string; maskedNumber: string; desiredControls: { transactionLimits: { currency: string; limits: { interval: string; amount: number }[] } } }>): { cardId: string; nickName: string; maskedNumber: string; currency: string; limits: { interval: string; amount: number }[] }[]`
    17. `diffCardTransactionLimits(before: ReturnType<typeof snapshotCardTransactionLimits>, after: ReturnType<typeof snapshotCardTransactionLimits>): { cardId: string; nickName: string; maskedNumber: string; interval: string; currency: string; beforeAmount: number; afterAmount: number }[]` — only rows where `beforeAmount !== afterAmount`. Cards only in `after` with no `before` count as moved from `0`. Cards only in `before` omitted (closed/missing).
    18. `cardLimitDiffToDiffView(diffs: ReturnType<typeof diffCardTransactionLimits>): { before: Record<string, { amount: number; currency: string }>; after: Record<string, { amount: number; currency: string }> }` — key `` `${nickName} ${maskedNumber} ${interval}` ``.
    19. `toBudgetHistoryTimelineItem(entry: { id: string; action: string; actorType: ActorType; actorId: string; subjectType: string; subjectId: string; at: string }): TimelineItem` — `summary: entry.action`. Do not put `before`/`after`/`metadata` on the item.
    20. `budgetHistoryReason(entry: { metadata: Record<string, unknown>; after?: unknown }): string | null` — first of: `metadata.reason` string min 1; `metadata.note` string min 1; `after.reason` if `after` is a plain object with string `reason` min 1; else null.
    21. `projectionToBudgetBarProps(projection: { approved: number; committed: number; actual: number; remaining: number; utilisationPct: number; overCommitted: boolean }, currency: string)` — passthrough; **do not** recompute remaining.
    22. `hasBudgetRecord(budget: unknown | null): boolean` — `budget !== null && typeof budget === 'object'`.
    23. `editBudgetDenialMessage()` / `requestBudgetDenialMessage()` — locked §12 sentences.
    24. `overCommittedMessage()` / `noCardLimitsMovedMessage()` / `categoriesExceedMessage()` / `formulaTooLongMessage()` / `attributeFormulaLandsInA6Message()` — locked §12 sentences.
    25. `cardsTabHref(projectId: string)` — `/projects/${projectId}/cards`. Throw if empty id.
    26. `minorToInputString(amount: number, currency: string): string` — copy the A2.5 helper in `src/app/(app)/projects/new/steps/BudgetStep.tsx` (`currencyExponent`, no `parseFloat`).
    27. `attributeValueForIdent(ident: string, values: ReadonlyArray<{ key: string }>): { key: string } | undefined` — `values.find(v => v.key === ident)`.
  - **Pattern:** `src/client/lib/access.ts` + `src/client/lib/access.test.ts` (A3.0). Money string: A2.5 `BudgetStep.tsx` `minorToInputString`. Tokenizer: `src/lib/rules/formulaHighlight.ts`. Formula context to copy: `src/server/services/budget/categories.ts` `formulaContext` (do not import it — re-encode the one-key object). Contracts: `src/shared/schemas/budget.ts` + `src/shared/contracts/budget.ts` (B4 — this phase’s B1 equivalent). Card limits shape: `src/shared/schemas/cardControls.ts` `transactionLimitsSchema`. Timeline: `src/client/lib/projects.ts` `toTimelineItem`.
  - **STOP and get this reviewed before A4.1+.** Wrong formula context, a clamped remaining, or a new contract after screens land is a rewrite.
  - **Accept:** `pnpm test client/lib/budget` — cover: `BUDGET_NAV` four suffixes; `isBudgetNavActive` Overview is not active on `/categories`; `formulaContextFromBudget` has exactly one key; `formulaIdentTokens('pct(approvedAmount, 10) + headcount')` is `['approvedAmount', 'headcount']`; `allocationsExceedApproved(100, 100)` false and `(101, 100)` true; `diffCardTransactionLimits` emits a row when MONTHLY amount changes and none when equal; `cardLimitDiffToDiffView` values are `{ amount, currency }`; `projectionToBudgetBarProps` remaining `-1` stays `-1`; `budgetHref('')` throws; `budgetHistoryReason` reads `metadata.reason`; `pendingChangeRequests` keeps only `PENDING`.
  - **Notes:** Helpers in `src/client/lib/budget.ts` (21 unit tests). Formula context is `{ approvedAmount }` only; remaining is not clamped. `pnpm verify` green (1618 tests). STOP before A4.1 screens.

---

## Tasks

### A4.1 — Budget chrome + BudgetBar one-breakpoint

- [x] **A4.1** — Sub-nav wrap Links; `BudgetBar` `md:grid-cols-4` + four tooltips
  - **Files:**
    - `src/app/(app)/projects/[id]/budget/layout.tsx` (create)
    - `src/app/(app)/projects/[id]/budget/BudgetChrome.tsx` (`'use client'`)
    - `src/app/(app)/projects/[id]/budget/categories/page.tsx` (create — placeholder until A4.5)
    - `src/app/(app)/projects/[id]/budget/history/page.tsx` (create — placeholder until A4.6)
    - `src/app/(app)/projects/[id]/budget/requests/page.tsx` (create — placeholder until A4.7)
    - `src/components/patterns/BudgetBar.tsx` (edit — class + tooltips only)
  - **Do:**
    1. `BudgetChrome`: `nav` `flex flex-wrap gap-2` of `Link`s from `BUDGET_NAV` via `budgetNavHref(id, suffix)` (`useParams().id`). Active: `isBudgetNavActive(pathname, id, suffix)`. Class `buttonVariants({ variant: 'ghost' })` — **no** `Button asChild`. Content column `min-w-0`. Do **not** use Radix `Tabs`.
    2. `layout.tsx` wraps children with `BudgetChrome`. Existing `budget/page.tsx` may stay `ComingSoonTab` until A4.2 (chrome still wraps it). Nested pages must **not** 404: placeholder `{Label} — not built yet` or `ComingSoonTab` (`Categories` / `History` / `Requests` are not workspace tabs — do not use `ComingSoonTab tab="Budget"` for them; a one-line `<main className="min-w-0">Categories — not built yet</main>` is enough).
    3. `BudgetBar`: replace `sm:grid-cols-4` with `md:grid-cols-4`. Wrap each of the four `<dt>` labels in `Tooltip` / `TooltipTrigger` / `TooltipContent` using `BUDGET_TERM_TOOLTIPS`. Keep Committed copy identical (`Approved but not yet spent`). Do not change `budgetBarLayout.ts`. Do not edit `/dev/ui`.
    4. Do not implement home mutations, categories, history, or requests in this task.
  - **Layout:** sub-nav `flex-wrap`. `BudgetBar` figures `grid-cols-2 md:grid-cols-4`. No Sheet. Shell collapse unchanged.
  - **Pattern:** A3.6 `src/app/(app)/settings/SettingsChrome.tsx`. Workspace prefix-active: `src/app/(app)/projects/[id]/ProjectWorkspace.tsx`. `BudgetBar` current file. B4 figures: `src/shared/schemas/budget.ts` `budgetProjectionSchema`.
  - **Accept:** `pnpm verify`. `/projects/[id]/budget/categories`, `/history`, `/requests` are not 404. `BudgetBar.tsx` contains `md:grid-cols-4` and does **not** contain `sm:grid-cols-4`. 375px and 768px: no page-level horizontal scrollbar; Overview/Categories/History/Requests reachable (wrap); at 375px the four figures stack 2×2; at 768px they are four across; Menu/Sheet still works below `md`. Aside still `hidden md:flex`.
  - **Notes:** Budget chrome wrap-Links (`buttonVariants`, no `Button asChild`). Nested `/categories` `/history` `/requests` placeholders. `BudgetBar` `md:grid-cols-4` + four `BUDGET_TERM_TOOLTIPS`. `pnpm verify` green (1618 tests).

### A4.2 — Budget home (read)

- [x] **A4.2** — `/projects/[id]/budget` four figures, states, recent entries
  - **Files:**
    - `src/app/(app)/projects/[id]/budget/page.tsx` (replace `ComingSoonTab`)
    - `src/app/(app)/projects/[id]/budget/BudgetHome.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<BudgetHome />` only.
    2. `useParams().id`. `useBudget(id)`. `useMe()` for `baseCurrency`. `currency = budget.budget?.currency ?? activeOrg.baseCurrency`. `403` → `ErrorState` `error.message`. `NOT_FOUND` → `ErrorState` `This project is not available.` Loading: `LoadingState`.
    3. If `!hasBudgetRecord(budget.budget)`: `EmptyState` locked no-budget copy; action gated `PermissionGate` `projectId={id}` `permission="budget.edit"` `denialMessage={editBudgetDenialMessage()}` wrapping a Button that **does not** fake a save in this task — `disabled` plus text `Set budget lands in A4.3.` **or** omit the action and leave `TODO(A4.3)` on the EmptyState. **Locked:** no PUT in A4.2.
    4. If budget exists: `BudgetBar` via `projectionToBudgetBarProps(projection, currency)`. Root `min-w-0 flex flex-col gap-4`.
    5. If `projection.overCommitted` or `projection.remaining < 0`: `Alert` destructive `overCommittedMessage()`.
    6. `useBudgetChangeRequests(id)` → `pendingChangeRequests` → `Alert` with locked pending copy, `MoneyDisplay` `{ amount: deltaAmount, currency }`, `reason`, `Link` `Review requests` → `budgetRequestsHref(id)`.
    7. Heading `Recent entries`. `useBudgetEntries(id, { page: 1, pageSize: 20 })`. `DataTable` columns: `type` (`StatusBadge` is **not** for entry types — render `type` as text/`Badge`), `amount` (`MoneyDisplay` `{ amount, currency: row.currency }`), `sourceType`, `note`, `createdAt` (`formatDate` `src/lib/dates.ts`). `getRowId: (row) => row.id`. Pagination `mode: 'page'` from the response. `empty` locked no-entries copy. Do **not** restyle as cards. Do **not** add a second `overflow-x-auto` (A2.3 already put it on `DataTable`).
    8. Toolbar `flex flex-wrap gap-2`: placeholder Buttons `Set approved` / `Record adjustment` / `Request change` **disabled** with `TODO(A4.3)` **or** omit until A4.3. **Locked:** no mutations in A4.2.
    9. Do not fetch on the server. Do not recompute remaining.
  - **Layout:** stack. No `md:grid` on the page (figures are inside BudgetBar). Toolbar `flex-wrap`. Table scrolls **inside**; page does not. No Sheet.
  - **Pattern:** A3.1 `src/app/(app)/projects/[id]/ProjectOverview.tsx`. DataTable: A2.3 `src/app/(app)/projects/ProjectList.tsx`. Hooks: `src/client/hooks/useBudget.ts` (B4). `BudgetBar` `src/components/patterns/BudgetBar.tsx`. `MoneyDisplay` F3.10.
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; four figures visible by vertical scroll (2×2 below `md`); pending-CR `Review requests` reachable when shown; table may scroll inside. `BudgetHome.tsx` does not contain `parseFloat` or `type="number"`. No `PAN` / `cvv` / `card_number`.
  - **Notes:** Read-only home: `BudgetBar` passthrough, over-committed + pending-CR alerts, entries DataTable. Mutations stubbed TODO(A4.3). `pnpm verify` green (1618 tests).

### A4.3 — Set approved, adjust, limits moved

- [x] **A4.3** — PUT approved + manual ADJUSTMENT + card-limit DiffView
  - **Files:**
    - `src/app/(app)/projects/[id]/budget/BudgetHome.tsx` (edit — wire actions)
    - `src/app/(app)/projects/[id]/budget/CardLimitMoves.tsx` (`'use client'`)
    - `src/app/(app)/projects/[id]/budget/SetApprovedDialog.tsx` (`'use client'`)
    - `src/app/(app)/projects/[id]/budget/AdjustDialog.tsx` (`'use client'`)
  - **Do:**
    1. `useProjectCards(id, { page: 1, pageSize: 100 })` for snapshots. `useQueryClient`. `useSetBudget`. `useCreateBudgetEntry`.
    2. **Set approved** (also the EmptyState action): `PermissionGate` `budget.edit`. Dialog: `Label` `Approved amount`; `Input` `type="text"` `inputMode="decimal"` prefilled `minorToInputString(budget.approvedAmount ?? 0, currency)`; submit `parseMoneyInput(raw, currency)`. `approvedAmount < 0` invalid. Unchanged amount → close without PUT. Else snapshot limits, `mutateAsync({ id, input: { currency, approvedAmount } })`, extra-invalidate §11, refetch cards, set `CardLimitMoves` diffs. `422` → `applyServerErrorsFromApiError`. `403`/`409` → Alert `error.message`.
    3. **Record adjustment**: Dialog amount (signed) + optional `note` Textarea. `amount === 0` → locked zero copy. Snapshot, `useCreateBudgetEntry().mutateAsync({ id, input: { amount, note: note || null } })`, extra-invalidate, DiffView.
    4. **Request change**: `PermissionGate` `budget.request` `Link` (or Button `asChild` Link) to `budgetRequestsHref(id)` — create form is A4.7. Always visible.
    5. `CardLimitMoves`: if diffs length 0 → `noCardLimitsMovedMessage()`; if cards `total === 0` also `No cards yet.` `Link` `cardsTabHref`. Else heading `Card limits that moved` + `DiffView` `{...cardLimitDiffToDiffView(diffs)}`. Labels `nickName` + `maskedNumber` only.
    6. After PUT, if `overCommitted`, the home Alert from A4.2 must still show (projection from `useBudget` invalidation).
  - **Layout:** dialogs stacked fields. Action row `flex flex-wrap gap-2`. DiffView may use its own `grid-cols-3` (F3 — do not restyle). No page `md:grid`. No `hidden` on Set/Adjust/Request.
  - **Pattern:** A1.6 money-adjacent forms; A2.5 `BudgetStep.tsx` (`parseMoneyInput`, no `type="number"`). `DiffView` `src/components/patterns/DiffView.tsx`. `useSetBudget` / `useCreateBudgetEntry` `src/client/hooks/useBudget.ts`. `useProjectCards` `src/client/hooks/useCards.ts`. `qk.cardsForProject` `src/client/queryKeys.ts`. `applyServerErrorsFromApiError` `src/client/lib/forms/applyServerErrors.ts`. B4 PUT/entries: `src/shared/contracts/budget.ts`.
  - **Accept:** `pnpm verify` and `pnpm test client/lib/budget`. 375px and 768px: Set approved / Record adjustment / Request change reachable; dialogs do not force page-level horizontal scroll; four figures still visible. Saving approved refetches cards and renders DiffView or the locked empty-moves sentence. No `usePanToken`. No `useCardLimits` in these files.
  - **Notes:** Set approved + adjust dialogs; snapshot `desiredControls.transactionLimits` then DiffView. Extra-invalidate history/entries. `pnpm verify` green (1618 tests).

### A4.4 — Formula editor (no screen)

- [ ] **A4.4** — `FormulaEditor` live `useValidateFormula`
  - **Files:**
    - `src/app/(app)/projects/[id]/budget/FormulaEditor.tsx` (`'use client'`)
  - **Do:**
    1. Props: `{ expression: string; onChange: (next: string) => void; approvedAmount: number; currency: string; projectId: string; disabled?: boolean }`.
    2. `Textarea` `maxLength` not required (schema 500 — show locked too-long copy when `formulaExpressionTooLong`). `FormulaHighlight` of `expression` in the preview pane.
    3. When `!isFormulaExpressionEmpty(expression)` and not too long: debounce `FORMULA_DEBOUNCE_MS`, generation counter, `useValidateFormula().mutate({ expression, context: formulaContextFromBudget(approvedAmount) })`.
    4. Preview: `ok: true` → `MoneyDisplay` `{ amount: value, currency }`; `ok: false` → `error` verbatim. Incomplete empty → `Enter a formula to preview.`
    5. Context chip: `MoneyDisplay` of `{ amount: approvedAmount, currency }` labelled `approvedAmount`.
    6. `useAttributeValues({ subjectType: 'PROJECT', subjectId: projectId, page: 1, pageSize: 100 })`. For each `formulaIdentTokens(expression)` except `approvedAmount`: if `attributeValueForIdent` hits, render `AttributeValue` with `value`, `observedAt`, `ttlSec`, `label: key`; else if ident is not `approvedAmount`, muted line + `attributeFormulaLandsInA6Message()`.
    7. Export a small handle or call `onValidityChange(ok: boolean)` so A4.5 can disable Save. `ok` is true iff empty expression **or** last result `ok === true` for the current expression. Too long → false.
    8. One column inside the editor; the parent supplies `flex-col md:flex-row`. This file is `flex flex-col gap-3 min-w-0`.
  - **Layout:** stack. Preview below the textarea on this component (parent row on `md`). No Sheet.
  - **Pattern:** A3.3 `ScopePicker.tsx` (isolated control). A3.4 generation counter in `AddMemberForm.tsx`. `FormulaHighlight` `src/components/patterns/FormulaHighlight.tsx`. `AttributeValue` `src/components/patterns/AttributeValue.tsx`. Hook: `useValidateFormula` `src/client/hooks/useBudget.ts`. B4 validate: `src/shared/schemas/budget.ts` `validateFormulaInput` / `validateFormulaOutput`. Server context to match: `src/server/services/budget/categories.ts` `formulaContext`.
  - **Accept:** `pnpm verify`. 375px and 768px: textarea and preview reachable; no page-level horizontal scrollbar when this component is the only body (dev-check by temporarily rendering it is **not** required — A4.5 Accept covers resize). Confirm `context` in the mutate payload is `{ approvedAmount }` only (read the call). Do not import `@/server`.
  - **Notes:** _{filled in on completion}_

### A4.5 — Categories

- [ ] **A4.5** — `/projects/[id]/budget/categories` list + Sheet + formula save gate
  - **Files:**
    - `src/app/(app)/projects/[id]/budget/categories/page.tsx` (replace placeholder)
    - `src/app/(app)/projects/[id]/budget/categories/CategoryList.tsx` (`'use client'`)
    - `src/app/(app)/projects/[id]/budget/categories/CategorySheet.tsx` (`'use client'`)
  - **Do:**
    1. `useBudget(id)` + `useBudgetCategories(id)` + `useWorkstreams(id)`. If no budget record: `EmptyState` pointing `Link` to `budgetHref(id)` (set budget first). `403` → `ErrorState`.
    2. If `allocationsExceedApproved(allocationsSum(categories), budget.approvedAmount)`: `Alert` destructive `categoriesExceedMessage()` (can happen if approved was later lowered — still show; Save of a new category stays blocked).
    3. Toolbar `flex-wrap`: `PermissionGate` `budget.edit` Button `Add category` opens `CategorySheet` with `mode: 'create'`.
    4. `DataTable` columns: `name`, `workstream` (match `workstreams` by id; fallback raw id or `—`), `allocated` (`MoneyDisplay` `{ amount: allocated, currency }`), `formula` (`FormulaHighlight` if `formula` else `—`), `actions` Edit / Delete. `empty` locked no-categories copy, gated Add.
    5. `CategorySheet` `side="right"`: `name` Input min 1 max 120; workstream `Select` including a `None` value → `workstreamId: null`; `RadioGroup` `Fixed amount` | `Formula`.
       - Fixed: money `Input` `parseMoneyInput` → `allocated`, omit `formula` (create) or `formula: null` (update to clear).
       - Formula: `FormulaEditor`; Save disabled until editor valid; create/update send `{ name, workstreamId, allocated: lastOkValue ?? 0, formula: expression }`.
    6. Create `useCreateBudgetCategory({ id, input })`. Update `useUpdateBudgetCategory({ id, catId, input })`. Delete: ConfirmDialog locked copy then `useDeleteBudgetCategory({ id, catId })`. `409` → Alert server message. Extra-invalidate history. Snapshot + `CardLimitMoves` on the list page after CUD (reuse A4.3 component — import it).
    7. Save blocked client-side when the resulting sum would exceed approved (compute with the edited row’s new allocated). Still handle 422.
  - **Layout:** table scrolls inside; toolbar wrap. Sheet body `flex flex-col gap-4 min-w-0`. Inside Sheet, form + formula preview `flex flex-col gap-4 md:flex-row` with both columns `min-w-0 flex-1`. Do not `hidden` Add/Edit/Delete on narrow.
  - **Pattern:** A3.5 `EditMemberSheet.tsx` + A3.2 `PeopleList.tsx`. `Select` `src/components/ui/select.tsx`. `RadioGroup` `src/components/ui/radio-group.tsx`. Hooks: `src/client/hooks/useBudget.ts`. Workstreams: `src/client/hooks/useProjects.ts` `useWorkstreams`. B4 categories: `src/shared/contracts/budget.ts` `createCategory` / `updateCategory` / `deleteCategory`. ConfirmDialog F3.20.
  - **Accept:** `pnpm verify`. Saving with an invalid formula is impossible (button disabled). 375px and 768px: no page-level horizontal scrollbar; Add / Save / Delete reachable; Sheet does not force window sideways scroll; table may scroll inside; at `md` form and formula preview sit in a row inside the Sheet. `FormulaEditor` mutate context is still `{ approvedAmount }` only.
  - **Notes:** _{filled in on completion}_

### A4.6 — History

- [ ] **A4.6** — `/projects/[id]/budget/history` actor + reason
  - **Files:**
    - `src/app/(app)/projects/[id]/budget/history/page.tsx` (replace placeholder)
    - `src/app/(app)/projects/[id]/budget/history/BudgetHistory.tsx` (`'use client'`)
  - **Do:**
    1. `useBudgetHistory(id)`. `403` → `ErrorState`. Loading `LoadingState`.
    2. Map entries through `toBudgetHistoryTimelineItem`. Under each `Timeline` item (or as `summary` suffix): if `budgetHistoryReason(entry)` non-null, render that string. Do not drop `actorType` — `Timeline` already distinguishes USER/RULE/SYSTEM/AIRWALLEX.
    3. Optional: changed rows with `before`/`after` objects may render a nested `DiffView` — skip if it blows the 5-file/complexity budget; **locked minimum** is action + actorType + reason + `at`.
    4. Empty: locked no-history copy on `Timeline` `empty`.
  - **Layout:** column. No `md:grid`. No Sheet. No DataTable required (`Timeline` is the list).
  - **Pattern:** A3.2 access-history block in `PeopleList.tsx`. `toAccessHistoryTimelineItem` in `src/client/lib/access.ts`. `Timeline` `src/components/patterns/Timeline.tsx`. Hook: `useBudgetHistory` `src/client/hooks/useBudget.ts`. B4: `src/shared/schemas/budget.ts` `budgetHistoryEntrySchema` (`at`, not `createdAt`).
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; history entries reachable by vertical scroll. Every rendered item includes `action` text. A fixture/reason test lives in `client/lib/budget` (already A4.0) — do not add RTL.
  - **Notes:** _{filled in on completion}_

### A4.7 — Change requests

- [ ] **A4.7** — `/projects/[id]/budget/requests` create + decide
  - **Files:**
    - `src/app/(app)/projects/[id]/budget/requests/page.tsx` (replace placeholder)
    - `src/app/(app)/projects/[id]/budget/requests/ChangeRequestList.tsx` (`'use client'`)
    - `src/app/(app)/projects/[id]/budget/requests/CreateChangeRequestDialog.tsx` (`'use client'`)
  - **Do:**
    1. `useBudget(id)` + `useBudgetChangeRequests(id)`. No budget → EmptyState link home. `403` → `ErrorState`.
    2. Toolbar `flex-wrap`: `PermissionGate` `budget.request` `Request change` opens Dialog. Fields: delta `Input` `type="text"` `inputMode="decimal"` (signed `parseMoneyInput`); `reason` Textarea min 1 max 2000. `deltaAmount === 0` → locked copy. Submit `useCreateChangeRequest({ id, input: { deltaAmount, reason } })`. Extra-invalidate history. No cards snapshot required on **create** (ledger does not move until approve).
    3. `DataTable` **all** rows from GET (no client status filter, no invented query params). Columns: `deltaAmount` (`MoneyDisplay`), `reason`, `status` (`Badge` text `PENDING` / `APPROVED` / `REJECTED`), `createdAt` (`formatDate`), `actions`.
    4. Actions only when `status === 'PENDING'`: `Approve` and `Reject` each `PermissionGate` `budget.edit`. ConfirmDialogs locked §12. `useDecideChangeRequest({ id: row.id, input: { decision: 'APPROVE' | 'REJECT' } })`. On APPROVE: snapshot limits **before**, then mutate, extra-invalidate, refetch cards, show `CardLimitMoves` above the table. Skip DiffView on REJECT.
    5. `empty` locked no-change-requests copy. Optional note on decide: skip (no extra field).
  - **Layout:** table scrolls inside; toolbar wrap. Dialog stacked. No `md:grid`. Do not `hidden` Approve/Reject on narrow.
  - **Pattern:** A3.8 `AccessReviewList.tsx` (row actions + ConfirmDialog, **but** no URL filters — API has none). Hooks: `useCreateChangeRequest` / `useDecideChangeRequest` `src/client/hooks/useBudget.ts`. B4: `src/shared/contracts/budget.ts` `createChangeRequest` / `decideChangeRequest`. Decide path param is change-request id: `src/app/api/budget/change-requests/[id]/decide/route.ts`.
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; Request change / Approve / Reject reachable when offered. Approving a request shows DiffView or `No card limits moved.` Home pending banner (A4.2) still uses the same list’s `PENDING` rows. No `DISMISS`. No fake `?status=` API mapping.
  - **Notes:** _{filled in on completion}_

### A4.8 — Wizard link

- [ ] **A4.8** — Budget step points at categories
  - **Files:**
    - `src/app/(app)/projects/new/steps/BudgetStep.tsx` (edit)
  - **Do:**
    1. After the approved-amount field (and existing `BudgetBar`), if `draftId.length >= 1`, render `Link` `className={buttonVariants({ variant: 'outline' })}` `href={budgetCategoriesHref(draftId)}` with locked wizard copy. Prefer `buttonVariants` + `Link`, not `Button asChild`.
    2. Do **not** add category fields, formula validation, or a second PUT. Do **not** change `isStepValid` / `submit`.
    3. Keep `flex min-w-0 flex-col gap-4`. Link sits in the stack (`flex-wrap` not required for a single link).
  - **Layout:** one column (already). No Sheet. No `md:grid`.
  - **Pattern:** A2.5 this same file. Href helper from A4.0. A3 Cancel-as-Link: `src/app/(app)/projects/[id]/people/add/AddMemberForm.tsx`.
  - **Accept:** `pnpm verify`. 375px and 768px: wizard Next and the new Link reachable; no page-level horizontal scrollbar. `BudgetStep.tsx` still has no `type="number"` and no `parseFloat`.
  - **Notes:** _{filled in on completion}_

### A4.9 — Don’t-break + invariant proofs

- [ ] **A4.9** — Four figures, live formula gate, limits moved, 375/768, no PAN, shell unchanged
  - **Files:**
    - `src/client/lib/budget.test.ts` (extend)
    - `src/client/lib/projects.test.ts` (read-only assert `WORKSPACE_TAB_HREFS` still has no settings and still includes `/budget`)
    - screens listed above — **read only** unless a §12 string or layout class is missing
  - **Do:**
    1. Assert `projectionToBudgetBarProps` does not clamp `remaining: -200`.
    2. Assert `formulaContextFromBudget(42)` equals `{ approvedAmount: 42 }` (no extra keys).
    3. Assert `BUDGET_NAV` labels are exactly Overview, Categories, History, Requests and `isBudgetNavActive('/projects/p/budget/categories', 'p', '')` is false.
    4. Assert `diffCardTransactionLimits` on a MONTHLY 100 → 80 produces one diff and `cardLimitDiffToDiffView` values are money objects.
    5. Assert no file under `src/app/(app)/projects/[id]/budget` or `BudgetStep.tsx` contains `PAN`, `cvv`, or `card_number` (same style as A3.9 / A2.9).
    6. Confirm `(app)/layout.tsx` still `requireApp()` + `AppShellFrame`. Confirm `AppShell.tsx` aside class still includes `hidden` and `md:flex`. Confirm `BudgetBar.tsx` has `md:grid-cols-4` not `sm:grid-cols-4`.
    7. Manual don’t-break: budget home, categories, history, requests, wizard budget step at 375px and 768px.
  - **Layout:** n/a (proof) plus the manual resize check.
  - **Pattern:** A3.9 `src/client/lib/access.test.ts`. A2.9 `src/client/lib/projects.test.ts`.
  - **Accept:** `pnpm test client/lib/budget` and `pnpm test client/lib/projects` and `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar on home (four figures + Set/Adjust/Request), categories (Add/Save), history, requests (Approve/Reject), wizard (Next + categories Link); Menu/Sheet still works below `md`; tables may scroll inside.
  - **Notes:** _{filled in on completion}_

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Spec’s review checklist in `A4-budget.md` signed off:
  - [ ] The four figures are visually distinct and individually explained
  - [ ] Formula validation is live and blocks saving when invalid
  - [ ] Budget changes surface the card limits they moved
  - [ ] Negative remaining is flagged prominently
  - [ ] All amounts render through F2's money helpers — no local arithmetic
  - [ ] History shows actor and reason for every change
  - [ ] 375px and 768px: no page-level horizontal scrollbar; the four budget figures and primary actions visible without sideways window scroll
- [ ] `/dev/shell` still works (unchanged collapse)
- [ ] No new F3 primitive files; only `BudgetBar` `md:grid-cols-4` + four tooltips
- [ ] No `call()` / `fetch` / `@/server` in `'use client'` screens
- [ ] `STATUS.md` updated with the next phase (**A5**)

## Out of scope (do not do in A4)

- AppShell collapse / second nav (A2.1)
- `/projects/[id]/settings` or a seventh workspace tab
- Rebuilding wizard budget PUT / adding categories inside `StepWizard` (A4.8 is a Link only)
- `putBudgetInput.formula` / `thresholdPcts` editors
- Attribute-driven formula **evaluation** (A6) — A4 only shows `AttributeValue` + the A6 helper line
- `GET /api/cards/:id/limits` / `useCardLimits` as the moved-limits source (A5)
- Airwallex iframes / PAN reveal (A5)
- Budget CSV export (A9)
- Posting `COMMITMENT` / `ACTUAL` / `RELEASE` from the UI
- Editing `invalidationMap.ts` / F1 hooks / B4 contracts
- `@testing-library/react`
- `sm:` / `lg:` / `xl:` / `2xl:` on A4 screens
