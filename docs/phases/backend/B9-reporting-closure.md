# B9 — Activity, Audit, Reports & Closure

**Track:** Backend · **Depends on:** B8 · **Powers:** A9

## Goal

Everything that reads across the domains built so far, plus the orchestrated project shutdown. Mostly query work — but the closure flow is a real state machine and deserves the same care as B2's.

## Deliverables

### Activity feed

A unified, paginated feed merging transactions, purchase requests, approvals, card mutations, access changes, and rule runs. Cursor-based pagination, not offset — the feed grows at the head and offset pagination will skip and duplicate rows.

Filterable by type, actor, date range, and project. Scope-aware: `OWN` scope sees only the caller's own items.

### Audit queries

`auditLogs` has been written since B0. This phase exposes it: filter by subject, actor, action, and date range, with the before/after diff rendered per entry. Include actor type so rule-driven changes are distinguishable from human ones — "who changed this limit?" answered with "a rule, and here's the run" is the point of the whole system.

### Exports

CSV for budget, card activity, transactions, and access & audit. Stream rather than buffer — an export that loads a year of transactions into memory will take down the `web` service.

Exports run scope-filtered, and every export writes an audit entry recording what was extracted and by whom.

### Access reviews

Surface elevated or stale access: scopes past `validTo`, members inactive for N days, anyone holding elevated permissions flagged by a B6 rule. Resolve by confirming or revoking, with the decision audited.

### Project closure

An orchestrated flow, not a status flip:

```
1. Pre-flight     open transactions, pending authorizations, pending requests,
                  active cards, active access — surfaced for review, blocking
2. Freeze         all project cards → INACTIVE
3. Settle         wait for pending authorizations to clear or expire
4. Revoke         remove spending permissions, expire access scopes
5. Close cards    → CLOSED (terminal, irreversible, explicit confirmation)
6. Final report   budget vs actual, transaction summary, access history
7. Archive        project → ARCHIVED, read-only
```

Steps 3 and 5 are the sharp edges. A cancelled card still processes already-authorized, uncleared transactions, so closure must tolerate a transaction arriving *after* the card is closed. And because `CLOSED` is irreversible, step 5 requires explicit confirmation and must never be reachable from an automated rule without `allowDestructive`.

Make each step resumable. A closure interrupted between steps 3 and 5 must be restartable without redoing 1 and 2.

## Endpoints

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/projects/:id/activity` | `transaction.view` scoped | Unified feed, cursor paginated |
| `GET` | `/api/activity` | `transaction.view` | Org-wide |
| `GET` | `/api/audit` | `member.manage` | Filterable, with diffs |
| `GET` | `/api/projects/:id/audit` | `member.manage` | |
| `POST` | `/api/exports/budget` | `report.export` | Streams CSV |
| `POST` | `/api/exports/transactions` | `report.export` | |
| `POST` | `/api/exports/cards` | `report.export` | |
| `POST` | `/api/exports/audit` | `report.export` | |
| `GET` | `/api/reports/project/:id` | `report.export` | Budget vs actual, spend by category and member |
| `GET` | `/api/reports/organization` | `report.export` | Cross-project rollup |
| `GET` | `/api/projects/:id/closure/preflight` | `project.close` | Blocking items |
| `POST` | `/api/projects/:id/closure/start` | `project.close` | Enters `CLOSING`, freezes cards |
| `GET` | `/api/projects/:id/closure/status` | `project.close` | Per-step progress |
| `POST` | `/api/projects/:id/closure/complete` | `project.close` | Closes cards, generates report, archives |
| `GET` | `/api/projects/:id/report/final` | `project.view` | Post-closure |

## Events

`project.closing`, `project.closed`, `project.archived`

## Tests

Beyond the standard matrix:

- The activity feed merges all sources in correct chronological order
- Cursor pagination is stable when new items arrive at the head mid-scroll
- `OWN` scope filters the feed to the caller's own items
- Audit entries distinguish rule actors from human actors
- Exports stream rather than buffer — assert memory does not scale with row count
- Every export writes an audit entry
- Closure pre-flight blocks on each blocking condition independently
- Closure is resumable from any interrupted step
- A transaction arriving after card closure is still recorded and reconciled
- Closing cards requires explicit confirmation and cannot be triggered by a rule
- An archived project rejects every mutation
- The final report's totals reconcile against the budget ledger

## Review checklist

- [ ] Cursor pagination, not offset, on every feed
- [ ] Exports stream and are scope-filtered
- [ ] Audit distinguishes actor types and renders a usable diff
- [ ] Closure is a resumable state machine, not a status flip
- [ ] Card closure is irreversible, confirmed, and never rule-triggered
- [ ] Post-closure transactions are handled without error
- [ ] Final report totals tie back to the ledger — run `budget:verify` against a closed project

## Out of scope

Scheduled report delivery, ERP write-back, PDF generation, data retention and purge policy.
