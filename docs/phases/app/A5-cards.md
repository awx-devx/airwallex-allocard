# A5 — Cards

**Track:** Application · **Powers:** B5 · **Hooks:** `useCards`

## Screens

| Route                  | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `/cards`               | Org-wide card list, filterable by project, purpose, status, holder  |
| `/projects/[id]/cards` | Project cards                                                       |
| `/cards/[id]`          | Detail: status, limits, controls, holder, access list, transactions |
| `/cards/[id]/reveal`   | Secure iframe for number, expiry, CVV                               |

Plus the card-structure step of the A2 wizard.

## Notes

**The secure reveal is a hard boundary.** Card details render exclusively inside the Airwallex-hosted iframe. Fetch a short-lived PAN token, mount the iframe, style it through its documented CSS classes so it matches the app, and handle its `postMessage` lifecycle for load and error. No card number ever passes through application state, and there is nothing to copy from the DOM.

Gate the reveal behind `card.viewDetails` plus scope, and tell the user it's audited. That's both honest and a mild deterrent.

Show remaining limits from `GET /api/cards/:id/limits` — live from Airwallex, not computed locally, because refunds restore limit balance and a local figure will drift.

**Destructive actions need proportionate friction.** Freeze is reversible and can be a simple confirm. Close is irreversible at Airwallex, so use `ConfirmDialog`'s type-to-confirm mode and say plainly that it cannot be undone and that pending transactions will still clear.

Cards created by rules should say so, linking to the governing rule. A user who sees a card they didn't create needs an immediate answer to "where did this come from?"

## Layout

Card list: `grid-cols-1 md:grid-cols-2`, or `DataTable` with internal scroll — pick one per page, don't mix. Detail: stack `CardVisual`, limits, actions; actions `flex-wrap`. Reveal iframe is `w-full`; never a fixed pixel width. [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md).

## States to handle

- A card pending creation, with the cardholder still screening
- A card with a failed creation, showing the error and a retry
- A frozen card — visually distinct, with actions adjusted
- A closed card — read-only, retained for its transaction history
- A card whose controls are mid-reconciliation, showing desired versus applied
- A single-use card that has been used

## Review checklist

- [ ] No card number, CVV, or expiry exists in application state or the DOM outside the iframe
- [ ] Reveal is permission-gated, scope-checked, and disclosed as audited
- [ ] Limits come from the live endpoint
- [ ] Close uses type-to-confirm and explains irreversibility
- [ ] Rule-created cards link to the rule that created them
- [ ] Desired-versus-applied divergence is visible rather than silently hidden
- [ ] 375px and 768px: no page-level horizontal scrollbar; Freeze / Close / Reveal reachable; iframe not wider than the viewport
