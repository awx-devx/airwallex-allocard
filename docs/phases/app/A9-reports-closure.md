# A9 — Reports, Audit & Closure

**Track:** Application · **Powers:** B9 · **Hooks:** `useReports`

## Screens

| Route | Purpose |
| --- | --- |
| `/reports` | Report catalogue and exports |
| `/reports/project/[id]` | Budget versus actual, spend by category and member |
| `/reports/organization` | Cross-project rollup |
| `/audit` | Audit log with filters and diffs |
| `/projects/[id]/closure` | The closure flow |
| `/projects/[id]/report/final` | Post-closure report |
| `/settings/access-reviews` | Access review queue |

## Notes

**Closure is a guided flow, not a button.** Walk the admin through it: pre-flight blockers, freeze, settle pending authorizations, revoke access, close cards, generate the report, archive. Show progress per step and make it resumable — a closure interrupted midway must restart cleanly rather than starting over.

Pre-flight blockers need to be actionable. "Three pending authorizations" should link to them, not just state a count.

Card closure inside this flow is irreversible at Airwallex. Use type-to-confirm, and state that pending transactions will still clear afterwards, because they will and it surprises people.

The audit view is where the system's accountability becomes visible. Distinguish rule actors from human ones, render before/after with `DiffView`, and make filtering by subject easy — "show me everything that happened to this card" is the common question.

Exports stream. Show progress for large ones and don't block the UI.

## States to handle

- Closure blocked by pre-flight items
- Closure in progress, mid-step
- Closure interrupted and resumed
- An archived project — fully read-only, with every action disabled and explained
- An empty audit result for a narrow filter
- A large export in progress

## Review checklist

- [ ] Closure is guided, resumable, and shows per-step progress
- [ ] Pre-flight blockers link to the items blocking
- [ ] Card closure uses type-to-confirm and explains post-closure clearing
- [ ] Audit distinguishes rule actors from human ones and renders usable diffs
- [ ] Archived projects reject every mutation in the UI as well as the API
- [ ] Exports stream without blocking
- [ ] Final report totals match the budget tab exactly
