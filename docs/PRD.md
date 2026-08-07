# Allocard — Product Requirements

**Status:** Draft for demo build
**Stack:** Next.js (App Router), MongoDB, Redis (optional but recommended), Airwallex Issuing

---

## 1. Problem

Corporate card programs are static. Someone issues a card, types a limit into a form, and that number stays there until a human remembers to change it. The result is the two failure modes every finance team knows:

- **Over-provisioned cards.** A card carries a $50k monthly limit because that was right in Q1. The project now has $4k of budget left. The card does not know that.
- **Under-provisioned people.** A contractor needs to spend $200 on a vendor tool. That requires a ticket, an approval chain, and three days — because there is no safe way to give them a small, tightly-scoped, self-expiring card.

The limit is disconnected from the business reality that justifies it.

## 2. Product thesis

**A card limit is a derived value, not a stored one.**

Allocard treats every card control — spend limit, allowed merchants, allowed currencies, active dates, whether the card exists at all — as the output of a formula over business attributes. Change the attribute, and the card changes within seconds, without a human in the loop.

```
project.budget.remaining drops to $4,000
        ↓  (rule evaluates)
member card monthly limit = min(remaining × 10%, role.cap) = $400
        ↓  (reconciler pushes to Airwallex)
POST /api/v1/issuing/cards/{id}/update  →  authorization_controls.transaction_limits
```

Airwallex enforces. Allocard decides.

### What makes this different from an expense tool

| Conventional spend management | Allocard                                                   |
| ----------------------------- | ---------------------------------------------------------- |
| Admin sets a card limit       | Admin sets a _formula_ for the limit                       |
| Card is created manually      | Card is created when a condition becomes true              |
| Access is granted per-person  | Access is a function of role × scope, recomputed on change |
| Budget is a report            | Budget is a live input to card enforcement                 |
| Policy is a PDF               | Policy is executable and audited per decision              |

## 3. Personas

| Persona                      | Cares about                                            | Primary surfaces                                        |
| ---------------------------- | ------------------------------------------------------ | ------------------------------------------------------- |
| **Finance Administrator**    | Org-wide control, exposure, reconciliation, audit      | Org settings, all cards, reports, access reviews        |
| **Project Manager**          | Getting their team spending without babysitting it     | Project setup, project workspace, cards, controls       |
| **Approver**                 | Fast, contextual decisions                             | Approvals queue, purchase request detail                |
| **Project Spender / Member** | Knowing what they're allowed to spend, and spending it | Assigned project, my cards, purchase requests, receipts |
| **Procurement Lead**         | Vendor and one-time cards                              | Cards, vendor card creation                             |
| **Contractor**               | Narrow, time-boxed access                              | Single project, single card, own transactions only      |
| **Viewer**                   | Read-only visibility (auditor, exec)                   | Overview, reports                                       |

## 4. Scope

### 4.1 In scope

**Identity & organisation**

- Email/password + Google sign-up and sign-in
- **Onboarding gate:** a session is not "onboarded" until the user owns or belongs to an organisation. Every authenticated route behind the gate redirects to `/onboarding` otherwise.
- Organisation creation (name, country, base currency, cost centres)
- Invite by email with a pre-assigned org role; invite acceptance completes onboarding
- Organisation settings: roles, default approval policy, notification defaults, integrations

**Projects**

- Project list, filterable by status, owner, cost centre
- Guided project setup wizard: details → budget → members → roles → card structure → controls → approval rules → review → launch
- Project workspace with tabs: Overview, Budget, People & Access, Cards, Controls & Automation, Activity, Settings
- Project lifecycle: `DRAFT → PENDING_APPROVAL → ACTIVE → CLOSING → CLOSED → ARCHIVED`

**Budget**

- Approved / committed / actual / remaining, tracked as an append-only ledger
- Budget categories (workstreams) with their own allocations
- Budget formulas — an allocation can be an expression over attributes, not just a number
- Budget change requests with approval, and a full change history

**People, roles & access**

- Seven role templates (Finance Administrator, Project Manager, Approver, Project Spender, Procurement Lead, Contractor, Viewer) plus custom roles
- A permission matrix covering: view project, view/edit budget, manage members, assign roles, create cards, view card details, make payments, approve requests, edit controls, view transactions, export reports, close project
- **Access scopes** that narrow a role: whole project, a workstream, a budget category, a specific card, own transactions only, assigned team members only, a time window
- **Effective permissions preview** — before confirming, the admin sees exactly what the member will be able to do
- Access reviews and access change history

**Cards**

- Card structures: shared project card, per-member cards, vendor cards, one-time (single-use) cards
- Create, assign cardholder, freeze, unfreeze, close
- Live remaining limit, card status, card access list
- PCI-safe reveal of card number / expiry / CVV via Airwallex secure iframes

**Controls & automation** _(the differentiator — see [`RULES-ENGINE.md`](./RULES-ENGINE.md))_

- Attribute registry: every value a rule can read
- Rule builder: `WHEN <trigger> IF <condition> THEN <action>`
- Spending controls: merchant categories, currencies, transaction limits per interval, active dates, merchant countries, transaction usage scopes
- Approval rules: threshold-based, role-based approver selection, multi-approver, escalation on timeout
- Lifecycle rules: auto-create on project approval, auto-freeze on budget exhaustion, auto-close on project end
- Simulation / dry-run before activating a rule
- Automation history: every rule run, its inputs, its decision, and what it changed

**Requests, approvals & spending**

- Purchase request creation by members
- Automatic policy check producing one of: _no approval required_, _approval required_, _not permitted_ (with the reason)
- Approval routing, approve/reject with reason, escalation
- Payment readiness: card becomes usable only after approval, when the rule requires it
- Real-time authorization decisioning (where Airwallex remote authorization is enabled)

**Activity, reporting & closure**

- Transactions, declined transactions, pending approvals, receipts
- Audit history covering role changes, access changes, rule runs, and card mutations
- Exports (CSV) for budget, card activity, access & audit
- Project closure: review open transactions and active access, revoke spend permissions, freeze/close cards, generate final report, archive

### 4.2 Out of scope for the demo

Physical card issuance and delivery, disputes and chargebacks, multi-entity consolidation, real KYB onboarding of connected accounts, mobile apps, ERP write-back (integrations are stubbed at the connector interface), and production PCI scope of any kind.

## 5. Core user journeys

### J1 — Sign up and land somewhere useful

1. User signs up. Session exists, `onboardingComplete = false`.
2. Guard redirects every app route to `/onboarding`.
3. User either **creates an organisation** (becomes `OWNER`) or **accepts a pending invite** (becomes the invited role).
4. `onboardingComplete` flips true. User lands on the dashboard.

There is no third path. A user without an organisation cannot reach the product.

### J2 — Stand up a project with derived cards

1. PM creates a project: name, dates, cost centre, owner, workstreams.
2. Sets budget: total approved amount, split into categories. Any allocation may be a formula.
3. Adds members, assigns each a role and an access scope, previews effective permissions, confirms.
4. Chooses card structure — say, one shared project card plus per-member cards for the Spender role.
5. Sets spending controls: allowed merchant categories, allowed currencies, active window matching project dates.
6. Sets approval rules: purchases over $1,000 need the Approver role; over $10,000 needs two approvers.
7. Reviews and **launches**. Project moves to `ACTIVE`, which fires `project.launched`.
8. Rules fire: cardholders are created for eligible members, cards are issued through Airwallex with computed limits, access is granted.

The PM never typed a card limit.

### J3 — Spend against policy

1. Member opens their project, sees their assigned card and current available limit.
2. Member raises a purchase request (or, under the threshold, just spends).
3. Policy check runs: role → scope → spending rules → threshold.
4. If approval is required, it routes to the assigned approver. On approval, the card is made payment-ready — the rule engine lifts the limit or activates the card.
5. Member pays. Airwallex authorizes against the card's controls. If remote authorization is enabled, Allocard also decides in real time against live budget state.
6. On clearing: budget actuals update, card limits recompute, the transaction lands in activity, a receipt is requested, the audit log is written.

### J4 — Budget moves, cards follow

1. A cleared transaction reduces `project.budget.remaining`.
2. The `budget.updated` event triggers rule re-evaluation.
3. Desired card states are recomputed. Cards whose limits changed get patched at Airwallex.
4. If remaining budget crosses a floor, a rule freezes non-essential cards and notifies the PM.

Nobody was watching a dashboard.

### J5 — Role changes, access follows

1. Admin changes a member's role from Spender to Viewer.
2. Permissions are recomputed from scratch (never patched incrementally).
3. New access is granted, old access is revoked, their cards are frozen or reassigned, approval duties they held are reassigned.
4. The change is written to access history.

### J6 — Project closes cleanly

1. Admin initiates closure. Open transactions and active access are surfaced for review.
2. Spending permissions are removed, cards are frozen then closed, pending requests are resolved.
3. A final project report is generated, and the project is archived.

## 6. Feature inventory

The CSV in this directory enumerates ~183 functions. They map onto these modules — treat this as the build checklist, and the CSV as the detail behind each line.

| Module                            | Functions                                                                                           | Phase |
| --------------------------------- | --------------------------------------------------------------------------------------------------- | ----- |
| Authentication & onboarding       | Sign up, sign in, create org, invite, accept invite, onboarding gate                                | 0     |
| Dashboard                         | Home, projects, approvals, all cards, reports entry points                                          | 1     |
| Organisation                      | Settings, cost centres, role templates, default approval policy, integrations                       | 1     |
| Projects & setup wizard           | List, create, 9-step setup, launch                                                                  | 1     |
| Roles & permissions               | Role templates, custom roles, permission matrix, access scopes, effective-permission preview        | 2     |
| Members & access                  | Add, remove, assign role, assign scope, access reviews, access history                              | 2     |
| Budget                            | Approved / committed / actual / remaining, categories, formulas, change requests, history           | 3     |
| Cards                             | Create, assign, freeze, unfreeze, close, edit controls, remaining limit, access list, secure reveal | 4     |
| Attributes & rules engine         | Attribute registry, rule builder, triggers, actions, simulation, automation history                 | 5     |
| Spending controls                 | MCC, currency, transaction limits, active dates, countries, usage scopes                            | 5     |
| Approval rules & workflow         | Thresholds, approver selection, multi-approver, escalation, approve/reject                          | 6     |
| Purchase requests & policy checks | Create request, policy evaluation, payment readiness                                                | 6     |
| Transactions & reconciliation     | Webhook ingest, budget updates, limit recompute, receipts                                           | 7     |
| Activity, audit & reports         | Transactions, declines, audit history, exports                                                      | 7     |
| Lifecycle & closure               | Lifecycle rules, notifications, closure, final report, archive                                      | 8     |

## 7. Build phases

The build runs in three sequential tracks: **the entire backend, then the client foundation, then the screens.** Each phase is a self-contained review unit — one domain's complete API surface with its tests green — so review never requires holding a half-built frontend and a half-built backend in your head at once.

Per-phase specifications, deliverables, and review checklists live in [`phases/`](./phases/).

### Track B — Backend

Every phase ships route handlers, services, models, contracts, and tests. Nothing renders. Each ends with an API surface reviewable via its contract file and its test output.

| Phase                                           | Scope                                                                                             |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [B0](./phases/backend/B0-foundation.md)         | Project setup, Mongoose, shared types, error envelope, auth primitives, test harness, seed script |
| [B1](./phases/backend/B1-auth-organizations.md) | Sign-up, sign-in, session, organisation creation, invites, onboarding gate                        |
| [B2](./phases/backend/B2-projects.md)           | Project CRUD, lifecycle transitions, workstreams, settings                                        |
| [B3](./phases/backend/B3-access-control.md)     | Roles, permission matrix, access scopes, members, `computeEffectivePermissions`                   |
| [B4](./phases/backend/B4-budget.md)             | Budget ledger, categories, projections, change requests, history                                  |
| [B5](./phases/backend/B5-cards.md)              | Airwallex client, cardholders, card provisioning, controls, lifecycle, PAN tokens                 |
| [B6](./phases/backend/B6-rules-engine.md)       | Attribute registry, rule DSL, evaluator, desired state, reconciler, simulation                    |
| [B7](./phases/backend/B7-requests-approvals.md) | Purchase requests, policy checks, approval routing, escalation                                    |
| [B8](./phases/backend/B8-money-in-motion.md)    | Webhook ingest, transaction mirroring, ledger reconciliation, remote authorization                |
| [B9](./phases/backend/B9-reporting-closure.md)  | Activity feeds, audit queries, exports, access reviews, project closure                           |

### Track F — Client foundation

No product screens. This track exists so that by the time screens are built, every piece of plumbing already exists and is reviewable in isolation.

| Phase                                    | Scope                                                                                                 |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| [F0](./phases/frontend/F0-foundation.md) | App shell, providers, typed API client, session wiring, error and loading conventions                 |
| [F1](./phases/frontend/F1-data-layer.md) | TanStack Query: key factory, one hook per endpoint, invalidation map, optimistic patterns             |
| [F2](./phases/frontend/F2-utils.md)      | Money, dates, formatting, permission helpers, form utilities                                          |
| [F3](./phases/frontend/F3-ui-library.md) | UI primitives and patterns, plus a `/dev/ui` kitchen-sink page rendering every element in every state |

### Track A — Application

Screens only, assembled from F-track hooks and components. Each phase maps to the backend phase that already powers it.

| Phase                                        | Screens                                                                | Powered by |
| -------------------------------------------- | ---------------------------------------------------------------------- | ---------- |
| [A1](./phases/app/A1-auth-onboarding.md)     | Sign-up, sign-in, create organisation, accept invite                   | B1         |
| [A2](./phases/app/A2-dashboard-projects.md)  | Dashboard, project list, project creation wizard                       | B2         |
| [A3](./phases/app/A3-people-access.md)       | Project workspace shell, overview, people & access, permission preview | B3         |
| [A4](./phases/app/A4-budget.md)              | Budget tab, categories, change requests, history                       | B4         |
| [A5](./phases/app/A5-cards.md)               | Card list, card detail, secure reveal, lifecycle actions               | B5         |
| [A6](./phases/app/A6-controls-automation.md) | Rule builder, simulation, automation history, "why this limit?"        | B6         |
| [A7](./phases/app/A7-approvals.md)           | Purchase requests, approvals queue, decision screens                   | B7         |
| [A8](./phases/app/A8-activity.md)            | Transactions, declines, receipts, activity feed                        | B8         |
| [A9](./phases/app/A9-reports-closure.md)     | Reports, exports, access reviews, closure flow                         | B9         |

### Review gate

A phase is not complete until: its tests pass, its contracts are stable, its review checklist is signed off, and any changes it forced in an earlier phase have been applied. The next phase does not start before that.

## 8. What "good" looks like in the demo

The demo should be able to show, live:

1. A project launched with zero manually-entered card limits.
2. A card appearing in Airwallex sandbox seconds after project approval, with controls that match the project's attributes.
3. A simulated transaction that reduces the budget and visibly moves a _different_ card's limit.
4. A budget floor breach that freezes cards automatically, with the rule run visible in automation history.
5. A role change that instantly narrows what a member can see and spend.
6. A purchase request that routes, escalates, gets approved, and unlocks a card.
7. An audit trail where every one of the above is attributable to a rule or a person.

## 9. Non-functional requirements

| Area                    | Requirement                                                                                                                                                                                                                                                                                                                            |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Tenancy**             | Every read and write is scoped by `orgId` at the data-access layer, not the route handler. Cross-org leakage is the top risk.                                                                                                                                                                                                          |
| **Authorization**       | Permissions are enforced server-side on every mutation. The UI hiding a button is a convenience, never a control.                                                                                                                                                                                                                      |
| **Propagation**         | A change to any attribute must reach the cards that depend on it **within seconds, driven by an event** — never by a polling interval and never by someone pressing a button. Scheduled sweeps exist only to repair what the event path missed, and routinely finding work is an alarm. See [`ARCHITECTURE.md`](./ARCHITECTURE.md) §8. |
| **Real-time decisions** | Remote authorization responses must return in **under 2.5s** (Airwallex's hard window). Target p99 < 300ms via Redis-cached policy snapshots.                                                                                                                                                                                          |
| **Idempotency**         | Every Airwallex write carries a stable `request_id`. Every inbound webhook is deduplicated by event `id`.                                                                                                                                                                                                                              |
| **Determinism**         | Rule evaluation with the same inputs must produce the same desired state. Recompute from scratch; never patch incrementally.                                                                                                                                                                                                           |
| **Auditability**        | Every card mutation, permission change, and rule run is recorded with actor (user or rule), inputs, and outcome.                                                                                                                                                                                                                       |
| **PCI**                 | The application never receives, stores, or logs a PAN. Sensitive card details are rendered exclusively through Airwallex-hosted iframes.                                                                                                                                                                                               |
| **Secrets**             | Airwallex client ID and API key live server-side only, are never exposed to the client bundle, and are scoped per environment.                                                                                                                                                                                                         |
| **Observability**       | Structured logs on every rule run and Airwallex call, correlated by request ID.                                                                                                                                                                                                                                                        |

## 10. Decisions

**D1 — Single Airwallex account, not connected accounts.** Every Allocard organisation runs against one Airwallex sandbox account. Tenant separation is Allocard's responsibility, via `metadata.orgId` on every card and an `orgId` filter on every read.

Connected accounts (one per organisation, addressed with `x-on-behalf-of`) are the right production architecture, but they drag in two domains that add nothing to this demo: independent KYB verification per account — including the Full Connected Account tier that card issuing requires — and per-org wallet funding through Connected Account Transfers or the Platform Liquidity Program.

The trade is that Airwallex no longer enforces the tenant boundary, so a missing filter on any read path leaks card data across organisations. This is acceptable for a demo and is not acceptable for production. [`AIRWALLEX-INTEGRATION.md`](./AIRWALLEX-INTEGRATION.md) §2 records the full comparison, the structural mitigation, and seven forward-compatibility measures (roughly a day of work) that keep the eventual migration mechanical.

**D2 — Remote authorization ships as a simulator first.** Live remote authorization requires Airwallex account enablement, so the same decision handler is driven by a synthetic payload in the demo UI and switched to live with `REMOTE_AUTH_MODE`. See [`AIRWALLEX-INTEGRATION.md`](./AIRWALLEX-INTEGRATION.md) §7.

## 11. Open questions

1. **Cardholder KYC.** Real cardholders need name screening and can sit in `PENDING`. How much of that do we surface in the demo UI versus fast-path in sandbox?
2. **Funding.** Cards draw from a wallet balance. The demo needs a funded sandbox wallet, or a mocked balance, for authorizations to succeed. Under D1 this is a single wallet to fund, but it must actually be funded before any authorization will approve.
3. **External attribute sources.** Campaign performance, inventory, and revenue are the most compelling demo attributes but have no real source. Ship a connector interface plus a manual/CSV/webhook attribute-push path so the story is credible without a fake integration.
