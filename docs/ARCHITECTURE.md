# Allocard — Architecture & Implementation Guidelines

Companion to [`PRD.md`](./PRD.md). This describes _how_ to build it, not _what_ to build.

---

## 1. Stack

| Concern               | Choice                                                             | Notes                                                                                                                                                 |
| --------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| App framework         | **Next.js (App Router)**                                           | Server Components by default; Route Handlers for webhooks and machine-to-machine endpoints                                                            |
| Language              | **TypeScript**, strict                                             |                                                                                                                                                       |
| Database              | **MongoDB + Mongoose**                                             | Every model and its indexes declared in one file; schemas typed against the shared domain type so drift is a compile error                            |
| Types & validation    | **Zod as single source of truth**                                  | Zod schema → `z.infer` → domain type → Mongoose model, API contract, and query hook all derive from it. See §4                                        |
| Cache / queue / locks | **Redis**                                                          | Optional for Phase B0–B4, effectively required from B6                                                                                                |
| Auth                  | **Auth.js (NextAuth)** with a Mongoose adapter                     | Credentials (argon2) + **Google** OAuth. Google because Allocard's users are finance and procurement staff living in Google Workspace, not developers |
| Background work       | **A separate worker process**, same codebase                       | Event-driven via Redis Streams; scheduled sweeps as a backstop. BullMQ only when fan-out demands it — see §8                                          |
| Client data layer     | **TanStack Query**                                                 | Exactly one hook per endpoint; no `fetch` in a component, ever. See §4                                                                                |
| UI                    | Tailwind + shadcn/ui                                               | The mock's layout (left nav, project workspace tabs) is a fine starting IA                                                                            |
| Testing               | **Vitest** + `mongodb-memory-server` + recorded Airwallex fixtures | Every endpoint carries the standard matrix in §13                                                                                                     |
| Hosting               | **Railway**                                                        | Two app services off one image — `web` (Next.js) and `worker` (jobs) — plus managed MongoDB and Redis. See §9                                         |

### Why a persistent server, not serverless

Next.js is not the constraint on background work — serverless is. A worker holding a blocking Redis connection cannot exist as a per-request function, which is what rules out BullMQ on Vercel-style hosting. Running Next.js as a long-lived Node process on Railway removes the problem entirely, and the worker becomes a second entrypoint into the same codebase rather than a second application.

The latency requirement points the same way independently. `/api/remote-auth` has a **2.5 second hard ceiling** including network round trip, and a cold start would consume a meaningful share of it — reliably so, since the endpoint is idle between demo runs. A persistent process has no cold start and keeps its Redis connection warm, which is exactly what the single-`GET` policy snapshot design assumes.

### Why Redis is not really optional

Three things need it:

1. **Remote authorization latency.** Airwallex gives you 2.5 seconds to approve or decline. You cannot do a multi-collection Mongo read, evaluate rules, and respond reliably inside that. A pre-computed policy snapshot in Redis, keyed by `card:{cardId}:policy`, makes this a single-digit-millisecond read.
2. **Idempotency and locking.** Webhooks arrive more than once and out of order. `SET NX` on `webhook:{eventId}` and a per-card mutex on `lock:card:{cardId}` prevent double-counting budget and racing card patches.
3. **Rule debounce.** A burst of transactions would otherwise trigger a burst of identical rule evaluations. Coalesce with a short-lived key per `(ruleId, subjectId)`.

Without Redis: cache in-process with a TTL map, dedupe via a unique index on `webhookEvents.eventId`, and accept that remote authorization is simulator-only.

## 2. System shape

Two processes, one codebase, one image. Railway runs them as separate services with different start commands.

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│  web  (next start)              │   │  worker  (tsx src/worker)       │
│                                 │   │                                 │
│  app/(auth)      sign-in/up     │   │  consumers  ← BLOCKing stream   │
│  app/(onboarding) org gate      │   │    events     reads, no polling │
│  app/(app)       dashboard,     │   │    webhooks                     │
│                  projects,      │   │                                 │
│                  cards,         │   │  sweeps (backstop only):        │
│                  approvals      │   │    sweep-rules       5m         │
│                                 │   │    reconcile-drift  15m         │
│  api/webhooks/airwallex         │   │    refresh-attributes           │
│      verify → persist → XADD    │   │    escalate-approvals           │
│  api/remote-auth                │   │    expire-access                │
│      <2.5s, Redis read only     │   │    sync-transactions            │
└──────────────┬──────────────────┘   └──────────────┬──────────────────┘
               │                                     │
               └──────────────┬──────────────────────┘
                              │  both import the same modules
                   ┌──────────▼───────┐      ┌──────────────────┐
                   │ Domain services  │      │ Airwallex client │
                   │  • access        │      │  • auth/token    │
                   │  • budget        │      │  • cardholders   │
                   │  • rules         │◄─────┤  • cards         │
                   │  • cards         │recon.│  • transactions  │
                   │  • approvals     │      │  • config        │
                   └───┬──────────┬───┘      └──────────────────┘
                       │          │
                  ┌────▼───┐ ┌────▼───┐
                  │MongoDB │ │ Redis  │       Railway managed
                  └────────┘ └────────┘
```

The split is by _lifetime_, not by layer. `web` handles anything with a user or an inbound HTTP caller waiting on it; `worker` handles anything on a timer or a queue. Neither owns business logic — both call into `server/services`, so a job and a route handler running the same operation run literally the same function.

### The central loop

```
domain event  →  rule evaluation  →  desired state  →  reconciler  →  Airwallex
     ▲                                                                     │
     └───────────────── webhook (transaction cleared) ◄────────────────────┘
```

Everything else is UI around this loop.

## 3. Directory layout

```
src/
  app/
    (auth)/sign-in/            (auth)/sign-up/
    (onboarding)/create-organization/   (onboarding)/accept-invite/[token]/
    (app)/
      dashboard/
      projects/                      projects/new/
      projects/[projectId]/          overview | budget | people | cards |
                                     controls | activity | settings
      cards/                         approvals/    reports/    settings/
    api/
      webhooks/airwallex/route.ts    remote-auth/route.ts
      health/route.ts                admin/run-job/route.ts   ← ops resync, never the mechanism
  worker/
    index.ts       entrypoint: connect, register jobs, start scheduler, trap SIGTERM
    scheduler.ts   interval registry + distributed lock per job
    jobs/          evaluate-rules.ts, reconcile-cards.ts, refresh-attributes.ts,
                   process-webhooks.ts, escalate-approvals.ts, expire-access.ts,
                   sync-transactions.ts, warm-policy-cache.ts
    consumers.ts   blocking XREADGROUP on the events and webhooks streams
    queue.ts       BullMQ wiring — only if §7's criteria are met
  shared/          ← imports nothing from server/ or client/
    schemas/       Zod: project.ts, card.ts, rule.ts, budget.ts, …
    types/         z.infer re-exports — the only types the client imports
    contracts/     per-endpoint input/output definitions
    enums/         ProjectStatus, Permission, CardPurpose, LimitInterval, …
    constants/     role templates, permission matrix defaults
  server/
    db/            connect.ts (cached across HMR), indexes.ts
    models/        one file per model: schema + indexes + plugins + toDomain
                   Project.ts, Card.ts, Rule.ts, BudgetEntry.ts, …
    repositories/  one per model; every method takes an OrgContext,
                   returns domain types — never HydratedDocument
    services/
      access/      permissions.ts, scopes.ts, effective.ts
      budget/      ledger.ts, formulas.ts
      cards/       provisioning.ts, reconciler.ts, controls.ts, funding.ts
      rules/       registry.ts, evaluator.ts, actions.ts, scheduler.ts
      approvals/   routing.ts, escalation.ts
      audit/       log.ts
    airwallex/     client.ts, cardholders.ts, cards.ts, transactions.ts,
                   webhooks.ts, fixtures/
    events/        bus.ts, handlers/
    http/          withAuth.ts, withValidation.ts, errors.ts, respond.ts
  client/
    api/           typed fetch client generated off shared/contracts
    hooks/         one file per domain: useProjects, useCards, useRules, …
    queryKeys.ts   the single key factory
    providers/     QueryClientProvider, session, toast
  lib/             money.ts, dates.ts, formula/, format.ts
  components/
    ui/            primitives (shadcn-derived)
    patterns/      composed app-level components
  test/
    helpers/       db.ts (memory server), auth.ts (session factories),
                   factories/ (org, project, member, card builders)
```

**Rule of thumb:** Route Handlers and Server Actions do authentication, validation, and orchestration. They contain no business logic. All business logic lives in `server/services` and is unit-testable without a request.

## 4. Type system & shared contracts

Frontend and backend share one set of types, and there is exactly one place each shape is declared. Nothing is hand-mirrored, so the two halves cannot silently disagree.

### The chain

```
src/shared/schemas/project.ts        Zod           ← the only place the shape is written
        │
        ├─ z.infer ──────────────►  shared/types/project.ts     Project
        │                                   │
        │                                   ├──► server/models/Project.ts
        │                                   │      new Schema<Project>({...})
        │                                   │      divergence = compile error
        │                                   │
        │                                   └──► client/hooks/useProjects.ts
        │                                          UseQueryResult<Project[]>
        │
        └─ contracts ────────────►  shared/contracts/project.ts
                                       input + output per endpoint,
                                       consumed by the route handler AND the hook
```

```
src/shared/
  schemas/     Zod objects — domain shapes and input validation
  types/       z.infer re-exports; the only types the client imports
  contracts/   per-endpoint { method, path, input, output } definitions
  enums/       shared literal unions: ProjectStatus, Permission, CardPurpose, …
  constants/   role templates, permission lists, interval enums
```

`src/shared` may not import from `src/server` or `src/client`. Enforce it with an ESLint boundary rule — it's the one import direction that, once violated, drags server-only code (and secrets) into the client bundle.

### Contracts

Each endpoint declares its input and output once:

```ts
// src/shared/contracts/project.ts
export const projectContracts = {
  list: {
    method: 'GET',
    path: '/api/projects',
    input: listProjectsQuery,
    output: z.array(projectSchema),
  },
  create: {
    method: 'POST',
    path: '/api/projects',
    input: createProjectInput,
    output: projectSchema,
  },
  get: { method: 'GET', path: '/api/projects/:id', input: z.void(), output: projectDetailSchema },
} as const

export type ProjectContracts = typeof projectContracts
```

The route handler parses `input` and its return type is checked against `output`. The query hook infers both. Adding a field to the Zod schema surfaces immediately on both sides; removing one breaks the build rather than the runtime.

### IDs and the ObjectId boundary

The classic source of FE/BE drift. Fix it by convention:

- **Domain types use `string` for every id.** The client never sees an `ObjectId`.
- **Conversion happens in the repository**, via a `toDomain()` mapper and a `toJSON` transform on every schema.
- **Mongoose documents never leave `server/repositories`.** Services and route handlers receive plain domain objects. `HydratedDocument<T>` appears only inside a repository file.

```ts
// server/models/base.ts — applied to every schema
schema.set('toJSON', {
  virtuals: true,
  versionKey: false,
  transform: (_doc, ret) => {
    ret.id = ret._id.toString()
    delete ret._id
    return ret
  },
})
```

This is what keeps `Project` a single type rather than three near-identical ones.

### Dates and money

- **Dates** cross the wire as ISO 8601 strings. Zod schemas use `z.string().datetime()`, Mongoose stores real `Date`s, and the mapper converts. Never send a `Date` object and hope `JSON.stringify` does the right thing on both ends.
- **Money** is stored as an integer of minor units (cents) with an explicit currency, never a float. `{ amount: 402350, currency: 'USD' }` is $4,023.50. Formatting is a client concern; arithmetic is a server one. The formula evaluator in [`RULES-ENGINE.md`](./RULES-ENGINE.md) §3 operates on minor units throughout.

## 5. Data model (Mongoose)

Collections, with the fields that matter. Every tenant-owned document carries `orgId`.

### The model pattern

Every model file follows the same shape, so all of them are reviewable at a glance. The `Schema<Project>` annotation is doing real work: if the Zod schema gains a field the Mongoose schema lacks, this file stops compiling.

```ts
// src/server/models/Project.ts
import { Schema, model, models, type Model, type HydratedDocument } from 'mongoose'
import type { Project } from '@/shared/types/project'
import { ProjectStatus } from '@/shared/enums'
import { baseOptions, tenantScoped } from './base'

const projectSchema = new Schema<Project, Model<Project>>(
  {
    orgId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true },
    status: {
      type: String,
      enum: Object.values(ProjectStatus),
      required: true,
      default: ProjectStatus.DRAFT,
    },
    ownerId: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    workstreams: [{ id: String, name: String }],
  },
  baseOptions,
)

projectSchema.plugin(tenantScoped) // see §6, invariant 1
projectSchema.index({ orgId: 1, code: 1 }, { unique: true })
projectSchema.index({ orgId: 1, status: 1, updatedAt: -1 })

export type ProjectDoc = HydratedDocument<Project>
export const ProjectModel = (models.Project ??
  model<Project>('Project', projectSchema)) as Model<Project>
```

Four conventions that apply to every model:

1. **`models.X ?? model(...)`** — Next.js hot reload re-executes modules, and re-registering a model throws `OverwriteModelError`. This guard is not optional.
2. **Indexes live beside the schema**, not in a separate migration file, so a reviewer sees the access pattern and the index together.
3. **`baseOptions`** supplies `timestamps: true`, the `toJSON` transform from §4, and `strict: 'throw'` so an unknown field is an error rather than a silent drop.
4. **`tenantScoped`** is a plugin that asserts `orgId` is present in the filter of every `find`/`update`/`delete`. Details in §6.

### Identity

```ts
users            { _id, email, name, image, passwordHash?, createdAt,
                   defaultOrgId?, onboardingCompletedAt? }

organizations    { _id, name, slug, country, baseCurrency, costCentres[],
                   airwallexAccountId?,        // null under D1; the connected-account
                                               // seam — present from day one so the
                                               // migration never adds a field
                   settings: { defaultApprovalPolicy, notifications },
                   createdBy, createdAt }

memberships      { _id, orgId, userId, orgRole: OWNER|ADMIN|MEMBER,
                   status: ACTIVE|SUSPENDED, joinedAt }

invites          { _id, orgId, email, orgRole, token, expiresAt,
                   status: PENDING|ACCEPTED|REVOKED|EXPIRED, invitedBy }
```

> **Onboarding gate:** a user is onboarded iff they have at least one `ACTIVE` membership. Do not store it as a mutable boolean on `users` — derive it, and cache the derived value on the session.

### Projects & access

```ts
projects         { _id, orgId, name, code, description, status,
                   ownerId, costCentre, startDate, endDate,
                   workstreams: [{ id, name }],
                   cardStructure: { shared, perMember, vendor, oneTime },
                   approvedAt, launchedAt, closedAt }

roles            { _id, orgId, key, name, isTemplate, permissions: Permission[],
                   defaultScope?: AccessScope }

projectMembers   { _id, orgId, projectId, userId, roleId,
                   scope: AccessScope,
                   effectivePermissions: Permission[],   // materialised cache
                   addedBy, addedAt, removedAt? }
```

```ts
type AccessScope = {
  level: 'PROJECT' | 'WORKSTREAM' | 'CATEGORY' | 'CARD' | 'OWN' | 'ASSIGNED_MEMBERS'
  workstreamIds?: string[]
  categoryIds?: string[]
  cardIds?: string[]
  memberIds?: string[]
  validFrom?: Date
  validTo?: Date // drives "expire temporary access"
}
```

### Budget

Budget is an **append-only ledger**, not a mutable number. Balances are projections.

```ts
budgets          { _id, orgId, projectId, currency,
                   approvedAmount, formula?: string,
                   categories: [{ id, name, workstreamId?, allocated, formula? }] }

budgetEntries    { _id, orgId, projectId, categoryId?,
                   type: APPROVAL | COMMITMENT | ACTUAL | RELEASE | ADJUSTMENT,
                   amount, currency,
                   sourceType: PURCHASE_REQUEST | AUTHORIZATION | TRANSACTION |
                               MANUAL | RULE,
                   sourceId, createdBy, createdAt, note }

budgetChangeRequests { _id, orgId, projectId, requestedBy, deltaAmount,
                       reason, status, decidedBy, decidedAt }
```

Projection:

```
approved  = Σ(APPROVAL) + Σ(ADJUSTMENT)
committed = Σ(COMMITMENT) − Σ(RELEASE)     // approved requests + pending auths
actual    = Σ(ACTUAL)                       // cleared transactions
remaining = approved − committed − actual
```

Store the projection on `projects.budgetSnapshot` and in Redis, recomputed on every ledger write. Never let the rules engine sum the ledger inline — it's on the hot path.

### Attributes & rules

```ts
attributeDefinitions { _id, orgId, key,            // 'project.budget.remaining'
                       label, type: NUMBER|STRING|BOOLEAN|DATE|ENUM,
                       unit?, scope: ORG|PROJECT|MEMBER|CARD,
                       source: COMPUTED|MANUAL|CONNECTOR|WEBHOOK,
                       connectorId?, refreshIntervalSec? }

attributeValues      { _id, orgId, key, subjectType, subjectId,
                       value, observedAt, source, ttlSec? }

rules                { _id, orgId, scope: { level, projectId? },
                       name, description, enabled, priority,
                       trigger: RuleTrigger,
                       when: Condition,
                       then: Action[], else?: Action[],
                       createdBy, updatedAt, version }

ruleRuns             { _id, orgId, ruleId, triggeredBy, triggerEvent,
                       inputs: Record<string, unknown>,
                       matched: boolean,
                       desiredState, diff, actions: ActionResult[],
                       status: SUCCESS|PARTIAL|FAILED|SKIPPED|DRY_RUN,
                       durationMs, startedAt }
```

### Cards & money

```ts
cardholders     { _id, orgId, userId?, airwallexCardholderId,
                  type: INDIVIDUAL|DELEGATE,
                  status: INCOMPLETE|PENDING|READY|DISABLED|DELETED }

cards           { _id, orgId, projectId?, categoryId?, cardholderId,
                  airwallexCardId, maskedNumber, nickName,
                  purpose: SHARED|MEMBER|VENDOR|ONE_TIME,
                  status,                            // mirrors Airwallex
                  desiredControls: AuthorizationControls,   // what rules want
                  appliedControls: AuthorizationControls,   // last pushed
                  lastReconciledAt, managedByRuleIds[],
                  accessList: userId[] }

transactions    { _id, orgId, cardId, projectId,
                  airwallexTransactionId, cardTransactionId, lifecycleId,
                  type: AUTHORIZATION|CLEARING|REVERSAL_AUTH,
                  status, amount, currency, billingAmount, billingCurrency,
                  merchant: { name, mcc, country },
                  failureReason?, receiptFileId?, transactedAt }

purchaseRequests { _id, orgId, projectId, requestedBy, amount, currency,
                   categoryId?, vendor, description, justification,
                   policyDecision: { outcome, reasons[], requiredApprovals },
                   status: DRAFT|PENDING|APPROVED|REJECTED|EXPIRED,
                   cardId?, approvals: [{ approverId, decision, reason, at }] }

auditLogs       { _id, orgId, projectId?, actorType: USER|RULE|SYSTEM|AIRWALLEX,
                  actorId, action, subjectType, subjectId,
                  before?, after?, metadata, at }

webhookEvents   { _id, eventId, name, accountId?, payload,
                  receivedAt, processedAt?, status, attempts, error? }
```

### Indexes

```js
memberships:      { orgId: 1, userId: 1 } unique
projectMembers:   { orgId: 1, projectId: 1, userId: 1 } unique (partial: removedAt null)
budgetEntries:    { orgId: 1, projectId: 1, createdAt: -1 }
attributeValues:  { orgId: 1, key: 1, subjectType: 1, subjectId: 1 } unique
cardholders:      { orgId: 1, userId: 1 } unique (partial: userId exists)
                  // keyed per-org, not per-user: under connected accounts the same
                  // person in two orgs is two Airwallex cardholder records
cards:            { orgId: 1, airwallexCardId: 1 } unique
                  { orgId: 1, projectId: 1, status: 1 }
transactions:     { orgId: 1, airwallexTransactionId: 1 } unique
webhookEvents:    { eventId: 1 } unique          ← idempotency without Redis
ruleRuns:         { orgId: 1, ruleId: 1, startedAt: -1 }
auditLogs:        { orgId: 1, at: -1 }, { orgId: 1, subjectType: 1, subjectId: 1 }
```

## 6. Tenancy and authorization

Three invariants, enforced structurally rather than by discipline.

Invariant 3 exists because of decision **D1** in [`PRD.md`](./PRD.md) §10: all organisations share one Airwallex account, so Airwallex will happily return another tenant's cards. It is not a backstop — it _is_ the tenant boundary for anything card-related.

**1. No repository method may be called without an org context.**

```ts
type OrgContext = { orgId: string; userId: string; orgRole: OrgRole }

// every repository takes it as the first argument, and every query
// interpolates ctx.orgId — there is no overload that omits it
export async function listProjects(ctx: OrgContext, filter: ProjectFilter): Promise<Project[]> {
  const docs = await ProjectModel.find({ orgId: ctx.orgId, ...filter }).lean()
  return docs.map(toDomain)
}
```

Mongoose lets you enforce this rather than trust it. The `tenantScoped` plugin throws if a query on a tenant-owned model reaches the driver without an `orgId` in its filter:

```ts
// src/server/models/base.ts
export function tenantScoped(schema: Schema) {
  const guarded = [
    'find',
    'findOne',
    'findOneAndUpdate',
    'updateOne',
    'updateMany',
    'deleteOne',
    'deleteMany',
    'countDocuments',
  ]
  schema.pre(guarded, function () {
    const filter = this.getFilter()
    if (!filter.orgId && !this.getOptions().allowCrossTenant) {
      throw new Error(`Tenant scope missing on ${this.model.modelName}.${this.op}`)
    }
  })
}
```

A forgotten `orgId` becomes a loud failure in development and in tests, instead of a quiet cross-tenant read in production. The `allowCrossTenant` escape hatch exists for worker sweeps that legitimately iterate all orgs, and every use of it should be greppable and few.

**2. Every mutation asserts a permission before it runs.**

```ts
await requirePermission(ctx, 'card.create', { projectId })
```

`requirePermission` resolves the caller's `projectMembers` record, computes effective permissions, and checks the access scope against the subject. Org `OWNER`/`ADMIN` short-circuits to allow.

**3. The Airwallex client exposes no unfiltered read.**

```ts
// applies { 'metadata.orgId': ctx.orgId } internally — there is no way to omit it
cards.list(ctx: OrgContext, filter?: CardFilter)

// the only escape hatch, used by reconciliation jobs alone.
// the name is the control: it should never survive code review in a request path.
cards.listAllTenantsUnsafe()
```

Every card written through this client carries `metadata.orgId` and `metadata.projectId`, and every read filters on them. Under a future connected-account model the filter becomes redundant rather than wrong, so no read path changes.

### Effective permissions

Deterministic, pure, and the same function powers both the preview UI and runtime enforcement:

```ts
function computeEffectivePermissions(input: {
  orgRole: OrgRole
  role: Role
  scope: AccessScope
  now: Date
}): { permissions: Permission[]; scope: AccessScope; reasons: string[] }
```

Rules of composition:

- Start from the role's permission set.
- Time-bounded scopes outside their window yield an empty set.
- Scope narrows _which subjects_ a permission applies to; it never adds permissions.
- Org role can only widen (Owner/Admin), never silently narrow a project role.
- `reasons[]` explains each grant and denial — this is what the preview screen renders.

Materialise the result onto `projectMembers.effectivePermissions` on write, and recompute it wholesale on any role, scope, or role-definition change. Never patch it incrementally.

## 7. Event bus

Domain events are the trigger surface for the rules engine. Keep them as an explicit, typed list.

```ts
type DomainEvent =
  | 'project.created'
  | 'project.approved'
  | 'project.launched'
  | 'project.closing'
  | 'project.closed'
  | 'budget.approved'
  | 'budget.updated'
  | 'budget.threshold_crossed'
  | 'member.added'
  | 'member.role_changed'
  | 'member.scope_changed'
  | 'member.removed'
  | 'card.created'
  | 'card.status_changed'
  | 'card.limit_updated'
  | 'request.created'
  | 'request.approved'
  | 'request.rejected'
  | 'request.escalated'
  | 'transaction.authorized'
  | 'transaction.cleared'
  | 'transaction.declined'
  | 'transaction.reversed'
  | 'attribute.updated'
  | 'schedule.tick'
```

Emit inside the same code path that mutates state, publish after the write commits, and consume asynchronously. Each event carries `{ orgId, projectId?, subjectType, subjectId, payload, emittedAt }`.

**Transport: a Redis Stream, consumed with a blocking read.** `XADD` on publish; the worker holds `XREADGROUP ... BLOCK 0` open. That gives push semantics with no polling interval — the worker wakes within milliseconds of an event being written — plus at-least-once delivery, acks, and a pending-entries list so a worker crash mid-job doesn't lose the event. This is the mechanism by which everything stays current; see §7.

## 8. Background work

**Events drive the system. Schedules are a backstop. Manual triggers are an ops tool.**

When an attribute changes, the affected cards must converge within seconds without anyone waiting for a tick. A polling interval as the primary mechanism would make the product's central claim — that limits track reality — false by up to the length of the interval. The scheduled sweeps below exist to catch what the event path missed, not to do the work.

### Path 1 — Event-driven (the mechanism)

Every state change publishes a domain event (§6) and the worker is blocked on the stream waiting for it. There is no interval on this path.

```
attribute written  →  XADD attribute.updated  →  worker wakes (ms)
                   →  evaluate affected rules
                   →  write desired state
                   →  patch Airwallex
```

Two writes happen when a rule produces new state, and they have deliberately different latency profiles:

| Write                    | Where                         | When                                 | Why                                                                                                                             |
| ------------------------ | ----------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Policy snapshot          | Redis `policy:card:{id}`      | **Synchronously, in the evaluation** | Governs real-time decisions. A Redis write is single-digit ms, so there is no reason to defer it.                               |
| `authorization_controls` | Airwallex, via the reconciler | Async, retried                       | An HTTP call that can fail or be slow. Desired state is already persisted, so a failure just means the next attempt applies it. |

Splitting them matters: the snapshot that `/api/remote-auth` reads is current the instant the rule evaluates, even if the Airwallex patch is still in flight.

### Path 2 — Scheduled (the backstop)

| Job                  | Interval                           | Why it exists                                                                                                                                            |
| -------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `sweep-rules`        | 5 min                              | Catch subjects whose event was lost, and re-evaluate time-dependent conditions (`project.daysRemaining`, `active_to` boundaries) that no event announces |
| `reconcile-drift`    | 15 min                             | Re-diff desired vs applied controls; repair anything Airwallex rejected or that changed outside Allocard                                                 |
| `refresh-attributes` | Per-attribute `refreshIntervalSec` | Poll connector-sourced attributes that have no push mechanism                                                                                            |
| `escalate-approvals` | 10 min                             | Escalate requests past their SLA — inherently time-based                                                                                                 |
| `expire-access`      | Hourly                             | Revoke scopes past `validTo` — inherently time-based                                                                                                     |
| `sync-transactions`  | 30 min                             | Backstop for missed Airwallex webhooks                                                                                                                   |

Note that three of these are _genuinely_ time-triggered: nothing happens in the world when an approval breaches its SLA or an access scope expires, so only a clock can notice. Those aren't compensating for a weak event path.

### The one case where latency is inherent

A poll-only attribute cannot beat its own refresh interval. If `campaign.roas` comes from an analytics API with no webhook, you cannot know it changed until you look, so `refreshIntervalSec` is the floor on end-to-end latency. That's a property of the data source, not a flaw in the architecture — but it should be visible in the UI. Show `observedAt` next to any attribute driving a limit, so nobody assumes a number is live when it's fifteen minutes old.

Where a source _can_ push, make it push: the attribute ingest webhook (`WEBHOOK` source in [`RULES-ENGINE.md`](./RULES-ENGINE.md) §2) takes the same path as any other event and lands in under a second.

### Latency budget

| From → to                                                  | Target                     |
| ---------------------------------------------------------- | -------------------------- |
| Attribute write → policy snapshot updated                  | < 100 ms                   |
| Attribute write → rules evaluated, desired state persisted | < 1 s                      |
| Desired state → Airwallex controls patched                 | 1–5 s                      |
| Airwallex authorization → budget ledger updated            | < 2 s from webhook receipt |
| Anything the event path dropped → repaired by sweep        | < 15 min                   |

Treat the last row as an alarm, not a target. If sweeps are routinely finding work to do, the event path is broken and the sweep is masking it. Emit a metric for "changes first applied by sweep rather than by event" and keep it near zero.

### Concurrency control

Immediate evaluation plus a burst of transactions would mean a burst of near-identical evaluations. Coalesce rather than throttle:

- **Trailing debounce per subject.** `lock:rule:{ruleId}:{subjectId}` with a ~1s window: the first event schedules an evaluation, subsequent events inside the window collapse into it. Twenty transactions land one evaluation about a second after the burst settles, not twenty over five minutes.
- **Per-card mutex** on `lock:card:{cardId}` around the Airwallex patch, so two evaluations can never race a card into an inconsistent state.
- **Per-job lock** on `lock:job:{name}` for scheduled sweeps, so extra worker replicas don't double-run them.

### Implementation shape

Both paths call the same functions. The worker entrypoint wires them up:

```ts
// src/worker/index.ts
consume('events', onDomainEvent) // blocking XREADGROUP — no interval
consume('webhooks', onAirwallexWebhook) // blocking XREADGROUP — no interval

schedule('sweep-rules', { everyMs: 5 * 60_000 })
schedule('reconcile-drift', { everyMs: 15 * 60_000 })
schedule('refresh-attributes', { everyMs: 60_000 }) // checks per-attribute TTLs
schedule('escalate-approvals', { everyMs: 10 * 60_000 })
schedule('expire-access', { everyMs: 60 * 60_000 })
schedule('sync-transactions', { everyMs: 30 * 60_000 })
```

Job bodies stay as plain functions in `server/services`; `consume` and `schedule` only decide _when_. That's what keeps a later BullMQ migration confined to this file.

### When to add BullMQ

Redis Streams already give you push delivery, acks, and crash recovery, so add BullMQ only when you need something it doesn't provide:

- Per-job exponential backoff with a dead-letter queue, rather than the reconciler simply retrying on its next pass.
- Fan-out where one `budget.updated` must reconcile hundreds of cards as independently retryable jobs instead of one sequential pass.
- Scheduled/delayed jobs — "escalate this specific request in 4 hours" — instead of sweeping for overdue rows.

It needs no new infrastructure, and slots in behind the same `consume`/`schedule` surface.

### Operational controls (not a demo crutch)

`POST /api/admin/run-job` — gated on org `OWNER` plus a shared secret — forces a named job or a resync of one card or project. It's a legitimate ops affordance: an Airwallex 5xx left a card stale and you want it repaired now rather than at the next sweep.

It is explicitly **not** how correctness is achieved. If a demo needs someone to click it for limits to move, the event path is broken — and the demo is unconvincing anyway, because the entire pitch is that nobody had to touch anything.

## 9. Deployment (Railway)

Four services in one Railway project, built from a single repository.

| Service  | Start command             | Notes                                                           |
| -------- | ------------------------- | --------------------------------------------------------------- |
| `web`    | `next start`              | Public. Holds the Airwallex webhook URL and `/api/remote-auth`. |
| `worker` | `tsx src/worker/index.ts` | No public domain. Scales independently of `web`.                |
| `mongo`  | Railway plugin            | Or MongoDB Atlas if you want change streams and better backups. |
| `redis`  | Railway plugin            | Reachable over the private network.                             |

Both application services build from the same Dockerfile and differ only in start command, so there is exactly one image and no possibility of the two drifting apart.

```json
{
  "scripts": {
    "dev": "next dev",
    "dev:worker": "tsx watch src/worker/index.ts",
    "build": "next build",
    "start": "next start",
    "worker": "tsx src/worker/index.ts"
  }
}
```

### Practical notes

- **Use Railway's private network** for Mongo and Redis (`redis.railway.internal`). It keeps traffic off the public internet and avoids egress charges. Reference connection strings via Railway's variable references rather than pasting them into both services.
- **Shared variables** for anything both services read — `MONGODB_URI`, `REDIS_URL`, `AIRWALLEX_*`. Define once at project level, not per service.
- **`worker` needs no public domain.** Don't give it one. It has no HTTP surface to expose.
- **Handle `SIGTERM` in the worker.** Railway sends it on redeploy. Stop accepting new jobs, let the in-flight one finish, release its lock, then exit. Without this, a deploy mid-reconcile leaves `lock:job:{name}` held until its TTL expires.
- **Health check on `web`** at `/api/health`, verifying Mongo and Redis connectivity, so Railway doesn't route traffic to a half-started instance.
- **Keep one worker replica** for the demo. The job locks make more replicas correct, but there is no load to justify them.
- **Railway Cron** exists and can trigger a service on a schedule, but it's unnecessary here — the worker's own scheduler is simpler and keeps the timing logic in code where it's reviewable and testable.

### Webhook URL

Airwallex webhook subscriptions point at the `web` service's public domain: `https://{app}.up.railway.app/api/webhooks/airwallex`. Railway domains are stable across deploys, so this survives redeploys — but it changes if you rename the service, which then silently breaks webhook delivery. If the demo depends on it, put a custom domain in front.

For local development, tunnel with `ngrok` or `cloudflared` and register a second webhook subscription against the tunnel URL. Each subscription has its own secret, so keep them in separate env files.

## 10. Redis key conventions

```
policy:card:{cardId}              → JSON policy snapshot   (TTL 1h, refreshed on change)
budget:project:{projectId}        → { approved, committed, actual, remaining }
webhook:{eventId}                 → SET NX, TTL 24h        (idempotency)
lock:card:{cardId}                → SET NX PX 10000        (mutex on card patches)
lock:rule:{ruleId}:{subjectId}    → SET NX PX 5000         (debounce)
lock:job:{jobName}                → SET NX PX 60000        (one worker replica per job tick)
aw:token                          → Airwallex access token (TTL = expiry − 60s)
rate:remote-auth:{cardId}         → sliding window counter
```

## 11. Security

- **Never handle a PAN.** Sensitive card details render only through Airwallex secure iframes. There is no code path in this application that receives a card number.
- **Server-only secrets.** `AIRWALLEX_CLIENT_ID`, `AIRWALLEX_API_KEY`, `AIRWALLEX_WEBHOOK_SECRET`, `MONGODB_URI`, `REDIS_URL`, `AUTH_SECRET` — none prefixed `NEXT_PUBLIC_`. Validate their presence at boot with Zod and fail fast.
- **Verify webhook signatures on the raw body.** In a Route Handler, read `await req.text()` and HMAC that string — never a re-serialised object. Compare in constant time.
- **Rate-limit** sign-in, invite acceptance, and the remote-auth endpoint.
- **Log carefully.** Card IDs and masked numbers are fine. Tokens, PANs, CVVs, and full webhook payloads containing them are not.
- **Audit before you respond.** Write the audit entry in the same transaction-ish unit as the mutation, so a failed response never loses the record of what happened.

## 12. Environment

```bash
MONGODB_URI=
MONGODB_DB=allocard
REDIS_URL=

AUTH_SECRET=
AUTH_URL=http://localhost:3000
AUTH_GOOGLE_ID=                                     # optional — omit to run email/password only
AUTH_GOOGLE_SECRET=

AIRWALLEX_BASE_URL=https://api-demo.airwallex.com   # sandbox
AIRWALLEX_CLIENT_ID=
AIRWALLEX_API_KEY=
AIRWALLEX_WEBHOOK_SECRET=
AIRWALLEX_API_VERSION=2024-02-22
AIRWALLEX_ACCOUNT_ID=                                # blank = single-account mode (D1);
                                                     # set per-org later for x-on-behalf-of

REMOTE_AUTH_MODE=simulate                            # simulate | live

# process role — the worker sets ROLE=worker, web leaves it unset.
# index.ts refuses to start a scheduler unless ROLE=worker, so a
# misconfigured web replica can never start running jobs.
ROLE=
ADMIN_JOB_SECRET=                                    # guards POST /api/admin/run-job
WORKER_SCHEDULER_ENABLED=true                        # off for local UI-only work
```

## 13. Testing

Backend phases are reviewed by reading their tests as much as their code, so the tests are a deliverable, not an afterthought. Every backend phase in [`phases/`](./phases/) ships green before its review.

### Layers

| Layer       | Tool                                    | Covers                                                                                                                          |
| ----------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Unit        | Vitest                                  | Pure functions: `computeEffectivePermissions`, the formula evaluator, budget projection, the controls diff, the merge semantics |
| Integration | Vitest + `mongodb-memory-server`        | Repositories and services against a real Mongo, including index and tenancy-plugin behaviour                                    |
| API         | Vitest, route handlers invoked directly | The full matrix below, per endpoint                                                                                             |
| Contract    | Recorded fixtures                       | The Airwallex client, replayed. **Tests never hit the network.**                                                                |

Invoke Route Handlers directly rather than booting a server — they're plain functions taking a `Request`. It's faster and gives typed access to the response body.

```ts
const res = await POST(buildRequest({ session, body }))
expect(res.status).toBe(201)
```

### The standard endpoint matrix

Every endpoint gets these cases. A phase is not reviewable until each row is either a passing test or an explicit, justified N/A.

| #   | Case                                                     | Expected                                                       |
| --- | -------------------------------------------------------- | -------------------------------------------------------------- |
| 1   | Unauthenticated                                          | `401`                                                          |
| 2   | Authenticated, no organisation                           | `403` + `ONBOARDING_INCOMPLETE`                                |
| 3   | Member of a _different_ org requests this org's resource | `404`, never `403` — a 403 confirms the resource exists        |
| 4   | Authenticated, lacks the required permission             | `403` + the permission name                                    |
| 5   | Access scope excludes the subject                        | `403`                                                          |
| 6   | Invalid payload (per field)                              | `422` + field-level errors                                     |
| 7   | Happy path                                               | `2xx` + response parses against the contract's `output` schema |
| 8   | Not found                                                | `404`                                                          |
| 9   | Repeated mutation with the same idempotency key          | Same result, one side effect                                   |
| 10  | Audit entry written                                      | Exactly one, with the right actor and subject                  |

Rows 3 and 10 are the ones that catch real bugs. Assert the response body against the contract schema in row 7 — that's what stops the API drifting from the type the client was built against.

### Fixtures and factories

```ts
// test/helpers/factories
const org = await makeOrg()
const admin = await makeMember(org, { orgRole: 'OWNER' })
const spender = await makeMember(org, { roleKey: 'PROJECT_SPENDER' })
const project = await makeProject(org, { budget: money(50_000, 'USD') })
```

Factories take partial overrides and fill the rest with valid defaults. Without them, permission tests become unreadable setup blocks and people stop writing them.

### Seed script

One command — `pnpm seed` — that creates an org, three projects at different lifecycle stages, eight members spanning all seven roles, a handful of rules, cards, and a transaction history. It backs both local development and the demo. The demo lives or dies on this script, so it's a Phase B0 deliverable, not a last-minute one.

### Coverage expectations

Not a percentage target. Concretely: every service function that makes an authorization decision, moves money, or mutates a card must have a test. Everything else is discretionary.
