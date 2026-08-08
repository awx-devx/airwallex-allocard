# B1 — Auth, Organisations & Onboarding · Tasks

**Spec:** [B1-auth-organizations.md](./B1-auth-organizations.md)
**Model:** strong — B2 onwards copies this phase's structure for models, repositories, handlers, and tests.
**Depends on:** B0, complete and verified

---

## Contracts first

- [x] **B1.0** — Schemas and contracts
  - **Files:** `src/shared/schemas/{user,organization,membership,invite}.ts`, `src/shared/types/*`, `src/shared/contracts/{auth,organization,invite}.ts`, `src/shared/enums/orgRole.ts`
  - **Do:** Every endpoint in the spec's table gets a contract entry. Shapes:
    - `user`: `id, email, name, image?, defaultOrgId?, createdAt` — **never** `passwordHash`
    - `organization`: `id, name, slug, country, baseCurrency, costCentres[], settings, createdAt`
    - `membership`: `id, orgId, userId, orgRole, status, joinedAt`
    - `invite`: `id, orgId, email, orgRole, expiresAt, status, invitedBy` — **never** the token or its hash
    - `invitePreview`: `orgName, invitedByName, orgRole, expiresAt` (public, deliberately minimal)
    - `meResponse`: `{ user, memberships[], activeOrg?, onboarded }`
    - `onboardingStatus`: `{ onboarded, pendingInvites: invitePreview[] }`
  - **STOP and get reviewed before implementing.** `meResponse` in particular — the app shell and every guard depend on it, and it's the shape most likely to need a second round trip if it's wrong.
  - **Accept:** `pnpm typecheck`
  - **Notes:** `airwallexAccountId` on org (D1 seam). `meResponse.memberships` are `membershipWithOrg` (`org: { id, name, slug }`). `listMembers`/`updateMember` return `membershipWithUser` (`user: { id, email, name, image? }`). Auth.js catch-all has no contract. Review decisions applied.

---

## Tasks

- [x] **B1.1** — Models
  - **Files:** `src/server/models/{User,Organization,Membership,Invite}.ts`
  - **Do:** Follow `docs/ARCHITECTURE.md` §5 and the `base.ts` pattern from B0.5. `User` and `Organization` are **not** tenant-scoped (no plugin); `Membership` and `Invite` are. Indexes: `User.email` unique lowercased; `Organization.slug` unique; `Membership {orgId, userId}` unique; `Invite.tokenHash` unique, plus `{orgId, email, status}`.
  - **Accept:** `pnpm test models/` — unique constraints enforced, `toJSON` drops `passwordHash` and `tokenHash`
  - **Notes:** `passwordHash` / `tokenHash`: `select: false` + `baseOptionsOmitting`. Org `createdBy` is model-only (not on public contract).

- [x] **B1.2** — Repositories
  - **Files:** `src/server/repositories/{users,organizations,memberships,invites}.ts`
  - **Do:** Per `.cursor/rules/repositories.mdc`. Note `users` and `organizations` are cross-tenant by nature — take `userId` rather than `OrgContext` where that's genuinely correct, and document why at the top of each file.
  - **Accept:** `pnpm test repositories/`
  - **Notes:** Users/orgs cross-tenant; memberships/invites `OrgContext`-first with documented `allowCrossTenant` helpers for `/api/me`, preview, and onboarding.
- [x] **B1.3** — Auth.js setup
  - **Files:** `src/server/auth/config.ts`, `src/app/api/auth/[...nextauth]/route.ts`
  - **Do:** Auth.js with a Mongoose adapter. Credentials provider using argon2. One OAuth provider. JWT session carrying `userId`, `orgId`, `orgRole`, `onboarded`.
  - **Accept:** `pnpm test auth/config`
  - **Notes:** Custom Mongoose adapter (stock MongoDB adapter conflicts with our strict User schema). Google OAuth optional via `AUTH_GOOGLE_ID`/`SECRET` with `allowDangerousEmailAccountLinking`. JWT caches org context; request-level org resolution is B1.4.

- [x] **B1.4** — Onboarding derivation and org context
  - **Files:** `src/server/auth/session.ts`, update `src/server/http/withAuth.ts`
  - **Do:** `onboarded` = has ≥1 `ACTIVE` membership, **computed, never stored**. Active org resolution order: explicit request `orgId` → `user.defaultOrgId` → sole membership. Requesting an org the user isn't a member of throws `NOT_FOUND`. Replace B0.8's stubbed session resolution with the real one.
  - **Accept:** `pnpm test auth/session` — covers all three resolution paths, plus non-member → 404
  - **Notes:** Explicit org via `x-org-id` header or `orgId` query. JWT callback recomputes org context each refresh. Resolver seam moved to `sessionResolver.ts` to avoid import cycles.

- [x] **B1.5** — Sign-up
  - **Files:** `src/app/api/auth/sign-up/route.ts`, `src/server/services/auth/signUp.ts`
  - **Do:** Create a user. **Does not create an organisation.** Duplicate email returns a neutral message that doesn't confirm account existence. Rate limit by IP.
  - **Accept:** `pnpm test api/sign-up`
  - **Notes:** Public via `withPublicValidation`. Rate limit 10/hour/IP (Redis). Duplicate → neutral `CONFLICT`. Audit under sentinel org `_platform`.

- [x] **B1.6** — `/api/me`
  - **Files:** `src/app/api/me/route.ts`
  - **Do:** `GET` returns `meResponse`. `PATCH` updates name, image, `defaultOrgId` (validating membership in the target org).
  - **Accept:** `pnpm test api/me` — includes standard matrix
  - **Notes:** `withAuth({ requireOnboarded: false })` so the shell works pre-org. `defaultOrgId` must be an ACTIVE membership (else 404). Audit `user.updated`.

- [ ] **B1.7** — Organisation create, read, update
  - **Files:** `src/app/api/organizations/route.ts`, `src/app/api/organizations/[id]/route.ts`, `src/server/services/organizations/`
  - **Do:** `POST` creates the org, makes the caller `OWNER`, and seeds the seven role templates as per-org copies (stub the role model here if B3 hasn't defined it — leave a `TODO(B3)` and record it in `STATUS.md`). `GET`/`PATCH` per the spec.
  - **Accept:** `pnpm test api/organizations`
  - **Notes:**

- [ ] **B1.8** — Organisation members
  - **Files:** `src/app/api/organizations/[id]/members/route.ts`, `.../[userId]/route.ts`
  - **Do:** List, change org role, suspend, remove. **Removing or demoting the last `OWNER` is rejected with `CONFLICT`.**
  - **Accept:** `pnpm test api/org-members` — last-owner rule covered
  - **Notes:**

- [ ] **B1.9** — Invites: create, list, revoke, preview
  - **Files:** `src/app/api/invites/route.ts`, `.../[id]/route.ts`, `.../preview/[token]/route.ts`
  - **Do:** Create generates a random token, stores **only its hash**, returns the raw token once for the link. 7-day expiry. Preview is public, resolves by token hash, and returns only `invitePreview`. Log the invite link rather than sending email.
  - **Accept:** `pnpm test api/invites` — raw token never appears in any response other than the create response
  - **Notes:**

- [ ] **B1.10** — Invite acceptance
  - **Files:** `src/app/api/invites/accept/route.ts`, `src/server/services/invites/accept.ts`
  - **Do:** Consume the token, create the membership, mark accepted. Reject expired, revoked, and already-accepted with **distinguishable** codes. Reject with `403` when the invite email doesn't match the signed-in user. Single-use, enforced under a lock or a conditional update so two concurrent accepts can't both succeed.
  - **Accept:** `pnpm test api/invite-accept` — every rejection path distinguishable; concurrent accept creates one membership
  - **Notes:**

- [ ] **B1.11** — Onboarding status
  - **Files:** `src/app/api/onboarding/status/route.ts`
  - **Do:** Returns `onboarded` plus pending invites matching the signed-in user's email. Powers A1's fork screen.
  - **Accept:** `pnpm test api/onboarding`
  - **Notes:**

- [ ] **B1.12** — Events
  - **Files:** `src/server/events/bus.ts`, `src/server/events/types.ts`
  - **Do:** Typed `DomainEvent` union per `docs/ARCHITECTURE.md` §7. Publish after the write commits. Emit `organization.created`, `member.invited`, `member.joined`, `member.removed`. **Redis Streams transport is B6** — here, a no-op publisher that logs and is asserted in tests is sufficient. Do not build the consumer.
  - **Accept:** `pnpm test events` — each mutation emits exactly one event with the right payload
  - **Notes:**

- [ ] **B1.13** — Audit coverage
  - **Files:** touches the services from B1.5–B1.10
  - **Do:** Confirm every mutation writes exactly one audit entry with the correct actor and subject. Add any that are missing.
  - **Accept:** `pnpm test audit/b1` — one assertion per mutating endpoint
  - **Notes:** Row 10 of the standard matrix. Easy to skip, and it's what makes B9's audit view real.

- [ ] **B1.14** — Seed extension
  - **Files:** `scripts/seed.ts`
  - **Do:** Extend to create one org with an owner, two additional members, and one pending invite.
  - **Accept:** `pnpm seed && pnpm seed`
  - **Notes:**

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Standard matrix passing for every B1 endpoint
- [ ] No endpoint but sign-up, Auth.js routes, and invite preview is reachable unauthenticated
- [ ] `onboarded` is derived, not stored
- [ ] Invite tokens stored hashed; raw token appears only in the create response
- [ ] Cross-org reads return `404`
- [ ] Any `TODO(B3)` markers recorded in `STATUS.md`
- [ ] Spec's review checklist signed off
- [ ] `STATUS.md` updated: active phase B2, generate `B2-TASKS.md`
