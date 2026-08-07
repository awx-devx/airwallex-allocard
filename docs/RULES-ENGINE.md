# Allocard — Attributes & Rules Engine

This is the product. Everything else is CRUD around it.

The engine answers one question, continuously: **given everything currently true about this business, what should this card be allowed to do right now?**

---

## 1. Design principles

**1. Desired state, not commands.** Rules do not say "increase the limit by $500." They compute what the card's controls *should be*, and a reconciler makes reality match. This makes rules idempotent, replayable, and safe to run on a timer.

**2. Recompute from scratch.** Never patch a previous result. Every evaluation starts from current attribute values and produces a complete desired state. Incremental patching is how permission systems drift.

**3. Most restrictive wins.** When several rules target the same card, limits take the minimum, allowlists take the intersection, and blocklists take the union. A rule can never accidentally widen what another rule narrowed.

**4. Explainable.** Every run records its inputs, which conditions matched, what state it produced, what changed, and why. "Why is my limit $400?" must have an answer on screen.

**5. Dry-runnable.** Any rule can be simulated against current or hypothetical attribute values without touching Airwallex.

---

## 2. The attribute registry

An **attribute** is any value a rule may read. Attributes are namespaced by subject.

### Built-in attributes

| Key | Type | Subject | Source |
| --- | --- | --- | --- |
| `org.baseCurrency` | string | org | computed |
| `project.status` | enum | project | computed |
| `project.startDate` / `project.endDate` | date | project | computed |
| `project.approvalStatus` | enum | project | computed |
| `project.budget.approved` | number | project | ledger |
| `project.budget.committed` | number | project | ledger |
| `project.budget.actual` | number | project | ledger |
| `project.budget.remaining` | number | project | ledger |
| `project.budget.utilisationPct` | number | project | derived |
| `project.category.{id}.remaining` | number | project | ledger |
| `project.headcount` | number | project | computed |
| `project.daysRemaining` | number | project | derived |
| `member.role` | string | member | computed |
| `member.scope.level` | enum | member | computed |
| `member.seniority` | string | member | manual |
| `member.location` | string | member | manual |
| `member.spend.mtd` | number | member | computed |
| `card.purpose` | enum | card | computed |
| `card.remaining.{interval}` | number | card | Airwallex |
| `card.status` | enum | card | Airwallex |

### Custom attributes

The interesting demo attributes are custom: `campaign.roas`, `inventory.skuCount`, `revenue.mrr`, `vendor.riskTier`, `site.region`. These are declared in the registry and populated by one of three sources:

```ts
type AttributeSource =
  | { kind: 'MANUAL' }                                   // set in the UI
  | { kind: 'WEBHOOK'; secret: string }                  // pushed to /api/attributes/ingest
  | { kind: 'CONNECTOR'; connectorId: string; refreshIntervalSec: number }
```

Keep the connector interface tiny so new sources are cheap:

```ts
interface AttributeConnector {
  id: string
  fetch(ctx: OrgContext, subject: Subject): Promise<Record<string, AttributeValue>>
}
```

For the demo, ship `MANUAL` and `WEBHOOK` for real, and one stub connector (a fake "Campaign Analytics") so the connector path is demonstrably wired.

**Push beats poll, and the difference is visible to users.** `MANUAL` and `WEBHOOK` sources emit `attribute.updated` the moment the value lands, so dependent cards converge in about a second. A `CONNECTOR` cannot beat its own `refreshIntervalSec` — you can't know a number changed until you look — so that interval is the floor on end-to-end latency for anything it feeds. Prefer push wherever the source supports it, and always render `observedAt` beside an attribute that's driving a live limit so nobody mistakes a fifteen-minute-old figure for a current one.

**Staleness matters.** Every attribute value carries `observedAt` and an optional `ttlSec`. A rule that reads a stale attribute must either skip (and record `SKIPPED: stale input`) or fall back to a declared default. Silently acting on an hour-old campaign metric is worse than not acting.

---

## 3. The rule DSL

Rules are JSON documents. The UI is a builder over this shape; power users can edit the JSON.

```jsonc
{
  "name": "Member card limits track remaining project budget",
  "description": "Each Spender gets 10% of what's left, capped by their role ceiling.",
  "enabled": true,
  "priority": 100,
  "scope": { "level": "PROJECT", "projectId": "prj_123" },

  "trigger": {
    "events": ["project.launched", "budget.updated", "transaction.cleared"],
    "schedule": "*/15 * * * *",
    "debounceSec": 30
  },

  "when": {
    "all": [
      { "attr": "project.status", "op": "eq", "value": "ACTIVE" },
      { "attr": "project.budget.remaining", "op": "gt", "value": 0 }
    ]
  },

  "then": [
    {
      "action": "card.setControls",
      "target": {
        "select": "PROJECT_CARDS",
        "filter": { "purpose": "MEMBER", "memberRole": "PROJECT_SPENDER" }
      },
      "params": {
        "transactionLimits": {
          "currency": "USD",
          "limits": [
            { "interval": "MONTHLY", "amount": "min(project.budget.remaining * 0.10, role.monthlyCap)" },
            { "interval": "PER_TRANSACTION", "amount": "min(project.budget.remaining * 0.02, 2500)" }
          ]
        },
        "activeFrom": "project.startDate",
        "activeTo": "project.endDate"
      }
    }
  ],

  "else": [
    { "action": "card.freeze", "target": { "select": "PROJECT_CARDS", "filter": { "purpose": "MEMBER" } },
      "params": { "reason": "Project inactive or budget exhausted" } }
  ]
}
```

### Conditions

```ts
type Condition =
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }
  | { attr: string; op: Operator; value: Literal | { attr: string } }
  | { expr: string }                     // formula returning boolean

type Operator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'in' | 'nin' | 'contains' | 'between'
  | 'changedBy' | 'crossedBelow' | 'crossedAbove'   // stateful, vs last run
```

The stateful operators are what make threshold rules feel alive: `crossedBelow` fires once when `project.budget.remaining` passes under a floor, not on every subsequent evaluation while it stays there. Implement by storing the previous evaluated value on the `ruleRuns` record.

### Actions

| Action | Effect | Airwallex call |
| --- | --- | --- |
| `card.create` | Provision a card for a target subject | `POST /issuing/cards/create` |
| `card.setControls` | Set limits, currencies, MCCs, countries, active window | `POST /issuing/cards/{id}/update` |
| `card.freeze` | Status → `INACTIVE` | `POST /issuing/cards/{id}/update` |
| `card.unfreeze` | Status → `ACTIVE` | `POST /issuing/cards/{id}/update` |
| `card.close` | Status → `CLOSED` (terminal) | `POST /issuing/cards/{id}/update` |
| `access.grant` / `access.revoke` | Add or remove a project member's role/scope | internal |
| `access.expire` | Revoke scopes past `validTo` | internal |
| `budget.allocate` | Write a ledger entry | internal |
| `approval.require` | Attach an approval requirement to matching requests | internal |
| `notify` | Email / in-app notification | internal |
| `flag.review` | Raise an item into the access-review queue | internal |

### Targets

```ts
type Target =
  | { select: 'PROJECT_CARDS'; filter?: CardFilter }
  | { select: 'MEMBER_CARDS'; memberIds?: string[]; roleKeys?: string[] }
  | { select: 'CARD'; cardId: string }
  | { select: 'PROJECT_MEMBERS'; filter?: MemberFilter }
  | { select: 'EVENT_SUBJECT' }          // whatever the trigger was about
```

### Formulas

Amounts and dates may be expressions over attributes. **Do not use `eval`.** Use a sandboxed expression parser (`expr-eval` or similar) with a fixed allowlist:

```
operators:  + - * / %  ( )  < <= > >= == != && || !
functions:  min, max, round, floor, ceil, abs, clamp(x, lo, hi), pct(x, p),
            daysBetween(a, b), coalesce(a, b)
identifiers: attribute keys only, resolved from the evaluation context
```

Rules for safe evaluation: no property access, no function definitions, a hard node-count limit, and a timeout. Any formula referencing a missing or stale attribute fails the evaluation with a recorded reason rather than resolving to zero — a silent `0` becomes a `$0` limit, which looks like a bug and behaves like an outage.

---

## 4. Evaluation pipeline

```
        trigger
           │
   ┌───────▼────────┐
   │ 1. Select rules│  enabled, scope matches subject, trigger matches
   └───────┬────────┘
   ┌───────▼────────┐
   │ 2. Build context│ resolve every attribute the rules reference (batched)
   └───────┬────────┘  → fail fast on stale/missing
   ┌───────▼────────┐
   │ 3. Evaluate     │ conditions → then[] or else[]
   └───────┬────────┘
   ┌───────▼────────┐
   │ 4. Resolve      │ expand targets to concrete cards/members
   │    targets      │
   └───────┬────────┘
   ┌───────▼────────┐
   │ 5. Merge        │ combine all rules' outputs per subject,
   │    desired state│ most-restrictive-wins, priority breaks ties
   └───────┬────────┘
   ┌───────▼────────┐
   │ 6. Diff         │ desired vs cards.appliedControls
   └───────┬────────┘
   ┌───────▼────────┐
   │ 7. Apply        │ minimal patch to Airwallex, under a per-card lock
   └───────┬────────┘
   ┌───────▼────────┐
   │ 8. Record       │ ruleRuns + auditLogs + refresh Redis policy snapshot
   └────────────────┘
```

Steps 1–6 are pure and side-effect free. That's the boundary that makes dry-run trivial: **simulation is the same pipeline, stopped after step 6.**

### Merge semantics

When two rules produce controls for the same card:

| Field | Merge |
| --- | --- |
| `transactionLimits[interval].amount` | `min` |
| `allowedCurrencies` | intersection (empty array from any rule = no constraint from that rule) |
| `allowedMerchantCategories` | intersection |
| `allowedMerchantCountries` | intersection |
| `blockedTransactionUsages` | union |
| `activeFrom` | `max` |
| `activeTo` | `min` |
| `cardStatus` | most restrictive: `CLOSED` > `INACTIVE` > `ACTIVE` |

If the merge produces an impossible state (`activeFrom > activeTo`, or an empty currency intersection), do not push it. Record a `PARTIAL` run with a conflict explanation and surface it in automation history. A card that silently declines everything is the worst outcome.

### Failure handling

- Airwallex call fails → retry with exponential backoff on the reconciler's next pass; the desired state is already persisted, so nothing is lost.
- Rule throws → that rule's run is `FAILED`; other rules still apply. One bad rule must not stop the engine.
- Attribute unavailable → `SKIPPED` with the missing key named.

---

## 5. Three layers of enforcement

Rules only matter if something enforces them. Allocard enforces at three distinct points, and it's worth being explicit about which does what.

| Layer | When | Mechanism | Latency budget |
| --- | --- | --- | --- |
| **1. Declarative** | Ahead of time | `authorization_controls` pushed to Airwallex — limits, MCCs, currencies, dates, usage scopes | seconds (async) |
| **2. Real-time** | At authorization | Remote authorization: Airwallex calls us, we approve/decline against live state | **< 2.5s hard** |
| **3. Reconciliation** | After the fact | Webhooks update the budget ledger, which re-triggers evaluation | seconds |

Layer 1 is the workhorse and handles most policy. Layer 2 catches what static controls can't express — "decline if this specific purchase would push the *project* over budget, even though the *card* has room." Layer 3 closes the loop.

**Without Layer 2, your enforcement latency equals your reconciliation latency.** If remote authorization isn't enabled on the account, the controls sitting at Airwallex are the *only* thing standing between a cardholder and a swipe. Every second between a rule deciding a limit should drop and the patch landing is a window in which the card is over-provisioned relative to policy. That's the real argument for the event-driven path in [`ARCHITECTURE.md`](./ARCHITECTURE.md) §8 — on a five-minute polling loop, that window is five minutes wide.

With Layer 2 enabled the exposure largely closes, because the Redis policy snapshot is written synchronously during evaluation while the Airwallex patch is still in flight. The snapshot is current even when the card isn't.

**Layer 2 requires a pre-computed policy snapshot.** You cannot run the full pipeline inside 2.5 seconds. Instead, keep a flattened snapshot per card in Redis, refreshed whenever rules, budget, or membership change:

```jsonc
// policy:card:{cardId}
{
  "cardId": "...", "projectId": "...", "orgId": "...",
  "version": 42,
  "hardStops": {
    "projectRemaining": 4000.00,
    "memberMtdCap": 1500.00,
    "memberMtdSpent": 420.00,
    "allowedMcc": ["5734", "7372"],
    "allowedCountries": ["US", "AU", "SG"],
    "requireApprovalAbove": 1000.00,
    "approvedRequestIds": ["pr_1", "pr_2"]
  },
  "refreshedAt": "2026-08-05T10:00:00Z"
}
```

The remote-auth handler does a single Redis `GET`, runs a handful of comparisons, and responds. If the snapshot is missing or stale beyond a threshold, **approve and flag** rather than decline — an outage in our system must not decline a legitimate purchase. (Make this a configurable posture: `fail-open` for the demo, `fail-closed` is a business decision.)

---

## 6. Worked examples

These map directly to the demo script in [`PRD.md`](./PRD.md) §8.

### A — Cards exist only because a project was approved

```jsonc
{
  "name": "Issue member cards on project launch",
  "trigger": { "events": ["project.launched"] },
  "when": { "all": [
    { "attr": "project.status", "op": "eq", "value": "ACTIVE" },
    { "attr": "project.budget.approved", "op": "gt", "value": 0 }
  ]},
  "then": [{
    "action": "card.create",
    "target": { "select": "PROJECT_MEMBERS", "filter": { "roleKeys": ["PROJECT_SPENDER", "PROCUREMENT_LEAD"] } },
    "params": {
      "formFactor": "VIRTUAL", "purpose": "MEMBER", "allowedTransactionCount": "MULTIPLE",
      "transactionLimits": { "currency": "USD", "limits": [
        { "interval": "MONTHLY", "amount": "project.budget.approved / max(project.headcount, 1) * 0.25" }
      ]},
      "activeFrom": "project.startDate", "activeTo": "project.endDate"
    }
  }]
}
```

### B — Budget floor freezes discretionary spend

```jsonc
{
  "name": "Freeze member cards when budget drops below 10%",
  "priority": 10,
  "trigger": { "events": ["budget.updated", "transaction.cleared"] },
  "when": { "attr": "project.budget.utilisationPct", "op": "crossedAbove", "value": 90 },
  "then": [
    { "action": "card.freeze", "target": { "select": "PROJECT_CARDS", "filter": { "purpose": "MEMBER" } },
      "params": { "reason": "Project budget below 10% remaining" } },
    { "action": "notify", "target": { "select": "PROJECT_MEMBERS", "filter": { "roleKeys": ["PROJECT_MANAGER", "FINANCE_ADMIN"] } },
      "params": { "template": "budget_floor_breached" } }
  ]
}
```

Low `priority` means it merges last and wins — freezing beats any limit another rule computed.

### C — Campaign performance drives marketing spend

```jsonc
{
  "name": "Scale campaign card with ROAS",
  "trigger": { "events": ["attribute.updated"], "schedule": "0 * * * *" },
  "when": { "all": [
    { "attr": "campaign.roas", "op": "gte", "value": 2.0 },
    { "attr": "campaign.status", "op": "eq", "value": "RUNNING" }
  ]},
  "then": [{
    "action": "card.setControls",
    "target": { "select": "CARD", "cardId": "card_campaign_apac" },
    "params": { "transactionLimits": { "currency": "USD", "limits": [
      { "interval": "WEEKLY", "amount": "clamp(campaign.roas * 2000, 1000, 25000)" }
    ]}}
  }],
  "else": [{
    "action": "card.setControls",
    "target": { "select": "CARD", "cardId": "card_campaign_apac" },
    "params": { "transactionLimits": { "currency": "USD", "limits": [
      { "interval": "WEEKLY", "amount": 1000 }
    ]}}
  }]
}
```

This is the clearest demonstration of the thesis: an ad platform metric moves a card limit with no human involved.

### D — Vendor card that self-destructs

```jsonc
{
  "name": "One-time vendor card on approved purchase request",
  "trigger": { "events": ["request.approved"] },
  "when": { "all": [
    { "attr": "request.type", "op": "eq", "value": "VENDOR_PAYMENT" },
    { "attr": "request.amount", "op": "lte", "value": 25000 }
  ]},
  "then": [{
    "action": "card.create",
    "target": { "select": "EVENT_SUBJECT" },
    "params": {
      "formFactor": "VIRTUAL", "purpose": "ONE_TIME",
      "allowedTransactionCount": "SINGLE",
      "transactionLimits": { "currency": "request.currency", "limits": [
        { "interval": "PER_TRANSACTION", "amount": "request.amount * 1.02" }
      ]},
      "allowedMerchantCategories": "request.vendor.mccList",
      "activeTo": "now() + 7d"
    }
  }]
}
```

A single-use card, sized to the approved amount plus 2% tolerance, restricted to that vendor's merchant categories, dead in seven days. It cannot be misused because there is nothing left to misuse.

### E — Role change re-derives everything

```jsonc
{
  "name": "Recalculate access on role change",
  "trigger": { "events": ["member.role_changed", "member.scope_changed"] },
  "when": { "attr": "member.status", "op": "eq", "value": "ACTIVE" },
  "then": [
    { "action": "access.grant",  "target": { "select": "EVENT_SUBJECT" }, "params": { "recompute": true } },
    { "action": "card.setControls", "target": { "select": "MEMBER_CARDS" },
      "params": { "transactionLimits": { "currency": "USD", "limits": [
        { "interval": "MONTHLY", "amount": "min(role.monthlyCap, project.budget.remaining * 0.1)" }
      ]}}},
    { "action": "flag.review", "target": { "select": "EVENT_SUBJECT" },
      "params": { "when": "role.isElevated" } }
  ]
}
```

---

## 7. UI surfaces

**Rule builder.** Trigger picker → condition builder (attribute dropdown, operator, value or formula) → action list with target selector. Show a live preview panel: *"With today's values, this rule matches 4 cards and would set the monthly limit to $412."*

**Simulation.** A "what if" panel where attribute values can be overridden and the pipeline run through step 6. Render the resulting diff per card. This is the single most persuasive screen in the demo.

**Automation history.** A reverse-chronological feed of `ruleRuns`: rule name, trigger, matched or not, inputs used, diff applied, duration, status. Filterable by rule, card, project.

**Card explainer.** On any card detail page, a "Why this limit?" panel that names the rules currently governing the card, the attribute values they consumed, and the merge that produced the final number. This turns the engine from a black box into a feature.

---

## 8. Implementation order

1. Attribute registry with built-in computed attributes only.
2. Formula parser with the allowlist and a thorough test table.
3. Condition evaluator (stateless operators first; add `crossedAbove`/`crossedBelow` after `ruleRuns` exists).
4. Target resolution and desired-state merge.
5. Diff and the Airwallex reconciler with per-card locking.
6. `ruleRuns` persistence and the automation history UI.
7. Simulation mode (nearly free once 1–4 exist).
8. Custom attributes: manual, then webhook ingest, then the stub connector.
9. Redis policy snapshots and the remote-auth handler.
