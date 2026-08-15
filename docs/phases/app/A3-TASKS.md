# A3 — Project Overview, People & Access · Tasks

**Spec:** [A3-people-access.md](./A3-people-access.md)
**Model:** cheap / LOW — name every file, inline every field with type and constraints, copy the cited A2/A1/F1/B3 file; do not invent endpoints, change B3–B9 contracts, add primitives, reopen AppShell collapse, or hide a control without a Sheet/menu replacement.
**Depends on:** A2, complete and verified

No new API contracts. B3 already shipped `projectMemberContracts`, `roleContracts`, `accessReviewContracts`. Overview uses existing `projectContracts.get`. The review gate is the policies + helper shapes below.

**Powers:** B3 (and B2 `GET` project detail for overview) · **Hooks (F1, already exist):** `useProject`, `useProjectMembers`, `useAddMember`, `useUpdateMember`, `useRemoveMember`, `usePreviewMember`, `useAccessHistory`, `useRoles`, `useCreateRole`, `useUpdateRole`, `useDeleteRole`, `useAccessReviews`, `useResolveAccessReview`, `useOrgMembers`, `useWorkstreams`, `useBudgetCategories`, `useProjectCards`, `useCardholders`, `useBudget`, `useProjectActivity`, `useRequests`, `useMe`, `usePermissions`, `useCan` · **Guards (F0, already exist):** `requireApp` on `(app)/layout.tsx`

Recipe: [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Visual tokens: [`../../VISUAL-DIRECTION.md`](../../VISUAL-DIRECTION.md).

**AppShell collapse is already done (A2.1).** Aside is `hidden w-56 shrink-0 flex-col md:flex`; Menu opens the same `SideNav` / `OrgSwitcher` in F3 `Sheet`. Do **not** reopen `AppShell.tsx` collapse, do **not** build `MobileNav.tsx`, do **not** add `sm:` / `lg:` / `xl:` / `2xl:`. A3.6 may **append** SideNav hrefs only.

---

## A3.0 locked policies (do not reopen)

Approved 2026-08-15. Implementers follow these; do not re-litigate. A3.0 still implements the helpers below and STOPs before A3.1 screens.

### 1. No new contracts, no new primitives, no AppShell collapse

- Do **not** add or rename fields in `src/shared/schemas/*` or `src/shared/contracts/*`.
- Do **not** add `assignedCount` to `roleSchema`. Count holders client-side (policy §8).
- Do **not** add a last-admin check to `DELETE /api/projects/:id/members/:userId`. B3 does not 409; UX blocks only (policy §7).
- Do **not** add a shadcn/pattern file. A3 screens compose F3 files listed in each task’s **Pattern**.
- Do **not** import `@/server/*` from any `'use client'` file.
- Do **not** call `call()` or `fetch` from a screen. Use F1 hooks.
- Do **not** edit `src/client/shell/AppShell.tsx` except the `DEFAULT_NAV` array in A3.6.
- Do **not** edit the A2 wizard (`ProjectWizard.tsx`, `DeferredStep.tsx`). Members/Roles steps stay `Members land in A3.`
- Do **not** add `/projects/[id]/settings`. Workspace tabs stay the six in `WORKSPACE_TAB_HREFS`.
- Do **not** add `DISMISS` to `AccessReviewResolution`. Wire enum is `CONFIRM` \| `REVOKE` only (the access-review schema comment that says “dismisses” is stale).

### 2. Routes (A3 spec wins)

| URL                         | Files                                                                     | Guard                 | Shell                       |
| --------------------------- | ------------------------------------------------------------------------- | --------------------- | --------------------------- |
| `/projects/[id]`            | `src/app/(app)/projects/[id]/page.tsx` + `ProjectOverview.tsx`            | `requireApp` (layout) | `AppShell` + workspace tabs |
| `/projects/[id]/people`     | `src/app/(app)/projects/[id]/people/page.tsx` + `PeopleList.tsx`          | same                  | same                        |
| `/projects/[id]/people/add` | `src/app/(app)/projects/[id]/people/add/page.tsx` + `AddMemberForm.tsx`   | same                  | same                        |
| `/settings/roles`           | `src/app/(app)/settings/roles/page.tsx` + `RolesSettings.tsx`             | same                  | `AppShell` + settings tabs  |
| `/settings/access-reviews`  | `src/app/(app)/settings/access-reviews/page.tsx` + `AccessReviewList.tsx` | same                  | same                        |

No `/projects/[id]/people/[userId]`. Edit role/scope in a F3 `Sheet` on the people list (A3.5).

No `/settings` index. SideNav links the two settings hrefs directly.

**A9 also lists `/settings/access-reviews`.** A3 ships it. A9 must not rebuild it.

### 3. Layout — one breakpoint `md`, four patterns (collapse already exists)

Copy [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Do not add `sm:` / `lg:` / `xl:` / `2xl:` (ignore pre-existing `sm:` inside F3 `Sheet` / `UserMenu` / `BudgetBar` — do not edit those files).

Per-screen layouts (repeat on the task):

| Screen             | Narrow                                                                     | Desktop (`md:`)                                  |
| ------------------ | -------------------------------------------------------------------------- | ------------------------------------------------ |
| Overview           | `grid-cols-1` summary cards; lists stack                                   | `md:grid-cols-2`                                 |
| People `DataTable` | table `overflow-x-auto` (already on `DataTable` root); toolbar `flex-wrap` | same table, **not** a card list                  |
| Add member         | `flex-col` form then preview                                               | `md:flex-row` form \| preview                    |
| Scope picker       | one column; sub-picker appears only after a level is chosen                | same; no `md:grid` of all six levels             |
| Edit member        | F3 `Sheet` `side="right"`                                                  | same Sheet (not a page)                          |
| Settings tabs      | `flex flex-wrap gap-2` **Links**, not Radix `Tabs`                         | same wrap                                        |
| Permission matrix  | `overflow-x-auto` on the table wrapper; page does **not** scroll sideways  | same; sticky first column **optional — skip it** |
| Access reviews     | `DataTable` + internal overflow; toolbar `flex-wrap`                       | same table                                       |

Workspace tabs already `flex flex-wrap` in `ProjectWorkspace.tsx`. Do not switch them to Radix `Tabs`.

### 4. Existing contracts (copy these fields; do not redeclare)

**`GET /api/projects/:id`** — `projectContracts.get` → `projectDetailSchema` = `projectSchema` + `overview`.

`overview` (`src/shared/schemas/project.ts`): `{ memberCount: int min 0, activeCardCount: int min 0, pendingApprovalCount: int min 0, alertCount: int min 0, budgetRemaining: { amount: int, currency: string length 3 } \| null, budgetSpent: money \| null }`.

Server `src/server/services/projects/get.ts` still stubs `memberCount`, `pendingApprovalCount`, `alertCount` to `0`. `activeCardCount` is live (non-`CLOSED`). Budget fields are live when a snapshot exists. **Do not un-stub the server.** Overview tiles use F1 hooks for live numbers (policy §9).

**`GET /api/projects/:id/members`** — `projectMemberContracts.list` — permission `member.view` — output `projectMemberDetailSchema[]`.

`projectMemberSchema`: `{ id: string min 1, orgId: string min 1, projectId: string min 1, userId: string min 1, roleId: string min 1, scope: accessScopeSchema, effectivePermissions: Permission[], addedBy: string min 1, addedAt: iso datetime, removedAt?: iso datetime \| null }`.

`projectMemberDetailSchema` extends that with:

- `role`: `{ id, key: string min 1 max 64 matching /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/, name: string min 1 max 120, isTemplate: boolean }` (`roleSummarySchema`)
- `user`: `{ id, email: z.email(), name: string min 1 max 120, image?: string min 1 }` (`userSummarySchema`)

List is active members only (`removedAt` null). Do not show soft-removed rows.

**`POST /api/projects/:id/members`** — `.add` — permission `member.manage`

- input `addProjectMemberInput`: `{ userId: string min 1, roleId: string min 1, scope: accessScopeSchema }`
- output `projectMemberDetailSchema`
- `409 CONFLICT` `User is already a member of this project`
- `409 CONFLICT` `User is not a member of this organisation`
- User picker is **org members only** (`useOrgMembers`). Do not invite from this screen.

**`PATCH /api/projects/:id/members/:userId`** — `.update` — permission `member.manage`

- input `updateProjectMemberInput`: `{ roleId?: string min 1, scope?: accessScopeSchema }` with **at least one** key
- output `projectMemberDetailSchema`

**`DELETE /api/projects/:id/members/:userId`** — `.remove` — permission `member.manage` — input `z.void()`, output `z.void()`. Soft-remove. **No last-admin 409 from the server.**

**`POST /api/projects/:id/members/preview`** — `.preview` — permission `member.view`

- input `previewProjectMemberInput`: `{ roleId: string min 1, scope: accessScopeSchema }`
- output `previewProjectMemberOutput`: `{ permissions: Permission[], scope: accessScopeSchema, reasons: { permission: Permission, allowed: boolean, message: string min 1 }[] }`
- Same `computeEffectivePermissions` as enforcement. **No save.**
- `usePreviewMember` is a **mutation** with **no invalidation** (F1.6). Keep it that way. Store the result in component state.

**`GET /api/projects/:id/access-history`** — `.accessHistory` — permission `member.view` — output `accessHistoryEntrySchema[]`: `{ id: string min 1, action: string min 1, actorType: USER \| RULE \| SYSTEM \| AIRWALLEX, actorId: string min 1, subjectType: string min 1, subjectId: string min 1, before?: unknown, after?: unknown, metadata: Record<string, unknown>, at: iso datetime }`.

**`GET /api/roles`** — `roleContracts.list` — permission `member.view` — output `roleSchema[]`.

`roleSchema`: `{ id: string min 1, orgId: string min 1, key: string min 1 max 64 matching /^[a-z0-9]+(?:[_-][a-z0-9]+)*$/, name: string min 1 max 120, isTemplate: boolean, permissions: Permission[], defaultScope?: accessScopeSchema, createdAt: iso, updatedAt: iso }`.

Seven templates (per-org copies, `isTemplate: true`) from `src/shared/constants/roleTemplates.ts`: `finance_administrator`, `project_manager`, `approver`, `project_spender`, `procurement_lead`, `contractor`, `viewer`.

**`POST /api/roles`** — `.create` — permission `role.assign`

- input `createRoleInput`: `{ name: string min 1 max 120, key?: same regex as role.key, permissions: Permission[] min 1, defaultScope?: accessScopeSchema }`
- output `roleSchema` (`isTemplate: false`)

**`PATCH /api/roles/:id`** — `.update` — permission `role.assign`

- input `updateRoleInput`: partial `{ name, key, permissions: Permission[] min 1, defaultScope: accessScopeSchema \| null, force?: boolean }` with **at least one** of `name` \| `key` \| `permissions` \| `defaultScope`
- Template currently assigned + `force !== true` → `409 CONFLICT` `Template is assigned to project members; pass force=true to edit`

**`DELETE /api/roles/:id`** — `.delete` — permission `role.assign` — rejected while assigned (`409`). Do not delete templates that still have holders.

**`GET /api/access-reviews`** — `accessReviewContracts.list` — permission `member.manage`

- input `listAccessReviewsQuery`: `{ status?: OPEN \| RESOLVED, projectId?: string min 1 }`
- output `accessReviewSchema[]`: `{ id, orgId, projectId: string min 1, status: OPEN \| RESOLVED, reason: string min 1 max 500, subjectType: 'projectMember', subjectId: string min 1, userId: string min 1, flaggedAt: iso, flaggedBy: string min 1 \| null, resolvedAt: iso \| null, resolvedBy: string min 1 \| null, resolution: CONFIRM \| REVOKE \| null }`

**`POST /api/access-reviews/:id/resolve`** — `.resolve` — permission `member.manage`

- input `{ resolution: CONFIRM \| REVOKE, note?: string max 500 }`
- output `accessReviewSchema`

**`GET /api/organizations/:id/members`** — `organizationContracts.listMembers` — output `membershipWithUserSchema[]`: `{ id, orgId, userId, orgRole: OWNER \| ADMIN \| MEMBER, status: ACTIVE \| SUSPENDED, joinedAt: iso, user: userSummarySchema }`. Add-member Combobox uses `status === 'ACTIVE'` only.

**`GET /api/projects/:id/workstreams`** — `useWorkstreams(id)` → `{ id, name min 1 max 120 }[]`.

**`GET /api/projects/:id/budget/categories`** — `useBudgetCategories(id)` → `budgetCategorySchema[]`: `{ id, name min 1 max 120, workstreamId?: string \| null, allocated: int >= 0, formula?: string \| null }`. Empty before A4 is valid — show `No categories yet.` and do not allow Confirm on `CATEGORY` with zero ids.

**`GET /api/projects/:id/cards`** — `useProjectCards(id, { page, pageSize })` → `{ items: cardSchema[], page, pageSize, total }`. `cardSchema` includes `id`, `nickName` max 100, `maskedNumber` (masked only), `cardholderId`, `accessList: string[]`, `status`. **Never PAN / CVV / expiry.** Do not call `usePanToken`.

**`GET /api/cardholders`** — `useCardholders({ page, pageSize })` → `{ items: { id, userId: string \| null, type, status, … }[], page, pageSize, total }`.

**`GET /api/me/permissions`** — `{ projects: { projectId, permissions: Permission[], scope }[] }`. Client `can()` is UX only.

**Permission** (`src/shared/enums/permissions.ts`): `project.view`, `project.edit`, `project.create`, `project.close`, `budget.view`, `budget.edit`, `budget.request`, `member.view`, `member.manage`, `role.assign`, `card.create`, `card.view`, `card.viewDetails`, `card.manage`, `payment.make`, `request.approve`, `control.edit`, `transaction.view`, `report.export`.

**`accessScopeSchema`** (`src/shared/schemas/accessScope.ts`):

```
{
  level: 'PROJECT' | 'WORKSTREAM' | 'CATEGORY' | 'CARD' | 'OWN' | 'ASSIGNED_MEMBERS'
  workstreamIds?: string min 1[]
  categoryIds?: string min 1[]
  cardIds?: string min 1[]
  memberIds?: string min 1[]
  validFrom?: iso datetime
  validTo?: iso datetime
}
```

### 5. Permission preview (centrepiece)

Render **`reasons[]`**, not just `permissions[]`. Do not invent a second reason generator.

Locked formatter `formatPermissionReason(reason)`:

- `reason.allowed === true` → `Can {PERMISSION_LABELS[permission]} — {reason.message}`
- `reason.allowed === false` → `Cannot {PERMISSION_LABELS[permission]} — {reason.message}`

`reason.message` is already produced by B3 `computeEffectivePermissions`:

- `Granted by {role.name} role`
- `Not granted by {role.name} role`
- `Granted by organisation {OWNER\|ADMIN} role`
- `Access scope has expired`
- `Access scope is not yet valid`

B3 **does not** emit “scope limited to workstream Retail”. Show scope as a **separate** summary line from `scopeSummary(scope)`, under the reasons list. Do not fake a scope-narrowing reason.

Update live: when `roleId` and `isScopeSelectionComplete(scope)` become true, call `usePreviewMember().mutate({ id, input: { roleId, scope } })`. **No debounce** (spec: immediacy). Ignore stale responses with a monotonic request generation counter. While pending, keep the last successful preview (do not blank the pane). If role/scope incomplete, show `Pick a role and finish the scope to preview.`

403 spot-check (A3.9): `preview.reasons` with `allowed: false` for permission `P` means a `MEMBER` caller with that hypothetical role+scope would get `403 PERMISSION_DENIED` / message `Missing ${P}` (`AppError.permissionDenied`). The **strings differ**; match on allow/deny, not copy. Helper `previewWouldDeny(preview, permission): boolean`.

### 6. Scope picker — progressive disclosure

One `RadioGroup` of the six `AccessScopeLevel` values. **Only after** a level is chosen, show the matching sub-picker. Never show all six sub-pickers at once.

| Level              | Sub-picker                                                                     | Complete when               |
| ------------------ | ------------------------------------------------------------------------------ | --------------------------- |
| `PROJECT`          | none                                                                           | always                      |
| `WORKSTREAM`       | stacked `Checkbox` + `Label` per `useWorkstreams(id)`                          | `workstreamIds.length >= 1` |
| `CATEGORY`         | stacked `Checkbox` + `Label` per `useBudgetCategories(id)`                     | `categoryIds.length >= 1`   |
| `CARD`             | stacked `Checkbox` + `Label` `{nickName} {maskedNumber}` per `useProjectCards` | `cardIds.length >= 1`       |
| `OWN`              | none (copy `Only their own transactions and cards.`)                           | always                      |
| `ASSIGNED_MEMBERS` | stacked `Checkbox` + `Label` per other project members (`user.name`)           | `memberIds.length >= 1`     |

`Combobox` is **single-select** (`src/components/ui/combobox.tsx`) — do not use it for multi ids.

Optional time window: F3 `DateRangePicker` `from={validFrom ?? null}` `to={validTo ?? null}`. Omit keys when null. If both set, `validTo >= validFrom` or the picker is incomplete.

`buildAccessScope` **omits** id arrays that do not belong to the chosen level (do not send `workstreamIds` on `PROJECT`). Do not send empty arrays.

Default scope when a role is chosen: `role.defaultScope ?? { level: 'PROJECT' }`.

### 7. Last admin (UX only)

`isLastAccessManager(members, userId, now)` is true when this `userId` is the **only** member with `isScopeActive(scope, now)` and `effectivePermissions` includes `'member.manage'`.

Remove control: `PermissionGateView` `allowed={!isLastAccessManager(...)}` `denialMessage={lastAccessManagerDenialMessage()}` wrapping a disabled Button. Locked copy: `Cannot remove the last member who can manage access.`

Do **not** add a server 409. Org `OWNER`/`ADMIN` still short-circuit `requirePermission` even with zero project members — the copy is still required by the spec’s “last admin” state.

Normal remove: `ConfirmDialog` title `Remove {user.name} from this project?` description `They will lose project access immediately.` confirm `Remove` (not type-to-confirm).

### 8. Role edits warn with an affected-member count

`roleSchema` has **no** `assignedCount`. Client-side:

1. `useProjects({ page: 1, pageSize: 100, sort: 'name' })`
2. `useQueries` + `projectMembersQueryOptions(projectId, callWithOrg)` from `src/client/hooks/useMembers.ts` for each returned project id
3. `countMembersHoldingRole(roleId, lists: { roleId: string }[][]): number` — sum of rows whose `roleId` matches (each project membership counts once)

Confirm copy when count `> 0`: `This role is assigned to {n} member(s). Their effective permissions will be recomputed.` If `projects.total > items.length`, append ` Counted on the first {items.length} of {total} projects.`

- Template (`isTemplate`) + count `> 0`: Save sends `force: true` after ConfirmDialog title `Update this template?` confirm `Save anyway`
- Custom + count `> 0`: same warning ConfirmDialog; PATCH **without** `force` (API only requires `force` on templates in use)
- count `=== 0`: save immediately

Delete disabled with tooltip `This role is assigned to {n} member(s).` when count `> 0`. Always show the control.

### 9. Overview tiles all link (nothing is a dead summary)

`grid grid-cols-1 gap-4 md:grid-cols-2`. Every card title is a `Link`. Compose F3 `Card`.

| Tile              | Number source                                                                                                                                                                                                  | Href                                                           |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Status            | `useProject` `status` (`StatusBadge kind="project"`)                                                                                                                                                           | DRAFT → `draftWizardHref(id)`; else `/projects/${id}/activity` |
| Members           | `useProjectMembers(id).data?.length ?? 0`                                                                                                                                                                      | `/projects/${id}/people`                                       |
| Remaining / spent | `useBudget(id)` projection `remaining` / `actual` as `MoneyDisplay`; if no budget, `No budget set`                                                                                                             | `/projects/${id}/budget`                                       |
| Active cards      | `useProjectCards(id, { page: 1, pageSize: 6 }).data.total`                                                                                                                                                     | `/projects/${id}/cards`                                        |
| Pending approvals | `useRequests(id, { page: 1, pageSize: 5 })` rows with `status === 'PENDING'`; count those on the page (API has no status filter — do **not** pretend `overview.pendingApprovalCount` is live; it is still `0`) | `/approvals`                                                   |
| Alerts            | `useAccessReviews({ status: 'OPEN', projectId: id }).data?.length ?? 0`                                                                                                                                        | `/settings/access-reviews?projectId={id}&status=OPEN`          |
| Recent activity   | `useProjectActivity(id)` first page via `toTimelineItem`                                                                                                                                                       | `/projects/${id}/activity`                                     |

Do not use stubbed `overview.memberCount` / `alertCount` / `pendingApprovalCount` as the displayed number. `overview.activeCardCount` / budget money **may** be used as a fallback while the card/budget query is pending.

Placeholder tab bodies (budget/cards/activity) stay `{Tab} lands in {phase}.` until those phases — linking to them is required.

### 10. Permission matrix

One `Table` (not `DataTable` — columns are dynamic roles). Wrap in `<div className="overflow-x-auto">`. Rows = grouped permissions (`PERMISSION_GROUPS`). Columns = roles, templates first in `ROLE_TEMPLATES` key order, then custom by `name`. Header `Badge`: `Template` if `isTemplate` else `Custom` (this is the inherited-versus-explicit distinction — templates are seeded copies, custom are explicit).

Cell: `Checkbox` checked iff `role.permissions.includes(permission)`. Checking updates **local** state; Save runs `useUpdateRole`. Do not PATCH on every click.

Skip sticky first column (spec: optional). A sideways-scrolling table inside the page is the intended narrow behaviour.

### 11. Member states on the people list

| State                         | UI                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Time window expired / not yet | `memberAccessState` → muted `Inactive` + `scopeWindowReason` (`Access scope has expired` or `Access scope is not yet valid`)               |
| No cards yet                  | `memberHasCards` false → text `No cards yet` (link to `/projects/${id}/cards`)                                                             |
| Last access manager           | Remove gated per §7                                                                                                                        |
| Empty list                    | `EmptyState` title `No members yet` description `Add someone with a role and scope.` action `Add member` → add href, gated `member.manage` |

### 12. Money, PAN, permissions UX, testing, ESLint

- Amounts: `MoneyDisplay` / `BudgetBar`. Never `parseFloat`, never `type="number"`.
- **Never touch a PAN.** Card labels are `nickName` + `maskedNumber` only. No `usePanToken`, no `cvv`, no `card_number`, no expiry.
- `PermissionGate` / `PermissionGateView`: always show the control (disabled + tooltip). Never hide Add / Save / Remove / Resolve.
- Tests: pure helpers in `src/client/lib/access.ts` with vitest **node**. Do **not** add `@testing-library/react`.
- Screen Accept always includes `pnpm verify` plus **375px and 768px**: no page-level horizontal scrollbar; primary actions reachable; no overlapping chrome. Matrix / people table may scroll **inside**.
- `(app)` already bans `call()` / `fetch`. Do not add a `@/server` ban (server layout still uses `requireApp`).

### 13. Locked copy (do not paraphrase)

| Situation                     | Surface                         | Copy                                                                                            |
| ----------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Cannot add member             | `PermissionGateView`            | `You don't have permission to manage members.`                                                  |
| Cannot edit roles             | `PermissionGateView`            | `You don't have permission to assign roles.`                                                    |
| Cannot resolve reviews        | `PermissionGateView`            | `You don't have permission to manage access reviews.`                                           |
| Last access manager           | `PermissionGateView`            | `Cannot remove the last member who can manage access.`                                          |
| Empty people                  | `EmptyState`                    | title `No members yet` / description `Add someone with a role and scope.` / action `Add member` |
| Empty roles custom            | (templates always exist)        | —                                                                                               |
| Empty access reviews          | `EmptyState`                    | title `No access reviews` / description `Flagged access will show up here.`                     |
| Preview incomplete            | preview pane                    | `Pick a role and finish the scope to preview.`                                                  |
| Role assigned (save)          | `ConfirmDialog` description     | `This role is assigned to {n} member(s). Their effective permissions will be recomputed.`       |
| Update template               | `ConfirmDialog` title / confirm | `Update this template?` / `Save anyway`                                                         |
| Remove member                 | `ConfirmDialog`                 | title `Remove {name} from this project?` confirm `Remove`                                       |
| Resolve CONFIRM               | `ConfirmDialog`                 | title `Confirm this access?` confirm `Confirm`                                                  |
| Resolve REVOKE                | `ConfirmDialog`                 | title `Revoke this access?` confirm `Revoke`                                                    |
| OWN helper                    | scope picker                    | `Only their own transactions and cards.`                                                        |
| No categories                 | scope picker                    | `No categories yet.`                                                                            |
| No cards for CARD scope       | scope picker                    | `No cards yet.`                                                                                 |
| Duplicate project member      | `Alert` destructive             | server message (`User is already a member of this project`)                                     |
| Template-in-use without force | `Alert` destructive             | server message (`Template is assigned to project members; pass force=true to edit`)             |

`PERMISSION_LABELS` (locked; used by `formatPermissionReason`):

| Permission         | Label               |
| ------------------ | ------------------- |
| `project.view`     | `view project`      |
| `project.edit`     | `edit project`      |
| `project.create`   | `create project`    |
| `project.close`    | `close project`     |
| `budget.view`      | `view budget`       |
| `budget.edit`      | `edit budget`       |
| `budget.request`   | `request budget`    |
| `member.view`      | `view members`      |
| `member.manage`    | `manage members`    |
| `role.assign`      | `assign roles`      |
| `card.create`      | `create cards`      |
| `card.view`        | `view cards`        |
| `card.viewDetails` | `view card details` |
| `card.manage`      | `manage cards`      |
| `payment.make`     | `make payments`     |
| `request.approve`  | `approve requests`  |
| `control.edit`     | `edit controls`     |
| `transaction.view` | `view transactions` |
| `report.export`    | `export reports`    |

`PERMISSION_GROUPS` (locked row order):

1. `project` — Project — `project.view`, `project.edit`, `project.create`, `project.close`
2. `budget` — Budget — `budget.view`, `budget.edit`, `budget.request`
3. `members` — Members — `member.view`, `member.manage`, `role.assign`
4. `cards` — Cards — `card.create`, `card.view`, `card.viewDetails`, `card.manage`
5. `spend` — Spend — `payment.make`, `request.approve`
6. `controls` — Controls — `control.edit`
7. `data` — Data — `transaction.view`, `report.export`

`SCOPE_LEVEL_LABELS`: `PROJECT` → `Project`, `WORKSTREAM` → `Workstream`, `CATEGORY` → `Category`, `CARD` → `Card`, `OWN` → `Own`, `ASSIGNED_MEMBERS` → `Assigned members`.

---

## Contracts first

- [x] **A3.0** — Access helpers (STOP for review)
  - **Files:**
    - `src/client/lib/access.ts` (create)
    - `src/client/lib/access.test.ts` (create)
    - `src/client/lib/index.ts` (edit — `export * from '@/client/lib/access'`)
  - **Do:** No React screens. No AppShell / nav changes yet. Implement the locked helper API (pure, no React, no `call()`):
    1. `PERMISSION_LABELS`: `Record<Permission, string>` — exact table in §13. Every `Permission` enum value must have a key (test: `Object.values(Permission)`).
    2. `PERMISSION_GROUPS`: `readonly { id: string; label: string; permissions: readonly Permission[] }[]` — exact §13 order. Flatten equals `Object.values(Permission)` with no extras/duplicates.
    3. `SCOPE_LEVEL_LABELS`: `Record<AccessScopeLevel, string>` — exact §13.
    4. `formatPermissionReason(reason: { permission: Permission; allowed: boolean; message: string }): string` — `Can {label} — {message}` / `Cannot {label} — {message}`. Use the message verbatim.
    5. `scopeSummary(scope: { level: AccessScopeLevel; workstreamIds?: string[]; categoryIds?: string[]; cardIds?: string[]; memberIds?: string[]; validFrom?: string; validTo?: string }, names?: { workstreams?: Record<string, string>; categories?: Record<string, string>; cards?: Record<string, string>; members?: Record<string, string> }): string` — `Scope: {SCOPE_LEVEL_LABELS[level]}` plus joined names for the relevant ids (fallback to the raw id). If `validTo` set, append ` until {validTo}`; if `validFrom` set and now-agnostic, append ` from {validFrom}`. Do not invent “limited to workstream X” beyond this summary.
    6. `isScopeActive` — **re-export** from `@/shared/access/scope` (do not copy the function).
    7. `scopeWindowReason(scope, now: Date): 'Access scope has expired' \| 'Access scope is not yet valid' \| null` — match `computeEffectivePermissions` copy: not-yet-valid if `validFrom` parses and `now < from`; expired if `validTo` parses and `now > to`; else null. Invalid ISO → open (same as `isScopeActive`).
    8. `memberAccessState(member: { scope: AccessScope }, now: Date): { kind: 'active' \| 'expired' \| 'not_yet_valid'; reason: string \| null }`
    9. `isLastAccessManager(members: { userId: string; scope: AccessScope; effectivePermissions: Permission[] }[], userId: string, now: Date): boolean`
    10. `lastAccessManagerDenialMessage(): string` — locked §13 sentence.
    11. `countMembersHoldingRole(roleId: string, lists: ReadonlyArray<ReadonlyArray<{ roleId: string }>>): number`
    12. `isScopeSelectionComplete(scope: AccessScope): boolean` — §6 table; plus if both `validFrom` and `validTo` set, `validTo >= validFrom`.
    13. `buildAccessScope(input: { level: AccessScopeLevel; workstreamIds?: string[]; categoryIds?: string[]; cardIds?: string[]; memberIds?: string[]; validFrom?: string \| null; validTo?: string \| null }): AccessScope` — only the id array for that level; omit null dates; omit empty arrays.
    14. `eligibleOrgMembersToAdd(orgMembers: { status: 'ACTIVE' \| 'SUSPENDED'; user: { id: string; name: string; email: string } }[], projectMembers: { userId: string }[]): { id: string; name: string; email: string }[]` — `ACTIVE` and `user.id` not already on the project, sorted by `name`.
    15. `memberHasCards(userId: string, cards: { cardholderId: string; accessList: string[] }[], cardholders: { id: string; userId: string \| null }[]): boolean` — true if any card’s cardholder `userId` matches or `accessList` includes `userId`.
    16. `addMemberHref(projectId: string): string` — `/projects/${projectId}/people/add`. Throw if `projectId.length < 1`.
    17. `peopleHref(projectId: string): string` — `/projects/${projectId}/people`
    18. `SETTINGS_NAV`: `readonly { href: '/settings/roles' \| '/settings/access-reviews'; label: 'Roles' \| 'Access reviews' }[]` in that order.
    19. `parseAccessReviewSearchParams(input: { status?: string \| string[]; projectId?: string \| string[] }): { status?: 'OPEN' \| 'RESOLVED'; projectId?: string }` — arrays use `[0]`. Unknown status dropped. Empty projectId dropped.
    20. `accessReviewListHref(filter: { status?: 'OPEN' \| 'RESOLVED'; projectId?: string }): string` — path `/settings/access-reviews`; `encodeURIComponent` values; omit empties.
    21. `previewWouldDeny(preview: { reasons: { permission: Permission; allowed: boolean }[] }, permission: Permission): boolean` — true iff a reason for that permission has `allowed === false`. Missing reason → true (fail closed).
    22. `toAccessHistoryTimelineItem(entry: { id: string; action: string; actorType: ActorType; actorId: string; subjectType: string; subjectId: string; at: string }): TimelineItem` — `summary: entry.action`; do not put `before`/`after`/`metadata` on the item.
    23. `addMemberDenialMessage()` / `assignRoleDenialMessage()` / `manageAccessReviewDenialMessage()` — locked §13 sentences.
    24. `sortRolesForMatrix(roles: { key: string; name: string; isTemplate: boolean }[]): typeof roles` — templates in `ROLE_TEMPLATES` key order, then custom by `name` localeCompare.
  - **Pattern:** `src/client/lib/projects.ts` + `src/client/lib/projects.test.ts` (A2.0). Scope window copy: `src/server/services/access/computeEffectivePermissions.ts` (`timeWindowDenialMessage`). `isScopeActive`: `src/shared/access/scope.ts`. Labels: `src/shared/enums/permissions.ts` + `src/shared/constants/roleTemplates.ts`. Contracts to copy fields from: `src/shared/contracts/projectMember.ts`, `src/shared/contracts/role.ts`, `src/shared/contracts/accessReview.ts` (B3).
  - **STOP and get this reviewed before A3.1+.** Wrong last-admin rule, preview formatter, or settings routes after screens land is a rewrite.
  - **Accept:** `pnpm test client/lib/access` — cover: every `Permission` has a label; groups flatten to the enum; `formatPermissionReason` uses the server message verbatim; expired vs not-yet-valid copy; `isLastAccessManager` true only for the sole active `member.manage` holder; `buildAccessScope` drops the wrong id arrays and empty arrays; `eligibleOrgMembersToAdd` excludes `SUSPENDED` and existing members; `memberHasCards` true via `accessList` or cardholder `userId`; `previewWouldDeny` fail-closed; `parseAccessReviewSearchParams` drops unknown status; `SETTINGS_NAV` has no `/projects/.../settings`; `addMemberHref` throws on empty id.
  - **Notes:** Helpers in `src/client/lib/access.ts` (`isScopeActive` re-exported from shared). 23 unit tests. `pnpm verify` green (1589 tests). STOP before A3.1 screens.

---

## Tasks

### A3.1 — Overview tab

- [x] **A3.1** — `/projects/[id]` overview; every tile links
  - **Files:**
    - `src/app/(app)/projects/[id]/page.tsx` (replace `ComingSoonTab`)
    - `src/app/(app)/projects/[id]/ProjectOverview.tsx` (`'use client'`)
  - **Do:**
    1. Server `page.tsx` renders `<ProjectOverview />` only.
    2. `useParams().id` as string. `useProject(id)` for status. Tiles per policy §9. Each title is a `Link`.
    3. Loading: `LoadingState`. `NOT_FOUND` → `ErrorState` `This project is not available.` no Retry (workspace layout may already show this — still handle it in the tab).
    4. Remaining/spent: `useBudget(id)`; `MoneyDisplay` of `{ amount: projection.remaining, currency: budget.budget.currency }` and spent `{ amount: projection.actual, currency }`. If `budget.budget` is null, body `No budget set` still linking to `/projects/${id}/budget`. Do not recompute remaining.
    5. Active cards list (up to 6): `nickName` + `maskedNumber` only. No PAN. Empty: `No cards yet.` still linking to cards tab.
    6. Pending: `useRequests(id, { page: 1, pageSize: 5 })`; show rows with `status === 'PENDING'` (`vendor` + `MoneyDisplay` `{ amount, currency }` + `StatusBadge kind="request"`). Do not client-filter other statuses out of the **request** to the API (the query has no status field). Display-filter the page. Card still links `/approvals`.
    7. Alerts: `useAccessReviews({ status: 'OPEN', projectId: id })`; row `reason` (max 500, render as text). Link card chrome to `accessReviewListHref({ status: 'OPEN', projectId: id })`.
    8. Activity: `useProjectActivity(id)` → `Timeline` via `toTimelineItem` from `src/client/lib/projects.ts`.
    9. Members tile count from `useProjectMembers(id)`.
    10. `min-w-0` on the overview root. Do not fetch on the server.
  - **Layout:** stack on narrow, `md:grid-cols-2`. Cards stack their rows (`flex flex-col gap-2`). No Sheet. No `DataTable`. Workspace tabs already wrap.
  - **Pattern:** A2.2 `src/app/(app)/dashboard/DashboardHome.tsx` (linked Cards + Empty/Error/Loading). `MoneyDisplay` / `StatusBadge` / `Timeline`: F3. Hooks: `useProject` `src/client/hooks/useProjects.ts`; `useBudget` `src/client/hooks/useBudget.ts`; `useProjectCards` `src/client/hooks/useCards.ts`; `useRequests` `src/client/hooks/useRequests.ts`; `useAccessReviews` / `useProjectMembers` `src/client/hooks/useMembers.ts`; `useProjectActivity` `src/client/hooks/useReports.ts`. B3 overview counts: `src/shared/schemas/project.ts` `projectOverviewSchema` (do not redeclare; do not trust stubbed member/alert/pending counts).
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; all tiles visible by scrolling **vertically**; Add-member is not on this page (People tab). Every tile title is an `<a>`/`Link`. No `PAN` / `cvv` / `card_number` in these two files.
  - **Notes:** Overview tiles from F1 hooks (not stubbed member/alert/pending counts). Linked Cards + MoneyDisplay/StatusBadge/Timeline. `pnpm verify` green (1589 tests).

### A3.2 — People list

- [x] **A3.2** — `/projects/[id]/people` DataTable + access history
  - **Files:**
    - `src/app/(app)/projects/[id]/people/page.tsx` (replace `ComingSoonTab`)
    - `src/app/(app)/projects/[id]/people/PeopleList.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<PeopleList />`.
    2. `useProjectMembers(id)`. `PermissionGate` is not required to **view** the table (`member.view` is enforced by the API). On `403`, `ErrorState` with `error.message` (no fake empty table).
    3. Toolbar `flex flex-wrap gap-2`: `PermissionGate` `projectId={id}` `permission="member.manage"` wrapping Button `asChild` Link to `addMemberHref(id)` label `Add member` `denialMessage={addMemberDenialMessage()}`. Always visible.
    4. `DataTable` columns (`DataTableColumn`): `name` (`user.name` + `user.email`), `role` (`role.name` + `Badge` `Template` if `role.isTemplate`), `scope` (`SCOPE_LEVEL_LABELS[scope.level]`), `status` (`memberAccessState` → `Active` or `Inactive`), `cards` (`No cards yet` link or empty string when `memberHasCards`), `actions` (placeholder Button `Edit` disabled until A3.5 — **or** omit actions until A3.5 and leave a `TODO(A3.5)` comment). Locked for this task: render Edit/Remove **disabled** with text `Edit lands in A3.5.` only if you have not reached A3.5 in the same session — prefer omitting the column and adding it in A3.5. **Locked:** no fake edit form in A3.2.
    5. `getRowId: (row) => row.id`. `empty`: locked zero-members copy; action gated Add.
    6. `useProjectCards(id, { page: 1, pageSize: 100 })` + `useCardholders({ page: 1, pageSize: 100 })` only to compute `memberHasCards`. Do not render PAN.
    7. Below the table: heading `Access history`; `useAccessHistory(id)` → `Timeline` via `toAccessHistoryTimelineItem`. Empty timeline: default Timeline empty, or a line `No access changes yet.`
    8. Do not restyle rows as cards. Do not add `overflow-x-auto` again (A2.3 already put it on `DataTable`).
  - **Layout:** table scrolls **inside**; page does not. Toolbar `flex-wrap`. History is a column. No `md:grid`. No Sheet in this task.
  - **Pattern:** A2.3 `src/app/(app)/projects/ProjectList.tsx`. `DataTable` `src/components/patterns/DataTable.tsx`. Hooks: `src/client/hooks/useMembers.ts` (B3 contracts). Card/cardholder hooks: `src/client/hooks/useCards.ts`.
  - **Accept:** `pnpm verify`. 375px: page has no horizontal scrollbar; table may scroll inside; Add member reachable. 768px: same, aside visible. Inactive expired members show the locked expired/not-yet copy. `No cards yet` appears when `memberHasCards` is false.
  - **Notes:** DataTable of members with Inactive + locked window copy; `No cards yet` links to cards tab; Add gated `member.manage`. Actions deferred to A3.5. `pnpm verify` green (1589 tests).

### A3.3 — Scope picker

- [x] **A3.3** — `ScopePicker` progressive disclosure (no screen)
  - **Files:**
    - `src/app/(app)/projects/[id]/people/ScopePicker.tsx` (`'use client'`)
  - **Do:**
    1. Props: `{ projectId: string; value: AccessScope; onChange: (next: AccessScope) => void; members?: { userId: string; user: { name: string } }[]; excludeUserId?: string }`.
    2. Level `RadioGroup` using `AccessScopeLevel` values and `SCOPE_LEVEL_LABELS`. `onValueChange` → `onChange(buildAccessScope({ level }))` (clears the other id arrays).
    3. Sub-pickers per §6. `useWorkstreams(projectId)`, `useBudgetCategories(projectId)`, `useProjectCards(projectId, { page: 1, pageSize: 100 })`. ASSIGNED_MEMBERS checkboxes from `members` excluding `excludeUserId`.
    4. Empty sub-lists: locked `No categories yet.` / `No cards yet.` OWN: locked helper sentence.
    5. Optional `DateRangePicker` labelled `Active between (optional)`. `onChange` writes `validFrom`/`validTo` iso or omits.
    6. Card checkbox label: `{nickName} {maskedNumber}` only.
    7. One column `flex flex-col gap-3`. No `md:grid` of levels.
  - **Layout:** stack. Sub-picker is **progressive** (only the chosen level). No Sheet.
  - **Pattern:** A1.6 `CreateOrganizationForm.tsx` (`RadioGroup` / `Checkbox` / `DateRangePicker`). `RadioGroup` `src/components/ui/radio-group.tsx`. `Checkbox` `src/components/ui/checkbox.tsx`. `DateRangePicker` `src/components/ui/date-range-picker.tsx`. `buildAccessScope` from A3.0. B3 scope shape: `src/shared/schemas/accessScope.ts`.
  - **Accept:** `pnpm verify` and `pnpm test client/lib/access`. 375px and 768px: all six level radios reachable; choosing `WORKSTREAM` reveals workstream checkboxes and hides card/category/member lists. No page-level horizontal scrollbar.
  - **Notes:** Progressive RadioGroup + one sub-picker; card labels nickName + maskedNumber; optional DateRangePicker. `pnpm verify` green (1589 tests).

### A3.4 — Add member + live preview

- [x] **A3.4** — `/projects/[id]/people/add` form + `reasons[]` preview
  - **Files:**
    - `src/app/(app)/projects/[id]/people/add/page.tsx` (create)
    - `src/app/(app)/projects/[id]/people/add/AddMemberForm.tsx` (`'use client'`)
    - `src/app/(app)/projects/[id]/people/PermissionPreview.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<AddMemberForm />`.
    2. `useActiveOrg().orgId` → `useOrgMembers(orgId)`. `useProjectMembers(id)` + `eligibleOrgMembersToAdd` → user `Combobox` (`value: user.id`, `label: `${name} (${email})``).
    3. Role `Select` from `useRoles()` (`role.name`). On role change, set `scope` to `role.defaultScope ?? { level: 'PROJECT' }`.
    4. `ScopePicker` `projectId={id}` `members={projectMembers}` `excludeUserId={selectedUserId}`.
    5. `PermissionPreview`: list `formatPermissionReason` for **every** `reasons[]` row (granted and denied). Above the list, `scopeSummary(...)`. Incomplete → locked incomplete copy. Do not render only `permissions[]`.
    6. Live preview: when `roleId` set and `isScopeSelectionComplete(scope)`, `usePreviewMember().mutate({ id, input: { roleId, scope } })`. Generation counter to drop stale results. No debounce.
    7. Confirm: `useAddMember().mutateAsync({ id, input: { userId, roleId, scope: buildAccessScope(scope) } })` then `router.push(peopleHref(id))`. Disabled until user + role + complete scope. `PermissionGate` `member.manage`. `409` → `Alert` destructive server message. `422` → `applyServerErrorsFromApiError`. `403` → Alert `error.message`.
    8. Cancel: `Link` to `peopleHref(id)`.
    9. Preview pane `min-w-0`. Reasons list `overflow-y-auto` max height is OK; do not overflow the **page** sideways.
  - **Layout:** `flex flex-col gap-6 md:flex-row`. Form column `min-w-0 flex-1`; preview column `min-w-0 flex-1`. On narrow, form **above** preview (stack). Buttons `flex flex-wrap gap-2`. No Sheet. Scope picker stays one column.
  - **Pattern:** A1.6 form + A1.4 invite preview (read-only pane). `Combobox` `src/components/ui/combobox.tsx`. `Select` `src/components/ui/select.tsx`. `usePreviewMember` / `useAddMember` `src/client/hooks/useMembers.ts`. B3 preview: `src/shared/contracts/projectMember.ts` `preview`. `applyServerErrorsFromApiError` `src/client/lib/forms/applyServerErrors.ts`.
  - **Accept:** `pnpm verify`. Changing role or scope refetches preview (inspect that `mutate` runs). Preview text includes `Can`/`Cannot` and a `reasons[].message`. 375px and 768px: no page-level horizontal scrollbar; Add / Cancel / role / scope radios reachable; at `md` form and preview sit in a row. Confirm disabled when `CATEGORY` has zero boxes checked.
  - **Notes:** Live `usePreviewMember` with generation counter; `reasons[]` via `formatPermissionReason`; Confirm disabled until user+role+complete scope. `pnpm verify` green (1589 tests).

### A3.5 — Edit / remove member

- [x] **A3.5** — People row Edit `Sheet` + Remove + last-admin gate
  - **Files:**
    - `src/app/(app)/projects/[id]/people/PeopleList.tsx` (edit — add actions)
    - `src/app/(app)/projects/[id]/people/EditMemberSheet.tsx` (`'use client'`)
  - **Do:**
    1. Actions column: `Edit` opens `Sheet` `side="right"`; `Remove` per §7.
    2. `EditMemberSheet`: role `Select` + `ScopePicker` + `PermissionPreview` (live, same as add). Save `useUpdateMember({ id, userId, input: { roleId, scope } })` (both keys OK). `PermissionGate` `member.manage`.
    3. Remove: if `isLastAccessManager(members, row.userId, new Date())`, `PermissionGateView` disabled with `lastAccessManagerDenialMessage()` — do not open `ConfirmDialog`. Else ConfirmDialog locked copy then `useRemoveMember({ id, userId: row.userId })`.
    4. `409` / `403` → `Alert` destructive `error.message`.
    5. Close the Sheet on successful save. Do not add `/people/[userId]`.
  - **Layout:** wrap vs Sheet. Sheet `side="right"`; body `flex flex-col gap-4 min-w-0`. Do not `hidden` Edit on narrow. Toolbar still `flex-wrap`.
  - **Pattern:** A2.1 Sheet usage in `src/client/shell/AppShell.tsx` (`Sheet` / `SheetContent` / `SheetHeader` / `SheetTitle`). ConfirmDialog: A2.3 cancel on `ProjectList.tsx`. Hooks: `useUpdateMember` / `useRemoveMember` `src/client/hooks/useMembers.ts`.
  - **Accept:** `pnpm verify` and `pnpm test client/lib/access`. 375px and 768px: Edit/Remove reachable; Sheet does not force page-level horizontal scroll; last manager’s Remove is visible but disabled with the locked tooltip.
  - **Notes:** Edit Sheet + live preview; last access manager Remove disabled with locked tooltip. `pnpm verify` green (1589 tests).

### A3.6 — Settings chrome + SideNav

- [x] **A3.6** — Settings tab Links; SideNav Roles + Access reviews; roles list chrome
  - **Files:**
    - `src/client/shell/AppShell.tsx` (edit — `DEFAULT_NAV` only)
    - `src/app/(app)/settings/layout.tsx` (create)
    - `src/app/(app)/settings/SettingsChrome.tsx` (`'use client'`)
    - `src/app/(app)/settings/roles/page.tsx` (create — list chrome; matrix in A3.7)
    - `src/app/(app)/settings/access-reviews/page.tsx` (create — placeholder `Access reviews — not built yet` **or** render a one-line `ComingSoon` until A3.8; locked: must **not** 404)
  - **Do:**
    1. `DEFAULT_NAV` append `{ href: '/settings/roles', label: 'Roles' }` and `{ href: '/settings/access-reviews', label: 'Access reviews' }` after Reports. Do **not** change aside `hidden md:flex` / Menu / Sheet.
    2. `SettingsChrome`: `nav` `flex flex-wrap gap-2` of `Link`s from `SETTINGS_NAV`. Active: `pathname === href`. `buttonVariants({ variant: 'ghost' })` `Button asChild`. Content column `min-w-0`. Do **not** use Radix `Tabs`.
    3. `layout.tsx` wraps children with `SettingsChrome`.
    4. Roles page (until A3.7 matrix): heading `Roles`; `useRoles()`; list name + `Badge` Template/Custom. Toolbar `Create role` gated `role.assign` (`PermissionGate` needs a `projectId` — use `usePermissions().data.projects[0]?.projectId` if present, else `PermissionGateView` with `allowed={orgRole is OWNER or ADMIN}` via `activeOrgRole` from `src/client/lib/projects.ts` + `assignRoleDenialMessage()`). Create: `Dialog` with `name` Input min 1 max 120; submit `useCreateRole({ name, permissions: ['project.view'] })` (schema requires `permissions.min(1)`; default that one permission so the dialog can be simple). Duplicate key → Alert server message.
    5. Do not implement the matrix in this task. Do not implement access-review resolve.
  - **Layout:** settings tabs `flex-wrap`. Create dialog stacked fields. No `md:grid`. Shell collapse unchanged (Sheet already from A2.1).
  - **Pattern:** A2.8 `ProjectWorkspace.tsx` tab Links. `DEFAULT_NAV` in `src/client/shell/AppShell.tsx`. `Dialog` F3.6 `src/components/ui/dialog.tsx`. `useRoles` / `useCreateRole` `src/client/hooks/useMembers.ts`. B3 `src/shared/contracts/role.ts`.
  - **Accept:** `pnpm verify`. `/settings/roles` and `/settings/access-reviews` are not 404. SideNav at 768px shows Roles + Access reviews; at 375px they appear inside the existing Menu Sheet (same `SideNav`). 375px and 768px: no page-level horizontal scrollbar; Create role reachable. Aside still `hidden md:flex` (do not regress A2.1).
  - **Notes:** SideNav appends Roles + Access reviews after Reports; settings wrap Links; create-role Dialog. Aside still `hidden md:flex`. `pnpm verify` green (1589 tests).

### A3.7 — Permission matrix

- [x] **A3.7** — Roles vs permissions grid; affected-member warning; `force`
  - **Files:**
    - `src/app/(app)/settings/roles/RoleMatrix.tsx` (`'use client'`)
    - `src/app/(app)/settings/roles/page.tsx` (edit — render matrix)
    - `src/app/(app)/settings/roles/RolesSettings.tsx` (`'use client'` — move list+matrix here if `page.tsx` would mix too much; keep ≤ this file list)
  - **Do:**
    1. `useRoles()` + `sortRolesForMatrix`. Local state `Record<roleId, Permission[]>` initialised from `role.permissions`.
    2. `Table` wrapped in `overflow-x-auto`. First column permission label (`PERMISSION_LABELS`) grouped by `PERMISSION_GROUPS` (a group header row `colSpan` is OK). Role columns: `role.name` + Template/Custom `Badge`. Cell `Checkbox`.
    3. `useProjects({ page: 1, pageSize: 100, sort: 'name' })` + `useQueries` with `projectMembersQueryOptions` from `src/client/hooks/useMembers.ts` (need `useCall()`). `countMembersHoldingRole`.
    4. Save per dirty role: policy §8 ConfirmDialog + `useUpdateRole({ id, input: { permissions, force?: true } })`. `PermissionGateView` `role.assign`.
    5. Delete custom roles only (`!isTemplate`) via `useDeleteRole`; disabled when count `> 0` with locked tooltip. Templates: no Delete button (or disabled `Cannot delete a template.`).
    6. Do not PATCH on each checkbox. Do not restyle as cards. Do not add sticky first column.
  - **Layout:** table scrolls **inside**; page does not. Save/Delete `flex flex-wrap gap-2`. No `md:grid` of the matrix. No Sheet required (ConfirmDialog / Dialog already portal).
  - **Pattern:** F3 `Table` `src/components/ui/table.tsx`. `Checkbox` `src/components/ui/checkbox.tsx`. Kitchen sink tables: `src/app/dev/ui/PatternGallery.tsx`. `projectMembersQueryOptions` `src/client/hooks/useMembers.ts`. B3 force: `src/shared/schemas/role.ts` `updateRoleInput.force`. ConfirmDialog F3.20.
  - **Accept:** `pnpm verify`. Saving a template that `countMembersHoldingRole > 0` opens `Update this template?` and the mutation includes `force: true`. 375px: page has no horizontal scrollbar; matrix may scroll inside; Save reachable. 768px: same. Checkboxes for all 19 permissions × each role are reachable via internal scroll.
  - **Notes:** Local checkbox state; template-in-use Save uses `force: true` after `Update this template?`. Matrix scrolls inside. `pnpm verify` green (1589 tests).

### A3.8 — Access reviews

- [ ] **A3.8** — `/settings/access-reviews`
  - **Files:**
    - `src/app/(app)/settings/access-reviews/page.tsx` (replace placeholder)
    - `src/app/(app)/settings/access-reviews/AccessReviewList.tsx` (`'use client'`)
  - **Do:**
    1. `useSearchParams` + `parseAccessReviewSearchParams` → `useAccessReviews(filter)`. **No** extra client refilter.
    2. Toolbar `flex flex-wrap gap-2`: status `Select` All (omit) / `OPEN` / `RESOLVED`; changing writes `router.replace(accessReviewListHref(...))`.
    3. `DataTable` columns: `reason`, `status` (`Badge`), `flaggedAt` (`formatDate` `src/lib/dates.ts`), `projectId` (Link to `/projects/${projectId}/people` when present), `actions`.
    4. Actions only when `status === 'OPEN'`: `Confirm` and `Revoke` each wrapped in `PermissionGate` — `member.manage` needs a project subject: `projectId={row.projectId}`. ConfirmDialogs locked §13. `useResolveAccessReview({ id: row.id, input: { resolution: 'CONFIRM' \| 'REVOKE' } })`. Optional `note` skipped (do not add a note field unless it fits without extra files).
    5. `empty`: locked copy. `loading` / `error` with `onRetry`.
    6. Overview alerts already link here with `projectId` + `status=OPEN` — honour those params.
  - **Layout:** table scrolls inside; toolbar wrap. No card-list. No `md:grid`.
  - **Pattern:** A2.3 `ProjectList.tsx` URL filters. `useAccessReviews` / `useResolveAccessReview` `src/client/hooks/useMembers.ts`. B3 `src/shared/contracts/accessReview.ts` + `src/shared/schemas/accessReview.ts`. `AccessReviewStatus` / `AccessReviewResolution` `src/shared/enums/accessReviewStatus.ts`.
  - **Accept:** `pnpm verify`. `/settings/access-reviews?status=OPEN&projectId=x` calls the API with those fields (no extra client filter). 375px and 768px: no page-level horizontal scrollbar; Confirm / Revoke reachable when offered. No `DISMISS` control.
  - **Notes:** _{filled in on completion}_

### A3.9 — Preview vs 403 + don’t-break proofs

- [ ] **A3.9** — Preview deny matches enforcement; 375/768; no PAN; no Settings workspace tab
  - **Files:**
    - `src/client/lib/access.test.ts` (extend)
    - `src/client/lib/projects.test.ts` (read-only assert `WORKSPACE_TAB_HREFS` still has no settings — do not change A2 helper unless a test needs an import of `SETTINGS_NAV`)
    - screens listed above — **read only** unless a §13 string or layout class is missing
  - **Do:**
    1. Assert `previewWouldDeny({ reasons: [{ permission: 'card.manage', allowed: false, message: 'Not granted by Viewer role' }] }, 'card.manage')` is true, and `allowed: true` is false. Assert fail-closed when reasons omit the permission.
    2. Assert `formatPermissionReason` for `budget.view` allowed + message `Granted by Project Manager role` equals `Can view budget — Granted by Project Manager role`.
    3. Assert `SETTINGS_NAV` hrefs are exactly `/settings/roles` and `/settings/access-reviews`. Assert `WORKSPACE_TAB_HREFS` still has no `settings`.
    4. Assert no file under `src/app/(app)/projects` or `src/app/(app)/settings` contains `PAN`, `cvv`, or `card_number` (same style as A2.9).
    5. Confirm `(app)/layout.tsx` still `requireApp()` + `AppShellFrame`. Confirm `AppShell.tsx` aside class still includes `hidden` and `md:flex`.
    6. Manual don’t-break: overview, people, add-member, settings/roles matrix, access-reviews at 375px and 768px.
  - **Layout:** n/a (proof) plus the manual resize check.
  - **Pattern:** A2.9 `src/client/lib/projects.test.ts`. 403 message shape: `src/server/http/errors.ts` `permissionDenied` → `Missing ${permission}` (do not expect that string inside the preview pane).
  - **Accept:** `pnpm test client/lib/access` and `pnpm test client/lib/projects` and `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar on overview, people, add (form stacks, preview below), roles (matrix internal scroll), access-reviews; Menu/Sheet still works below `md`; Add / Save / Confirm reachable.
  - **Notes:** _{filled in on completion}_

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Spec’s review checklist in `A3-people-access.md` signed off:
  - [ ] The preview renders `reasons[]` and updates live
  - [ ] The preview matches actual enforcement — spot-check against a real `403` (allow/deny via `previewWouldDeny`, not string equality with `Missing ${permission}`)
  - [ ] Scope selection uses progressive disclosure
  - [ ] Role edits warn about affected members
  - [ ] Every overview element links somewhere useful
  - [ ] `can()` gates actions, and the server still rejects them if bypassed
  - [ ] 375px and 768px: no page-level horizontal scrollbar; matrix may scroll internally; Add / Save reachable
- [ ] `/dev/shell` still works (inherits new SideNav items + existing collapse)
- [ ] No new F3 primitive files
- [ ] No `call()` / `fetch` / `@/server` in `'use client'` screens
- [ ] `STATUS.md` updated with the next phase (**A4**)

## Out of scope (do not do in A3)

- AppShell collapse / second nav (A2.1)
- `/projects/[id]/settings` or a seventh workspace tab
- Org member invite/create from Add member (A1 already owns invite)
- Org last-owner removal (`Cannot remove or demote the last owner` is B1 org members, not this people list)
- Un-stubbing `overview.memberCount` / `pendingApprovalCount` / `alertCount` on `GET /api/projects/:id`
- Adding `assignedCount` to `roleSchema` or `DISMISS` to access reviews
- Wizard Members/Roles step bodies (stay deferred Alerts)
- Budget categories/formulas (A4) — picker may be empty
- Real cards / Airwallex iframes / PAN reveal (A5)
- Approvals queue body (A7) — overview links to `/approvals`
- Activity tab body (A8)
- Closure / reports (A9) — A9 must **not** rebuild `/settings/access-reviews`
- Sticky matrix first column
- Debouncing the preview call
- `@testing-library/react`
