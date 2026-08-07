# A7 — Purchase Requests & Approvals

**Track:** Application · **Powers:** B7 · **Hooks:** `useRequests`

## Screens

| Route | Purpose |
| --- | --- |
| `/requests` | The member's own requests |
| `/requests/new` | Create a request |
| `/requests/[id]` | Detail, policy decision, approval trail |
| `/approvals` | The approver's queue across projects |
| `/approvals/[id]` | Review and decide |
| `/projects/[id]/controls` (approval rules) | Threshold and approver configuration |

## Notes

**Show the policy outcome before the form is submitted.** As the member enters an amount and category, call `POST /api/policy/preview` and tell them what will happen: no approval needed, approval needed from whom, or not permitted and why. A member who learns after filling in five fields that they weren't allowed to has been wasted.

`NOT_PERMITTED` must always name the failing check. "You cannot spend from this category — your access is limited to the Retail workstream" is useful; "not permitted" is not.

The approver queue is a working surface, not a list. Each item needs enough context to decide without navigating away: amount, vendor, justification, the requester, remaining project budget, and the requester's recent spend. Rejection requires a reason, and that reason is shown to the requester.

After approval, show what it unlocked — the card created or the limit lifted. This connects the approval to its effect and reinforces that the system acted.

## States to handle

- A request needing multiple approvers, showing who has approved so far
- An escalated request, with escalation reason and timing
- A request the viewer already decided
- A rejected request, with the reason prominent to the requester
- An expired request
- A request whose budget was consumed elsewhere before approval

## Review checklist

- [ ] Policy preview runs before submission
- [ ] `NOT_PERMITTED` always names the failing check
- [ ] The queue carries enough context to decide in place
- [ ] Rejection reasons are mandatory and surfaced to the requester
- [ ] Self-approval is impossible in the UI as well as the API
- [ ] Approval shows what it unlocked
- [ ] Multi-approver progress is visible
