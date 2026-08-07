# B6 — Attributes & Rules Engine

**Track:** Backend · **Depends on:** B5 · **Powers:** A6

## Goal

The phase that makes Allocard Allocard. Card controls stop being typed and start being derived. Also the phase that introduces the `worker` process.

Read [`../../RULES-ENGINE.md`](../../RULES-ENGINE.md) first — this phase implements it.

## Deliverables

### Models

| Model | Notes |
| --- | --- |
| `AttributeDefinition` | orgId, key, label, type, unit?, scope, source, connectorId?, refreshIntervalSec? |
| `AttributeValue` | orgId, key, subjectType, subjectId, value, observedAt, source, ttlSec?; unique on `(orgId, key, subjectType, subjectId)` |
| `Rule` | orgId, scope, name, enabled, priority, trigger, when, then[], else[]?, version |
| `RuleRun` | orgId, ruleId, triggeredBy, triggerEvent, inputs, matched, desiredState, diff, actions[], status, durationMs |

### Attribute registry

Built-in computed attributes first (project status, budget projections, headcount, days remaining, member role and month-to-date spend, card status and remaining limits). Then custom attributes with three sources: `MANUAL`, `WEBHOOK` (ingest endpoint), and `CONNECTOR` (one stub connector so the path is demonstrably wired).

Every value carries `observedAt` and optional `ttlSec`. A rule reading a stale attribute **skips with a recorded reason** rather than acting — and never falls back to zero, because a silent `0` becomes a `$0` limit that looks like an outage.

### Evaluation pipeline

Eight steps, per §4 of the rules engine doc. Steps 1–6 are pure and side-effect free; that boundary is what makes simulation free.

```
select rules → build context → evaluate → resolve targets
             → merge desired state → diff → apply → record
```

Merge semantics: limits take `min`, allowlists intersect, blocklists union, `activeFrom` takes `max`, `activeTo` takes `min`, status takes the most restrictive. **An impossible merge — empty currency intersection, `activeFrom > activeTo` — is a `PARTIAL` run with a recorded conflict, never a push.**

### Formula extension

Extend B4's parser with attribute identifier resolution. Same sandbox rules; the allowlist does not grow.

### Stateful operators

`crossedAbove` and `crossedBelow` compare against the previous value stored on the last `RuleRun`. These are what make threshold rules fire once rather than on every evaluation while the condition holds.

### The worker process

B6 introduces `src/worker/`:

- Blocking `XREADGROUP` consumers on the events stream — **this is the mechanism**
- Scheduled sweeps as a backstop only (see [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) §8)
- Trailing debounce per `(ruleId, subjectId)` so a burst of events coalesces into one evaluation
- `SIGTERM` handling that finishes the in-flight job and releases its lock

### Two writes on evaluation

When a rule produces new state, write the Redis policy snapshot **synchronously** and patch Airwallex **asynchronously**. The snapshot governs B8's real-time decisions and must be current the instant the rule evaluates.

### Simulation

The same pipeline, stopped after step 6, with optional attribute overrides. Returns the per-card diff without touching Airwallex. This is the most persuasive screen in the demo, and it costs almost nothing once steps 1–6 are pure.

## Endpoints

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/attributes` | `control.edit` | Registry |
| `POST` | `/api/attributes` | `control.edit` | Define a custom attribute |
| `PATCH` | `/api/attributes/:key` | `control.edit` | |
| `GET` | `/api/attributes/values` | `control.edit` | Current values with `observedAt` |
| `PUT` | `/api/attributes/values` | `control.edit` | Set a `MANUAL` value |
| `POST` | `/api/attributes/ingest` | signed secret | External push; emits `attribute.updated` |
| `GET` | `/api/rules` | `control.edit` | Org and project scoped |
| `POST` | `/api/rules` | `control.edit` | |
| `PATCH` | `/api/rules/:id` | `control.edit` | Bumps `version` |
| `DELETE` | `/api/rules/:id` | `control.edit` | |
| `POST` | `/api/rules/:id/enable` | `control.edit` | Enable / disable |
| `POST` | `/api/rules/validate` | `control.edit` | Parses the DSL; powers inline builder validation |
| `POST` | `/api/rules/simulate` | `control.edit` | Dry run, with optional attribute overrides |
| `GET` | `/api/rule-runs` | `control.edit` | Automation history; filter by rule, card, project, status |
| `GET` | `/api/rule-runs/:id` | `control.edit` | Inputs, matched conditions, diff, actions |
| `GET` | `/api/cards/:id/explain` | `card.view` | **Which rules govern this card, which values they used, how the merge produced the number** |

`/api/cards/:id/explain` turns the engine from a black box into a feature. Do not let it slip.

## Events

Consumes everything. Emits `rule.evaluated`, `card.limit_updated`, plus whatever actions produce.

## Tests

Beyond the standard matrix:

- Determinism: identical inputs produce identical desired state, asserted over many runs
- Merge semantics for every field, including three rules targeting one card
- An impossible merge yields `PARTIAL` with a conflict and makes no Airwallex call
- Priority breaks ties, and a freeze beats any computed limit
- `crossedBelow` fires once on crossing, not repeatedly while below
- A stale attribute causes `SKIPPED` with the key named, never a zero limit
- A missing attribute fails the run rather than defaulting
- Simulation produces exactly the diff that a real run would apply, from the same fixtures
- Simulation makes zero Airwallex calls and zero writes
- One failing rule does not prevent other rules from applying
- An Airwallex failure leaves desired state persisted and the card retryable
- The debounce coalesces twenty events into one evaluation
- The policy snapshot is written before the pipeline returns
- The five worked examples from [`../../RULES-ENGINE.md`](../../RULES-ENGINE.md) §6 each pass end to end against fixtures

## Review checklist

- [ ] Steps 1–6 are pure — verifiable by simulation making no writes
- [ ] Desired state is recomputed wholesale, never patched
- [ ] Empty-intersection and impossible-merge conflicts are surfaced, not pushed
- [ ] The event path is the mechanism; sweeps find nothing in a healthy system
- [ ] Redis snapshot writes are synchronous within evaluation
- [ ] Every run is recorded with enough detail to answer "why is my limit $400?"
- [ ] `/api/cards/:id/explain` genuinely explains, including the merge
- [ ] The worker handles `SIGTERM` and releases locks
- [ ] The formula sandbox has been reviewed adversarially, again

## Out of scope

Approval-driven actions (B7), transaction-triggered evaluation (B8 wires the events), the rule builder UI (A6).
