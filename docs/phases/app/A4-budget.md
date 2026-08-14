# A4 — Budget

**Track:** Application · **Powers:** B4 · **Hooks:** `useBudget`

## Screens

| Route                              | Purpose                                                            |
| ---------------------------------- | ------------------------------------------------------------------ |
| `/projects/[id]/budget`            | Approved, committed, actual, remaining; categories; recent entries |
| `/projects/[id]/budget/categories` | Category management, fixed amounts or formulas                     |
| `/projects/[id]/budget/history`    | Change history with actor and reason                               |
| `/projects/[id]/budget/requests`   | Change requests, and the decision flow                             |

Plus the budget step of the A2 wizard.

## Notes

**Four numbers, clearly distinguished.** Approved, committed, actual, and remaining are easy to conflate and expensive to confuse. Lead with `BudgetBar` from F3 as a single stacked visual, and define each term inline — a tooltip explaining that "committed" means approved-but-not-yet-spent saves a lot of confusion.

Formula-based allocations need a first-class editor: a live preview showing what the formula evaluates to _right now_, validated through `POST /api/budget/formula/validate` as the user types. Never let an invalid formula save.

Because the budget drives card limits, any change here should show its downstream effect. After a budget change, surface which card limits moved. That's the product's premise made visible in the most ordinary workflow.

## Layout

`BudgetBar` already stacks its four figures (`grid-cols-2 sm:grid-cols-4` today). Do not add breakpoints; if you touch it, prefer `grid-cols-2 md:grid-cols-4` so we stay on the one-breakpoint rule. Category and history tables scroll inside. Action rows `flex-wrap`. [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md).

## States to handle

- No budget set yet — a `DRAFT` project pre-approval
- Over-committed, where remaining is negative — clearly flagged, not hidden
- Categories summing beyond the project total
- A pending change request, shown on the main tab rather than buried
- A formula whose inputs are stale — surfaced with `AttributeValue`'s staleness indicator

## Review checklist

- [ ] The four figures are visually distinct and individually explained
- [ ] Formula validation is live and blocks saving when invalid
- [ ] Budget changes surface the card limits they moved
- [ ] Negative remaining is flagged prominently
- [ ] All amounts render through F2's money helpers — no local arithmetic
- [ ] History shows actor and reason for every change
- [ ] 375px and 768px: no page-level horizontal scrollbar; the four budget figures and primary actions visible without sideways window scroll
