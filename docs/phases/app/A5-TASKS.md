# A5 — Cards · Tasks

**Spec:** [A5-cards.md](./A5-cards.md)
**Model:** cheap / LOW — name every file, inline every field with type and constraints, copy the cited A4/A3/A2/F1/B5 file; do not invent endpoints, change B5–B9 contracts, add primitives, reopen AppShell collapse, or hide a control without a Sheet/menu replacement.
**Depends on:** A4, complete and verified

No new API contracts. B5 already shipped `cardContracts` + `cardholderContracts`. B8 already shipped `transactionContracts.listForCard`. The review gate is the policies + helper shapes below.

**Powers:** B5 (and B8 card transactions for the detail feed) · **Hooks (F1, already exist):** `useCards`, `useProjectCards`, `useCard`, `useCreateCard` (**do not call from A5 screens**), `useUpdateCard`, `useFreezeCard`, `useUnfreezeCard`, `useCloseCard`, `useCardLimits`, `usePanToken`, `useReconcileCard`, `useCardholders`, `useCardholder`, `useCardTransactions`, `useProjects`, `useProject`, `useProjectMembers`, `useOrgMembers`, `useMe`, `useCan` · **Guards (F0, already exist):** `requireApp` on `(app)/layout.tsx`

Recipe: [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Visual tokens: [`../../VISUAL-DIRECTION.md`](../../VISUAL-DIRECTION.md). PCI: [`../../AIRWALLEX-INTEGRATION.md`](../../AIRWALLEX-INTEGRATION.md) §8.

**AppShell collapse is already done (A2.1).** Aside is `hidden w-56 shrink-0 flex-col md:flex`; Menu opens the same `SideNav` / `OrgSwitcher` in F3 `Sheet`. Do **not** reopen collapse. Do **not** build `MobileNav.tsx`. Do **not** add `sm:` / `lg:` / `xl:` / `2xl:` on A5 screens. A5.1 may **insert** one SideNav href (`/cards`) only.

---

## A5.0 locked policies (do not reopen)

Approved 2026-08-16. Implementers follow these; do not re-litigate. A5.0 still implements the helpers below and STOPs before A5.1 screens.

### 1. No new contracts, no new primitives, no AppShell collapse, no PAN in app state

- Do **not** add or rename fields in `src/shared/schemas/*` or `src/shared/contracts/*`.
- Do **not** add a `holderId` / `cardholderId` / `holder` query field to `listCardsQuery`. Spec “filterable by holder” is a **column**, not an API filter (policy §8).
- Do **not** add a shadcn/pattern file. A5 screens compose F3 files listed in each task’s **Pattern**.
- Do **not** import `@/server/*` from any `'use client'` file. Do **not** import `@/server/airwallex/*`.
- Do **not** call `call()` or `fetch` from a screen. Use F1 hooks. `usePanToken` is the only path to a pantoken.
- Do **not** edit `src/client/shell/AppShell.tsx` except the `DEFAULT_NAV` array in A5.1.
- Do **not** edit `src/client/hooks/invalidationMap.ts`.
- Do **not** add `/projects/[id]/settings` or a seventh workspace tab. `WORKSPACE_TAB_HREFS` stays six.
- Do **not** call `GET /issuing/cards/{id}/details`. Do **not** add PIN display / PIN change iframes (integration §8 lists three iframes; A5 spec is **details only**).
- Do **not** log, `console.log`, toast, or render `panTokenOutput.token`. It exists only as the iframe URL hash.
- Do **not** put the token in the page URL (`/cards/[id]/reveal?token=` is forbidden). Route is `/cards/[id]/reveal`; token is fetched on mount.
- Do **not** add `@testing-library/react`.

### 2. Routes (A5 spec wins)

| URL                    | Files                                                             | Guard                 | Shell                       |
| ---------------------- | ----------------------------------------------------------------- | --------------------- | --------------------------- |
| `/cards`               | `src/app/(app)/cards/page.tsx` + `OrgCardList.tsx`                | `requireApp` (layout) | `AppShell`                  |
| `/cards/[id]`          | `src/app/(app)/cards/[id]/page.tsx` + `CardDetail.tsx`            | same                  | `AppShell`                  |
| `/cards/[id]/reveal`   | `src/app/(app)/cards/[id]/reveal/page.tsx` + `RevealCard.tsx`     | same                  | `AppShell`                  |
| `/projects/[id]/cards` | `src/app/(app)/projects/[id]/cards/page.tsx` + `ProjectCards.tsx` | same                  | `AppShell` + workspace tabs |

No `/projects/[id]/cards/[cardId]`. Detail is always `/cards/[id]`.

No `/cards/new`. Create is not an A5 screen (policy §6).

Wizard `/projects/new` card-structure step already exists (`CardStructureStep.tsx`). A5.9 adds a Link; do not add a second wizard or a create-card step.

A5.1 inserts SideNav `{ href: '/cards', label: 'Cards' }` **after Projects**, before Approvals.

### 3. Layout — one breakpoint `md`, four patterns (collapse already exists)

Copy [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Do not add `sm:` / `lg:` / `xl:` / `2xl:` (ignore pre-existing `sm:` inside F3 `Sheet` / `UserMenu` / `/dev/ui` — do not edit those files).

**Pick one list treatment per page; do not mix** (A5 spec Layout):

| Screen           | Narrow                                                            | Desktop (`md:`)                          |
| ---------------- | ----------------------------------------------------------------- | ---------------------------------------- |
| Org `/cards`     | `DataTable` + internal overflow; toolbar `flex-wrap`              | same table, **not** a `CardVisual` grid  |
| Project cards    | `grid-cols-1` of `CardVisual`; toolbar `flex-wrap`                | `md:grid-cols-2` — **not** a DataTable   |
| Card detail      | stack: `CardVisual`, alerts, limits, actions `flex-wrap`, lists   | same stack; **no** `md:grid` of the page |
| Limits           | `LimitMeter` column `flex flex-col gap-3`                         | same; no `md:grid` required              |
| Access edit      | F3 `Sheet` `side="right"`                                         | same Sheet (not a page)                  |
| Reveal iframe    | `iframe` `className="w-full"` — **never** `w-[…]px` / `min-w-[…]` | same; iframe not wider than the viewport |
| Wizard card step | already one column `flex flex-col gap-3`                          | same; no `md:grid`                       |
| Org SideNav      | Cards appears inside existing Menu `Sheet`                        | Cards in the `hidden md:flex` aside      |

Workspace tabs already `flex flex-wrap` in `ProjectWorkspace.tsx`. Do not switch them to Radix `Tabs`.

Chrome Links: `buttonVariants({ variant: 'ghost' })` + `Link` (A3 Slot crash — do **not** `Button asChild` for wrap-nav Links). `Button asChild` + `Link` is OK for primary actions (A2.3 Create).

`CardVisual` already has `w-full max-w-[22rem]`. Do not wrap it in a fixed pixel width. Grid cells `min-w-0`.

### 4. Existing contracts (copy these fields; do not redeclare)

All amounts are **integer minor units**. Currency is ISO 4217 `string` length 3. Never `parseFloat`, never `type="number"`. **Never PAN / CVV / expiry** on the wire or in React state except the pantoken string (policy §1).

**`GET /api/cards`** — `cardContracts.list` — permission `card.view` — input `listCardsQuery`:

```
{
  projectId?: string min 1,
  status?: PENDING | ACTIVE | INACTIVE | CLOSED | BLOCKED | LOST | STOLEN | FAILED,
  purpose?: SHARED | MEMBER | VENDOR | ONE_TIME,
  page: coerce int min 1 default 1,
  pageSize: coerce int min 1 max 100 default 20
}
```

Output `cardListSchema`: `{ items: cardSchema[], page: int min 1, pageSize: int min 1, total: int min 0 }`.

**No client-side refilter.** URL search params map 1:1 onto this input via `parseCardListSearchParams`. There is **no** holder query param.

**`GET /api/projects/:id/cards`** — `.listForProject` — `card.view` — input `listProjectCardsQuery`:

```
{
  status?: CardStatus,
  purpose?: CardPurpose,
  page: coerce int min 1 default 1,
  pageSize: coerce int min 1 max 100 default 20
}
```

`projectId` is the path, not the query. Output same `cardListSchema`.

**`GET /api/cards/:id`** — `.get` — `card.view` — input `z.void()` — output `cardSchema`:

```
{
  id: string min 1,
  orgId: string min 1,
  projectId: string min 1 | null,
  categoryId: string min 1 | null,
  cardholderId: string min 1,
  airwallexCardId: string min 1,          // may be "pending:{uuid}" before Airwallex returns
  maskedNumber: string min 1,             // e.g. ************1234 — never a full PAN
  nickName: string min 1 max 100,
  purpose: SHARED | MEMBER | VENDOR | ONE_TIME,
  status: PENDING | ACTIVE | INACTIVE | CLOSED | BLOCKED | LOST | STOLEN | FAILED,
  desiredControls: cardControlsSchema,
  appliedControls: cardControlsSchema,
  lastReconciledAt: iso datetime | null,
  managedByRuleIds: string[] min 1 items, // empty = not rule-created
  accessList: string[],                   // user ids
  createdAt: iso datetime,
  updatedAt: iso datetime
}
```

`cardControlsSchema`:

```
{
  allowedTransactionCount: SINGLE | MULTIPLE,   // immutable after create; do not PATCH
  transactionLimits: {
    currency: string length 3,
    limits: { interval: PER_TRANSACTION | DAILY | WEEKLY | MONTHLY | QUARTERLY | YEARLY | ALL_TIME, amount: int >= 0 }[] min 1
  },
  activeFrom: iso datetime | null,
  activeTo: iso datetime | null,
  allowedCurrencies: null | string[] min 1,            // null = unconstrained; [] is invalid
  allowedMerchantCategories: null | string[] min 1,
  allowedMerchantCountries: null | string[] min 1,
  allowedMerchantBrands: null | string[] min 1,
  blockedTransactionUsages: { transactionScope: string min 1, usageScope: string min 1 }[]
}
```

**`PATCH /api/cards/:id`** — `.update` — `card.manage` — input `updateCardInput` (≥1 key): `{ nickName?: string min 1 max 100, accessList?: string[], desiredControls?: updateCardControlsInput }`. Output `cardSchema`.

A5 sends **`nickName` and/or `accessList` only**. Do **not** send `desiredControls` from A5 (policy §6). `allowedTransactionCount` cannot appear on update (schema omits it).

**`POST /api/cards/:id/freeze`** — `.freeze` — `card.manage` — input `z.void()` — output `cardSchema` (status `INACTIVE`). F1 optimistic.

**`POST /api/cards/:id/unfreeze`** — `.unfreeze` — `card.manage` — input `z.void()` — output `cardSchema` (status `ACTIVE`). F1 optimistic.

**`POST /api/cards/:id/close`** — `.close` — `card.manage` — input `closeCardInput`: `{ confirm: literal true }` — output `cardSchema` (status `CLOSED`). **Not** optimistic. CLOSED is terminal (`409 Card is CLOSED` on further freeze/unfreeze/close).

**`GET /api/cards/:id/limits`** — `.limits` — `card.view` — input `z.void()` — output `cardLimitsOutput`:

```
{
  currency: string length 3,
  limits: { interval: TransactionLimitInterval, amount: int >= 0, remaining: int }[],
  cachedAt: iso datetime
}
```

Live from Airwallex (F1 `staleTime` 15s). **Do not** compute remaining from `desiredControls` or from transactions. `remaining` is not nonnegative — do **not** clamp. Pass through to `LimitMeter`.

**`POST /api/cards/:id/pan-token`** — `.panToken` — `card.viewDetails` **and** access scope — input `z.void()` — output `panTokenOutput`: `{ token: string min 1, expiresAt: iso datetime }`. Mutation, **never cached** (`usePanToken` invalidation `[]`). Audited server-side as `card.pan_token_created`. 403 without permission / out of scope. Cross-org 404.

**`POST /api/cards/:id/reconcile`** — `.reconcile` — `card.manage` — input `z.void()` — output `cardSchema`. This is A5’s **retry** when desired vs applied diverge. There is no retry-create endpoint.

**`POST /api/projects/:id/cards`** — `.create` — `card.create` — input `createCardInput`: `{ purpose: CardPurpose, cardholderId: string min 1, nickName?: string min 1 max 100, categoryId?: string min 1 | null, accessList?: string[], desiredControls: createCardControlsInput }`. **A5 screens do not call this** (policy §6).

**`GET /api/cardholders`** — `cardholderContracts.list` — `card.view` — input `{ page: coerce int min 1 default 1, pageSize: coerce int min 1 max 100 default 20 }` — output `{ items: cardholderSchema[], page, pageSize, total }`.

`cardholderSchema`: `{ id, orgId: string min 1, userId: string min 1 | null, airwallexCardholderId: string min 1, type: INDIVIDUAL | DELEGATE, status: INCOMPLETE | PENDING | READY | DISABLED | DELETED, createdAt, updatedAt }`.

**`GET /api/cardholders/:id`** — `.get` — `card.view` — output `cardholderSchema`.

**`GET /api/cards/:id/transactions`** — `transactionContracts.listForCard` — hook `useCardTransactions(cardId, filter?)` is **infinite** (F1). Input `listCardTransactionsQuery`: `{ status?: TransactionStatus, from?: iso, to?: iso, page: coerce int min 1 default 1, pageSize: coerce int min 1 max 100 default 20 }`. Output `{ items: transactionSchema[], page, pageSize, total }`.

`transactionSchema` (display fields A5 uses): `{ id, cardId, projectId, type: TransactionType, status: AUTHORIZED | VERIFIED | CLEARED | REVERSED | EXPIRED | DECLINED, amount: int, currency: string length 3, merchant: { name: string min 1 max 500, mcc: string min 1 max 8, country: string min 1 max 3 }, failureReason: string | null, transactedAt: iso }`.

A5 does **not** attach receipts (A8). Flatten `data.pages.flatMap(p => p.items)` for the table.

**`GET /api/projects`** — `useProjects({ page: 1, pageSize: 100 })` for the org-list project filter labels. Do not invent a cards-specific project search endpoint.

**`GET /api/organizations/:id/members`** — `useOrgMembers(orgId)` for access-list names: `{ userId, user: { id, email, name, image? }, status: ACTIVE | SUSPENDED, … }`.

**`GET /api/projects/:id/members`** — `useProjectMembers(id)` for the access-list Sheet checkboxes (project members only).

**`GET /api/me`** — `activeOrg.baseCurrency` length 3 (create is out of scope; still used if a money input appears — it should not).

**Permission** values used here: `card.view`, `card.viewDetails`, `card.manage`. Client `can()` is UX only. `PermissionGate` requires `projectId: string` — pass `card.projectId`. If `projectId` is `null`, use `PermissionGateView` `allowed={false}` with the matching denial message (do not pass `''`). Always pass `subject={{ cardId: card.id }}` on manage / viewDetails gates.

### 5. List treatment (locked pick)

| Page                   | Treatment                                 | Why                                                  |
| ---------------------- | ----------------------------------------- | ---------------------------------------------------- |
| `/cards`               | `DataTable`                               | filters + pagination; do not also render a grid      |
| `/projects/[id]/cards` | `CardVisual` `grid-cols-1 md:grid-cols-2` | product face of the card; do not also render a table |

Row / tile click → `/cards/${id}`. Labels: `nickName` + `maskedNumber` only (`formatMaskedCard` / `CardVisual`).

### 6. Humans do not type limits; A5 does not issue cards

Product premise (AGENTS.md / PRD): limits are **derived**, never typed. `POST /api/projects/:id/cards` requires `desiredControls.transactionLimits` — that is a B6 / seed path, not an A5 form.

- Do **not** render a create-card form, a limits amount `Input`, or a `desiredControls` editor.
- Do **not** call `useCreateCard` or `useCreateCardholder` from A5 screens.
- Empty states point at `/projects/${id}/controls` (A6 placeholder is fine) with locked copy §13.
- A5 **may** PATCH `nickName` and `accessList` (cosmetic / who can reveal). That is not typing a limit.

Issuing flags already live on the A2 wizard (`cardStructure.shared | perMember | vendor | oneTime`). A5.9 is a Link only.

### 7. Remaining limits are live; desired vs applied is visible

- Detail meters: `useCardLimits(id)` → one `LimitMeter` per `limits[]` row (`interval`, `amount`, `remaining`, `currency`). Do **not** recompute `remaining`. Do **not** use A4 `diffCardTransactionLimits` / `desiredControls.transactionLimits` as the remaining source (that was “limits that moved” after a budget write, not live spend).
- If `JSON.stringify(desiredControls) !== JSON.stringify(appliedControls)` (helper `controlsDiverge`): heading `Desired vs applied` + `DiffView` from `controlsToDiffView(appliedControls, desiredControls)` + `PermissionGate` `card.manage` Button `Reconcile` → `useReconcileCard({ id })`.
- Zero divergence → do **not** hide a lie; omit the pane (nothing to show). Spec: “visible rather than silently hidden” applies when they **do** diverge.

### 8. Holder filter

`listCardsQuery` has `projectId`, `status`, `purpose`, `page`, `pageSize` only. Holder is a **column** (resolve `card.cardholderId` via `useCardholders({ page: 1, pageSize: 100 })` map `id → cardholder`). Do not client-filter the table by holder. If more than 100 cardholders, show raw `cardholderId` for misses — do not paginate cardholders in a loop.

### 9. Lifecycle, states, reveal eligibility

| `status`                      | Alerts (locked §13)     | Freeze | Unfreeze | Close | Reveal | PATCH nick/access |
| ----------------------------- | ----------------------- | ------ | -------- | ----- | ------ | ----------------- |
| `PENDING`                     | pending / screening     | no     | no       | no    | no     | no                |
| `FAILED`                      | failed; no retry-create | no     | no       | no    | no     | no                |
| `ACTIVE`                      | —                       | yes    | no       | yes   | yes    | yes               |
| `INACTIVE` (frozen)           | frozen                  | no     | yes      | yes   | yes    | yes               |
| `CLOSED`                      | closed read-only        | no     | no       | no    | no     | no                |
| `BLOCKED` / `LOST` / `STOLEN` | status banner           | no     | no       | no    | no     | no                |

- **Pending creation / screening:** `isPendingCreate(card)` = `status === 'PENDING'`. If `useCardholder(card.cardholderId).data?.status` is `PENDING` or `INCOMPLETE`, use the screening copy; else the pending-create copy. `airwallexCardId` starting with `pending:` is extra signal, not required.
- **Failed create + retry:** there is **no** retry-create endpoint (create leaves a `PENDING` row and throws; `FAILED` is Airwallex-driven). Show the failed copy. Do **not** fake a Retry that POSTs create. If controls also diverge, Reconcile is the retry (policy §7).
- **Frozen:** `status === 'INACTIVE'` — `CardVisual` / `StatusBadge kind="card"` already distinguish it; keep Freeze hidden (Unfreeze shown).
- **Closed:** read-only; transactions still listed.
- **Single-use used:** `desiredControls.allowedTransactionCount === 'SINGLE'` AND (`status === 'CLOSED'` OR flattened transactions length > 0) → locked single-use copy. Informational; not a mutation.
- **Rule-created:** `managedByRuleIds.length > 0` → each id is a `Link` to `ruleHref(projectId, ruleId)`. If `projectId` is null, render the id as text (no href). A6 `/projects/[id]/controls` placeholder is the destination — do not wait for A6.
- Freeze: `ConfirmDialog` **without** `typeToConfirm`. Close: **with** `typeToConfirm` phrase `CLOSE` (case-sensitive, F3.20). Close still sends `{ confirm: true }`.

### 10. Secure reveal (PCI hard boundary)

1. Gate the **page** and the `CardVisual` `onReveal` with `card.viewDetails` + `subject={{ cardId }}`. Always visible; denied = disabled + locked audited denial copy.
2. Disclose that reveal is **audited** (locked §13) **before** calling `usePanToken`.
3. `onReveal` on detail `CardVisual` → `router.push(cardRevealHref(id))` (do not fetch the token on the detail page).
4. Reveal page: `usePanToken().mutate({ id })` on mount (once; generation counter if Strict Mode double-invoke — ignore stale). On success, set iframe `src={airwallexRevealIframeSrc(card.airwallexCardId, token)}` only.
5. Iframe: `className="w-full min-h-96 border-0"` — **never** a fixed pixel width. `title="Card details"`. `referrerPolicy="no-referrer"`.
6. **Src (locked to integration §8):** `https://airwallex.com/issuing/pci/v2/${airwallexCardId}/details#${token}`. Do **not** add an env var. Do **not** invent a demo host. `{airwallexCardId}` is `card.airwallexCardId`, not the local `card.id`. If `isPendingAirwallexId(airwallexCardId)` (`startsWith('pending:')`), do not mount the iframe — `ErrorState` pending copy.
7. **postMessage:** listen on `window`. Ignore unless `event.origin` is in `AIRWALLEX_PCI_MESSAGE_ORIGINS`. If `event.data` is a plain object and `String(data.type)` matches `/error/i`, show `ErrorState` locked iframe-error copy with Retry (re-mutate pan-token). Any other allowlisted message → hide the loading overlay (iframe already visible). No message is not a failure — keep the iframe visible; do not block on a timeout.
8. **Do not invent a CSS/style postMessage protocol.** Documented class names live as constants on the helper for a later pass; A5 does not inject CSS into the cross-origin iframe.
9. There is nothing to copy from **our** DOM. Do not add a Copy button. Do not read `iframe.contentDocument`.
10. Token expiry: if `Date.parse(expiresAt) <= Date.now()`, re-mutate once. Do not render `expiresAt` next to the iframe as the token.

### 11. Money, PAN, permissions UX, testing, ESLint

- Amounts: `MoneyDisplay` / `LimitMeter`. No money `Input` in A5 (no create, no limit editor).
- **Never touch a PAN.** Screen source must not contain `cvv`, `card_number`, or `\bPAN\b` except the allowlisted file-header sentences in §13 / A5.10. CSS class `details__row--card-number` lives **only** in `src/client/lib/cards.ts`.
- `PermissionGate` / `PermissionGateView`: always show Freeze / Unfreeze / Close / Reveal / Reconcile / Save (disabled + tooltip). Never `hidden` them on narrow.
- Tests: pure helpers in `src/client/lib/cards.ts` with vitest **node**.
- Screen Accept always includes `pnpm verify` plus **375px and 768px**: no page-level horizontal scrollbar; Freeze / Close / Reveal reachable when offered; iframe not wider than the viewport; tables may scroll **inside**.
- `(app)` already bans `call()` / `fetch`. Do not add a `@/server` ban (server layout still uses `requireApp`).

### 12. Extra invalidation (screens only)

F1 already invalidates `qk.card` / `qk.cards` / `qk.cardLimits` on freeze/unfreeze/close/update/reconcile. `usePanToken` is `[]`. A5 screens do **not** need extra `invalidateQueries` unless a task says so. Do not edit the map.

After `useUpdateCard` / `useReconcileCard`, `useCard` / `useCardLimits` refetch via that map — wait for settle; do not race.

### 13. Locked copy (do not paraphrase)

| Situation                  | Surface                                  | Copy                                                                                                                                                                                                              |
| -------------------------- | ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot view cards          | `ErrorState`                             | server `error.message` (403 names `card.view`)                                                                                                                                                                    |
| Cannot manage card         | `PermissionGateView`                     | `You don't have permission to manage this card.`                                                                                                                                                                  |
| Cannot reveal              | `PermissionGateView`                     | `You don't have permission to reveal card details. Reveals are audited.`                                                                                                                                          |
| Reveal is audited          | `Alert` (not destructive) on reveal page | `Revealing card details is audited.`                                                                                                                                                                              |
| No org cards               | `EmptyState`                             | title `No cards yet` / description `Cards are issued by rules when a project launches.`                                                                                                                           |
| No project cards           | `EmptyState`                             | title `No cards yet` / description `Cards are issued by rules when this project launches.` / action `View controls` → `controlsHref(projectId)`                                                                   |
| Pending create             | `Alert`                                  | `This card is still being created.`                                                                                                                                                                               |
| Cardholder screening       | `Alert`                                  | `The cardholder is still screening. The card issues when the cardholder is READY.`                                                                                                                                |
| Failed create              | `Alert` destructive                      | `Card creation failed.`                                                                                                                                                                                           |
| Frozen                     | `Alert`                                  | `This card is frozen.`                                                                                                                                                                                            |
| Closed                     | `Alert`                                  | `This card is closed. It is kept for transaction history.`                                                                                                                                                        |
| Blocked / lost / stolen    | `Alert`                                  | `This card is {status}.` (interpolate the enum value as-is: `BLOCKED` / `LOST` / `STOLEN`)                                                                                                                        |
| Single-use used            | `Alert`                                  | `This single-use card has been used.`                                                                                                                                                                             |
| Rule-created               | line under visual                        | `Created by rule` then the `Link`s                                                                                                                                                                                |
| Desired vs applied heading | heading                                  | `Desired vs applied`                                                                                                                                                                                              |
| Reconcile                  | Button                                   | `Reconcile`                                                                                                                                                                                                       |
| Freeze confirm             | `ConfirmDialog`                          | title `Freeze this card?` description `You can unfreeze this card later.` confirm `Freeze` variant `default`                                                                                                      |
| Unfreeze confirm           | `ConfirmDialog`                          | title `Unfreeze this card?` description `The card will be able to transact again.` confirm `Unfreeze` variant `default`                                                                                           |
| Close confirm              | `ConfirmDialog`                          | title `Close this card?` description `This cannot be undone. Pending transactions will still clear.` confirm `Close` variant `destructive` `typeToConfirm` `{ phrase: 'CLOSE', prompt: 'Type CLOSE to confirm' }` |
| Nickname save              | Button                                   | `Save nickname`                                                                                                                                                                                                   |
| Access save                | Button                                   | `Save access list`                                                                                                                                                                                                |
| No transactions            | `DataTable` empty                        | title `No transactions yet` / description `Authorizations and clearings for this card appear here.`                                                                                                               |
| Iframe pending id          | `ErrorState`                             | `Card details are not available until the card is issued.`                                                                                                                                                        |
| Iframe error               | `ErrorState`                             | `The secure card frame failed to load.` action Retry                                                                                                                                                              |
| Project not found          | `ErrorState`                             | `This project is not available.`                                                                                                                                                                                  |
| Card not found             | `ErrorState`                             | `This card is not available.`                                                                                                                                                                                     |
| Wizard → cards             | `Link`                                   | `Issue and manage cards on the project cards tab.`                                                                                                                                                                |
| Duplicate / 409 / 422      | `Alert` destructive                      | server `error.message` / `applyServerErrorsFromApiError`                                                                                                                                                          |

File-header allowlist (A5.10 strips these before the PAN scan):

- `PCI boundary: sensitive details render in the Airwallex iframe only.`
- `PCI boundary: never a PAN.`
- existing `Card structure flags only — never a PAN.`

---

## Contracts first

- [x] **A5.0** — Card helpers (STOP for review)
  - **Files:**
    - `src/client/lib/cards.ts` (create)
    - `src/client/lib/cards.test.ts` (create)
    - `src/client/lib/index.ts` (edit — `export * from '@/client/lib/cards'`)
  - **Do:** No React screens. No AppShell / CardVisual / wizard / iframe changes yet. Implement the locked helper API (pure, no React, no `call()`):
    1. File header comment exactly: `PCI boundary: never a PAN.`
    2. `AIRWALLEX_PCI_IFRAME_ORIGIN`: `'https://airwallex.com'`.
    3. `AIRWALLEX_PCI_MESSAGE_ORIGINS`: `ReadonlySet<string>` — `https://airwallex.com`, `https://www.airwallex.com`.
    4. `AIRWALLEX_PCI_CSS_CLASSES`: `Readonly<{ cardNumberRow: 'details__row--card-number'; value: 'details__value' }>` — constants only; unused by screens in A5 (policy §10.8).
    5. `CLOSE_CONFIRM_PHRASE`: `'CLOSE'`.
    6. `orgCardsHref(): string` — `'/cards'`.
    7. `cardHref(cardId: string): string` — `/cards/${cardId}`. Throw if `cardId.length < 1`. Same throw on the next hrefs that take an id.
    8. `cardRevealHref(cardId: string): string` — `/cards/${cardId}/reveal`.
    9. `projectCardsHref(projectId: string): string` — `/projects/${projectId}/cards`. Throw if empty. (A4.0 already has `cardsTabHref` — **re-export** `cardsTabHref as projectCardsHref` **or** implement identically; pick one name and use it everywhere in A5. Prefer wrapping `cardsTabHref` from `src/client/lib/budget.ts` to avoid two functions drifting.)
    10. `controlsHref(projectId: string): string` — `/projects/${projectId}/controls`. Throw if empty.
    11. `ruleHref(projectId: string, ruleId: string): string` — `/projects/${projectId}/controls?ruleId=${encodeURIComponent(ruleId)}`. Throw if either id empty.
    12. `parseCardListSearchParams(input: { projectId?: string | string[]; status?: string | string[]; purpose?: string | string[]; page?: string | string[]; pageSize?: string | string[] }): ListCardsQuery` — arrays use `[0]`. Run `listCardsQuery.safeParse` on the coerced object; on failure return `{ page: 1, pageSize: 20 }` only. Drop unknown status/purpose. Do not invent `holder`.
    13. `cardListHref(filter: { projectId?: string; status?: CardStatus; purpose?: CardPurpose; page?: number; pageSize?: number }): string` — path `/cards`; omit defaults (`page` 1, `pageSize` 20, undefined optionals). `encodeURIComponent` values.
    14. `parseProjectCardListSearchParams(input: { status?: string | string[]; purpose?: string | string[]; page?: string | string[]; pageSize?: string | string[] }): ListProjectCardsQuery` — same safeParse against `listProjectCardsQuery`; failure → `{ page: 1, pageSize: 20 }`.
    15. `projectCardListHref(projectId: string, filter: { status?: CardStatus; purpose?: CardPurpose; page?: number; pageSize?: number }): string` — path `projectCardsHref(projectId)`; omit defaults.
    16. `isPendingCreate(status: string): boolean` — `status === 'PENDING'`.
    17. `isPendingAirwallexId(airwallexCardId: string): boolean` — `airwallexCardId.startsWith('pending:')`.
    18. `isFrozen(status: string): boolean` — `status === 'INACTIVE'`.
    19. `isClosed(status: string): boolean` — `status === 'CLOSED'`.
    20. `isFailed(status: string): boolean` — `status === 'FAILED'`.
    21. `isTerminalLost(status: string): boolean` — `status === 'BLOCKED' || status === 'LOST' || status === 'STOLEN'`.
    22. `canRevealCard(status: string, airwallexCardId: string): boolean` — `(status === 'ACTIVE' || status === 'INACTIVE') && !isPendingAirwallexId(airwallexCardId)`.
    23. `canFreezeCard(status: string): boolean` — `status === 'ACTIVE'`.
    24. `canUnfreezeCard(status: string): boolean` — `status === 'INACTIVE'`.
    25. `canCloseCard(status: string): boolean` — `status === 'ACTIVE' || status === 'INACTIVE'`.
    26. `canEditCardMeta(status: string): boolean` — `status === 'ACTIVE' || status === 'INACTIVE'`.
    27. `isScreeningCardholder(status: string): boolean` — `status === 'PENDING' || status === 'INCOMPLETE'`.
    28. `isSingleUse(allowedTransactionCount: string): boolean` — `=== 'SINGLE'`.
    29. `isSingleUseUsed(input: { allowedTransactionCount: string; status: string; transactionCount: number }): boolean` — single-use AND (`status === 'CLOSED'` OR `transactionCount > 0`).
    30. `controlsDiverge(desired: unknown, applied: unknown): boolean` — `JSON.stringify(desired) !== JSON.stringify(applied)`.
    31. `controlsToDiffView(applied: { allowedTransactionCount: string; transactionLimits: { currency: string; limits: { interval: string; amount: number }[] }; activeFrom: string | null; activeTo: string | null; allowedCurrencies: string[] | null; allowedMerchantCategories: string[] | null; allowedMerchantCountries: string[] | null; allowedMerchantBrands: string[] | null; blockedTransactionUsages: unknown }, desired: typeof applied): { before: Record<string, unknown>; after: Record<string, unknown> }` — keys `allowedTransactionCount`, `activeFrom`, `activeTo`, `allowedCurrencies`, `allowedMerchantCategories`, `allowedMerchantCountries`, `allowedMerchantBrands`, `blockedTransactionUsages`; plus one key per **union of intervals** `` `limit.${interval}` `` whose value is `{ amount, currency }` (money object so `DiffView` uses `MoneyDisplay`). Missing interval on one side → that side `undefined`.
    32. `airwallexRevealIframeSrc(airwallexCardId: string, token: string): string` — `${AIRWALLEX_PCI_IFRAME_ORIGIN}/issuing/pci/v2/${airwallexCardId}/details#${token}`. Throw if either argument `length < 1`. Do **not** `encodeURIComponent` the token (it is a fragment).
    33. `isAirwallexPciOrigin(origin: string): boolean` — `AIRWALLEX_PCI_MESSAGE_ORIGINS.has(origin)`.
    34. `classifyRevealMessage(data: unknown): 'error' | 'ready' | 'ignore'` — `'error'` iff `data` is a non-null object and `type` in data is a string matching `/error/i`; `'ready'` iff `data` is a non-null object with a string `type` that does not match `/error/i`; else `'ignore'`.
    35. `holderLabel(cardholder: { type: string; status: string; userId: string | null }, userName: string | undefined): string` — if `userName` min 1 use it; else if `userId` use `userId`; else `type` + ` ` + `status` (e.g. `DELEGATE READY`).
    36. `accessListNames(accessList: string[], members: ReadonlyArray<{ userId?: string; user?: { id: string; name: string } }>): { userId: string; name: string }[]` — for each id, name from `user.id` or `userId` match; fallback the raw id. Stable `accessList` order.
    37. `flattenTransactionPages(pages: ReadonlyArray<{ items: readonly unknown[] }> | undefined): unknown[]` — `pages?.flatMap(p => p.items) ?? []`.
    38. `cardLimitsToMeters(output: { currency: string; limits: { interval: string; amount: number; remaining: number }[] }): { interval: string; amount: number; remaining: number; currency: string }[]` — passthrough `remaining` (do **not** clamp).
    39. `manageCardDenialMessage()` / `revealCardDenialMessage()` / `revealAuditedMessage()` / `pendingCreateMessage()` / `cardholderScreeningMessage()` / `failedCreateMessage()` / `frozenCardMessage()` / `closedCardMessage()` / `singleUseUsedMessage()` / `iframePendingMessage()` / `iframeErrorMessage()` — locked §13 sentences.
    40. `lostCardMessage(status: 'BLOCKED' | 'LOST' | 'STOLEN'): string` — `This card is ${status}.`
    41. `tokenIsExpired(expiresAt: string, nowMs: number): boolean` — `Date.parse(expiresAt) <= nowMs`. Invalid parse → `true` (fail closed, re-fetch).
  - **Pattern:** `src/client/lib/budget.ts` + `src/client/lib/budget.test.ts` (A4.0). URL parse/href: `parseProjectListSearchParams` / `projectListHref` in `src/client/lib/projects.ts` (A2.0 — this phase’s B1-equivalent for list filters). Contracts to copy fields from: `src/shared/schemas/card.ts`, `src/shared/schemas/cardControls.ts`, `src/shared/schemas/cardholder.ts`, `src/shared/contracts/card.ts` (B5 — this phase’s B1 equivalent). Iframe src: `docs/AIRWALLEX-INTEGRATION.md` §8 (do not invent a second URL). `cardsTabHref`: `src/client/lib/budget.ts`. Close phrase: `src/components/patterns/matchesConfirmPhrase.ts` (case-sensitive `CLOSE`).
  - **STOP and get this reviewed before A5.1+.** Wrong iframe origin, a holder query param, a create-card form, or a PAN in React state after screens land is a rewrite.
  - **Accept:** `pnpm test client/lib/cards` — cover: `parseCardListSearchParams` drops unknown status and has no `holder` key; `cardListHref({ page: 1 })` is `/cards`; `airwallexRevealIframeSrc('awx_1', 'tok')` is `https://airwallex.com/issuing/pci/v2/awx_1/details#tok`; `airwallexRevealIframeSrc('', 'tok')` throws; `canRevealCard('ACTIVE', 'pending:abc')` is false; `canRevealCard('CLOSED', 'awx')` is false; `canCloseCard('ACTIVE')` true and `canCloseCard('CLOSED')` false; `controlsDiverge` true when MONTHLY amount differs; `controlsToDiffView` values for `limit.MONTHLY` are `{ amount, currency }`; `cardLimitsToMeters` remaining `-1` stays `-1`; `classifyRevealMessage({ type: 'pciError' })` is `'error'` and `({ type: 'ready' })` is `'ready'` and `('nope')` is `'ignore'`; `tokenIsExpired('not-a-date', 0)` is true; `isSingleUseUsed({ allowedTransactionCount: 'SINGLE', status: 'ACTIVE', transactionCount: 1 })` true; `revealCardDenialMessage()` contains `audited`; `CLOSE_CONFIRM_PHRASE` is `CLOSE`.
  - **Notes:** Helpers in `src/client/lib/cards.ts` (17 unit tests). Iframe origin is `https://airwallex.com`; `projectCardsHref` wraps A4 `cardsTabHref`; no holder query param; remaining unclamped. `pnpm verify` green (1642 tests). STOP before A5.1 screens.

---

## Tasks

### A5.1 — SideNav Cards + route shells

- [x] **A5.1** — Insert `/cards` in SideNav; placeholder detail/reveal so links do not 404
  - **Files:**
    - `src/client/shell/AppShell.tsx` (edit — `DEFAULT_NAV` only)
    - `src/app/(app)/cards/page.tsx` (create — placeholder until A5.2)
    - `src/app/(app)/cards/[id]/page.tsx` (create — placeholder until A5.4)
    - `src/app/(app)/cards/[id]/reveal/page.tsx` (create — placeholder until A5.6)
  - **Do:**
    1. `DEFAULT_NAV`: insert `{ href: '/cards', label: 'Cards' }` immediately **after** `{ href: '/projects', label: 'Projects' }` and **before** Approvals. Do **not** change aside `hidden md:flex` / Menu / Sheet / `w-56`.
    2. `/cards` placeholder: `<main className="min-w-0">Cards — not built yet</main>` (or a one-line heading). Must **not** 404.
    3. `/cards/[id]` and `/cards/[id]/reveal` placeholders: `Card detail — not built yet` / `Reveal — not built yet` in `<main className="min-w-0">`.
    4. Do **not** implement the org table, detail, or iframe in this task. Do not replace `projects/[id]/cards/page.tsx` yet (still `ComingSoonTab`).
  - **Layout:** n/a for placeholders (stack `min-w-0`). Shell collapse unchanged. Cards is in the aside at `md` and in the Menu `Sheet` below `md` (same `SideNav`).
  - **Pattern:** A3.6 `src/client/shell/AppShell.tsx` `DEFAULT_NAV` append. Placeholders: A4.1 nested budget pages. B5 list route: `src/shared/contracts/card.ts` `list.path` `'/api/cards'` (UI path is `/cards`, not `/api/cards`).
  - **Accept:** `pnpm verify`. `/cards`, `/cards/any-id`, `/cards/any-id/reveal` are not 404. SideNav at 768px shows Cards after Projects; at 375px Cards appears inside the existing Menu Sheet. 375px and 768px: no page-level horizontal scrollbar; Menu/Sheet still works below `md`. Aside still `hidden md:flex`. `AppShell.tsx` does not lose `hidden` or `md:flex`.
  - **Notes:** `DEFAULT_NAV` Cards after Projects. Placeholders `/cards`, `/cards/[id]`, `/cards/[id]/reveal`. Project cards tab still `ComingSoonTab`. Aside still `hidden md:flex`. `pnpm verify` green (1642 tests).

### A5.2 — Org-wide card list

- [x] **A5.2** — `/cards` DataTable; URL filters `projectId` / `status` / `purpose`
  - **Files:**
    - `src/app/(app)/cards/page.tsx` (replace placeholder)
    - `src/app/(app)/cards/OrgCardList.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<OrgCardList />` only.
    2. `useSearchParams` → `parseCardListSearchParams`. `useCards(filter)`. **No client-side refilter.**
    3. `403` → `ErrorState` `error.message`. Loading: `LoadingState`.
    4. Toolbar `flex flex-wrap gap-2`:
       - Project `Select` (or Combobox): options from `useProjects({ page: 1, pageSize: 100 })` plus sentinel `__all__` → omit `projectId`. On change `router.push(cardListHref({ ...filter, projectId, page: 1 }))`.
       - Status `Select`: `CardStatus` values + `__all__`.
       - Purpose `Select`: `CardPurpose` values + `__all__`.
       - Do **not** add a holder control.
    5. `DataTable` columns: `nickName` (`Link` to `cardHref(row.id)`), `maskedNumber` (text; `formatMaskedCard`), `purpose` (`StatusBadge` is **not** for purpose — text/`Badge`), `status` (`StatusBadge kind="card"`), `project` (`Link` to `projectCardsHref` when `projectId` else `—`), `holder` (`holderLabel` via cardholders map), `source` (`Created by rule` if `managedByRuleIds.length > 0` else `—`). `getRowId: (row) => row.id`. Pagination `mode: 'page'` from the response; `onPageChange` writes `cardListHref`. `empty` locked no-org-cards copy. Do **not** restyle as `CardVisual` tiles. Do **not** add a second `overflow-x-auto`.
    6. `useCardholders({ page: 1, pageSize: 100 })` for the holder column only.
    7. Do not fetch on the server. Do not call `usePanToken` / `useCardLimits` / `useCreateCard`.
  - **Layout:** table scrolls **inside**; page does not. Toolbar `flex-wrap`. No `md:grid`. No Sheet. No `CardVisual`.
  - **Pattern:** A2.3 `src/app/(app)/projects/ProjectList.tsx` (URL filters, `__all__` Select, page pagination). `DataTable` `src/components/patterns/DataTable.tsx`. `StatusBadge` F3.10. Hooks: `src/client/hooks/useCards.ts` `useCards` (B5 `cardContracts.list`). `formatMaskedCard` `src/lib/format/cardNumber.ts`. B5 query: `src/shared/schemas/card.ts` `listCardsQuery`.
  - **Accept:** `pnpm verify`. Changing status writes `?status=` and does not client-filter a full unfiltered list. 375px and 768px: no page-level horizontal scrollbar; filters + row `Link` reachable; table may scroll inside. No `PAN` / `cvv` / `card_number` in these two files. No holder query param in `cardListHref`.
  - **Notes:** DataTable with URL `projectId`/`status`/`purpose`; holder is a column via cardholders map. No holder query param, no `CardVisual`. `pnpm verify` green (1642 tests).

### A5.3 — Project cards grid

- [x] **A5.3** — `/projects/[id]/cards` `CardVisual` grid
  - **Files:**
    - `src/app/(app)/projects/[id]/cards/page.tsx` (replace `ComingSoonTab`)
    - `src/app/(app)/projects/[id]/cards/ProjectCards.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<ProjectCards />` only.
    2. `useParams().id`. `parseProjectCardListSearchParams` from `useSearchParams`. `useProjectCards(id, filter)`. `403` → `ErrorState` `error.message`. `NOT_FOUND` → `This project is not available.` Loading: `LoadingState`.
    3. Toolbar `flex-wrap`: status + purpose Selects (same `__all__` pattern) writing `projectCardListHref(id, …)`. No Create button. No DataTable.
    4. If `total === 0` and not loading: `EmptyState` locked no-project-cards copy; action `Link` (`buttonVariants` + `Link`, not `Button asChild`) to `controlsHref(id)` label `View controls`.
    5. Else `ul`/`div` `grid grid-cols-1 gap-4 md:grid-cols-2`; each cell `min-w-0`. `CardVisual` `nickName` `maskedNumber` `status` `purpose`. Wrap in `Link` to `cardHref(card.id)` **or** make the visual’s reveal the only button: `onReveal` only if `canRevealCard` **and** `PermissionGate` `projectId={id}` `permission="card.viewDetails"` `subject={{ cardId: card.id }}` — `onReveal` → `router.push(cardRevealHref(card.id))`. Do not fetch pan-token here. If denied, omit `onReveal` (CardVisual hides the button) **and** still show a disabled Reveal via `PermissionGate` next to the visual so the control is not hidden-without-replacement — **locked:** put the gated Reveal **under** the visual in the cell (`flex flex-wrap`), and pass `onReveal` only when allowed (otherwise CardVisual would show an ungated button). Simpler locked choice: **never pass `onReveal` on the grid**; cell has `Link` “Open” to detail and a gated Reveal `Link` to reveal href. CardVisual is display-only on this page.
    6. Pagination: `mode` is not a DataTable. Render previous/next Buttons `flex-wrap` using `projectCardListHref` when `total > pageSize`.
    7. Do not call `useCreateCard`. Do not mix in a DataTable.
  - **Layout:** `grid-cols-1 md:grid-cols-2`. Toolbar wrap. No Sheet. No DataTable. Cells `min-w-0`.
  - **Pattern:** A3.1 tiles + A2.2 dashboard cards. `CardVisual` `src/components/patterns/CardVisual.tsx` (F3.15). Hook: `useProjectCards` `src/client/hooks/useCards.ts`. B5: `src/shared/contracts/card.ts` `listForProject`. EmptyState F3.19. Workspace already wraps this page.
  - **Accept:** `pnpm verify`. This file tree has no `DataTable` import. 375px: one column, Open/Reveal/View controls reachable, no page-level horizontal scrollbar. 768px: two columns. `ComingSoonTab` is gone from `cards/page.tsx`. No `usePanToken`.
  - **Notes:** `CardVisual` `grid-cols-1 md:grid-cols-2`; Open + gated Reveal Links; no DataTable, no `usePanToken`. Empty → View controls. `pnpm verify` green (1642 tests).

### A5.4 — Card detail (read)

- [x] **A5.4** — `/cards/[id]` visual, live limits, states, holder, access, desired vs applied, rule links
  - **Files:**
    - `src/app/(app)/cards/[id]/page.tsx` (replace placeholder)
    - `src/app/(app)/cards/[id]/CardDetail.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<CardDetail />` only.
    2. `useParams().id`. `useCard(id)`. `403` → `ErrorState` `error.message`. `NOT_FOUND` → `This card is not available.` Loading: `LoadingState`.
    3. Root `min-w-0 flex flex-col gap-4`.
    4. `CardVisual` with `nickName`, `maskedNumber`, `status`, `purpose`. Do **not** pass `onReveal` yet (A5.6). Placeholder row `flex flex-wrap gap-2` of disabled Buttons `Reveal` / `Freeze` / `Close` with `TODO(A5.5)` / `TODO(A5.6)` **or** omit those buttons until those tasks — **locked:** omit mutations and reveal in A5.4; comments `TODO(A5.5)` `TODO(A5.6)` are enough.
    5. Alerts per policy §9 using locked copy (pending / screening needs `useCardholder(card.cardholderId)`; failed; frozen; closed; lost; single-use used needs transaction count from A5.8 — **locked for A5.4:** single-use used if `isSingleUse` AND `status === 'CLOSED'` only; A5.8 extends with `transactionCount`).
    6. If `managedByRuleIds.length > 0`: `Created by rule` + `Link`s `ruleHref(projectId, ruleId)` when `projectId` is a string min 1.
    7. Holder: `useCardholder` + `useOrgMembers` for `holderLabel`. Cardholder `StatusBadge` is **not** for cardholder status — render `type` and `status` as text/`Badge`.
    8. Access list: `accessListNames` as a simple `<ul>` (edit lands in A5.7).
    9. Limits: `useCardLimits(id)` → `cardLimitsToMeters` → `LimitMeter` per row. Loading: `LoadingState` in that section only. Error: `ErrorState` `error.message` with Retry (`refetch`). Do not compute remaining.
    10. If `controlsDiverge(desiredControls, appliedControls)`: heading `Desired vs applied` + `DiffView` `{...controlsToDiffView(applied, desired)}`. Reconcile button **disabled** with `TODO(A5.5)` **or** omit until A5.5. **Locked:** no `useReconcileCard` in A5.4.
    11. Transactions heading with one line `Transactions land in A5.8.` **or** omit the table.
    12. If `projectId`: `Link` back to `projectCardsHref(projectId)`. Always `Link` to `orgCardsHref()`.
    13. Do not fetch on the server. Do not call `usePanToken` / `useCreateCard` / `useUpdateCard`.
  - **Layout:** stack. Actions (when present) `flex-wrap`. No page `md:grid`. No Sheet. `DiffView` may use its own `grid-cols-3` (F3 — do not restyle). `CardVisual` `w-full max-w-[22rem]` already.
  - **Pattern:** A4.2 `BudgetHome.tsx` (read-only + stubbed mutations). `CardVisual` / `LimitMeter` / `DiffView` / `StatusBadge` F3. Hooks: `useCard` / `useCardLimits` / `useCardholder` `src/client/hooks/useCards.ts`. B5: `src/shared/contracts/card.ts` `get` / `limits`. Limits remaining: `src/shared/schemas/card.ts` `cardLimitEntrySchema.remaining` (int, not nonnegative).
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; visual + meters reachable by vertical scroll; iframe not on this page. `CardDetail.tsx` does not contain `parseFloat`, `type="number"`, `usePanToken`, or `useCreateCard`. Limits come from `useCardLimits` (read the hook call). Divergent controls render `DiffView`; matching controls omit the pane.
  - **Notes:** Read-only detail: CardVisual, live `useCardLimits` meters, alerts, holder, access ul, DiffView when controls diverge. Mutations omitted TODO(A5.5)/TODO(A5.6). `pnpm verify` green (1642 tests).

### A5.5 — Freeze, unfreeze, close, reconcile

- [x] **A5.5** — Lifecycle confirms; close is type-to-confirm `CLOSE`
  - **Files:**
    - `src/app/(app)/cards/[id]/CardDetail.tsx` (edit — wire actions)
  - **Do:**
    1. Action row `flex flex-wrap gap-2`. `projectId` null → `PermissionGateView` `allowed={false}` `manageCardDenialMessage()` wrapping disabled buttons that would otherwise show.
    2. Else `PermissionGate` `projectId={card.projectId}` `permission="card.manage"` `subject={{ cardId: card.id }}` `denialMessage={manageCardDenialMessage()}`:
       - Freeze when `canFreezeCard`: opens ConfirmDialog locked freeze copy (no `typeToConfirm`) then `useFreezeCard().mutateAsync({ id })`.
       - Unfreeze when `canUnfreezeCard`: locked unfreeze copy then `useUnfreezeCard().mutateAsync({ id })`.
       - Close when `canCloseCard`: locked close copy **with** `typeToConfirm: { phrase: CLOSE_CONFIRM_PHRASE, prompt: 'Type CLOSE to confirm' }` then `useCloseCard().mutateAsync({ id, input: { confirm: true } })`. Confirm disabled until phrase matches (F3 already).
    3. Reconcile when `controlsDiverge`: same gate, Button `Reconcile` → `useReconcileCard().mutateAsync({ id })`. No confirm.
    4. `409` / `403` → `Alert` destructive `error.message`. CLOSED after success: buttons disappear via §9 (status from query).
    5. Do not optimistic-update in the screen (F1 freeze/unfreeze already does). Do not close without `{ confirm: true }`.
    6. Do not add Reveal in this task.
  - **Layout:** action row `flex-wrap`. Dialogs stacked. Do not `hidden` Freeze/Close on narrow.
  - **Pattern:** A4.7 ConfirmDialogs. Close type-to-confirm: F3.20 `src/components/patterns/ConfirmDialog.tsx` + `matchesConfirmPhrase` (case-sensitive). Hooks: `useFreezeCard` / `useUnfreezeCard` / `useCloseCard` / `useReconcileCard` `src/client/hooks/useCards.ts`. B5: `src/shared/contracts/card.ts` `freeze` / `unfreeze` / `close` (`closeCardInput.confirm` literal `true`) / `reconcile`. Lifecycle 409: `src/server/services/cards/lifecycle.ts` `'Card is CLOSED'`.
  - **Accept:** `pnpm verify` and `pnpm test client/lib/cards`. Close dialog requires typing `CLOSE` not `close`. 375px and 768px: Freeze / Unfreeze / Close / Reconcile reachable when offered; dialogs do not force page-level horizontal scroll. `CardDetail.tsx` close mutate input includes `confirm: true`. No `usePanToken`.
  - **Notes:** Freeze/Unfreeze/Close confirms; close requires `CLOSE` + `{ confirm: true }`. Reconcile when controls diverge. `pnpm verify` green (1642 tests).

### A5.6 — Secure reveal iframe

- [x] **A5.6** — `/cards/[id]/reveal` pantoken + iframe; audited disclosure
  - **Files:**
    - `src/app/(app)/cards/[id]/reveal/page.tsx` (replace placeholder)
    - `src/app/(app)/cards/[id]/reveal/RevealCard.tsx` (`'use client'`)
    - `src/app/(app)/cards/[id]/CardDetail.tsx` (edit — wire `onReveal` / Reveal control)
  - **Do:**
    1. File header on `RevealCard.tsx` exactly: `PCI boundary: sensitive details render in the Airwallex iframe only.`
    2. Detail: gated Reveal control (Button or `CardVisual` `onReveal`) → `router.push(cardRevealHref(id))`. `PermissionGate` `card.viewDetails` `subject={{ cardId }}` `denialMessage={revealCardDenialMessage()}`. Always visible. Do **not** call `usePanToken` on the detail page.
    3. Reveal page: `useCard(id)` first. If `!canRevealCard(status, airwallexCardId)` → `ErrorState` `iframePendingMessage()` (or closed/not-available). `403` on get → `error.message`.
    4. `Alert` `revealAuditedMessage()` always, before the iframe.
    5. `usePanToken`. On mount, if eligible, `mutate({ id })` with a generation counter (ignore stale). Success: keep `token` in `useState<string | null>` — **never** render it, never log it, never put it in a `data-` attribute. Iframe `src={airwallexRevealIframeSrc(airwallexCardId, token)}` only when token is a string min 1.
    6. Iframe attributes per policy §10.5–10.6. Sibling loading overlay until `classifyRevealMessage` returns `'ready'` **or** the iframe `onLoad` (native) — native `onLoad` may fire for empty documents; still show the iframe. `'error'` → `ErrorState` `iframeErrorMessage()` with Retry (increment generation, mutate again).
    7. `window` `message` listener: skip if `!isAirwallexPciOrigin(event.origin)`. `useEffect` cleanup removes the listener.
    8. If `tokenIsExpired(expiresAt, Date.now())` after success, mutate again once.
    9. Back `Link` to `cardHref(id)` (`buttonVariants` + `Link`).
    10. Do not read `contentDocument`. Do not add Copy. Do not inject CSS. Do not use `w-[` pixel widths.
  - **Layout:** stack. Iframe `w-full`. No `md:grid`. No Sheet. No fixed pixel width.
  - **Pattern:** A1.4 token-in-route (invite) is **not** the pattern — token must **not** be in the page URL. Hook: `usePanToken` `src/client/hooks/useCards.ts` (F1.8). B5: `src/shared/contracts/card.ts` `panToken`, `src/shared/schemas/card.ts` `panTokenOutput` (`token`, `expiresAt` only). Server audit: `src/server/services/cards/panToken.ts` (do not import). Integration URL: `docs/AIRWALLEX-INTEGRATION.md` §8. `CardVisual` `onReveal` F3.15.
  - **Accept:** `pnpm verify` and `pnpm test client/lib/cards`. `RevealCard.tsx` contains `usePanToken` and `airwallexRevealIframeSrc` and does **not** contain `console.log`. Iframe `className` includes `w-full` and does not match `w-[` or `min-w-[`. 375px and 768px: no page-level horizontal scrollbar; iframe not wider than the viewport; Reveal (detail) and Back reachable. Denied reveal still shows a disabled control on detail. Page URL has no `token` search param.
  - **Notes:** Reveal page fetches pantoken on mount; iframe `https://airwallex.com/issuing/pci/v2/{airwallexCardId}/details#token`. Token never rendered. Detail Reveal is gated and always visible. `pnpm verify` green (1642 tests).

### A5.7 — Nickname + access list

- [x] **A5.7** — PATCH `nickName` / `accessList` only
  - **Files:**
    - `src/app/(app)/cards/[id]/CardDetail.tsx` (edit)
    - `src/app/(app)/cards/[id]/AccessListSheet.tsx` (`'use client'`)
  - **Do:**
    1. Only when `canEditCardMeta(status)` and `projectId` is a string min 1. Else omit edit controls (read-only list from A5.4 remains).
    2. Nickname: `Input` `maxLength={100}` current `nickName`; Save `PermissionGate` `card.manage` `subject={{ cardId }}` → `useUpdateCard().mutateAsync({ id, input: { nickName } })`. Skip mutate if unchanged. `nickName` trim length `< 1` invalid. Do not send `desiredControls`.
    3. Access: Button `Edit access` opens `Sheet` `side="right"`. `useProjectMembers(projectId)` checkboxes (`user.name` + `user.email`). Checked = id in `accessList`. Save `input: { accessList: string[] }` (empty array allowed — schema is `z.array(idSchema)`, min 0). Close Sheet on success.
    4. `422` → `applyServerErrorsFromApiError`. `403`/`409` → Alert `error.message`.
    5. Do not add a limits editor. Do not PATCH `allowedTransactionCount`.
  - **Layout:** wrap vs Sheet. Sheet body `flex flex-col gap-4 min-w-0`. Nickname row `flex flex-wrap gap-2`. Do not `hidden` Save on narrow.
  - **Pattern:** A3.5 `EditMemberSheet.tsx`. `useUpdateCard` `src/client/hooks/useCards.ts`. B5: `src/shared/schemas/card.ts` `updateCardInput` (`nickName` 1–100, `accessList` string[]). `applyServerErrorsFromApiError` `src/client/lib/forms/applyServerErrors.ts`. Checkbox F3 `src/components/ui/checkbox.tsx`.
  - **Accept:** `pnpm verify`. Update payloads in this task’s files contain only `nickName` and/or `accessList` (grep `desiredControls` must not appear). 375px and 768px: Save nickname / Edit access / Sheet Save reachable; Sheet does not force window sideways scroll.
  - **Notes:** Nickname Input + Save; access Sheet of project members. PATCH only `nickName` / `accessList`. `pnpm verify` green (1642 tests).

### A5.8 — Card transactions

- [x] **A5.8** — Detail transactions from `useCardTransactions`
  - **Files:**
    - `src/app/(app)/cards/[id]/CardDetail.tsx` (edit — add table)
  - **Do:**
    1. Heading `Transactions`. `useCardTransactions(id)` (infinite). Rows = `flattenTransactionPages(data.pages)` typed as the contract item (cast via the hook’s data; do not hand-write a DTO).
    2. `DataTable` columns: `transactedAt` (`formatDate` `src/lib/dates.ts`), `merchant.name`, `amount` (`MoneyDisplay` `{ amount, currency }`), `status` (`Badge` / text), `type` (text). `getRowId: (row) => row.id`. `empty` locked no-transactions copy. Pagination `mode: 'cursor'` `nextCursor: hasNextPage ? 'next' : null` `onLoadMore: () => { void fetchNextPage() }` `isFetchingMore: isFetchingNextPage`. The `'next'` string is a sentinel (API is page-based infinite in F1); do not invent a cursor query param.
    3. Extend single-use used: `isSingleUseUsed({ allowedTransactionCount, status, transactionCount: rows.length })` in addition to A5.4’s CLOSED check.
    4. Do not upload receipts. Do not client-filter status unless the user… **locked:** no status filter on this table (do not pass `status` into the hook). Do not restyle as cards. Do not add a second `overflow-x-auto`.
  - **Layout:** table scrolls inside; page does not. No `md:grid`. No Sheet.
  - **Pattern:** A4.2 entries table. Hook: `useCardTransactions` `src/client/hooks/useTransactions.ts` (B8 `transactionContracts.listForCard`). `MoneyDisplay` F3.10. Schema: `src/shared/schemas/transaction.ts` `transactionSchema`.
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; transactions reachable by vertical scroll; table may scroll inside. Load more appears when `hasNextPage`. CLOSED cards still show the table.
  - **Notes:** Infinite `useCardTransactions`; cursor Load more sentinel `'next'`. Single-use used uses row count. `pnpm verify` green (1642 tests).

### A5.9 — Wizard link

- [x] **A5.9** — Card-structure step points at project cards
  - **Files:**
    - `src/app/(app)/projects/new/steps/CardStructureStep.tsx` (edit)
  - **Do:**
    1. After the four switches, if `draftId.length >= 1`, render `Link` `className={buttonVariants({ variant: 'outline' })}` `href={projectCardsHref(draftId)}` (or `cardsTabHref`) with locked wizard copy. Prefer `buttonVariants` + `Link`, not `Button asChild`.
    2. Do **not** add create-card fields, limits, or a second PUT. Do **not** change `submit` / the four flags.
    3. Keep `flex min-w-0 flex-col gap-3`. Keep the file header `Card structure flags only — never a PAN.`
  - **Layout:** one column (already). No Sheet. No `md:grid`.
  - **Pattern:** A4.8 `src/app/(app)/projects/new/steps/BudgetStep.tsx`. A2.6 this same `CardStructureStep.tsx`. Href: A5.0 / A4.0 `cardsTabHref`.
  - **Accept:** `pnpm verify`. 375px and 768px: wizard Next and the new Link reachable; no page-level horizontal scrollbar. `CardStructureStep.tsx` still has no `type="number"` and no `parseFloat`.
  - **Notes:** Outline Link to `projectCardsHref(draftId)` with locked wizard copy. No create-card fields. `pnpm verify` green (1642 tests).

### A5.10 — Don’t-break + invariant proofs

- [x] **A5.10** — Live limits, PCI scan, close phrase, 375/768, shell unchanged
  - **Files:**
    - `src/client/lib/cards.test.ts` (extend)
    - `src/client/lib/projects.test.ts` (read-only assert `WORKSPACE_TAB_HREFS` still has no settings and still includes `/cards`)
    - screens listed above — **read only** unless a §13 string or layout class is missing
  - **Do:**
    1. Assert `cardLimitsToMeters` does not clamp `remaining: -1`.
    2. Assert `airwallexRevealIframeSrc` uses origin `https://airwallex.com` and fragment token; local card id is **not** in the path (path contains `airwallexCardId` argument).
    3. Assert `parseCardListSearchParams({ holder: 'x', status: 'ACTIVE' } as never)` result has no `holder` (pass only known keys in the test; also assert a leftover extra key is not copied — the function only reads named fields).
    4. Assert `CLOSE_CONFIRM_PHRASE === 'CLOSE'` and `canCloseCard('CLOSED') === false`.
    5. Assert `controlsToDiffView` money objects and `controlsDiverge` on a MONTHLY change.
    6. Assert no file under `src/app/(app)/cards` or `src/app/(app)/projects/[id]/cards` contains `cvv`, `card_number`, or `\bPAN\b` except after stripping the allowlisted headers in §13 (same style as A4.9 / A3.9 / A2.9). `CardStructureStep.tsx` keeps its existing allowlisted header.
    7. Confirm `(app)/layout.tsx` still `requireApp()` + `AppShellFrame`. Confirm `AppShell.tsx` aside class still includes `hidden` and `md:flex`. Confirm `DEFAULT_NAV` includes `/cards` after `/projects`.
    8. Grep A5 screen files: no `useCreateCard`, no `desiredControls` in a mutate `input` except reading `card.desiredControls` for DiffView.
    9. Manual don’t-break: `/cards`, `/projects/[id]/cards`, `/cards/[id]`, `/cards/[id]/reveal`, wizard card-structure at 375px and 768px.
  - **Layout:** n/a (proof) plus the manual resize check.
  - **Pattern:** A4.9 `src/client/lib/budget.test.ts`. A3.9 `src/client/lib/access.test.ts`. A2.9 `src/client/lib/projects.test.ts`.
  - **Accept:** `pnpm test client/lib/cards` and `pnpm test client/lib/projects` and `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar on org list (filters + row links), project grid (Open/Reveal), detail (Freeze / Close / Reveal when offered), reveal (iframe ≤ viewport, Back), wizard (Next + cards Link); Menu/Sheet still works below `md`; tables may scroll inside; iframe has no fixed pixel width.
  - **Notes:** Unclamped remaining, iframe origin/fragment, no holder query, CLOSE phrase, PAN scan with §13 headers stripped, shell `hidden md:flex`, Cards after Projects, no `useCreateCard` / no PATCH `desiredControls`. `pnpm verify` green (1652 tests).

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Spec’s review checklist in `A5-cards.md` signed off:
  - [ ] No card number, CVV, or expiry exists in application state or the DOM outside the iframe
  - [ ] Reveal is permission-gated, scope-checked, and disclosed as audited
  - [ ] Limits come from the live endpoint
  - [ ] Close uses type-to-confirm and explains irreversibility
  - [ ] Rule-created cards link to the rule that created them
  - [ ] Desired-versus-applied divergence is visible rather than silently hidden
  - [ ] 375px and 768px: no page-level horizontal scrollbar; Freeze / Close / Reveal reachable; iframe not wider than the viewport
- [ ] `/dev/shell` still works (unchanged collapse)
- [ ] No new F3 primitive files
- [ ] No `call()` / `fetch` / `@/server` in `'use client'` screens
- [ ] `STATUS.md` updated with the next phase (**A6**)

## Out of scope (do not do in A5)

- AppShell collapse / second nav (A2.1)
- `/projects/[id]/settings` or a seventh workspace tab
- Create-card form / `useCreateCard` / `useCreateCardholder` / typing `transactionLimits`
- PATCH `desiredControls` / `allowedTransactionCount`
- PIN display / PIN change iframes
- `GET /issuing/cards/{id}/details`
- `useCardExplain` / rule builder (A6)
- Receipt attach (A8)
- Card CSV export (A9)
- Inventing `holderId` on `listCardsQuery`
- Editing `invalidationMap.ts` / F1 hooks / B5 contracts
- `@testing-library/react`
- `sm:` / `lg:` / `xl:` / `2xl:` on A5 screens
- Style-injection `postMessage` into the PCI iframe
