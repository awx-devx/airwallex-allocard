# B2 — Projects

**Track:** Backend · **Depends on:** B1 · **Powers:** A2

## Goal

Full project lifecycle as an API: create a draft, configure it, move it through approval and launch, and eventually close it. The setup *wizard* is a client concern (A2); the backend exposes the pieces it saves.

## Deliverables

### Model

```
Project { orgId, name, code, description, status, ownerId, costCentre,
          startDate, endDate, workstreams[{ id, name }],
          cardStructure { shared, perMember, vendor, oneTime },
          approvedAt?, launchedAt?, closedAt? }
```

Unique on `(orgId, code)`. Indexes on `(orgId, status, updatedAt)` and `(orgId, ownerId)`.

### Lifecycle

```
DRAFT → PENDING_APPROVAL → ACTIVE → CLOSING → CLOSED → ARCHIVED
  └──────────────────────────► CANCELLED
```

Implement as a pure function, not scattered `if` statements:

```ts
canTransition(from: ProjectStatus, to: ProjectStatus): TransitionResult
```

Guards worth enforcing:

- `DRAFT → PENDING_APPROVAL` requires a name, dates, an owner, and a budget (a soft check in B2, hard once B4 lands)
- `→ ACTIVE` is what emits `project.launched`, which B6 rules key off. Getting this event right matters more than anything else in this phase.
- `→ CLOSING` is blocked while cards are active (a no-op until B5)
- `CLOSED` and `ARCHIVED` are terminal

### Wizard support

The client saves the wizard step by step against a `DRAFT` project, so `PATCH` must accept partial updates and must not require a complete project until the transition to `PENDING_APPROVAL`. Validation is therefore two-tier: a permissive `updateProjectInput` and a strict `projectReadyForApproval` refinement applied only at transition time.

## Endpoints

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/projects` | `project.view` | Filter by status, owner, cost centre; paginated; sortable |
| `POST` | `/api/projects` | `project.create` | Creates a `DRAFT` |
| `GET` | `/api/projects/:id` | `project.view` | Includes counts the overview needs |
| `PATCH` | `/api/projects/:id` | `project.edit` | Partial; rejects fields not editable in the current status |
| `POST` | `/api/projects/:id/transition` | varies by target | `{ to, reason? }`; the single mutation for status |
| `GET` | `/api/projects/:id/workstreams` | `project.view` | |
| `POST` | `/api/projects/:id/workstreams` | `project.edit` | |
| `PATCH` | `/api/projects/:id/workstreams/:wsId` | `project.edit` | |
| `DELETE` | `/api/projects/:id/workstreams/:wsId` | `project.edit` | Rejected if budget categories reference it (B4) |
| `PATCH` | `/api/projects/:id/owner` | `project.edit` | Change owner; separate for audit clarity |
| `GET` | `/api/projects/:id/history` | `project.view` | Status and field change history from audit |

**One transition endpoint, not five.** `POST /:id/submit`, `/approve`, `/launch` and friends duplicate the guard logic and invite drift. A single endpoint taking a target status keeps `canTransition` the only authority.

## Events

`project.created`, `project.approved`, `project.launched`, `project.closing`, `project.closed`

## Tests

Beyond the standard matrix:

- The full transition matrix: every `(from, to)` pair, valid and invalid
- An invalid transition returns `409 CONFLICT` and does not mutate
- `PATCH` on a `CLOSED` project is rejected
- Duplicate `code` within an org fails; the same code in a different org succeeds
- Transitioning to `PENDING_APPROVAL` without required fields fails with field-level errors
- `project.launched` is emitted exactly once, even if the transition endpoint is called twice concurrently
- Deleting a workstream referenced elsewhere is rejected
- Pagination is stable across pages with equal sort keys

## Review checklist

- [ ] `canTransition` is pure, exported, and exhaustively tested
- [ ] Status changes only through the transition endpoint
- [ ] `project.launched` fires exactly once — B6's card issuance depends on it
- [ ] `GET /api/projects/:id` returns enough for the overview tab without a second call
- [ ] List filters and pagination match what A2 will need
- [ ] Audit entries record before/after for every field change

## Out of scope

Budget (B4), members and roles (B3 — `project.create` is still the coarse B0 check here), card structure provisioning (B5), closure orchestration (B9).
