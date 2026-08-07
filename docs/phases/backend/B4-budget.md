# B4 — Budget Ledger

**Track:** Backend · **Depends on:** B3 · **Powers:** A4, and every rule in B6

## Goal

Budget as an append-only ledger with derived balances. This is the primary cost driver the rules engine reads, so its correctness determines whether card limits are right.

## Deliverables

### Models

| Model | Notes |
| --- | --- |
| `Budget` | orgId, projectId, currency, approvedAmount, `formula?`, categories[{ id, name, workstreamId?, allocated, formula? }] |
| `BudgetEntry` | orgId, projectId, categoryId?, type, amount, currency, sourceType, sourceId, `lifecycleId?`, createdBy, note |
| `BudgetChangeRequest` | orgId, projectId, requestedBy, deltaAmount, reason, status, decidedBy, decidedAt |

Entry types: `APPROVAL`, `COMMITMENT`, `ACTUAL`, `RELEASE`, `ADJUSTMENT`.

**Nothing mutates a balance.** Every change appends an entry. This is what makes the budget auditable and what lets B8 correct an over-commitment without losing the history.

### Projection

```
approved  = Σ(APPROVAL) + Σ(ADJUSTMENT)
committed = Σ(COMMITMENT) − Σ(RELEASE)
actual    = Σ(ACTUAL)
remaining = approved − committed − actual
```

Recompute on every ledger write and store the result on `Project.budgetSnapshot` and in Redis at `budget:project:{id}`. **Never sum the ledger on the hot path** — B6 reads `remaining` on every rule evaluation and B8 reads it inside the 2.5s remote-auth budget.

Include a `pnpm budget:verify` script that recomputes from entries and compares against snapshots. Run it in CI. A drifting projection is the kind of bug that stays invisible until a demo.

### `lifecycleId` on entries

B8 needs to release a commitment when its authorization clears or expires. That requires finding the original commitment, so `lifecycleId` is on the entry from day one even though nothing populates it until B8. Retrofitting it later means a migration over live ledger data.

### Formula evaluation

`lib/formula/` lands here because category allocations may be expressions. B6 extends the same parser with attribute resolution.

Scope for B4: arithmetic, `min`, `max`, `round`, `floor`, `ceil`, `clamp`, `pct`, and identifiers resolving to sibling budget fields. Sandboxed — no `eval`, no property access, a node-count cap, a timeout. Amounts are integer minor units throughout; the parser must not introduce floats.

### Thresholds

Emit `budget.threshold_crossed` when `utilisationPct` crosses a configured boundary, with crossing detected against the previous snapshot rather than the current value. Firing on every write while merely *above* a threshold is what turns B6's rules into a notification storm.

## Endpoints

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/projects/:id/budget` | `budget.view` | Budget, categories, live projection |
| `PUT` | `/api/projects/:id/budget` | `budget.edit` | Set approved amount and currency; appends `APPROVAL` |
| `GET` | `/api/projects/:id/budget/categories` | `budget.view` | |
| `POST` | `/api/projects/:id/budget/categories` | `budget.edit` | Fixed amount or formula |
| `PATCH` | `/api/projects/:id/budget/categories/:catId` | `budget.edit` | |
| `DELETE` | `/api/projects/:id/budget/categories/:catId` | `budget.edit` | Rejected if entries reference it |
| `GET` | `/api/projects/:id/budget/entries` | `budget.view` | Paginated, filterable by type and date |
| `POST` | `/api/projects/:id/budget/entries` | `budget.edit` | Manual `ADJUSTMENT` only; other types are system-written |
| `GET` | `/api/projects/:id/budget/history` | `budget.view` | Change history with actor and reason |
| `POST` | `/api/projects/:id/budget/change-requests` | `budget.request` | |
| `GET` | `/api/projects/:id/budget/change-requests` | `budget.view` | |
| `POST` | `/api/budget/change-requests/:id/decide` | `budget.edit` | Approve or reject; approval appends `ADJUSTMENT` |
| `POST` | `/api/budget/formula/validate` | `budget.edit` | Parses and dry-evaluates; powers inline UI validation |

The API refuses to write `COMMITMENT` or `ACTUAL` directly — those come only from B7 and B8. Enforce it in the service, not by convention.

## Events

`budget.approved`, `budget.updated`, `budget.threshold_crossed`

## Tests

Beyond the standard matrix:

- Projection correctness across a long mixed sequence of entry types
- `remaining` never silently goes negative — over-commitment is allowed but flagged
- A `RELEASE` correctly offsets its matching `COMMITMENT` via `lifecycleId`
- Snapshot equals a from-scratch recomputation after every write (property-style test over random sequences)
- Threshold events fire on crossing only, not while merely above
- Category allocations summing beyond the project total are rejected, or flagged per a stated policy
- Formula parser: precedence, each allowlisted function, division by zero, unknown identifier, oversized expression, attempted property access, attempted `eval`
- Money arithmetic stays integral — no float creeps in through a formula
- Concurrent entry writes to one project produce a correct final projection (use a per-project lock)

## Review checklist

- [ ] No code path mutates a balance directly
- [ ] `lifecycleId` exists on `BudgetEntry` even though B8 populates it
- [ ] Snapshot and Redis cache update within the same unit of work as the entry
- [ ] `pnpm budget:verify` exists and runs in CI
- [ ] The formula parser cannot execute arbitrary code — review the allowlist adversarially
- [ ] `COMMITMENT` and `ACTUAL` are unreachable from the public API
- [ ] Threshold crossing is edge-triggered
- [ ] All amounts are integer minor units end to end

## Out of scope

Commitments from purchase requests (B7), actuals from transactions (B8), attribute-driven budget formulas (B6).
