# B7 — Purchase Requests & Approvals · Tasks

**Spec:** [B7-requests-approvals.md](./B7-requests-approvals.md)

**Model:** cheap — state machine over B1/B4/B6 patterns; money is integer minor units only; never call Airwallex from B7 (emit events; B6 acts).

**Depends on:** B6, complete and verified

Read `docs/ARCHITECTURE.md` §5 purchaseRequests shape and §8 `escalate-approvals` before B7.0.

## Contracts first

- [x] **B7.0** — Schemas and contracts
  - **Files:**
    - `src/shared/enums/purchaseRequestStatus.ts` — `DRAFT | PENDING | APPROVED | REJECTED | EXPIRED | CANCELLED`
    - `src/shared/enums/policyOutcome.ts` — `NO_APPROVAL_REQUIRED | APPROVAL_REQUIRED | NOT_PERMITTED`
    - `src/shared/enums/approvalDecision.ts` — `APPROVE | REJECT`
    - `src/shared/enums/approverSelection.ts` — `ROLE | NAMED_USERS | PROJECT_OWNER` (invented names — stop for review if unclear)
    - `src/shared/schemas/purchaseRequest.ts`, `src/shared/schemas/approvalRule.ts`
    - `src/shared/types/purchaseRequest.ts`, `src/shared/types/approvalRule.ts`
    - `src/shared/contracts/purchaseRequest.ts`, `src/shared/contracts/approvalRule.ts`
  - **Do:** Every endpoint in the spec's table gets a contract entry. Inline shapes (amounts = integer **minor units**):
    - `policyDecision`: `{ outcome: PolicyOutcome, reasons: string[] (min 1 when NOT_PERMITTED), requiredApprovals: number }`
    - `approvalEntry`: `{ approverId: id, decision: ApprovalDecision, reason: string | null, at: ISO }`
    - `purchaseRequest`: `id, orgId, projectId, requestedBy, amount` nonnegative int, `currency` length 3, `categoryId` nullable, `vendor` string 1–200, `description` string 1–2000, `justification` string 1–2000, `policyDecision` nullable until submit, `status`, `cardId` nullable, `approvals: approvalEntry[]`, `escalatedAt` nullable ISO, `createdAt, updatedAt`
    - `approvalRule`: `id, orgId, projectId` nullable (null = org default), `threshold` nonnegative int minor units, `approverSelection` + selection payload (`roleKey?`, `userIds?`), `requiredCount` int ≥ 1, `escalationAfterMins` int ≥ 1, `escalateTo` (same selection shape), `createdAt, updatedAt`
    - Inputs:
      - `policyPreviewInput`: `{ projectId, amount, currency, categoryId? }` → `policyDecision`
      - `createPurchaseRequestInput`: amount, currency, vendor, description, justification, optional categoryId — creates `DRAFT` (or `PENDING` if policy says no approval — lock in Notes)
      - `updatePurchaseRequestInput`: partial of create fields; only while `DRAFT`
      - `decidePurchaseRequestInput`: `{ decision: APPROVE | REJECT, reason?: string }` — reason **required** on REJECT
      - `putApprovalRulesInput`: array of approval rule bodies (replace-all for the project)
    - Lists: page default 1, pageSize default 20 max 100 → `{ items, page, pageSize, total }`
  - **Contracts table (every row):**
    - POST `/api/policy/preview` → policyPreviewInput → policyDecision
    - GET `/api/projects/:id/requests` → list
    - POST `/api/projects/:id/requests` → createPurchaseRequestInput → purchaseRequest
    - GET `/api/requests/:id` → purchaseRequest
    - PATCH `/api/requests/:id` → updatePurchaseRequestInput → purchaseRequest
    - POST `/api/requests/:id/submit` → purchaseRequest
    - POST `/api/requests/:id/cancel` → purchaseRequest
    - POST `/api/requests/:id/decide` → decidePurchaseRequestInput → purchaseRequest
    - GET `/api/approvals` → list (approver queue)
    - GET `/api/approvals/count` → `{ count: number }`
    - GET `/api/projects/:id/approval-rules` → list rules
    - PUT `/api/projects/:id/approval-rules` → putApprovalRulesInput → list rules
  - **Pattern:** `src/shared/contracts/budget.ts`, `src/shared/schemas/budget.ts`
  - **STOP and get reviewed before implementing.** Highest-risk: status enum (CANCELLED vs EXPIRED), create→DRAFT vs auto-PENDING, `approverSelection` shape, commitment/release pairing with B4 entry types.
  - **Accept:** `pnpm typecheck`
  - **Notes:** Locked in B7.0 (awaiting review before B7.1):
    1. Status includes both `CANCELLED` (user cancel from DRAFT/PENDING) and `EXPIRED` (system timeout terminal) — ARCHITECTURE sketch omitted CANCELLED; events require `request.cancelled`.
    2. Create always → `DRAFT`; submit runs policy → `PENDING` / `APPROVED` / reject. No auto-PENDING on create.
    3. `approverSelection` / `escalateTo` are discriminated `{ type: ROLE|NAMED_USERS|PROJECT_OWNER, roleKey?|userIds? }` — same shape for both.
    4. Ledger pairing uses existing B4 `BudgetEntrySourceType.PURCHASE_REQUEST` + `COMMITMENT` on approve / matching `RELEASE` on REJECTED|CANCELLED|EXPIRED.

## Implementation tasks

### B7.1 — Models

- [x] **B7.1** — PurchaseRequest + ApprovalRule models
  - **Files:** `src/server/models/PurchaseRequest.ts`, `src/server/models/ApprovalRule.ts`, colocated model tests
  - **Do:** `tenantScoped` + `baseOptions`. Indexes: PurchaseRequest `(orgId, projectId, status, createdAt desc)`, `(orgId, requestedBy, createdAt desc)`, `(orgId, status, updatedAt)` for escalation sweep; ApprovalRule `(orgId, projectId)` (projectId null = org default). Embed `approvals[]` and `policyDecision` on PurchaseRequest. Amounts are Number integers.
  - **Pattern:** `src/server/models/BudgetChangeRequest.ts`
  - **Accept:** `pnpm test models/purchaseRequest` (or equivalent)

### B7.2 — Repositories

- [x] **B7.2** — PurchaseRequest + ApprovalRule repositories
  - **Files:** `src/server/repositories/purchaseRequests.ts`, `src/server/repositories/approvalRules.ts`
  - **Do:** Every method takes `OrgContext` first. Cross-org → null (404 at handler). Include `listPendingForApprover`, `listOverdueForEscalation` (allowCrossTenant only on the sweep helper, greppable), `replaceProjectRules`.
  - **Pattern:** `src/server/repositories/budgetChangeRequests.ts`
  - **Accept:** `pnpm test repositories/purchaseRequest`

### B7.3 — Policy check (pure)

- [x] **B7.3** — Policy evaluation
  - **Files:** `src/server/services/approvals/policy.ts`, `policy.test.ts`
  - **Do:** Pure function → `PolicyOutcome` + reasons. Order: role → access scope → spending rules → thresholds (from ApprovalRule). `NOT_PERMITTED` **must** name which check failed. Same function used by preview and submit.
  - **Pattern:** `src/server/services/budget/projectProjection.ts`
  - **Accept:** `pnpm test approvals/policy` — each outcome; reason asserted on NOT_PERMITTED; under/over threshold

### B7.4 — Approver selection

- [x] **B7.4** — Resolve approvers
  - **Files:** `src/server/services/approvals/routing.ts`, `routing.test.ts`
  - **Do:** Resolve ROLE / NAMED_USERS / PROJECT_OWNER to distinct user ids. `requiredCount` needs distinct approvers; duplicate approval from same user does not count twice. Requester can never appear in the resolved set for their own request.
  - **Pattern:** pure helpers + repo reads
  - **Accept:** `pnpm test approvals/routing`

### B7.5 — Request lifecycle services

- [x] **B7.5** — Create / update / submit / cancel / decide
  - **Files:** `src/server/services/approvals/requests.ts` (+ tests)
  - **Do:** State machine. Submit runs policy. `NO_APPROVAL_REQUIRED` → APPROVED path (commitment + `request.approved`). `APPROVAL_REQUIRED` → PENDING + route. `NOT_PERMITTED` → reject create/submit with reasons. Decide: APPROVE increments approvals; when `requiredCount` met → APPROVED + COMMITMENT + emit `request.approved`; REJECT requires reason + RELEASE if commitment already written (usually not yet) + `request.rejected`. Cancel from DRAFT/PENDING → CANCELLED + RELEASE if committed + `request.cancelled`. Already-decided → 409. Exactly one audit entry per mutation. **Never call Airwallex.**
  - **Pattern:** `src/server/services/budget/changeRequests.ts`
  - **Accept:** `pnpm test approvals/requests`

### B7.6 — Commitment / release pairing

- [x] **B7.6** — Ledger integration
  - **Files:** wire through `appendBudgetEntry` (B4); tests for balance under every terminal path
  - **Do:** APPROVED → one COMMITMENT (`sourceType: PURCHASE_REQUEST`, `sourceId: requestId`). REJECTED / CANCELLED / EXPIRED → matching RELEASE. Two concurrent approvals against the same remaining budget cannot both commit past it (Redis budget lock).
  - **Pattern:** B4 ledger append
  - **Accept:** `pnpm test approvals/commitment`

### B7.7 — HTTP API (requests + policy)

- [x] **B7.7** — Request + policy routes
  - **Files:** `src/app/api/policy/preview/route.ts`, `src/app/api/projects/[id]/requests/route.ts`, `src/app/api/requests/[id]/route.ts`, `submit/route.ts`, `cancel/route.ts`, `decide/route.ts`
  - **Do:** Permissions per spec table. Scope-limited members see only their own requests on list/get. Matrix rows for every endpoint.
  - **Pattern:** `src/app/api/budget/change-requests/`
  - **Accept:** `pnpm test api/requests`

### B7.8 — Approvals queue + rules HTTP

- [x] **B7.8** — Approvals queue and approval-rules CRUD
  - **Files:** `src/app/api/approvals/route.ts`, `src/app/api/approvals/count/route.ts`, `src/app/api/projects/[id]/approval-rules/route.ts`
  - **Do:** Queue is efficient across projects (indexed query). Count is shell badge hot path. PUT replaces project rules atomically.
  - **Pattern:** list endpoints from B3/B4
  - **Accept:** `pnpm test api/approvals`

### B7.9 — Escalation sweep

- [x] **B7.9** — Wire `escalate-approvals` worker job
  - **Files:** `src/server/services/approvals/escalate.ts`, update `src/worker/index.ts`, tests
  - **Do:** Replace noop with real job. Find PENDING past `escalationAfterMins`, route to `escalateTo`, emit `request.escalated` once (idempotent). Genuinely time-triggered.
  - **Pattern:** `src/server/services/rules/sweep.ts`
  - **Accept:** `pnpm test approvals/escalate`

### B7.10 — Events + audit + seed

- [ ] **B7.10** — Events, audit coverage, seed
  - **Files:** `test/events/b7.test.ts`, `test/audit/b7.test.ts`, extend `scripts/seed.ts`
  - **Do:** Emit `request.created | submitted | approved | rejected | escalated | cancelled`. Assert `request.approved` once and that B6 `handleDomainEventForRules` can consume it (fixture). Audit every mutation. Seed one pending request + one approval rule.
  - **Accept:** `pnpm test events/b7` && `pnpm test audit/b7` && `pnpm test seed`

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Standard endpoint matrix passing for every B7 endpoint
- [ ] `NOT_PERMITTED` always names the failing check
- [ ] Policy preview and enforcement use the same function
- [ ] Commitments and releases balance under every terminal path
- [ ] Self-approval is impossible
- [ ] B7 never calls Airwallex directly — it emits, B6 acts
- [ ] Escalation is idempotent
- [ ] Spec's review checklist signed off
- [ ] STATUS.md updated: active phase B8, generate B8-TASKS.md
