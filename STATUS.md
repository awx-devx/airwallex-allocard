# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** A1 — Auth & onboarding
**Active task:** A1.3 — Sign-in
**Last green `pnpm verify`:** 2026-08-15 (A1.2)
**Blocked on:** _nothing_

---

## Progress

| Track | Phase                   | Status       | Tasks   |
| ----- | ----------------------- | ------------ | ------- |
| B     | B0 Foundation           | **complete** | 13 / 13 |
| B     | B1 Auth & organisations | **complete** | 15 / 15 |
| B     | B2 Projects             | **complete** | 12 / 12 |
| B     | B3 Access control       | **complete** | 14 / 14 |
| B     | B4 Budget               | **complete** | 16 / 16 |
| B     | B5 Cards                | **complete** | 15 / 15 |
| B     | B6 Rules engine         | **complete** | 15 / 15 |
| B     | B7 Requests & approvals | **complete** | 11 / 11 |
| B     | B8 Money in motion      | **complete** | 11 / 11 |
| B     | B9 Reporting & closure  | **complete** | 11 / 11 |
| F     | F0 Client foundation    | **complete** | 17 / 17 |
| F     | F1 Data layer           | **complete** | 15 / 15 |
| F     | F2 Utils                | **complete** | 11 / 11 |
| F     | F3 UI library           | **complete** | 26 / 26 |
| A     | A1 Auth & onboarding    | in progress  | 3 / 8   |
| A     | A2–A9 Application       | not started  | —       |

A1 **in progress** — A1.2 `/sign-up` landed. Next: A1.3 `/sign-in`. Visual direction: `docs/VISUAL-DIRECTION.md`.

---

## Model assignment

| Phases         | Model      | Why                                                                         |
| -------------- | ---------- | --------------------------------------------------------------------------- |
| B0, B1         | **Strong** | These set the patterns every later phase copies. Get them right.            |
| B2, B4, B7, B9 | Cheap      | Repetitive CRUD following B1's established pattern                          |
| B3, B5, B8     | Mid        | Authorization, external API, and money correctness                          |
| B6             | **Strong** | The rules engine is the product. Non-obvious merge and evaluation semantics |
| F0–F3          | Mid        | Pattern-heavy but decisions are already made                                |
| A1–A9          | Cheap–Mid  | Assembly from existing hooks and components                                 |

---

## Known issues

_None yet._

---

## Decisions pending user review

_None yet._

---

## Notes for the next session

**A1.2 done (2026-08-15).** `/sign-up` with credentials + optional Google; CONFLICT does not confirm the email exists.

**A1.1 done (2026-08-15).** Centred column on `(auth)` / `(onboarding)` / `(invite)`; invite placeholder; ESLint `call()`/`fetch` bans on those globs.

**A1.0 done (2026-08-15).** `src/client/lib/auth.ts` + `src/shared/constants/geo.ts`. Invite `?invite=` wins over `returnTo`; `isSafeCallbackUrl` dest allowlist. STOP for helper-API review before A1.1 screens. `pnpm verify` green (1530 tests).

**A1-TASKS locked (2026-08-15).** Policies approved: no accept-from-fork endpoint (list + email link); geo combobox AU/CA/DE/FR/GB/HK/IE/JP/NL/NZ/SG/US + AUD/CAD/EUR/GBP/HKD/JPY/NZD/SGD/USD; product URL `/invite/[token]` (retarget B1 log in A1.4); preview 404 stays collapsed, distinguishable codes on accept only. AppShell collapse remains A2.

**F3 exit (2026-08-14).** Phase exit + `F3-ui-library.md` review checklist signed off. `pnpm verify` green (1505 tests).

**Visual retune (2026-08-14).** Sharp / glossy / tinted. Recipe: `docs/VISUAL-DIRECTION.md`. `CardVisual` is ID-1 plastic (chip, contactless, aspect 1.586) — masked-only.

**Layout (2026-08-14).** Desktop-first don't-break: `docs/RESPONSIVENESS.md`. **A2 owns `AppShell` collapse** (sidebar → `Sheet`). Invariant 10 in `AGENTS.md`.

**F3.25 done (2026-08-14).** Token boundary test; Track A walk: no new primitive.

**F3.24 done (2026-08-14).** `/dev/ui` primitives in `sections/primitives.tsx`; patterns already in PatternGallery.

**F3.23 done (2026-08-14).** App shell on tokens; StatusBadge for ProjectStatus; `/dev/shell` gallery unchanged in slots.

**F3.22 done (2026-08-14).** DataTable sorting/visibility/selection + dual pagination.

**F3.21 done (2026-08-14).** StepWizard nine A2 steps; dirty guard; Next disabled on invalid.

**F3.20 done (2026-08-14).** ConfirmDialog type-to-confirm CLOSE is case-sensitive.

**F3.19 done (2026-08-14).** Empty/Error/Loading/Partial on tokens; F0 paths re-export.

**F3.18 done (2026-08-14).** DiffView key-by-key; money-aware values.

**F3.17 done (2026-08-14).** RuleSentence + FormulaHighlight (display only).

**F3.16 done (2026-08-14).** Timeline distinguishes USER/RULE/SYSTEM/AIRWALLEX.

**F3.15 done (2026-08-14).** CardVisual masked-only; reveal callback. PAN boundary test.

**F3.14 done (2026-08-14).** PermissionGate always explains denial. PermissionTooltip uses Radix.

**F3.13 done (2026-08-14).** AttributeValue uses F2 isStale/formatRelative.

**F3.12 done (2026-08-14).** LimitMeter empty/full/over + JPY.

**F3.11 done (2026-08-14).** BudgetBar layout via percentOf; remaining not clamped.

**F3.10 done (2026-08-14).** MoneyDisplay + StatusBadge. Helper files `*Map.ts` to avoid case-clash.

**F3.9 done (2026-08-14).** `/dev/ui` scaffold, fixtures, theme toggle. Production `notFound()`.

**F3.8 done (2026-08-14).** Toast restyle onto status tokens; toastStore API unchanged.

**F3.7 done (2026-08-14).** Tabs/Table/ScrollArea/Breadcrumb/Pagination/Avatar/Card/Alert.

**F3.6 done (2026-08-14).** Dialog/Sheet/Tooltip/DropdownMenu. TooltipProvider in AppProviders.

**F3.5 done (2026-08-14).** Date pickers store UTC midnight ISO; display via F2 formatDate/formatRange.

**F3.4 done (2026-08-14).** Combobox = Popover + Command. Dialog arrived as Command dependency.

**F3.3 done (2026-08-14).** Input/Textarea/Label/Checkbox/Radio/Switch/Form. Money: text + parseMoneyInput, never type=number.

**F3.2 done (2026-08-14).** Core primitives. Badge includes StatusVariant tokens. Progress clamps width, danger when > 100. One spinner.

**F3.1 done (2026-08-14).** `ThemeProvider` inside Session / outside Query; `html` has `suppressHydrationWarning`. Visual direction later retuned — see `docs/VISUAL-DIRECTION.md` (not the original quiet-chrome note).

F3.0 done (2026-08-14). Slate tokens + `src/components/patterns/types.ts` reviewed.

F2 complete (2026-08-12). F2 exit: all task checkboxes + `F2-utils.md` review checklist signed off.

F2.0 locked policies (do not reopen) — see `F2-TASKS.md`. Shared currency + scope; `useCan` (not F1 `usePermissions` rename); no `reasons[]` on me/permissions.

F1.0 locked policies (do not reopen):

1. Dual infinite pagination — cursor for activity/audit; page-based for transactions/rule runs; **no** contract migration
2. No browser hooks for webhook, remote-auth decide, attribute ingest
3. Extra endpoint → file table in `F1-TASKS.md` (incl. `useSimulatePurchase` in `useRules.ts`)
4. Spec aliases map to real contracts (`useUpdateCard`, rule CRUD as save-rule invalidation, `useSetBudget` → put, `useSetAttributeValue` → putValue)
5. Extra `qk.*` keys in F1.0; ephemeral mutations in map as `[]`; liberal `cards()` invalidation

F0 phase exit (prior): typed `call()`, `ApiError` behaviours, providers, guards, route groups, shell, states, `/dev/shell`, ESLint boundary + no-fetch proofs. Fetch lint caveat: `no-restricted-syntax` covers `shell/**`, `states/**`, `(app)/**` — empirically `src/client/api/client.ts` + F1 `download.ts` call `fetch`.

B9.0 locked policies (do not reopen):

1. Cursor = opaque `{ at, id }` base64url — never offset on feeds
2. Export `output: z.void()` + streamed `text/csv`
3. Separate `ProjectClosure` collection
4. `CLOSING` only via `/closure/start`
5. Org report single-currency totals; mixed-currency excluded from rollup
6. Preflight fully blocking (`canStart` iff no blockers)
7. Complete needs both confirm literals
8. Access-review HTTP = B3; B9 = sweep only
9. `card.close` from rules requires `params.allowDestructive: true` (else skip; apply belt-and-suspenders)

Carried forward:

- **`TODO(B7)`:** overview approval counts stub to 0 — clear when overview wires B7 queue count
- **`TODO(B8)`:** transactions Airwallex stubs / funding balance — residual stubs OK until live Airwallex
- **Cancel graph:** `CANCELLED` only from `DRAFT`
- **B2 matrix:** `#5` scope and `#9` idempotency N/A
