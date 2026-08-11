# F2 — Utilities & Libraries · Tasks

**Spec:** [F2-utils.md](./F2-utils.md)

**Model:** cheap / LOW — name every file, inline every shape and constraint, copy the cited F0/F1/server file; do not invent screens, redesign F3 components, add a second formula/DSL parser, or change B0–B9 contracts.

**Depends on:** F1, complete and verified

No new domain contracts: F2 builds pure helpers and thin React wrappers on existing `shared` schemas/enums and F1 hooks. The review gate is the locked policies + shared currency/scope extraction below.

---

## F2.0 locked policies (do not reopen)

Approved when F2.0 is reviewed. Implementers follow these; do not re-litigate.

1. **Layout**
   - Pure isomorphic helpers → `src/lib/` (`money.ts`, `dates.ts`, `format.ts`, `pagination.ts`, `rules/`).
   - React-only hooks/components → `src/client/lib/` (`permissions/`, `forms/`, `hooks/`).
   - Add `src/lib/**/*.test.ts` to the Vitest **unit** project `include` in `vitest.config.mts` (today only `src/client/**/*.test.ts` + `src/server/lib/**` are covered).

2. **Currency exponent — single source in shared**
   - Move `ZERO_DECIMAL_CURRENCIES` and `currencyExponent` from `src/server/services/cards/controls.ts` into `src/shared/constants/currency.ts`.
   - Server `controls.ts` imports from shared (keep `minorToMajor` / `majorToMinor` in server controls, calling shared `currencyExponent`).
   - Client money helpers import **only** from `@/shared/constants/currency` — never `@/server/*`.
   - Zero-decimal set (exact copy): `BIF`, `CLP`, `DJF`, `GNF`, `JPY`, `KMF`, `KRW`, `MGA`, `PYG`, `RWF`, `UGX`, `VND`, `VUV`, `XAF`, `XOF`, `XPF`. All other ISO-4217 codes → exponent `2`.

3. **Scope helpers — single source in shared**
   - Move pure `isScopeActive`, `scopeCoversSubject`, and type `PermissionSubject` from `src/server/services/access/computeEffectivePermissions.ts` into `src/shared/access/scope.ts`.
   - Server file re-imports/re-exports them so existing `@/server/services/access/computeEffectivePermissions` imports keep working.
   - Client `can()` uses shared scope helpers — do not duplicate the switch.

4. **Naming: F1 `usePermissions` vs F2 `useCan`**
   - F1’s TanStack query hook `usePermissions()` in `src/client/hooks/useSession.ts` (no args) stays as-is — it loads `GET /api/me/permissions`.
   - F2 ships pure `can(...)` and React hook **`useCan(projectId)`** returning `{ can, ... }`.
   - The F2 spec’s `usePermissions(projectId)` name **maps to `useCan(projectId)`** — do not rename or overload F1.

5. **`reasons[]` without a contract change**
   - `mePermissionsSchema` is `{ projects: [{ projectId, permissions: Permission[], scope: AccessScope }] }` — **no `reasons`**.
   - Do **not** extend `GET /api/me/permissions`.
   - `PermissionTooltip` / `explainDenial`:
     - Prefer optional `reasons?: { permission: Permission; allowed: boolean; message: string min 1 }[]` when the caller has preview output (`previewProjectMemberOutput.reasons`).
     - Otherwise derive a client message from missing permission / `scopeCoversSubject` failure (static copy). Preview UI passes B3 reasons through.

6. **`can()` is UX only**
   - File header on every permissions helper must say: **convenience, never a control**; server `requirePermission` is authoritative.
   - Signature: `can(me: MePermissions, projectId: string, permission: Permission, subject?: PermissionSubject & { callerUserId?: string }): boolean`
   - Logic: find project row → if missing, `false` → if `permission` not in `permissions`, `false` → if `subject` provided, `scopeCoversSubject(scope, subject)` else `true`.
   - Time-window expiry is already applied server-side when building `me/permissions` (empty permissions). Client does not re-run `computeEffectivePermissions`.

7. **Money arithmetic**
   - All display/parse/`percentOf` live only under `src/lib/money.ts`. Screens/components must not divide amounts by 100 or parse floats for money.
   - `moneySchema`: `{ amount: z.number().int(), currency: z.string().length(3) }`.
   - `percentOf(spent: number /* int */, total: number /* int */): number /* int */` → if `total <= 0` return `0`; else `Math.trunc((spent * 100) / total)` (may exceed 100 when overspent).
   - `parseMoneyInput(raw: string, currency: string): Money` — strip grouping separators, parse decimal per `currencyExponent`; reject non-finite / non-integer minor results.

8. **PAN boundary**
   - Card display helper formats **`card.maskedNumber` only** (`z.string().min(1)`, e.g. `************1234`). Never accept, store, log, or synthesise a full PAN/CVV/expiry.

9. **No second formula or DSL parser**
   - Rule sentence renderer + formula highlighter are **display-only**.
   - Validation stays server-side via existing F1 hooks `useValidateRule` / `useValidateFormula`. Do not port `src/server/lib/formula/*` to the client.

10. **CSV download**
    - Re-export / thin-wrap F1’s `downloadExport` from `src/client/api/download.ts`. Do not reimplement fetch/blob logic.

11. **Status helpers are data, not components**
    - F2 exports variant keys + labels. F3 owns `<StatusBadge>` visuals / tokens.

12. **`isStale` semantics** (match server attribute resolve — copy, do not import server):
    - `isStale(observedAt: string /* ISO */, ttlSec: number | null, now?: Date): boolean`
    - `ttlSec === null` → `false`
    - else `Date.parse(observedAt) + ttlSec * 1000 < (now ?? new Date()).getTime()`

---

## Review gate

- [x] **F2.0** — Shared currency + scope extraction + Vitest include (STOP for review)
  - **Files:**
    - `src/shared/constants/currency.ts`
    - `src/shared/constants/currency.test.ts`
    - `src/shared/access/scope.ts`
    - `src/shared/access/scope.test.ts`
    - `src/server/services/cards/controls.ts` (import shared currency; delete local `ZERO_DECIMAL_CURRENCIES` / `currencyExponent` definitions)
    - `src/server/services/access/computeEffectivePermissions.ts` (import shared scope helpers; keep `computeEffectivePermissions` here)
    - `vitest.config.mts` (add `src/lib/**/*.test.ts` **and** `src/shared/constants/**/*.test.ts` + `src/shared/access/**/*.test.ts` to unit `include`, or a single `src/shared/{constants,access}/**/*.test.ts` + `src/lib/**/*.test.ts`)
  - **Do:**
    1. Implement F2.0 locked policies **#2** and **#3** exactly.
    2. `currency.ts` exports:
       - `ZERO_DECIMAL_CURRENCIES: ReadonlySet<string>` (the 16 codes listed in policy #2)
       - `currencyExponent(currency: string): 0 | 2` — uppercases before lookup
    3. `scope.ts` exports (byte-for-byte behaviour from current server file):
       - `PermissionSubject`: `{ cardId?: string, workstreamId?: string, categoryId?: string, userId?: string, callerUserId?: string }`
       - `isScopeActive(scope: AccessScope, now: Date): boolean` — inclusive `[validFrom, validTo]`; missing bounds open; invalid ISO → treat bound as null/open
       - `scopeCoversSubject(scope: AccessScope, subject: PermissionSubject): boolean` — switch on `AccessScopeLevel`: `PROJECT` → true; `WORKSTREAM` / `CATEGORY` / `CARD` / `ASSIGNED_MEMBERS` require id in the matching array; `OWN` requires `userId === callerUserId` both defined
    4. Port the **scopeCoversSubject / time-window** cases from `src/server/services/access/computeEffectivePermissions.test.ts` (OWN/CARD/WORKSTREAM/CATEGORY/ASSIGNED_MEMBERS/PROJECT + validFrom/validTo bounds) into `src/shared/access/scope.test.ts` so client and server cannot drift.
    5. Existing server tests must still pass unchanged in behaviour (`pnpm test access/computeEffectivePermissions`, `pnpm test services/cards` or whatever covers `controls.ts` major/minor).
  - **Pattern:** Move style of F0.0 (lift shared schema) + current implementations in `controls.ts` / `computeEffectivePermissions.ts`. Copy fixture tables from `computeEffectivePermissions.test.ts` lines covering `scopeCoversSubject` and time windows.
  - **STOP and get this reviewed before implementing F2.1+.**
  - **Accept:** `pnpm test shared/constants/currency` and `pnpm test shared/access/scope` and `pnpm test access/computeEffectivePermissions` and `pnpm typecheck`
  - **Notes:** Shared currency + scope extracted; server re-exports. Vitest unit include covers `src/lib/**`, `src/shared/constants/**`, `src/shared/access/**`. Continued past review gate per user request to complete all F2 tasks before phase exit.

---

## Implementation tasks

### F2.1 — Client form deps

- [x] **F2.1** — Add React Hook Form + Zod resolver
  - **Files:** `package.json`, `pnpm-lock.yaml`
  - **Do:**
    1. Add `react-hook-form` (current major compatible with React 19).
    2. Add `@hookform/resolvers` major that supports **Zod 4** (`zod` is already `^4.4.3` in package.json). If the resolver API for Zod 4 differs from Zod 3, follow the package docs for `zodResolver` — do not pin an ancient Zod 3-only resolver.
    3. Do **not** add UI libraries (F3), date-fns, or i18n frameworks — use `Intl.*`.
  - **Pattern:** F0.1 / F1 deps style in `package.json` (F0.1 added `@tanstack/react-query` the same way)
  - **Accept:** `pnpm install` succeeds; `pnpm typecheck`
  - **Notes:** `react-hook-form` 7.85.0 + `@hookform/resolvers` 5.7.1 (`zodResolver` present).

### F2.2 — Money helpers

- [x] **F2.2** — `src/lib/money.ts`
  - **Files:** `src/lib/money.ts`, `src/lib/money.test.ts`
  - **Do:**
    1. Import `Money` / `moneySchema` types from `@/shared/schemas/base` (`{ amount: number int, currency: string length 3 }`) and `currencyExponent` from `@/shared/constants/currency`.
    2. Export:
       | Function                        | Signature / behaviour                                                                                                                                                                                                                                                                                                                                                       |
       | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
       | `formatMoney`                   | `(money: Money, locale?: string) => string` — `Intl.NumberFormat(locale, { style: 'currency', currency })` on **major** units (`amount / 10^exponent`). Example: `{ amount: 402350, currency: 'USD' }` → `"$4,023.50"` (en-US). JPY `{ amount: 4023, currency: 'JPY' }` → no cents.                                                                                         |
       | `formatMoneyCompact`            | `(money: Money, locale?: string) => string` — compact notation (`notation: 'compact'`, `compactDisplay: 'short'`) on major units. Example USD `402350` → roughly `"$4.0K"` / `"$4.02K"` (assert with `Intl` for `en-US`; allow implementation to set `maximumFractionDigits` 1–2).                                                                                          |
       | `parseMoneyInput`               | `(raw: string, currency: string) => Money` — trim; remove spaces and `,` grouping; accept `.` decimal separator for exponent-2; for exponent-0 reject a fractional part (or truncate only if you document — **prefer reject** with throw). Convert major → minor via `Math.round(major * 10^exp)` / identity for exp 0. Throw `Error` with stable message on empty/invalid. |
       | `percentOf`                     | `(spent: number, total: number) => number` — both ints; policy #7.                                                                                                                                                                                                                                                                                                          |
       | `majorToMinor` / `minorToMajor` | Optional thin wrappers using shared exponent — **if** exported, must match server `controls.ts` maths (`Math.round` on major→minor). Prefer exporting so UI inputs and Airwallex mapping stay aligned.                                                                                                                                                                      |
    3. Tests (required):
       - USD / EUR round-trip `parseMoneyInput(formatMoney(...).replace($,), currency)` for a fixture set
       - JPY and KRW: exponent 0 — `formatMoney({ amount: 1234, currency: 'JPY' })` has no `.`; `parseMoneyInput('1234', 'JPY').amount === 1234`
       - `percentOf(1, 0) === 0`; `percentOf(50, 200) === 25`; `percentOf(250, 200) === 125`
       - No `parseFloat` on the amount field itself in implementation (search the file)
  - **Pattern:** Pure-function module + vitest like `src/client/api/errorBehaviour.ts` + `errorBehaviour.test.ts` (F0.5). Currency list from F2.0 `src/shared/constants/currency.ts`. Server maths reference: `src/server/services/cards/controls.ts` `minorToMajor` / `majorToMinor`.
  - **Accept:** `pnpm test lib/money`
  - **Notes:** Implemented; USD/JPY/KRW + percentOf + round-trip; `pnpm verify` green.

### F2.3 — Date helpers

- [ ] **F2.3** — `src/lib/dates.ts`
  - **Files:** `src/lib/dates.ts`, `src/lib/dates.test.ts`
  - **Do:**
    1. Everything takes **ISO 8601 strings** on the wire (`isoDateSchema` = `z.string().datetime()`), matching shared contracts.
    2. Export (default locale `en-GB` or `en-US` — pick **one**, document in file header, use consistently; tests lock the choice):
       | Function                                                          | Behaviour                                                                                                                                                            |
       | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
       | `formatDate(iso: string, locale?: string)`                        | Calendar date only via `Intl.DateTimeFormat` (e.g. `1 Aug 2026`)                                                                                                     |
       | `formatDateTime(iso: string, locale?: string)`                    | Date + time                                                                                                                                                          |
       | `formatRelative(iso: string, now?: Date)`                         | Human relative past/future — e.g. `"15 minutes ago"`. Prefer `Intl.RelativeTimeFormat`. Used for attribute `observedAt`.                                             |
       | `formatRange(fromIso: string, toIso: string, locale?: string)`    | e.g. `"1 Aug – 31 Dec 2026"` (en dash). Same year → omit year on the first date when that is `Intl`/`formatRange` idiomatic; tests may assert a fixed locale string. |
       | `daysRemaining(iso: string, now?: Date)`                          | Whole days from `now` to end of calendar day of `iso` (or trunc day-diff); document formula in comment. Negative if past.                                            |
       | `isStale(observedAt: string, ttlSec: number \| null, now?: Date)` | Policy #12 — identical to `src/server/services/attributes/resolve.ts`                                                                                                |
    3. Tests: `isStale` boundaries from `src/server/services/attributes/resolve.test.ts` (`ttlSec: null` → false; expired → true; inside window → false). Relative/range smoke tests with fixed `now`.
    4. Do **not** change `src/client/states/PartialState.tsx` in this task (optional later consumer).
  - **Pattern:** `src/lib/money.ts` (F2.2) for module shape; semantics copy `src/server/services/attributes/resolve.ts` `isStale`. Relative display inspiration: local helper in `src/client/states/PartialState.tsx` (F0) — replace ad-hoc maths with `Intl`, do not import PartialState.
  - **Accept:** `pnpm test lib/dates`
  - **Notes:** _{filled on completion}_

### F2.4 — Pure `can()` + denial explanation

- [ ] **F2.4** — `src/lib/permissions/can.ts`
  - **Files:**
    - `src/lib/permissions/can.ts`
    - `src/lib/permissions/can.test.ts`
    - `src/lib/permissions/explainDenial.ts` (or same file)
    - `src/lib/permissions/explainDenial.test.ts` (or combined)
  - **Do:**
    1. File header comment (required): **Client `can()` is a convenience for UX only — never a security control. The server `requirePermission` is authoritative.**
    2. Types from shared:
       - `MePermissions` = `z.infer<typeof mePermissionsSchema>` from `@/shared/types/mePermissions` — `{ projects: { projectId: string, permissions: Permission[], scope: AccessScope }[] }`
       - `Permission` from `@/shared/enums/permissions`
       - `AccessScope` = `{ level: AccessScopeLevel, workstreamIds?: string[], categoryIds?: string[], cardIds?: string[], memberIds?: string[], validFrom?: ISO, validTo?: ISO }`
       - `PermissionSubject` from `@/shared/access/scope`
    3. `can(me, projectId, permission, subject?): boolean` — policy #6.
    4. `explainDenial(me, projectId, permission, subject?, reasons?: PermissionReason[]): string`:
       - If `reasons` provided, use the matching `permission` entry’s `message` when `allowed === false`
       - Else if project missing: `'No access to this project'`
       - Else if permission missing from list: `` `Missing ${permission}` ``
       - Else if subject fails scope: `'Outside your access scope'` (or more specific per level — keep stable strings tested)
    5. Tests **reuse B3 fixture tables** (copy data, import shared helpers — do not import `@/server/*`):
       - From `computeEffectivePermissions.test.ts`: CARD scope permits `card_x` denies `card_y` with same permission list; OWN caller match/mismatch; WORKSTREAM/CATEGORY/ASSIGNED_MEMBERS allowlist; PROJECT covers any subject.
       - Build `MePermissions` rows manually: `{ projectId: 'p1', permissions: [Permission.CARD_MANAGE, ...], scope: { level: CARD, cardIds: ['card_x'] } }` then assert `can(...)` true/false.
  - **Pattern:** Pure module like F2.2; fixtures from `src/server/services/access/computeEffectivePermissions.test.ts` (F2.0 moved helpers). Me shape from `src/shared/schemas/mePermissions.ts`. F1 data loader remains `usePermissions` in `src/client/hooks/useSession.ts`.
  - **Accept:** `pnpm test lib/permissions`
  - **Notes:** _{filled on completion}_

### F2.5 — `useCan` + permission wrappers

- [ ] **F2.5** — React `useCan` + `<RequirePermission>` + `<PermissionTooltip>`
  - **Files:**
    - `src/client/lib/permissions/useCan.ts`
    - `src/client/lib/permissions/useCan.test.ts`
    - `src/client/lib/permissions/RequirePermission.tsx`
    - `src/client/lib/permissions/PermissionTooltip.tsx`
    - `src/client/lib/permissions/index.ts`
  - **Do:**
    1. `useCan(projectId: string)`:
       - Call F1 `usePermissions()` from `@/client/hooks/useSession` (the **query** hook).
       - Return `{ can: (permission: Permission, subject?: PermissionSubject) => boolean, explain: (permission, subject?, reasons?) => string, isLoading: boolean, isError: boolean, me: MePermissions | undefined }`.
       - `can` / `explain` close over `me` data; if `me` undefined, `can` → `false`.
    2. `<RequirePermission projectId permission subject? reasons? fallback? children>`:
       - If `can(permission, subject)` → render `children`
       - Else → render `fallback` if provided, else `<PermissionTooltip …>` wrapping a disabled/aria-disabled stub **or** `null` — pick **fallback default = null** and document; tooltip used when `fallback` is the disabled control pattern in F3.
       - Keep this thin — F3 `PermissionGate` may compose these later. No design tokens / no Tailwind inventiveness.
    3. `<PermissionTooltip permission message? reasons? children>`:
       - Renders `children` with a native `title={message ?? explain…}` **or** a simple `<span title=…>` wrapper — no Radix until F3. Must surface denial text from policy #5.
    4. Re-export from `src/client/lib/permissions/index.ts`.
    5. Tests: prefer testing pure options / wrapping `can` with mocked `me` data without full RTL if possible (same spirit as F1.1 `useCall` tests). If a hook test needs React, use the lightest approach already in repo — **do not** add `@testing-library/react` unless unavoidable; prefer exporting `buildCanFromMe(me)` used by the hook.
  - **Pattern:** Hook wiring like `src/client/hooks/useSession.ts` (F1.3) + `src/client/hooks/useCall.ts` (F1.1). Presentational thinness like `src/client/states/EmptyState.tsx` / `PartialState.tsx` (F0). Pure logic from F2.4.
  - **Accept:** `pnpm test client/lib/permissions`
  - **Notes:** _{filled on completion}_

### F2.6 — Forms: Zod RHF + server errors + dirty guard

- [ ] **F2.6** — `useZodForm` + `applyServerErrors` + unsaved-changes guard
  - **Files:**
    - `src/client/lib/forms/useZodForm.ts`
    - `src/client/lib/forms/useZodForm.test.ts`
    - `src/client/lib/forms/applyServerErrors.ts`
    - `src/client/lib/forms/applyServerErrors.test.ts`
    - `src/client/lib/forms/useUnsavedChangesGuard.ts`
    - `src/client/lib/forms/useUnsavedChangesGuard.test.ts`
    - `src/client/lib/forms/index.ts`
  - **Do:**
    1. `useZodForm<TSchema extends ZodType>(schema: TSchema, options?: Omit<UseFormProps<z.infer<TSchema>>, 'resolver'>)`:
       - Returns `useForm({ ...options, resolver: zodResolver(schema) })`.
       - **Schemas are imported from `@/shared/schemas/*` by callers** — this helper must not redefine input shapes.
       - Smoke-test with `createProjectInput` from `src/shared/schemas/project.ts`: `{ name: string min 1 max 120, code: regex alphanumeric+hyphens min 1 max 64, description?: max 2000, ownerId?, costCentre?, startDate?, endDate?, cardStructure?: partial { shared, perMember, vendor, oneTime booleans } }`.
    2. `applyServerErrors(form: UseFormReturn<FieldValues>, details: unknown): void`:
       - Read `fieldErrors` the same way as `readFieldErrors` in `src/client/api/errorBehaviour.ts` (F0.5): `details.fieldErrors` is `Record<string, string[]>` (skip non-string arrays).
       - For each path, `form.setError(path, { type: 'server', message: messages[0] ?? 'Invalid' })`.
       - Nested paths: support dot paths Zod/server emit (e.g. `cardStructure.shared`, `desiredControls.transactionLimits.limits.0.amount`) via RHF’s `Path` string — `setError('a.b' as Path, …)`.
       - Also accept an `ApiError` and use `resolveErrorBehaviour`; only apply when `type === 'field-errors'`.
    3. `useUnsavedChangesGuard(isDirty: boolean)`:
       - When `isDirty`, register `window` `beforeunload` handler (return string / set `event.returnValue`).
       - Cleanup on unmount or when `isDirty` becomes false.
       - Document: Next.js App Router block is out of scope until A2 wizard; this is the browser-tab guard only.
    4. Barrel `src/client/lib/forms/index.ts`.
  - **Pattern:** F0.5 `src/client/api/errorBehaviour.ts` for fieldErrors parsing; F2.1 deps; schema source `src/shared/schemas/project.ts` (`createProjectInput`). Hook file style `src/client/hooks/useCall.ts` (F1.1).
  - **Accept:** `pnpm test client/lib/forms`
  - **Notes:** _{filled on completion}_

### F2.7 — Formatting & display helpers

- [ ] **F2.7** — `src/lib/format.ts` (+ MCC/country tables)
  - **Files:**
    - `src/lib/format/status.ts`
    - `src/lib/format/status.test.ts`
    - `src/lib/format/mcc.ts`
    - `src/lib/format/mcc.test.ts`
    - `src/lib/format/country.ts`
    - `src/lib/format/country.test.ts`
    - `src/lib/format/merchant.ts`
    - `src/lib/format/merchant.test.ts`
    - `src/lib/format/cardNumber.ts`
    - `src/lib/format/cardNumber.test.ts`
    - `src/lib/format/truncate.ts`
    - `src/lib/format/truncate.test.ts`
    - `src/lib/format/index.ts`
  - **Do:** Split if a single `format.ts` would exceed ~200 lines — barrel via `index.ts`. Implement:
    1. **Status** — for each enum value, export `statusLabel` + `statusVariant`:
       | Enum                    | File source                                                                                                               | Variants allowed                                            |
       | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
       | `ProjectStatus`         | `src/shared/enums/projectStatus.ts` — `DRAFT`, `PENDING_APPROVAL`, `ACTIVE`, `CLOSING`, `CLOSED`, `ARCHIVED`, `CANCELLED` | `'neutral' \| 'info' \| 'success' \| 'warning' \| 'danger'` |
       | `CardStatus`            | `src/shared/enums/cardStatus.ts` — `PENDING`, `ACTIVE`, `INACTIVE`, `CLOSED`, `BLOCKED`, `LOST`, `STOLEN`, `FAILED`       | same                                                        |
       | `PurchaseRequestStatus` | `src/shared/enums/purchaseRequestStatus.ts` — `DRAFT`, `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `CANCELLED`          | same                                                        |
       | `RuleRunStatus`         | `src/shared/enums/ruleRunStatus.ts` — `SUCCESS`, `PARTIAL`, `FAILED`, `SKIPPED`, `DRY_RUN`                                | same                                                        |
       - Exhaustive `switch` / `satisfies Record<Enum, …>` so a new enum member fails typecheck.
       - Labels: humanise (`PENDING_APPROVAL` → `"Pending approval"`).
       - Variant mapping (lock): ACTIVE/APPROVED/SUCCESS → `success`; DRAFT/PENDING/PENDING_APPROVAL/DRY_RUN → `info`; CLOSING/PARTIAL/INACTIVE → `warning`; CLOSED/ARCHIVED/CANCELLED/REJECTED/EXPIRED/FAILED/BLOCKED/LOST/STOLEN/SKIPPED → `danger` or `neutral` (CLOSED/ARCHIVED → `neutral`; destructive failures → `danger`). Document the table in the file; tests lock every key.
    2. **MCC** — `mccLabel(code: string): string`. Curated map covering seed/demo codes at minimum: `5411`, `5812`, `7995`, `4111`, `3000`–range optional. Unknown → `` `MCC ${code}` ``. Codes are strings (leading zeros) per `merchant.mcc: z.string().min(1).max(8)`.
    3. **Country** — `countryName(iso2: string, locale?: string): string` via `Intl.DisplayNames(locale, { type: 'region' })`. Invalid → return the raw code.
    4. **Merchant** — `normaliseMerchantName(name: string): string` — trim; collapse internal whitespace; optional Title Case for all-caps tokens longer than 3 chars; do not invent legal names.
    5. **Card number** — `formatMaskedCard(maskedNumber: string): string` — policy #8; pass-through/trim; optionally group for display; **never** pad fake digits. Input is `card.maskedNumber` only.
    6. **Truncate** — `truncate(text: string, maxLen: number): { text: string, truncated: boolean, title: string }` — if `text.length <= maxLen` return as-is with `truncated: false` and `title: text`; else slice to `maxLen - 1` + `…`, `truncated: true`, `title: text` (for `title` attribute).
  - **Pattern:** Exhaustive enum maps like F0.5’s `ErrorCode` switch; money purity like F2.2. Merchant/MCC appear on `transaction.merchant` in `src/shared/schemas/transaction.ts` (`name`, `mcc` max 8, `country` — typically ISO2).
  - **Accept:** `pnpm test lib/format`
  - **Notes:** _{filled on completion}_

### F2.8 — Rules helpers (sentence + labels + highlighter)

- [ ] **F2.8** — Rule DSL display helpers (no parser)
  - **Files:**
    - `src/lib/rules/operators.ts`
    - `src/lib/rules/operators.test.ts`
    - `src/lib/rules/attributes.ts`
    - `src/lib/rules/attributes.test.ts`
    - `src/lib/rules/sentence.ts`
    - `src/lib/rules/sentence.test.ts`
    - `src/lib/rules/formulaHighlight.ts`
    - `src/lib/rules/formulaHighlight.test.ts`
    - `src/lib/rules/index.ts`
  - **Do:**
    1. **Operator labels** — map every `ConditionOperator` from `src/shared/enums/conditionOperator.ts`:
       `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `in`, `nin`, `contains`, `between`, `changedBy`, `crossedBelow`, `crossedAbove` → readable phrases (`"equals"`, `"does not equal"`, `"is greater than"`, `"crosses below"`, …). Exhaustive.
    2. **Action labels** — map every `RuleActionType` from `src/shared/enums/ruleActionType.ts`:
       `card.create`, `card.setControls`, `card.freeze`, `card.unfreeze`, `card.close`, `access.grant`, `access.revoke`, `access.expire`, `budget.allocate`, `approval.require`, `notify`, `flag.review` → short imperative phrases (`"freeze card(s)"`, …). Exhaustive.
    3. **Attribute labels** — `attributeLabel(key: string): string` for built-ins listed in `docs/RULES-ENGINE.md` §2 (e.g. `project.budget.remaining` → `"remaining budget"`, `campaign.roas` → `"campaign ROAS"`). Unknown key → prettify last segment / return key.
    4. **Sentence renderer** — `ruleToSentence(rule: Pick<Rule, 'when' | 'then' | 'else' | 'name'> | { when: Condition; then: RuleAction[]; else?: RuleAction[] }): string`:
       - Input shapes from `src/shared/schemas/rule.ts`:
         - `Condition`: exactly one of `all[]`, `any[]`, `not`, `attr+op+value`, `expr` (string max 500)
         - `conditionValue`: literal | literal[] | `{ attr: string min 1 }`
         - `RuleAction`: `{ action: RuleActionType, target: { select: RuleTargetSelect, filter?, memberIds?, roleKeys?, cardId? }, params: ruleControlsParamsSchema }`
       - Render readable English, e.g. attr `project.budget.utilisationPct` + `crossedBelow` + `10` + then `card.freeze` targeting member cards → roughly: `"When remaining budget utilisation crosses below 10%, freeze member cards"`.
       - Cover **every** `ConditionOperator` and **every** `RuleActionType` in tests (minimal stub condition/action per op/action). Nested `all`/`any`/`not` smoke-tested once each.
       - **Do not validate** the tree — garbage-in may produce awkward English; that is fine.
    5. **Formula highlighter** — `highlightFormula(expression: string): { type: 'number' \| 'ident' \| 'op' \| 'punct' \| 'ws' \| 'unknown'; value: string }[]`:
       - Display tokenizer only (policy #9). Tokenise numbers, identifiers (`a.b`), `+ - * / ( ) ,`, whitespace.
       - Must **not** evaluate or import `src/server/lib/formula/*`.
  - **Pattern:** Enum exhaustiveness like F2.7 status maps; rule shapes from `src/shared/schemas/rule.ts`. F1 validation hooks stay the authority (`src/client/hooks/useRules.ts` — `useValidateRule` / `useValidateFormula`).
  - **Accept:** `pnpm test lib/rules`
  - **Notes:** _{filled on completion}_

### F2.9 — Misc hooks & pagination helpers

- [ ] **F2.9** — Pagination, clipboard, debounce/throttle, disclosure; CSV re-export
  - **Files:**
    - `src/lib/pagination.ts`
    - `src/lib/pagination.test.ts`
    - `src/client/lib/hooks/useDebouncedValue.ts`
    - `src/client/lib/hooks/useDebouncedValue.test.ts`
    - `src/client/lib/hooks/useThrottledCallback.ts`
    - `src/client/lib/hooks/useThrottledCallback.test.ts`
    - `src/client/lib/hooks/useDisclosure.ts`
    - `src/client/lib/hooks/useDisclosure.test.ts`
    - `src/client/lib/clipboard.ts`
    - `src/client/lib/clipboard.test.ts`
    - `src/client/lib/hooks/index.ts`
    - `src/client/lib/index.ts` (optional root barrel)
  - **Do:**
    1. **Pagination** (pure) — extract the dual F1 styles into one module:
       - `cursorNextParam(last: { nextCursor: string | null }): string | undefined` — `last.nextCursor ?? undefined` (copy from `src/client/hooks/useReports.ts` F1.12)
       - `pageNextParam(last: { page: number, pageSize: number, total: number }): number | undefined` — `last.page * last.pageSize < last.total ? last.page + 1 : undefined` (copy from `src/client/hooks/useRules.ts` / `useTransactions.ts` F1.9–F1.11)
       - Do **not** require refactoring existing F1 hooks in this task (optional follow-up); new Track A code should import from here.
    2. **CSV** — from `src/client/lib/index.ts` or `src/client/lib/download.ts`, re-export `downloadExport`, `ExportKind` from `@/client/api/download` (F1.1). No new fetch logic.
    3. **Clipboard** — `copyToClipboard(text: string): Promise<boolean>`:
       - `navigator.clipboard.writeText` when available; fallback `document.execCommand('copy')` only if needed.
       - On success call `toastStore.success('Copied')` from `src/client/providers/toastStore.ts` (F0); on failure `toastStore.error('Copy failed')`.
       - Return boolean success.
    4. **`useDebouncedValue<T>(value: T, delayMs: number): T`** — standard debounce; default delay `300` if you provide an overload; clear timer on unmount.
    5. **`useThrottledCallback<A extends unknown[]>(fn, intervalMs)`** — leading throttle; stable return reference where easy without fighting the compiler.
    6. **`useDisclosure(initial = false)`** → `{ isOpen: boolean, onOpen: () => void, onClose: () => void, onToggle: () => void, setOpen: (v: boolean) => void }`.
  - **Pattern:** Pagination copy from `src/client/hooks/useReports.ts` + `useRules.ts` (F1). Toast from `src/client/providers/toastStore.ts` (F0). Download from `src/client/api/download.ts` (F1.1). Hook style from `src/client/hooks/useCall.ts` (F1.1).
  - **Accept:** `pnpm test lib/pagination` and `pnpm test client/lib`
  - **Notes:** _{filled on completion}_

### F2.10 — Root barrels + no money maths outside `src/lib/money`

- [ ] **F2.10** — Public barrels + lint/proof that money maths stay centralised
  - **Files:**
    - `src/lib/index.ts`
    - `src/client/lib/index.ts`
    - `eslint.config.mjs` (optional small extend)
    - temporary proof files deleted after
  - **Do:**
    1. `src/lib/index.ts` re-exports public pure helpers: money, dates, format, pagination, permissions/can, rules.
    2. `src/client/lib/index.ts` re-exports forms, permissions React API, hooks, clipboard, download re-export.
    3. Add an ESLint `no-restricted-syntax` **or** a vitest proof under `src/lib/money.boundary.test.ts` that fails if any file matching `src/client/shell/**`, `src/client/states/**`, `src/app/(app)/**` contains `parseFloat(` applied to amounts **or** literal `/ 100` next to `currency` — keep the rule practical; if ESLint is too noisy, a documented grep-based test that scans those globs for `/ 100` and `parseFloat` is enough for F2.
    4. Proof: temporary bad file under `src/client/shell/` with `parseFloat(amount)` must fail the check; delete after.
    5. Do **not** ban `/ 100` inside `src/lib/money.ts` or `src/server/**` or `src/shared/constants/currency.ts`.
  - **Pattern:** F1.13 barrel + ESLint proof in `docs/phases/frontend/F1-TASKS.md`; F0.15 boundary proofs.
  - **Accept:** Proof failure observed; proofs deleted; `pnpm lint` / boundary test green; `pnpm typecheck`
  - **Notes:** _{filled on completion}_

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] No money arithmetic outside `src/lib/money.ts` (and server Airwallex mapping)
- [ ] Zero-decimal currencies handled via shared `currencyExponent`
- [ ] Form schemas imported from `shared`, never redefined in client forms
- [ ] `can()` / `useCan` documented as non-authoritative
- [ ] `can()` tested against the same scope fixtures as B3 (`scopeCoversSubject` cases)
- [ ] No second formula or DSL parser in the client
- [ ] Every helper shipped here has a test
- [ ] Spec’s review checklist in `F2-utils.md` signed off
- [ ] `STATUS.md` updated: active phase F3, generate `F3-TASKS.md` when starting F3

## Out of scope (do not do in F2)

- shadcn / design tokens / kitchen sink (F3)
- Product screens (Track A)
- Renaming F1 `usePermissions` query hook
- Extending `GET /api/me/permissions` with `reasons[]`
- Porting `src/server/lib/formula/*` to the client
- Refactoring all F1 hooks to import `src/lib/pagination` (optional later)
- Changing B0–B9 contract field names
- Touching PAN/CVV/expiry anywhere
