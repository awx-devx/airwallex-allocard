# B7 — Purchase Requests & Approvals

**Track:** Backend · **Depends on:** B6 · **Powers:** A7

## Goal

A member can ask to spend, the system decides whether that needs approval, and approval makes a card usable. This is where policy becomes a workflow.

## Deliverables

### Models

| Model | Notes |
| --- | --- |
| `PurchaseRequest` | orgId, projectId, requestedBy, amount, currency, categoryId?, vendor, description, justification, policyDecision, status, cardId?, approvals[] |
| `ApprovalRule` | orgId, projectId?, threshold, approverSelection, requiredCount, escalationAfterMins, escalateTo |

### Policy check

A pure function producing one of three outcomes, with reasons:

```ts
type PolicyOutcome = 'NO_APPROVAL_REQUIRED' | 'APPROVAL_REQUIRED' | 'NOT_PERMITTED'
```

Evaluated in order: the member's role → their access scope → spending rules → thresholds. `NOT_PERMITTED` must state *which* check failed — "you can't do that" with no reason is the single most frustrating thing an internal tool does.

Expose it as `POST /api/policy/preview` so the client can show the outcome **before** the member fills in the form.

### Approver selection

By role, by named user, or by project owner. Multi-approver support means `requiredCount` with distinct approvers — the same person approving twice must not satisfy a two-approver rule. Requesters cannot approve their own requests, including when they hold the approver role.

### Escalation

A scheduled sweep finds requests past `escalationAfterMins` and routes them onward, emitting `request.escalated`. This is genuinely time-triggered, so a sweep is the right mechanism rather than a compromise.

### Commitment on approval

An approved request appends a `COMMITMENT` entry to B4's ledger, reserving the budget. Rejection, expiry, or cancellation appends the matching `RELEASE`. Without this, two members can each get approval for the last $5,000.

### Payment readiness

On approval, emit `request.approved`. B6 rules react — typically creating a one-time card sized to the approved amount, or lifting a limit. B7 does not touch cards directly; it emits the event and lets the rules engine decide. Keeping that boundary clean is what stops card logic from sprawling across phases.

## Endpoints

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| `POST` | `/api/policy/preview` | authenticated | Outcome and reasons before submitting |
| `GET` | `/api/projects/:id/requests` | `transaction.view` scoped | Own requests, or all with wider scope |
| `POST` | `/api/projects/:id/requests` | `payment.make` | Creates `DRAFT` or `PENDING` |
| `GET` | `/api/requests/:id` | scoped | Includes policy decision and approval trail |
| `PATCH` | `/api/requests/:id` | requester, while `DRAFT` | |
| `POST` | `/api/requests/:id/submit` | requester | Runs the policy check, routes |
| `POST` | `/api/requests/:id/cancel` | requester | Releases the commitment |
| `POST` | `/api/requests/:id/decide` | `request.approve` | `{ decision, reason }`; reason required on reject |
| `GET` | `/api/approvals` | `request.approve` | The approver's queue across projects |
| `GET` | `/api/approvals/count` | `request.approve` | Badge count for the shell |
| `GET` | `/api/projects/:id/approval-rules` | `control.edit` | |
| `PUT` | `/api/projects/:id/approval-rules` | `control.edit` | |

## Events

`request.created`, `request.submitted`, `request.approved`, `request.rejected`, `request.escalated`, `request.cancelled`

## Tests

Beyond the standard matrix:

- Each policy outcome, with the reasons asserted, not just the outcome
- A request under the threshold needs no approval; over it does
- Multi-approver requires distinct approvers; a duplicate approval doesn't satisfy the count
- A requester holding the approver role cannot approve their own request
- Rejection requires a reason
- Approval appends exactly one `COMMITMENT`; rejection and cancellation append the matching `RELEASE`
- Two concurrent approvals against the same remaining budget cannot both commit past it
- Escalation fires after the interval and only once
- Deciding an already-decided request fails with `409`
- `request.approved` is emitted once and B6 reacts to it
- A member without `payment.make` cannot create a request
- Scope-limited members see only their own requests

## Review checklist

- [ ] `NOT_PERMITTED` always names the failing check
- [ ] Policy preview and enforcement use the same function
- [ ] Commitments and releases balance under every terminal path
- [ ] Self-approval is impossible
- [ ] B7 never calls Airwallex directly — it emits, B6 acts
- [ ] The approvals queue query is efficient across projects; it's on the shell's hot path
- [ ] Escalation is idempotent

## Out of scope

Actual card transactions (B8), receipts (B8), notification delivery beyond event emission.
