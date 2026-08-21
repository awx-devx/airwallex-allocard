# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** Visual language and layout (post–Track A)
**Active task:** _wait for the user to name the next phase_
**Last green `pnpm verify`:** 2026-08-21 (live individual card create 202; 1894 tests)
**Blocked on:** _nothing_

---

## Progress

| Track | Phase                      | Status       | Tasks   |
| ----- | -------------------------- | ------------ | ------- |
| B     | B0 Foundation              | **complete** | 13 / 13 |
| B     | B1 Auth & organisations    | **complete** | 15 / 15 |
| B     | B2 Projects                | **complete** | 12 / 12 |
| B     | B3 Access control          | **complete** | 14 / 14 |
| B     | B4 Budget                  | **complete** | 16 / 16 |
| B     | B5 Cards                   | **complete** | 15 / 15 |
| B     | B6 Rules engine            | **complete** | 15 / 15 |
| B     | B7 Requests & approvals    | **complete** | 11 / 11 |
| B     | B8 Money in motion         | **complete** | 11 / 11 |
| B     | B9 Reporting & closure     | **complete** | 11 / 11 |
| F     | F0 Client foundation       | **complete** | 17 / 17 |
| F     | F1 Data layer              | **complete** | 15 / 15 |
| F     | F2 Utils                   | **complete** | 11 / 11 |
| F     | F3 UI library              | **complete** | 26 / 26 |
| A     | A1 Auth & onboarding       | **complete** | 8 / 8   |
| A     | A2 Dashboard & projects    | **complete** | 10 / 10 |
| A     | A3 People & access         | **complete** | 10 / 10 |
| A     | A4 Budget                  | **complete** | 10 / 10 |
| A     | A5 Cards                   | **complete** | 11 / 11 |
| A     | A6 Controls & automation   | **complete** | 12 / 12 |
| A     | A7 Purchase requests       | **complete** | 10 / 10 |
| A     | A8 Activity & transactions | **complete** | 9 / 9   |
| A     | A9 Reports & closure       | **complete** | 10 / 10 |

Track A **complete**. Visual language and layout (tokens, org switcher, walkers, PageHeader, screen composition) shipped after Track A. Next is whatever the user names — do not invent a phase. Visual direction: `docs/VISUAL-DIRECTION.md`.

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

**Live card create (2026-08-21).** After Airwallex account issuance was enabled, `POST /issuing/cards/create` returned **202** and we published `card.created`. Pinned API `2024-02-22` sends `issue_to: INDIVIDUAL` for MEMBER (no `program` / `is_personalized` / INDIVIDUAL `purpose`), `+0000` datetimes, and re-provisions fixture `ch_fixture_*` ids to real UUIDs. Diagnostic request-body logs removed.

**Pending card hookup (2026-08-21).** Local PENDING stubs (`pending:…`) are no longer treated as already issued. `completePendingCard` attaches by `metadata.cardDocId` or retries create with the same `request_id`. `created_by` is the user's display name (fallback `Allocard Operator`), never a user id. Worker `refresh-attributes` finishes PENDING cards every 60s even when cardholders are already READY.

**Sandbox cardholder mobile (2026-08-21).** Live Issuing is `https://api-demo.airwallex.com` (sandbox), not production. INDIVIDUAL create now sends placeholder `mobile_number: 14155550100` — this sandbox account returns `400 mobile_number is mandatory` without it. Worker `refresh-attributes` will retry existing `pending:` cardholders. Restart `pnpm dev:worker` after this change. `pnpm verify` green (1883 tests).

**Live card issuance (2026-08-21).** Launch actually issues MEMBER cards. Redis Streams (`XADD`/`XREADGROUP`) carry `project.launched` from Next.js to the worker when `REDIS_URL` is set. `evaluateAndApply` provisions `card.create` (READY cardholder → `APPLIED`; PENDING → retryable `SKIPPED`). Worker `refresh-attributes` polls PENDING cardholders and re-evaluates ACTIVE projects once they are READY. Enabling a `project.launched` rule on an already-ACTIVE project replays evaluation. Template A covers spender + manager, listens for `member.added`, and enables on apply. Wizard copy no longer claims structure switches issue cards. `pnpm verify` green (1882 tests). Next: wait for the user to name the next phase. Restart `pnpm dev` **and** `pnpm dev:worker` so already-ACTIVE projects pick this up (enable the issuance rule if it was off).

**Permission preview tags (2026-08-20).** Allowed permissions sort to the top as quiet success chips with a check; denied are quiet danger chips with an X. No “Can/Cannot” or “Granted by …” copy. `pnpm verify` green (1865 tests). Next: wait for the user to name the next phase.

**Invite-accept onboarded loop (2026-08-20).** After sign-up the JWT cached `onboarded: false` and did not re-read memberships on the next request. Accept wrote the membership; `/api/onboarding/status` said onboarded and sent you to `/dashboard`; `requireApp` still saw the stale JWT and sent you back. `shouldRefreshOrgClaims` now rechecks while `onboarded !== true` (still caches once true). Accept / create-org also `router.refresh()` + `replace`. `pnpm verify` green (1864 tests). Next: wait for the user to name the next phase.

**Org Members tab (2026-08-20).** `/settings/members` is first in SETTINGS_NAV. Roster is visible to every org member. Invite / pending invites / role / suspend / remove are OWNER/ADMIN (`org.manage`). Create invite shows `/invite/<token>` once (copy; no email). Last ACTIVE OWNER cannot be demoted, suspended, or removed. `pnpm verify` green (1863 tests). Next: wait for the user to name the next phase.

**Powered by Airwallex tab (2026-08-20).** Horizontal lockup hanging off AppHeader and the pre-shell form column (`PoweredByAirwallex`). Light/dark images from `public/images/`; click opens `https://www.airwallex.com` in a new tab. Next: wait for the user to name the next phase.

**Add-member layout (2026-08-20).** Person, Role, and Active between sit in `grid-cols-1 md:grid-cols-3`. Scope radios wrap on one row. Permissions preview is a second card only after role + scope are complete. Combobox options can grow past the trigger and wrap. `pnpm verify` green (1856 tests). Next: wait for the user to name the next phase.

**Launch redirects to the project (2026-08-20).** After a successful launch (or opening the wizard on an already ACTIVE project), the wizard goes to `/projects/:id` instead of dumping the activity timeline. Approval-needed stays on Launch with the info alert. `pnpm verify` green (1856 tests). Next: wait for the user to name the next phase.

**Wizard copy and card-structure help (2026-08-20).** Dropped budget/cards tab shortcut buttons from the wizard. Each card-structure switch has a one-line description. Launch copy is “When you launch, the project goes live and cards are issued from the structure you chose.” `pnpm verify` green (1856 tests). Next: wait for the user to name the next phase.

**Wizard drop placeholder steps (2026-08-20).** Create flow is Details → Budget → Card structure → Review → Launch. Members, Roles, Controls, and Approval rules came out of the rail (still on People / Settings / Controls after launch). `DeferredStep` removed. `pnpm verify` green (1854 tests). Next: wait for the user to name the next phase.

**Wizard workstream remove (2026-08-20).** Details chips are Remove buttons. Pending names drop locally; saved names `DELETE /api/projects/:id/workstreams/:wsId` (409 if a budget category still references it). `pnpm verify` green (1854 tests). Next: wait for the user to name the next phase.

**Wizard workstreams always visible (2026-08-20).** Details step no longer hides Workstreams until `draftId`. Names queue locally on first visit; Continue creates the draft then POSTs each workstream. Typed-but-not-Added name is included. `pnpm verify` green (1853 tests). Next: wait for the user to name the next phase.

**Unauthenticated on create project (2026-08-20).** SessionProvider polls ran `jwt()` → Mongo every time. Atlas DNS timeout threw `JWTSessionError` and wiped the session, so `POST /api/projects` returned 401. Org claims stay cached on the token and refresh on sign-in / `update()` only; a DB error keeps the cached claims. `pnpm verify` green (1851 tests). Sign in again after this fix. Next: wait for the user to name the next phase.

**Favicon and document metadata (2026-08-20).** App Router file convention: `src/app/favicon.ico` (32×32 RGBA PNG-in-ICO — paletted ICO fails Turbopack), `icon.png` (192 cutout, transparent field, matches `public/brand/icon.png`), `apple-icon.png` (180, opaque, matches `apple-touch-icon.png`). Root metadata: application name, title template `%s · Allocard`, description, Open Graph, Twitter, apple-web-app, no format-detection. Viewport `themeColor` follows light/dark canvas; `colorScheme: light dark`. OG/Twitter images stay `opengraph-image.tsx` / `twitter-image.tsx`. `pnpm verify` green (1851 tests). Next: wait for the user to name the next phase.

**Form field grid alignment (2026-08-20).** `FormItem` is `content-start self-start` so a helper line (e.g. Code: “Letters, numbers, hyphens.”) no longer stretches the sibling input. Inputs stay aligned; info text sits under its field; the next row starts after that. `pnpm verify` green (1846 tests). Next: wait for the user to name the next phase.

**FormPanel + numbered StepWizard (2026-08-20).** Wizard rail is a numbered progress list (index, check on complete, connector, wraps). Step body and Cancel/Back/Continue sit on `FormPanel` (Card + optional footer). Same surface on New request, Add member, Rule builder, Approval rule editor, and Simulate. Closure no longer double-wraps the wizard in a Card. Auth / create-org / invite already had Cards. `pnpm verify` green (1845 tests). Next: wait for the user to name the next phase.

**Stale org after sign-up (2026-08-20).** A leftover `allocard:activeOrgId` was sent as `x-org-id` on `/api/onboarding/status`, which 404'd new users. Session resolution now ignores an unmatched explicit org when the user is not onboarded; `useCall` omits the header until onboarded; active-org storage is bound to `userId`. `pnpm verify` green (1841 tests). Next: wait for the user to name the next phase.

**FilterBar alignment (2026-08-20).** Labeled filters (`FilterSelect`, date range, id inputs) sit in `FilterBar` (`items-end`) so unlabeled buttons line up with the control, not the field label. Filter triggers are `h-9` to match default `Button` / `Input`. `pnpm verify` green (1826 tests). Next: wait for the user to name the next phase.

**Compact fact tiles (2026-08-20).** Skinny one-line Cards (status, member count, remaining/spent, org-report totals, report catalogue links) are `StatTile` (`px-3 py-2.5`, not Card padding). Lists stay Cards. Card detail: visual + limits on one row; holder / access / rule as tiles. Shared `Card` padding is `py-4` / `px-4`. `LoadingState` only forces `min-h-[120px]` at 3+ rows. `pnpm verify` green (1826 tests). Next: wait for the user to name the next phase.

**Fill leftover table height (2026-08-19).** Page scroll in `main` is allowed. `PageFill` is `min-h-full` only (not `flex-1`, not `overflow-hidden`) so a short list can grow into leftover space. `DataTable` is `flex-1 min-h-64`. `TimelinePanel` is the same rule for activity/history: `fill` on dedicated pages, `max-h-80` when stacked (People access history, dashboard, overview, approval trails). Workspace/budget slots are `flex-1` without `min-h-0`.

**Visual language and layout (2026-08-19).** Neutral cool-grey canvas. Cards, alerts, and outline buttons are opaque paper (`bg-card` + border) — no overlay on copy. Header is a solid frosted strip. OrgSwitcher dropdown uses popper to the right of the rail. DataTable sits in a bordered `bg-card` panel. List filters use `FilterSelect`. `/dev/direction` consumes product tokens (no `--p-*` theme).

**Charcoal sidenav + laser (2026-08-19).** Desktop aside is a charcoal dock (`--sidebar`). Active item uses `.sidenav-current` (1px left-edge laser, hot mid, fade to the caps). Menu Sheet uses the same dock. Header is a frosted strip (`AppHeader` + breadcrumbs), not a fading laser tick.

**Desktop icon rail (2026-08-18).** Desktop aside is a `w-16` icon column (`hidden md:flex` unchanged). Hover, keyboard focus, or an open org menu expands a `w-56` overlay over the page — labels clip, `main` does not reflow. Menu `Sheet` below `md` still shows full labels. Pattern 1 in `docs/RESPONSIVENESS.md`. `pnpm verify` green (1797 tests). Next: wait for the user to name the next phase.

**Lucide icons (2026-08-18).** `lucide-react` is the only icon pack. SideNav / Settings / workspace / budget chrome share `navIcons.ts` (href and tab maps — `DEFAULT_NAV` / `SETTINGS_NAV` stay href+label). Alert injects a variant icon; EmptyState defaults to Inbox; ErrorState Retry uses RefreshCw. Decorative icons are `aria-hidden`. `pnpm verify` green (1785 tests). Next: wait for the user to name the next phase.

**AppShell viewport lock (2026-08-18).** Chrome stays put: root `h-dvh overflow-hidden`; header `shrink-0`; page may scroll in `main` (`min-h-0 overflow-y-auto`). Brand + OrgSwitcher stay pinned; SideNav list (aside + Menu Sheet) scrolls only when items overflow, only as far as the last link. Aside still `hidden md:flex`. No `sticky` chrome, no `ScrollArea`, no new breakpoint. Pattern 1 in `docs/RESPONSIVENESS.md`.

**Theme toggle (2026-08-18).** `Switch` stays binary. Three-step Light / System / Dark `ThemeToggle` (next-themes) lives in the AppShell header as icon-only on every width (`aria-label` for Light / System / Dark). `/dev/ui` re-exports the same control. `pnpm verify` green (1777 tests). Next: wait for the user to name the next phase.

**A9 exit (2026-08-18).** Phase exit + `A9-reports-closure.md` review checklist signed off. Archived mutations gated on requests, cards, receipts, and approvals as well as budget/people/controls. `pnpm verify` green (1775 tests). Track A complete. Wait for the user to name the next phase — do not invent one.

**A9 QA patches done (2026-08-18).** Runtime findings: no “No report yet” under live figures; archived mutations hidden; budget tab uses final snapshot when archived/closed with no ledger; duplicate archived Alert removed; ARCHIVE prompt once; blocker Links underlined + formatMoney; org CLOSED/ARCHIVED Final report Links; disabled Start muted. `pnpm verify` green (1775 tests). Next: **A9 phase exit** — do not start a next phase.

**A9.9 done (2026-08-17).** Don’t-break proofs: unclamped remaining; no client ledger; Reports then Audit then Roles; workspace tabs still six with `/activity`; SETTINGS_NAV four hrefs; AccessReviewList still A3. Aside still `hidden md:flex`. `pnpm verify` green (1774 tests). Next: **A9 phase exit** — do not start a next phase.

**A9.8 done (2026-08-17).** Close / Resume / Final report Links; archived Alert; Status tile hrefs; card View in audit. `pnpm verify` green (1767 tests). Next: **A9.9** don’t-break proofs.

**A9.7 done (2026-08-17).** `/projects/[id]/report/final` snapshot figures, no fixed width; CLOSE then ARCHIVE already in A9.6. `pnpm verify` green (1767 tests). Next: **A9.8** chrome Links + archived Alert.

**A9.6 done (2026-08-17).** `/projects/[id]/closure` StepWizard; blockers link; resume; SETTLE poll; CLOSE then ARCHIVE confirms. ACTIVE does not call `useClosureStatus` with a real id. `pnpm verify` green (1767 tests). Next: **A9.7** final report.

**A9.5 done (2026-08-17).** `/audit` URL filters, actorType chips, Diff Sheet, cursor Load more. No `useProjectAudit`. `pnpm verify` green (1767 tests). Next: **A9.6** closure wizard.

**A9.4 done (2026-08-17).** `/reports/organization` totals + mixed-currency Alert via approved-sum; no per-row currency. `pnpm verify` green (1767 tests). Next: **A9.5** audit log.

**A9.3 done (2026-08-17).** `/reports/project/[id]` BudgetBar + unclamped remaining + category/member tables. No `useBudget`. `pnpm verify` green (1767 tests). Next: **A9.4** organization rollup.

**A9.2 done (2026-08-17).** `/reports` catalogue wrap-Links + four F1 CSV exports; pending Alert does not unmount the page. `pnpm verify` green (1767 tests). Next: **A9.3** project budget versus actual.

**A9.1 done (2026-08-17).** SideNav Audit after Reports, then Roles. Placeholders `/reports`, `/reports/organization`, `/reports/project/[id]`, `/audit`, `/projects/[id]/closure`, `/projects/[id]/report/final`. Aside still `hidden md:flex`. `pnpm verify` green (1767 tests). Next: **A9.2** report catalogue + exports.

**A9.0 done (2026-08-17).** Helpers in `src/client/lib/reports.ts`. No new contracts; remaining unclamped; MEMBER org report/audit/export do not require `projectId`; complete needs both confirm literals; audit cursor stays out of the URL. Barrel named-exports (clash with A6/A7/A8 `parseOptionalIdParam`). `pnpm verify` green (1767 tests). STOP — review helpers before **A9.1** SideNav / route shells.

**A9-TASKS locked (2026-08-17).** Policies approved: no new contracts; no rebuild of `/settings/access-reviews`; no `/projects/[id]/audit` product URL / `useProjectAudit`; workspace tabs stay six; AppShell collapse stays A2.1 (A9.1 inserts `/audit` after Reports; also placeholders for closure + final report so later Links do not 404); no `useClosureStatus` on ACTIVE; type-to-confirm `CLOSE` then `ARCHIVE`; mixed-currency Alert via approved-sum (no per-row `currency`); exports via F1 hooks only. Next: **A9.1** chrome after helper review. Do not start screens before A9.0 STOP.

**A8 exit (2026-08-17).** Phase exit + `A8-activity.md` review checklist signed off. Auth vs clearing Alerts, vertical lifecycle, actorType chips, decline reason + Why this limit?, B9 activity cursor, MoneyDisplay + billed-as, 375/768 wrap/overflow. Webhook POST tests now sign with `AIRWALLEX_WEBHOOK_SECRET` from the env (route HMAC). `pnpm verify` green (1753 tests). Next: generate `A9-TASKS.md`; first A9 work is reports / closure. Do not start A9 screens before the task file is locked.

**A8 QA runtime (2026-08-17).** Should-fixes: named attach file input `8428e2a`; card Type humanised `f0e9f5c`; activity audit summaries hide pan_token `0f1c1a6`; seed FX + lifecycle mismatch rows `7744da3`. Seed Member viewer stays OWN — list 403 without a user subject is correct; use Approver/Procurement for PROJECT-scoped MEMBER. Re-run seed to load new txs. Next: **A8 phase exit** — do not start A9. `pnpm verify` green (1753 tests).

**A8.8 done (2026-08-17).** Don’t-break proofs: unclamped amounts; no client ledger; Activity then Transactions then Receipts then Automation; workspace tabs still six with `/activity`; SETTINGS_NAV four hrefs. Aside still `hidden md:flex`. `pnpm verify` green (1750 tests). Next: **A8 phase exit** — do not start A9.

**A8.7 done (2026-08-17).** `/receipts` CLEARED display-filter + Attach Sheet; detail attach/delete. `pnpm verify` green (1742 tests). Next: **A8.8** don’t-break proofs.

**A8.6 done (2026-08-17).** Card detail merchant Links, billed-as, decline reason, View in transactions. `pnpm verify` green (1742 tests). Next: **A8.7** missing-receipt queue + attach.

**A8.5 done (2026-08-17).** `/transactions/declined` reasons + Why this limit?; MEMBER `?projectId=`; no status in hook filter. `pnpm verify` green (1742 tests). Next: **A8.6** card detail transaction links.

**A8.4 done (2026-08-17).** `/transactions/[id]` lifecycle stack; auth vs clearing Alerts; billed-as; decline reason + Why this limit?. `pnpm verify` green (1742 tests). Next: **A8.5** declined queue.

**A8.3 done (2026-08-17).** `/transactions` DataTable; MEMBER needs `?projectId=`; OWNER/ADMIN org-wide. Toolbar wrap + Declines/Receipts. `pnpm verify` green (1742 tests). Next: **A8.4** transaction detail lifecycle.

**A8.2 done (2026-08-17).** Org `/activity` + project tab Timeline; cursor Load more; activity queryKeys include `filter ?? {}`. No type filter. `pnpm verify` green (1742 tests). Next: **A8.3** `/transactions` DataTable.

**A8.1 done (2026-08-17).** SideNav Transactions after Activity, then Receipts, then Automation. Placeholders `/transactions`, `/transactions/declined`, `/transactions/[id]`, `/receipts`. Aside still `hidden md:flex`. `pnpm verify` green (1741 tests). Next: **A8.2** org + project activity feeds.

**A8.0 done (2026-08-17).** Helpers in `src/client/lib/transactions.ts`. No `GET /api/receipts`; MEMBER lists require `?projectId=`; remaining/amounts unclamped; barrel named-exports (clash with A6/A7 `parseOptionalIdParam`). `pnpm verify` green (1741 tests). STOP — review helpers before **A8.1** SideNav / route shells.

**A8-TASKS locked (2026-08-17).** Policies approved: no new contracts; no `GET /api/receipts` (CLEARED list + `needsReceipt` at 5000); MEMBER org tx lists require `?projectId=` (OWNER/ADMIN org-wide); activity is B9 cursor, transactions stay F1 page-based infinite; declines show `failureReason` + `Why this limit?` (no invented `ruleId`); no activity filter bar; A8.2 may patch `useReports` activity queryKey only; AppShell collapse stays A2.1 (A8.1 inserts `/transactions` + `/receipts` after Activity). Next: **A8.1** chrome. Do not start screens before A8.0 STOP.

**A7 exit (2026-08-17).** Phase exit + `A7-approvals.md` review checklist signed off. Preview, NOT_PERMITTED named remaining, reject reason, self-approval, 375/768 overflow, and shell collapse verified live. Unlocked copy is coded (`holdQueueRow` + snapshot) — live APPROVE was not run as Seed Owner (queue empty / own pending row). `pnpm verify` green (1719 tests). Next phase is A8 (activity / money in motion UI).

**A7.9 done (2026-08-17).** Don’t-break proofs: no client policy engine; remaining unclamped; Requests immediately before Approvals; workspace tabs still six; SETTINGS_NAV four hrefs. `pnpm verify` green (1710 tests). Next: **A7 phase exit** — do not start A8.

**A7.8 done (2026-08-17).** Wizard approval-rules step Links to project controls. Members deferred step still has no extra Link. `pnpm verify` green (1704 tests). Next: **A7.9** don’t-break proofs.

**A7.7 done (2026-08-17).** Approval rules section on `/projects/[id]/controls`; PUT body has int threshold and no `id`. `pnpm verify` green (1704 tests). Next: **A7.8** wizard approval-rules Link.

**A7.6 done (2026-08-17).** `/approvals/[id]` context + trail + decide; self-approval Alert; snapshot unlocked on APPROVE. `pnpm verify` green (1704 tests). Next: **A7.7** approval rules on project controls.

**A7.5 done (2026-08-17).** `/approvals` stacked cards; decide in place; remaining unclamped; recent spend from APPROVED requests; dashboard Links to `approvalHref`. `pnpm verify` green (1704 tests). Next: **A7.6** approval detail.

**A7.4 done (2026-08-17).** `/requests/[id]` policy, trail, reject reason, unlocked; DRAFT edit; no decide on requester surface. `pnpm verify` green (1704 tests). Next: **A7.5** approver queue.

**A7.3 done (2026-08-17).** `/requests/new` preview above submit; create always DRAFT; submit runs policy; `parseMoneyInput` text amount; no client `evaluatePolicy`. `pnpm verify` green (1704 tests). Next: **A7.4** request detail.

**A7.2 done (2026-08-17).** `/requests` DataTable; project Select required (`?projectId=`); no org-wide list; gated New request. `pnpm verify` green (1704 tests). Next: **A7.3** create form + live policy preview.

**A7.1 done (2026-08-17).** SideNav Requests after Cards, before Approvals. Placeholders `/requests`, `/requests/new`, `/requests/[id]`, `/approvals`, `/approvals/[id]`. Aside still `hidden md:flex`. `pnpm verify` green (1704 tests). Next: **A7.2** member request list.

**A7.0 done (2026-08-17).** Helpers in `src/client/lib/requests.ts`. No `GET /api/requests`; no client `evaluatePolicy`; remaining unclamped; `cardHref` re-exported. Barrel named-exports (clash with A6 `parseOptionalIdParam`). `pnpm verify` green (1704 tests). STOP — review helpers before **A7.1** SideNav / route shells.

**A7-TASKS locked (2026-08-17).** Policies approved: no new contracts; no org-wide request list (`?projectId=` then `useRequests`); preview “from whom” is `requiredApprovals` only; queue is stacked cards with decide in place; create always DRAFT; `cardId` usually null (unlocked = link or A4 card snapshot); recent spend = other APPROVED requests by same `requestedBy`; approval rules section on existing `/projects/[id]/controls`; AppShell collapse stays A2.1 (A7.1 inserts `/requests` before Approvals only). Next: **A7.1** chrome. Do not start screens before A7.0 STOP.

**A6 exit (2026-08-17).** Phase exit + `A6-controls-automation.md` review checklist signed off. Automation parse, explainer merge, and 375 overflow patched. `pnpm verify` green (1688 tests). Next: generate `A7-TASKS.md`; first A7 work is requests / the approver queue. Do not start A7 screens before the task file is locked.

**A6 runtime QA patched (2026-08-17).** Automation list normalizes missing `desiredState.cards`; explainer heading uses merged controls (not stale applied); DiffView stacks at 375px; contribution limits flatten to `MoneyDisplay`; last run skips unmatched empty SKIPPED seed rows; outline Back/Run hug their labels. `pnpm verify` green (1688 tests). Next: **A6 phase exit** — do not start A7.

**A6.11 done (2026-08-17).** Don’t-break proofs: no client parser/ingest/`type="number"`/PAN; templates and money helpers locked; workspace tabs still six with `/controls`; shell `hidden md:flex`. `pnpm verify` green (1682 tests). Next: **A6 phase exit** — do not start A7.

**A6.10 done (2026-08-17).** Wizard Controls deferred step Links to project controls. Members/Roles/Approval unchanged. `pnpm verify` green (1672 tests). Next: **A6.11** don’t-break proofs.

**A6.9 done (2026-08-17).** Card explainer: governing rules, attributes, stacked merge, `MoneyDisplay` limits; detail `Why this limit?` Link. `pnpm verify` green (1672 tests). Next: **A6.10** wizard controls Link.

**A6.8 done (2026-08-17).** Attribute registry: built-ins, custom CRUD, MANUAL values Sheet. `pnpm verify` green (1672 tests). Next: **A6.9** card explainer.

**A6.7 done (2026-08-17).** `/automation` infinite DataTable; FAILED/PARTIAL prominent in status column and Sheet. `pnpm verify` green (1672 tests). Next: **A6.8** attribute registry.

**A6.6 done (2026-08-17).** Simulate page with hypothetical Alert, Run on click, Current/Simulated panes, DRY_RUN badge. `pnpm verify` green (1672 tests). Next: **A6.7** automation history.

**A6.5 done (2026-08-17).** Debounced `useValidateRule` + `useSimulateRules`; match preview keeps last success; attribute insert. `pnpm verify` green (1672 tests). Next: **A6.6** what-if simulation.

**A6.4 done (2026-08-17).** Rule builder form + `RuleSentence` preview; Save create/PATCH omits `enabled`; Simulate hidden until saved. `pnpm verify` green (1672 tests). Next: **A6.5** live match preview.

**A6.3 done (2026-08-17).** Org rules DataTable with project/enabled URL filters, gated New, template empty. `pnpm verify` green (1672 tests). Next: **A6.4** rule builder.

**A6.2 done (2026-08-17).** Project controls DataTable with URL enabled filter, gated New, template empty, `?ruleId=` Alert, org-wide section. `ComingSoonTab` gone. `pnpm verify` green (1672 tests). Next: **A6.3** org-wide rules list.

**A6.1 done (2026-08-17).** SideNav Automation after Activity; Rules/Attributes after Access reviews. Placeholders `/automation`, `/settings/rules`, `/settings/rules/[id]`, `/settings/rules/[id]/simulate`, `/settings/attributes`, `/cards/[id]/explain`. Aside still `hidden md:flex`. `pnpm verify` green (1672 tests). Next: **A6.2** project controls list.

**A6.0 done (2026-08-17).** Helpers in `src/client/lib/rules.ts`. No GET-by-id; templates are B6-legal DSL; remaining unclamped; no client parser. `pnpm verify` green (1672 tests). STOP — review helpers before **A6.1** SideNav / route shells.

**A6-TASKS locked (2026-08-17).** Policies approved: no new contracts; no `GET /api/rules/:id` (load from list pageSize 100); create is `/settings/rules/new`; no client formula/DSL parser (`useValidateRule` + `useSimulateRules` only; never `useValidateFormula`); condition UI leaf-only; templates copy B6 examples tests not RULES-ENGINE.md JSON; simulation hypothetical Alert; match preview / RuleSentence / merge never hidden; AppShell collapse stays A2.1 (A6.1 inserts `/automation` + settings Rules/Attributes only). Next: **A6.0** helpers, then A6.1 chrome. Do not start screens before A6.0 STOP.

**A5 exit (2026-08-16).** Phase exit + `A5-cards.md` review checklist signed off. Reveal hang, holder names, and filter labels patched. `pnpm verify` green (1654 tests). Next: generate `A6-TASKS.md`; first A6 work is project controls / the rule builder. Do not start A6 screens before the task file is locked.

**A5 runtime QA patched (2026-08-16).** Reveal no longer hangs on expired pantoken (ErrorState + Retry); fixture `expires_at` 2099; org list Holder uses org member names; filter labels visible. `pnpm verify` green (1654 tests). Next: **A5 phase exit** — do not start A6.

**A5.10 done (2026-08-16).** Live limits unclamped, PCI scan, CLOSE phrase, shell unchanged, Cards after Projects. `pnpm verify` green (1652 tests). Next: **A5 phase exit** — do not start A6.

**A5.9 done (2026-08-16).** Wizard card-structure Link to project cards tab. `pnpm verify` green (1642 tests). Next: **A5.10** proofs.

**A5.8 done (2026-08-16).** Card transactions infinite table; single-use used uses row count. `pnpm verify` green (1642 tests). Next: **A5.9** wizard link.

**A5.7 done (2026-08-16).** PATCH nickName / accessList only; access Sheet of project members. `pnpm verify` green (1642 tests). Next: **A5.8** transactions.

**A5.6 done (2026-08-16).** Reveal iframe + audited Alert; pantoken on mount with generation counter; no token in URL/DOM. `pnpm verify` green (1642 tests). Next: **A5.7** nickname / access list.

**A5.5 done (2026-08-16).** Freeze/Unfreeze/Close confirms; close is type-to-confirm `CLOSE` with `{ confirm: true }`. Reconcile on divergence. `pnpm verify` green (1642 tests). Next: **A5.6** reveal iframe.

**A5.4 done (2026-08-16).** Card detail read: live limits, alerts, DiffView when desired vs applied diverge. Mutations stubbed. `pnpm verify` green (1642 tests). Next: **A5.5** lifecycle confirms.

**A5.3 done (2026-08-16).** Project cards `CardVisual` grid; Open/Reveal under each tile. `ComingSoonTab` gone. `pnpm verify` green (1642 tests). Next: **A5.4** card detail (read).

**A5.2 done (2026-08-16).** `/cards` DataTable with URL filters; holder column only. `pnpm verify` green (1642 tests). Next: **A5.3** project cards grid.

**A5.1 done (2026-08-16).** SideNav Cards after Projects. Placeholders `/cards`, `/cards/[id]`, `/cards/[id]/reveal`. Aside still `hidden md:flex`. `pnpm verify` green (1642 tests). Next: **A5.2** org card list.

**A5.0 done (2026-08-16).** Helpers in `src/client/lib/cards.ts`. Iframe origin `https://airwallex.com`; no holder query param; remaining not clamped; `projectCardsHref` wraps `cardsTabHref`. `pnpm verify` green (1642 tests). STOP — review helpers before **A5.1** SideNav / route shells.

**A5-TASKS locked (2026-08-16).** Policies approved: no new contracts; no create-card form / no typing `transactionLimits`; holder is a column not a query param; org list is DataTable, project cards are `CardVisual` `md:grid-cols-2`; remaining from `useCardLimits` unclamped; PATCH nickName/accessList only; retry = reconcile; iframe src from integration §8; close phrase `CLOSE`; AppShell collapse stays A2.1 (A5.1 inserts `/cards` in `DEFAULT_NAV` only). Next: **A5.0** helpers, then A5.1 chrome. Do not start screens before A5.0 STOP.

**A4 exit (2026-08-16).** Phase exit + `A4-budget.md` review checklist signed off. Formula validate uses stable `mutate`; BudgetBar term tooltips open on click. `pnpm verify` green (1625 tests). Next: generate `A5-TASKS.md`; first A5 work is project cards. Do not start A5 screens before the task file is locked.

**A4.9 done (2026-08-16).** Remaining unclamped, formula context `{ approvedAmount }`, PAN scan, shell unchanged, `BudgetBar` `md:grid-cols-4`. `pnpm verify` green (1625 tests). Next: **A4 phase exit** — do not start A5.

**A4.8 done (2026-08-16).** Wizard budget step Link to categories. `pnpm verify` green (1618 tests). Next: **A4.9** don’t-break proofs.

**A4.7 done (2026-08-16).** Change requests create + decide; DiffView on APPROVE. `pnpm verify` green (1618 tests). Next: **A4.8** wizard categories Link.

**A4.6 done (2026-08-16).** Budget history Timeline with action, actorType, and reason. `pnpm verify` green (1618 tests). Next: **A4.7** change requests.

**A4.5 done (2026-08-16).** Categories list + Sheet; formula Save gated; CardLimitMoves after CUD. `pnpm verify` green (1618 tests). Next: **A4.6** history.

**A4.4 done (2026-08-16).** FormulaEditor live `useValidateFormula` with `{ approvedAmount }` context, debounce, generation counter. `pnpm verify` green (1618 tests). Next: **A4.5** categories list + Sheet.

**A4.3 done (2026-08-16).** PUT approved + manual ADJUSTMENT; card-limit DiffView from `desiredControls.transactionLimits`. `pnpm verify` green (1618 tests). Next: **A4.4** FormulaEditor.

**A4.2 done (2026-08-16).** Budget home four figures, empty/403/over-committed/pending-CR, recent entries. Mutations stubbed. `pnpm verify` green (1618 tests). Next: **A4.3** set approved / adjust / card-limit DiffView.

**A4.1 done (2026-08-16).** Budget chrome wrap-Links; nested placeholders; `BudgetBar` `md:grid-cols-4` + four term tooltips. `pnpm verify` green (1618 tests). Next: **A4.2** budget home (read).

**A4.0 done (2026-08-16).** Helpers in `src/client/lib/budget.ts`. Formula context `{ approvedAmount }` only; remaining not clamped; card-limit diffs from `desiredControls.transactionLimits`. `pnpm verify` green (1618 tests). STOP — review helpers before **A4.1** chrome / BudgetBar.

**A4-TASKS locked (2026-08-16).** Policies approved: no new contracts; limits-moved is a client diff of `desiredControls.transactionLimits` (not `useCardLimits`); formula context `{ approvedAmount }` only; wizard stays A2 PUT + A4.8 Link; header `formula`/`thresholdPcts` off PUT; BudgetBar `sm:` → `md:grid-cols-4` is the only F3 edit; AppShell collapse stays A2.1. Next: **A4.0** helpers, then A4.1 chrome. Do not start screens before A4.0 STOP.

**A3 exit (2026-08-15).** Phase exit + `A3-people-access.md` review checklist signed off. Add-member Cancel is a `buttonVariants` Link (no `Button asChild` Slot). `pnpm verify` green (1597 tests). Next: generate `A4-TASKS.md`; first A4 work is project budget. Do not start A4 screens before the task file is locked.

**A3.9 done (2026-08-15).** Preview vs 403, SETTINGS_NAV, no Settings workspace tab, PAN scan, shell collapse unchanged. `pnpm verify` green (1594 tests). Next: **A3 phase exit** — do not start A4.

**A3.8 done (2026-08-15).** `/settings/access-reviews` DataTable with URL filters; CONFIRM/REVOKE only. `pnpm verify` green (1589 tests). Next: **A3.9** proofs.

**A3.7 done (2026-08-15).** Role permission matrix; template Save sends `force: true` when holders > 0. `pnpm verify` green (1589 tests). Next: **A3.8** access reviews.

**A3.6 done (2026-08-15).** Settings chrome + SideNav Roles/Access reviews; roles list + create Dialog. Aside still `hidden md:flex`. `pnpm verify` green (1589 tests). Next: **A3.7** permission matrix.

**A3.5 done (2026-08-15).** People Edit Sheet + Remove; last access manager gated UX-only. `pnpm verify` green (1589 tests). Next: **A3.6** settings chrome + SideNav.

**A3.4 done (2026-08-15).** Add member + live `reasons[]` preview; generation counter drops stale responses. `pnpm verify` green (1589 tests). Next: **A3.5** edit / remove.

**A3.3 done (2026-08-15).** `ScopePicker` progressive disclosure; optional date window. `pnpm verify` green (1589 tests). Next: **A3.4** add member + live preview.

**A3.2 done (2026-08-15).** `/projects/[id]/people` DataTable + access history; Add gated; no fake edit form. `pnpm verify` green (1589 tests). Next: **A3.3** scope picker.

**A3.1 done (2026-08-15).** `/projects/[id]` overview tiles all link; counts from F1 hooks not stubbed `overview.*`. `pnpm verify` green (1589 tests). Next: **A3.2** people list.

**A3.0 done (2026-08-15).** Access helpers in `src/client/lib/access.ts`; `isScopeActive` re-exported from shared. `pnpm verify` green (1589 tests). STOP — review helpers before **A3.1** overview screens.

**A3-TASKS locked (2026-08-15).** Policies approved: no new contracts; AppShell collapse stays A2.1 (append SideNav only); A3 ships `/settings/access-reviews` (A9 must not rebuild); `assignedCount` is client-side (first 100 projects); last admin is UX-only on the sole `member.manage` holder; preview matches 403 on allow/deny not copy; overview tiles use F1 hooks not stubbed `overview.*` counts; access-review resolutions are `CONFIRM`/`REVOKE` only; `reasons[]` rendered verbatim plus a separate `scopeSummary`. Next: **A3.0** helpers, then A3.1 overview. Do not start screens before A3.0 STOP.

**A2 exit (2026-08-15).** Phase exit + `A2-dashboard-projects.md` review checklist signed off. Slot crash (`Button asChild`), ThemeToggle hydration, and Timeline wrap in narrow cards fixed. `pnpm verify` green (1566 tests). Next: generate `A3-TASKS.md`; first A3 work is overview / people / access.

**A2.9 done (2026-08-15).** Lifecycle graph proofs; six workspace tabs and no Settings; no PAN/cvv/card_number on A2 screens; layout still `requireApp` + `AppShellFrame`. `pnpm verify` green (1565 tests). Next: **A2 phase exit** — do not start A3.

**A2.8 done (2026-08-15).** `/projects/[id]` tab shell; header from list cache; six placeholders, no Settings. `pnpm verify` green (1561 tests). Next: **A2.9** lifecycle + don’t-break proofs.

**A2.7 done (2026-08-15).** `StepWizard` `nextLabel`; Launch two-hops then Timeline / Open project; 403 info copy. `pnpm verify` green (1561 tests). Next: **A2.8** workspace tab shell.

**A2.6 done (2026-08-15).** Deferred Alerts, card-structure switches, review (kinds + budget, no invented limits). Launch still stub. `pnpm verify` green (1561 tests). Next: **A2.7** Launch + `nextLabel`.

**A2.5 done (2026-08-15).** Wizard budget step PUTs `approvedAmount` + org currency via `parseMoneyInput` (no `type="number"`). `pnpm verify` green (1561 tests). Next: **A2.6** card structure, deferred steps, review.

**A2.4 done (2026-08-15).** `/projects/new` details step creates/PATCHes DRAFT, resumes via `draftId`, dirty Cancel ConfirmDialog. Later steps stubbed. `pnpm verify` green (1561 tests). Next: **A2.5** budget step.

**A2.3 done (2026-08-15).** `/projects` DataTable with URL filters (no client refilter), `overflow-x-auto`, gated Create, §8 row actions. `pnpm verify` green (1561 tests). Next: **A2.4** wizard details.

**A2.2 done (2026-08-15).** `/dashboard` four linked cards (ACTIVE, approvals, activity, DRAFT/PENDING alerts). Gated Create on empty ACTIVE. Placeholders `/approvals` and `/activity`. `pnpm verify` green (1561 tests). Next: **A2.3** project list + DataTable overflow.

**A2.1 done (2026-08-15).** Aside `hidden md:flex`; Menu opens F3 `Sheet` with the same `OrgSwitcher`/`SideNav`. `AppShellFrame` uses live `useMe` / `useApprovalCount`. `/dev/shell` still mock. `pnpm verify` green (1561 tests). Next: **A2.2** Dashboard.

**A2.0 done (2026-08-15).** `canTransition` / `permissionForTransition` in `src/shared/projectLifecycle.ts`; screen helpers in `src/client/lib/projects.ts`. Server re-exports; `pnpm verify` green (1561 tests). Next: **A2.1** AppShell collapse (`hidden md:flex` aside + `Sheet`).

**A2-TASKS locked (2026-08-15).** Policies approved: Launch is two hops (`DRAFT → PENDING_APPROVAL` then `→ ACTIVE`), no new graph edge; `canTransition` / `permissionForTransition` relocate to `src/shared/projectLifecycle.ts`; create-gate uses org role + `PermissionGateView`; A2 wizard owns details/budget-minimum/card-structure-booleans/review/launch; deferred steps are explicit “lands in A{n}” alerts; review shows card kinds + budget, not invented limits; no Settings tab; A2.7 may add `nextLabel` on `StepWizard`. Next: **A2.0** helpers, then A2.1 AppShell collapse.

**A1 exit (2026-08-15).** Phase exit + `A1-auth-onboarding.md` review checklist signed off. `pnpm verify` green (1532 tests). Next: generate `A2-TASKS.md`; first A2 task is AppShell collapse (`hidden md:flex` aside + `Sheet`).

**A1.7 done (2026-08-15).** Guard proofs + password-free copy; `(app)` still uses `requireApp()`.

**A1.6 done (2026-08-15).** Create-org form with geo comboboxes; `update()` before dashboard.

**A1.5 done (2026-08-15).** `/onboarding` lists pending invites without accept; create is secondary. Client redirect if already onboarded.

**A1.4 done (2026-08-15).** `/invite/[token]` preview + accept; demo log path `/invite/${token}`.

**A1.3 done (2026-08-15).** `/sign-in` preserves safe `returnTo` through credentials and Google; invite still wins.

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
