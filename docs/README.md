# Allocard Documentation

Allocard is a demo application for **dynamic, attribute-based budget cards**, built on Airwallex Issuing.

The premise: a card's existence, limits, permissions, and availability should not be manually configured. They should be **derived** from business attributes — project budget, approval status, headcount, role, campaign performance, inventory, location, dates — and re-derived automatically whenever those attributes change.

Airwallex supplies the card infrastructure and enforcement. Allocard supplies the cost drivers, the dependency graph, and the automation logic.

## Read in this order

| Doc                                                      | What it covers                                                                          |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| [`PRD.md`](./PRD.md)                                     | Product vision, personas, user journeys, scoped feature set, phasing                    |
| [`ARCHITECTURE.md`](./ARCHITECTURE.md)                   | Next.js / Mongoose / Redis system design, shared type system, data model, testing       |
| [`RULES-ENGINE.md`](./RULES-ENGINE.md)                   | The attribute registry, rule DSL, evaluation model, reconciliation                      |
| [`AIRWALLEX-INTEGRATION.md`](./AIRWALLEX-INTEGRATION.md) | Concrete API mapping, webhooks, remote authorization, PCI handling                      |
| [`phases/`](./phases/)                                   | Per-phase specs, deliverables, tests, and review checklists — the build plan            |
| [`WORKFLOW.md`](./WORKFLOW.md)                           | How to run the build: per-phase model tiers, the prompt library, where to pay attention |
| [`RESPONSIVENESS.md`](./RESPONSIVENESS.md)               | Desktop-first layout: one breakpoint, four patterns, Track A don't-break check          |

## How the build runs

Three sequential tracks, so review never spans a half-built API and a half-built screen:

```
Track B — Backend            B0 → … → B9    complete API surface, tests green, no UI
Track F — Client foundation  F0 → … → F3    API client, query hooks, utils, UI library
Track A — Application        A1 → … → A9    screens, assembled from F
```

Each phase is a review unit with its own checklist. See [`phases/README.md`](./phases/README.md) for the review protocol and [`WORKFLOW.md`](./WORKFLOW.md) for the session-by-session operating procedure.

Repo state lives in [`../STATUS.md`](../STATUS.md); the invariants an agent may never violate live in [`../AGENTS.md`](../AGENTS.md), which Cursor loads into every session automatically.

## Decisions already made

- **One shared Airwallex sandbox account, not one connected account per organisation.** Tenant separation is Allocard's job — `metadata.orgId` on every card, an `orgId` filter on every read. Rationale, risks, and the seven measures that keep a future migration mechanical are in [`AIRWALLEX-INTEGRATION.md`](./AIRWALLEX-INTEGRATION.md) §2.
- **Remote authorization ships as a simulator**, with live mode behind a config flag.
- **Auth is Auth.js with Credentials + Google**, not Clerk and not GitHub. Google because the personas are finance and procurement staff on Google Workspace. Credentials stay because demo personas must be seedable and sign-innable without real Google accounts. Clerk was rejected because its hosted organisations duplicate the `Organization` / `Membership` models that drive `computeEffectivePermissions` in B3 — it would replace two of B1's fifteen tasks while adding a webhook sync path directly beneath the tenancy invariant.
- **Layout is desktop-first and must not break narrower.** One breakpoint (`md`, 768px). No mobile app, no second IA. Recipe in [`RESPONSIVENESS.md`](./RESPONSIVENESS.md). F0/F3 already shipped; shell collapse (sidebar → existing `Sheet`) is A2.

## Source material

- `SpendPilot - Current.csv` — the original function-by-actor scoping sheet. Treated as **input, not contract**; the PRD reorganises and extends it.
- `../demo/projectos_b3os_style_mock.html` — an early visual sketch. Useful for information architecture (tab layout, project workspace shape) only. Its extra surfaces are not in scope.

## The one-paragraph version

A user signs up, creates or joins an organisation (onboarding is incomplete until one of those happens), and then creates projects. A project has a budget, members with roles and access scopes, and a card structure. When the project is approved, Allocard issues cards through Airwallex with authorization controls computed from the project's attributes. As money is spent, budgets shrink, rules re-evaluate, and card limits move on their own. Every decision — automated or human — is written to an audit log.
