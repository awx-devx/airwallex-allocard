# F1 — Data Layer (TanStack Query)

**Track:** Client foundation · **Depends on:** F0 · **Powers:** all of Track A

## Goal

Every endpoint the backend exposes gets exactly one hook. By the end of this phase, no screen ever needs to think about fetching, caching, or invalidation — it calls a hook.

## Deliverables

### Query key factory

One file, one authority. Ad-hoc key arrays scattered through hooks is how cache invalidation quietly stops working.

```ts
// src/client/queryKeys.ts
export const qk = {
  me:            () => ['me'] as const,
  permissions:   () => ['me', 'permissions'] as const,

  projects:      (f?: ProjectFilter) => ['projects', f ?? {}] as const,
  project:       (id: string)        => ['projects', id] as const,
  projectMembers:(id: string)        => ['projects', id, 'members'] as const,
  budget:        (id: string)        => ['projects', id, 'budget'] as const,
  budgetEntries: (id: string, f?: EntryFilter) => ['projects', id, 'budget', 'entries', f ?? {}] as const,

  cards:         (f?: CardFilter)    => ['cards', f ?? {}] as const,
  card:          (id: string)        => ['cards', id] as const,
  cardLimits:    (id: string)        => ['cards', id, 'limits'] as const,
  cardExplain:   (id: string)        => ['cards', id, 'explain'] as const,

  rules:         (f?: RuleFilter)    => ['rules', f ?? {}] as const,
  ruleRuns:      (f?: RunFilter)     => ['ruleRuns', f ?? {}] as const,
  attributes:    ()                  => ['attributes'] as const,

  requests:      (f?: RequestFilter) => ['requests', f ?? {}] as const,
  approvals:     ()                  => ['approvals'] as const,
  approvalCount: ()                  => ['approvals', 'count'] as const,

  transactions:  (f?: TxFilter)      => ['transactions', f ?? {}] as const,
  activity:      (id?: string)       => ['activity', id ?? 'org'] as const,
  audit:         (f?: AuditFilter)   => ['audit', f ?? {}] as const,
} as const
```

Hierarchical prefixes are deliberate: invalidating `['projects', id]` clears that project's members, budget, and cards in one call.

### Hooks, one per endpoint

Grouped by domain, mirroring the backend phases:

| File | Covers |
| --- | --- |
| `useSession.ts` | `me`, permissions, onboarding status |
| `useOrganizations.ts` | Org CRUD, members, invites |
| `useProjects.ts` | List, detail, create, update, transition, workstreams |
| `useMembers.ts` | Project members, roles, scopes, **permission preview** |
| `useBudget.ts` | Budget, categories, entries, change requests, formula validation |
| `useCards.ts` | Cards, limits, lifecycle actions, PAN token |
| `useRules.ts` | Attributes, rules, validate, **simulate**, rule runs, card explain |
| `useRequests.ts` | Requests, policy preview, approvals queue |
| `useTransactions.ts` | Transactions, declines, receipts |
| `useReports.ts` | Activity, audit, exports, closure |

Naming: `useProjects()` / `useProject(id)` for queries, `useCreateProject()` / `useUpdateProject()` for mutations. No exceptions — predictability is the point.

### Invalidation map

Every mutation declares what it invalidates, in one reviewable table rather than buried in each hook. This is the artefact most worth reviewing carefully in this phase, because a missing entry produces a stale screen that looks like a backend bug.

| Mutation | Invalidates |
| --- | --- |
| `useCreateProject` | `projects()` |
| `useTransitionProject` | `project(id)`, `projects()`, `activity(id)` |
| `useAddMember` | `projectMembers(id)`, `project(id)`, `permissions()` |
| `useUpdateMemberRole` | `projectMembers(id)`, `permissions()`, `cards()` |
| `useSetBudget` | `budget(id)`, `project(id)`, `cards()` — limits may move |
| `useDecideChangeRequest` | `budget(id)`, `budgetEntries(id)`, `cards()` |
| `useCreateCard` | `cards()`, `project(id)` |
| `useFreezeCard` / `useUnfreezeCard` / `useCloseCard` | `card(id)`, `cards()` |
| `useUpdateCardControls` | `card(id)`, `cardLimits(id)`, `cardExplain(id)` |
| `useSaveRule` | `rules()`, `cards()`, `cardExplain(*)` |
| `useSetAttributeValue` | `attributes()`, `cards()`, `ruleRuns()` |
| `useDecideRequest` | `requests()`, `approvals()`, `approvalCount()`, `budget(id)`, `cards()` |
| `useUploadReceipt` | `transactions()` |

Note how often `cards()` appears. In this product almost any change can move a card limit, and being liberal with card invalidation is correct — a stale limit on screen undermines the entire premise.

### Query defaults

```ts
{ staleTime: 30_000, gcTime: 5 * 60_000, retry: (n, e) =>
    e instanceof ApiError && e.status >= 500 && n < 2,
  refetchOnWindowFocus: true }
```

Never retry a `4xx`. Per-hook overrides worth setting: card limits ~15s, approval count ~30s with polling, rule runs ~10s while a run is in flight, and attribute values short since staleness is meaningful.

### Special cases

- **Simulation** (`useSimulateRules`) is a mutation, not a query — it takes overrides and must never be cached.
- **Exports** stream a file; use a direct download rather than a query.
- **Infinite queries** for activity, transactions, audit, and rule runs, matching B9's cursor pagination.
- **Optimistic updates** only for freeze/unfreeze and receipt attach. Everything touching money or permissions waits for the server — an optimistically-shown limit that the server then rejects is worse than a spinner.

## Review checklist

- [ ] Exactly one hook per endpoint; nothing calls `call()` directly from a screen
- [ ] Every hook's types derive from the contract, with no manual annotations
- [ ] The invalidation map is complete — walk every mutation against it
- [ ] No `4xx` is retried
- [ ] Infinite queries match the backend's cursor semantics
- [ ] Optimistic updates are limited to the two safe cases and roll back on error
- [ ] Removing an endpoint from a contract breaks the build in its hook

## Out of scope

Components (F3), screens (Track A), realtime/WebSocket updates — polling is sufficient for the demo.
