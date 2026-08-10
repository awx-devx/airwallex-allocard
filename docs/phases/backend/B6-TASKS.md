# B6 — Attributes & Rules Engine · Tasks

**Spec:** [B6-rules-engine.md](./B6-rules-engine.md)

**Model:** strong — the product core; follow `docs/RULES-ENGINE.md` literally. Steps 1–6 must stay pure. Do not invent merge or skip semantics.

**Depends on:** B5, complete and verified

Read [`../../RULES-ENGINE.md`](../../RULES-ENGINE.md) and [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) §8 before B6.0.

## Contracts first

- [x] **B6.0** — Schemas and contracts
  - **Files:**
    - `src/shared/enums/` for attribute type/source/scope, rule-run status, condition ops as needed
    - `src/shared/schemas/attribute.ts`, `src/shared/schemas/rule.ts`, `src/shared/schemas/ruleRun.ts` (split if cleaner)
    - `src/shared/types/*`, `src/shared/contracts/attribute.ts`, `src/shared/contracts/rule.ts`, `src/shared/contracts/ruleRun.ts`
  - **Do:** Every endpoint in the B6 spec table gets a contract entry. Shapes from ARCHITECTURE §5 + RULES-ENGINE §2–§3:
    - `AttributeDefinition`, `AttributeValue` (with `observedAt`, optional `ttlSec`)
    - `Rule` (scope, trigger, when/then/else, priority, version, enabled)
    - `RuleRun` (inputs, matched, desiredState, diff, actions, status, durationMs)
    - Inputs/outputs for registry CRUD, values get/put, ingest, rules CRUD/enable/validate/simulate, rule-runs list/get, `GET /api/cards/:id/explain`
  - **Pattern:** `src/shared/contracts/card.ts`, `src/shared/schemas/cardControls.ts`
  - **STOP and get reviewed before implementing.** Highest-risk: rule DSL JSON shape, simulate vs evaluate output, explain payload, stale/missing attribute error shapes.
  - **Accept:** `pnpm typecheck`
  - **Notes:** Locked in review:
    1. WEBHOOK secret write-only on create/patch; output `hasWebhookSecret` only; ingest auth header `x-allocard-attribute-secret`.
    2. Stale → RuleRun `SKIPPED` + `skipReason` naming key; missing → `FAILED` + `failureReason`; no new ErrorCode. Impossible merge → `PARTIAL` + `conflicts[]`, never push.
    3. Simulate = same `ruleRunSchema` with status `DRY_RUN`; returns `{ runs, cardDiffs, conflicts }`; zero writes.
    4. Explain: `finalControls`/`finalStatus` + `governingRules[]` + `attributeValues[]` + `merge[]` (field, strategy, contributions, result).
    5. Desired card status subset: `ACTIVE | INACTIVE | CLOSED` only (rules never emit PENDING/BLOCKED/…).
    6. Attribute NUMBER is `z.number()` (ROAS floats); money attrs still integer minor units by convention.
    7. Full RuleActionType enum in DSL; access/budget/approval/notify/flag may record SKIPPED until owning phase.
    8. AttributeDefinition adds `enumValues` (ENUM) + `hasWebhookSecret` beyond ARCHITECTURE sketch.

## Implementation tasks

- [x] **B6.1** — AttributeDefinition + AttributeValue + Rule + RuleRun models
  - **Files:** `src/server/models/AttributeDefinition.ts`, `AttributeValue.ts`, `Rule.ts`, `RuleRun.ts`, colocated model tests
  - **Do:** Tenant-scoped. AttributeValue unique `(orgId, key, subjectType, subjectId)`. Indexes per ARCHITECTURE §5. Dates in Mongo → ISO via `toDomain`.
  - **Pattern:** `src/server/models/Card.ts`, `src/server/models/Budget.ts`
  - **Accept:** `pnpm test models/attribute` and `pnpm test models/rule`
  - **Notes:** `webhookSecretHash` is `select: false` + stripped from `toJSON`; `hasWebhookSecret` is the public signal. Rule `when`/`then`/`else` stored as Mixed (shape owned by shared schemas). RuleRun carries storage-only `cardIds`/`projectId` for history filters, stripped from the domain shape. AttributeValue `value` is Mixed — string/boolean/null stored without coercion.

- [ ] **B6.2** — Attribute + Rule + RuleRun repositories
  - **Files:** `src/server/repositories/attributeDefinitions.ts`, `attributeValues.ts`, `rules.ts`, `ruleRuns.ts`, tests
  - **Do:** `OrgContext` first. CRUD/list/filter helpers needed by the pipeline and HTTP layer. Never return `HydratedDocument`.
  - **Pattern:** `src/server/repositories/cards.ts`
  - **Accept:** `pnpm test repositories/attribute` and `pnpm test repositories/rule`
  - **Notes:**

- [ ] **B6.3** — Built-in attribute resolvers + registry service
  - **Files:** `src/server/services/attributes/builtins.ts`, `registry.ts`, `resolve.ts`, tests
  - **Do:** Implement built-ins from RULES-ENGINE §2 (project/budget/member/card). Stale (`ttlSec`) → skip reason, never silent zero. Missing → fail with named key. Connector interface + one stub "Campaign Analytics" connector.
  - **Pattern:** pure style of `src/server/services/budget/projectProjection.ts`
  - **Accept:** `pnpm test attributes` — stale SKIPPED; missing named; builtins match ledger/project state
  - **Notes:**

- [ ] **B6.4** — Formula extension for attribute identifiers
  - **Files:** extend `src/server/lib/formula/*`, tests
  - **Do:** Resolve attribute keys from evaluation context. Same sandbox caps as B4; allowlist does not grow except attribute identifiers. Missing/stale attr → typed error (not zero).
  - **Pattern:** existing `src/server/lib/formula/`
  - **Accept:** `pnpm test lib/formula` — attribute id resolution; missing fails; no eval/property access
  - **Notes:**

- [ ] **B6.5** — Pure pipeline steps 1–6 (select → context → evaluate → targets → merge → diff)
  - **Files:** `src/server/services/rules/select.ts`, `context.ts`, `evaluate.ts`, `targets.ts`, `merge.ts`, `diff.ts`, `pipeline.ts`, extensive unit tests
  - **Do:** Implement RULES-ENGINE §4. Merge table exactly (min limits, intersect allowlists, union blocklists, max/min dates, most-restrictive status). Impossible merge → conflict object, no push. `crossedAbove`/`crossedBelow` vs previous RuleRun. Determinism: identical inputs → identical desired state over many runs. No I/O in steps 1–6.
  - **Pattern:** `src/server/services/cards/controls.ts` (pure) + RULES-ENGINE §4
  - **Accept:** `pnpm test rules/pipeline` — merge fields; three rules one card; impossible merge; priority; freeze beats limit; crossedBelow once; determinism
  - **Notes:**

- [ ] **B6.6** — Apply + record (steps 7–8) + synchronous Redis policy snapshot
  - **Files:** `src/server/services/rules/apply.ts`, `record.ts`, `evaluateAndApply.ts`, tests
  - **Do:** Persist desired on cards, call existing card reconciler under `lock:card:{id}`, write `policy:card:{cardId}` **before** returning. On Airwallex 5xx leave desired intact. One failing rule does not stop others. Emit `rule.evaluated` / `card.limit_updated` as applicable. One audit per mutation path.
  - **Pattern:** `src/server/services/cards/reconciler.ts`, `src/server/services/budget/ledger.ts` (lock + dual write)
  - **Accept:** `pnpm test rules/apply` — snapshot before return; 5xx retryable; isolation between rules
  - **Notes:**

- [ ] **B6.7** — Simulation (pipeline stop after step 6)
  - **Files:** `src/server/services/rules/simulate.ts`, tests
  - **Do:** Same pipeline as evaluate, optional attribute overrides, zero Airwallex calls, zero DB/Redis writes. Diff must match what a real run would apply from the same fixtures.
  - **Accept:** `pnpm test rules/simulate` — no network; no writes; diff parity with dry evaluate fixture
  - **Notes:**

- [ ] **B6.8** — Attributes HTTP API (registry, values, ingest)
  - **Files:** routes under `src/app/api/attributes/`, services, `test/api/attributes*.test.ts`
  - **Do:** Spec table rows for attributes. Ingest uses signed secret (not session). Emit `attribute.updated` on MANUAL/WEBHOOK write. Matrix rows that apply.
  - **Pattern:** `src/app/api/roles/route.ts`
  - **Accept:** `pnpm test api/attributes`
  - **Notes:**

- [ ] **B6.9** — Rules HTTP API (CRUD, enable, validate)
  - **Files:** routes under `src/app/api/rules/`, services, tests
  - **Do:** PATCH bumps `version`. Validate parses DSL for builder. `control.edit` throughout. Audit mutations.
  - **Accept:** `pnpm test api/rules`
  - **Notes:**

- [ ] **B6.10** — Simulate + rule-runs + card explain endpoints
  - **Files:** `src/app/api/rules/simulate/route.ts`, `src/app/api/rule-runs/**`, `src/app/api/cards/[id]/explain/route.ts`, tests
  - **Do:** Simulate dry-run. Rule-runs list/filter/get with enough detail for "why is my limit $X?". Explain: which rules govern the card, values used, how merge produced the number. `card.view` for explain; `control.edit` for runs/simulate.
  - **Accept:** `pnpm test api/rule-runs` and `pnpm test api/card-explain` and `pnpm test api/rules-simulate`
  - **Notes:**

- [ ] **B6.11** — Worker process (XREADGROUP consumers + debounce + SIGTERM)
  - **Files:** `src/worker/index.ts`, `consumers.ts`, `scheduler.ts`, `debounce.ts`, package.json scripts `dev:worker` / `worker`, tests
  - **Do:** Per ARCHITECTURE §8: blocking consumers on events stream; trailing debounce per `(ruleId, subjectId)`; scheduled sweeps as backstop only; `SIGTERM` finishes in-flight job and releases locks; `ROLE=worker` gate. Twenty events → one evaluation (debounce test).
  - **Pattern:** `docs/ARCHITECTURE.md` §8 worker sketch; `redisKeys.lockRule` / `lockJob`
  - **Accept:** `pnpm test worker`
  - **Notes:**

- [ ] **B6.12** — Wire domain events → evaluation; five RULES-ENGINE §6 worked examples
  - **Files:** event handlers under `src/server/events/handlers/` or worker consumers; fixture-backed e2e tests
  - **Do:** Consume relevant events; run pipeline. Port the five worked examples from RULES-ENGINE §6 end-to-end against fixtures. Event path is the mechanism — sweeps find nothing when healthy.
  - **Accept:** `pnpm test rules/examples` (or equivalent) — all five green
  - **Notes:**

- [ ] **B6.13** — Events + audit coverage for B6 mutations
  - **Files:** `test/events/rules.test.ts`, `test/audit/b6.test.ts`
  - **Do:** `rule.evaluated`, `attribute.updated`, `card.limit_updated` as applicable. One audit per mutating attribute/rule endpoint.
  - **Pattern:** `test/audit/b5.test.ts`
  - **Accept:** `pnpm test events/rules` and `pnpm test audit/b6`
  - **Notes:**

- [ ] **B6.14** — Seed extension
  - **Files:** `scripts/seed.ts`, `test/seed.test.ts`
  - **Do:** `seedB6` — idempotent sample attributes (incl. one custom), at least two enabled rules on SEED-ACTIVE aligned with a worked example, one recorded RuleRun. Do not duplicate on re-run.
  - **Pattern:** `seedB5` in `scripts/seed.ts`
  - **Accept:** `pnpm test seed`
  - **Notes:**

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Standard endpoint matrix passing for every B6 endpoint
- [ ] Steps 1–6 pure — simulation makes no writes (proven by test)
- [ ] Desired state recomputed wholesale, never patched
- [ ] Empty-intersection / impossible-merge conflicts surfaced, never pushed
- [ ] Event path is the mechanism; sweeps are backstop only
- [ ] Redis policy snapshot written synchronously within evaluation
- [ ] Every run recorded with enough detail for explain
- [ ] `/api/cards/:id/explain` explains merge
- [ ] Worker handles SIGTERM and releases locks
- [ ] Formula sandbox reviewed adversarially again
- [ ] Spec's review checklist signed off
- [ ] Five RULES-ENGINE §6 examples green
- [ ] STATUS.md updated: active phase B7, generate B7-TASKS.md
