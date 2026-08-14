# F3 — UI Library & Kitchen Sink · Tasks

**Spec:** [F3-ui-library.md](./F3-ui-library.md)

**Model:** cheap / LOW — name every file, inline every prop/field with type and constraints, copy the cited F0/F2/shared file; do not invent product screens, new primitives beyond this list, a second money/date formatter, or change B0–B9 contracts.

**Depends on:** F2, complete and verified

No new domain API contracts. F3 builds tokens, shadcn-derived primitives, and product patterns on existing `shared` schemas/enums and F2 helpers. The review gate is the locked policies + token names + pattern prop types below.

B1 is the backend pattern-setter. For F3, the equivalent copy sources are **F0** (`/dev/shell`, states, toast, AppProviders) and **F2** (money, dates, status variants, `can()`, rule sentence). Point every task at those files, not at a blank design.

---

## F3.0 locked policies (do not reopen)

Approved when F3.0 is reviewed. Implementers follow these; do not re-litigate.

**Visual direction — quiet chrome, loud numbers.** Internal finance/procurement tool (PRD personas), not a consumer fintech site and not Airwallex/Stripe brand. Chrome stays cool and quiet so **money, status, and budget segments** carry the colour. Do not “make it pop.”

- **Genre:** dense ops dashboard (Ramp / Brex / Stripe Dashboard chrome) — not Linear indigo, not purple SaaS, not orange startup.
- **Base:** shadcn **new-york** + **`slate`** (cool grey, slightly blue). Primary actions are near-black slate, not a coloured brand button.
- **Type:** `system-ui, sans-serif`. No display/serif/Google font.
- **Radius:** keep shadcn new-york `--radius` (≈ `0.5rem`). No pill-everything (`rounded-full` only on avatars/badges that already use it).
- **Colour is meaning:** status, money sign, budget bar, actor type. Decorative colour on nav/cards/buttons is a bug.
- **Chroma stays low.** Saturated `bg-blue-600` / emerald-400 / fire-engine red on a page of badges reads as an alert storm. Use the muted HSL table below.
- **BudgetBar:** actual = slate ink (weight of spend); committed = steel info; remaining = empty track; over = brick danger. Do not use a rainbow stacked chart.
- **Forbidden:** indigo/violet primary, gradients, neon dark-mode, copying Airwallex’s marketing palette, warm stone/cream backgrounds.

1. **Layout (ARCHITECTURE tree, not `src/client/components/`)**
   - Primitives → `src/components/ui/` — **shadcn default lowercase filenames** (`button.tsx`, `dialog.tsx`).
   - Patterns → `src/components/patterns/` — **PascalCase** (`BudgetBar.tsx`, `MoneyDisplay.tsx`), matching `src/client/states/EmptyState.tsx`.
   - `cn()` → `src/lib/utils.ts` (shadcn alias `utils: "@/lib/utils"`). Do **not** put `cn` in `src/lib/money.ts`.
   - Kitchen sink → `src/app/dev/ui/page.tsx` + `src/app/dev/ui/layout.tsx` + `src/app/dev/ui/fixtures.ts`.
   - Do **not** create a second EmptyState/ErrorState/Toast. Restyle F0 files or re-export from patterns (policy #10).

2. **Stack — lock versions by compatibility, not invention**
   - Tailwind **v4** + `@tailwindcss/postcss` (Next.js 16; there is **no** `tailwind.config.ts` today — do not add a v3 config).
   - shadcn/ui **new-york**, `baseColor: slate`, `cssVariables: true`, `rsc: true`, `tsx: true`, `iconLibrary: lucide`.
   - `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `next-themes`, `tw-animate-css`.
   - Radix / `cmdk` / `react-day-picker` are added **by** `pnpm dlx shadcn@latest add <name>` in the primitive tasks — do not pre-install every `@radix-ui/*` in F3.0.
   - Do **not** add a second CSS-in-JS library, MUI, Chakra, or styled-components.

3. **`components.json` (exact aliases)**
   - `components` → `@/components`
   - `utils` → `@/lib/utils`
   - `ui` → `@/components/ui`
   - `lib` → `@/lib`
   - `hooks` → `@/client/lib/hooks`
   - `tailwind.css` → `src/app/globals.css`
   - `tailwind.config` → `""` (v4)
   - `prefix` → `""`

4. **Tokens**
   - **Keep** whatever base `--background`, `--foreground`, `--primary`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, `--card`, `--popover`, `--muted`, `--accent`, `--secondary` block current shadcn **slate** generates (oklch or hsl — do not rewrite the base block).
   - **Append** the semantic tokens in the F3.0 table (names **and** values). Dark mapping lives under `.dark { }`. Alias budget/money tokens with `var(--status-*)` where the table says so — do not duplicate a second HSL that can drift.
   - Dark mode is **class** `.dark` on `<html>`, not `prefers-color-scheme` alone — `/dev/ui` must toggle both themes.
   - Components use Tailwind token classes (`bg-background`, `text-destructive`, `bg-[var(--status-success)]`) — **never** raw `#hex`, `rgb()`, `hsl()` literals, or palette classes like `bg-red-500` / `text-gray-900` / `bg-[#fff]` in `src/components/**`, `src/client/shell/**`, `src/client/states/**`, `src/app/dev/**`.
   - One spinner (`src/components/ui/spinner.tsx`), one skeleton (`src/components/ui/skeleton.tsx`), one date format (`formatDate` / `formatDateTime` / `formatRelative` / `formatRange` from `src/lib/dates.ts`, default locale **en-GB**), one empty-state pattern (`EmptyState`).

5. **Money, PAN, permissions (never reopen F2 policies)**
   - All money display/parse/`percentOf` go through `src/lib/money.ts`. Components must not divide by 100 or `parseFloat` an amount.
   - `moneySchema`: `{ amount: z.number().int(), currency: z.string().length(3) }`.
   - **Never** accept, store, log, or render a PAN, CVV, or expiry. `CardVisual` takes `card.maskedNumber` only (`z.string().min(1)`). Reveal is a **trigger callback**; A5 mounts the Airwallex iframe.
   - `can()` / `useCan` / `RequirePermission` remain UX-only. `PermissionGate` composes them; it is not a security control.

6. **Pattern props are the contract**
   - Shapes live in `src/components/patterns/types.ts` (F3.0). Do not rename fields in a later task without changing that file first.
   - Patterns are **presentational**. They do not call `call()`, hooks that hit the network, or `@/server/*`. Track A passes data from F1 hooks.
   - Dual pagination (F1.0): cursor for activity/audit; page-based for transactions/rule runs. `DataTable` supports both modes; it does not fetch.

7. **Kitchen sink**
   - `/dev/ui` only when `process.env.NODE_ENV !== 'production'` — `notFound()` in production, copy `src/app/dev/shell/layout.tsx`.
   - Every primitive and pattern in **default, disabled, loading, error, empty** (where those states exist), plus both themes.
   - Hover/focus are CSS (`hover:`, `focus-visible:` with visible `--ring`). Also render an explicit disabled + loading Button.
   - **Realistic fixtures** in `src/app/dev/ui/fixtures.ts` — not lorem, not `100/100/100`. Locked numbers are in F3.0.

8. **Accessibility baseline**
   - Keyboard: Tab/Shift+Tab through interactive controls; Enter/Space on buttons; Escape closes Dialog/Sheet/Popover/Dropdown.
   - Visible `focus-visible` ring using `--ring`.
   - Icon-only buttons have `aria-label`.
   - Dialog/Sheet focus trap (Radix default — do not disable).
   - Toasts: `aria-live="polite"` (already on F0 `ToastProvider`) + `role="status"`.
   - `ConfirmDialog` type-to-confirm: confirm button `disabled` until the input equals `phrase` after trim (case-sensitive).

9. **Testing**
   - Prefer **pure helpers** next to the component (`budgetBarLayout`, `limitMeterLayout`, `matchesConfirmPhrase`) tested with vitest **node** env — same spirit as `decideRequirePermission` in `src/client/lib/permissions/RequirePermission.tsx`.
   - Do **not** add `@testing-library/react` unless a later task is blocked without it; kitchen sink is the visual review artefact.
   - Add `src/components/**/*.test.ts` to the vitest **unit** `include` in `vitest.config.mts`.

10. **F0 restyle, do not fork**
    - `src/client/states/EmptyState.tsx` / `ErrorState.tsx` / `LoadingState.tsx` / `PartialState.tsx` keep their export paths. Visuals move to patterns or those files import primitives; **one** EmptyState.
    - `src/client/providers/toastStore.ts` API stays: `success/error/info(message: string)`, `dismiss(id)`, `clear`, `kind: 'success' | 'error' | 'info'`. Restyle `ToastProvider.tsx` only.
    - `src/client/lib/permissions/PermissionTooltip.tsx` upgrades from native `title` to F3 `Tooltip`; keep `resolvePermissionTooltipTitle`.
    - App shell (`src/client/shell/*`) restyles onto tokens; **do not** change prop shapes from F0.12.

11. **Out of scope**
    - Product screens (Track A). `/dev/ui` and restyled `/dev/shell` only.
    - Animation beyond shadcn/Radix defaults + `animate-spin` on Spinner.
    - A published npm component library.
    - Changing B0–B9 / F1 contract field names.
    - A second formula/DSL parser (F2.8 `highlightFormula` / `ruleToSentence` are display-only).

### Semantic tokens to append (exact names + values)

Use HSL space-separated components (no `hsl()` wrapper) so they compose as `hsl(var(--status-success))` **or** map them in `@theme inline` the same way shadcn maps `--primary`. If the generated shadcn file uses oklch for **base** slate tokens, **keep oklch for base**; still define these semantic tokens as HSL variables and wire `--color-status-success: hsl(var(--status-success));` etc. in `@theme inline`.

HSL are **desaturated on purpose** (steel / forest / ochre / brick). Do not substitute Tailwind `blue-500` / `green-500` / `red-500`.

**Light (`:root`)**

| Token                         | Value                   | Used by                                 |
| ----------------------------- | ----------------------- | --------------------------------------- |
| `--status-neutral`            | `215 10% 52%`           | `StatusVariant 'neutral'`               |
| `--status-neutral-foreground` | `215 25% 12%`           | text on neutral badge                   |
| `--status-info`               | `215 38% 42%`           | `'info'`; steel, not Twitter blue       |
| `--status-info-foreground`    | `0 0% 100%`             |                                         |
| `--status-success`            | `158 28% 32%`           | `'success'`; forest/teal, not lime      |
| `--status-success-foreground` | `0 0% 100%`             |                                         |
| `--status-warning`            | `32 48% 42%`            | `'warning'`; ochre                      |
| `--status-warning-foreground` | `0 0% 100%`             |                                         |
| `--status-danger`             | `4 48% 44%`             | `'danger'`; brick, not neon             |
| `--status-danger-foreground`  | `0 0% 100%`             |                                         |
| `--budget-committed`          | `var(--status-info)`    | committed segment                       |
| `--budget-actual`             | `215 20% 18%`           | spent = slate ink (not a traffic light) |
| `--budget-remaining`          | `215 14% 91%`           | unfilled track                          |
| `--budget-over`               | `var(--status-danger)`  | remaining `< 0`                         |
| `--money-positive`            | `var(--status-success)` |                                         |
| `--money-negative`            | `var(--status-danger)`  |                                         |
| `--money-zero`                | `215 10% 42%`           | muted                                   |
| `--z-sticky`                  | `20`                    |                                         |
| `--z-overlay`                 | `40`                    |                                         |
| `--z-dropdown`                | `50`                    |                                         |
| `--z-modal`                   | `50`                    |                                         |
| `--z-tooltip`                 | `60`                    |                                         |
| `--z-toast`                   | `100`                   |                                         |
| `--font-sans`                 | `system-ui, sans-serif` | keep F0 `globals.css` family            |

**Dark (`.dark`)** — same names; lift lightness, keep chroma low:

| Token                         | Dark value              |
| ----------------------------- | ----------------------- |
| `--status-neutral`            | `215 10% 58%`           |
| `--status-neutral-foreground` | `210 20% 98%`           |
| `--status-info`               | `214 40% 68%`           |
| `--status-info-foreground`    | `215 25% 12%`           |
| `--status-success`            | `158 25% 58%`           |
| `--status-success-foreground` | `215 25% 10%`           |
| `--status-warning`            | `36 45% 58%`            |
| `--status-warning-foreground` | `215 25% 10%`           |
| `--status-danger`             | `4 50% 68%`             |
| `--status-danger-foreground`  | `215 25% 10%`           |
| `--budget-committed`          | `var(--status-info)`    |
| `--budget-actual`             | `210 20% 92%`           |
| `--budget-remaining`          | `215 12% 18%`           |
| `--budget-over`               | `var(--status-danger)`  |
| `--money-positive`            | `var(--status-success)` |
| `--money-negative`            | `var(--status-danger)`  |
| `--money-zero`                | `215 10% 62%`           |

Z-index and `--font-sans` are the same in dark.

### Pattern prop types (inline — F3.0 writes these to `src/components/patterns/types.ts`)

`Money` = `{ amount: number /* int */, currency: string /* length 3 */ }` from `@/shared/schemas/base`.

`iso` = `string` matching `isoDateSchema` (`z.string().datetime()`).

**MoneyDisplayProps**

| Field          | Type      | Constraints                                                                                             |
| -------------- | --------- | ------------------------------------------------------------------------------------------------------- |
| `money`        | `Money`   | `amount` int; `currency` length 3                                                                       |
| `compact?`     | `boolean` | default `false` → `formatMoney`; `true` → `formatMoneyCompact`                                          |
| `colorBySign?` | `boolean` | default `true`. `amount > 0` → `--money-positive`; `< 0` → `--money-negative`; `=== 0` → `--money-zero` |

**StatusBadgeProps** (discriminated union)

```
| { kind: 'project'; status: ProjectStatus }
| { kind: 'card'; status: CardStatus }
| { kind: 'request'; status: PurchaseRequestStatus }
| { kind: 'ruleRun'; status: RuleRunStatus }
```

Enums: `ProjectStatus` = `DRAFT | PENDING_APPROVAL | ACTIVE | CLOSING | CLOSED | ARCHIVED | CANCELLED`; `CardStatus` = `PENDING | ACTIVE | INACTIVE | CLOSED | BLOCKED | LOST | STOLEN | FAILED`; `PurchaseRequestStatus` = `DRAFT | PENDING | APPROVED | REJECTED | EXPIRED | CANCELLED`; `RuleRunStatus` = `SUCCESS | PARTIAL | FAILED | SKIPPED | DRY_RUN`. Labels + variants from `src/lib/format/status.ts` (do not duplicate the maps).

**BudgetBarProps** — fields from `budgetProjectionSchema` plus currency:

| Field             | Type      | Constraints                                     |
| ----------------- | --------- | ----------------------------------------------- |
| `currency`        | `string`  | length 3                                        |
| `approved`        | `number`  | int (minor units). May be 0                     |
| `committed`       | `number`  | int                                             |
| `actual`          | `number`  | int                                             |
| `remaining`       | `number`  | int — **may be negative; never clamp the data** |
| `utilisationPct?` | `number`  | int nonnegative — display only                  |
| `overCommitted?`  | `boolean` | if omitted, treat `remaining < 0` as over       |

**LimitMeterProps** — `cardLimitEntrySchema` + currency:

| Field       | Type                       | Constraints                                                                        |
| ----------- | -------------------------- | ---------------------------------------------------------------------------------- |
| `interval`  | `TransactionLimitInterval` | `PER_TRANSACTION \| DAILY \| WEEKLY \| MONTHLY \| QUARTERLY \| YEARLY \| ALL_TIME` |
| `amount`    | `number`                   | int nonnegative (total minor units)                                                |
| `remaining` | `number`                   | int (minor units remaining; may be `< 0`)                                          |
| `currency`  | `string`                   | length 3                                                                           |

**AttributeValueProps** — from `attributeValueSchema`:

| Field        | Type                                  | Constraints                                   |
| ------------ | ------------------------------------- | --------------------------------------------- |
| `value`      | `number \| string \| boolean \| null` | `attributeLiteralSchema`                      |
| `observedAt` | `string`                              | iso datetime                                  |
| `ttlSec`     | `number \| null`                      | `int positive` or `null` (null → never stale) |
| `unit?`      | `string \| null`                      | max 40 when present                           |
| `label?`     | `string`                              | optional human label                          |
| `now?`       | `Date`                                | test/kitchen-sink clock                       |

**PermissionGateViewProps** (presentational; kitchen sink + tests)

| Field           | Type        | Constraints                                                                                   |
| --------------- | ----------- | --------------------------------------------------------------------------------------------- |
| `allowed`       | `boolean`   |                                                                                               |
| `denialMessage` | `string`    | min 1 when `allowed === false`                                                                |
| `children`      | `ReactNode` | rendered when allowed; when denied, wrapped in Tooltip (not native `title`)                   |
| `fallback?`     | `ReactNode` | default: `children` cloned/wrapped disabled. Denied always shows tooltip with `denialMessage` |

**PermissionGateProps** (live) = `RequirePermissionProps` from `src/client/lib/permissions/RequirePermission.tsx`: `projectId: string`, `permission: Permission` (dotted strings e.g. `'card.manage'`), `subject?: PermissionSubject` (`{ cardId?, workstreamId?, categoryId?, userId?, callerUserId? }`), `reasons?: { permission: Permission, allowed: boolean, message: string min 1 }[]`, `fallback?: ReactNode`, `children: ReactNode`. Live wrapper calls `useCan` then `PermissionGateView`. Header comment: UX only, never a control.

**CardVisualProps**

| Field          | Type          | Constraints                                      |
| -------------- | ------------- | ------------------------------------------------ |
| `nickName`     | `string`      | min 1 max 100                                    |
| `maskedNumber` | `string`      | min 1 — **masked only**, e.g. `************4242` |
| `status`       | `CardStatus`  |                                                  |
| `purpose?`     | `CardPurpose` | `SHARED \| MEMBER \| VENDOR \| ONE_TIME`         |
| `onReveal?`    | `() => void`  | button only; **must not** fetch or receive PAN   |

**TimelineItem** / **TimelineProps**

| Field      | Type                                                                                      | Constraints |
| ---------- | ----------------------------------------------------------------------------------------- | ----------- |
| `items`    | `TimelineItem[]`                                                                          |             |
| `loading?` | `boolean`                                                                                 |             |
| `empty?`   | `{ title: string, description: string, action?: { label: string, onClick: () => void } }` |             |

`TimelineItem`: `id: string min 1`, `at: iso`, `actorType: ActorType` (`USER \| RULE \| SYSTEM \| AIRWALLEX`), `actorId: string min 1`, `actorName?: string`, `summary: string min 1 max 500`, `subjectType?: string min 1`, `subjectId?: string min 1`. Maps `activityItemSchema` (`summary`) and `auditEntrySchema` (`action` → `summary`).

**RuleSentenceProps**: `{ rule: RuleSentenceInput }` where `RuleSentenceInput` = `Pick<{ when: Condition, then: RuleAction[], else?: RuleAction[], name?: string }, 'when' \| 'then' \| 'else' \| 'name'>` from `src/lib/rules/sentence.ts`. Render `ruleToSentence(rule)` as prose. Do not validate.

**FormulaHighlightProps**: `{ expression: string }` — `highlightFormula` tokens; CSS classes per `FormulaTokenType`: `number | ident | op | punct | ws | unknown`. Display only.

**DiffViewProps**: `{ before: unknown \| null, after: unknown \| null }` — key-by-key before/after. Kitchen sink uses `auditEntrySchema.before/after` and `cardControlsDiffSchema`.

**EmptyStateProps** (keep F0): `{ title: string, description: string, action?: { label: string, onClick: () => void }, illustration?: ReactNode }`.

**ErrorStateProps**: `{ message: string, onRetry?: () => void, code?: ErrorCode }`. `ErrorCode` from `src/shared/enums/errors.ts`. Show Retry when `onRetry` is passed **and** `code` is omitted or is `RATE_LIMITED | UPSTREAM_ERROR | INTERNAL` (F0.5 retryable). No Retry for `PERMISSION_DENIED` / `NOT_FOUND` even if `onRetry` slipped in.

**ConfirmDialogProps**

| Field            | Type                                             | Constraints                  |
| ---------------- | ------------------------------------------------ | ---------------------------- |
| `open`           | `boolean`                                        |                              |
| `onOpenChange`   | `(open: boolean) => void`                        |                              |
| `title`          | `string`                                         | min 1                        |
| `description`    | `string`                                         | min 1                        |
| `confirmLabel`   | `string`                                         | min 1                        |
| `cancelLabel?`   | `string`                                         | default `'Cancel'`           |
| `variant`        | `'default' \| 'destructive'`                     |                              |
| `typeToConfirm?` | `{ phrase: string min 1, prompt: string min 1 }` | confirm disabled until match |
| `onConfirm`      | `() => void`                                     |                              |
| `loading?`       | `boolean`                                        |                              |

Match: `input.trim() === phrase.trim()` (case-sensitive). Kitchen-sink close-card: `phrase: 'CLOSE'`, description must say the close **cannot be undone** at Airwallex and **pending transactions will still clear**. This is UI-only; A5 still posts `closeCardInput` `{ confirm: true }`.

**StepWizardProps**

| Field          | Type                                                              | Constraints                                                                                    |
| -------------- | ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `steps`        | `{ id: string min 1, label: string min 1, optional?: boolean }[]` | min 1                                                                                          |
| `activeStepId` | `string`                                                          | must be a `steps[].id`                                                                         |
| `isStepValid`  | `(id: string) => boolean`                                         |                                                                                                |
| `isDirty?`     | `boolean`                                                         | when true, call `useUnsavedChangesGuard` from `src/client/lib/forms/useUnsavedChangesGuard.ts` |
| `onNext`       | `() => void`                                                      |                                                                                                |
| `onBack`       | `() => void`                                                      |                                                                                                |
| `onCancel?`    | `() => void`                                                      |                                                                                                |
| `children`     | `ReactNode`                                                       | current step body (caller renders)                                                             |

Kitchen sink uses A2’s nine ids in order: `details`, `budget`, `members`, `roles`, `card-structure`, `controls`, `approval-rules`, `review`, `launch`.

**DataTable** — generic presentational table:

```
type DataTableColumn<T> = {
  id: string              // min 1
  header: string          // min 1
  cell: (row: T) => ReactNode
  sortable?: boolean      // default false
}

type DataTablePagination =
  | { mode: 'cursor'; nextCursor: string | null; onLoadMore: () => void; isFetchingMore?: boolean }
  | { mode: 'page'; page: number /* int min 1 */; pageSize: number /* int min 1 */; total: number /* int min 0 */; onPageChange: (page: number) => void }

type DataTableProps<T> = {
  columns: DataTableColumn<T>[]
  rows: T[]
  getRowId: (row: T) => string
  sorting?: { id: string; direction: 'asc' | 'desc' } | null
  onSortingChange?: (next: { id: string; direction: 'asc' | 'desc' } | null) => void
  pagination: DataTablePagination
  rowSelection?: { selectedIds: string[]; onChange: (ids: string[]) => void }
  columnVisibility?: { hiddenIds: string[]; onChange: (hiddenIds: string[]) => void }
  loading?: boolean
  error?: { message: string; onRetry?: () => void }
  empty: { title: string; description: string; action?: { label: string; onClick: () => void } }
  toolbar?: ReactNode   // filters are a slot — do not build a filter DSL
}
```

Header click cycle when `sortable`: `null → asc → desc → null`. Cursor “Load more” shown when `nextCursor !== null` (use `cursorNextParam` from `src/lib/pagination.ts`). Page mode: next page via `pageNextParam`. Loading → `LoadingState`/`Skeleton`; error → `ErrorState`; empty (`!loading && rows.length === 0`) → `EmptyState`.

### Locked kitchen-sink fixtures (write in F3.9; numbers locked now)

All amounts integer minor units.

- **Healthy USD budget:** `currency: 'USD'`, `approved: 5_000_000` ($50,000.00), `committed: 1_840_000` ($18,400.00), `actual: 2_215_050` ($22,150.50), `remaining: 944_950` ($9,449.50), `utilisationPct: 81`, `overCommitted: false`.
- **Over-budget:** `approved: 1_000_000`, `committed: 700_000`, `actual: 500_000`, `remaining: -200_000`, `utilisationPct: 120`, `overCommitted: true`.
- **Zero approved:** `approved: 0`, `committed: 0`, `actual: 0`, `remaining: 0`.
- **Zero approved with spend:** `approved: 0`, `committed: 0`, `actual: 50_000`, `remaining: -50_000`.
- **Full:** `approved: 1_000_000`, `committed: 0`, `actual: 1_000_000`, `remaining: 0`.
- **JPY limit:** `{ interval: 'MONTHLY', amount: 500_000, remaining: 120_000, currency: 'JPY' }` (zero-decimal — `formatMoney` has no cents).
- **Limit empty / full / over:** remaining `=== amount`, `=== 0`, `< 0` (e.g. remaining `-5_000` on amount `100_000`, currency `USD`).
- **Card:** `nickName: 'AWS — Q3 infra'`, `maskedNumber: '************4242'`, `status: 'ACTIVE'`, `purpose: 'SHARED'`. Also `PENDING`, `INACTIVE` (frozen), `CLOSED`, `FAILED`.
- **Attribute fresh:** `value: 3.2`, `label: 'Campaign ROAS'`, `unit: 'x'`, `observedAt: '2026-08-14T10:50:00.000Z'`, `ttlSec: 900`, `now: 2026-08-14T10:55:00.000Z` (not stale).
- **Attribute stale:** same key, `observedAt: '2026-08-14T09:00:00.000Z'`, `ttlSec: 900`, `now: 2026-08-14T10:55:00.000Z`.
- **Attribute ttl null:** `ttlSec: null` → never stale.
- **Rule:** `when: { attr: 'project.budget.utilisationPct', op: 'crossedBelow', value: 10 }`, `then: [{ action: 'card.freeze', target: { select: 'MEMBER_CARDS' }, params: {} }]` — sentence from F2 (~“When … crosses below 10%, freeze …”). Use real `RuleAction` / `Condition` types from `@/shared/types/rule`; if `params` requires `ruleControlsParamsSchema`, copy a minimal valid object from `src/lib/rules/sentence.test.ts` stubs (`stubActionForType` / `stubConditionForOperator`).
- **Timeline mix:** one `ActorType.USER` (“Maya Chen approved $4,023.50”), one `ActorType.RULE` (“Freeze member cards — utilisation crossed below 10%”), one `ActorType.SYSTEM`, one `ActorType.AIRWALLEX`, `at` ISO timestamps on 2026-08-14.
- **DiffView audit:** `before: { status: 'ACTIVE' }`, `after: { status: 'INACTIVE' }`.
- **DiffView rule run:** one `cardControlsDiffSchema` row: `cardId: 'card_aws_q3'`, `changed: true`, before `cardStatus: 'ACTIVE'`, after `cardStatus: 'INACTIVE'` (`DesiredCardStatus`).
- **DataTable rows:** three projects — `{ id, name: 'Q3 Brand Campaign', code: 'Q3-BRAND', status: 'ACTIVE' }`, `{ id, name: 'Tokyo Vendor Pilot', code: 'TYO-VENDOR', status: 'DRAFT' }`, `{ id, name: 'Closed Offsite', code: 'OFFSITE-24', status: 'CLOSED' }`.

### Track A walk (F3.25 checks this list — no new primitives in Track A)

| Phase | Screens                         | Must already exist in F3                                                                  |
| ----- | ------------------------------- | ----------------------------------------------------------------------------------------- |
| A1    | sign-in/up, onboarding, invite  | Button, Input, Label, FormField, Checkbox, Card, Alert, EmptyState, ErrorState            |
| A2    | dashboard, project list, wizard | DataTable, StatusBadge, StepWizard, EmptyState, PermissionGate, MoneyDisplay, BudgetBar   |
| A3    | overview, people, roles         | DataTable, PermissionGate, StatusBadge, BudgetBar, Timeline, ConfirmDialog, Tabs          |
| A4    | budget                          | BudgetBar, MoneyDisplay, AttributeValue, DataTable, ConfirmDialog, FormulaHighlight       |
| A5    | cards, reveal trigger           | CardVisual, LimitMeter, StatusBadge, ConfirmDialog (type-to-confirm), DataTable, DiffView |
| A6    | rules, simulate, attributes     | RuleSentence, FormulaHighlight, AttributeValue, DiffView, DataTable, StatusBadge          |
| A7    | requests, approvals             | DataTable, MoneyDisplay, StatusBadge, ConfirmDialog, BudgetBar                            |
| A8    | activity, transactions          | Timeline, DataTable, MoneyDisplay, StatusBadge, EmptyState                                |
| A9    | reports, audit, closure         | DiffView, Timeline, StepWizard, ConfirmDialog, DataTable, MoneyDisplay                    |

---

## Contracts first

- [x] **F3.0** — Tailwind/shadcn foundation, tokens, pattern prop types (STOP for review)
  - **Files:**
    - `package.json`, `pnpm-lock.yaml`
    - `postcss.config.mjs`
    - `components.json`
    - `src/lib/utils.ts`
    - `src/app/globals.css`
    - `src/components/patterns/types.ts`
    - `eslint.config.mjs` (extend)
    - `vitest.config.mts` (unit `include`)
  - **Do:**
    1. Add deps (current majors compatible with React 19 / Next 16): `tailwindcss`, `@tailwindcss/postcss`, `tw-animate-css`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `next-themes`. Do **not** add Radix yet.
    2. `postcss.config.mjs`: `plugins: { '@tailwindcss/postcss': {} }` (Tailwind v4).
    3. Write `components.json` per policy #3 (`style: "new-york"`, `baseColor: "slate"`, `cssVariables: true`, `rsc: true`, aliases listed).
    4. `src/lib/utils.ts`: `export function cn(...inputs: ClassValue[]): string { return twMerge(clsx(inputs)) }` — copy the standard shadcn snippet; `ClassValue` from `clsx`.
    5. Replace `src/app/globals.css` (today: `html, body { margin:0; font-family: system-ui }`):
       - `@import "tailwindcss";` and shadcn’s **slate** CSS-variable block (copy from current shadcn new-york slate + Tailwind v4 docs / `pnpm dlx shadcn@latest init` **non-interactive** if it only writes CSS — if init is interactive, **do not** run it; paste from shadcn’s published slate CSS). Follow the visual-direction block: quiet chrome, no indigo primary.
       - `body { @apply bg-background text-foreground; font-family: var(--font-sans); }`
       - Append the semantic token tables (light + `.dark`) from locked policies.
       - Map semantic tokens into `@theme inline` so `bg-status-success` **or** `bg-[var(--status-success)]` works. Prefer `@theme inline { --color-status-success: hsl(var(--status-success)); … }` mirroring how shadcn maps `--primary`.
    6. `src/components/patterns/types.ts`: export every pattern props type from the locked tables (MoneyDisplayProps, StatusBadgeProps, BudgetBarProps, LimitMeterProps, AttributeValueProps, PermissionGateViewProps, PermissionGateProps, CardVisualProps, TimelineItem, TimelineProps, RuleSentenceProps, FormulaHighlightProps, DiffViewProps, ConfirmDialogProps, StepWizardProps, DataTableColumn, DataTablePagination, DataTableProps). Import enums/schemas from `@/shared/*` and `RuleSentenceInput` from `@/lib/rules/sentence`. Re-export F0 `EmptyStateProps` / `ErrorStateProps` types if they live in the state files — do not fork a second EmptyState type.
    7. ESLint: copy the `src/client/**` `no-restricted-imports` `@/server` rule onto `src/components/**/*.{ts,tsx}`. Copy the `fetch` `no-restricted-syntax` from `src/client/shell` onto `src/components/**` and `src/app/dev/**`.
    8. Vitest unit `include`: add `src/components/**/*.test.ts`.
    9. Re-export `cn` from `src/lib/index.ts` **only if** it does not create a circular import; otherwise leave `cn` as `@/lib/utils`.
  - **Pattern:** F0.1 deps add in `package.json`; F2.0 vitest include extend in `vitest.config.mts`; F0.15 eslint patterns in `eslint.config.mjs`; shadcn `cn` is the industry snippet (same as F0.7 “keep tiny”). Token **names** are this file, not a guess.
  - **STOP and get this reviewed before F3.1+.** A renamed token or pattern prop after Track A is a rewrite.
  - **Accept:** `pnpm typecheck` and `pnpm lint`. Confirm `src/app/globals.css` contains every `--status-*`, `--budget-*`, `--money-*`, `--z-*` name. Confirm `types.ts` exports `BudgetBarProps.remaining` as `number` (not `nonnegative`).
  - **Notes:** Tailwind v4 + slate CSS variables + semantic HSL tokens; `cn` at `src/lib/utils.ts` (not re-exported from `src/lib/index.ts`). Pattern props in `src/components/patterns/types.ts`; `BudgetBarProps.remaining` is `number`. `ErrorStateProps` here includes optional `code` ahead of F3.19. STOP — review before F3.1.

---

## Implementation tasks

### F3.1 — Theme provider

- [x] **F3.1** — `ThemeProvider` + class dark mode
  - **Files:**
    - `src/client/providers/ThemeProvider.tsx`
    - `src/client/providers/AppProviders.tsx`
    - `src/app/layout.tsx`
  - **Do:**
    1. `ThemeProvider`: wrap `next-themes` `ThemeProvider` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, `storageKey="allocard:theme"`, `disableTransitionOnChange`. `'use client'`.
    2. `AppProviders`: insert `ThemeProvider` **inside** `SessionProvider` and **outside** `QueryClientProvider` (or immediately inside `QueryClientProvider` — pick **outside Query, inside Session**). Do not reorder Toast/ErrorBoundary/ActiveOrg.
    3. `src/app/layout.tsx`: `<html lang="en" suppressHydrationWarning>` (required by next-themes). Keep metadata. Body stays wrapped in `AppProviders`.
    4. Do **not** build `/dev/ui` yet. No theme toggle UI except what next-themes needs.
  - **Pattern:** `src/client/providers/AppProviders.tsx` (F0.8) + `src/client/providers/SessionProvider.tsx`. Storage key style: `allocard:activeOrgId` in `src/client/providers/ActiveOrgProvider.tsx` → `allocard:theme`.
  - **Accept:** `pnpm typecheck && pnpm build`
  - **Notes:** `next-themes` class strategy, `storageKey="allocard:theme"`, inside Session / outside Query. `suppressHydrationWarning` on `<html>`. No `/dev/ui` yet.

### F3.2 — Core primitives

- [x] **F3.2** — Button, Spinner, Badge, Skeleton, Progress, Separator
  - **Files:**
    - `src/components/ui/button.tsx`
    - `src/components/ui/spinner.tsx`
    - `src/components/ui/badge.tsx`
    - `src/components/ui/skeleton.tsx`
    - `src/components/ui/progress.tsx`
    - `src/components/ui/separator.tsx`
  - **Do:**
    1. `pnpm dlx shadcn@latest add button badge skeleton progress separator` (non-interactive). Then add `spinner.tsx` by hand if shadcn has no spinner: `Loader2` from `lucide-react` with `className={cn('size-4 animate-spin', className)}`, `role="status"`, `aria-label` default `'Loading'`. **This is the only spinner.**
    2. Button `variant`: `default | destructive | outline | secondary | ghost | link`. Button `size`: `default | sm | lg | icon`. Add `loading?: boolean` — when true, disable + show Spinner inside; icon-only (`size="icon"`) requires `aria-label` (TypeScript: if children are not a string, callers pass `aria-label`).
    3. Badge variants must include F2 `StatusVariant`: `neutral | info | success | warning | danger` **in addition to** shadcn `default | secondary | outline | destructive`. Map: `neutral` → status-neutral tokens; `info` → status-info; `success` → status-success; `warning` → status-warning; `danger` → status-danger. Do not use `bg-red-500`.
    4. Skeleton: token muted pulse — **the only skeleton style**.
    5. Progress: `value: number` 0–100 int; over-100 callers clamp the **bar width** to 100 but may pass `> 100` (LimitMeter over). Use `--status-danger` when `value > 100`.
    6. Separator: horizontal/vertical via shadcn.
    7. Strip any leftover hex classes from the generated files.
  - **Pattern:** shadcn generated files + `cn` from `src/lib/utils.ts`. Badge extra variants exist to serve `src/lib/format/status.ts` `StatusVariant`.
  - **Accept:** `pnpm typecheck && pnpm lint`
  - **Notes:** shadcn `radix-ui` unified package. Badge has StatusVariant tokens. Progress clamps bar width at 100 and uses `--status-danger` when `value > 100`. Spinner is Loader2-only.

### F3.3 — Form primitives

- [x] **F3.3** — Input, Textarea, Label, Checkbox, Radio, Switch, FormField
  - **Files:**
    - `src/components/ui/input.tsx`
    - `src/components/ui/textarea.tsx`
    - `src/components/ui/label.tsx`
    - `src/components/ui/checkbox.tsx`
    - `src/components/ui/radio-group.tsx`
    - `src/components/ui/switch.tsx`
    - `src/components/ui/form.tsx`
  - **Do:**
    1. `pnpm dlx shadcn@latest add input textarea label checkbox radio-group switch form`.
    2. Spec name `Radio` → `radio-group.tsx`. Spec name `FormField` → shadcn `form.tsx` exports `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormDescription`, `FormMessage`.
    3. `Form` must use the already-installed `react-hook-form` + `@hookform/resolvers` (F2.1). Do **not** add a second form library. Point callers at `useZodForm` from `src/client/lib/forms/useZodForm.ts` + **shared** schemas (e.g. `createProjectInput` in `src/shared/schemas/project.ts`: `name` string min 1 max 120, `code` alphanumeric+hyphens min 1 max 64, `description?` max 2000).
    4. Input `type="number"` is **forbidden for money** — document in a file header on `input.tsx`: money inputs are text + `parseMoneyInput` (F2.2). No `parseFloat`.
    5. Each control: default, disabled, and invalid (`aria-invalid`) styles via tokens (`--destructive` / `--ring`).
  - **Pattern:** shadcn form + `src/client/lib/forms/useZodForm.ts` (F2.6). Server field errors already map via `applyServerErrors` — FormMessage displays RHF errors.
  - **Accept:** `pnpm typecheck`
  - **Notes:** Form uses existing RHF + `useZodForm`. Input header forbids `type="number"` for money. shadcn overwrote Button — restored F3.2 loading/Spinner.

### F3.4 — Select, Combobox, Command

- [x] **F3.4** — Select, Combobox, Command
  - **Files:**
    - `src/components/ui/select.tsx`
    - `src/components/ui/command.tsx`
    - `src/components/ui/popover.tsx` (needed by combobox; if F3.6 also adds it, add it here and F3.6 must **reuse** this file — do not duplicate)
    - `src/components/ui/combobox.tsx` (composed; shadcn has no single file — write it)
  - **Do:**
    1. `pnpm dlx shadcn@latest add select command popover`.
    2. `Combobox` in `src/components/ui/combobox.tsx`: Popover + Command. Props: `{ options: { value: string min 1, label: string min 1 }[], value: string | null, onChange: (value: string | null) => void, placeholder?: string, emptyText?: string, disabled?: boolean, searchPlaceholder?: string }`. Filter by label via Command’s built-in search. `value === null` = none selected.
    3. Keyboard: type to filter; Enter selects; Escape closes (Radix/cmdk defaults).
  - **Pattern:** shadcn combobox example (Popover + Command) + Select from shadcn. Reuse `cn`.
  - **Accept:** `pnpm typecheck`
  - **Notes:** Combobox = Popover + Command, filter by label. Command pulled in `dialog.tsx` (F3.6 reuses it).

### F3.5 — Date pickers

- [x] **F3.5** — DatePicker + DateRangePicker
  - **Files:**
    - `src/components/ui/calendar.tsx`
    - `src/components/ui/date-picker.tsx`
    - `src/components/ui/date-range-picker.tsx`
  - **Do:**
    1. `pnpm dlx shadcn@latest add calendar` (pulls `react-day-picker`).
    2. **DatePicker** props: `{ value: string | null /* iso datetime or YYYY-MM-DD */; onChange: (iso: string | null) => void; disabled?: boolean; placeholder?: string }`. Wire format: store/onChange **ISO 8601 datetime** at UTC midnight of the selected calendar day (`YYYY-MM-DDT00:00:00.000Z`) to match `isoDateSchema` / project `startDate`/`endDate` in `src/shared/schemas/project.ts`. Display with `formatDate` from `src/lib/dates.ts` (en-GB, e.g. `1 Aug 2026`).
    3. **DateRangePicker** props: `{ from: string | null, to: string | null, onChange: (next: { from: string | null, to: string | null }) => void, disabled?: boolean }`. Display with `formatRange(from, to)` from `src/lib/dates.ts` (en dash).
    4. Do **not** add `date-fns` if `react-day-picker` already depends on it; do **not** add a second date lib. Do not reimplement `formatDate`.
    5. Popover + Button trigger; calendar in the popover.
  - **Pattern:** shadcn date-picker example + `src/lib/dates.ts` (F2.3). Popover from F3.4.
  - **Accept:** `pnpm typecheck`
  - **Notes:** UTC midnight ISO `YYYY-MM-DDT00:00:00.000Z`. Display via `formatDate` / `formatRange` (en-GB). react-day-picker v10 + date-fns already pulled by calendar.

### F3.6 — Overlays

- [x] **F3.6** — Dialog, Sheet, Tooltip, DropdownMenu (Popover already in F3.4)
  - **Files:**
    - `src/components/ui/dialog.tsx`
    - `src/components/ui/sheet.tsx`
    - `src/components/ui/tooltip.tsx`
    - `src/components/ui/dropdown-menu.tsx`
  - **Do:**
    1. `pnpm dlx shadcn@latest add dialog sheet tooltip dropdown-menu`.
    2. If `popover.tsx` missing (F3.4 skipped), add it here; otherwise **do not** regenerate a second copy.
    3. Keep Radix focus trap and Escape-to-close. Do not set `modal={false}` on Dialog.
    4. Tooltip: used by PermissionGate — must work wrapping a disabled button (wrap in `span` if Radix needs a focusable child — document in a comment).
    5. DropdownMenu: will power DataTable column visibility.
    6. z-index: use token `--z-modal` / `--z-tooltip` / `--z-dropdown` if easy; otherwise keep shadcn `z-50` and do not invent a third scale.
  - **Pattern:** shadcn overlays. Tooltip will replace native `title` in `src/client/lib/permissions/PermissionTooltip.tsx` (F3.14).
  - **Accept:** `pnpm typecheck`
  - **Notes:** Reused F3.4 dialog/popover. TooltipProvider in AppProviders. TooltipTrigger comment: wrap disabled buttons in a span.

### F3.7 — Layout & collection primitives

- [x] **F3.7** — Tabs, Table, ScrollArea, Breadcrumb, Pagination, Avatar, Card, Alert
  - **Files:**
    - `src/components/ui/tabs.tsx`
    - `src/components/ui/table.tsx`
    - `src/components/ui/scroll-area.tsx`
    - `src/components/ui/breadcrumb.tsx`
    - `src/components/ui/pagination.tsx`
    - `src/components/ui/avatar.tsx`
    - `src/components/ui/card.tsx`
    - `src/components/ui/alert.tsx`
  - **Do:**
    1. `pnpm dlx shadcn@latest add tabs table scroll-area breadcrumb pagination avatar card alert`.
    2. Alert variants: `default | destructive` plus `info | success | warning` mapped to status tokens (A1 invite failures, A6 partial runs).
    3. Avatar: `src` optional image URL, `alt: string`, fallback initials from `name: string` (first letters of first two words, uppercase). Used by shell UserMenu later.
    4. Pagination primitive is the **page buttons** UI. DataTable (F3.22) composes it for `mode: 'page'` using `page`, `pageSize`, `total` (`pageSize` int min 1 max 100 on list queries). Cursor mode does **not** use offset buttons.
    5. Table: semantic `<table>`; DataTable builds on it. Do not add sorting logic here.
  - **Pattern:** shadcn. Card is the layout card, not `CardVisual` (pattern).
  - **Accept:** `pnpm typecheck`
  - **Notes:** Alert adds info/success/warning status tokens. Avatar composed with `src?`, `alt`, `name` → initials of first two words.

### F3.8 — Toast restyle

- [x] **F3.8** — Toast primitive + restyle F0 host
  - **Files:**
    - `src/components/ui/toast.tsx` (presentational item)
    - `src/client/providers/ToastProvider.tsx` (restyle only)
    - `src/client/providers/toastStore.ts` (**do not change the API**)
  - **Do:**
    1. Keep `toastStore`: `ToastKind = 'success' | 'error' | 'info'`; `Toast = { id: string, kind: ToastKind, message: string }`; methods `success/error/info/dismiss/clear/getSnapshot/subscribe`.
    2. `ToastProvider` already has `aria-live="polite"` and `role="status"` — **keep both**. Replace inline `#111` styles with token classes. Map `kind`: `success` → status-success, `error` → status-danger, `info` → status-info.
    3. Presentational `src/components/ui/toast.tsx`: `{ kind: ToastKind, message: string, onDismiss: () => void }`. Dismiss button `aria-label="Dismiss"`.
    4. `z-index` via `--z-toast` (100). Position: fixed bottom-right, same as F0.
    5. Optional: `pnpm dlx shadcn@latest add sonner` is **forbidden** — do not replace `toastStore` with Sonner.
  - **Pattern:** `src/client/providers/ToastProvider.tsx` + `toastStore.ts` (F0.7). Clipboard already calls `toastStore.success('Copied')` in `src/client/lib/clipboard.ts` — must keep working.
  - **Accept:** `pnpm test client/providers/toast` and `pnpm typecheck`
  - **Notes:** Kept toastStore API. Presentational Toast maps success/error/info to status tokens. `aria-live="polite"` + `role="status"` kept. No Sonner.

### F3.9 — Kitchen sink scaffold

- [x] **F3.9** — `/dev/ui` route, jump nav, theme toggle, fixtures
  - **Files:**
    - `src/app/dev/ui/layout.tsx`
    - `src/app/dev/ui/page.tsx`
    - `src/app/dev/ui/fixtures.ts`
    - `src/app/dev/ui/ThemeToggle.tsx`
    - `src/app/dev/ui/JumpNav.tsx`
  - **Do:**
    1. `layout.tsx`: copy `src/app/dev/shell/layout.tsx` — `if (process.env.NODE_ENV === 'production') notFound()`.
    2. `fixtures.ts`: export the locked fixture objects from F3.0 (healthy/over/zero/full budgets, JPY + USD limits, cards, attributes, rule, timeline items, diffs, DataTable projects). Import enums from `@/shared/enums/*`. Money via integer amounts — never floats.
    3. `ThemeToggle`: `useTheme()` from `next-themes`; buttons Light / Dark / System. `aria-label` on icon-only controls.
    4. `JumpNav`: in-page anchors for categories: `Tokens`, `Primitives`, `Patterns`. Links to `#tokens`, `#primitives`, `#patterns`.
    5. `page.tsx`: `'use client'`. Render jump nav + theme toggle + placeholder `<section id="…">` headings for every primitive and pattern listed in the spec (so later tasks fill sections rather than inventing IA). Do **not** require app auth (dev only). Do **not** import `@/server/*`.
    6. Tokens section: render swatches for every semantic token (status, budget, money) in the current theme — so reviewers see both palettes when they toggle.
  - **Pattern:** `src/app/dev/shell/page.tsx` + `layout.tsx` (F0.14). Fixtures style: `src/client/shell/mockShellData.ts`.
  - **Accept:** `pnpm typecheck && pnpm build`
  - **Notes:** `/dev/ui` production `notFound()`. Locked fixtures in `fixtures.ts`. Placeholder sections for every primitive/pattern. Token swatches + Light/Dark/System toggle.

### F3.10 — MoneyDisplay + StatusBadge

- [x] **F3.10** — `MoneyDisplay` + `StatusBadge`
  - **Files:**
    - `src/components/patterns/MoneyDisplay.tsx`
    - `src/components/patterns/StatusBadge.tsx`
    - `src/components/patterns/moneyDisplay.test.ts` (pure mapping if extracted)
    - `src/components/patterns/statusBadge.test.ts` (exhaustive kind×status → variant)
    - `src/app/dev/ui/page.tsx` (add sections)
  - **Do:**
    1. `MoneyDisplay`: props from `MoneyDisplayProps`. Call `formatMoney` / `formatMoneyCompact` from `src/lib/money.ts`. `colorBySign` default true. Cover USD `{ amount: 402350, currency: 'USD' }` → `$4,023.50` (en-US inside `formatMoney` default locale — do not reformat). Cover JPY `{ amount: 4023, currency: 'JPY' }` (no cents). Negative amount uses `--money-negative`.
    2. `StatusBadge`: switch on `kind`, call F2 label+variant helpers, render `Badge` with that variant. Exhaustive `switch` / `never` default. Tests: every `ProjectStatus`, `CardStatus`, `PurchaseRequestStatus`, `RuleRunStatus` value maps to the F2 variant (table-drive from `src/lib/format/status.ts` — import helpers, assert `StatusBadge` uses the same variant; or unit-test a `statusBadgeVariant(props)` helper).
    3. Kitchen sink: healthy USD, compact USD, JPY, negative remaining, and **every** enum value for all four kinds.
  - **Pattern:** `src/lib/money.ts` (F2.2) + `src/lib/format/status.ts` (F2.7). Badge from F3.2.
  - **Accept:** `pnpm test components/patterns/statusBadge` and `pnpm test components/patterns/moneyDisplay` (if tests exist) and `pnpm typecheck`
  - **Notes:** Helpers in `moneyDisplayMap.ts` / `statusBadgeMap.ts` (avoid macOS case clash with PascalCase components). Exhaustive kind×status via F2 variants.

### F3.11 — BudgetBar

- [x] **F3.11** — `BudgetBar`
  - **Files:**
    - `src/components/patterns/budgetBarLayout.ts`
    - `src/components/patterns/budgetBarLayout.test.ts`
    - `src/components/patterns/BudgetBar.tsx`
    - `src/app/dev/ui/page.tsx` (section)
  - **Do:**
    1. Pure `budgetBarLayout(input: Pick<BudgetBarProps, 'approved' | 'committed' | 'actual' | 'remaining'>): { actualPct: number, committedPct: number, remainingPct: number, overPct: number, isOver: boolean }`:
       - All pcts are ints via `percentOf` from `src/lib/money.ts` (`percentOf(spent, total)` → `0` if `total <= 0`, else `Math.trunc((spent * 100) / total)`).
       - `actualPct = percentOf(actual, approved)` when `approved > 0` else `0`.
       - `committedPct = percentOf(committed, approved)` when `approved > 0` else `0`.
       - `isOver = remaining < 0`.
       - `overPct = isOver ? percentOf(-remaining, approved) : 0` (if `approved <= 0` and `isOver`, `overPct = 100`).
       - `remainingPct`: if `approved > 0` and `remaining > 0`, `percentOf(remaining, approved)`; else `0`.
       - **Do not clamp `remaining` on the props.** Display widths: `actual` + `committed` segments may be scaled so the filled part is `min(100, actualPct + committedPct)` to avoid overflow layout; `overPct` is a separate stripe after the track. Document the scale in a comment.
    2. Tests (required): zero approved / zero spend; zero approved + actual > 0 → `isOver`, `overPct === 100`; full (`remaining === 0`, actual = approved); over-budget fixture (`remaining: -200_000`, approved `1_000_000`); healthy fixture segments sum conceptually to 100.
    3. `BudgetBar` UI: one stacked bar; four labelled figures via `MoneyDisplay` (`approved`, `committed`, `actual`, `remaining`) with `currency`. Tooltip on “Committed”: **“Approved but not yet spent”**. Over: remaining figure uses `colorBySign` (negative) and `--budget-over` stripe. `role="img"` + `aria-label` describing the four numbers.
    4. Kitchen sink: all locked budget fixtures.
  - **Pattern:** `percentOf` in `src/lib/money.ts` (F2.2). Projection shape `budgetProjectionSchema` in `src/shared/schemas/budget.ts` (`remaining` may be negative; never clamp — B4).
  - **Accept:** `pnpm test components/patterns/budgetBarLayout`
  - **Notes:** `percentOf` for segments; remaining not clamped. Fill scaled to min(100, actual+committed). Truncation means healthy sum is 98–100.

### F3.12 — LimitMeter

- [x] **F3.12** — `LimitMeter`
  - **Files:**
    - `src/components/patterns/limitMeterLayout.ts`
    - `src/components/patterns/limitMeterLayout.test.ts`
    - `src/components/patterns/LimitMeter.tsx`
    - `src/app/dev/ui/page.tsx`
  - **Do:**
    1. Pure `limitMeterLayout({ amount, remaining }: { amount: number, remaining: number }): { used: number, usedPct: number, isOver: boolean }`:
       - `used = amount - remaining` (ints).
       - `usedPct = percentOf(used, amount)` (0 if `amount <= 0`; may exceed 100).
       - `isOver = remaining < 0`.
    2. Tests: remaining === amount (used 0); remaining === 0 (full); remaining `< 0`; JPY numbers `500_000` / `120_000`.
    3. UI: label the interval (`PER_TRANSACTION` → “Per transaction”, humanise like F2 status: split `_`, title case). `MoneyDisplay` for remaining vs total. Progress bar from F3.2; `value={Math.min(usedPct, 100)}` but if `isOver` use danger token.
    4. Kitchen sink: empty / full / over / JPY monthly fixture.
  - **Pattern:** F3.11 `budgetBarLayout`; `cardLimitEntrySchema` in `src/shared/schemas/card.ts` (`interval`, `amount` int nonnegative, `remaining` int); `TransactionLimitInterval` in `src/shared/enums/transactionLimitInterval.ts`.
  - **Accept:** `pnpm test components/patterns/limitMeterLayout`
  - **Notes:** used = amount - remaining; usedPct via percentOf (may exceed 100). Interval title-cased from underscores.

### F3.13 — AttributeValue

- [x] **F3.13** — `AttributeValue`
  - **Files:**
    - `src/components/patterns/AttributeValue.tsx`
    - `src/components/patterns/attributeValue.test.ts`
    - `src/app/dev/ui/page.tsx`
  - **Do:**
    1. Stale iff `isStale(observedAt, ttlSec, now)` from `src/lib/dates.ts` (`ttlSec === null` → false; else `Date.parse(observedAt) + ttlSec * 1000 < now`).
    2. Relative time: `formatRelative(observedAt, now)` from `src/lib/dates.ts` — **replace** PartialState’s ad-hoc `Xm ago` when you touch it in F3.19; this component must use F2.
    3. Value rendering: `boolean` → `Yes` / `No`; `null` → `—`; `number` / `string` → `String(value)` plus optional `unit`. Do **not** treat numbers as money unless `unit` is a 3-letter currency **and** `Number.isInteger(value)` — even then prefer showing the literal; **do not** call `formatMoney` unless `unit` length is 3 **and** you document it. Default: literal (campaign.roas `3.2` stays `3.2 x`).
    4. Stale: visible indicator (warning token) + `formatRelative`. Fresh: muted `formatRelative`. `ttlSec === null`: no stale affordance.
    5. Tests: port `isStale` boundaries (null ttl; inside window; expired) with fixed `now`.
    6. Kitchen sink: fresh / stale / ttl-null fixtures.
  - **Pattern:** `isStale` + `formatRelative` in `src/lib/dates.ts` (F2.3). Shape `attributeValueSchema` in `src/shared/schemas/attribute.ts` (`value: number | string | boolean | null`, `observedAt: iso`, `ttlSec: int positive | null`). F0 `PartialState` is the older cousin — do not import its local formatter.
  - **Accept:** `pnpm test components/patterns/attributeValue`
  - **Notes:** Stale via F2 `isStale`; relative via `formatRelative`. Literals only — ROAS `3.2 x`.

### F3.14 — PermissionGate

- [x] **F3.14** — `PermissionGate` + Radix `PermissionTooltip`
  - **Files:**
    - `src/components/patterns/PermissionGate.tsx`
    - `src/components/patterns/permissionGate.test.ts`
    - `src/client/lib/permissions/PermissionTooltip.tsx` (upgrade)
    - `src/app/dev/ui/page.tsx`
  - **Do:**
    1. Extract presentational `PermissionGateView(props: PermissionGateViewProps)` in `PermissionGate.tsx`. When `allowed`, render `children`. When denied, wrap `fallback ?? children` in `Tooltip` with `denialMessage`; if wrapping `children`, set `aria-disabled` / disable buttons rather than hiding (spec: explanatory tooltip when denied — **not** silent `null`). Default denied behaviour **differs from** `RequirePermission` (which defaults to `null`): Gate always explains. Document that in the file header.
    2. `PermissionGate` live: `'use client'`; `useCan(projectId)` from `src/client/lib/permissions/useCan.ts`; `explain(permission, subject, reasons)`; pass into `PermissionGateView`. File header: **UX only, never a control**.
    3. Upgrade `PermissionTooltip` to use `src/components/ui/tooltip.tsx` instead of native `title`. Keep `resolvePermissionTooltipTitle(permission, message?, reasons?)`.
    4. Tests: pure `decidePermissionGateView({ allowed, hasFallback })` analog to `decideRequirePermission` in `RequirePermission.tsx`.
    5. Kitchen sink: use **View** with `allowed: true` (enabled Button “Create card”) and `allowed: false` with `denialMessage: 'Missing card.create'` and `denialMessage: 'Outside your access scope'`. Do not call live `usePermissions` on `/dev/ui`.
  - **Pattern:** `src/client/lib/permissions/RequirePermission.tsx` + `PermissionTooltip.tsx` (F2.5). `explainDenial` copy: `'No access to this project'` / `` `Missing ${permission}` `` / `'Outside your access scope'` from `src/lib/permissions/can.ts` (F2.4). Tooltip from F3.6.
  - **Accept:** `pnpm test components/patterns/permissionGate` and `pnpm test client/lib/permissions`
  - **Notes:** Gate always tooltips on deny (unlike RequirePermission null). PermissionTooltip uses F3 Tooltip. Decision helper in `decidePermissionGate.ts`.

### F3.15 — CardVisual

- [x] **F3.15** — `CardVisual`
  - **Files:**
    - `src/components/patterns/CardVisual.tsx`
    - `src/components/patterns/cardVisual.test.ts`
    - `src/app/dev/ui/page.tsx`
  - **Do:**
    1. Props from `CardVisualProps`. Display `formatMaskedCard(maskedNumber)` from `src/lib/format/cardNumber.ts` (trim only; never pad digits). `StatusBadge kind="card"`. Optional purpose humanised (`SHARED` → “Shared”).
    2. Reveal: Button `variant="ghost"` `aria-label="Reveal card details"` calling `onReveal`. If `onReveal` omitted, hide the button. **Never** render a full number, CVV, or expiry. Add a file header: PAN boundary.
    3. Test (grep-style or unit): the component file must not contain `cvv`, `expiry`, `expiration`, or a 13–19 digit numeric literal. `maskedNumber` example only `************4242`.
    4. Kitchen sink: ACTIVE shared AWS card; PENDING; INACTIVE; CLOSED; FAILED. `onReveal` → `toastStore.info('Reveal opens the Airwallex iframe in A5')`.
  - **Pattern:** `cardSchema` in `src/shared/schemas/card.ts` (`maskedNumber`, `nickName` max 100, `status`, `purpose`). `formatMaskedCard` (F2.7). `panTokenOutput` is **A5**, not this component.
  - **Accept:** `pnpm test components/patterns/cardVisual` and `pnpm typecheck`
  - **Notes:** Masked number via formatMaskedCard. Reveal is callback only. PAN header avoids the forbidden substrings the boundary test greps.

### F3.16 — Timeline

- [x] **F3.16** — `Timeline`
  - **Files:**
    - `src/components/patterns/Timeline.tsx`
    - `src/app/dev/ui/page.tsx`
  - **Do:**
    1. Props from `TimelineProps`. Each item: `formatDateTime(at)` from `src/lib/dates.ts`; `summary`; actor chip.
    2. Distinguish `ActorType`: `USER` vs `RULE` vs `SYSTEM` vs `AIRWALLEX` — different badge/icon (lucide: user, git-branch or zap, cog, credit-card — pick one set and stick). RULE must be visually distinct from USER (A8/A9).
    3. `loading` → `LoadingState`. Empty → `EmptyState` with `empty` props.
    4. Kitchen sink: mixed actor fixtures; loading; empty (“No activity yet”).
  - **Pattern:** `activityItemSchema` in `src/shared/schemas/activity.ts` (`actorType`, `summary` max 500, `at`); `auditEntrySchema` in `src/shared/schemas/auditQuery.ts` (`action` as summary). `ActorType` enum in `src/shared/enums/audit.ts`. Dates F2.3.
  - **Accept:** `pnpm typecheck`
  - **Notes:** Actor chips: User/Zap/Cog/CreditCard. RULE visually distinct (warning). LoadingState/EmptyState from F0 paths.

### F3.17 — RuleSentence + FormulaHighlight

- [x] **F3.17** — `RuleSentence` + `FormulaHighlight`
  - **Files:**
    - `src/components/patterns/RuleSentence.tsx`
    - `src/components/patterns/FormulaHighlight.tsx`
    - `src/app/dev/ui/page.tsx`
  - **Do:**
    1. `RuleSentence`: render `ruleToSentence(rule)` from `src/lib/rules/sentence.ts` as a sentence (`<p>`). Optional `rule.name` as a heading if present. Do not parse/validate.
    2. `FormulaHighlight`: `highlightFormula(expression)` from `src/lib/rules/formulaHighlight.ts`; each token a `<span data-token={type}>` colored via tokens (`ident` → foreground, `number` → info, `op`/`punct` → muted, `unknown` → danger). Do **not** import `src/server/lib/formula/*`.
    3. Kitchen sink: locked freeze-on-utilisation rule; formula e.g. `project.budget.remaining / project.headcount` (display only).
  - **Pattern:** `src/lib/rules/sentence.ts` + `formulaHighlight.ts` (F2.8). Stubs `stubActionForType` / `stubConditionForOperator` in tests/fixtures if constructing actions is awkward.
  - **Accept:** `pnpm typecheck`
  - **Notes:** ruleToSentence + highlightFormula display-only. Token colors via status/muted tokens.

### F3.18 — DiffView

- [x] **F3.18** — `DiffView`
  - **Files:**
    - `src/components/patterns/DiffView.tsx`
    - `src/components/patterns/diffView.test.ts`
    - `src/app/dev/ui/page.tsx`
  - **Do:**
    1. Props `{ before: unknown | null, after: unknown | null }`. If both null, render muted “No changes”.
    2. If values are plain objects, union of keys, sorted; per key show before vs after with `MoneyDisplay` when the value is `{ amount: int, currency: string length 3 }`, else `JSON.stringify` / string. Changed keys use warning/danger tokens; unchanged muted.
    3. Pure helper `diffEntries(before, after): { key: string, before: unknown, after: unknown, changed: boolean }[]` — test: `{ status: 'ACTIVE' }` → `{ status: 'INACTIVE' }` one changed key; identical objects → `changed: false`; `null` before → all keys added.
    4. Kitchen sink: audit status diff; `cardControlsDiffSchema` fixture (show nested JSON is OK).
  - **Pattern:** `auditEntrySchema.before/after` (`z.unknown().nullable()`) in `src/shared/schemas/auditQuery.ts`; `cardControlsDiffSchema` in `src/shared/schemas/ruleRun.ts`.
  - **Accept:** `pnpm test components/patterns/diffView`
  - **Notes:** diffEntries key-union; MoneyDisplay when value is money; changed keys warning tint.

### F3.19 — Restyle F0 states

- [x] **F3.19** — EmptyState, ErrorState, LoadingState, PartialState onto tokens
  - **Files:**
    - `src/components/patterns/EmptyState.tsx` (visual)
    - `src/components/patterns/ErrorState.tsx` (visual)
    - `src/client/states/EmptyState.tsx` (re-export or thin wrap — **keep path**)
    - `src/client/states/ErrorState.tsx`
    - `src/client/states/LoadingState.tsx`
    - `src/client/states/PartialState.tsx`
    - `src/app/dev/ui/page.tsx`
    - `src/app/dev/shell/page.tsx` (must still compile)
  - **Do:**
    1. EmptyState: illustration slot, title, description, primary `Button` for `action`. Tokens only. This is **the** empty pattern.
    2. ErrorState: `role="alert"` kept; Retry `Button` per F3.0 ErrorState rules (`ErrorCode` retryable). Optional `code?: ErrorCode`.
    3. LoadingState: replace `#eee` bars with `Skeleton`; keep `aria-busy`, `aria-label`, `min-height` to avoid shift; `rows` default 3.
    4. PartialState: replace `#888` + local `formatRelative` with `formatRelative` from `src/lib/dates.ts` and muted/warning tokens. Keep props `observedAt`, `staleAfterMs` default `15 * 60_000`, `asOf?`.
    5. `/dev/ui` + `/dev/shell` both show loading/empty/error/partial (fresh + stale). Error kitchen sink: retryable `UPSTREAM_ERROR` with Retry; `NOT_FOUND` without Retry; `PERMISSION_DENIED` without Retry.
  - **Pattern:** F0.13 files + F3 Button/Skeleton. `ErrorCode` in `src/shared/enums/errors.ts`. F0.5 retryable set: `RATE_LIMITED | UPSTREAM_ERROR | INTERNAL`.
  - **Accept:** `pnpm typecheck && pnpm build`
  - **Notes:** Visuals in patterns; F0 paths re-export. Error retry only for omitted code or RATE_LIMITED/UPSTREAM_ERROR/INTERNAL. Loading uses Skeleton. PartialState uses F2 formatRelative.

### F3.20 — ConfirmDialog

- [x] **F3.20** — `ConfirmDialog`
  - **Files:**
    - `src/components/patterns/matchesConfirmPhrase.ts`
    - `src/components/patterns/matchesConfirmPhrase.test.ts`
    - `src/components/patterns/ConfirmDialog.tsx`
    - `src/app/dev/ui/page.tsx`
  - **Do:**
    1. `matchesConfirmPhrase(input: string, phrase: string): boolean` → `input.trim() === phrase.trim()` (case-sensitive). Tests: `'CLOSE'` matches `'CLOSE'`; `'close'` does not; `' CLOSE '` matches `'CLOSE'`.
    2. Dialog from F3.6. Cancel closes. Confirm calls `onConfirm` then caller decides whether to close.
    3. `variant="destructive"` uses destructive Button. `typeToConfirm` shows Input; confirm `disabled` until match **or** `loading`.
    4. Kitchen sink: (a) simple freeze confirm, no type-to-confirm; (b) close card — `title: 'Close card'`, `phrase: 'CLOSE'`, `prompt: 'Type CLOSE to confirm'`, description **must** include that it is irreversible at Airwallex and pending transactions will still clear.
  - **Pattern:** `src/components/ui/dialog.tsx` (F3.6). A5 close: `closeCardInput` `{ confirm: z.literal(true) }` in `src/shared/schemas/card.ts` — this dialog does not POST. A9 closure reuses type-to-confirm.
  - **Accept:** `pnpm test components/patterns/matchesConfirmPhrase`
  - **Notes:** Case-sensitive trim match. Close-card copy: irreversible at Airwallex; pending tx still clear.

### F3.21 — StepWizard

- [x] **F3.21** — `StepWizard`
  - **Files:**
    - `src/components/patterns/StepWizard.tsx`
    - `src/app/dev/ui/page.tsx`
  - **Do:**
    1. Props from `StepWizardProps`. Progress: list of steps with current highlighted; completed steps marked; invalid current step blocks Next (Next `disabled` when `!isStepValid(activeStepId)`).
    2. Back disabled on first step. Next on last step still calls `onNext` (A2 Launch is the last step’s primary — kitchen sink label the last Next as “Continue”; do not invent Launch API).
    3. If `isDirty`, call `useUnsavedChangesGuard(isDirty)` from `src/client/lib/forms/useUnsavedChangesGuard.ts` (browser `beforeunload` only; App Router block is A2).
    4. Kitchen sink: nine A2 steps (`details` … `launch`); mock `isStepValid` true for `details`+`budget`, false for `members` so Next disables there; toggle `isDirty`.
  - **Pattern:** `useUnsavedChangesGuard` (F2.6). A2 wizard steps listed in `docs/phases/app/A2-dashboard-projects.md`. Do not save drafts here (no `PATCH`).
  - **Accept:** `pnpm typecheck`
  - **Notes:** Nine A2 steps. Next disabled when `!isStepValid`. Dirty uses `useUnsavedChangesGuard`. Last Next labelled Continue.

### F3.22 — DataTable

- [x] **F3.22** — `DataTable`
  - **Files:**
    - `src/components/patterns/DataTable.tsx`
    - `src/components/patterns/dataTable.test.ts`
    - `src/app/dev/ui/page.tsx`
  - **Do:**
    1. Implement `DataTableProps<T>` from `types.ts`. Compose `Table`, `Checkbox`, `DropdownMenu`, `Button`, `EmptyState`, `ErrorState`, `LoadingState`, `Pagination` / Load more.
    2. Sorting: only columns with `sortable: true`. Controlled `sorting` + `onSortingChange`. Cycle `null → {id, asc} → {id, desc} → null`. Pure `nextSorting(current, columnId)` tested.
    3. Column visibility: DropdownMenu checkboxes; `hiddenIds` hides columns. Do not hide the selection column.
    4. Row selection: when `rowSelection` passed, leading checkbox column; header checkbox selects all **current rows**.
    5. Pagination: `mode: 'page'` uses `pageNextParam` from `src/lib/pagination.ts` to know if next exists (`page * pageSize < total`); prev when `page > 1`. `mode: 'cursor'`: Button “Load more” when `nextCursor !== null` (`cursorNextParam`).
    6. Toolbar slot only — **no** built-in filter engine.
    7. Kitchen sink: project fixture rows with StatusBadge; page mode (`page: 1, pageSize: 20, total: 3`); a second table in cursor mode with `nextCursor: 'opaque-cursor'` and empty/loading/error states.
  - **Pattern:** `src/lib/pagination.ts` (F2.9); F1 dual pagination (cursor activity/audit; page transactions/rule runs). Table/Pagination from F3.7. Empty/Error/Loading from F3.19.
  - **Accept:** `pnpm test components/patterns/dataTable` and `pnpm typecheck`
  - **Notes:** nextSorting cycle. Dual pagination via pageNextParam/cursorNextParam. Column visibility does not hide selection.

### F3.23 — Restyle AppShell

- [x] **F3.23** — App shell onto tokens
  - **Files:**
    - `src/client/shell/AppShell.tsx`
    - `src/client/shell/SideNav.tsx`
    - `src/client/shell/OrgSwitcher.tsx`
    - `src/client/shell/ProjectContext.tsx`
    - `src/client/shell/UserMenu.tsx`
    - `src/client/shell/ApprovalsBadge.tsx`
    - `src/app/dev/shell/page.tsx` (still works)
  - **Do:**
    1. Replace inline `#ddd` / flex styles with token Tailwind (`border-border`, `bg-background`, `text-foreground`, spacing). **Do not change prop types** from F0.12 (`memberships: { orgId, name, slug }[]`, `user: { name, email, image? }`, `approvalsCount: number` hide at 0, `project: { id, name, code, status } | null`).
    2. Use `Button` / `Avatar` / `DropdownMenu` / `Badge` / `StatusBadge` where they fit. `ProjectContext.status` is a string — if it is a `ProjectStatus`, show `StatusBadge kind="project"`; if not assignable, show muted text (mock may be a string).
    3. No `fetch`, no `call()`, no `@/server/*`.
  - **Pattern:** F0.12 files + F3 primitives. `/dev/shell` is the regression gallery.
  - **Accept:** `pnpm typecheck && pnpm build`
  - **Notes:** Token Tailwind; Select/Avatar/DropdownMenu/Badge/StatusBadge. ProjectStatus → StatusBadge; unknown status muted. `/dev/shell` still works.

### F3.24 — Kitchen sink complete

- [x] **F3.24** — `/dev/ui` every component, every state, both themes
  - **Files:**
    - `src/app/dev/ui/page.tsx`
    - `src/app/dev/ui/sections/*.tsx` (split if `page.tsx` exceeds ~200 lines)
    - `src/app/dev/ui/fixtures.ts` (fill any missing locked fixtures)
  - **Do:**
    1. Primitives: Button (default/hover via CSS/disabled/loading/destructive/icon-with-aria-label), Input (default/disabled/invalid), Textarea, Select, Combobox, Checkbox, Radio, Switch, DatePicker, DateRangePicker, Label, FormField (valid + `VALIDATION_FAILED` message), Dialog, Sheet, Popover, Tooltip, DropdownMenu, Tabs, Table, Badge (all status variants), Avatar, Card, Alert (default/destructive/info/success/warning), Toast (trigger success/error/info via `toastStore`), Skeleton, Progress (0, 50, 100, 125), Separator, ScrollArea, Command, Breadcrumb, Pagination, Spinner.
    2. Patterns: every F3.10–F3.22 component with locked fixtures, including BudgetBar/LimitMeter **boundaries** (zero, full, over), ConfirmDialog type-to-confirm, DataTable empty/loading/error, PermissionGateView allowed/denied, CardVisual statuses, Timeline actor types, both themes via ThemeToggle.
    3. Realistic data only — no lorem ipsum, no `100/100/100` as the sole BudgetBar.
  - **Pattern:** F0.14 `/dev/shell` gallery completeness, scaled up. Fixtures from F3.0.
  - **Accept:** `pnpm typecheck && pnpm build`. Manually: open `/dev/ui` in `pnpm dev` (reviewer). Implementer: do not skip sections — if a primitive is missing from the page, the task is not done.
  - **Notes:** Primitives in `src/app/dev/ui/sections/primitives.tsx`. Patterns remain in PatternGallery (boundaries, ConfirmDialog CLOSE, DataTable empty/loading/error). Realistic fixtures; ThemeToggle for both themes.

### F3.25 — Proofs + Track A walk

- [ ] **F3.25** — No hardcoded colours; a11y smoke; Track A primitive walk
  - **Files:**
    - `src/components/tokens.boundary.test.ts`
    - temporary proof files deleted after
    - `docs/phases/frontend/F3-TASKS.md` Notes on this task (walk result)
  - **Do:**
    1. Vitest (or grep) scan `src/components/**`, `src/client/shell/**`, `src/client/states/**`, `src/app/dev/**` for `#` hex colours, `rgb(`, `hsl(` **literals in className/style**, `bg-red-`, `text-gray-`, `bg-[#`. Allow `src/app/globals.css` (token definitions). Allow `hsl(var(--…))` in CSS files.
    2. Proof: temporary `src/components/ui/_color_proof.tsx` with `className="bg-[#fff]"` must fail the test; delete after.
    3. Confirm one spinner file (`spinner.tsx`), one skeleton (`skeleton.tsx`), dates only via `@/lib/dates` in patterns (grep `toLocaleDateString` in `src/components/patterns` must be empty).
    4. A11y: Dialog/Sheet use Radix (focus trap present). Icon-only buttons in `/dev/ui` have `aria-label`. Toasts keep `aria-live`. Document in Notes any exception.
    5. Walk the F3.0 Track A table: for each cell, name the F3 file that covers it. If a gap exists, **stop and add a line under STATUS.md Decisions pending** — do not invent a new primitive in this task without asking.
    6. ESLint: prove `src/components/_server_proof.ts` importing `@/server/env` fails lint; delete after (copy F0.15).
  - **Pattern:** F0.15 / F2.10 boundary proofs. Track A table in this file’s locked policies.
  - **Accept:** Proof failures observed; proofs deleted; `pnpm test components/tokens.boundary` (or chosen name) green; `pnpm lint` green; `pnpm typecheck`
  - **Notes:** _{filled in on completion — include the A-walk file list}_

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] `/dev/ui` renders every primitive and pattern in default/disabled/loading/error/empty (as applicable) and both themes
- [ ] No hardcoded colours or spacing in components/shell/states/dev — tokens only (F3.25 proof)
- [ ] One spinner, one skeleton style, one date format (`src/lib/dates.ts` en-GB), one empty-state pattern
- [ ] `BudgetBar` and `LimitMeter` correct at zero, full, and over-budget (unit tests)
- [ ] `ConfirmDialog` requires typed confirmation for irreversible close (`CLOSE`)
- [ ] Keyboard-only navigation works on `/dev/ui` (Radix defaults + visible focus rings)
- [ ] Track A walk table filled — no new primitive required
- [ ] Spec’s review checklist in `F3-ui-library.md` signed off
- [ ] `STATUS.md` updated: active phase A1, generate `A1-TASKS.md` when starting A1

## Out of scope (do not do in F3)

- Product screens (A1–A9) other than `/dev/ui` and restyling `/dev/shell`
- Airwallex PAN iframe (A5)
- Animation beyond basic transitions / `animate-spin`
- A published component library
- Renaming F1 hooks or B0–B9 contract fields
- Porting `src/server/lib/formula/*` to the client
- Replacing `toastStore` with Sonner
- Touching PAN/CVV/expiry anywhere
