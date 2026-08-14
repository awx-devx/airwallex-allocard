# Allocard — Agent Instructions

Dynamic attribute-based budget cards on Airwallex. Card limits are **derived** from business attributes (budget, headcount, approval status, campaign performance), never typed by a human. Airwallex enforces; Allocard decides.

## Start every session here

1. Read `STATUS.md` — active phase, active task, known issues.
2. Read the phase spec: `docs/phases/{track}/{PHASE}.md`
3. Read the phase tasks: `docs/phases/{track}/{PHASE}-TASKS.md`
4. Do **exactly one task**, then verify, commit, tick the box, update `STATUS.md`.

Do not start a task that isn't the next unchecked one. Do not batch tasks.

## Invariants — never violate these

1. **Tenancy.** Every repository method takes `OrgContext` as its first argument and filters on `ctx.orgId`. A resource belonging to another org returns `404`, never `403` — a `403` confirms it exists.
2. **Money is integer minor units** plus an explicit currency: `{ amount: 402350, currency: 'USD' }` is $4,023.50. Never a float, never `parseFloat` on an amount, never arithmetic on a formatted string.
3. **Never touch a PAN.** No card number, CVV, or expiry may enter application code, state, logs, or the database. Sensitive card details render only inside Airwallex-hosted iframes.
4. **Contracts are the source of truth.** `src/shared/contracts` and `src/shared/schemas` define every shape. Never rename a field in a handler, model, or hook without changing the contract first.
5. **Permissions are server-side.** `requirePermission(ctx, permission, subject)` guards every mutation. Client-side `can()` is UX only, never a control.
6. **Every mutation writes exactly one audit entry**, in the same unit of work.
7. **Mongoose documents never leave `src/server/repositories`.** Services and handlers receive plain domain objects. `HydratedDocument` appears only inside a repository file.
8. **Empty allowlist means "allow everything" at Airwallex.** `[]`, `null`, and absent are identical to Airwallex for `allowed_currencies`, `allowed_merchant_categories`, and every other allowlist. A computed empty intersection is a **conflict** to surface, never a value to push.
9. **No `any`.** No `@ts-expect-error` without a comment explaining why. `src/shared` may not import from `src/server` or `src/client`.
10. **Layout does not break.** Desktop (`md`, 768px) is the product. Narrower widths must still show and reach everything — no page-level horizontal scrollbar, no overlapping chrome, no control hidden without a replacement. They do not have to look good. One breakpoint, four copy-paste patterns: `docs/RESPONSIVENESS.md`.

## Stop and ask — do not decide

Escalate to the user instead of choosing, when:

- A task requires a design decision the specs don't already make.
- A task requires changing a contract an earlier phase already shipped.
- A spec contradicts another spec, or a spec contradicts existing code.
- You cannot make `pnpm verify` pass without weakening a test.

Guessing here is worse than stopping. A wrong decision propagates silently into later phases.

## The task loop

```
read STATUS.md → confirm/write the contract → implement → write tests
   → pnpm verify (must be green) → git commit "B3.4: ..." → tick box → update STATUS.md
```

`pnpm verify` runs typecheck, lint, and tests. **"Done" means verify is green**, not that the work looks finished.

Commit once per task, with the task ID first in the message. `git log` is the recovery mechanism when a session is lost — a checkbox records what was believed, a commit records what happened.

## Reference docs

| Doc                             | When                                                                                    |
| ------------------------------- | --------------------------------------------------------------------------------------- |
| `docs/ARCHITECTURE.md`          | Type system (§4), model pattern (§5), tenancy (§6), background work (§8), testing (§13) |
| `docs/RULES-ENGINE.md`          | Anything in phase B6 or A6                                                              |
| `docs/AIRWALLEX-INTEGRATION.md` | Anything calling Airwallex (B5, B8)                                                     |
| `docs/PRD.md`                   | Product intent, personas, user journeys                                                 |
| `docs/RESPONSIVENESS.md`        | Track A layout: one breakpoint, shell Sheet, tables scroll inside                       |
| `docs/VISUAL-DIRECTION.md`      | Sharp / tinted / gloss tokens — F3 chrome and Track A inheritance                       |

Read the referenced section. Do not infer its contents from its title.
