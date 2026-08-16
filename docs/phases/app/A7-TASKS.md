# A7 — Purchase Requests & Approvals · Tasks

**Spec:** [A7-approvals.md](./A7-approvals.md)
**Model:** cheap / LOW — name every file, inline every field with type and constraints, copy the cited A6/A5/A4/A3/A2/F1/B7 file; do not invent endpoints, change B7–B9 contracts, add primitives, reopen AppShell collapse, parse policy on the client, or hide a control without a Sheet/menu replacement.
**Depends on:** A6, complete and verified

No new API contracts. B7 already shipped `purchaseRequestContracts` and `approvalRuleContracts`. The review gate is the policies + helper shapes below.

**Powers:** B7 · **Hooks (F1, already exist):** `usePolicyPreview`, `useRequests`, `useRequest`, `useCreateRequest`, `useUpdateRequest`, `useSubmitRequest`, `useCancelRequest`, `useDecideRequest`, `useApprovals`, `useApprovalCount`, `useApprovalRules`, `usePutApprovalRules`, `useProjects`, `useProject`, `useProjectMembers`, `useProjectCards`, `useBudget`, `useBudgetCategories`, `useRoles`, `useMe`, `usePermissions`, `useCan` · **Do not call:** `useSimulatePurchase`, `usePanToken`, `useCreateCard`, `useBudgetChangeRequests`, `useCreateChangeRequest`, `useDecideChangeRequest` (A4 budget CRs — different resource) · **Guards (F0, already exist):** `requireApp` on `(app)/layout.tsx`

Recipe: [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Visual tokens: [`../../VISUAL-DIRECTION.md`](../../VISUAL-DIRECTION.md).

**AppShell collapse is already done (A2.1).** Aside is `hidden w-56 shrink-0 flex-col md:flex`; Menu opens the same `SideNav` / `OrgSwitcher` in F3 `Sheet`. Do **not** reopen collapse. Do **not** build `MobileNav.tsx`. Do **not** add `sm:` / `lg:` / `xl:` / `2xl:` on A7 screens. A7.1 may **insert** one SideNav href (`/requests`) only. `/approvals` is already in `DEFAULT_NAV` (A2).

There is **no** A7 AppShell-collapse task. A2.1 owns it. Every screen task still checks 375px / 768px don’t-break, including that the existing Menu `Sheet` still works below `md`.

---

## A7.0 locked policies (do not reopen)

Approved 2026-08-17. Implementers follow these; do not re-litigate. A7.0 still implements the helpers below and STOPs before A7.1 screens.

### 1. No new contracts, no new primitives, no AppShell collapse, no client policy engine

- Do **not** add or rename fields in `src/shared/schemas/*` or `src/shared/contracts/*`.
- Do **not** add `GET /api/requests` (org-wide list). There is no such contract. `purchaseRequestContracts.list` is `GET /api/projects/:id/requests` only. `/requests` is a UI route that **requires** `?projectId=` and then calls `useRequests(projectId, { page, pageSize })`.
- Do **not** fan-out `useRequests` across every project. Do **not** client-refilter a paginated page by `requestedBy` (that breaks page totals). The server already returns own-only when `shouldSeeOnlyOwnRequests`; wider-scope members see all requests for that project on `/requests`. The approver working surface is `/approvals`, not a client filter.
- Do **not** add a shadcn/pattern file. A7 screens compose F3 files listed in each task’s **Pattern**. `StatusBadge kind="request"`, `MoneyDisplay`, `DataTable`, `DiffView`, `Timeline`, `ConfirmDialog` already exist.
- Do **not** import `@/server/*` from any `'use client'` file. That includes `src/server/services/approvals/policy.ts` (`evaluatePolicy`). Do **not** reimplement threshold matching or approver resolution on the client. Preview truth is `usePolicyPreview` only.
- Do **not** call `call()` or `fetch` from a screen. Use F1 hooks.
- Do **not** edit `src/client/shell/AppShell.tsx` except the `DEFAULT_NAV` array in A7.1.
- Do **not** edit `src/client/hooks/invalidationMap.ts`. `usePolicyPreview` already invalidates `[]`.
- Do **not** add `/projects/[id]/settings` or a seventh workspace tab. `WORKSPACE_TAB_HREFS` stays six. Do **not** add `/projects/[id]/requests` (that path is unused; A4 already owns `/projects/[id]/budget/requests` for **budget change requests** — different model, different hooks).
- Do **not** add `@testing-library/react`.
- Do **not** use `type="number"` or `parseFloat` on amounts. Amount fields are text + `parseMoneyInput` from `src/lib/money.ts`. Currency is `useMe().data.activeOrg.baseCurrency` (string length 3) — the user does not pick a currency.
- **Never PAN / CVV / expiry.**

### 2. Routes (A7 spec wins)

| URL                               | Files                                                                                  | Guard                 | Shell                       |
| --------------------------------- | -------------------------------------------------------------------------------------- | --------------------- | --------------------------- |
| `/requests`                       | `src/app/(app)/requests/page.tsx` + `RequestList.tsx`                                  | `requireApp` (layout) | `AppShell`                  |
| `/requests/new`                   | `src/app/(app)/requests/new/page.tsx` + `RequestForm.tsx`                              | same                  | `AppShell`                  |
| `/requests/[id]`                  | `src/app/(app)/requests/[id]/page.tsx` + `RequestDetail.tsx`                           | same                  | `AppShell`                  |
| `/approvals`                      | `src/app/(app)/approvals/page.tsx` + `ApprovalsQueue.tsx` (replaces A2 placeholder)    | same                  | `AppShell`                  |
| `/approvals/[id]`                 | `src/app/(app)/approvals/[id]/page.tsx` + `ApprovalDetail.tsx`                         | same                  | `AppShell`                  |
| `/projects/[id]/controls` (rules) | existing `ProjectControls.tsx` + new `ApprovalRuleEditor.tsx` (section, not a new tab) | same                  | `AppShell` + workspace tabs |

`/requests/new` is a **static** segment (`new/page.tsx`). Do **not** treat `id === 'new'` on `[id]`. Next.js static `new` wins over `[id]`.

There is no `GET /api/approvals/:id`. `/approvals/[id]` loads `useRequest(id)` (`GET /api/requests/:id`) and decides with `useDecideRequest`.

Wizard `/projects/new` approval-rules step stays `DeferredStep`. A7.8 adds a Link; do not embed the rule editor in the wizard.

A7.1 inserts SideNav `{ href: '/requests', label: 'Requests' }` **immediately before** `{ href: '/approvals', label: 'Approvals' }` (after Cards). Do **not** remove or rename Approvals. Do **not** add Requests to `SETTINGS_NAV`.

Dashboard `/dashboard` already lists pending approvals (A2.2). A7.5 turns each row into a `Link` to `approvalHref(id)`. Do not rebuild the dashboard card.

### 3. Layout — one breakpoint `md`, four patterns (collapse already exists)

Copy [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Do not add `sm:` / `lg:` / `xl:` / `2xl:` (ignore pre-existing `sm:` inside F3 `Sheet` / `UserMenu` / `/dev/ui` — do not edit those files).

**Do not hide** policy preview, rejection reason, approval trail, remaining budget, recent spend, or Approve / Reject on narrow. Stack them. Spec Layout: policy preview sits **above** the submit button in the **same column**; decision actions `flex-wrap`; do **not** put amount, vendor, and remaining budget on one `whitespace-nowrap` row.

| Screen                    | Narrow                                                                                                                    | Desktop (`md:`)                                        |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `/requests`               | `DataTable` + internal overflow; toolbar `flex-wrap`                                                                      | same table, **not** a card list                        |
| `/requests/new`           | `flex-col`: fields, then policy preview, then actions `flex-wrap`                                                         | **same column** — no `md:flex-row` form \| preview     |
| `/requests/[id]`          | stack: status, figures wrap, policy, trail, unlocked, actions `flex-wrap`                                                 | same stack; **no** page `md:grid` that hides the trail |
| `/approvals` queue        | **stacked cards** (`flex flex-col gap-4`), not a DataTable (spec: working surface). Each card body `flex flex-wrap gap-2` | same stack; **not** a `md:grid` of queue cards         |
| Queue / detail figures    | wrap: amount, vendor, remaining each on their own wrapped line                                                            | wrap still — never `whitespace-nowrap` on that row     |
| `/approvals/[id]`         | stack: context, remaining, recent spend, trail, decide `flex-wrap`                                                        | same stack                                             |
| Approval rules (controls) | section **below** existing rules table; editor `flex flex-col gap-3`; add/remove `flex-wrap`                              | same stack under the A6 table; **no** new tab          |
| Reject reason             | F3 `ConfirmDialog` + `Textarea` (not a new page)                                                                          | same Dialog                                            |
| Org SideNav               | Requests + Approvals appear inside existing Menu `Sheet`                                                                  | same items in the `hidden md:flex` aside               |

Workspace tabs already `flex flex-wrap` in `ProjectWorkspace.tsx`. Do not switch them to Radix `Tabs`.

Chrome Links: `buttonVariants({ variant: 'ghost' })` + `Link` for wrap-nav (A3 Slot crash — do **not** `Button asChild` for new wrap-nav Links). `Button asChild` + `Link` is OK for primary actions (A2.3 Create).

### 4. Existing contracts (copy these fields; do not redeclare)

All amounts that are numbers are **integer minor units**. Currency is ISO 4217 `string` length 3. Never `parseFloat`, never `type="number"`. **Never PAN / CVV / expiry.**

**Permissions** (server is the control; client `can()` is UX only):

| Action                           | Permission                                                     | Hook / note                                                                       |
| -------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| List project requests            | `transaction.view`                                             | `useRequests(projectId, { page, pageSize })`                                      |
| Preview policy                   | `transaction.view`                                             | `usePolicyPreview` — `POST /api/policy/preview`                                   |
| Create / patch / submit / cancel | `payment.make` (create); requester-only on patch/submit/cancel | `useCreateRequest` / `useUpdateRequest` / `useSubmitRequest` / `useCancelRequest` |
| Queue + count                    | `request.approve`                                              | `useApprovals` / `useApprovalCount` — 403 is the source of truth                  |
| Decide                           | `request.approve`                                              | `useDecideRequest`; requester cannot decide own (API + UI)                        |
| Approval rules GET/PUT           | `control.edit`                                                 | `useApprovalRules` / `usePutApprovalRules`                                        |

`PermissionGate` requires `projectId: string`. On `/requests/new` and `/requests` New, pass the **selected** `projectId`. If it is missing, do **not** pass `''` — disable New until a project is selected. On `/approvals` (org queue) use `PermissionGateView` `allowed={holdsRequestApprove(orgRole, mePermissions)}` for empty-state copy only; still attempt `useApprovals` (API 403 is truth).

---

**`POST /api/policy/preview`** — `purchaseRequestContracts.policyPreview` — authenticated + `transaction.view` on `projectId` — input `policyPreviewInput`:

```
{
  projectId: string min 1,
  amount: int >= 0,                 // minor units
  currency: string length 3,
  categoryId?: string min 1         // omit when none selected; do not send ''
}
```

Output `policyDecisionSchema`:

```
{
  outcome: 'NO_APPROVAL_REQUIRED' | 'APPROVAL_REQUIRED' | 'NOT_PERMITTED',
  reasons: string min 1[],          // MUST be length >= 1 when NOT_PERMITTED (Zod superRefine)
  requiredApprovals: int >= 0       // 0 when no approval needed or not permitted
}
```

Same function as submit (B7). Mutation; **do not cache**. Generation counter on the form. Debounce `POLICY_PREVIEW_DEBOUNCE_MS` (300).

**“From whom” on preview:** the wire has **no** approver names (no `approverIds[]`). Do **not** invent them. Lock copy uses `requiredApprovals` only (policy §13). Named people appear later on the trail as `approvals[]` entries after they decide. Do **not** call `evaluatePolicy` to guess the matching rule.

---

**`GET /api/projects/:id/requests`** — `.list` — `transaction.view` — input `listPurchaseRequestsQuery`:

```
{
  page: coerce int min 1 default 1,
  pageSize: coerce int min 1 max 100 default 20
}
```

Output `purchaseRequestListSchema`: `{ items: purchaseRequestSchema[], page: int min 1, pageSize: int min 1, total: int min 0 }`. **No `status` query field.** Do not invent `?status=` as a server filter. **No client-side refilter** of the paginated list.

---

**`POST /api/projects/:id/requests`** — `.create` — `payment.make` — input `createPurchaseRequestInput`:

```
{
  amount: int >= 0,
  currency: string length 3,
  vendor: string min 1 max 200,
  description: string min 1 max 2000,
  justification: string min 1 max 2000,
  categoryId?: string min 1 | null
}
```

Output `purchaseRequestSchema`. **Always `DRAFT`** (B7.0). Create does **not** run policy. Submit does.

Hook: `useCreateRequest().mutate({ id: projectId, input })` — `id` is the **project** id (F1 path param).

---

**`GET /api/requests/:id`** — `.get` — scoped — input `z.void()` — output `purchaseRequestSchema`. Cross-org → 404.

**`PATCH /api/requests/:id`** — `.update` — requester, while `DRAFT` — input `updatePurchaseRequestInput` (≥1 of `amount` | `currency` | `vendor` | `description` | `justification` | `categoryId`). Output `purchaseRequestSchema`. Non-DRAFT → 409 `Only DRAFT requests can be updated`.

**`POST /api/requests/:id/submit`** — `.submit` — requester, `DRAFT` only — input `z.void()` — output `purchaseRequestSchema`.

- `NO_APPROVAL_REQUIRED` → `APPROVED` + COMMITMENT + `request.approved`
- `APPROVAL_REQUIRED` → `PENDING`
- `NOT_PERMITTED` → 422 `VALIDATION_FAILED` details field `policy` = `reasons[]` (do not swallow; render each string)

**`POST /api/requests/:id/cancel`** — `.cancel` — requester, `DRAFT` or `PENDING` — input `z.void()`. Else 409.

**`POST /api/requests/:id/decide`** — `.decide` — `request.approve` — input `decidePurchaseRequestInput`:

```
{
  decision: 'APPROVE' | 'REJECT',
  reason?: string min 1 max 2000    // REQUIRED when decision is REJECT (Zod superRefine)
}
```

Output `purchaseRequestSchema`. Already-decided → 409 `Request is already decided`. Self → 403 `Requester cannot decide their own request`. REJECT without reason → 422 field `reason`.

---

**`purchaseRequestSchema`** (display fields A7 uses):

```
{
  id, orgId, projectId, requestedBy: string min 1,
  amount: int >= 0,                 // minor units
  currency: string length 3,
  categoryId: string min 1 | null,
  vendor: string min 1 max 200,
  description: string min 1 max 2000,
  justification: string min 1 max 2000,
  policyDecision: policyDecisionSchema | null,   // null until submit
  status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED',
  cardId: string min 1 | null,      // B7 create always null; rules may never write this
  approvals: {
    approverId: string min 1,
    decision: 'APPROVE' | 'REJECT',
    reason: string min 1 max 2000 | null,
    at: iso datetime
  }[],
  escalatedAt: iso datetime | null, // timing only — there is NO escalationReason field
  createdAt, updatedAt
}
```

---

**`GET /api/approvals`** — `.listApprovals` — `request.approve` — input `listApprovalsQuery` (same `{ page, pageSize }` as list). Output `purchaseRequestListSchema`. PENDING queue, oldest first; **excludes the caller’s own requests**. **No client-side refilter.**

**`GET /api/approvals/count`** — `.approvalsCount` — `{ count: int >= 0 }`. Shell already polls via `useApprovalCount`. Do not add a second badge.

---

**`GET /api/projects/:id/approval-rules`** — `approvalRuleContracts.list` — `control.edit` — input `z.void()` — output `approvalRuleSchema[]` (**project rules only**, not org defaults).

**`PUT /api/projects/:id/approval-rules`** — `.put` — `control.edit` — input `putApprovalRulesInput` = array of `approvalRuleBodySchema` (replace-all for **this project**; org-default rows with `projectId: null` are never sent and never deleted):

```
{
  threshold: int >= 0,              // minor units; amount >= threshold requires this rule
  approverSelection: ApproverSelector,
  requiredCount: int >= 1,          // distinct approvers; same user twice does not count
  escalationAfterMins: int >= 1,
  escalateTo: ApproverSelector
}[]
```

`ApproverSelector` discriminated on `type`:

```
{ type: 'ROLE', roleKey: string min 1 max 64 matching /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/ }
| { type: 'NAMED_USERS', userIds: string min 1[] min 1 }
| { type: 'PROJECT_OWNER' }
```

Empty PUT `[]` is valid (no project rules; org defaults still apply on the server). Do not add an org-default editor — there is no org-level approval-rules contract.

`approvalRuleSchema` adds `id`, `orgId`, `projectId: string | null`, `createdAt`, `updatedAt`. PUT body **omits** those — `toApprovalRuleBody` strips them.

---

**Also used, already shipped:**

- `GET /api/projects` — `useProjects({ page: 1, pageSize: 100 })` for the project Select on `/requests` and `/requests/new`.
- `GET /api/projects/:id/budget` — `useBudget(projectId)` for `projection.remaining` (int, **may be negative**, never clamp) and `budget.currency`.
- `GET /api/projects/:id/budget/categories` — `useBudgetCategories(projectId)` for optional category Select (`id` + `name`).
- `GET /api/projects/:id/members` — `useProjectMembers(projectId)` for requester / named-user labels (`member.userId`, `member.user.name`).
- `GET /api/projects/:id/cards` — `useProjectCards(projectId, { page: 1, pageSize: 100 })` for post-approve unlocked diff (A4 helpers).
- `GET /api/roles` — `useRoles()` for `ROLE` `roleKey` Select.
- `GET /api/me` — `user.id`, `activeOrg.baseCurrency`, `memberships[].orgRole`.

**Do not use `useProjectTransactions` / `useTransactions` for “recent spend”.** `transactionSchema` has `cardId` / `projectId` and **no** `memberId` / `requestedBy`. Lock recent spend as this project’s **other APPROVED purchase requests** by the same `requestedBy` from `useRequests(projectId, { page: 1, pageSize: 20 })` (B7 data). If that query 403s, omit the subsection (do not fail the queue card).

### 5. Create always DRAFT; preview before submit; submit runs policy

`/requests/new` primary **Submit request**: `useCreateRequest` then `useSubmitRequest({ id: created.id })`. Secondary **Save draft**: create only, then `router.replace(requestHref(created.id))`.

If create succeeds and submit returns 422 `policy`, stay on `/requests/{id}` (DRAFT) and render `reasons[]` verbatim — do not delete the draft.

Disable **Submit request** while the latest successful preview `outcome === 'NOT_PERMITTED'` (or preview in-flight / missing project / invalid amount). **Save draft** stays enabled when `payment.make` allows (create does not run policy).

`/requests/[id]` while `DRAFT`: same preview + Submit / Save (PATCH) / Cancel.

### 6. Queue is a working surface; `/approvals/[id]` is the full trail

`/approvals` is **stacked cards**, not a DataTable (spec). Each card shows enough to decide in place: amount (`MoneyDisplay`), vendor, justification, requester name, remaining (`useBudget` → `projection.remaining`, unclamped), recent spend (policy §4), status badge, escalation line if `escalatedAt`, progress `{approvedCount}/{required}`. Actions `flex-wrap`: Approve, Reject, `Link` `Review` → `approvalHref(id)`.

Reject **always** opens `ConfirmDialog` with required `Textarea` `reason` (min 1 max 2000). Approve does **not** send `reason`.

Self-approval: `isSelfApproval(requestedBy, me.user.id)` → **do not render** Approve or Reject (not merely disabled). Alert locked copy. The queue API already excludes own rows; still guard `/approvals/[id]` for direct URLs.

Viewer already in `approvals[]` (`approverId === me.user.id`): do not render Approve / Reject; Alert `You already decided this request.`

### 7. After approval, show what it unlocked

B7 emits `request.approved`; it does **not** write `cardId` (create sets `cardId: null`). Do **not** invent a card.

On a successful decide that returns `status === 'APPROVED'` (requiredCount met):

1. If `cardId` min 1 → `Link` `cardHref(cardId)` + locked unlocked-card copy.
2. Else snapshot `useProjectCards` **before** mutate (A4.7 pattern), refetch, then:
   - `unlockedCardIds(beforeIds, afterIds)` → each id `Link` `cardHref`
   - `diffCardTransactionLimits(before, after)` → `CardLimitMoves` / `DiffView` as A4.7
3. If still nothing: locked “none linked yet” copy + `Link` `projectCardsHref(projectId)`.

If decide returns still `PENDING` (more approvers needed): show progress, **not** the unlocked section.

On `/requests/[id]` for an already-`APPROVED` row: same `cardId` Link; if null, the “none linked yet” copy (do not snapshot historical cards).

### 8. Extra invalidation, money, PAN, testing, ESLint

- After create/submit/cancel/decide, F1 already invalidates `qk` requests / approvals / approvalCount / budget. Screens may additionally `invalidateQueries` `qk.cardsForProject(projectId)` after APPROVE (A4.7). Do not edit `invalidationMap.ts`.
- Remaining is **never** clamped. Negative remaining renders via `MoneyDisplay`.
- Tests: pure helpers in `src/client/lib/requests.ts` with vitest **node**.
- Screen Accept always includes `pnpm verify` plus **375px and 768px**: no page-level horizontal scrollbar; primary actions reachable; tables may scroll **inside**; policy preview, trail, remaining, recent spend, Approve / Reject reachable by **vertical** scroll (stacked, not `hidden`).
- `(app)` already bans `call()` / `fetch`. Do not add a `@/server` ban (server layout still uses `requireApp`).

### 9. Locked copy (do not paraphrase)

| Situation                       | Surface              | Copy                                                                                                                                                               |
| ------------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cannot create request           | `PermissionGate`     | `You don't have permission to create a purchase request.`                                                                                                          |
| Cannot decide                   | `PermissionGateView` | `You don't have permission to approve requests.`                                                                                                                   |
| Cannot edit approval rules      | `PermissionGate`     | `You don't have permission to edit controls.` (reuse `editControlsDenialMessage()` from `src/client/lib/rules.ts`)                                                 |
| Self-approval                   | `Alert`              | `You cannot approve your own request.`                                                                                                                             |
| Already decided by viewer       | `Alert`              | `You already decided this request.`                                                                                                                                |
| Select a project                | `EmptyState`         | title `Select a project` / description `Purchase requests are listed per project.`                                                                                 |
| No requests                     | `EmptyState`         | title `No requests yet` / description `Ask to spend — policy runs before you submit.`                                                                              |
| No queue items                  | `EmptyState`         | title `No pending approvals` / description `When a request needs you, it appears here.`                                                                            |
| Preview NO_APPROVAL_REQUIRED    | preview pane         | `No approval needed.`                                                                                                                                              |
| Preview APPROVAL_REQUIRED       | preview pane         | `Approval needed from {n} approver(s).` (`n` = `requiredApprovals`)                                                                                                |
| Preview NOT_PERMITTED heading   | preview pane         | `Not permitted.` then **each** `reasons[]` string on its own line, verbatim. Never a lone “not permitted”.                                                         |
| Preview pending                 | preview pane         | `Checking policy…`                                                                                                                                                 |
| Submit                          | Button               | `Submit request`                                                                                                                                                   |
| Save draft                      | Button               | `Save draft`                                                                                                                                                       |
| Cancel request                  | `ConfirmDialog`      | title `Cancel this request?` description `A reserved amount is released if one was committed.` confirm `Cancel request` variant `destructive` (no `typeToConfirm`) |
| Approve                         | Button               | `Approve`                                                                                                                                                          |
| Reject                          | Button               | `Reject`                                                                                                                                                           |
| Reject dialog                   | `ConfirmDialog`      | title `Reject this request?` description `A reason is required and is shown to the requester.` confirm `Reject` variant `destructive`; `Textarea` label `Reason`   |
| Rejected (requester)            | `Alert` destructive  | heading `Rejected` + `rejectionReason` verbatim (fallback `This request was rejected.`)                                                                            |
| Expired                         | `Alert`              | `This request expired.`                                                                                                                                            |
| Escalated                       | line                 | `Escalated {formatDate(escalatedAt)}.`                                                                                                                             |
| Multi-approver progress         | line                 | `{approvedCount} of {required} approved.`                                                                                                                          |
| Budget consumed warning (queue) | `Alert`              | `Remaining budget is less than this request.` (informational; server still decides)                                                                                |
| Unlocked with cardId            | line + Link          | `This approval unlocked a card.`                                                                                                                                   |
| Unlocked via new cards / diffs  | heading              | `What this approval unlocked`                                                                                                                                      |
| Unlocked nothing linked         | line                 | `Approved. Budget is reserved. A rule may issue a card — none is linked on this request yet.`                                                                      |
| No project approval rules       | helper               | `No project approval rules. Org defaults still apply on submit.`                                                                                                   |
| Request not found               | `ErrorState`         | `This request is not available.`                                                                                                                                   |
| Project not found               | `ErrorState`         | `This project is not available.`                                                                                                                                   |
| 409 already decided             | `Alert` destructive  | server `error.message` (expect `Request is already decided`)                                                                                                       |
| 422 / 403                       | `Alert` destructive  | server `error.message` / `applyServerErrorsFromApiError`; policy 422 renders `details.policy[]` verbatim                                                           |
| New request                     | Button/Link          | `New request`                                                                                                                                                      |
| Wizard → approval rules         | `Link`               | `Set approval rules on the controls tab.`                                                                                                                          |
| Review (queue → detail)         | Link                 | `Review`                                                                                                                                                           |

---

## Contracts first

- [x] **A7.0** — Request / approval helpers (STOP for review)
  - **Files:**
    - `src/client/lib/requests.ts` (create)
    - `src/client/lib/requests.test.ts` (create)
    - `src/client/lib/index.ts` (edit — `export * from '@/client/lib/requests'`)
  - **Do:** No React screens. No AppShell / queue / form changes yet. Implement the locked helper API (pure, no React, no `call()`):
    1. `POLICY_PREVIEW_DEBOUNCE_MS`: `300`.
    2. `requestsHref(): string` — `'/requests'`.
    3. `requestHref(requestId: string): string` — `/requests/${requestId}`. Throw if `requestId.length < 1`.
    4. `newRequestHref(projectId?: string): string` — `/requests/new` or `/requests/new?projectId=${encodeURIComponent(projectId)}` when `projectId` min 1.
    5. `approvalsHref(): string` — `'/approvals'`.
    6. `approvalHref(requestId: string): string` — `/approvals/${requestId}`. Throw if empty.
    7. Re-export `cardHref` and `projectCardsHref` from `src/client/lib/cards.ts` (do not duplicate). Re-export `controlsHref` from the same file (wizard A7.8).
    8. `parseOptionalIdParam(input: string | string[] | undefined): string | undefined` — arrays use `[0]`; empty → undefined. Copy the A6.0 behaviour; do **not** import it from `src/client/lib/rules.ts`.
    9. `parseRequestListSearchParams(input: { projectId?: string | string[]; page?: string | string[]; pageSize?: string | string[] }): { projectId?: string; page: number; pageSize: number }` — arrays use `[0]`. Run `listPurchaseRequestsQuery.safeParse` on `{ page, pageSize }` only. On failure return `{ page: 1, pageSize: 20 }` (and `projectId` if it is min 1). Drop unknown keys (including `status`). `projectId` is UI-only — it is **not** a field on `listPurchaseRequestsQuery`.
    10. `requestListHref(filter: { projectId?: string; page?: number; pageSize?: number }): string` — path `/requests`; omit defaults (`page` 1, `pageSize` 20); omit empty `projectId`.
    11. `parseApprovalsSearchParams(input: { page?: string | string[]; pageSize?: string | string[] }): ListApprovalsQuery` — `listApprovalsQuery.safeParse`; failure → `{ page: 1, pageSize: 20 }`.
    12. `approvalsListHref(filter: { page?: number; pageSize?: number }): string` — path `/approvals`; omit defaults.
    13. `holdsRequestApprove(orgRole: string | undefined, projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined): boolean` — `orgRole === 'OWNER' \|\| orgRole === 'ADMIN'` OR any project `permissions.includes('request.approve')`.
    14. `holdsPaymentMake(orgRole: string | undefined, projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined): boolean` — OWNER/ADMIN OR any project `permissions.includes('payment.make')`. (New on `/requests` still needs a selected project + `PermissionGate` `payment.make` on that id; this helper is for empty-state / org copy only.)
    15. `isSelfApproval(requestedBy: string, viewerUserId: string | undefined): boolean` — both min 1 and equal.
    16. `viewerHasDecided(approvals: ReadonlyArray<{ approverId: string }>, viewerUserId: string | undefined): boolean` — some `approverId === viewerUserId`.
    17. `isTerminalRequestStatus(status: string): boolean` — `APPROVED` \| `REJECTED` \| `EXPIRED` \| `CANCELLED`.
    18. `canEditDraft(status: string, requestedBy: string, viewerUserId: string | undefined): boolean` — `status === 'DRAFT'` and `isSelfApproval`.
    19. `canSubmitDraft` — same as `canEditDraft`.
    20. `canCancelRequest(status: string, requestedBy: string, viewerUserId: string | undefined): boolean` — (`DRAFT` \| `PENDING`) and self.
    21. `canDecideRequest(status: string, requestedBy: string, viewerUserId: string | undefined): boolean` — `status === 'PENDING'` and viewer min 1 and **not** self and **not** `viewerHasDecided`.
    22. `approvedCount(approvals: ReadonlyArray<{ decision: string }>): number` — count `decision === 'APPROVE'`.
    23. `approvalProgress(request: { approvals: ReadonlyArray<{ decision: string }>; policyDecision: { requiredApprovals: number } | null }): { approved: number; required: number }` — `required` = `policyDecision?.requiredApprovals ?? 0`.
    24. `formatApprovalProgress(progress: { approved: number; required: number }): string` — locked `{approved} of {required} approved.`
    25. `rejectionReason(approvals: ReadonlyArray<{ decision: string; reason: string | null }>): string | null` — last entry with `decision === 'REJECT'` whose `reason` is a string min 1; else null.
    26. `recentApprovedSpend(items: ReadonlyArray<{ id: string; requestedBy: string; status: string; vendor: string; amount: number; currency: string }>, requestedBy: string, excludeId: string): { vendor: string; amount: number; currency: string }[]` — filter `requestedBy` match, `status === 'APPROVED'`, `id !== excludeId`; keep **at most 3** in **input order** (do not sort). Amounts stay ints.
    27. `remainingShortfall(remaining: number, amount: number): boolean` — `amount > remaining` (remaining may be negative; do not clamp).
    28. `unlockedCardIds(beforeIds: ReadonlyArray<string>, afterIds: ReadonlyArray<string>): string[]` — ids in after not in before, stable after order.
    29. `toApprovalRuleBody(rule: { threshold: number; approverSelection: unknown; requiredCount: number; escalationAfterMins: number; escalateTo: unknown }): { threshold; approverSelection; requiredCount; escalationAfterMins; escalateTo }` — strip `id` / `orgId` / `projectId` / `createdAt` / `updatedAt`.
    30. `emptyApprovalRuleBody(): { threshold: 0; approverSelection: { type: 'PROJECT_OWNER' }; requiredCount: 1; escalationAfterMins: 60; escalateTo: { type: 'PROJECT_OWNER' } }`.
    31. `formatApproverSelector(sel: { type: string; roleKey?: string; userIds?: readonly string[] }, nameOf?: (id: string) => string): string` — `ROLE` → `Role {roleKey}`; `NAMED_USERS` → comma-joined `nameOf(id) ?? id` (fallback `n named users` if array empty — should not happen); `PROJECT_OWNER` → `Project owner`; unknown type → `sel.type`.
    32. `policyPreviewHeading(outcome: string): string` — `NO_APPROVAL_REQUIRED` → `No approval needed.`; `APPROVAL_REQUIRED` → use `formatApprovalRequired(n)` with n supplied separately; `NOT_PERMITTED` → `Not permitted.`; else `''`.
    33. `formatApprovalRequired(requiredApprovals: number): string` — locked `Approval needed from {n} approver(s).`
    34. `formatEscalatedAt(iso: string, formatDate: (iso: string) => string): string` — locked `Escalated {formatDate(iso)}.` Helper stays React-free.
    35. Copy functions for locked §9 sentences: `createRequestDenialMessage()`, `decideRequestDenialMessage()`, `selfApprovalMessage()`, `alreadyDecidedMessage()`, `requestNotFoundMessage()`, `expiredRequestMessage()`, `rejectedFallbackMessage()`, `budgetShortfallMessage()`, `unlockedCardMessage()`, `unlockedHeading()`, `unlockedNoneLinkedMessage()`, `noProjectRulesMessage()`, `wizardApprovalRulesLinkMessage()`, `checkingPolicyMessage()`, plus EmptyState pairs `selectProjectEmpty()`, `noRequestsEmpty()`, `noApprovalsEmpty()` returning `{ title, description }`.
  - **Pattern:** `src/client/lib/rules.ts` + `src/client/lib/rules.test.ts` (A6.0 — this phase’s B1-equivalent for helpers). URL parse/href: `parseRuleListSearchParams` / `ruleListHref` in that file. Contracts to copy fields from: `src/shared/schemas/purchaseRequest.ts`, `src/shared/schemas/approvalRule.ts`, `src/shared/contracts/purchaseRequest.ts`, `src/shared/contracts/approvalRule.ts` (B7 — this phase’s B1 equivalent for the wire). `holdsControlEdit` in `src/client/lib/rules.ts` for the OWNER/ADMIN-or-permission shape. Debounce constant: `RULE_VALIDATE_DEBOUNCE_MS` / `FORMULA_DEBOUNCE_MS`. Unlocked diffs: `snapshotCardTransactionLimits` / `diffCardTransactionLimits` in `src/client/lib/budget.ts` (re-use in screens; do not copy the functions into `requests.ts`).
  - **STOP and get this reviewed before A7.1+.** An invented `GET /api/requests`, a client `evaluatePolicy`, hiding Approve below `md`, or treating A4 `/budget/requests` as purchase requests is a rewrite.
  - **Accept:** `pnpm test client/lib/requests` — cover: `parseRequestListSearchParams` drops `status` and unknown keys; without projectId + bad page → `{ page: 1, pageSize: 20 }`; with `projectId: 'p'` keeps it; `requestListHref({ page: 1 })` is `/requests`; `requestListHref({ projectId: 'p', page: 2 })` is `/requests?projectId=p&page=2`; `requestHref('r1')` is `/requests/r1`; `approvalHref('r1')` is `/approvals/r1`; `newRequestHref('p')` is `/requests/new?projectId=p`; `requestHref('')` throws; `holdsRequestApprove('MEMBER', [{ permissions: ['request.approve'] }])` true and `holdsRequestApprove('MEMBER', [{ permissions: ['payment.make'] }])` false and `holdsRequestApprove('OWNER', [])` true; `isSelfApproval('u1', 'u1')` true; `canDecideRequest('PENDING', 'u1', 'u2')` true; `canDecideRequest('PENDING', 'u1', 'u1')` false; `canDecideRequest('APPROVED', 'u1', 'u2')` false; `formatApprovalRequired(2)` locked sentence; `policyPreviewHeading('NOT_PERMITTED')` is `Not permitted.`; `rejectionReason` last REJECT reason; `recentApprovedSpend` excludes `excludeId` and non-APPROVED and caps at 3; `remainingShortfall(-1, 1)` true; `remainingShortfall(500, 500)` false; `unlockedCardIds(['a'], ['a', 'b'])` is `['b']`; `toApprovalRuleBody` has no `id`; `emptyApprovalRuleBody().approverSelection.type` is `'PROJECT_OWNER'`; `formatApproverSelector({ type: 'ROLE', roleKey: 'approver' })` is `Role approver`; `formatApprovalProgress({ approved: 1, required: 2 })` locked sentence.
  - **Notes:** Helpers in `src/client/lib/requests.ts` (16 unit tests). No org-wide list; preview copy uses `requiredApprovals` only; `parseOptionalIdParam` copied (barrel named-exports to avoid clash with A6). `pnpm verify` green (1704 tests). STOP before A7.1 screens.

---

## Tasks

### A7.1 — SideNav + route shells

- [x] **A7.1** — Insert Requests; placeholders so links do not 404
  - **Files:**
    - `src/client/shell/AppShell.tsx` (edit — `DEFAULT_NAV` only)
    - `src/app/(app)/requests/page.tsx` (create — placeholder until A7.2)
    - `src/app/(app)/requests/new/page.tsx` (create — placeholder until A7.3)
    - `src/app/(app)/requests/[id]/page.tsx` (create — placeholder until A7.4)
    - `src/app/(app)/approvals/page.tsx` (replace A2 copy with the same placeholder pattern until A7.5 — keep the route; do **not** leave `Approvals land in A7.`)
    - `src/app/(app)/approvals/[id]/page.tsx` (create — placeholder until A7.6)
  - **Do:**
    1. `DEFAULT_NAV`: insert `{ href: '/requests', label: 'Requests' }` immediately **before** `{ href: '/approvals', label: 'Approvals' }` (after Cards). Do **not** change aside `hidden md:flex` / Menu / Sheet / `w-56`. Do **not** touch `SETTINGS_NAV`.
    2. Placeholders: `<main className="min-w-0">{label} — not built yet</main>` for Requests list, New, Request detail, Approvals queue, Approval detail. Must **not** 404. Static `new/page.tsx` must win over `[id]`.
    3. Do **not** replace `projects/[id]/controls/page.tsx` yet (approval-rules section is A7.7).
  - **Layout:** n/a for placeholders (stack `min-w-0`). Shell collapse unchanged. New href is in the aside at `md` and in the Menu `Sheet` below `md` (same `SideNav`).
  - **Pattern:** A6.1 / A5.1 `src/client/shell/AppShell.tsx` `DEFAULT_NAV` insert (this phase’s B1-equivalent for chrome). Collapse already A2.1 — `docs/RESPONSIVENESS.md` §1; do **not** copy A2.1’s aside rewrite. Placeholders: A5.1 `/cards` pages. B7 list UI path is `/requests`, not `/api/projects/:id/requests`.
  - **Accept:** `pnpm verify`. `/requests`, `/requests/new`, `/requests/any-id`, `/approvals`, `/approvals/any-id` are not 404. SideNav at 768px shows Requests immediately before Approvals; at 375px those labels appear inside the existing Menu Sheet. 375px and 768px: no page-level horizontal scrollbar; Menu/Sheet still works below `md`. Aside still `hidden md:flex`. `AppShell.tsx` does not lose `hidden` or `md:flex`. `SETTINGS_NAV` still four hrefs (no Requests).
  - **Notes:** `DEFAULT_NAV` Requests immediately before Approvals (after Cards). SETTINGS_NAV four hrefs. Placeholders `/requests`, `/requests/new`, `/requests/[id]`, `/approvals`, `/approvals/[id]`. Aside still `hidden md:flex`. `pnpm verify` green (1704 tests).

### A7.2 — Member request list

- [x] **A7.2** — `/requests` DataTable; project Select required
  - **Files:**
    - `src/app/(app)/requests/page.tsx` (replace placeholder)
    - `src/app/(app)/requests/RequestList.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<RequestList />` only.
    2. `parseRequestListSearchParams` from `useSearchParams`. `useProjects({ page: 1, pageSize: 100 })` for the Select. If `projectId` missing or empty: `EmptyState` `selectProjectEmpty()` + project `Select` writing `requestListHref`; **do not** call `useRequests`.
    3. Else `useRequests(projectId, { page: filter.page, pageSize: filter.pageSize })`. **No client-side refilter.** `403` → `ErrorState` `error.message`. `NOT_FOUND` → `This project is not available.` Loading: `LoadingState`.
    4. Toolbar `flex flex-wrap gap-2`: Project `Select` (`__none__` is not a row — use the current id; changing project resets `page` to 1); `PermissionGate` `projectId={projectId}` `permission="payment.make"` `denialMessage={createRequestDenialMessage()}` wrapping `Button asChild` `Link` to `newRequestHref(projectId)` label `New request`. Always visible when a project is selected (disabled + tooltip when denied).
    5. If `total === 0` and not loading: `EmptyState` `noRequestsEmpty()` + the same New gate.
    6. Else `DataTable` columns: `vendor` (`Link` `requestHref(row.id)`), `amount` (`MoneyDisplay` `{ amount: row.amount, currency: row.currency }`), `status` (`StatusBadge kind="request"`), `createdAt` (`formatDate` `src/lib/dates.ts`), `policy` (if `policyDecision` null → `—`; if `NOT_PERMITTED` → first `reasons[0]` with `title` of joined reasons; else `policyPreviewHeading` / `formatApprovalRequired`). `getRowId: (row) => row.id`. Pagination `mode: 'page'` from the response. Do **not** restyle as cards. Do **not** add a second `overflow-x-auto`.
    7. Do not fetch on the server. Do not call preview / create / decide.
  - **Layout:** table scrolls **inside**; page does not. Toolbar wrap. No `md:grid`. No Sheet. Cells `min-w-0`.
  - **Pattern:** A5.2 `src/app/(app)/cards/OrgCardList.tsx` (URL filters, `__all__` Select, page pagination — this phase’s B1-equivalent for lists). Hook: `useRequests` `src/client/hooks/useRequests.ts` (B7 `purchaseRequestContracts.list`). `MoneyDisplay` / `StatusBadge` F3.10. `PermissionGate` F3.14.
  - **Accept:** `pnpm verify`. Changing project writes `?projectId=` and does not client-filter a full unfiltered list. No `?status=` in href helpers. 375px and 768px: no page-level horizontal scrollbar; project Select + New + row Link reachable; table may scroll inside. No `type="number"`. No `useBudgetChangeRequests`.
  - **Notes:** `/requests` requires `?projectId=`; Select writes URL; no `useRequests` until selected; no `?status=`. Gated New request. `pnpm verify` green (1704 tests).

### A7.3 — Create form + live policy preview

- [x] **A7.3** — `/requests/new` preview above submit
  - **Files:**
    - `src/app/(app)/requests/new/page.tsx` (replace placeholder)
    - `src/app/(app)/requests/new/RequestForm.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<RequestForm />` only.
    2. `projectId` from `parseOptionalIdParam` on search `projectId`, else a Project `Select` (`useProjects({ page: 1, pageSize: 100 })`). Currency = `useMe().data.activeOrg.baseCurrency` (length 3); if missing, `ErrorState` `Unable to load`. Do not show a currency picker.
    3. Fields `flex flex-col gap-4` `min-w-0`: vendor `Input` max 200; amount `Input` **text** (`parseMoneyInput` on change/blur — catch invalid and disable Submit; never `type="number"`); category `Select` from `useBudgetCategories(projectId)` + none; description `Textarea` max 2000; justification `Textarea` max 2000. Category load 403 → omit the Select (category is optional).
    4. **Policy preview** in the **same column**, **above** the buttons (spec). `usePolicyPreview` + `useRef` generation counter. `useEffect` when `projectId` min 1 and parsed amount is int >= 0: wait `POLICY_PREVIEW_DEBOUNCE_MS`; bump generation; `mutate({ projectId, amount, currency, categoryId? })`. Ignore stale generations. Keep last successful decision while in-flight. Copy: `checkingPolicyMessage()` while no success yet; then heading + `formatApprovalRequired` or each `reasons[]` line. `NOT_PERMITTED` **must** list every reason verbatim.
    5. Actions `flex flex-wrap gap-2`: `PermissionGate` `payment.make` wrapping `Submit request` (disabled when preview `NOT_PERMITTED` / invalid / no project / pending create+submit) → `useCreateRequest` then `useSubmitRequest({ id: created.id })` then `router.replace(requestHref(created.id))`. `Save draft` → create only then replace. Cancel `Link` `requestListHref({ projectId })` via `buttonVariants` + `Link` (not `Button asChild`).
    6. Submit 422 `policy`: `applyServerErrorsFromApiError` **and** list `details.policy` strings if present; if `created.id` exists navigate to detail rather than losing the draft. 403 → Alert `error.message`.
    7. Do **not** call `evaluatePolicy`. Do **not** call decide.
  - **Layout:** one column `flex-col`. Preview **above** submit. Buttons wrap. No `md:flex-row`. No Sheet. `min-w-0`.
  - **Pattern:** A3.4 `src/app/(app)/projects/[id]/people/add/AddMemberForm.tsx` (form + live preview). Debounce + generation: A4.4 `FormulaEditor.tsx` / A6.5 `RuleBuilder.tsx`. Money: A2.5 `BudgetStep.tsx` (`parseMoneyInput`, no `type="number"`). Hook: `usePolicyPreview` / `useCreateRequest` / `useSubmitRequest` `src/client/hooks/useRequests.ts` (B7 `policyPreview` + `create` + `submit`). `applyServerErrorsFromApiError` `src/client/lib/forms/applyServerErrors.ts`.
  - **Accept:** `pnpm verify` and `pnpm test client/lib/requests`. Create payload has int `amount` and length-3 `currency` and no `id`. `RequestForm.tsx` contains `usePolicyPreview` and `POLICY_PREVIEW_DEBOUNCE_MS` and does **not** contain `evaluatePolicy`, `parseFloat`, `type="number"`, or `useDecideRequest`. 375px: preview stacked **above** Submit / Save draft; both reachable; no page-level horizontal scrollbar. 768px: still one column (preview not beside the form). `NOT_PERMITTED` shows a reason string, not only the heading.
  - **Notes:** Create form; live `usePolicyPreview` + debounce + generation; preview above Submit in one column; Save draft create-only; 422 policy lists `reasons[]`. `pnpm verify` green (1704 tests).

### A7.4 — Request detail (requester)

- [x] **A7.4** — `/requests/[id]` policy, trail, reject reason, unlocked
  - **Files:**
    - `src/app/(app)/requests/[id]/page.tsx` (replace placeholder)
    - `src/app/(app)/requests/[id]/RequestDetail.tsx` (`'use client'`)
  - **Do:**
    1. `useParams().id` via `parseOptionalIdParam`. `useRequest(id)`. `403` → `error.message`. `NOT_FOUND` → `requestNotFoundMessage()`. Loading: `LoadingState`.
    2. Header wrap: vendor, `StatusBadge kind="request"`, `MoneyDisplay`. Back `Link` `requestListHref({ projectId: data.projectId })` (`buttonVariants` + `Link`).
    3. `REJECTED`: destructive `Alert` heading `Rejected` + `rejectionReason(approvals) ?? rejectedFallbackMessage()` — **not** `hidden` on narrow.
    4. `EXPIRED`: `Alert` `expiredRequestMessage()`.
    5. If `escalatedAt`: line `formatEscalatedAt(escalatedAt, formatDate)`.
    6. If `policyDecision`: outcome heading + reasons verbatim + `formatApprovalProgress(approvalProgress(data))` when `required > 0`.
    7. Trail: `Timeline` or a stacked list of `approvals[]` — each `formatDate(at)`, name from `useProjectMembers(projectId)` (`userId` → `user.name`, fallback id), `decision`, `reason` if present. Empty trail + `PENDING` still shows progress. Do not hide the trail.
    8. `APPROVED`: unlocked block per policy §7 (`cardId` Link or `unlockedNoneLinkedMessage()` + `Link` `projectCardsHref`). Do not snapshot cards on this read-only view.
    9. `DRAFT` + `canEditDraft`: reuse the same field set as A7.3 (inline, do not import from `requests/new` if that creates a cycle — duplicate the fields or extract nothing yet). Preview + PATCH `useUpdateRequest` on Save draft; Submit `useSubmitRequest`; Cancel `ConfirmDialog` locked copy → `useCancelRequest` then `router.push(requestListHref({ projectId }))`.
    10. `PENDING` + `canCancelRequest`: Cancel confirm only (no edit).
    11. Do **not** render Approve / Reject on this page (requester surface). Approvers use `/approvals/[id]`.
  - **Layout:** stack. Figures wrap (`flex flex-wrap gap-2`), never `whitespace-nowrap`. Trail not `hidden`. Actions wrap. No page `md:grid`. No Sheet.
  - **Pattern:** A5.4 `src/app/(app)/cards/[id]/CardDetail.tsx`. `Timeline` F3.16. Hook: `useRequest` / `useUpdateRequest` / `useSubmitRequest` / `useCancelRequest`. B7 `purchaseRequestSchema`. Members: A3.2 `PeopleList.tsx` name map.
  - **Accept:** `pnpm verify`. `RequestDetail.tsx` contains `useRequest` and does not contain `useDecideRequest` or `usePanToken` / `cvv` / `card_number`. 375px and 768px: no page-level horizontal scrollbar; Submit / Save / Cancel (when shown) reachable; rejected reason and trail reachable by vertical scroll (not `hidden`).
  - **Notes:** Detail with trail, rejected reason, unlocked copy; DRAFT edit + preview; PENDING cancel. No Approve/Reject. `pnpm verify` green (1704 tests).

### A7.5 — Approver queue

- [x] **A7.5** — `/approvals` stacked cards; decide in place; dashboard Links
  - **Files:**
    - `src/app/(app)/approvals/page.tsx` (replace placeholder)
    - `src/app/(app)/approvals/ApprovalsQueue.tsx` (`'use client'`)
    - `src/app/(app)/dashboard/DashboardHome.tsx` (edit — each pending row becomes `Link` `href={approvalHref(request.id)}`; do not restyle the card)
  - **Do:**
    1. `parseApprovalsSearchParams` → `useApprovals(filter)`. Flatten is unnecessary (`useQuery`, not infinite). **No client-side refilter.** `403` → `error.message`. Loading: `LoadingState`.
    2. If `total === 0`: `EmptyState` `noApprovalsEmpty()`.
    3. Else `flex flex-col gap-4` of **cards** (F3 `Card`), **not** a DataTable. Pagination page mode below (`requestList` pattern: Links or DataTable pagination standalone — use the same page buttons as A5.2 without a table, or wrap items + `Pagination` from F3). Writing `approvalsListHref`.
    4. Extract an inner `QueueItem({ row })` in **this file** (hooks per card are OK):
       - `useMe` for `user.id`; if `isSelfApproval` or `!canDecideRequest` / `viewerHasDecided`, omit decide buttons and show the matching Alert.
       - Wrap body `flex flex-wrap gap-2 min-w-0`: vendor, `MoneyDisplay`, `StatusBadge kind="request"`. **Do not** put amount + vendor + remaining on one `whitespace-nowrap` row.
       - Requester: `useProjectMembers(row.projectId)` name, fallback `row.requestedBy`.
       - Justification as wrapping text (`break-words`).
       - Remaining: `useBudget(row.projectId)` → `MoneyDisplay` of `{ amount: projection.remaining, currency: budget.currency ?? row.currency }`. If query errors, omit remaining (do not fail the card). If `remainingShortfall(remaining, row.amount)`, `Alert` `budgetShortfallMessage()`.
       - Recent spend: `useRequests(row.projectId, { page: 1, pageSize: 20 })` → `recentApprovedSpend(items, row.requestedBy, row.id)` as a wrapping list of vendor + `MoneyDisplay`. If 403, omit.
       - Escalation / progress lines from helpers.
       - Actions `flex flex-wrap gap-2`: `PermissionGate` `projectId={row.projectId}` `permission="request.approve"` wrapping `Approve` → `useDecideRequest().mutate({ id: row.id, input: { decision: 'APPROVE' } })` then unlocked UI per policy §7 (snapshot cards **before** mutate when the returned status is `APPROVED`). `Reject` opens `ConfirmDialog` with `Textarea` reason; confirm disabled while reason trim length 0; payload `{ decision: 'REJECT', reason }`. `Link` `Review` `approvalHref(row.id)` (`buttonVariants` outline + `Link`).
    5. 409 / 403 on decide: Alert `error.message` on that card.
    6. Dashboard: wrap vendor+amount row in `Link` `approvalHref`. Keep `grid-cols-1 md:grid-cols-2` on the dashboard (already A2 — do not add new breakpoints).
  - **Layout:** stacked cards (not DataTable, not `md:grid` of the queue). Card internals wrap. Decide `flex-wrap`. No Sheet for the queue (detail is a route). Remaining / recent spend / Reject **not** `hidden` below `md`.
  - **Pattern:** A4.7 `src/app/(app)/projects/[id]/budget/requests/ChangeRequestList.tsx` (decide + card snapshot — this phase’s B1-equivalent for decide-in-place). Queue layout: spec A7 Layout (stacked cards). Dashboard: A2.2 `DashboardHome.tsx`. Hooks: `useApprovals` / `useDecideRequest` / `useBudget` / `useRequests` / `useProjectCards`. B7 `listApprovals` + `decide`. `ConfirmDialog` F3.20. `CardLimitMoves` A4 if diffs exist.
  - **Accept:** `pnpm verify`. `ApprovalsQueue.tsx` contains `useDecideRequest` and `useApprovals` and does **not** contain `DataTable` or `whitespace-nowrap`. Approve payloads have no `reason`. Reject payloads include `reason` min 1. Self rows (if any) have no Approve button. 375px and 768px: no page-level horizontal scrollbar; Approve / Reject / Review reachable without sideways window scroll; remaining and recent spend reachable by vertical scroll. Dashboard pending rows navigate to `/approvals/{id}`.
  - **Notes:** Stacked queue cards with decide in place, remaining, recent spend; dashboard pending rows Link to `/approvals/{id}`. `pnpm verify` green (1704 tests).

### A7.6 — Approval detail (decide)

- [x] **A7.6** — `/approvals/[id]` context + trail + decide
  - **Files:**
    - `src/app/(app)/approvals/[id]/page.tsx` (replace placeholder)
    - `src/app/(app)/approvals/[id]/ApprovalDetail.tsx` (`'use client'`)
  - **Do:**
    1. `useRequest(id)` same 403 / 404 / loading as A7.4.
    2. Same read blocks as A7.4 (vendor, money, justification, description, category name via `useBudgetCategories` if id set, requester name, remaining, recent spend, policy, trail, escalation, rejected reason). Duplicate JSX is OK for a LOW model; do **not** import `RequestDetail`.
    3. Decide actions only when `canDecideRequest(...)` and `PermissionGate` `request.approve` on `data.projectId`. Same Approve / Reject dialog as A7.5. Self → Alert `selfApprovalMessage()` and **no** buttons. Already decided by viewer → `alreadyDecidedMessage()`. Terminal / non-PENDING → no buttons (409 copy if they somehow fire).
    4. After APPROVE that returns `APPROVED`, unlocked section per policy §7 (snapshot allowed here).
    5. Back `Link` `approvalsHref()`. `Link` to requester view `requestHref(id)` label `View as request` (`buttonVariants` ghost + `Link`).
    6. Do not call submit / cancel / preview on this page.
  - **Layout:** stack. Figures wrap. Decide `flex-wrap`. Trail / remaining / recent spend not `hidden`. No page `md:grid`. No Sheet.
  - **Pattern:** A7.4 `RequestDetail.tsx` + A7.5 decide. B7 `.get` + `.decide`.
  - **Accept:** `pnpm verify`. `ApprovalDetail.tsx` contains `useDecideRequest` and `selfApprovalMessage` / the locked self string and does not contain `useSubmitRequest` / `usePanToken`. 375px and 768px: no page-level horizontal scrollbar; Approve / Reject reachable; trail and remaining reachable by vertical scroll.
  - **Notes:** Approval detail with remaining, recent spend, trail, decide; self-approval Alert and no buttons. `pnpm verify` green (1704 tests).

### A7.7 — Approval rules on project controls

- [x] **A7.7** — `/projects/[id]/controls` threshold + approver editor
  - **Files:**
    - `src/app/(app)/projects/[id]/controls/ProjectControls.tsx` (edit — append section)
    - `src/app/(app)/projects/[id]/controls/ApprovalRuleEditor.tsx` (`'use client'`)
  - **Do:**
    1. After the existing org-wide rules section, heading `Approval rules`. Render `<ApprovalRuleEditor projectId={id} />`.
    2. `useApprovalRules(projectId)`. `403` → omit the editor (controls list already handled `control.edit` elsewhere — if the page loaded, still show `ErrorState` `error.message` inside the section). Loading: `LoadingState` rows={2}.
    3. Local draft array from the query. Empty: helper `noProjectRulesMessage()`. Add → `emptyApprovalRuleBody()`. Remove by index. Each row `flex flex-col gap-3` `min-w-0`:
       - threshold: text `Input` + `parseMoneyInput(raw, currency)` where currency = `useBudget(projectId).data?.budget?.currency` ?? `useMe` baseCurrency. Store **int** on the draft.
       - `requiredCount` text `parseInt` via a tiny local trim `/^[0-9]+$/` (do not `parseFloat`); min 1.
       - `escalationAfterMins` same, min 1.
       - `approverSelection.type` `Select` `ROLE` | `NAMED_USERS` | `PROJECT_OWNER`. Progressive: ROLE → `Select` of `useRoles()` `key`s (fallback text `Input` max 64); NAMED_USERS → multi `Checkbox` list of `useProjectMembers` (send `userIds` min 1 — disable Save while empty); PROJECT_OWNER → no extra fields.
       - `escalateTo` same selector UI.
    4. `PermissionGate` `control.edit` `denialMessage={editControlsDenialMessage()}` wrapping `Save approval rules` → `usePutApprovalRules().mutate({ id: projectId, input: draft.map(toApprovalRuleBody) })`. Always visible (disabled + tooltip). `[]` is allowed.
    5. Do **not** PUT org-default rules. Do **not** add a Settings tab. Do **not** change A6 DataTable behaviour.
  - **Layout:** stack **below** the A6 table. Editor rows column. Add/remove/Save `flex-wrap`. No Sheet. No `md:grid` of all rules. Do not `hidden` the section below `md`.
  - **Pattern:** A6.2 `ProjectControls.tsx` (append only). A3.7 `src/app/(app)/settings/roles/[id]/` permission matrix Save. A3.3 `ScopePicker.tsx` progressive disclosure. Hooks: `useApprovalRules` / `usePutApprovalRules` `src/client/hooks/useRequests.ts` (B7 `approvalRuleContracts`). Money: A2.5 `parseMoneyInput`. `toApprovalRuleBody` A7.0.
  - **Accept:** `pnpm verify`. PUT payload items have `threshold` int, `requiredCount` int >= 1, `escalationAfterMins` int >= 1, and a legal `approverSelection` / `escalateTo` discriminated object — no `id` / `orgId` / `projectId`. `ApprovalRuleEditor.tsx` has no `type="number"` / `parseFloat`. 375px and 768px: no page-level horizontal scrollbar; Add / Remove / Save reachable; A6 New rule + Enable still reachable; approval-rules section not `hidden`. `WORKSPACE_TAB_HREFS` still six.
  - **Notes:** Approval rules section below A6 table; PUT replace-all project rules; empty `[]` allowed; no `type="number"`. `pnpm verify` green (1704 tests).

### A7.8 — Wizard link

- [x] **A7.8** — Approval-rules deferred step points at project controls
  - **Files:**
    - `src/app/(app)/projects/new/ProjectWizard.tsx` (edit — pass href on the approval-rules step)
    - `src/app/(app)/projects/new/steps/DeferredStep.tsx` (edit only if A6.10 props are insufficient — they already accept `href` / `linkLabel`)
  - **Do:**
    1. When `activeStepId === 'approval-rules'` **and** `draftId` min 1, render `DeferredStep` `title="Approval rules"` `phase="A7"` `href={controlsHref(draftId)}` `linkLabel={wizardApprovalRulesLinkMessage()}`.
    2. Prefer `buttonVariants` + `Link` (already in `DeferredStep`). Do **not** `Button asChild`.
    3. Keep the existing Alert. Members/Roles unchanged. Controls step keeps its A6.10 Link. Do **not** embed `ApprovalRuleEditor`. Do **not** change Launch.
    4. `ReviewStep` deferred list may stay as copy-only (no extra Link required).
  - **Layout:** one column (already). No Sheet. No `md:grid`.
  - **Pattern:** A6.10 `ProjectWizard.tsx` + `DeferredStep.tsx`. `controlsHref` `src/client/lib/cards.ts` (re-exported from `requests.ts`).
  - **Accept:** `pnpm verify`. 375px and 768px: wizard Next and the new Link reachable; no page-level horizontal scrollbar. Members deferred step still has no extra Link.
  - **Notes:** Wizard approval-rules DeferredStep Links to controls when `draftId` is set. Members/Roles unchanged. `pnpm verify` green (1704 tests).

### A7.9 — Don’t-break + invariant proofs

- [x] **A7.9** — No client policy engine, unclamped remaining, 375/768, shell unchanged
  - **Files:**
    - `src/client/lib/requests.test.ts` (extend)
    - `src/client/lib/projects.test.ts` (assert `WORKSPACE_TAB_HREFS` still six, still includes `/controls`, still no settings, still no `/projects/${id}/requests`)
    - `src/client/lib/access.test.ts` (SETTINGS_NAV still four hrefs — no Requests)
    - screens listed above — **read only** unless a §9 string or layout class is missing
  - **Do:**
    1. Assert `remainingShortfall` does not clamp (`remainingShortfall(-50, 1)` true; `unlockedCardIds` does not mutate inputs).
    2. Assert `parseRequestListSearchParams({ status: 'PENDING', page: '1' })` has no `status` key.
    3. Assert `toApprovalRuleBody` / `emptyApprovalRuleBody` shapes.
    4. Assert `canDecideRequest` false for self and for `APPROVED`.
    5. Assert `formatApprovalRequired(1)` locked sentence; `policyPreviewHeading('NOT_PERMITTED')` is `Not permitted.`
    6. Grep A7 screen files (`src/app/(app)/requests`, `src/app/(app)/approvals`, `src/app/(app)/projects/[id]/controls/ApprovalRuleEditor.tsx`): no `evaluatePolicy`, no `from '@/server/`, no `type="number"`, no `parseFloat`, no `useBudgetChangeRequests`, no `usePanToken`, no `useSimulatePurchase`. PAN scan: no `cvv`, `card_number`, `\bPAN\b` (same style as A5.10 / A6.11).
    7. Confirm `(app)/layout.tsx` still `requireApp()` + `AppShellFrame`. Confirm `AppShell.tsx` aside class still includes `hidden` and `md:flex`. Confirm `DEFAULT_NAV` includes `/requests` immediately before `/approvals`.
    8. Confirm `WORKSPACE_TAB_HREFS` length 6.
    9. Manual don’t-break: `/requests` (Select + New + table), `/requests/new` (preview above submit), `/requests/[id]` (trail + reject reason), `/approvals` (stacked cards + Approve/Reject), `/approvals/[id]`, controls approval-rules section, wizard approval-rules step, dashboard approvals card at 375px and 768px.
  - **Layout:** n/a (proof) plus the manual resize check.
  - **Pattern:** A6.11 `src/client/lib/rules.test.ts`. A5.10 `src/client/lib/cards.test.ts`. A2.1 shell classes (read-only).
  - **Accept:** `pnpm test client/lib/requests` and `pnpm test client/lib/projects` and `pnpm test client/lib/access` and `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar on request list (Select + New), create (preview above Submit), detail (trail + rejected reason stacked, not hidden), queue (Approve / Reject reachable without sideways window scroll; amount/vendor/remaining wrap), approval detail, controls (Save approval rules), wizard (Next + approval-rules Link); Menu/Sheet still works below `md`; tables may scroll inside. Aside still `hidden md:flex`.
  - **Notes:** Proofs: no client `evaluatePolicy` / `@/server` / `type="number"` / PAN; remaining unclamped; Requests before Approvals; workspace tabs still six; SETTINGS_NAV four hrefs. `pnpm verify` green (1710 tests).

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Spec’s review checklist in `A7-approvals.md` signed off:
  - [ ] Policy preview runs before submission
  - [ ] `NOT_PERMITTED` always names the failing check
  - [ ] The queue carries enough context to decide in place
  - [ ] Rejection reasons are mandatory and surfaced to the requester
  - [ ] Self-approval is impossible in the UI as well as the API
  - [ ] Approval shows what it unlocked
  - [ ] Multi-approver progress is visible
  - [ ] 375px and 768px: no page-level horizontal scrollbar; Approve / Reject reachable without sideways window scroll
- [ ] `/dev/shell` still works (unchanged collapse)
- [ ] No new F3 primitive files
- [ ] No `call()` / `fetch` / `@/server` in `'use client'` screens
- [ ] `STATUS.md` updated with the next phase (**A8**)

## Out of scope (do not do in A7)

- AppShell collapse / second nav (A2.1)
- `/projects/[id]/settings` or a seventh workspace tab
- `GET /api/requests` or any new/changed B7 contract
- Client `evaluatePolicy` / importing `src/server/services/approvals/*`
- Org-default approval-rule editor (no org-level contract)
- Budget change requests (`/projects/[id]/budget/requests`, `useBudgetChangeRequests`)
- `useTransactions` / receipts (A8 / B8 UI)
- Activity feed (A8)
- Editing `invalidationMap.ts` / F1 hooks / B7 contracts
- `@testing-library/react`
- `sm:` / `lg:` / `xl:` / `2xl:` on A7 screens
- Creating cards or typing `transactionLimits` (B6/A6 rules react to `request.approved`)
