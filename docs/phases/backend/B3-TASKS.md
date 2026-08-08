# B3 — Roles, Permissions & Members · Tasks

**Spec:** [B3-access-control.md](./B3-access-control.md)
**Model:** mid — permission merge is subtle; follow the spec literally, do not invent composition rules.
**Depends on:** B2, complete and verified

---

## Contracts first

- [ ] **B3.0** — Schemas and contracts
  - **Files:** `src/shared/enums/permissions.ts`, `src/shared/schemas/accessScope.ts`, `src/shared/schemas/role.ts`, `src/shared/schemas/projectMember.ts`, `src/shared/schemas/accessReview.ts` (if needed), `src/shared/types/*`, `src/shared/contracts/role.ts`, `src/shared/contracts/projectMember.ts`, `src/shared/contracts/accessReview.ts`, `src/shared/contracts/mePermissions.ts` (or fold into auth)
  - **Do:** Every endpoint in the spec's table gets a contract entry. Inline shapes:
    - `Permission` enum (flat strings): `project.view | project.edit | project.create | project.close | budget.view | budget.edit | budget.request | member.view | member.manage | role.assign | card.create | card.view | card.viewDetails | card.manage | payment.make | request.approve | control.edit | transaction.view | report.export`
    - `AccessScope`: `{ level: PROJECT|WORKSTREAM|CATEGORY|CARD|OWN|ASSIGNED_MEMBERS, workstreamIds?, categoryIds?, cardIds?, memberIds?, validFrom?, validTo? }` — dates ISO on the wire
    - `role`: `id, orgId, key, name, isTemplate, permissions: Permission[], defaultScope?: AccessScope, createdAt, updatedAt`
    - `createRoleInput` / `updateRoleInput`: name, key?, permissions, defaultScope?; update may include `force?: boolean` for template-in-use
    - `projectMember`: `id, orgId, projectId, userId, roleId, scope, effectivePermissions: Permission[], addedBy, addedAt, removedAt?` (+ populated `role` / `user` summaries where list needs them — define explicitly)
    - `addMemberInput`: `{ userId, roleId, scope }`
    - `updateMemberInput`: partial `{ roleId?, scope? }`
    - `previewMemberInput`: `{ roleId, scope }` (hypothetical; no save)
    - `previewMemberOutput`: `{ permissions: Permission[], scope: AccessScope, reasons: { permission: Permission, allowed: boolean, message: string }[] }`
    - `accessReview` + resolve input (status, subject refs — define from ARCHITECTURE if present; keep minimal)
    - `mePermissions`: `{ projects: { projectId, permissions: Permission[], scope: AccessScope }[] }` for client `can()`
  - **Pattern:** `src/shared/contracts/project.ts`, `src/shared/schemas/project.ts`
  - **STOP and get reviewed before implementing.** Preview shape and `mePermissions` are the highest-risk contracts.
  - **Accept:** `pnpm typecheck`

---

## Tasks

- [ ] **B3.1** — Role + ProjectMember models
  - **Files:** `src/server/models/Role.ts`, `src/server/models/ProjectMember.ts`
  - **Do:** Tenant-scoped. Role indexes `(orgId, key)` unique. ProjectMember unique `(orgId, projectId, userId)` partial where `removedAt` null. Embed `AccessScope` and `effectivePermissions[]`. Follow `docs/ARCHITECTURE.md` §5 and `src/server/models/Project.ts`.
  - **Pattern:** `src/server/models/Membership.ts`
  - **Accept:** `pnpm test models/role` and `pnpm test models/projectMember`
  - **Notes:**

- [ ] **B3.2** — Role templates constant + seed helper
  - **Files:** `src/shared/constants/roleTemplates.ts`, replace `src/server/services/organizations/seedRoleTemplates.ts` no-op
  - **Do:** Seven templates: Finance Administrator, Project Manager, Approver, Project Spender, Procurement Lead, Contractor, Viewer — each with an explicit `Permission[]` from the CSV/PRD matrix (inline the lists). `seedRoleTemplates(orgId)` copies them into the org as `isTemplate: true`. Idempotent on `(orgId, key)`.
  - **Accept:** `pnpm test services/seedRoleTemplates`
  - **Notes:**

- [ ] **B3.3** — `computeEffectivePermissions` pure function
  - **Files:** `src/server/services/access/computeEffectivePermissions.ts`
  - **Do:** Export the function from the spec. Composition: start from role permissions; expired time window → empty; scope narrows subjects only; org OWNER/ADMIN widens and is never silently narrowed by a project role; populate `reasons[]` for every grant/denial. No I/O.
  - **Accept:** `pnpm test access/computeEffectivePermissions` — seven templates × six scope levels + time-window + OWNER + OWN/CARD subject cases
  - **Notes:**

- [ ] **B3.4** — Repositories
  - **Files:** `src/server/repositories/roles.ts`, `src/server/repositories/projectMembers.ts`
  - **Do:** `OrgContext` first. Role CRUD; list templates+custom. ProjectMember add/update/soft-remove; find by project+user; list by project; recompute helpers that rewrite `effectivePermissions` wholesale. Soft-remove sets `removedAt`.
  - **Pattern:** `src/server/repositories/projects.ts`
  - **Accept:** `pnpm test repositories/roles` and `pnpm test repositories/projectMembers`
  - **Notes:**

- [ ] **B3.5** — Real `requirePermission`
  - **Files:** `src/server/http/requirePermission.ts`
  - **Do:** Replace B0 stub. Resolve `ProjectMember` when `subject.projectId` present; check permission then scope against subject (`cardId` etc.). Org OWNER/ADMIN short-circuit with full access (document). Permission-only checks without subject remain half-authorization — require subject when the permission is subject-scoped.
  - **Accept:** `pnpm test http/requirePermission`
  - **Notes:**

- [ ] **B3.6** — Roles API
  - **Files:** `src/app/api/roles/route.ts`, `src/app/api/roles/[id]/route.ts`, `src/server/services/roles/*`
  - **Do:** List/create/update/delete per spec table. Template-in-use edits need `force` or reject. Delete rejected while assigned. Audit + events as applicable.
  - **Accept:** `pnpm test api/roles` — matrix rows that apply
  - **Notes:**

- [ ] **B3.7** — Project members API
  - **Files:** `src/app/api/projects/[id]/members/route.ts`, `.../[userId]/route.ts`, `src/server/services/projectMembers/*`
  - **Do:** List/add/update/remove. On add/update: run `computeEffectivePermissions`, persist materialised cache. Soft-remove. Cross-org → 404. Emit `member.added` / `member.role_changed` / `member.scope_changed` / `member.removed`.
  - **Accept:** `pnpm test api/project-members`
  - **Notes:**

- [ ] **B3.8** — Permission preview
  - **Files:** `src/app/api/projects/[id]/members/preview/route.ts`, service using same `computeEffectivePermissions`
  - **Do:** `POST` hypothetical `{ roleId, scope }` → preview output. Must call the **same** pure function as enforcement — no second implementation.
  - **Accept:** `pnpm test api/member-preview` — preview matches enforcement fixtures
  - **Notes:**

- [ ] **B3.9** — Access history + access reviews
  - **Files:** `src/app/api/projects/[id]/access-history/route.ts`, `src/app/api/access-reviews/route.ts`, `src/app/api/access-reviews/[id]/resolve/route.ts`, services
  - **Do:** History from audit for membership changes. Access-reviews list + resolve (minimal model if not already present — define in B3.0).
  - **Accept:** `pnpm test api/access-history` and `pnpm test api/access-reviews`
  - **Notes:**

- [ ] **B3.10** — `GET /api/me/permissions`
  - **Files:** `src/app/api/me/permissions/route.ts`, service
  - **Do:** Effective permissions per project for the caller — shape for client `can()`. Authenticated + onboarded.
  - **Accept:** `pnpm test api/me-permissions`
  - **Notes:**

- [ ] **B3.11** — Retrofit B1 + B2 endpoints
  - **Files:** every B1/B2 route using `requirePermission`; checklist in Notes
  - **Do:** Explicit sweep — each endpoint uses real permission + subject where required. Add/adjust tests so under-permissioned callers fail. Walk the list in the PR/Notes.
  - **Accept:** `pnpm test api/` green; document checklist in Notes
  - **Notes:**

- [ ] **B3.12** — Events + audit coverage
  - **Files:** `src/server/events/types.ts` if needed, `test/events/members.test.ts`, `test/audit/b3.test.ts`
  - **Do:** `member.added|role_changed|scope_changed|removed` once each. One audit assertion per mutating B3 endpoint.
  - **Accept:** `pnpm test events/members` and `pnpm test audit/b3`
  - **Notes:**

- [ ] **B3.13** — Seed extension
  - **Files:** `scripts/seed.ts`
  - **Do:** `seedB3()` — role templates for demo org; at least one project with members spanning several templates/scopes useful for A3. Idempotent.
  - **Accept:** `pnpm seed && pnpm seed` (or `pnpm test seed`)
  - **Notes:**

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Standard endpoint matrix passing for every B3 endpoint
- [ ] `computeEffectivePermissions` pure, exported, exhaustively tested
- [ ] Preview and enforcement share one implementation
- [ ] Every B1 and B2 endpoint retrofitted (walk the list)
- [ ] Role templates are per-org copies
- [ ] Seed script extended
- [ ] Spec's review checklist signed off
- [ ] `STATUS.md` updated: active phase B4, generate `B4-TASKS.md`
