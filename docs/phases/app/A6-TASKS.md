# A6 — Controls & Automation · Tasks

**Spec:** [A6-controls-automation.md](./A6-controls-automation.md)
**Model:** cheap / LOW — name every file, inline every field with type and constraints, copy the cited A5/A4/A3/A2/F1/B6 file; do not invent endpoints, change B6–B9 contracts, add primitives, reopen AppShell collapse, parse formulas/DSL on the client, or hide a control without a Sheet/menu replacement.
**Depends on:** A5, complete and verified

No new API contracts. B6 already shipped `ruleContracts`, `ruleRunContracts`, `cardExplainContracts`, `attributeContracts`. The review gate is the policies + helper shapes below.

**Powers:** B6 · **Hooks (F1, already exist):** `useRules`, `useCreateRule`, `useUpdateRule`, `useDeleteRule`, `useEnableRule`, `useValidateRule`, `useSimulateRules`, `useRuleRuns`, `useRuleRun`, `useCardExplain`, `useAttributes`, `useCreateAttribute`, `useUpdateAttribute`, `useAttributeValues`, `useSetAttributeValue`, `useProjects`, `useProject`, `useProjectCards`, `useProjectMembers`, `useMe`, `usePermissions`, `useCan` · **Do not call:** `useSimulatePurchase` (remote-auth demo, not this spec), `attributeContracts.ingest` (no browser hook — F1.0) · **Guards (F0, already exist):** `requireApp` on `(app)/layout.tsx`

Recipe: [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Visual tokens: [`../../VISUAL-DIRECTION.md`](../../VISUAL-DIRECTION.md). Engine semantics: [`../../RULES-ENGINE.md`](../../RULES-ENGINE.md) (read, do not reimplement).

**AppShell collapse is already done (A2.1).** Aside is `hidden w-56 shrink-0 flex-col md:flex`; Menu opens the same `SideNav` / `OrgSwitcher` in F3 `Sheet`. Do **not** reopen collapse. Do **not** build `MobileNav.tsx`. Do **not** add `sm:` / `lg:` / `xl:` / `2xl:` on A6 screens. A6.1 may **insert** SideNav hrefs and **append** `SETTINGS_NAV` only.

There is **no** A6 AppShell-collapse task. A2.1 owns it. Every screen task still checks 375px / 768px don’t-break, including that the existing Menu `Sheet` still works below `md`.

---

## A6.0 locked policies (do not reopen)

Approved 2026-08-17. Implementers follow these; do not re-litigate. A6.0 still implements the helpers below and STOPs before A6.1 screens.

### 1. No new contracts, no new primitives, no AppShell collapse, no client parser

- Do **not** add or rename fields in `src/shared/schemas/*` or `src/shared/contracts/*`.
- Do **not** add `GET /api/rules/:id`. There is no get-by-id contract (`ruleContracts` is list/create/update/delete/enable/validate/simulate). Load one rule from `useRules({ page: 1, pageSize: 100 })` via `findRuleById`. If it is not on that page → `ErrorState` `This rule is not available.` Do not loop pages.
- Do **not** add a shadcn/pattern file. A6 screens compose F3 files listed in each task’s **Pattern**. `RuleSentence`, `FormulaHighlight`, `AttributeValue`, `DiffView`, `StatusBadge kind="ruleRun"`, `DataTable` already exist.
- Do **not** import `@/server/*` from any `'use client'` file. That includes `src/server/events/types.ts` (`DomainEventType`) and `src/server/services/attributes/registry.ts` (`BUILTIN_ATTRIBUTE_DEFINITIONS`, `campaign-analytics`). Copy the **string literals** into `src/client/lib/rules.ts`.
- Do **not** call `call()` or `fetch` from a screen. Use F1 hooks.
- Do **not** edit `src/client/shell/AppShell.tsx` except the `DEFAULT_NAV` array in A6.1.
- Do **not** edit `src/client/hooks/invalidationMap.ts`. `useValidateRule` / `useSimulateRules` already invalidate `[]`.
- Do **not** add `/projects/[id]/settings` or a seventh workspace tab. `WORKSPACE_TAB_HREFS` stays six. Controls is already the fifth tab.
- Do **not** evaluate, `eval`, or parse formulas in the client. Tokenize for display with `highlightFormula` from `src/lib/rules/formulaHighlight.ts` (F2 — display only). Validate the **whole draft** with `useValidateRule` (`POST /api/rules/validate`). Simulate with `useSimulateRules`. Do **not** call `useValidateFormula` (B4 budget dialect — integers, no attribute identifiers).
- Do **not** import `@/server/lib/formula`. Do not build a second DSL parser. `createRuleInput.safeParse` on a JSON textarea is **out of scope** (no power-user JSON editor in A6 — the form + `RuleSentence` is the product).
- Do **not** call `useSimulatePurchase`. Do not POST `/api/attributes/ingest` from the browser.
- Do **not** add `@testing-library/react`.

### 2. Routes (A6 spec wins)

| URL                             | Files                                                                   | Guard                 | Shell                       |
| ------------------------------- | ----------------------------------------------------------------------- | --------------------- | --------------------------- |
| `/projects/[id]/controls`       | `src/app/(app)/projects/[id]/controls/page.tsx` + `ProjectControls.tsx` | `requireApp` (layout) | `AppShell` + workspace tabs |
| `/settings/rules`               | `src/app/(app)/settings/rules/page.tsx` + `OrgRuleList.tsx`             | same                  | `AppShell` + settings tabs  |
| `/settings/rules/new`           | same builder as `[id]` with sentinel `NEW_RULE_ID`                      | same                  | same                        |
| `/settings/rules/[id]`          | `src/app/(app)/settings/rules/[id]/page.tsx` + `RuleBuilder.tsx`        | same                  | same                        |
| `/settings/rules/[id]/simulate` | `…/settings/rules/[id]/simulate/page.tsx` + `SimulateRule.tsx`          | same                  | same                        |
| `/settings/attributes`          | `src/app/(app)/settings/attributes/page.tsx` + `AttributeRegistry.tsx`  | same                  | same                        |
| `/automation`                   | `src/app/(app)/automation/page.tsx` + `AutomationHistory.tsx`           | same                  | `AppShell`                  |
| `/cards/[id]/explain`           | `src/app/(app)/cards/[id]/explain/page.tsx` + `CardExplain.tsx`         | same                  | `AppShell`                  |

`/settings/rules/new` is the create route. Next.js `[id]` also matches `new`. Treat `id === NEW_RULE_ID` (`'new'`) as an unsaved draft — **no** POST until Save.

No `/projects/[id]/controls/[ruleId]`. Project rows and A5 `ruleHref` land on the project list (`?ruleId=`); **Edit in builder** goes to `/settings/rules/${ruleId}`.

A5.0 already shipped `controlsHref` / `ruleHref` in `src/client/lib/cards.ts`. **Do not change them.** `ruleHref(projectId, ruleId)` stays `/projects/${projectId}/controls?ruleId=${encodeURIComponent(ruleId)}`.

Wizard `/projects/new` controls step is still `DeferredStep`. A6.10 adds a Link; do not add a second wizard or a rule-builder step.

A6.1 inserts SideNav `{ href: '/automation', label: 'Automation' }` **after Activity**, before Reports; appends `{ href: '/settings/rules', label: 'Rules' }` and `{ href: '/settings/attributes', label: 'Attributes' }` **after Access reviews**. Same three entries go into `SETTINGS_NAV` (Rules + Attributes only — Automation is not a settings tab).

### 3. Layout — one breakpoint `md`, four patterns (collapse already exists)

Copy [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Do not add `sm:` / `lg:` / `xl:` / `2xl:` (ignore pre-existing `sm:` inside F3 `Sheet` / `UserMenu` / `/dev/ui` — do not edit those files).

**Do not hide the match preview, `RuleSentence`, simulation panes, or explainer on narrow.** They are the product. Stack them.

| Screen                | Narrow                                                                           | Desktop (`md:`)                                               |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Project controls      | `DataTable` + internal overflow; toolbar `flex-wrap`; org-wide list stacks below | same table, **not** a card list                               |
| Org `/settings/rules` | `DataTable` + internal overflow; toolbar `flex-wrap`                             | same table                                                    |
| Rule builder          | `flex-col`: form, then `RuleSentence` + match preview below                      | `flex-col md:flex-row` form \| preview; both `min-w-0 flex-1` |
| Condition / actions   | one column `flex flex-col gap-3`; add/remove `flex-wrap`                         | same; **no** `md:grid` of all condition rows                  |
| Simulation            | `grid-cols-1`: current, then simulated; hypothetical `Alert` first               | `grid-cols-1 md:grid-cols-2` — both panes fully visible       |
| Automation history    | `DataTable` + internal overflow; toolbar `flex-wrap`                             | same table                                                    |
| Attributes            | stack: built-in list, then custom `DataTable`; create `Dialog`; values `Sheet`   | same stack                                                    |
| Card explainer        | stack: final limits, governing rules, attributes, merge                          | same stack; **no** hiding merge                               |
| Settings tabs         | `flex flex-wrap gap-2` **Links** (existing `SettingsChrome`)                     | same wrap                                                     |
| Org SideNav           | Automation / Rules / Attributes appear inside existing Menu `Sheet`              | same items in the `hidden md:flex` aside                      |

Workspace tabs already `flex flex-wrap` in `ProjectWorkspace.tsx`. Do not switch them to Radix `Tabs`.

Chrome Links: `buttonVariants({ variant: 'ghost' })` + `Link` for new wrap-nav (A3 Slot crash — do **not** `Button asChild` for new wrap-nav Links). Existing `SettingsChrome.tsx` already uses `Button asChild` — **do not restyle it**. `Button asChild` + `Link` is OK for primary actions (A2.3 Create).

### 4. Existing contracts (copy these fields; do not redeclare)

All amounts that are numbers are **integer minor units**. Currency is ISO 4217 `string` length 3 **or** a formula/attribute identifier (rule DSL only). Never `parseFloat`, never `type="number"`. **Never PAN / CVV / expiry.**

**Permission** for rules, runs, attributes: `control.edit` (`Permission.CONTROL_EDIT`). Handlers call `requirePermission(ctx, Permission.CONTROL_EDIT)` **without** `projectId` — org OWNER/ADMIN short-circuit, or any active membership that grants `control.edit` (B3.11 `ORG_WIDE_VIA_MEMBERSHIP`).

**Permission** for explain: `card.view` with `{ projectId, cardId }` — `src/app/api/cards/[id]/explain/route.ts`.

Client `can()` is UX only. `PermissionGate` requires `projectId: string`. On **project** screens pass `projectId={id}` `permission="control.edit"`. On **org** screens (`/settings/rules`, `/settings/attributes`, `/automation`, builder with ORG scope) use `PermissionGateView` `allowed={holdsControlEdit(orgRole, mePermissions)}` — helper in A6.0. If `projectId` is `null`/missing, do **not** pass `''`.

---

**`GET /api/rules`** — `ruleContracts.list` — `control.edit` — input `listRulesQuery`:

```
{
  projectId?: string min 1,
  enabled?: query 'true' | 'false' → boolean,
  page: coerce int min 1 default 1,
  pageSize: coerce int min 1 max 100 default 20
}
```

`projectId` filters `scope.projectId` **exactly** (`src/server/repositories/rules.ts`). Org-wide rules (`scope.level === 'ORG'`, no `projectId`) are **omitted** when `projectId` is set.

Output `ruleListSchema`: `{ items: ruleSchema[], page: int min 1, pageSize: int min 1, total: int min 0 }`. Sort is server `priority` asc, then `createdAt` desc. **No client-side refilter** of the paginated project list.

**`POST /api/rules`** — `.create` — `control.edit` — input `createRuleInput`:

```
{
  scope: { level: 'ORG' | 'PROJECT', projectId?: string min 1 },
    // PROJECT requires projectId; ORG must omit projectId
  name: string min 1 max 200,
  description?: string max 2000 | null,
  enabled?: boolean,                    // omit or false — server defaults false
  priority?: int,                       // omit — server defaults 100; lower = higher precedence
  trigger: {
    events?: string min 1[] min 1,
    schedule?: string min 1 max 120,    // cron; optional
    debounceSec?: int >= 0
  },                                    // requires events and/or schedule
  when: Condition,                      // see conditionSchema below
  then: RuleAction[] min 1,
  else?: RuleAction[]
}
```

Output `ruleSchema` (adds `id`, `orgId`, `createdBy`, `version` int positive, `createdAt`, `updatedAt`, `enabled`, `priority`).

**`PATCH /api/rules/:id`** — `.update` — `control.edit` — input `updateRuleInput` (≥1 of `scope` | `name` | `description` | `priority` | `trigger` | `when` | `then` | `else`). `else` may be `null` to clear. Does **not** include `enabled`. Bumps `version`. Output `ruleSchema`. Cross-org → 404.

**`DELETE /api/rules/:id`** — `.delete` — `control.edit` — input `z.void()`, output `z.void()`. Cross-org → 404.

**`POST /api/rules/:id/enable`** — `.enable` — `control.edit` — input `{ enabled: boolean }`. Does **not** bump `version`. Output `ruleSchema`.

**`POST /api/rules/validate`** — `.validate` — `control.edit` — input `validateRuleInput` (all `createRuleInput` fields optional except any `then` present must be `min 1`). Output discriminated:

```
{ ok: true }
| { ok: false, errors: { path: string, message: string }[] }
```

Never writes. Mutation; **do not cache**. Generation counter on the builder.

**`POST /api/rules/simulate`** — `.simulate` — `control.edit` — input `simulateRulesInput` (≥1 of `ruleIds` | `draftRule` | `projectId` | `attributeOverrides`):

```
{
  ruleIds?: string min 1[] min 1,
  projectId?: string min 1,
  draftRule?: createRuleInput,          // unsaved builder body
  attributeOverrides?: {
    key: string min 1,
    subjectType: 'ORG' | 'PROJECT' | 'MEMBER' | 'CARD',
    subjectId: string min 1,
    value: number | string | boolean | null
  }[]
}
```

Output `simulateRulesOutput`: `{ runs: ruleRunSchema[], cardDiffs: cardControlsDiffSchema[], conflicts: mergeConflictSchema[] }`. Runs have `status: 'DRY_RUN'`. Zero Airwallex calls, zero DB writes. Mutation; **do not cache**.

A draft rule in `runs[]` has `ruleId === 'draft'` (server `DRAFT_RULE_ID`). Copy that literal into the client helper file as `DRAFT_RULE_ID = 'draft'`.

---

**`conditionSchema`** (recursive; exactly one of `all` | `any` | `not` | `attr`+`op` | `expr`):

```
{
  all?: Condition[] min 1,
  any?: Condition[] min 1,
  not?: Condition,
  attr?: string min 1,
  op?: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'contains' | 'between'
       | 'changedBy' | 'crossedBelow' | 'crossedAbove',
  value?: number | string | boolean | null | (number|string|boolean|null)[] | { attr: string min 1 },
  expr?: string min 1 max 500
}
```

`attr` branch requires `attr` **and** `op` **and** `value`.

**A6 condition UI is leaf-only inside one combinator** (policy §9). Do not ship a recursive tree editor.

---

**`ruleActionSchema`:**

```
{
  action: 'card.create' | 'card.setControls' | 'card.freeze' | 'card.unfreeze' | 'card.close'
        | 'access.grant' | 'access.revoke' | 'access.expire' | 'budget.allocate'
        | 'approval.require' | 'notify' | 'flag.review',
  target: {
    select: 'PROJECT_CARDS' | 'MEMBER_CARDS' | 'CARD' | 'PROJECT_MEMBERS' | 'EVENT_SUBJECT',
    filter?: {
      purpose?: 'SHARED' | 'MEMBER' | 'VENDOR' | 'ONE_TIME',
      memberRole?: string min 1,
      roleKeys?: string min 1[] min 1,
      cardIds?: string min 1[] min 1,
      memberIds?: string min 1[] min 1
    },
    memberIds?: string min 1[] min 1,
    roleKeys?: string min 1[] min 1,
    cardId?: string min 1          // required when select is CARD
  },
  params: {                        // default {}
    formFactor?: 'VIRTUAL' | 'PHYSICAL',
    purpose?: CardPurpose,
    allowedTransactionCount?: 'SINGLE' | 'MULTIPLE',
    transactionLimits?: {
      currency: string min 1 max 500,   // ISO code or formula/attr
      limits: { interval: TransactionLimitInterval, amount: string min 1 max 500 | int }[] min 1
    },
    activeFrom?: iso datetime | string min 1 max 500 | null,
    activeTo?: iso datetime | string min 1 max 500 | null,
    activeFromOffsetDays?: int,
    activeToOffsetDays?: int,           // not a formula; no now() (B6.4)
    allowedCurrencies?: null | string[] min 1 | string min 1 max 500,
    allowedMerchantCategories?: same,
    allowedMerchantCountries?: same,
    allowedMerchantBrands?: same,
    blockedTransactionUsages?: { transactionScope: string min 1, usageScope: string min 1 }[],
    reason?: string min 1 max 500,
    template?: string min 1 max 120,
    recompute?: boolean,
    when?: string min 1 max 500,
    allowDestructive?: boolean          // required for card.close or the pipeline skips
  }
}
```

Empty allowlist `[]` is invalid on the wire (invariant 8). Builder sends `null` (unconstrained) or `string[] min 1` or a formula string — never `[]`.

---

**`GET /api/rule-runs`** — `ruleRunContracts.list` — `control.edit` — input `listRuleRunsQuery`:

```
{
  ruleId?: string min 1,
  cardId?: string min 1,
  projectId?: string min 1,
  status?: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'SKIPPED' | 'DRY_RUN',
  page: coerce int min 1 default 1,
  pageSize: coerce int min 1 max 100 default 20
}
```

Output `{ items: ruleRunSchema[], page, pageSize, total }`. Hook `useRuleRuns` is **infinite** (page-based). Flatten with `flattenRunPages` (same idea as A5 `flattenTransactionPages`). **No client-side refilter.**

**`GET /api/rule-runs/:id`** — `.get` — `control.edit` — output `ruleRunSchema`. Cross-org → 404.

`ruleRunSchema` (display fields A6 uses):

```
{
  id, orgId, ruleId: string min 1,
  triggeredBy: string min 1,
  triggeredByType: USER | RULE | SYSTEM | AIRWALLEX,
  triggerEvent: string min 1,
  inputs: {
    key: string min 1,
    subjectType: ORG | PROJECT | MEMBER | CARD,
    subjectId: string min 1,
    value: number | string | boolean | null,
    observedAt: iso,
    ttlSec: int positive | null,
    stale: boolean
  }[],
  matched: boolean,
  desiredState: { cards: { cardId, controls?: partial cardControls, cardStatus?: ACTIVE|INACTIVE|CLOSED, allowDestructiveClose?: boolean }[] },
  diff: { cards: cardControlsDiffSchema[] },
  actions: { action: RuleActionType, targetId: string | null, status: APPLIED|SKIPPED|FAILED|CONFLICT|WOULD_APPLY, message: string | null, details?: Record<string, unknown> }[],
  conflicts: { kind: EMPTY_CURRENCY_INTERSECTION | EMPTY_MCC_INTERSECTION | EMPTY_COUNTRY_INTERSECTION | EMPTY_BRAND_INTERSECTION | ACTIVE_WINDOW_INVERTED | OTHER, message: string min 1, cardId?: string, field?: string }[],
  status: SUCCESS | PARTIAL | FAILED | SKIPPED | DRY_RUN,
  skipReason: string | null,          // e.g. stale input: campaign.roas
  failureReason: string | null,       // e.g. missing attribute: project.budget.remaining
  durationMs: int >= 0,
  startedAt: iso, finishedAt: iso
}
```

`DRY_RUN` is simulate-only and is **never** persisted. Automation history will not list it unless someone stored one — still handle the enum in the status filter.

---

**`GET /api/cards/:id/explain`** — `cardExplainContracts.explain` — `card.view` — input `z.void()` — output `cardExplainSchema`:

```
{
  cardId: string min 1,
  projectId: string min 1 | null,
  finalControls: cardControlsSchema,          // resolved literals, minor units
  finalStatus: ACTIVE | INACTIVE | CLOSED,
  governingRules: {
    ruleId, name: string min 1, priority: int, version: int positive,
    matched: boolean,
    contribution?: { controls?: partial cardControls, cardStatus?: DesiredCardStatus, allowDestructiveClose?: boolean }
  }[],
  attributeValues: attributeValueSchema[],    // flag stale via AttributeValue
  merge: {
    field: string min 1,
    strategy: 'min' | 'max' | 'intersect' | 'union' | 'most_restrictive',
    contributions: { ruleId, ruleName: string min 1, priority: int, value: unknown }[],
    result: unknown
  }[],
  conflicts: mergeConflictSchema[],
  lastRuleRunId: string min 1 | null,
  lastEvaluatedAt: iso | null
}
```

---

**`GET /api/attributes`** — `attributeContracts.list` — `control.edit` — input `{ scope?: ORG|PROJECT|MEMBER|CARD, source?: COMPUTED|MANUAL|WEBHOOK|CONNECTOR, page, pageSize }` — output `{ items: attributeDefinitionSchema[], page, pageSize, total }`.

**Built-ins are not stored.** This list is **custom** definitions only. Render built-ins from the A6.0 client catalogue.

`attributeDefinitionSchema`:

```
{
  id, orgId,
  key: string min 1 max 120 matching /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$/,
  label: string min 1 max 120,
  type: NUMBER | STRING | BOOLEAN | DATE | ENUM,
  unit: string min 1 max 40 | null,
  scope: ORG | PROJECT | MEMBER | CARD,
  source: COMPUTED | MANUAL | WEBHOOK | CONNECTOR,
  connectorId: string min 1 | null,
  refreshIntervalSec: int positive | null,
  enumValues: string min 1[] min 1 | null,
  hasWebhookSecret: boolean,          // secret itself never returned
  createdAt, updatedAt
}
```

**`POST /api/attributes`** — `.create` — custom only (`MANUAL` | `WEBHOOK` | `CONNECTOR`). Cannot shadow a built-in key. `ENUM` requires `enumValues min 1`. `WEBHOOK` requires `webhookSecret` string min 16 max 256 (write-only). `CONNECTOR` requires `connectorId` + `refreshIntervalSec`. Locked connector id: `'campaign-analytics'`.

**`PATCH /api/attributes/:key`** — `.update` — ≥1 of `label` | `unit` | `connectorId` | `refreshIntervalSec` | `enumValues` | `webhookSecret` (rotate).

**`GET /api/attributes/values`** — `.listValues` — `{ key?: string min 1, subjectType?, subjectId?, page, pageSize }` → `{ items: attributeValueSchema[], page, pageSize, total }`. Stored MANUAL/WEBHOOK/CONNECTOR values, not computed builtins.

`attributeValueSchema`: `{ id, orgId, key, subjectType, subjectId, value: number|string|boolean|null, observedAt: iso, source, ttlSec: int positive | null, createdAt, updatedAt }`.

**`PUT /api/attributes/values`** — `.putValue` — MANUAL only (server 422 otherwise): `{ key, subjectType, subjectId, value, observedAt?: iso, ttlSec?: int positive | null }`.

NUMBER attributes may be floats (ROAS). Money attributes are still integer minor units **by convention** — when the user is editing a money-typed custom attr, use text + `parseMoneyInput`, never `type="number"`.

---

**`GET /api/projects`** — `useProjects({ page: 1, pageSize: 100 })` for scope project picker labels.

**`GET /api/projects/:id/cards`** — `useProjectCards(id, { page: 1, pageSize: 100 })` for target `CARD` combobox (`nickName` + `maskedNumber` only).

**`GET /api/projects/:id/members`** — `useProjectMembers(id)` for member-id target filters.

**`GET /api/me`** — `memberships[].orgRole` `OWNER` | `ADMIN` | `MEMBER` for `holdsControlEdit`.

### 5. No GET-by-id; create is `/settings/rules/new`

- Builder `id === 'new'` → local draft state from `emptyDraftRule(scope)` or `RULE_TEMPLATES[key]` (query `?template=A|B|C|D|E`). Save → `useCreateRule` then `router.replace(ruleBuilderHref(data.id))`.
- Builder other id → `findRuleById(useRules({ page: 1, pageSize: 100 }).data?.items, id)`. Missing → locked not-found copy.
- Simulate page same load path; `id === 'new'` simulates with `draftRule` only (read draft from sessionStorage key `allocard.ruleDraft` **or** locked simpler: if `new`, `ErrorState` `Save the rule before opening simulation.` — **locked: Save first.** Simulate of an unsaved draft lives on the **builder** preview, not the simulate route).

### 6. Live match preview (builder) vs full simulation (simulate route)

Builder (A6.5): debounce `RULE_VALIDATE_DEBOUNCE_MS` (300). Generation counter. If `useValidateRule` → `ok: false`, show `errors[]` (`path`: `message`) and **do not** simulate. If `ok: true`, `useSimulateRules({ draftRule: toCreateRuleInput(draft), projectId: draft.scope.projectId })`. Preview copy from `matchPreviewFromSimulate(output, DRAFT_RULE_ID)` — locked §13. Keep the last successful preview while in-flight (do not blank the pane).

Simulate route (A6.6): explicit Run button (not on every keystroke). `attributeOverrides[]` from the override list. Banner locked hypothetical copy **above** the grid. Results `StatusBadge kind="ruleRun"` will be `DRY_RUN`. Per-card `DiffView` from `cardDiffToDiffView`. Conflicts `Alert` destructive with `conflict.message` verbatim.

Simulation output **is** what a real run would apply (same pipeline stopped after step 6). Do not invent a second merge on the client.

### 7. Project list vs org list vs “also applying”

| Page                      | `useRules` filter                             | Also show                                                                                                                                                                                                                                  |
| ------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `/projects/[id]/controls` | `{ projectId: id, page, pageSize, enabled? }` | Org-wide: second `useRules({ page: 1, pageSize: 100 })` then `items.filter(r => r.scope.level === 'ORG')` as a **separate** heading `Org-wide rules that also apply` with Links to the builder — this is not refiltering the project table |
| `/settings/rules`         | `{ page, pageSize, enabled? }` (all scopes)   | Toolbar project `Select` writes `?projectId=` onto the **same** list contract                                                                                                                                                              |

`?ruleId=` on the project page: if the id is in the current **project** items, highlight that row (`data-rule-id`) and show Alert + `Edit in builder` Link. Do not auto-redirect.

### 8. Templates = B6 worked examples (legal DSL)

Empty states offer templates A–E. Bodies copy `src/server/services/rules/examples.test.ts` (not the RULES-ENGINE.md JSON — that doc still has `now() + 7d` and major-unit amounts, which B6.4 forbade).

| Key | Name                                              | Notes for the template body                                                                                                                                                                                                            |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | Issue member cards on project launch              | `trigger.events: ['project.launched']`; `then` `card.create` / `PROJECT_MEMBERS` / `roleKeys: ['project_spender']`; amount formula `project.budget.approved / max(project.headcount, 1) * 0.25`; `activeFrom`/`activeTo` attribute ids |
| B   | Freeze member cards when budget drops below 10%   | `priority: 10`; `crossedAbove` 90 on `project.budget.utilisationPct`; freeze MEMBER cards + notify `roleKeys: ['project_manager']`                                                                                                     |
| C   | Scale campaign card with ROAS                     | **Do not** hardcode a `cardId`. Template uses `PROJECT_CARDS` (user may switch to `CARD`). Amounts **minor units**: `clamp(campaign.roas * 200000, 100000, 2500000)` / else `100000` WEEKLY                                            |
| D   | One-time vendor card on approved purchase request | `scope.level: 'ORG'` (no projectId); `activeToOffsetDays: 7` (not `now()+7d`); `allowedMerchantCategories: 'request.vendor.mccList'` formula string; amount `request.amount * 1.02`; compare value `2500000` minor units               |
| E   | Recalculate access on role change                 | `member.role_changed` + `member.scope_changed`; `access.grant` `recompute: true`; setControls MEMBER_CARDS; `flag.review` `reason: 'role change'`                                                                                      |

`applyTemplate(key, scopeOverride)` replaces `scope` with the page’s scope (project page → `{ level: 'PROJECT', projectId }`, except D stays ORG). Create is still disabled until Save.

### 9. Condition builder (locked UI)

Mode `RadioGroup`: `all` | `any` | `attr` | `expr`.

- `all` / `any`: list of **leaf** `{ attr, op, value }` rows only. Add / remove. No nested `all`/`any`/`not`.
- `attr`: exactly one leaf.
- `expr`: one `Textarea` max 500 + `FormulaHighlight`. No client eval.
- Optional Switch `Negate entire condition` → wrap the tree in `{ not: tree }` (one wrap only).

Leaf row: attribute `Combobox` (options = built-in keys ∪ `useAttributes({ page: 1, pageSize: 100 })` keys), operator `Select` (`ConditionOperator` values), value:

| `op`                                                                                  | Value control                                         |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `in` / `nin` / `between`                                                              | two-or-more text fields → array (between = exactly 2) |
| `eq`/`neq`/`gt`/`gte`/`lt`/`lte`/`contains`/`changedBy`/`crossedBelow`/`crossedAbove` | one text field; `parseConditionValue` (A6.0)          |
| Toggle `Compare to attribute`                                                         | value `{ attr: string }` instead of a literal         |

Do not show all operator-specific controls at once — progressive on `op`.

### 10. Action list (locked UI)

`then[]` min 1. `else[]` optional — heading `Otherwise` + Add. Each row:

1. `action` Select (all `RuleActionType` values).
2. `target.select` Select.
3. Target extras (progressive): `CARD` → card Combobox from `useProjectCards` when `scope.projectId` else text id; `PROJECT_CARDS` → optional purpose Select; `PROJECT_MEMBERS` / `MEMBER_CARDS` → optional `roleKeys` comma-split text; `EVENT_SUBJECT` → none.
4. Params by action (only the relevant fields; do not show every key):

| Action                                 | Params shown                                                                                                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `card.create`                          | formFactor, purpose, allowedTransactionCount, transactionLimits (interval + amount text + currency text), activeFrom/activeTo text, `activeToOffsetDays` text |
| `card.setControls`                     | transactionLimits, allowlists (comma-split → `string[] min 1` or empty → `null`), activeFrom/activeTo, offset days                                            |
| `card.freeze` / `card.unfreeze`        | `reason`                                                                                                                                                      |
| `card.close`                           | `reason` + Checkbox `allowDestructive` (must be true to send; helper copy §13)                                                                                |
| `notify`                               | `template`                                                                                                                                                    |
| `access.grant` / `revoke` / `expire`   | `recompute` Switch; `reason`                                                                                                                                  |
| `flag.review`                          | `reason`                                                                                                                                                      |
| `budget.allocate` / `approval.require` | `reason` only (owning phases still SKIPPED server-side)                                                                                                       |

Amount fields: `parseFormulaOrInt` — if `/^-?\d+$/` then `int`, else formula `string`. Never `parseFloat`, never `type="number"`.

### 11. Formula highlighting and autocomplete — display only

Next to every formula/amount `Textarea`/`Input`: `FormulaHighlight expression={value}`. Autocomplete is a `flex-wrap` list of attribute keys; click **inserts the key string** into the field. That is not a parser.

### 12. Extra invalidation, money, PAN, testing, ESLint

- After create/update/enable/delete, F1 already invalidates `qk.rules()` + `qk.cards()`. Screens do not need extra `invalidateQueries` unless a task says so.
- `PermissionGate` / `PermissionGateView`: always show New / Save / Enable / Simulate / Delete (disabled + tooltip). Never `hidden` them on narrow. Never hide match preview / explainer / simulation panes.
- Tests: pure helpers in `src/client/lib/rules.ts` with vitest **node**.
- Screen Accept always includes `pnpm verify` plus **375px and 768px**: no page-level horizontal scrollbar; primary actions reachable; tables may scroll **inside**; builder preview, simulate both panes, and explainer merge reachable by **vertical** scroll (stacked, not `hidden`).
- `(app)` already bans `call()` / `fetch`. Do not add a `@/server` ban (server layout still uses `requireApp`).

### 13. Locked copy (do not paraphrase)

| Situation                       | Surface                   | Copy                                                                                                                                        |
| ------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Cannot edit controls            | `PermissionGateView`      | `You don't have permission to edit controls.`                                                                                               |
| Cannot view explain             | `ErrorState`              | server `error.message` (403 names `card.view`)                                                                                              |
| No project rules                | `EmptyState`              | title `No rules yet` / description `Start from a template — limits are derived from attributes, not typed as a card ceiling.`               |
| No org rules                    | `EmptyState`              | title `No rules yet` / description `Org-wide rules apply to every project.`                                                                 |
| Template button                 | Button/Link               | `Use template {A\|B\|C\|D\|E}` (letter + name from §8)                                                                                      |
| Org-wide section                | heading                   | `Org-wide rules that also apply`                                                                                                            |
| Match preview (n≥1, with limit) | preview pane              | `With today's values, this rule matches {n} cards and would set the {interval} limit to {money}.`                                           |
| Match preview (n≥1, no limit)   | preview pane              | `With today's values, this rule matches {n} cards.`                                                                                         |
| Match preview (n=0)             | preview pane              | `With today's values, this rule matches no cards.`                                                                                          |
| Validate errors                 | list                      | `{path}: {message}` verbatim                                                                                                                |
| Simulation hypothetical         | `Alert` (not destructive) | `This is a simulation. Nothing is written to Airwallex or the database.`                                                                    |
| Simulate Run                    | Button                    | `Run simulation`                                                                                                                            |
| Simulate empty diffs            | `EmptyState`              | title `No card changes` / description `This simulation would not change any card.`                                                          |
| Never run                       | line on list/builder      | `This rule has never run.`                                                                                                                  |
| Last run unmatched              | line                      | `Last run did not match.`                                                                                                                   |
| Failed run                      | `Alert` destructive       | `failureReason` verbatim (fallback `This run failed.`)                                                                                      |
| Partial run                     | `Alert` destructive       | `This run is partial — a rule wanted something impossible.` then each `conflicts[].message`                                                 |
| Skipped run                     | `Alert`                   | `skipReason` verbatim                                                                                                                       |
| Stale attribute                 | `AttributeValue`          | F3 already prefixes `Stale ·` — do not paraphrase                                                                                           |
| Close without allowDestructive  | helper text               | `Closing a card is terminal. Check allow destructive to include card.close.`                                                                |
| Built-in attributes heading     | heading                   | `Built-in attributes`                                                                                                                       |
| Custom attributes heading       | heading                   | `Custom attributes`                                                                                                                         |
| Create attribute                | Button                    | `Create attribute`                                                                                                                          |
| MANUAL value save               | Button                    | `Save value`                                                                                                                                |
| WEBHOOK secret                  | helper                    | `The webhook secret is write-only and is never shown again.`                                                                                |
| CONNECTOR only                  | Select                    | `Campaign Analytics` value `campaign-analytics`                                                                                             |
| Ingest not in UI                | helper on WEBHOOK         | `Values arrive via webhook ingest, not this screen.`                                                                                        |
| Rule not found                  | `ErrorState`              | `This rule is not available.`                                                                                                               |
| Project not found               | `ErrorState`              | `This project is not available.`                                                                                                            |
| Card not found                  | `ErrorState`              | `This card is not available.`                                                                                                               |
| Explain heading                 | heading                   | `Why this limit?`                                                                                                                           |
| Merge heading                   | heading                   | `How rules merged`                                                                                                                          |
| Governing heading               | heading                   | `Governing rules`                                                                                                                           |
| Enable                          | Switch/Button             | `Enabled`                                                                                                                                   |
| Save rule                       | Button                    | `Save rule`                                                                                                                                 |
| Delete confirm                  | `ConfirmDialog`           | title `Delete this rule?` description `Cards keep their last applied controls.` confirm `Delete` variant `destructive` (no `typeToConfirm`) |
| Wizard → controls               | `Link`                    | `Set project rules on the controls tab.`                                                                                                    |
| Duplicate / 409 / 422           | `Alert` destructive       | server `error.message` / `applyServerErrorsFromApiError`                                                                                    |

---

## Contracts first

- [x] **A6.0** — Rule / automation helpers (STOP for review)
  - **Files:**
    - `src/client/lib/rules.ts` (create)
    - `src/client/lib/rules.test.ts` (create)
    - `src/client/lib/index.ts` (edit — `export * from '@/client/lib/rules'`)
  - **Do:** No React screens. No AppShell / builder / simulate changes yet. Implement the locked helper API (pure, no React, no `call()`):
    1. `NEW_RULE_ID`: `'new'`.
    2. `DRAFT_RULE_ID`: `'draft'`.
    3. `CAMPAIGN_ANALYTICS_CONNECTOR_ID`: `'campaign-analytics'`.
    4. `RULE_VALIDATE_DEBOUNCE_MS`: `300`.
    5. `MAX_FORMULA_LENGTH`: `500` (same cap as schemas).
    6. `orgRulesHref(): string` — `'/settings/rules'`.
    7. `ruleBuilderHref(ruleId: string): string` — `/settings/rules/${ruleId}`. Throw if `ruleId.length < 1`.
    8. `newRuleHref(template?: string): string` — `/settings/rules/new` or `?template=${encodeURIComponent(template)}` when template min 1.
       8a. `newProjectRuleHref(projectId: string, template?: string): string` — `/settings/rules/new?projectId=${encodeURIComponent(projectId)}` and `&template=` when set. Throw if `projectId` empty. Builder (A6.4) reads `projectId` for `emptyDraftRule({ level: 'PROJECT', projectId })`.
       8b. `parseOptionalIdParam(input: string | string[] | undefined): string | undefined` — arrays use `[0]`; empty → undefined.
    9. `ruleSimulateHref(ruleId: string): string` — `/settings/rules/${ruleId}/simulate`. Throw if empty. If `ruleId === NEW_RULE_ID`, still return the path (A6.6 will ErrorState).
    10. `automationHref(): string` — `'/automation'`.
    11. `attributesHref(): string` — `'/settings/attributes'`.
    12. `cardExplainHref(cardId: string): string` — `/cards/${cardId}/explain`. Throw if empty.
    13. Re-export `controlsHref` and `ruleHref` from `src/client/lib/cards.ts` (do not duplicate).
    14. `parseRuleListSearchParams(input: { projectId?: string | string[]; enabled?: string | string[]; page?: string | string[]; pageSize?: string | string[] }): ListRulesQuery` — arrays use `[0]`. `listRulesQuery.safeParse` on the coerced object; on failure return `{ page: 1, pageSize: 20 }` only. `enabled` only `'true'` | `'false'`.
    15. `ruleListHref(filter: { projectId?: string; enabled?: boolean; page?: number; pageSize?: number }): string` — path `/settings/rules`; omit defaults (`page` 1, `pageSize` 20). `enabled` serialises as `'true'`/`'false'`.
    16. `projectControlsHref(projectId: string, filter?: { enabled?: boolean; page?: number; pageSize?: number; ruleId?: string }): string` — base `controlsHref(projectId)`; omit defaults; `ruleId` from A5 deep-link.
    17. `parseProjectControlsSearchParams` — same as list plus `ruleId?: string`; drop unknown; failure → `{ page: 1, pageSize: 20 }`.
    18. `parseRuleRunSearchParams(input: { ruleId?: string | string[]; cardId?: string | string[]; projectId?: string | string[]; status?: string | string[]; page?: string | string[]; pageSize?: string | string[] }): ListRuleRunsQuery` — `listRuleRunsQuery.safeParse`; unknown status dropped; failure → `{ page: 1, pageSize: 20 }`.
    19. `automationListHref(filter: { ruleId?: string; cardId?: string; projectId?: string; status?: RuleRunStatus; page?: number; pageSize?: number }): string` — path `/automation`; omit defaults.
    20. `parseAttributeListSearchParams` against `listAttributesQuery`; failure → `{ page: 1, pageSize: 20 }`.
    21. `attributeListHref(filter: { scope?: AttributeScope; source?: AttributeSource; page?: number; pageSize?: number }): string` — path `/settings/attributes`.
    22. `isNewRuleId(id: string): boolean` — `id === NEW_RULE_ID`.
    23. `findRuleById(items: ReadonlyArray<{ id: string }> | undefined, id: string): T | undefined` — `items?.find(r => r.id === id)`.
    24. `holdsControlEdit(orgRole: string | undefined, projects: ReadonlyArray<{ permissions: readonly string[] }> | undefined): boolean` — `orgRole === 'OWNER' \|\| orgRole === 'ADMIN'` OR any project `permissions.includes('control.edit')`.
    25. `RULE_TRIGGER_EVENTS`: `readonly string[]` copy these literals (do **not** import server `DomainEventType`): `project.created`, `project.approved`, `project.launched`, `project.closing`, `project.closed`, `budget.approved`, `budget.updated`, `budget.threshold_crossed`, `member.added`, `member.role_changed`, `member.scope_changed`, `member.removed`, `card.created`, `card.status_changed`, `card.limit_updated`, `request.created`, `request.submitted`, `request.approved`, `request.rejected`, `request.cancelled`, `transaction.authorized`, `transaction.cleared`, `transaction.declined`, `transaction.reversed`, `attribute.updated`.
    26. `BUILTIN_ATTRIBUTE_KEYS`: `readonly { key: string; label: string; scope: 'ORG'\|'PROJECT'\|'MEMBER'\|'CARD' }[]` copy keys/labels/scopes from `src/server/services/attributes/registry.ts` `BUILTIN_ATTRIBUTE_DEFINITIONS` (the 16 enumerated built-ins). Do not import that file.
    27. `attributeOptions(customKeys: ReadonlyArray<{ key: string; label: string }>): { value: string; label: string }[]` — builtins first (label from catalogue), then custom keys not already in the builtin set, stable key order.
    28. `emptyDraftRule(scope: { level: 'ORG' } | { level: 'PROJECT'; projectId: string }): CreateRuleInput` — `name: 'Untitled rule'`, `enabled` omitted, `priority` omitted, `trigger: { events: ['budget.updated'] }`, `when: { attr: 'project.status', op: 'eq', value: 'ACTIVE' }`, `then: [{ action: 'card.setControls', target: { select: 'PROJECT_CARDS' }, params: {} }]`.
    29. `RULE_TEMPLATES`: `Record<'A'\|'B'\|'C'\|'D'\|'E', CreateRuleInput>` per policy §8. Scope on A/B/C/E is `{ level: 'PROJECT', projectId: 'TEMPLATE_PROJECT' }` placeholder; D is `{ level: 'ORG' }`.
    30. `applyTemplate(key: 'A'\|'B'\|'C'\|'D'\|'E', scope: CreateRuleInput['scope']): CreateRuleInput` — structuredClone template, replace `scope` (D keeps ORG even if a project scope is passed).
    31. `parseTemplateParam(input: { template?: string | string[] }): 'A'\|'B'\|'C'\|'D'\|'E' | null` — `[0]`, uppercased; else null.
    32. `toCreateRuleInput(draft: CreateRuleInput): CreateRuleInput` — identity that drops empty optional strings (`description` `''` → omit; `else: []` → omit).
    33. `parseFormulaOrInt(raw: string): string | number` — trim; if `/^-?\d+$/` then `Number.parseInt(raw, 10)`; else the trimmed string (may be a formula). Empty string → `0` is **forbidden** (silent 0 = $0 limit) — return `''` and let the caller treat empty as invalid.
    34. `parseConditionValue(raw: string): string | number | boolean | null` — trim; `true`/`false` → boolean; `null` → null; `/^-?\d+(\.\d+)?$/` → `Number` (ROAS / utilisation need floats; this is a **literal**, not formula eval); else string. Do not `eval`.
    35. `parseCommaList(raw: string): string[] | null` — split `,`, trim, drop empty; length 0 → `null` (never `[]`).
    36. `parseIntInput(raw: string): number | undefined` — trim; `/^-?\d+$/` → parseInt; else undefined.
    37. `conditionMode(when: Condition): 'all' | 'any' | 'attr' | 'expr' | 'not'` — if `not` present return `'not'` (caller unwraps); else the exclusive key.
    38. `wrapNot(when: Condition, negate: boolean): Condition` — `negate` true → `{ not: when }` unless already `{ not }`; false → unwrap one `not`.
    39. `matchPreviewFromSimulate(output: { runs: ReadonlyArray<{ ruleId: string; matched: boolean; desiredState: { cards: ReadonlyArray<{ cardId: string; controls?: { transactionLimits?: { currency: string; limits: { interval: string; amount: number }[] } } }> } }>; cardDiffs: unknown[] }, ruleId: string): { matchedCardCount: number; sampleLimit: { interval: string; amount: number; currency: string } | null }` — find `runs` where `ruleId` matches (`DRAFT_RULE_ID` on builder); if missing or `matched === false`, count 0 and sample null; else unique `desiredState.cards[].cardId` length; sampleLimit = first card’s first `transactionLimits.limits[0]` if `amount` is a number (skip formula leftovers — simulate output is resolved ints).
    40. `formatMatchPreview(stats: { matchedCardCount: number; sampleLimit: { interval: string; amount: number; currency: string } | null }, formatMoney: (m: { amount: number; currency: string }) => string): string` — locked §13 sentences. Use `formatMoney` argument so the helper file stays React-free (tests pass a stub `m => String(m.amount)`).
    41. `cardDiffToDiffView(diff: { before: { controls: unknown; cardStatus: unknown }; after: { controls: unknown; cardStatus: unknown } }): { before: Record<string, unknown>; after: Record<string, unknown> }` — keys `cardStatus`, then spread `controlsToDiffView` from `src/client/lib/cards.ts` when both controls are non-null objects; if `after.controls` is null, `after` is `{ cardStatus }` only.
    42. `flattenRunPages(pages: ReadonlyArray<{ items: readonly unknown[] }> | undefined): unknown[]` — `pages?.flatMap(p => p.items) ?? []`.
    43. `isProminentRunStatus(status: string): boolean` — `status === 'FAILED' \|\| status === 'PARTIAL'`.
    44. `orgWideRules(items: ReadonlyArray<{ scope: { level: string } }>): same[]` — `scope.level === 'ORG'`.
    45. Copy functions for locked §13 sentences: `editControlsDenialMessage()`, `ruleNotFoundMessage()`, `neverRunMessage()`, `lastRunUnmatchedMessage()`, `partialRunHeading()`, `simulationHypotheticalMessage()`, `webhookSecretWriteOnlyMessage()`, `ingestNotOnThisScreenMessage()`, `allowDestructiveCloseMessage()`, `wizardControlsLinkMessage()`, plus the EmptyState title/description pairs as functions returning `{ title, description }`.
  - **Pattern:** `src/client/lib/cards.ts` + `src/client/lib/cards.test.ts` (A5.0 — this phase’s B1-equivalent for helpers). URL parse/href: `parseCardListSearchParams` / `cardListHref` in that file. Contracts to copy fields from: `src/shared/schemas/rule.ts`, `src/shared/schemas/ruleRun.ts`, `src/shared/schemas/attribute.ts`, `src/shared/contracts/rule.ts` (B6 — this phase’s B1 equivalent for the wire). Templates: `src/server/services/rules/examples.test.ts` (legal DSL; do not copy RULES-ENGINE.md JSON). Trigger strings: `src/server/events/types.ts` **copied as literals**. Built-ins: `src/server/services/attributes/registry.ts` **copied as literals**. `controlsToDiffView`: `src/client/lib/cards.ts`. Debounce constant pattern: `FORMULA_DEBOUNCE_MS` in `src/client/lib/budget.ts`.
  - **STOP and get this reviewed before A6.1+.** A client formula parser, a GET-by-id contract, `now()` in templates, or hiding the match preview after screens land is a rewrite.
  - **Accept:** `pnpm test client/lib/rules` — cover: `parseRuleListSearchParams` drops unknown enabled and has no invented keys; `ruleListHref({ page: 1 })` is `/settings/rules`; `ruleBuilderHref('r1')` is `/settings/rules/r1`; `newProjectRuleHref('p', 'B')` is `/settings/rules/new?projectId=p&template=B`; `ruleBuilderHref('')` throws; `isNewRuleId('new')` true; `holdsControlEdit('MEMBER', [{ permissions: ['control.edit'] }])` true and `holdsControlEdit('MEMBER', [{ permissions: ['card.view'] }])` false and `holdsControlEdit('OWNER', [])` true; `parseFormulaOrInt('412')` is `412` and `parseFormulaOrInt('project.budget.remaining * 0.1')` is the string and `parseFormulaOrInt('')` is `''`; `parseCommaList('')` is `null` not `[]`; `parseCommaList('USD, AUD')` is `['USD','AUD']`; `matchPreviewFromSimulate` with unmatched draft → count 0; with matched two cards and MONTHLY 41200 USD → count 2 and sample `{ interval: 'MONTHLY', amount: 41200, currency: 'USD' }`; `formatMatchPreview` n=0 locked sentence; `applyTemplate('D', { level: 'PROJECT', projectId: 'p' }).scope.level` is `'ORG'`; `applyTemplate('B', { level: 'PROJECT', projectId: 'p' }).when` has `op: 'crossedAbove'`; template C amount string contains `200000` not `2000`; template D has `activeToOffsetDays: 7` and no `now()`; `RULE_TRIGGER_EVENTS` includes `project.launched` and does not include `rule.evaluated`; `CAMPAIGN_ANALYTICS_CONNECTOR_ID === 'campaign-analytics'`; `cardDiffToDiffView` includes `cardStatus`.
  - **Notes:** Helpers in `src/client/lib/rules.ts` (18 unit tests). No GET-by-id; templates copy B6 examples (minor units, `activeToOffsetDays: 7`, no `now()`). `MAX_FORMULA_LENGTH` stays on `budget.ts` to avoid the barrel clash. `pnpm verify` green (1672 tests). STOP before A6.1 screens.

---

## Tasks

### A6.1 — SideNav + settings nav + route shells

- [x] **A6.1** — Insert Automation / Rules / Attributes; placeholders so links do not 404
  - **Files:**
    - `src/client/shell/AppShell.tsx` (edit — `DEFAULT_NAV` only)
    - `src/client/lib/access.ts` (edit — `SETTINGS_NAV` only)
    - `src/client/lib/access.test.ts` (edit — SETTINGS_NAV assertions that currently expect exactly two hrefs)
    - `src/client/lib/projects.test.ts` (edit — SETTINGS_NAV assertions that currently expect exactly two hrefs)
    - `src/app/(app)/automation/page.tsx` (create — placeholder until A6.7)
    - `src/app/(app)/settings/rules/page.tsx` (create — placeholder until A6.3)
    - `src/app/(app)/settings/rules/[id]/page.tsx` (create — placeholder until A6.4)
    - `src/app/(app)/settings/rules/[id]/simulate/page.tsx` (create — placeholder until A6.6)
    - `src/app/(app)/settings/attributes/page.tsx` (create — placeholder until A6.8)
    - `src/app/(app)/cards/[id]/explain/page.tsx` (create — placeholder until A6.9)
  - **Do:**
    1. `DEFAULT_NAV`: insert `{ href: '/automation', label: 'Automation' }` immediately **after** `{ href: '/activity', label: 'Activity' }` and **before** Reports. Append `{ href: '/settings/rules', label: 'Rules' }` and `{ href: '/settings/attributes', label: 'Attributes' }` **after** Access reviews. Do **not** change aside `hidden md:flex` / Menu / Sheet / `w-56`.
    2. `SETTINGS_NAV` becomes:
       `{ href: '/settings/roles', label: 'Roles' }`,
       `{ href: '/settings/access-reviews', label: 'Access reviews' }`,
       `{ href: '/settings/rules', label: 'Rules' }`,
       `{ href: '/settings/attributes', label: 'Attributes' }`.
       `SettingsChrome` reads this array — do not restyle it.
    3. Update the two tests that pin SETTINGS_NAV to exactly `/settings/roles` + `/settings/access-reviews` so they expect the four hrefs above (still no `/projects/.../settings`).
    4. Placeholders: `<main className="min-w-0">{label} — not built yet</main>` for Automation, Rules list, Rule builder, Simulate, Attributes, Explain. Must **not** 404. `[id]` also covers `new`.
    5. Do **not** replace `projects/[id]/controls/page.tsx` yet (still `ComingSoonTab`).
  - **Layout:** n/a for placeholders (stack `min-w-0`). Shell collapse unchanged. New hrefs are in the aside at `md` and in the Menu `Sheet` below `md` (same `SideNav`). Settings tabs wrap.
  - **Pattern:** A5.1 `src/client/shell/AppShell.tsx` `DEFAULT_NAV` insert. A3.6 `SETTINGS_NAV` in `src/client/lib/access.ts`. Placeholders: A5.1 `/cards` pages. B6 list path: `src/shared/contracts/rule.ts` `list.path` `'/api/rules'` (UI path is `/settings/rules`, not `/api/rules`).
  - **Accept:** `pnpm verify`. `/automation`, `/settings/rules`, `/settings/rules/new`, `/settings/rules/any-id`, `/settings/rules/any-id/simulate`, `/settings/attributes`, `/cards/any-id/explain` are not 404. SideNav at 768px shows Automation after Activity and Rules/Attributes after Access reviews; at 375px those labels appear inside the existing Menu Sheet. 375px and 768px: no page-level horizontal scrollbar; Menu/Sheet still works below `md`. Aside still `hidden md:flex`. `AppShell.tsx` does not lose `hidden` or `md:flex`. SETTINGS_NAV tests expect four hrefs and still ban a project settings tab.
  - **Notes:** `DEFAULT_NAV` Automation after Activity; Rules/Attributes after Access reviews. SETTINGS_NAV four hrefs. Placeholders `/automation`, `/settings/rules`, `/settings/rules/[id]`, `/settings/rules/[id]/simulate`, `/settings/attributes`, `/cards/[id]/explain`. Aside still `hidden md:flex`. `pnpm verify` green (1672 tests).

### A6.2 — Project controls list

- [x] **A6.2** — `/projects/[id]/controls` DataTable; templates empty; `?ruleId=` highlight
  - **Files:**
    - `src/app/(app)/projects/[id]/controls/page.tsx` (replace `ComingSoonTab`)
    - `src/app/(app)/projects/[id]/controls/ProjectControls.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<ProjectControls />` only.
    2. `useParams().id`. `parseProjectControlsSearchParams` from `useSearchParams`. `useRules({ projectId: id, ...filter without ruleId })`. **No client-side refilter** of this table. `403` → `ErrorState` `error.message`. `NOT_FOUND` → `This project is not available.` Loading: `LoadingState`.
    3. Toolbar `flex flex-wrap gap-2`:
       - Enabled `Select`: `__all__` | `true` | `false` writing `projectControlsHref`.
       - `PermissionGate` `projectId={id}` `permission="control.edit"` `denialMessage={editControlsDenialMessage()}` wrapping `Button asChild` `Link` to `newProjectRuleHref(id)`. Always visible (disabled + tooltip when denied).
    4. If `total === 0` and not loading: `EmptyState` locked no-project-rules copy; actions `flex-wrap` of five `Link`s `newProjectRuleHref(id, 'A')` … `'E'`. `ComingSoonTab` gone.
    5. Else `DataTable` columns: `name` (`Link` to `ruleBuilderHref(row.id)` + `RuleSentence` `rule={{ name: undefined, when: row.when, then: row.then, else: row.else }}` so prose shows without repeating the heading), `priority` (text int), `enabled` (`Switch` gated `control.edit` → `useEnableRule().mutate({ id, input: { enabled } })`), `status` line: if no runs `neverRunMessage()` — `useRuleRuns({ ruleId: row.id, pageSize: 1 })` per row is N+1; **locked: skip per-row runs in A6.2.** Show enabled only. A6.7 history is the feed. `getRowId: (row) => row.id`. Pagination `mode: 'page'` from the response. `empty` locked copy. Do **not** restyle as cards. Do **not** add a second `overflow-x-auto`.
    6. If `filter.ruleId` matches a row id: `Alert` `This card was created by this rule.` (A5 deep-link) + `Link` `Edit in builder`. Row may use `className` ring; do not `hidden` others.
    7. Second list: `useRules({ page: 1, pageSize: 100 })` → `orgWideRules(items)` under heading `Org-wide rules that also apply`. Each name `Link` `ruleBuilderHref`. If that query 403s, omit the section (project list already showed the error).
    8. Do not fetch on the server. Do not call `useValidateRule` / `useSimulateRules` / `useCreateRule` except enable.
  - **Layout:** table scrolls **inside**; page does not. Toolbar wrap. Org-wide section stacks below. No `md:grid`. No Sheet. `RuleSentence` may wrap; cell `min-w-0`.
  - **Pattern:** A5.2 `src/app/(app)/cards/OrgCardList.tsx` (URL filters, `__all__` Select, page pagination). `DataTable` `src/components/patterns/DataTable.tsx`. `RuleSentence` `src/components/patterns/RuleSentence.tsx`. Hook: `useRules` / `useEnableRule` `src/client/hooks/useRules.ts` (B6 `ruleContracts.list` / `enable`). EmptyState F3.19. Workspace already wraps this page.
  - **Accept:** `pnpm verify`. This file tree has no `ComingSoonTab`. Changing enabled writes `?enabled=true` and does not client-filter a full unfiltered list. 375px and 768px: no page-level horizontal scrollbar; New / template Links / Enable / row Link reachable; table may scroll inside; `RuleSentence` not `hidden`. No `useValidateFormula`. No `eval(`.
  - **Notes:** Project controls DataTable with URL enabled filter, gated New, template empty state, `?ruleId=` Alert, org-wide section. `ComingSoonTab` gone. `pnpm verify` green (1672 tests).

### A6.3 — Org-wide rules list

- [x] **A6.3** — `/settings/rules` DataTable; URL filters `projectId` / `enabled`
  - **Files:**
    - `src/app/(app)/settings/rules/page.tsx` (replace placeholder)
    - `src/app/(app)/settings/rules/OrgRuleList.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<OrgRuleList />` only (`SettingsChrome` already wraps via layout).
    2. `parseRuleListSearchParams` → `useRules(filter)`. **No client-side refilter.** `403` → `ErrorState` `error.message`.
    3. Toolbar `flex-wrap`: Project `Select` from `useProjects({ page: 1, pageSize: 100 })` + `__all__`; Enabled `__all__`/`true`/`false`; New gated `PermissionGateView` `allowed={holdsControlEdit(activeOrgRole(me.memberships, orgId), permissions.projects)}` wrapping `Link` `newRuleHref()`. Use `useMe` + `usePermissions` + `useActiveOrg`.
    4. `DataTable` columns: `name` (`Link` `ruleBuilderHref` + `RuleSentence` without name), `scope` (`ORG` or project name via projects map), `priority`, `enabled` (`Switch` → `useEnableRule`). Pagination page mode. Empty: locked no-org-rules copy + template Links `newRuleHref('A')`…`E`.
    5. Do not implement the builder. Do not call simulate.
  - **Layout:** table scrolls inside; toolbar wrap. No `md:grid`. No Sheet.
  - **Pattern:** A6.2 + A3.8 `src/app/(app)/settings/access-reviews/AccessReviewList.tsx`. `activeOrgRole` `src/client/lib/projects.ts`. B6 `listRulesQuery`.
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; filters + New + row Link reachable; table may scroll inside. Settings tabs still wrap. `RuleSentence` visible on narrow.
  - **Notes:** Org rules DataTable with project/enabled URL filters, gated New, template empty. `pnpm verify` green (1672 tests).

### A6.4 — Rule builder (form + prose)

- [x] **A6.4** — `/settings/rules/[id]` trigger → condition → actions + `RuleSentence`; Save; no live simulate yet
  - **Files:**
    - `src/app/(app)/settings/rules/[id]/page.tsx` (replace placeholder)
    - `src/app/(app)/settings/rules/[id]/RuleBuilder.tsx` (`'use client'`)
    - `src/app/(app)/settings/rules/[id]/TriggerPicker.tsx` (`'use client'`)
    - `src/app/(app)/settings/rules/[id]/ConditionBuilder.tsx` (`'use client'`)
    - `src/app/(app)/settings/rules/[id]/ActionList.tsx` (`'use client'`)
  - **Do:**
    1. Server page renders `<RuleBuilder />` only.
    2. `useParams().id`. If `isNewRuleId(id)`: start from `parseTemplateParam` → `applyTemplate` or `emptyDraftRule`. Scope: if query `projectId` min 1 → `{ level: 'PROJECT', projectId }` except template D stays ORG. Else `{ level: 'ORG' }`.
    3. Else `useRules({ page: 1, pageSize: 100 })` → `findRuleById`. Missing after success → `ruleNotFoundMessage()`. `403` → `error.message`. Loading: `LoadingState`.
    4. Root `flex min-w-0 flex-col gap-6 md:flex-row`. **Form column** `min-w-0 flex-1 flex flex-col gap-4`: name `Input` max 200; description `Textarea` max 2000; scope `RadioGroup` ORG / PROJECT (PROJECT shows project `Select` from `useProjects`); priority `Input` (text, `parseIntInput`); `TriggerPicker`; `ConditionBuilder`; `ActionList` for `then` (min 1) and optional `else`.
    5. **Preview column** `min-w-0 flex-1`: heading `Rule` + `RuleSentence` `{ name, when, then, else }` from live draft. Match preview placeholder `<p className="text-sm text-muted-foreground">Live preview lands in A6.5.</p>` — **do not `hidden` this column on narrow** (it stacks below).
    6. `TriggerPicker`: Checkbox group of `RULE_TRIGGER_EVENTS` (checked = in `events[]`); optional schedule `Input` max 120; optional debounce `Input` (`parseIntInput`). At least one of events/schedule required before Save (disable Save otherwise).
    7. `ConditionBuilder` per policy §9. Attribute options from `attributeOptions(useAttributes({ page: 1, pageSize: 100 }).data?.items ?? [])`.
    8. `ActionList` per policy §10. Card picker: `useProjectCards(projectId, { page: 1, pageSize: 100 })` when PROJECT scope. Amount/currency Inputs are text. `FormulaHighlight` under each amount/expr field (display only).
    9. Action row `flex flex-wrap gap-2`: `PermissionGateView` `holdsControlEdit` wrapping `Save rule` → if new `useCreateRule().mutateAsync(toCreateRuleInput(draft))` then `router.replace(ruleBuilderHref(data.id))`; else `useUpdateRule({ id, input: toCreateRuleInput(draft) })` (send the mutable fields; omit `enabled`). Enable `Switch` on existing → `useEnableRule` (not PATCH). Delete existing → ConfirmDialog locked copy → `useDeleteRule` then `router.push(orgRulesHref())`. `Link` `Simulate` to `ruleSimulateHref(id)` **disabled** with `TODO(A6.6)` when `isNewRuleId` — **locked:** hide Simulate until saved (no href to `/new/simulate`).
    10. `422` → `applyServerErrorsFromApiError`. `403`/`409` → Alert `error.message`.
    11. Do **not** call `useValidateRule` / `useSimulateRules` / `useValidateFormula` in this task.
  - **Layout:** `flex-col md:flex-row` form \| preview. Both `min-w-0`. Buttons `flex-wrap`. No Sheet. Do not `hidden` `RuleSentence` below `md`.
  - **Pattern:** A3.4 `src/app/(app)/projects/[id]/people/add/AddMemberForm.tsx` (`flex-col md:flex-row` form + preview). Formula display: A4.4 `src/app/(app)/projects/[id]/budget/FormulaEditor.tsx` (`FormulaHighlight` + generation counter pattern — counter itself is A6.5). Combobox F3.4. B6 `createRuleInput` / `updateRuleInput` `src/shared/schemas/rule.ts`. `RuleSentence` F3.17. `applyServerErrorsFromApiError` `src/client/lib/forms/applyServerErrors.ts`.
  - **Accept:** `pnpm verify` and `pnpm test client/lib/rules`. Save on `new` POSTs `createRuleInput` (no `id`). PATCH payloads do not include `enabled`. 375px: form stacked **above** `RuleSentence`; Save reachable; no page-level horizontal scrollbar. 768px: form \| preview row. `RuleBuilder.tsx` (and siblings) do not contain `eval`, `useValidateFormula`, `parseFloat`, or `type="number"`. `ComingSoon` / placeholder text gone from `[id]/page.tsx`.
  - **Notes:** Builder form + `RuleSentence` preview; Save create/PATCH (no `enabled`); Simulate hidden until saved. `pnpm verify` green (1672 tests).

### A6.5 — Live validate + match preview

- [x] **A6.5** — Debounced `useValidateRule` + `useSimulateRules`; preview copy; autocomplete insert
  - **Files:**
    - `src/app/(app)/settings/rules/[id]/RuleBuilder.tsx` (edit — wire preview)
  - **Do:**
    1. Remove the A6.4 placeholder line.
    2. `useValidateRule` + `useSimulateRules`. `useRef` generation counter. `useEffect` on `JSON.stringify(toCreateRuleInput(draft))` (or a stable serialise of name/scope/trigger/when/then/else): wait `RULE_VALIDATE_DEBOUNCE_MS`; bump generation; `validate.mutate(toCreateRuleInput(draft))`. On success if `ok === false`, set errors and **do not** simulate. If `ok === true`, `simulate.mutate({ draftRule, projectId: draft.scope.projectId })`. Ignore stale generations.
    3. Preview column: `RuleSentence` then match preview `<p>` from `formatMatchPreview(matchPreviewFromSimulate(output, DRAFT_RULE_ID), m => …)` using `MoneyDisplay` is React — **locked:** call `formatMatchPreview` with a stub that returns `` `${m.currency} ${m.amount}` `` **or** split: show the sentence without money format in the helper and render `MoneyDisplay` beside it when `sampleLimit` set. Prefer: render the locked n=0 / n≥1-no-limit strings from the helper; when `sampleLimit` set, render: `With today's values, this rule matches {n} cards and would set the {interval} limit to ` + `<MoneyDisplay money={{ amount, currency }} />` + `.` so copy stays locked.
    4. Validate errors: list `{path}: {message}`.
    5. Attribute autocomplete: `flex flex-wrap gap-2` of Buttons that append the key to the focused formula field **or** to `expr` — if focus tracking is hard, insert into the last-edited amount/expr state. Do not evaluate.
    6. Keep last successful preview while pending. Do not blank `RuleSentence`.
    7. Still no `useValidateFormula`.
  - **Layout:** preview stays in the `md:flex-row` second column / stacked below. Do not `hidden` it. `min-w-0`.
  - **Pattern:** A4.4 `FormulaEditor.tsx` debounce + generation counter + `useValidateFormula` **replaced by** `useValidateRule` / `useSimulateRules` `src/client/hooks/useRules.ts`. B6 `validateRuleOutput` / `simulateRulesOutput`. F1: these mutations invalidate `[]`.
  - **Accept:** `pnpm verify`. `RuleBuilder.tsx` contains `useValidateRule` and `useSimulateRules` and `DRAFT_RULE_ID` and does **not** contain `useValidateFormula` or `eval`. 375px and 768px: match preview reachable by vertical scroll (not `hidden`); Save still reachable; no page-level horizontal scrollbar.
  - **Notes:** Debounced validate + simulate; match preview keeps last success; attribute key insert. `pnpm verify` green (1672 tests).

### A6.6 — What-if simulation

- [x] **A6.6** — `/settings/rules/[id]/simulate` side-by-side current vs simulated
  - **Files:**
    - `src/app/(app)/settings/rules/[id]/simulate/page.tsx` (replace placeholder)
    - `src/app/(app)/settings/rules/[id]/simulate/SimulateRule.tsx` (`'use client'`)
    - `src/app/(app)/settings/rules/[id]/RuleBuilder.tsx` (edit — enable Simulate `Link` for saved rules)
  - **Do:**
    1. If `isNewRuleId(id)` → `ErrorState` `Save the rule before opening simulation.`
    2. Load rule via `findRuleById` + `useRules({ page: 1, pageSize: 100 })` same as builder. `403` / missing as A6.4.
    3. Top: `Alert` `simulationHypotheticalMessage()` — **always**, before results.
    4. Overrides editor `flex flex-col gap-3`: add row (key Combobox from `attributeOptions`, subjectType Select, subjectId Input, value Input via `parseConditionValue`). List is local state `attributeOverrides`. Banner `These overrides are temporary.` (in addition to the Alert).
    5. `PermissionGateView` `holdsControlEdit` Button `Run simulation` → `useSimulateRules().mutate({ ruleIds: [id], projectId: rule.scope.projectId, attributeOverrides })`. Do not run on mount.
    6. Results: `grid grid-cols-1 gap-4 md:grid-cols-2`. Left heading `Current` — for each `cardDiffs[]`, `before.cardStatus` + `DiffView` left side only **or** locked: each card is one `DiffView {...cardDiffToDiffView(diff)}` spanning the grid cell on narrow and sitting in the **right** column on `md` as simulated. **Locked layout per spec:** left pane = current (`before`), right pane = simulated (`after`). Implement as: for each `diff` in `cardDiffs`, a `section` `min-w-0` containing card id (resolve nickName via `useProjectCards` when projectId else raw id) + inner `grid grid-cols-1 md:grid-cols-2` with `DiffView` **or** two stacks of key/values. Simplest locked: one `DiffView` per card (F3 already key-by-key before/after) **inside** the page grid so on narrow the next card stacks below — do not hide Current. Conflicts: `Alert` destructive `partialRunHeading()` + `conflicts[].message`. Runs: `StatusBadge kind="ruleRun"` (expect `DRY_RUN`) + `matched` text + `durationMs`.
    7. Empty `cardDiffs`: locked No card changes EmptyState.
    8. Back `Link` `ruleBuilderHref(id)` (`buttonVariants` + `Link`).
    9. Builder: Simulate `Link` enabled when saved.
  - **Layout:** page `grid-cols-1 md:grid-cols-2` for the two panes; each pane `min-w-0`. Hypothetical Alert stacks above. Overrides `flex-wrap` add button. Do not `hidden` either pane. No Sheet.
  - **Pattern:** A5.4 `DiffView` usage in `CardDetail.tsx`. `DiffView` `src/components/patterns/DiffView.tsx`. Hook: `useSimulateRules` `src/client/hooks/useRules.ts`. B6 `simulateRulesInput` `src/shared/schemas/ruleRun.ts`. `StatusBadge kind="ruleRun"` F3.10.
  - **Accept:** `pnpm verify`. `SimulateRule.tsx` contains `simulationHypotheticalMessage` / the locked Alert string and `useSimulateRules` and does not call `useValidateFormula`. 375px: Current stacks **above** Simulated; both reachable; Run reachable; no page-level horizontal scrollbar. 768px: two columns. `DRY_RUN` visible. No writes implied (no `useCreateRule` / `useUpdateRule` / `useEnableRule` on this page).
  - **Notes:** Hypothetical Alert always first; Run on click; Current/Simulated panes; DRY_RUN badge. `pnpm verify` green (1672 tests).

### A6.7 — Automation history

- [x] **A6.7** — `/automation` reverse-chronological `DataTable`; FAILED/PARTIAL prominent
  - **Files:**
    - `src/app/(app)/automation/page.tsx` (replace placeholder)
    - `src/app/(app)/automation/AutomationHistory.tsx` (`'use client'`)
  - **Do:**
    1. `parseRuleRunSearchParams` → `useRuleRuns(filter)`. Flatten `flattenRunPages(data.pages)`. **No client-side refilter.** `403` → `error.message`.
    2. Toolbar `flex-wrap` Selects writing `automationListHref`: rule (`useRules({ page: 1, pageSize: 100 })` name map + `__all__`), project (`useProjects` + `__all__`), card (text Input `cardId` — no card search endpoint; optional), status (`RuleRunStatus` + `__all__`). Do not invent extra query keys.
    3. `DataTable` columns: `startedAt` (`formatDate` `src/lib/dates.ts`), `rule` (`Link` `ruleBuilderHref(ruleId)` with name from rules map else raw id), `triggerEvent`, `matched` (`Yes`/`No`), `status` (`StatusBadge kind="ruleRun"`), `durationMs` (`{n} ms`), `conflicts` (if `isProminentRunStatus`, show `failureReason` / `skipReason` / first `conflicts[].message` in the cell — do not truncate without `title`). `getRowId: (row) => row.id`. Pagination `mode: 'cursor'` `nextCursor: hasNextPage ? 'next' : null` `onLoadMore` `fetchNextPage` (A5.8 sentinel). Empty: title `No rule runs yet` / description `When a rule evaluates, the run appears here.`
    4. Expand/detail: clicking a row navigates to… there is no `/automation/[id]` in the spec. **Locked:** row click opens F3 `Sheet` `side="right"` with `useRuleRun(id)`: inputs as `AttributeValue` list (stale flagged), `matched`, `DiffView` per `diff.cards[]` via `cardDiffToDiffView`, `actions[]` (`action` + `status` + `message`), conflicts verbatim, `skipReason` / `failureReason`. Sheet body `min-w-0 flex flex-col gap-4`.
    5. FAILED/PARTIAL: `Alert` above the table if the **current page** has any prominent status — actually that hides later pages. **Locked:** prominence is the status badge + conflict column, not a page-level Alert. Sheet still shows the destructive Alert when that run is prominent.
    6. Gate the page with `holdsControlEdit`; if false, still render the table attempt (API 403 is the source of truth) — same as other lists.
  - **Layout:** table scrolls inside; toolbar wrap. Sheet vs wrap. No page `md:grid`. Do not restyle as a card feed.
  - **Pattern:** A5.8 `CardDetail.tsx` infinite table sentinel `'next'`. A3.8 filters. Hook: `useRuleRuns` / `useRuleRun` `src/client/hooks/useRules.ts` (B6 `ruleRunContracts.list` / `get`). `AttributeValue` F3.13. `StatusBadge kind="ruleRun"`.
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; filters + Load more + row/Sheet reachable; table may scroll inside; PARTIAL `conflicts[].message` readable in the Sheet (not `hidden`). `DRY_RUN` is a filter option but live history from evaluate will be SUCCESS/PARTIAL/FAILED/SKIPPED.
  - **Notes:** Infinite rule-run table; FAILED/PARTIAL in status + Sheet. `pnpm verify` green (1672 tests).

### A6.8 — Attribute registry

- [x] **A6.8** — `/settings/attributes` built-ins + custom CRUD + MANUAL values
  - **Files:**
    - `src/app/(app)/settings/attributes/page.tsx` (replace placeholder)
    - `src/app/(app)/settings/attributes/AttributeRegistry.tsx` (`'use client'`)
    - `src/app/(app)/settings/attributes/AttributeValueSheet.tsx` (`'use client'`)
  - **Do:**
    1. Built-in heading + `ul` of `BUILTIN_ATTRIBUTE_KEYS` (`key` + `label` + `scope`). Read-only. No `useAttributes` for these.
    2. Custom heading + `parseAttributeListSearchParams` → `useAttributes(filter)`. Toolbar wrap: scope/source Selects + `Create attribute` gated `holdsControlEdit`.
    3. Create `Dialog`: fields `key` (max 120, helper `campaign.roas`), `label` max 120, `type` Select, `scope` Select, `source` Select `MANUAL` | `WEBHOOK` | `CONNECTOR` (**not** COMPUTED), conditional: ENUM → `enumValues` comma list min 1; WEBHOOK → `webhookSecret` `Input` `type="password"` min 16 + locked write-only helper; CONNECTOR → Select only `campaign-analytics` + `refreshIntervalSec` text int. Submit `useCreateAttribute`. `409` duplicate key → Alert server message.
    4. `DataTable` custom rows: key, label, type, source, `hasWebhookSecret` (`Yes`/`No`), actions `Values` opens Sheet; WEBHOOK rotate secret `Input` + PATCH `webhookSecret`.
    5. `AttributeValueSheet`: `useAttributeValues({ key, page: 1, pageSize: 100 })`. Each item `AttributeValue` (`value`, `observedAt`, `ttlSec`, `label: subjectType + subjectId`). MANUAL: form subjectType Select, subjectId Input, value Input (`parseConditionValue`) → `useSetAttributeValue`. WEBHOOK: locked ingest helper, no ingest POST. CONNECTOR: show `refreshIntervalSec` + locked copy that values refresh on that interval — no fetch button (no client connector hook).
    6. Do not list computed values from Airwallex. Do not call ingest.
  - **Layout:** stack. Table scrolls inside. Dialog stacked fields. Sheet `side="right"` `min-w-0`. Toolbar wrap. No `md:grid` of built-ins vs custom (stack).
  - **Pattern:** A3.6 create-role Dialog. A3.5 Edit Sheet. Hooks: `useAttributes` / `useCreateAttribute` / `useUpdateAttribute` / `useAttributeValues` / `useSetAttributeValue` `src/client/hooks/useRules.ts`. B6 `src/shared/schemas/attribute.ts`. `AttributeValue` F3.13.
  - **Accept:** `pnpm verify`. Create payload never includes `source: 'COMPUTED'`. Grep these files: no `ingest`, no `x-allocard-attribute-secret`. 375px and 768px: Create / Values / Save value reachable; Sheet does not force window sideways scroll; built-in list not `hidden`. Stale values show F3 `Stale ·`.
  - **Notes:** Built-in catalogue + custom CRUD; MANUAL values Sheet; no ingest. `pnpm verify` green (1672 tests).

### A6.9 — Card explainer

- [x] **A6.9** — `/cards/[id]/explain` governing rules, attributes, merge; detail Link
  - **Files:**
    - `src/app/(app)/cards/[id]/explain/page.tsx` (replace placeholder)
    - `src/app/(app)/cards/[id]/explain/CardExplain.tsx` (`'use client'`)
    - `src/app/(app)/cards/[id]/CardDetail.tsx` (edit — add `Why this limit?` Link)
  - **Do:**
    1. `useParams().id`. `useCardExplain(id)`. `403` → `error.message`. `NOT_FOUND` → `This card is not available.` Loading: `LoadingState`.
    2. Heading `Why this limit?`. Final: `StatusBadge kind="card"` is **not** for `DesiredCardStatus` — render `finalStatus` as text/`Badge`. Limits: `finalControls.transactionLimits.limits[]` as `LimitMeter` **cannot** be used (no `remaining`). **Locked:** `MoneyDisplay` per interval amount + currency; allowlists as comma text or `Unconstrained` when `null`.
    3. `Governing rules`: each `governingRules[]` — `name` `Link` `ruleBuilderHref(ruleId)` (and `ruleHref(projectId, ruleId)` when `projectId` min 1), `matched` Yes/No, `priority`, contribution JSON-via `DiffView` `{ before: {}, after: contribution ?? {} }` or a `<pre className="whitespace-pre-wrap break-all">` of `JSON.stringify(contribution)` — **locked:** `DiffView` `{ before: null, after: contribution ?? null }`. Unmatched rules still listed (they govern by existing in scope).
    4. Attributes: each `attributeValues[]` as `AttributeValue` (stale flagged). Do not hide stale.
    5. Heading `How rules merged`: each `merge[]` — `field`, `strategy`, contributions (`ruleName` + `priority` + `String(value)`), `result`. This **must** render on narrow (stack `flex flex-col gap-3`). Conflicts: destructive Alert + `message`.
    6. If `lastRuleRunId`: `Link` to `/automation?ruleId=` is wrong (filter is run list by rule not run id). **Locked:** text `Last evaluated {formatDate(lastEvaluatedAt)}` + Button opening… skip navigation to a missing run route; show `lastRuleRunId` as text.
    7. Detail page: `Link` `className={buttonVariants({ variant: 'outline' })}` `href={cardExplainHref(id)}` label `Why this limit?` in the rule-created / limits section. Always visible. `card.view` is implied by seeing detail; do not hide on narrow.
    8. Back `Link` `cardHref(id)` from A5.0.
    9. Do not call `usePanToken`. Do not fetch on the server.
  - **Layout:** stack. No `md:grid` that hides merge. `min-w-0`. `break-all` on long formula results. No Sheet. Actions wrap.
  - **Pattern:** A5.4 `CardDetail.tsx`. Hook: `useCardExplain` `src/client/hooks/useRules.ts`. B6 `cardExplainSchema` `src/shared/schemas/ruleRun.ts`. `LimitMeter` is the wrong remaining source — `MoneyDisplay` F3.10. `AttributeValue` F3.13. `DiffView` F3.18.
  - **Accept:** `pnpm verify`. `CardExplain.tsx` contains `useCardExplain` and the merge heading and does not contain `usePanToken` / `cvv` / `card_number`. 375px and 768px: no page-level horizontal scrollbar; Why this limit? (detail) + merge section reachable by vertical scroll (not `hidden`). `CardDetail.tsx` has the outline Link.
  - **Notes:** `useCardExplain` + stacked merge; `MoneyDisplay` limits; `DiffView` contributions; outline `Why this limit?` on detail. No `usePanToken`. `pnpm verify` green (1672 tests).

### A6.10 — Wizard link

- [x] **A6.10** — Controls deferred step points at project controls
  - **Files:**
    - `src/app/(app)/projects/new/steps/DeferredStep.tsx` (edit)
    - `src/app/(app)/projects/new/ProjectWizard.tsx` (edit — pass `draftId` if needed)
  - **Do:**
    1. Extend `DeferredStep` props with optional `href?: string` and `linkLabel?: string`. When `phase === 'A6'` **and** `draftId.length >= 1`, pass `href={controlsHref(draftId)}` `linkLabel={wizardControlsLinkMessage()}`.
    2. Render `Link` `className={buttonVariants({ variant: 'outline' })}` — prefer `buttonVariants` + `Link`, not `Button asChild`.
    3. Keep the existing `Alert` `{title} land in {phase}.` Members/Roles/Approval rules unchanged (no href).
    4. Do **not** embed the rule builder in the wizard. Do **not** change Launch.
  - **Layout:** one column (already). No Sheet. No `md:grid`.
  - **Pattern:** A5.9 `src/app/(app)/projects/new/steps/CardStructureStep.tsx`. `controlsHref` `src/client/lib/cards.ts`. `DeferredStep` current file.
  - **Accept:** `pnpm verify`. 375px and 768px: wizard Next and the new Link reachable; no page-level horizontal scrollbar. Members deferred step still has no extra Link.
  - **Notes:** Controls deferred step outline Link to `controlsHref`; Members/Roles/Approval unchanged. `pnpm verify` green (1672 tests).

### A6.11 — Don’t-break + invariant proofs

- [x] **A6.11** — No client parser, unclamped money, 375/768, shell unchanged
  - **Files:**
    - `src/client/lib/rules.test.ts` (extend)
    - `src/client/lib/projects.test.ts` (assert `WORKSPACE_TAB_HREFS` still six, still includes `/controls`, still no settings; SETTINGS_NAV is the four hrefs from A6.1)
    - `src/client/lib/access.test.ts` (SETTINGS_NAV four hrefs — already updated in A6.1; re-assert)
    - screens listed above — **read only** unless a §13 string or layout class is missing
  - **Do:**
    1. Assert `parseFormulaOrInt` does not `parseFloat` (`'1.02'` is the string `'1.02'` because it is **not** `/^-?\d+$/` — wait: `1.02` has a dot so it stays a formula/string; `'412'` is int). Add this case explicitly.
    2. Assert templates: no `now()`, D has `activeToOffsetDays: 7`, C amounts are minor-unit scale (`200000`).
    3. Assert `parseCommaList('') === null`.
    4. Assert `holdsControlEdit` OWNER vs MEMBER without permission.
    5. Assert `matchPreviewFromSimulate` unmatched → locked n=0 sentence via `formatMatchPreview`.
    6. Grep A6 screen files (`src/app/(app)/projects/[id]/controls`, `src/app/(app)/settings/rules`, `src/app/(app)/settings/attributes`, `src/app/(app)/automation`, `src/app/(app)/cards/[id]/explain`): no `eval(`, no `new Function`, no `useValidateFormula`, no `useSimulatePurchase`, no `attributeContracts.ingest` / `useIngest`, no `type="number"`, no `parseFloat`. PAN scan: no `cvv`, `card_number`, `\bPAN\b` (same style as A5.10).
    7. Confirm `(app)/layout.tsx` still `requireApp()` + `AppShellFrame`. Confirm `AppShell.tsx` aside class still includes `hidden` and `md:flex`. Confirm `DEFAULT_NAV` includes `/automation` after `/activity` and Rules/Attributes after Access reviews.
    8. Confirm `WORKSPACE_TAB_HREFS` length 6 and Controls href still `/projects/${id}/controls`.
    9. Manual don’t-break: project controls, org rules, builder, simulate, automation, attributes, explainer, wizard controls step at 375px and 768px.
  - **Layout:** n/a (proof) plus the manual resize check.
  - **Pattern:** A5.10 `src/client/lib/cards.test.ts`. A4.9 `src/client/lib/budget.test.ts`. A3.9 `src/client/lib/access.test.ts`.
  - **Accept:** `pnpm test client/lib/rules` and `pnpm test client/lib/projects` and `pnpm test client/lib/access` and `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar on project list (New + templates + Enable), org list, builder (`RuleSentence` + match preview stacked, not hidden), simulate (both panes + hypothetical Alert), automation (filters + Sheet), attributes (Create + Sheet), explainer (merge reachable), wizard (Next + controls Link); Menu/Sheet still works below `md`; tables may scroll inside.
  - **Notes:** Helper proofs (`1.02` stays a string, templates, empty allowlist null, OWNER vs MEMBER, unmatched n=0). Screen grep: no eval/parser/ingest/`type="number"`/PAN. Shell still `hidden md:flex`; Automation after Activity. `pnpm verify` green (1682 tests). STOP before phase exit.

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Spec’s review checklist in `A6-controls-automation.md` signed off:
  - [ ] Rules read as prose, not just as forms
  - [ ] The live match preview works and is accurate
  - [ ] Simulation is unmistakably hypothetical
  - [ ] Simulation output matches what a real run would apply
  - [ ] Automation history makes failures and conflicts prominent
  - [ ] The card explainer genuinely explains, including the merge
  - [ ] No formula or DSL parsing happens client-side
  - [ ] 375px and 768px: no page-level horizontal scrollbar; builder, simulate, and explainer content all reachable (stacked, not hidden)
- [ ] `/dev/shell` still works (unchanged collapse)
- [ ] No new F3 primitive files
- [ ] No `call()` / `fetch` / `@/server` in `'use client'` screens
- [ ] `STATUS.md` updated with the next phase (**A7**)

## Out of scope (do not do in A6)

- AppShell collapse / second nav (A2.1)
- `/projects/[id]/settings` or a seventh workspace tab
- `GET /api/rules/:id` or any new/changed B6 contract
- `useValidateFormula` / `@/server/lib/formula` / `eval` / a JSON rule editor
- `useSimulatePurchase` / remote-auth decide
- `POST /api/attributes/ingest` from the browser
- Create-card form on A5 screens / typing live `transactionLimits` on a card (formulas in **rules** are in scope)
- Approval-rule matrix (A7)
- Activity feed (A8)
- Editing `invalidationMap.ts` / F1 hooks / B6 contracts
- `@testing-library/react`
- `sm:` / `lg:` / `xl:` / `2xl:` on A6 screens
- Importing `DomainEventType` or `BUILTIN_ATTRIBUTE_DEFINITIONS` from `src/server`
