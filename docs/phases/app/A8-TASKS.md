# A8 — Activity & Transactions · Tasks

**Spec:** [A8-activity.md](./A8-activity.md)
**Model:** cheap / LOW — name every file, inline every field with type and constraints, copy the cited A1/A7/A5/A2/F1/B8 file; do not invent endpoints, change B8–B9 contracts, add primitives, reopen AppShell collapse, compute ledger remainders on the client, or hide a control without a Sheet/menu replacement.
**Depends on:** A7, complete and verified

No new API contracts. B8 already shipped `transactionContracts`. B9 already shipped `activityContracts`. The review gate is the policies + helper shapes below.

**Powers:** B8 · **Hooks (F1, already exist):** `useTransactions`, `useProjectTransactions`, `useCardTransactions`, `useTransaction`, `useDeclinedTransactions`, `useUploadReceipt`, `useDeleteReceipt`, `useActivity`, `useProjectActivity`, `useCard`, `useProjects`, `useMe`, `usePermissions`, `useCan` · **Do not call:** `useSyncTransactionsAdmin`, `useSimulatePurchase`, `useExportTransactions`, `useProjectReport`, `useOrganizationReport`, `useFinalReport`, `useStartClosure`, `useCompleteClosure`, `usePanToken`, `useCreateCard`, `usePolicyPreview` · **Guards (F0, already exist):** `requireApp` on `(app)/layout.tsx`

`useActivity` / `useProjectActivity` live in `src/client/hooks/useReports.ts` (F1). That is the only `useReports` usage in A8. Reports / closure / CSV export are A9.

Recipe: [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Visual tokens: [`../../VISUAL-DIRECTION.md`](../../VISUAL-DIRECTION.md).

**AppShell collapse is already done (A2.1).** Aside is `hidden w-56 shrink-0 flex-col md:flex`; Menu opens the same `SideNav` / `OrgSwitcher` in F3 `Sheet`. Do **not** reopen collapse. Do **not** build `MobileNav.tsx`. Do **not** add `sm:` / `lg:` / `xl:` / `2xl:` on A8 screens. A8.1 may **insert** two SideNav hrefs (`/transactions`, `/receipts`) only. `/activity` is already in `DEFAULT_NAV` (A2).

There is **no** A8 AppShell-collapse task. A2.1 owns it. Every screen task still checks 375px / 768px don’t-break, including that the existing Menu `Sheet` still works below `md`.

---

## A8.0 locked policies (do not reopen)

Approved 2026-08-17. Implementers follow these; do not re-litigate. A8.0 still implements the helpers below and STOPs before A8.1 screens.

### 1. No new contracts, no new primitives, no AppShell collapse, no client ledger

- Do **not** add or rename fields in `src/shared/schemas/*` or `src/shared/contracts/*`.
- Do **not** add `GET /api/receipts`. There is no such contract. `/receipts` is a UI route over `useTransactions({ status: 'CLEARED' })` plus `needsReceipt` (policy §7).
- Do **not** add `/projects/[id]/transactions` as a product URL (the API exists; the workspace has no Transactions tab). `WORKSPACE_TAB_HREFS` stays six. Activity is the project money/events surface.
- Do **not** add a shadcn/pattern file. Do **not** add `StatusBadge kind="transaction"` (F3 `StatusBadgeProps` has `project | card | request | ruleRun` only). Transaction status/type use F3 `Badge variant="outline"` + `transactionStatusLabel` / `transactionTypeLabel` (A5.8 already used `Badge` + raw status — A8 humanises via helpers).
- Do **not** edit `src/components/patterns/Timeline.tsx`. Rule vs human is already `actorType` chips (`USER` / `RULE` / `SYSTEM` / `AIRWALLEX`). Do not hide RULE / SYSTEM / AIRWALLEX rows.
- Do **not** import `@/server/*` from any `'use client'` file. That includes `src/server/services/transactions/ledgerMap.ts` and `receipts.ts`. Do **not** recompute COMMITMENT / RELEASE / remaining on the client. Show each lifecycle event’s `amount` + `currency` as returned.
- Do **not** call `call()` or `fetch` from a screen. Use F1 hooks. Receipt bytes: `FileReader.readAsDataURL` in the screen, then `base64FromDataUrl` (not `fetch`).
- Do **not** edit `src/client/shell/AppShell.tsx` except the `DEFAULT_NAV` array in A8.1.
- Do **not** edit `src/client/hooks/invalidationMap.ts`. F1 already invalidates transactions on receipt upload/delete.
- Do **not** edit F1 hooks except the **queryKey-only** patch in A8.2 (policy §8).
- Do **not** add `@testing-library/react`.
- Do **not** use `type="number"` or `parseFloat` on amounts. A8 has **no** amount inputs. Display through `MoneyDisplay` / F2 `formatMoney` only.
- **Never PAN / CVV / expiry.**

### 2. Routes (A8 spec wins)

| URL                          | Files                                                                              | Guard                 | Shell                       |
| ---------------------------- | ---------------------------------------------------------------------------------- | --------------------- | --------------------------- |
| `/activity`                  | `src/app/(app)/activity/page.tsx` + `ActivityFeed.tsx` (replaces A2 placeholder)   | `requireApp` (layout) | `AppShell`                  |
| `/projects/[id]/activity`    | `src/app/(app)/projects/[id]/activity/page.tsx` + `ProjectActivity.tsx`            | same                  | `AppShell` + workspace tabs |
| `/transactions`              | `src/app/(app)/transactions/page.tsx` + `TransactionList.tsx`                      | same                  | `AppShell`                  |
| `/transactions/declined`     | `src/app/(app)/transactions/declined/page.tsx` + `DeclinedList.tsx`                | same                  | `AppShell`                  |
| `/transactions/[id]`         | `src/app/(app)/transactions/[id]/page.tsx` + `TransactionDetail.tsx`               | same                  | `AppShell`                  |
| `/receipts`                  | `src/app/(app)/receipts/page.tsx` + `ReceiptsQueue.tsx`                            | same                  | `AppShell`                  |
| `/cards/[id]` (transactions) | existing `CardDetail.tsx` (A5.8 table; A8.6 adds links + billing + decline reason) | same                  | `AppShell`                  |

`/transactions/declined` is a **static** segment (`declined/page.tsx`). Do **not** treat `id === 'declined'` on `[id]`. Next.js static `declined` wins over `[id]`.

A8.1 inserts SideNav `{ href: '/transactions', label: 'Transactions' }` then `{ href: '/receipts', label: 'Receipts' }` **immediately after** `{ href: '/activity', label: 'Activity' }` and **before** Automation. Do **not** remove or rename Activity. Do **not** add Transactions / Receipts / Declines to `SETTINGS_NAV`. Declines is **not** a SideNav item — toolbar `Link` from `/transactions` (and empty-state Link).

Dashboard `/dashboard` already shows recent activity (A2.2) linking to `/activity`. Do not add a fifth dashboard card. Do not rebuild the dashboard grid (`grid-cols-1 md:grid-cols-2` stays A2).

Overview Status tile already links to `/projects/[id]/activity` (A3.1). Replacing `ComingSoonTab` in A8.2 is enough.

Wizard has no activity/receipts deferred step. Do not edit `ProjectWizard.tsx`.

### 3. Layout — one breakpoint `md`, four patterns (collapse already exists)

Copy [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Do not add `sm:` / `lg:` / `xl:` / `2xl:` (ignore pre-existing `sm:` inside F3 `Sheet` / `UserMenu` / `/dev/ui` / `DateRangePicker` — do not edit those files). `DateRangePicker` uses F3 `numberOfMonths={2}` internally; do not restyle it.

**Do not hide** the lifecycle chain, decline reason, billing amount, receipt actions, filters, or Load more on narrow. Stack them. Spec Layout: filter bars `flex flex-wrap gap-2`; transaction `DataTable` scrolls inside; Timeline stays a column; detail lifecycle chain stacks vertically. Do **not** put authorization amount and clearing amount on one `whitespace-nowrap` row.

| Screen                    | Narrow                                                                               | Desktop (`md:`)                                     |
| ------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------- |
| `/activity`               | `Timeline` column; Load more `flex-wrap`; **no** type filter bar (policy §8)         | same column — **no** `md:grid` of the feed          |
| `/projects/[id]/activity` | same Timeline column inside workspace (`min-w-0`)                                    | same; workspace tabs already `flex-wrap`            |
| `/transactions`           | `DataTable` + internal overflow; toolbar `flex-wrap`                                 | same table, **not** a card list                     |
| `/transactions/declined`  | same DataTable + wrap toolbar                                                        | same table                                          |
| `/transactions/[id]`      | stack: merchant, figures wrap, lifecycle events column, receipt, actions `flex-wrap` | same stack; **no** page `md:grid` that hides events |
| Lifecycle events          | each event its own block (`flex flex-col gap-1`); amounts wrap                       | still a vertical chain — never a horizontal stepper |
| `/receipts`               | DataTable + wrap toolbar; attach `Sheet`                                             | same; Sheet is the upload surface                   |
| `/cards/[id]` tx table    | existing table; new merchant `Link` + billing line wrap                              | same table                                          |
| Receipt upload            | F3 `Sheet` (`side="right"`) + file input                                             | same Sheet                                          |
| Org SideNav               | Transactions + Receipts appear inside existing Menu `Sheet`                          | same items in the `hidden md:flex` aside            |

Workspace tabs already `flex flex-wrap` in `ProjectWorkspace.tsx`. Do not switch them to Radix `Tabs`. Do not add a seventh tab.

Chrome Links: `buttonVariants({ variant: 'ghost' })` + `Link` for wrap-nav (A3 Slot crash — do **not** `Button asChild` for new wrap-nav Links). `Button asChild` + `Link` is OK for primary actions (A2.3 Create).

### 4. Existing contracts (copy these fields; do not redeclare)

All amounts that are numbers are **integer minor units**. Currency is ISO 4217 `string` length 3. `amount` / `billingAmount` are `z.number().int()` — **not** nonnegative (reversals / refunds may be negative). Never `parseFloat`, never `type="number"`. **Never PAN / CVV / expiry.**

**Permissions** (server is the control; client `can()` is UX only):

| Action                    | Permission                          | Hook / note                                                                                          |
| ------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Org activity feed         | `transaction.view` (inside service) | `useActivity(filter?)` — MEMBER is scoped to granting projects; 403 if none                          |
| Project activity          | `transaction.view` on that project  | `useProjectActivity(projectId, filter?)`                                                             |
| Org transaction list      | `transaction.view`                  | `useTransactions(filter?)` — **MEMBER without `projectId` → 403** (not in `ORG_WIDE_VIA_MEMBERSHIP`) |
| Project-scoped list (API) | `transaction.view`                  | `useProjectTransactions` — **do not use on A8 screens**; `/transactions` uses `useTransactions` only |
| Card-scoped list          | scoped `card.view` / tx view        | `useCardTransactions(cardId)` already on A5.8                                                        |
| Transaction detail        | scoped                              | `useTransaction(id)` — cross-org 404                                                                 |
| Declined queue            | `transaction.view`                  | `useDeclinedTransactions(filter?)` — same MEMBER + `projectId` rule as org list                      |
| Upload receipt            | own or `transaction.view`           | `useUploadReceipt` — optimistic on `qk.transaction(id)`                                              |
| Delete receipt            | own or `card.manage`                | `useDeleteReceipt`                                                                                   |

`PermissionGate` requires `projectId: string`. On `/transactions`, `/transactions/declined`, `/receipts`: if a project is selected, wrap primary actions with `PermissionGate` `projectId={projectId}` `permission="transaction.view"`. If projectId is missing, do **not** pass `''`. OWNER/ADMIN may load org-wide without a project (policy §6). MEMBER without a project: EmptyState + project Select; **do not** call the list hook.

---

**`transactionSchema`** (`src/shared/schemas/transaction.ts`) — display fields A8 uses:

```
{
  id: string min 1,
  orgId: string min 1,
  cardId: string min 1,
  projectId: string min 1,
  airwallexTransactionId: string min 1,
  cardTransactionId: string min 1,
  lifecycleId: string min 1,          // required; do not treat as optional
  type: 'AUTHORIZATION' | 'CLEARING' | 'REVERSAL_AUTH' | 'INCREMENTAL_AUTHORIZATION'
        | 'PARTIAL_REVERSAL' | 'PARTIAL_CLEARING' | 'EXPIRED_AUTHORIZATION' | 'CLEARING_REVERSAL',
  status: 'AUTHORIZED' | 'VERIFIED' | 'CLEARED' | 'REVERSED' | 'EXPIRED' | 'DECLINED',
  amount: int,                        // minor units; may be negative
  currency: string length 3,
  billingAmount: int,                 // minor units; may be negative
  billingCurrency: string length 3,
  merchant: {
    name: string min 1 max 500,
    mcc: string min 1 max 8,          // leading zeros possible; display as text
    country: string min 1 max 3
  },
  failureReason: string | null,       // decline reason; no ruleId on the wire
  receiptFileId: string min 1 | null,
  transactedAt: iso datetime,
  createdAt: iso datetime,
  updatedAt: iso datetime
}
```

**`transactionDetailSchema`** = `transactionSchema` + `lifecycleEvents: transactionSchema[]` (full chain for this `lifecycleId`). `GET /api/transactions/:id` returns this. The parent row is one event; `lifecycleEvents` is the chain (may include the parent). Do not drop events. Do not collapse AUTHORIZATION + CLEARING into one amount.

**`transactionMerchantSchema`:** never treat MCC as a number.

---

**`GET /api/transactions`** — `transactionContracts.list` — `transaction.view` — input `listTransactionsQuery`:

```
{
  cardId?: string min 1,
  projectId?: string min 1,
  status?: 'AUTHORIZED' | 'VERIFIED' | 'CLEARED' | 'REVERSED' | 'EXPIRED' | 'DECLINED',
  from?: iso datetime,
  to?: iso datetime,
  page: coerce int min 1 default 1,
  pageSize: coerce int min 1 max 100 default 20
}
```

Output `transactionListSchema`: `{ items: transactionSchema[], page: int min 1, pageSize: int min 1, total: int min 0 }`.

Hook `useTransactions(filter?)` is **infinite, page-based** (F1.0 locked — **not** a B9 cursor). Flatten `data.pages` via `flattenTransactionPages`. DataTable `pagination.mode: 'cursor'` with sentinel `nextCursor: hasNextPage ? 'next' : null` (A5.8). Do **not** put `page` in the URL. Do **not** migrate this list to opaque cursors. Do **not** client-refilter a page by merchant / status / missing-receipt except the receipts queue rule in §7.

---

**`GET /api/projects/:id/transactions`** — `.listForProject` — input `listProjectTransactionsQuery` (no `cardId` / `projectId` in query; project is the path). **A8 screens do not call this hook.**

**`GET /api/cards/:id/transactions`** — `.listForCard` — already used in A5.8. A8.6 edits columns only; still no `status` filter on that table.

**`GET /api/transactions/:id`** — `.get` — input `z.void()` — output `transactionDetailSchema`. Cross-org → 404.

**`GET /api/transactions/declined`** — `.listDeclined` — input `listDeclinedTransactionsQuery`:

```
{
  cardId?: string min 1,
  projectId?: string min 1,
  from?: iso datetime,
  to?: iso datetime,
  page: coerce int min 1 default 1,
  pageSize: coerce int min 1 max 100 default 20
}
```

No `status` query field (server forces `DECLINED`). Do not send `status`. Output `transactionListSchema`. Hook `useDeclinedTransactions` — same page-based infinite as `useTransactions`.

---

**`POST /api/transactions/:id/receipt`** — `.uploadReceipt` — input `uploadReceiptInput`:

```
{
  fileName: string min 1 max 255,
  contentType: 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp',
  contentBase64: string min 1        // raw base64, NOT a data-URL prefix
}
```

Output `transactionSchema`. Handler also caps `contentBase64.length` at `10 * 1024 * 1024`. Optimistic: F1 sets `receiptFileId` to `'optimistic-receipt'` then invalidates. There is **no** GET-receipt / download contract — show attached vs missing only; never render file bytes.

**`DELETE /api/transactions/:id/receipt`** — `.deleteReceipt` — input `z.void()` — output `z.void()`.

---

**`activityItemSchema`** (`src/shared/schemas/activity.ts`):

```
{
  id: string min 1,
  orgId: string min 1,
  projectId: string min 1 | null,
  type: 'TRANSACTION' | 'PURCHASE_REQUEST' | 'APPROVAL' | 'CARD' | 'ACCESS' | 'RULE_RUN' | 'AUDIT',
  at: iso datetime,
  actorType: 'USER' | 'RULE' | 'SYSTEM' | 'AIRWALLEX',   // native enum ActorType
  actorId: string min 1,
  subjectType: string min 1,
  subjectId: string min 1,
  summary: string min 1 max 500,
  payload: Record<string, unknown>     // denormalised facts; do not dump domain docs
}
```

**`listActivityQuery`:**

```
{
  type?: ActivityItemType,
  actorId?: string min 1,
  projectId?: string min 1,
  from?: iso datetime,
  to?: iso datetime,
  cursor?: string min 1,               // opaque { at, id } base64url — never an offset
  limit: coerce int min 1 max 100 default 20
}
```

Output `{ items: activityItemSchema[], nextCursor: string | null }`.

**`GET /api/activity`** — `activityContracts.list` — hook `useActivity`. Permission is inside `listActivity` (MEMBER → projects granting `transaction.view`).

**`GET /api/projects/:id/activity`** — `.listForProject` — hook `useProjectActivity(projectId, filter?)`. Path id is the project; **omit** `projectId` from the filter object (the route sets it). Cross-org project → 404.

This is the B9 cursor. Spec “cursor pagination is stable when new items arrive at the head” applies **here**, not to transaction lists. Pass `cursor` only as the infinite `pageParam`. Do **not** put `cursor` in the URL.

`payload` facts the feed already sets (do not invent more):

- TRANSACTION: `cardId`, `amount` (int), `currency`, `status`, `type`, optional `cardholderUserId` / `userId`
- PURCHASE_REQUEST: `status`, `amount`, `currency`, `requestedBy`, `userId`
- APPROVAL: `decision`, `requestedBy`, `userId`, `approverId`
- CARD / ACCESS / AUDIT: `action`
- RULE_RUN: `ruleId`, `status`, `matched`

Do **not** parse `payload` to rebuild money except to optionally `MoneyDisplay` when `typeof amount === 'number'` and `typeof currency === 'string'` && `currency.length === 3`. Summary already has formatted money from the server (`transactionFeedSummary`). Default: render `summary` via `toTimelineItem` + `Timeline`.

---

**Also used, already shipped:**

- `GET /api/projects` — `useProjects({ page: 1, pageSize: 100 })` for project Selects.
- `GET /api/cards/:id` — `useCard(cardId)` on transaction detail (closed-card Alert) and declined “governing rules” Links.
- `GET /api/me` — `user.id`, `activeOrg.baseCurrency`, `memberships[].orgRole`.
- `closedCardMessage()` from `src/client/lib/cards.ts` — `'This card is closed. It is kept for transaction history.'`
- `cardExplainHref(cardId)` from `src/client/lib/rules.ts` — `/cards/${id}/explain` (A6.9).
- `toTimelineItem` from `src/client/lib/projects.ts` — do not duplicate; import it.

**Do not use `useAudit` for the activity feed.** The B9 feed already merges audit-backed CARD / ACCESS / AUDIT rows.

### 5. Authorization vs clearing (do not collapse)

An AUTHORIZATION is pending money (`status: 'AUTHORIZED'`). A CLEARING / PARTIAL_CLEARING is spent money. Amounts can differ. On `/transactions/[id]`:

1. Header shows **this event’s** `MoneyDisplay { amount, currency }` and `transactionStatusLabel(status)` / `transactionTypeLabel(type)` — never a summed chain total.
2. If `billingDiffers(currency, billingCurrency)`, also show `MoneyDisplay { amount: billingAmount, currency: billingCurrency }` with locked billed-as copy. Same on list rows.
3. Below, heading `Lifecycle` and a **vertical** list of `lifecycleEvents` sorted by `lifecycleSorted` (transactedAt asc, then id). Each event: type label, status `Badge`, `MoneyDisplay` amount, optional billing, `formatDateTime(transactedAt)`, `Link` `transactionHref(event.id)` if `event.id !== currentId`.
4. If `authorizationAmount(events)` and `clearingAmount(events)` are both numbers and they differ: `Alert` locked copy (informational). Do not invent a remainder int from those two numbers beyond showing both.
5. `type === 'PARTIAL_CLEARING'`: additional `Alert` locked partial-clearing copy. Do not compute leftover commitment.
6. `status === 'AUTHORIZED'` (and no clearing event in the chain): `Alert` locked pending-auth copy.
7. Reversal / refund (`isReversalType` / `status === 'REVERSED'`): `Alert` locked reversal copy. Negative amounts still go through `MoneyDisplay` (`colorBySign`).
8. Card `useCard(cardId)` `status === 'CLOSED'`: `Alert` `closedCardMessage()` (re-export). History stays visible.

### 6. MEMBER vs OWNER on org-wide transaction lists

`transaction.view` is **not** in `ORG_WIDE_VIA_MEMBERSHIP`. OWNER/ADMIN may call `useTransactions` / `useDeclinedTransactions` with no `projectId`. MEMBER without `projectId` gets 403.

Lock:

- `requiresProjectIdOnTxList(orgRole)` true unless `orgRole === 'OWNER' || orgRole === 'ADMIN'`.
- `/transactions`, `/transactions/declined`, `/receipts`: project `Select` always in the toolbar. If `requiresProjectIdOnTxList` and no `projectId`: `EmptyState` `selectProjectEmpty()`; **do not** call the list hook.
- Else call the hook with the parsed filter (omit empty `projectId` for OWNER/ADMIN org-wide).
- `/activity` does **not** require a project Select (service scopes MEMBER). Still 403 → `ErrorState`.

Do **not** fan-out `useTransactions` across every project.

### 7. Missing-receipt queue (no GET /api/receipts)

B8.8 sweep: `status === 'CLEARED' && receiptFileId === null && amount >= 5000` (minor units, no FX). Constant `RECEIPT_THRESHOLD_MINOR = 5000`.

`/receipts`:

1. Same MEMBER/project rule as §6.
2. `useTransactions({ ...filter, status: 'CLEARED', pageSize: 20 })` — **always** send `status: 'CLEARED'`. Do not send a fake `missingReceipt` query key.
3. Flatten pages. **Display-filter** with `needsReceipt`. Do **not** show API `total` as the queue size (it counts all CLEARED).
4. EmptyState `noReceiptsEmpty()` only when `!isPending && !hasNextPage && filtered.length === 0`.
5. DataTable of **filtered** rows. Load more still `fetchNextPage` (user may load more CLEARED rows to reveal more missing). Helper text locked `receiptsLoadMoreHint()` under the table when `hasNextPage`.
6. Attach: row action opens `Sheet` with `<input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp">` (not `type="number"`). On change: reject via locked copy if `receiptContentType(file.type)` is null or `file.name` empty / > 255; `FileReader.readAsDataURL` → `base64FromDataUrl` → if `contentBase64.length > RECEIPT_MAX_BASE64_CHARS` reject; else `useUploadReceipt().mutate({ id, input: { fileName, contentType, contentBase64 } })`.
7. Delete: `ConfirmDialog` locked copy → `useDeleteReceipt({ id })` when `receiptFileId` is a real id (not `'optimistic-receipt'`).

Do not invent OCR, preview, or download.

### 8. Activity filters, F1 queryKey, cursor stability

Org `/activity` and project activity render the **full merged feed** (all `ActivityItemType`s). Spec wants one Timeline of transactions + requests + approvals + cards + access + rule runs.

- **No** type / actorId / from / to filter bar on activity screens (avoids the F1 bug that `activityInfiniteQueryOptions` keys `qk.activity()` **without** `filter`, so a type Select would show a stale page).
- A8.2 **does** patch `src/client/hooks/useReports.ts` queryKey only:

  `activityInfiniteQueryOptions`: `queryKey: [...qk.activity(), filter ?? {}] as const`

  `projectActivityInfiniteQueryOptions`: `queryKey: [...qk.activity(projectId), filter ?? {}] as const`

  Do not change `queryFn`, `qk.activity` itself, or `invalidationMap`. This keeps a future filter from lying; A8 still passes `{ limit: 20 }` (org) / `{ limit: 20 }` (project, no `projectId` in filter).

- Flatten `pages.flatMap(p => p.items)`. `toTimelineItem` each row. F3 `Timeline`. Load more button when `hasNextPage`. Do not put `cursor` in the URL.
- Do not client-dedupe beyond what the API returns. New head items appear on refetch; do not write a custom prepend merge.

### 9. Declines — reason on the wire; no invented ruleId

`failureReason: string | null` is the decline reason (Airwallex / remote-auth string). `transactionSchema` has **no** `ruleId`.

- Always show `declineReason(failureReason)` (verbatim, or locked fallback).
- On declined list + detail: `Link` `cardHref(cardId)` and `Link` `cardExplainHref(cardId)` with locked `whyThisLimitLink()` so the user can see governing rules (A6.9). Do **not** claim a specific rule caused the decline unless `failureReason` already names it.
- Do not call `useSimulatePurchase` / `useValidateRule` to guess.

### 10. Extra invalidation, money, PAN, testing, ESLint

- Do not edit `invalidationMap.ts`. Receipt mutations already invalidate.
- Amounts are **never** clamped. Negative `amount` / `billingAmount` render via `MoneyDisplay` `colorBySign`.
- Tests: pure helpers in `src/client/lib/transactions.ts` with vitest **node**.
- Screen Accept always includes `pnpm verify` plus **375px and 768px**: no page-level horizontal scrollbar; primary actions reachable; tables may scroll **inside**; lifecycle / decline reason / billing / receipt Sheet reachable by **vertical** scroll (stacked, not `hidden`).
- `(app)` already bans `call()` / `fetch`. Do not add a `@/server` ban (server layout still uses `requireApp`).
- Barrel: **named** exports from `src/client/lib/index.ts` (do **not** `export * from '@/client/lib/transactions'` — `parseOptionalIdParam` would clash with A6 `rules.ts` / A7 `requests.ts`).

### 11. Locked copy (do not paraphrase)

| Situation                       | Surface                | Copy                                                                                                                                                        |
| ------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot view transactions        | `PermissionGateView`   | `You don't have permission to view transactions.`                                                                                                           |
| Select a project (MEMBER lists) | `EmptyState`           | title `Select a project` / description `Transactions are listed per project.`                                                                               |
| No transactions                 | `EmptyState`           | title `No transactions yet` / description `When a card is used, activity appears here.`                                                                     |
| No declined                     | `EmptyState`           | title `No declined transactions` / description `A decline is a policy working or a misconfiguration.`                                                       |
| No activity (org)               | `EmptyState`           | title `No activity yet` / description `Transactions, requests, cards, and rule runs land here.`                                                             |
| No activity (project)           | `EmptyState`           | title `No activity yet` / description `This project has no feed items yet.`                                                                                 |
| No missing receipts             | `EmptyState`           | title `No missing receipts` / description `Cleared spend over the threshold needs a receipt.`                                                               |
| Receipts load-more hint         | helper                 | `Load more to check older cleared transactions.`                                                                                                            |
| Transaction not found           | `ErrorState`           | `This transaction is not available.`                                                                                                                        |
| Project not found               | `ErrorState`           | `This project is not available.`                                                                                                                            |
| Pending authorization           | `Alert`                | `Authorized — not yet cleared.`                                                                                                                             |
| Auth vs clearing amounts differ | `Alert`                | `Cleared amount differs from the authorization.`                                                                                                            |
| Partial clearing                | `Alert`                | `Partial clearing — remainder may still be committed.`                                                                                                      |
| Reversal / refund               | `Alert`                | `This transaction was reversed or refunded.`                                                                                                                |
| Closed card                     | `Alert`                | `closedCardMessage()` from `src/client/lib/cards.ts`                                                                                                        |
| Decline fallback                | line                   | `No reason recorded.`                                                                                                                                       |
| Billed as                       | line                   | `Billed as` then `MoneyDisplay` of billing                                                                                                                  |
| Why this limit                  | Link                   | `Why this limit?`                                                                                                                                           |
| Lifecycle heading               | heading                | `Lifecycle`                                                                                                                                                 |
| Receipt attached                | line                   | `Receipt attached.`                                                                                                                                         |
| Receipt missing                 | line                   | `Receipt required.`                                                                                                                                         |
| Receipt not required            | line                   | `No receipt required.`                                                                                                                                      |
| Bad file type                   | `Alert`                | `Use a PDF or image (JPEG, PNG, or WebP).`                                                                                                                  |
| File too large                  | `Alert`                | `File too large (max 10MB).`                                                                                                                                |
| Attach receipt                  | Button / Sheet title   | `Attach receipt`                                                                                                                                            |
| Remove receipt                  | `ConfirmDialog`        | title `Remove this receipt?` description `The file is deleted. You can attach another.` confirm `Remove receipt` variant `destructive` (no `typeToConfirm`) |
| Declines nav link               | Link                   | `Declines`                                                                                                                                                  |
| Load more                       | Button                 | `Load more`                                                                                                                                                 |
| 403 / 409 / 422                 | `Alert` / `ErrorState` | server `error.message`                                                                                                                                      |

---

## Contracts first

- [x] **A8.0** — Transaction / activity helpers (STOP for review)
  - **Files:**
    - `src/client/lib/transactions.ts` (create)
    - `src/client/lib/transactions.test.ts` (create)
    - `src/client/lib/index.ts` (edit — **named** exports only, same style as A7 `requests`)
  - **Do:** No React screens. No AppShell / feed / table changes yet. Implement the locked helper API (pure, no React, no `call()`, no `FileReader`):
    1. `RECEIPT_THRESHOLD_MINOR`: `5000`.
    2. `RECEIPT_MAX_BASE64_CHARS`: `10 * 1024 * 1024`.
    3. `RECEIPT_CONTENT_TYPES`: `['application/pdf', 'image/jpeg', 'image/png', 'image/webp']` as const.
    4. `activityHref(): string` — `'/activity'`.
    5. `projectActivityHref(projectId: string): string` — `/projects/${projectId}/activity`. Throw if `projectId.length < 1`.
    6. `transactionsHref(): string` — `'/transactions'`.
    7. `transactionHref(transactionId: string): string` — `/transactions/${transactionId}`. Throw if empty.
    8. `declinedHref(): string` — `'/transactions/declined'`.
    9. `receiptsHref(): string` — `'/receipts'`.
    10. Re-export `cardHref`, `flattenTransactionPages`, `closedCardMessage` from `src/client/lib/cards.ts`. Re-export `cardExplainHref` from `src/client/lib/rules.ts`. Do not duplicate.
    11. `parseOptionalIdParam(input: string | string[] | undefined): string | undefined` — arrays use `[0]`; empty → undefined. Copy A7.0 / A6.0 behaviour; do **not** import it from `requests.ts` or `rules.ts`.
    12. `parseIsoQueryParam(input: string | string[] | undefined): string | undefined` — `firstParam`; `isoDateSchema.safeParse`; failure → undefined.
    13. `parseTxStatusParam(input: string | string[] | undefined): TransactionStatus | undefined` — must be one of `AUTHORIZED | VERIFIED | CLEARED | REVERSED | EXPIRED | DECLINED`; else undefined.
    14. `parseTransactionListSearchParams(input: { projectId?: string | string[]; cardId?: string | string[]; status?: string | string[]; from?: string | string[]; to?: string | string[] }): { projectId?: string; cardId?: string; status?: TransactionStatus; from?: string; to?: string }` — drop unknown keys (including `page`, `cursor`, `merchant`, `missingReceipt`). Omit empty ids. Do **not** default `status`.
    15. `transactionListHref(filter: { projectId?: string; cardId?: string; status?: string; from?: string; to?: string }): string` — path `/transactions`; omit empty / undefined keys.
    16. `parseDeclinedSearchParams(input: { projectId?: string | string[]; cardId?: string | string[]; from?: string | string[]; to?: string | string[] }): { projectId?: string; cardId?: string; from?: string; to?: string }` — drop `status` if present.
    17. `declinedListHref(filter: { projectId?: string; cardId?: string; from?: string; to?: string }): string` — path `/transactions/declined`.
    18. `receiptsListHref(filter: { projectId?: string; from?: string; to?: string }): string` — path `/receipts`.
    19. `parseReceiptsSearchParams` — same keys as receipts href (no `status` / `cardId` in the UI filter; status is forced CLEARED in the hook).
    20. `holdsTransactionView(orgRole: string | undefined, projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined): boolean` — `orgRole === 'OWNER' \|\| orgRole === 'ADMIN'` OR any project `permissions.includes('transaction.view')`. Copy `holdsRequestApprove` shape in `src/client/lib/requests.ts`.
    21. `requiresProjectIdOnTxList(orgRole: string | undefined): boolean` — true unless OWNER or ADMIN.
    22. `billingDiffers(currency: string, billingCurrency: string): boolean` — both length 3 and `currency !== billingCurrency`.
    23. `needsReceipt(row: { status: string; receiptFileId: string | null; amount: number }): boolean` — `status === 'CLEARED' && receiptFileId === null && amount >= RECEIPT_THRESHOLD_MINOR`. Negative amount → false. Do not clamp.
    24. `receiptLabel(row: { status: string; receiptFileId: string | null; amount: number }): string` — attached (`receiptFileId` min 1) → `Receipt attached.`; `needsReceipt` → `Receipt required.`; else `No receipt required.`
    25. `declineReason(failureReason: string | null): string` — string min 1 → as-is; else `No reason recorded.`
    26. `isPendingAuthorization(status: string, types: ReadonlyArray<{ type: string }>): boolean` — `status === 'AUTHORIZED'` and no event `type === 'CLEARING' \|\| type === 'PARTIAL_CLEARING'`.
    27. `isReversalType(type: string): boolean` — `REVERSAL_AUTH` \| `PARTIAL_REVERSAL` \| `CLEARING_REVERSAL`.
    28. `lifecycleSorted<T extends { transactedAt: string; id: string }>(events: readonly T[]): T[]` — copy, sort `transactedAt` asc then `id` asc. Do not mutate input.
    29. `authorizationAmount(events: ReadonlyArray<{ type: string; amount: number }>): number | null` — last `type === 'AUTHORIZATION'` or `INCREMENTAL_AUTHORIZATION` amount; else null.
    30. `clearingAmount(events: ReadonlyArray<{ type: string; amount: number }>): number | null` — last `CLEARING` or `PARTIAL_CLEARING` amount; else null.
    31. `authClearingDiffer(events: ReadonlyArray<{ type: string; amount: number }>): boolean` — both amounts numbers and `a !== b`.
    32. `transactionStatusLabel(status: string): string` — split `_`, title-case (`AUTHORIZED` → `Authorized`). Unknown → the raw string.
    33. `transactionTypeLabel(type: string): string` — same humanise (`PARTIAL_CLEARING` → `Partial clearing`).
    34. `receiptContentType(mime: string): 'application/pdf' | 'image/jpeg' | 'image/png' | 'image/webp' | null` — map `image/jpg` → `image/jpeg`; else exact enum match; else null.
    35. `base64FromDataUrl(dataUrl: string): string` — if `dataUrl.includes(',')`, return the substring after the **first** comma; else return `dataUrl`. Do not decode.
    36. `isOptimisticReceiptId(id: string | null): boolean` — `id === 'optimistic-receipt'`.
    37. Copy functions for locked §11 sentences: `viewTransactionsDenialMessage()`, `transactionNotFoundMessage()`, `pendingAuthMessage()`, `authClearingDifferMessage()`, `partialClearingMessage()`, `reversalMessage()`, `billedAsLabel()`, `whyThisLimitLink()`, `lifecycleHeading()`, `badReceiptTypeMessage()`, `receiptTooLargeMessage()`, `receiptsLoadMoreHint()`, plus EmptyState pairs `selectProjectEmpty()`, `noTransactionsEmpty()`, `noDeclinedEmpty()`, `noActivityEmpty()`, `noProjectActivityEmpty()`, `noReceiptsEmpty()` returning `{ title, description }`. Reuse `closedCardMessage` via re-export (do not copy the string).
  - **Pattern:** A1-equivalent **A1.0** `src/client/lib/auth.ts` (first Track A helper file). Copy the recent shape from A7.0 `src/client/lib/requests.ts` + `src/client/lib/requests.test.ts` (hrefs, `firstParam`, `appendQuery`, `holdsX`, EmptyState pairs, named barrel). URL parse: `parseCardListSearchParams` in `src/client/lib/cards.ts` (A5.0). Contracts to copy fields from: `src/shared/schemas/transaction.ts`, `src/shared/contracts/transaction.ts` (B8), `src/shared/schemas/activity.ts`, `src/shared/contracts/activity.ts` (B9). Enums: `src/shared/enums/transactionStatus.ts`, `src/shared/enums/transactionType.ts`, `src/shared/enums/activityItemType.ts`. Threshold: `THRESHOLD_MINOR_UNITS = 5_000` in `src/server/services/transactions/receiptSweep.ts` (read only — do not import server). Flatten: already `flattenTransactionPages` in `cards.ts`.
  - **STOP and get this reviewed before A8.1+.** An invented `GET /api/receipts`, a client `ledgerMap`, hiding the lifecycle chain below `md`, treating activity as page-offset, or adding `StatusBadge kind="transaction"` is a rewrite.
  - **Accept:** `pnpm test client/lib/transactions` — cover: `transactionHref('t1')` is `/transactions/t1`; `transactionHref('')` throws; `declinedHref()` is `/transactions/declined`; `projectActivityHref('p')` is `/projects/p/activity`; `transactionListHref({ page: 1 } as never)` does not need to accept page — `transactionListHref({})` is `/transactions`; `transactionListHref({ projectId: 'p', status: 'CLEARED' })` is `/transactions?projectId=p&status=CLEARED`; `parseTransactionListSearchParams({ status: 'NOPE', merchant: 'x', page: '2' } as never)` has no `status` / `merchant` / `page`; `parseDeclinedSearchParams({ status: 'CLEARED' } as never)` has no `status`; `requiresProjectIdOnTxList('MEMBER')` true; `requiresProjectIdOnTxList('OWNER')` false; `holdsTransactionView('MEMBER', [{ permissions: ['transaction.view'] }])` true; `holdsTransactionView('MEMBER', [{ permissions: ['payment.make'] }])` false; `billingDiffers('USD', 'EUR')` true; `billingDiffers('USD', 'USD')` false; `needsReceipt({ status: 'CLEARED', receiptFileId: null, amount: 5000 })` true; `needsReceipt({ status: 'CLEARED', receiptFileId: null, amount: 4999 })` false; `needsReceipt({ status: 'AUTHORIZED', receiptFileId: null, amount: 9000 })` false; `needsReceipt({ status: 'CLEARED', receiptFileId: 'f', amount: 9000 })` false; `declineReason(null)` locked fallback; `declineReason('LIMIT_EXCEEDED')` is `LIMIT_EXCEEDED`; `lifecycleSorted` does not mutate and sorts by `transactedAt` then `id`; `authClearingDiffer([{ type: 'AUTHORIZATION', amount: 100 }, { type: 'CLEARING', amount: 90 }])` true; `authClearingDiffer` same amounts false; `authorizationAmount` last AUTHORIZATION; `receiptContentType('image/jpg')` is `image/jpeg`; `receiptContentType('text/plain')` is null; `base64FromDataUrl('data:image/png;base64,QQ==')` is `QQ==`; `isOptimisticReceiptId('optimistic-receipt')` true; `transactionTypeLabel('PARTIAL_CLEARING')` is `Partial clearing`; `transactionStatusLabel('AUTHORIZED')` is `Authorized`.
  - **Notes:** Helpers in `src/client/lib/transactions.ts` (22 unit tests). No `GET /api/receipts`; MEMBER lists require projectId; activity stays cursor; declines have no invented `ruleId`. Barrel named-exports (clash with A6/A7 `parseOptionalIdParam` / `selectProjectEmpty`). `pnpm verify` green (1741 tests). STOP before A8.1 screens.

---

## Tasks

### A8.1 — SideNav + route shells

- [ ] **A8.1** — Insert Transactions + Receipts; placeholders so links do not 404
  - **Files:**
    - `src/client/shell/AppShell.tsx` (edit — `DEFAULT_NAV` only)
    - `src/app/(app)/transactions/page.tsx` (create — placeholder until A8.3)
    - `src/app/(app)/transactions/declined/page.tsx` (create — placeholder until A8.5)
    - `src/app/(app)/transactions/[id]/page.tsx` (create — placeholder until A8.4)
    - `src/app/(app)/receipts/page.tsx` (create — placeholder until A8.7)
  - **Do:**
    1. `DEFAULT_NAV`: after `{ href: '/activity', label: 'Activity' }` insert `{ href: '/transactions', label: 'Transactions' }` then `{ href: '/receipts', label: 'Receipts' }`, then existing Automation. Do **not** change aside `hidden md:flex` / Menu / Sheet / `w-56`. Do **not** touch `SETTINGS_NAV`. Do **not** add Declines to the nav.
    2. Placeholders: `<main className="min-w-0">{label} — not built yet</main>` for Transactions list, Declined, Transaction detail, Receipts. Must **not** 404. Static `declined/page.tsx` must win over `[id]`.
    3. Do **not** replace `/activity` or `projects/[id]/activity` yet (A8.2). Do not edit `CardDetail.tsx`.
  - **Layout:** n/a for placeholders (stack `min-w-0`). Shell collapse unchanged. New hrefs are in the aside at `md` and in the Menu `Sheet` below `md` (same `SideNav`).
  - **Pattern:** A1-equivalent **A1.1** `src/app/(auth)/layout.tsx` (first Track A route chrome — centred column; A8 still uses AppShell). Copy A7.1 `src/client/shell/AppShell.tsx` `DEFAULT_NAV` insert. Collapse already A2.1 — `docs/RESPONSIVENESS.md` §1; do **not** copy A2.1’s aside rewrite. Placeholders: A5.1 `/cards` pages. Static segment win: A7.1 `requests/new/page.tsx` vs `[id]`.
  - **Accept:** `pnpm verify`. `/transactions`, `/transactions/declined`, `/transactions/any-id`, `/receipts` are not 404. `/transactions/declined` is **not** the `[id]` placeholder (static wins). SideNav at 768px shows Activity, then Transactions, then Receipts, then Automation; at 375px those labels appear inside the existing Menu Sheet. 375px and 768px: no page-level horizontal scrollbar; Menu/Sheet still works below `md`. Aside still `hidden md:flex`. `AppShell.tsx` does not lose `hidden` or `md:flex`. `SETTINGS_NAV` still four hrefs (no Transactions / Receipts).
  - **Notes:** _{filled in on completion}_

### A8.2 — Activity feeds

- [ ] **A8.2** — Org `/activity` + project tab; Timeline; cursor Load more
  - **Files:**
    - `src/client/hooks/useReports.ts` (edit — **queryKey only** on `activityInfiniteQueryOptions` and `projectActivityInfiniteQueryOptions` per policy §8)
    - `src/client/hooks/useReports.test.ts` (edit — if a test snapshots `queryKey`, expect `filter ?? {}` appended)
    - `src/app/(app)/activity/page.tsx` (replace A2 placeholder)
    - `src/app/(app)/activity/ActivityFeed.tsx` (`'use client'`)
    - `src/app/(app)/projects/[id]/activity/page.tsx` (replace `ComingSoonTab`)
    - `src/app/(app)/projects/[id]/activity/ProjectActivity.tsx` (`'use client'`)
  - **Do:**
    1. QueryKey patch only (policy §8). `queryFn` still spreads `filter` + `cursor: pageParam`.
    2. Org page renders `<ActivityFeed />` only. `useActivity({ limit: 20 })`. **No** type / date / project Select. Flatten `data.pages.flatMap(p => p.items)`. Map `toTimelineItem` from `src/client/lib/projects.ts`. F3 `Timeline` `empty={noActivityEmpty()}`. 403 → `ErrorState` `error.message`. Loading: `Timeline` `loading` or `LoadingState`.
    3. Actions `flex flex-wrap gap-2`: `Button` `Load more` when `hasNextPage` (`fetchNextPage`); disabled while `isFetchingNextPage`. Optional `Link` `transactionsHref()` ghost.
    4. Project page: `parseOptionalIdParam` on `useParams().id`. `useProjectActivity(id, { limit: 20 })` — **do not** pass `projectId` in the filter. 404 → `This project is not available.` 403 → `error.message`. `empty={noProjectActivityEmpty()}`. Same Timeline + Load more. Wrap in `min-w-0`. Do not add a seventh workspace tab.
    5. Do **not** edit `Timeline.tsx`. Do not hide `actorType === 'RULE'`. Do not client-filter `items` by type. Do not put `cursor` in the URL. Do not call `useAudit` / `useTransactions` to build the feed.
  - **Layout:** Timeline column (already a column). Load more wrap. No `md:grid`. No Sheet. No filter bar. `min-w-0`. Workspace tabs already wrap.
  - **Pattern:** A1-equivalent **A1.5** `src/app/(onboarding)/onboarding/page.tsx` (first Track A list). Copy A2.2 `src/app/(app)/dashboard/DashboardHome.tsx` (`useActivity({ limit: 8 })` + `toTimelineItem` + `Timeline`). Hook: `useActivity` / `useProjectActivity` `src/client/hooks/useReports.ts` (B9 `activityContracts`). `ComingSoonTab` replacement: A6.2 `ProjectControls.tsx` replacing the tab body. Cursor Load more: A5.8 `CardDetail.tsx` DataTable sentinel — here a Button, not a table.
  - **Accept:** `pnpm verify`. `ActivityFeed.tsx` contains `useActivity` and `Timeline` and does **not** contain `useAudit`, `evaluatePolicy`, `parseFloat`, or `type="number"`. `ProjectActivity.tsx` contains `useProjectActivity` and does not pass `projectId` inside the filter object. `useReports.ts` activity queryKeys include `filter ?? {}`. 375px and 768px: no page-level horizontal scrollbar; Load more reachable; Timeline stacked not `hidden`; Menu/Sheet still works; project workspace tabs wrap. `WORKSPACE_TAB_HREFS` still six.
  - **Notes:** _{filled in on completion}_

### A8.3 — Org transaction list

- [ ] **A8.3** — `/transactions` DataTable; filters wrap; MEMBER needs `?projectId=`
  - **Files:**
    - `src/app/(app)/transactions/page.tsx` (replace placeholder)
    - `src/app/(app)/transactions/TransactionList.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<TransactionList />` only.
    2. `parseTransactionListSearchParams` from `useSearchParams`. `useMe` for `memberships[].orgRole` (active org). `useProjects({ page: 1, pageSize: 100 })` for the Select.
    3. If `requiresProjectIdOnTxList(orgRole)` and no `projectId`: `EmptyState` `selectProjectEmpty()` + project `Select` writing `transactionListHref`; **do not** call `useTransactions`.
    4. Else `useTransactions({ ...filter, pageSize: 20 })` (omit undefined keys; do not send `page`). Flatten `flattenTransactionPages`. **No client-side refilter.** 403 → `ErrorState` `error.message`. Loading: `LoadingState` / table `loading`.
    5. Toolbar `flex flex-wrap gap-2 min-w-0`: Project `Select` (`__all__` only if `!requiresProjectIdOnTxList`; changing project resets other filters as-is but must not send `''`); Status `Select` `__all__` + each `TransactionStatus`; `DateRangePicker` `from`/`to` (`src/components/ui/date-range-picker.tsx`) writing ISO via `calendarDayToIso` already inside F3; `Link` `declinedListHref({ projectId: filter.projectId })` label `Declines`; `Link` `receiptsListHref({ projectId: filter.projectId })` label `Receipts`. Use `buttonVariants` + `Link` for those two.
    6. If flattened length 0 and not loading and `!hasNextPage`: `EmptyState` `noTransactionsEmpty()`.
    7. Else `DataTable` columns: `transactedAt` (`formatDateTime` `src/lib/dates.ts`), `merchant.name` (`Link` `transactionHref(row.id)`, `min-w-0 break-words`), `amount` (`MoneyDisplay` `{ amount: row.amount, currency: row.currency }` `colorBySign` — if `billingDiffers`, second line `billedAsLabel()` + billing `MoneyDisplay`), `status` (`Badge variant="outline"` + `transactionStatusLabel`), `type` (`transactionTypeLabel`). `getRowId: (row) => row.id`. Pagination `mode: 'cursor'` sentinel `'next'` + `fetchNextPage` (A5.8). Do **not** restyle as cards. Do **not** add a second `overflow-x-auto`. Do not show API `total` as a headline.
    8. Do not fetch on the server. Do not upload receipts here. Do not call `useDeclinedTransactions` on this page.
  - **Layout:** table scrolls **inside**; page does not. Toolbar wrap. No `md:grid`. No Sheet. Cells `min-w-0`. Amount + billed-as wrap, never `whitespace-nowrap`.
  - **Pattern:** A1-equivalent **A1.5** onboarding list. Copy A7.2 `src/app/(app)/requests/RequestList.tsx` (required project Select, URL filters, no client refilter) and A5.2 `src/app/(app)/cards/OrgCardList.tsx`. Infinite table: A5.8 `CardDetail.tsx` / A6.7 `AutomationHistory.tsx`. Hook: `useTransactions` `src/client/hooks/useTransactions.ts` (B8 `.list`). `MoneyDisplay` F3.10. `DateRangePicker` F3.5.
  - **Accept:** `pnpm verify`. MEMBER path: no `useTransactions` until `?projectId=`. OWNER may load without projectId. No `?page=` in `transactionListHref`. `TransactionList.tsx` contains `useTransactions` and does **not** contain `useProjectTransactions`, `parseFloat`, `type="number"`, or `whitespace-nowrap`. 375px and 768px: no page-level horizontal scrollbar; project Select + Declines + Receipts + row Link reachable; table may scroll inside; billed-as wraps. Menu/Sheet still works below `md`.
  - **Notes:** _{filled in on completion}_

### A8.4 — Transaction detail (lifecycle)

- [ ] **A8.4** — `/transactions/[id]` chain; auth vs clearing; billing
  - **Files:**
    - `src/app/(app)/transactions/[id]/page.tsx` (replace placeholder)
    - `src/app/(app)/transactions/[id]/TransactionDetail.tsx` (`'use client'`)
  - **Do:**
    1. `useParams().id` via `parseOptionalIdParam`. `useTransaction(id)`. 403 → `error.message`. `NOT_FOUND` → `transactionNotFoundMessage()`. Loading: `LoadingState`.
    2. Header wrap `flex flex-wrap gap-2 min-w-0`: merchant name (`break-words`), `Badge` status, `Badge` type, `MoneyDisplay` `{ amount, currency }` `colorBySign`. If `billingDiffers`, billed-as line. MCC + country as wrapping text (MCC is a string). Back `Link` `transactionListHref({ projectId: data.projectId })` (`buttonVariants` + `Link`). `Link` `cardHref(data.cardId)`.
    3. Alerts per policy §5: pending auth; auth vs clearing differ (`lifecycleEvents`); partial clearing; reversal; closed card (`useCard(data.cardId)` — if that query 403/404, omit the closed Alert, do not fail the page).
    4. Heading `lifecycleHeading()`. `lifecycleSorted(data.lifecycleEvents)`. Each event: stack block (`flex flex-col gap-1 min-w-0`), **not** a horizontal stepper, **not** a DataTable. Show type, status, `MoneyDisplay`, optional billing, `formatDateTime(transactedAt)`. Current id: no self-link; others `Link` `transactionHref(event.id)`. Empty `lifecycleEvents`: still show the parent fields once (do not invent events).
    5. Receipt **read-only** line `receiptLabel(data)` (upload/delete is A8.7). If `needsReceipt`, `Link` `receiptsHref()` ghost.
    6. If `status === 'DECLINED'`: `declineReason(failureReason)` **not** `hidden`; `Link` `cardExplainHref(cardId)` `whyThisLimitLink()`.
    7. Do **not** call upload/delete/simulate. Do not sum chain amounts into a header total.
  - **Layout:** stack. Figures wrap. Lifecycle vertical. No page `md:grid`. No Sheet. Chain not `hidden` below `md`.
  - **Pattern:** A1-equivalent **A1.4** `src/app/(invite)/invite/[token]/page.tsx` (first Track A detail). Copy A7.4 `src/app/(app)/requests/[id]/RequestDetail.tsx` and A5.4 `src/app/(app)/cards/[id]/CardDetail.tsx`. Hook: `useTransaction` (B8 `.get` `transactionDetailSchema`). `MoneyDisplay` F3.10. Dates: `formatDateTime` `src/lib/dates.ts`.
  - **Accept:** `pnpm verify`. `TransactionDetail.tsx` contains `useTransaction` and `lifecycleHeading` / `lifecycleSorted` and does **not** contain `ledgerMap`, `useUploadReceipt`, `usePanToken`, `parseFloat`, or `whitespace-nowrap` on the amount row. 375px and 768px: no page-level horizontal scrollbar; lifecycle events reachable by vertical scroll (not `hidden`); billed-as and decline reason reachable; Back + card Link reachable. Menu/Sheet still works below `md`.
  - **Notes:** _{filled in on completion}_

### A8.5 — Declined queue

- [ ] **A8.5** — `/transactions/declined` reasons + card explain Link
  - **Files:**
    - `src/app/(app)/transactions/declined/page.tsx` (replace placeholder)
    - `src/app/(app)/transactions/declined/DeclinedList.tsx` (`'use client'`)
  - **Do:**
    1. `parseDeclinedSearchParams` → same MEMBER/`projectId` gate as A8.3 (`declinedListHref` / `selectProjectEmpty()`).
    2. `useDeclinedTransactions({ ...filter, pageSize: 20 })`. Do **not** send `status`. Flatten. No client refilter.
    3. Toolbar wrap: project Select, `DateRangePicker`, Back `Link` `transactionListHref({ projectId })`.
    4. Columns: `transactedAt`, merchant `Link` `transactionHref`, `MoneyDisplay` + billed-as, `failureReason` via `declineReason` (`min-w-0 break-words`, `title` = full string), `Link` `cardExplainHref(cardId)` `whyThisLimitLink()`. `getRowId` = `id`. Cursor Load more sentinel `'next'`.
    5. Empty: `noDeclinedEmpty()`. 403 → `error.message`.
    6. Do not decide/simulate. Do not hide the reason column below `md` (table may scroll inside).
  - **Layout:** table inside overflow; toolbar wrap. No `md:grid`. No Sheet. Reason not `hidden`.
  - **Pattern:** A1-equivalent **A1.5**. Copy A8.3 `TransactionList.tsx` (same file family as A7.2). Hook: `useDeclinedTransactions` (B8 `.listDeclined`). Explain: A6.9 `cardExplainHref`.
  - **Accept:** `pnpm verify`. `DeclinedList.tsx` contains `useDeclinedTransactions` and `declineReason` and does **not** contain `status:` in the hook filter, `useSimulatePurchase`, or `parseFloat`. Static `/transactions/declined` still not handled by `[id]`. 375px and 768px: no page-level horizontal scrollbar; reason reachable (table may scroll inside); Why this limit? reachable; Menu/Sheet still works.
  - **Notes:** _{filled in on completion}_

### A8.6 — Per-card history (A5.8 table)

- [ ] **A8.6** — Card detail: row Links, billing, decline reason, closed card
  - **Files:**
    - `src/app/(app)/cards/[id]/CardDetail.tsx` (edit — transactions table columns + one Link)
  - **Do:**
    1. Keep `useCardTransactions(id)` infinite + `flattenTransactionPages` + cursor sentinel `'next'`. Do **not** pass `status` into the hook (A5.8 lock stands).
    2. Merchant cell: `Link` `transactionHref(row.id)` (`min-w-0 break-words`).
    3. Amount cell: `MoneyDisplay` `colorBySign`; if `billingDiffers`, billed-as second line.
    4. Status cell: `Badge` + `transactionStatusLabel` (replace raw `row.status` if still raw).
    5. If `row.status === 'DECLINED'`, show `declineReason(row.failureReason)` in the status cell or a new column — not `hidden`.
    6. Heading row `flex flex-wrap gap-2`: existing `Transactions` + `Link` `transactionListHref({ cardId: id })` ghost `View in transactions` (omit if you prefer only merchant links — **locked:** include the Link).
    7. Closed-card Alert already uses `closedCardMessage` — do not remove. Do not upload receipts here (A8.7). Do not add a second `overflow-x-auto`.
  - **Layout:** table scrolls inside (already). New lines wrap. No `md:grid`. No Sheet. Do not `hidden` decline reason.
  - **Pattern:** A1-equivalent **A1.4** detail. Copy A5.8 in this same `CardDetail.tsx`. Hrefs: A8.0 `transactionHref` / `transactionListHref`. `MoneyDisplay` F3.10.
  - **Accept:** `pnpm verify`. `CardDetail.tsx` still has `useCardTransactions` and still has no `usePanToken` / `cvv` / `card_number` / `type="number"`. Merchant cells link to `/transactions/{id}`. 375px and 768px: no page-level horizontal scrollbar; transactions table reachable; billed-as wraps; Freeze/Reveal still reachable (A5). Menu/Sheet still works.
  - **Notes:** _{filled in on completion}_

### A8.7 — Missing-receipt queue + attach

- [ ] **A8.7** — `/receipts` display-filter; Sheet upload; detail attach/delete
  - **Files:**
    - `src/app/(app)/receipts/page.tsx` (replace placeholder)
    - `src/app/(app)/receipts/ReceiptsQueue.tsx` (`'use client'`)
    - `src/app/(app)/transactions/[id]/TransactionDetail.tsx` (edit — attach/delete)
  - **Do:**
    1. Receipts page: MEMBER/`projectId` gate like A8.3 using `parseReceiptsSearchParams` / `receiptsListHref`.
    2. `useTransactions({ ...filter, status: 'CLEARED', pageSize: 20 })`. Flatten. `rows = flattened.filter(needsReceipt)`. **Do not** show `total` as the missing count. Hint `receiptsLoadMoreHint()` when `hasNextPage`. Empty per policy §7.
    3. Columns: `transactedAt`, merchant `Link` `transactionHref`, `MoneyDisplay` `colorBySign`, amount vs threshold is already `needsReceipt`. Row action `Attach receipt` opens F3 `Sheet` `side="right"` (not a new page).
    4. Sheet: `<input type="file" accept=".pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp">`. On file: `receiptContentType(file.type)`; `file.name` min 1 max 255; `FileReader.readAsDataURL` → `base64FromDataUrl` → length vs `RECEIPT_MAX_BASE64_CHARS` → `useUploadReceipt().mutate({ id: row.id, input: { fileName: file.name, contentType, contentBase64 } })`. Errors: locked type/size copy or `error.message`. Close Sheet on success.
    5. Detail (A8.4 page): if `needsReceipt` or `receiptFileId` min 1, actions `flex-wrap`: `Attach receipt` same Sheet; `Remove receipt` `ConfirmDialog` when `receiptFileId` min 1 and `!isOptimisticReceiptId` → `useDeleteReceipt({ id })`. `PermissionGate` `transaction.view` on `data.projectId` for attach; delete still offered (API 403 is truth) — wrap delete in `PermissionGate` `card.manage` `subject={{ cardId: data.cardId }}` `projectId={data.projectId}` `denialMessage` from `manageCardDenialMessage()` (cards.ts). Always visible when the row qualifies (disabled + tooltip when denied).
    6. Do not GET/download bytes. Do not OCR. Do not `type="number"`.
  - **Layout:** receipts table inside overflow; toolbar wrap. Upload is **Sheet**, not a stacked inline form that blows 375px. Detail actions wrap. Do not `hidden` Attach below `md`.
  - **Pattern:** A1-equivalent **A1.6** `src/app/(onboarding)/onboarding/create-organization/page.tsx` (first Track A form + file-less submit). Copy A3.5 `src/app/(app)/projects/[id]/people/PeopleList.tsx` Edit **Sheet**. Confirm: A7.4 cancel `ConfirmDialog`. Hook: `useUploadReceipt` / `useDeleteReceipt` `src/client/hooks/useTransactions.ts` (B8 `.uploadReceipt` / `.deleteReceipt`). Optimistic id `'optimistic-receipt'` is F1 — never send it as a real file id.
  - **Accept:** `pnpm verify` and `pnpm test client/lib/transactions`. Upload payload has `contentType` in the four-enum set and `contentBase64` with **no** `data:` prefix. `ReceiptsQueue.tsx` contains `status: 'CLEARED'` and `needsReceipt` and does **not** contain `GET /api/receipts`, `parseFloat`, or `type="number"`. 375px and 768px: no page-level horizontal scrollbar; Attach reachable; Sheet does not force page-level sideways scroll; Load more reachable; detail Remove/Attach wrap. Menu/Sheet (nav) still works below `md`.
  - **Notes:** _{filled in on completion}_

### A8.8 — Don’t-break + invariant proofs

- [ ] **A8.8** — Unclamped amounts, no client ledger, 375/768, shell unchanged
  - **Files:**
    - `src/client/lib/transactions.test.ts` (extend)
    - `src/client/lib/projects.test.ts` (assert `WORKSPACE_TAB_HREFS` still six, still includes `/activity`, still no settings, still no `/projects/${id}/transactions`)
    - `src/client/lib/access.test.ts` (SETTINGS_NAV still four hrefs — no Transactions / Receipts)
    - screens listed above — **read only** unless a §11 string or layout class is missing
  - **Do:**
    1. Assert `needsReceipt` does not clamp (`needsReceipt({ status: 'CLEARED', receiptFileId: null, amount: 5000 })` true; amount `4999` false; negative amount false).
    2. Assert `lifecycleSorted` does not mutate inputs; `authClearingDiffer` true only when both sides exist and differ.
    3. Assert `parseTransactionListSearchParams` drops `page` / `merchant` / invalid `status`.
    4. Assert `requiresProjectIdOnTxList('MEMBER')` true and `'OWNER'` false.
    5. Assert `base64FromDataUrl` strips the prefix; `receiptContentType('image/jpg')` is `image/jpeg`.
    6. Grep A8 screen files (`src/app/(app)/activity`, `src/app/(app)/transactions`, `src/app/(app)/receipts`, `src/app/(app)/projects/[id]/activity`, `src/app/(app)/cards/[id]/CardDetail.tsx`): no `ledgerMap`, no `from '@/server/`, no `type="number"`, no `parseFloat`, no `useSimulatePurchase`, no `usePanToken`, no `useExportTransactions`, no `useSyncTransactionsAdmin`. PAN scan: no `cvv`, `card_number`, `\bPAN\b` (same style as A5.10 / A7.9).
    7. Confirm `(app)/layout.tsx` still `requireApp()` + `AppShellFrame`. Confirm `AppShell.tsx` aside class still includes `hidden` and `md:flex`. Confirm `DEFAULT_NAV` is Activity then Transactions then Receipts then Automation.
    8. Confirm `WORKSPACE_TAB_HREFS` length 6 and includes `/activity`.
    9. Manual don’t-break: `/activity` (Timeline + Load more), `/projects/[id]/activity`, `/transactions` (Select + Declines + table), `/transactions/declined` (reason column), `/transactions/[id]` (lifecycle stack + billed-as), `/receipts` (Attach Sheet), `/cards/[id]` (tx Links) at 375px and 768px.
  - **Layout:** n/a (proof) plus the manual resize check.
  - **Pattern:** A1-equivalent **A1.7** `src/client/lib/auth.ts` tests / A1 proofs. Copy A7.9 `src/client/lib/requests.test.ts`. A5.10 `src/client/lib/cards.test.ts`. A2.1 shell classes (read-only).
  - **Accept:** `pnpm test client/lib/transactions` and `pnpm test client/lib/projects` and `pnpm test client/lib/access` and `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar on activity (Load more), project activity, transaction list (Select + Declines + table), declined (reason + Why this limit?), detail (lifecycle stacked, not hidden), receipts (Attach), card detail transactions; Menu/Sheet still works below `md`; tables may scroll inside. Aside still `hidden md:flex`.
  - **Notes:** _{filled in on completion}_

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Spec’s review checklist in `A8-activity.md` signed off:
  - [ ] Authorization versus clearing is unambiguous
  - [ ] The lifecycle chain is visible on detail views
  - [ ] Rule-driven entries are visually distinct from human ones
  - [ ] Declines show a reason and, where applicable, the responsible rule
  - [ ] Cursor pagination is stable when new items arrive at the head
  - [ ] Amounts render through F2's helpers, with billing currency shown where it differs
  - [ ] 375px and 768px: no page-level horizontal scrollbar; filters wrap; tables may scroll internally
- [ ] `/dev/shell` still works (unchanged collapse)
- [ ] No new F3 primitive files
- [ ] No `call()` / `fetch` / `@/server` in `'use client'` screens
- [ ] `STATUS.md` updated with the next phase (**A9**)

## Out of scope (do not do in A8)

- AppShell collapse / second nav (A2.1)
- `/projects/[id]/settings` or a seventh workspace tab
- `/projects/[id]/transactions` product URL
- `GET /api/receipts` or any new/changed B8/B9 contract
- Client `ledgerMap` / importing `src/server/services/transactions/*`
- `StatusBadge kind="transaction"` / editing F3 `Timeline.tsx`
- CSV export (`useExportTransactions`) / org reports / closure (A9)
- `useSyncTransactionsAdmin` / `useSimulatePurchase` / remote-auth simulator UI
- Receipt OCR / download / preview bytes
- Editing `invalidationMap.ts` / F1 hooks other than the A8.2 queryKey patch
- `@testing-library/react`
- `sm:` / `lg:` / `xl:` / `2xl:` on A8 screens
- Creating cards or typing PANs
