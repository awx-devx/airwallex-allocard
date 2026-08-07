# Build Phases

The build runs in three sequential tracks. Within a track, phases run in order. A phase is a **review unit**: a self-contained slice of work you can read, run, and sign off without needing anything from a later phase.

```
Track B — Backend        B0 → B1 → … → B9      complete API surface, no UI
Track F — Client foundation  F0 → F1 → F2 → F3  plumbing and components, no screens
Track A — Application    A1 → A2 → … → A9      screens, assembled from F
```

## Why this order

Reviewing a vertical slice means holding a half-built API and a half-built screen in your head simultaneously, and disagreements between them surface as UI bugs. Finishing the backend first means each review is one question — *is this API surface correct and complete?* — answered by reading a contract file and a test run.

By the time screens are built, every endpoint, hook, and component already exists and has been reviewed independently. Screen work becomes assembly.

## Index

### Track B — Backend

| Phase | Scope | Depends on |
| --- | --- | --- |
| [B0](./backend/B0-foundation.md) | Setup, Mongoose, shared types, errors, auth primitives, test harness | — |
| [B1](./backend/B1-auth-organizations.md) | Auth, organisations, invites, onboarding gate | B0 |
| [B2](./backend/B2-projects.md) | Project CRUD and lifecycle | B1 |
| [B3](./backend/B3-access-control.md) | Roles, permissions, scopes, members | B2 |
| [B4](./backend/B4-budget.md) | Budget ledger, categories, change requests | B3 |
| [B5](./backend/B5-cards.md) | Airwallex client, cardholders, cards, controls | B4 |
| [B6](./backend/B6-rules-engine.md) | Attributes, rules, evaluation, reconciliation | B5 |
| [B7](./backend/B7-requests-approvals.md) | Purchase requests, policy checks, approvals | B6 |
| [B8](./backend/B8-money-in-motion.md) | Webhooks, transactions, ledger sync, remote auth | B7 |
| [B9](./backend/B9-reporting-closure.md) | Activity, audit, exports, closure | B8 |

### Track F — Client foundation

| Phase | Scope | Depends on |
| --- | --- | --- |
| [F0](./frontend/F0-foundation.md) | App shell, providers, typed API client, session, guards | B9 |
| [F1](./frontend/F1-data-layer.md) | Query keys, hooks for every endpoint, invalidation map | F0 |
| [F2](./frontend/F2-utils.md) | Money, dates, formatting, permissions, forms | F0 |
| [F3](./frontend/F3-ui-library.md) | UI primitives, patterns, `/dev/ui` kitchen sink | F2 |

### Track A — Application

| Phase | Screens | Powered by |
| --- | --- | --- |
| [A1](./app/A1-auth-onboarding.md) | Sign-up, sign-in, create org, accept invite | B1 |
| [A2](./app/A2-dashboard-projects.md) | Dashboard, project list, creation wizard | B2 |
| [A3](./app/A3-people-access.md) | Workspace shell, overview, people & access | B3 |
| [A4](./app/A4-budget.md) | Budget tab, categories, change requests | B4 |
| [A5](./app/A5-cards.md) | Card list, detail, secure reveal, lifecycle | B5 |
| [A6](./app/A6-controls-automation.md) | Rule builder, simulation, automation history | B6 |
| [A7](./app/A7-approvals.md) | Requests, approvals queue, decisions | B7 |
| [A8](./app/A8-activity.md) | Transactions, declines, receipts | B8 |
| [A9](./app/A9-reports-closure.md) | Reports, exports, access reviews, closure | B9 |

## Specs versus tasks

Each phase has two files, and the distinction matters:

| File | Role | Mutability |
| --- | --- | --- |
| `{PHASE}.md` | The spec — what to build, why, and how it's reviewed | **Immutable** during the phase |
| `{PHASE}-TASKS.md` | The checklist — session-sized tasks, acceptance commands, progress | Updated after every task |

Never record progress by editing a spec. Keeping them separate is what lets you tell what was *planned* from what *happened*.

Generate a phase's task file from its spec when you reach it, using [`TASKS-TEMPLATE.md`](./TASKS-TEMPLATE.md). Writing B9's tasks before B1 exists is speculation. `B0-TASKS.md` and `B1-TASKS.md` exist as the worked pattern.

Repo-level state lives in [`../../STATUS.md`](../../STATUS.md); the invariants an agent must never violate live in [`../../AGENTS.md`](../../AGENTS.md).

**Trust order when they disagree: tests > git > checkboxes.** A checkbox records what was believed; a commit records what changed; a passing test records what works.

## Review protocol

Each phase ends with a review before the next begins.

**What gets handed over:**

1. The phase's contract file(s) in `src/shared/contracts/` — the API surface in one readable place.
2. `pnpm test --filter <phase>` output, green.
3. The phase doc's review checklist, completed.
4. A short note on anything that forced a change in an earlier phase.

**What review is looking for:**

- Is the API surface *complete* for this domain, or will a screen later need something that isn't here?
- Are the contracts right? Renaming a field after the client is built is the expensive mistake this structure exists to prevent.
- Does the standard endpoint matrix pass, especially cross-tenant (`404`) and audit-write rows?
- Are permissions enforced server-side on every mutation, not just documented?

**Changes are cheap now and expensive later.** A contract change in B4 costs a rename. The same change after F1 and A4 costs a rename plus a hook plus a screen. Push hard during review.

## Conventions that apply to every phase

These are settled in B0 and not revisited:

| Concern | Convention |
| --- | --- |
| Types | Zod in `shared/schemas` is the single source of truth. See [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §4 |
| IDs | `string` everywhere in domain types; `ObjectId` never leaves a repository |
| Money | Integer minor units plus explicit currency. Never a float |
| Dates | ISO 8601 strings on the wire, `Date` in Mongo |
| Errors | `{ error: { code, message, details? } }`, codes from a shared enum |
| Tenancy | Every repository method takes `OrgContext`; the `tenantScoped` plugin throws without it |
| Permissions | `requirePermission(ctx, permission, subject)` on every mutation |
| Audit | Every mutation writes exactly one audit entry |
| Idempotency | Mutations that touch Airwallex take a stable `request_id` |
| Tests | The standard matrix in [`../ARCHITECTURE.md`](../ARCHITECTURE.md) §13, per endpoint |

## Definition of done, for any phase

- [ ] All endpoints implemented and matching their contracts
- [ ] Standard test matrix passing for every endpoint
- [ ] Domain-specific tests listed in the phase doc passing
- [ ] Permissions enforced and tested server-side
- [ ] Audit entries written and asserted
- [ ] Events emitted where the phase doc says so
- [ ] Seed script extended to cover the new entities
- [ ] No `any`, no `@ts-expect-error` without a comment explaining why
- [ ] Review checklist signed off
