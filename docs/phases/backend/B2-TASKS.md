# B2 — Projects · Tasks

**Spec:** [B2-projects.md](./B2-projects.md)
**Model:** cheap — pattern-match B1 models/repos/handlers; do not invent new shapes.
**Depends on:** B1, complete and verified

---

## Contracts first

- [x] **B2.0** — Schemas and contracts
  - **Files:** `src/shared/schemas/project.ts`, `src/shared/schemas/workstream.ts` (if separate), `src/shared/enums/projectStatus.ts`, `src/shared/types/project.ts`, `src/shared/contracts/project.ts`
  - **Do:** Every endpoint in the spec's table gets a contract entry. Inline shapes:
    - `ProjectStatus`: `DRAFT | PENDING_APPROVAL | ACTIVE | CLOSING | CLOSED | ARCHIVED | CANCELLED`
    - `project`: `id, orgId, name, code, description, status, ownerId, costCentre, startDate, endDate, workstreams[{ id, name }], cardStructure { shared, perMember, vendor, oneTime }, approvedAt?, launchedAt?, closedAt?, createdAt, updatedAt`
    - `createProjectInput`: name, code, description?, ownerId?, costCentre?, startDate?, endDate?, cardStructure? — creates `DRAFT`
    - `updateProjectInput`: partial of editable fields; permissive (wizard saves)
    - `projectReadyForApproval`: refinement used only at `→ PENDING_APPROVAL` — requires name, dates, owner, and a soft budget check (TODO(B4) harden)
    - `transitionProjectInput`: `{ to: ProjectStatus, reason?: string }`
    - `listProjectsQuery`: status?, ownerId?, costCentre?, page?, pageSize?, sort?
    - `projectDetail`: project + overview counts the A2 overview needs (define explicitly; empty/zero stubs OK until B3–B5)
    - Workstream create/update inputs: `{ name }`
    - `changeOwnerInput`: `{ ownerId }`
  - **Pattern:** `src/shared/contracts/organization.ts`, `src/shared/schemas/organization.ts`
  - **STOP and get reviewed before implementing.**
  - **Accept:** `pnpm typecheck`
  - **Notes:** Workstreams stayed in `project.ts`. Draft nullables for owner/dates/costCentre. `updateProjectInput` omits owner (dedicated endpoint). List is page/`pageSize` + `{ items, page, pageSize, total }`. Overview stubs + soft `hasBudget` until B4.

---

## Tasks

- [x] **B2.1** — Project model
  - **Files:** `src/server/models/Project.ts`
  - **Do:** Tenant-scoped via `tenantScoped`. Unique `(orgId, code)`. Indexes `(orgId, status, updatedAt)`, `(orgId, ownerId)`. Embed workstreams and cardStructure. Follow `docs/ARCHITECTURE.md` §5 and `src/server/models/Membership.ts`.
  - **Pattern:** `src/server/models/Organization.ts` + tenant plugin from Membership
  - **Accept:** `pnpm test models/project`
  - **Notes:** `ProjectFields` storage shape (Dates in Mongo). Workstream subdocs `_id: false` with explicit `id`. Same code allowed across orgs.

- [x] **B2.2** — `canTransition` pure function
  - **Files:** `src/server/services/projects/transitions.ts`
  - **Do:** Export `canTransition(from, to): TransitionResult`. Encode the graph from the spec. No I/O. Guards that need data (required fields, active cards) return a structured “needs check” result the service applies — do not scatter status `if`s in handlers.
  - **Accept:** `pnpm test projects/transitions` — every `(from, to)` pair, valid and invalid
  - **Notes:** Guards: `readyForApproval` (DRAFT→PENDING_APPROVAL), `noActiveCards` (ACTIVE→CLOSING). CANCELLED only from DRAFT per graph `└`. Full 7×7 matrix covered.

- [x] **B2.3** — Project repository
  - **Files:** `src/server/repositories/projects.ts`
  - **Do:** `OrgContext` first on every method. `create`, `findById`, `list` (filters + pagination + stable sort), `update`, `updateStatus` (conditional on current status for concurrency), workstream CRUD helpers, `changeOwner`. Duplicate `code` → conflict at DB unique index.
  - **Pattern:** `src/server/repositories/memberships.ts`
  - **Accept:** `pnpm test repositories/projects`
  - **Notes:** `updateStatus(from, to)` conditional for launch-once. List sorts with secondary `_id` for stable pages. Duplicate code → Mongo 11000.

- [x] **B2.4** — Create + list + get
  - **Files:** `src/app/api/projects/route.ts`, `src/app/api/projects/[id]/route.ts`, `src/server/services/projects/create.ts`, `list.ts`, `get.ts`
  - **Do:** `POST` creates `DRAFT` (`project.create`). `GET` list with filters/pagination (`project.view`). `GET :id` returns `projectDetail` (`project.view`). Cross-org → 404. Emit `project.created` after create commits.
  - **Pattern:** `src/app/api/organizations/route.ts`, `src/server/services/organizations/create.ts`
  - **Accept:** `pnpm test api/projects` — standard matrix rows that apply
  - **Notes:** Overview stubs via `emptyProjectOverview`. List query `page`/`pageSize` use `z.coerce` for query strings. Audit `project.created`.

- [x] **B2.5** — Partial update
  - **Files:** `src/app/api/projects/[id]/route.ts` (PATCH), `src/server/services/projects/update.ts`
  - **Do:** Permissive `updateProjectInput`. Reject fields not editable in current status. Reject PATCH on `CLOSED`/`ARCHIVED`. Audit before/after for field changes. `project.edit`.
  - **Accept:** `pnpm test api/projects-update` — CLOSED rejected; partial DRAFT OK
  - **Notes:** CLOSED/ARCHIVED/CANCELLED → 409. Non-terminal statuses allow all `updateProjectInput` fields via `EDITABLE_BY_STATUS`. Audit `project.updated` with before/after.

- [ ] **B2.6** — Transition endpoint
  - **Files:** `src/app/api/projects/[id]/transition/route.ts`, `src/server/services/projects/transition.ts`
  - **Do:** Single `POST` with `{ to, reason? }`. Use `canTransition` + data guards. Invalid → `409 CONFLICT`, no mutate. `→ PENDING_APPROVAL` runs `projectReadyForApproval` (field-level 422). Emit `project.approved` / `project.launched` / `project.closing` / `project.closed` as appropriate. **`project.launched` exactly once** under concurrent double-call (conditional status update). Soft budget check: `TODO(B4)`. Active-cards block on `→ CLOSING`: `TODO(B5)` no-op allow for now, note in STATUS.
  - **Accept:** `pnpm test api/project-transition` — full matrix; concurrent launch once
  - **Notes:**

- [ ] **B2.7** — Workstreams
  - **Files:** `src/app/api/projects/[id]/workstreams/route.ts`, `.../[wsId]/route.ts`, `src/server/services/projects/workstreams.ts`
  - **Do:** List/create/update/delete. Delete rejected if budget categories reference it — stub `TODO(B4)` (allow delete until B4, or reject with a clear TODO message; prefer reject only when a real reference API exists — until then allow and note STATUS).
  - **Accept:** `pnpm test api/workstreams`
  - **Notes:**

- [ ] **B2.8** — Change owner + history
  - **Files:** `src/app/api/projects/[id]/owner/route.ts`, `src/app/api/projects/[id]/history/route.ts`, `src/server/services/projects/owner.ts`, `history.ts`
  - **Do:** `PATCH owner` separate for audit clarity. `GET history` from audit logs for this project (status + field changes).
  - **Pattern:** audit queries from `test/audit/b1.test.ts`
  - **Accept:** `pnpm test api/project-owner` and `pnpm test api/project-history`
  - **Notes:**

- [ ] **B2.9** — Events coverage
  - **Files:** touches B2.4–B2.6 services; assert via `src/server/events/bus.ts`
  - **Do:** Confirm `project.created`, `project.approved`, `project.launched`, `project.closing`, `project.closed` emit once per successful transition/create.
  - **Accept:** `pnpm test events/projects`
  - **Notes:**

- [ ] **B2.10** — Audit coverage
  - **Files:** `test/audit/b2.test.ts`
  - **Do:** One assertion per mutating B2 endpoint — exactly one audit entry, correct actor/subject, before/after on field changes.
  - **Pattern:** `test/audit/b1.test.ts`
  - **Accept:** `pnpm test audit/b2`
  - **Notes:**

- [ ] **B2.11** — Seed extension
  - **Files:** `scripts/seed.ts`
  - **Do:** Append `seedB2()` — at least one project per key lifecycle stage useful for A2 (e.g. DRAFT, ACTIVE, CLOSING or CLOSED). Idempotent.
  - **Accept:** `pnpm seed && pnpm seed`
  - **Notes:**

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Standard endpoint matrix passing for every B2 endpoint
- [ ] `canTransition` pure, exported, exhaustively tested
- [ ] Status changes only through the transition endpoint
- [ ] `project.launched` fires exactly once under concurrency
- [ ] Seed script extended
- [ ] Any `TODO(B4)` / `TODO(B5)` markers recorded in `STATUS.md`
- [ ] Spec's review checklist signed off
- [ ] `STATUS.md` updated: active phase B3, generate `B3-TASKS.md`
