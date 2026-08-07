# B0 — Foundation · Tasks

**Spec:** [B0-foundation.md](./B0-foundation.md)
**Model:** strong — this phase sets every pattern later phases copy. Time spent here is repaid ten times.
**Depends on:** nothing

No contracts task: B0 builds the _machinery_ for contracts, not any domain's contracts.

---

## Tasks

- [x] **B0.1** — Project scaffold
  - **Files:** `package.json`, `tsconfig.json`, `next.config.ts`, `.gitignore`, `src/app/layout.tsx`, `src/app/page.tsx`
  - **Do:** Next.js App Router + TypeScript. `tsconfig` with `strict: true`, `noUncheckedIndexedAccess: true`, `paths: { "@/*": ["./src/*"] }`. pnpm. Scripts: `dev`, `build`, `start`, `typecheck`, `lint`, `test`, `verify`.
  - **Accept:** `pnpm typecheck && pnpm build`
  - **Notes:**

- [x] **B0.2** — Lint, format, and the import boundary
  - **Files:** `eslint.config.mjs`, `.prettierrc`, `.husky/pre-commit`
  - **Do:** ESLint with `no-restricted-imports` enforcing: `src/shared` may not import `@/server/*` or `@/client/*`; `src/client` may not import `@/server/*`. Prettier + lint-staged, pre-commit runs `typecheck` and `lint`.
  - **Accept:** A temporary file importing `@/server/x` from `src/shared/` **fails** lint. Delete it after proving the rule works.
  - **Notes:**

- [x] **B0.3** — Environment validation
  - **Files:** `src/server/env.ts`
  - **Do:** Zod schema over `process.env`, parsed once at module load, throwing on failure. Separate `serverEnv` and `publicEnv`. Variables per `docs/ARCHITECTURE.md` §12. Add `.env.example`.
  - **Accept:** `pnpm test env` — missing required var throws with the var named.
  - **Notes:** This must be the only file referencing `process.env`.

- [ ] **B0.4** — Mongoose connection
  - **Files:** `src/server/db/connect.ts`
  - **Do:** Connection cached on `globalThis` to survive HMR. Idempotent `connectDb()`. Handle concurrent calls with a shared promise.
  - **Accept:** `pnpm test db/connect` — calling twice yields one connection.
  - **Notes:**

- [ ] **B0.5** — Model base: options, tenancy plugin, domain mapping
  - **Files:** `src/server/models/base.ts`
  - **Do:** Export `baseOptions` (`timestamps: true`, `strict: 'throw'`, `toJSON` transform mapping `_id` → `id: string` and dropping `_id`/`__v`), the `tenantScoped` plugin (see `docs/ARCHITECTURE.md` §6 — throws when a guarded query lacks `orgId`, with an `allowCrossTenant` option), and a generic `toDomain` helper.
  - **Accept:** `pnpm test models/base` — plugin throws without `orgId`, permits with it, permits with `allowCrossTenant`; transform emits `id` and drops `_id`.
  - **Notes:** The most important file in B0. Everything else copies it.

- [ ] **B0.6** — Shared layer skeleton
  - **Files:** `src/shared/schemas/base.ts`, `src/shared/types/index.ts`, `src/shared/contracts/types.ts`, `src/shared/enums/errors.ts`
  - **Do:** `moneySchema` (`amount: z.number().int()`, `currency: z.string().length(3)`), `isoDateSchema`, `idSchema`, `paginationSchema` (cursor-based: `cursor?`, `limit`), `cursorPageSchema<T>` for responses. The `Contract` type and a `defineContract` helper. The `ErrorCode` enum from the spec.
  - **Accept:** `pnpm typecheck`
  - **Notes:**

- [ ] **B0.7** — Error taxonomy
  - **Files:** `src/server/http/errors.ts`
  - **Do:** `AppError` carrying `code`, `message`, `details?`, plus constructors (`unauthenticated()`, `permissionDenied(permission)`, `notFound()`, `conflict()`, `validationFailed(fieldErrors)`, `upstreamError()`). A `serializeError` mapping each code to its status and the envelope `{ error: { code, message, details? } }`.
  - **Accept:** `pnpm test http/errors` — every code maps to the right status; unknown errors become `INTERNAL` without leaking a stack.
  - **Notes:**

- [ ] **B0.8** — HTTP primitives
  - **Files:** `src/server/http/withAuth.ts`, `withValidation.ts`, `respond.ts`, `requirePermission.ts`
  - **Do:** `withAuth` resolves the session, builds `OrgContext { orgId, userId, orgRole }`, enforces the onboarding gate, catches `AppError` and serialises. `withValidation(schema, handler)` parses body/query into typed input, throwing `VALIDATION_FAILED` with field errors. `respond` helpers `ok`/`created`/`noContent`. `requirePermission` is a **stub** here: allow org `OWNER`/`ADMIN`, throw otherwise — B3 makes it real.
  - **Accept:** `pnpm test http/` — 401 without session, 403 without org, 422 on bad payload, envelope shape correct.
  - **Notes:** Session resolution is stubbed until B1; make the seam obvious.

- [ ] **B0.9** — Audit primitive
  - **Files:** `src/server/models/AuditLog.ts`, `src/server/services/audit/log.ts`
  - **Do:** Model per the spec (`actorType: USER|RULE|SYSTEM|AIRWALLEX`, `actorId`, `action`, `subjectType`, `subjectId`, `before?`, `after?`, `metadata`, `at`). `audit(ctx, entry)` service. Indexes `{ orgId, at: -1 }` and `{ orgId, subjectType, subjectId }`.
  - **Accept:** `pnpm test audit`
  - **Notes:** Every mutation from B1 onward calls this.

- [ ] **B0.10** — Redis client with fallback
  - **Files:** `src/server/redis.ts`
  - **Do:** Lazy connection. When `REDIS_URL` is unset, export an in-memory implementation of the subset used (`get`, `set` with NX/PX, `del`, `incr`) so B1–B4 run without Redis. Key helpers per `docs/ARCHITECTURE.md` §10.
  - **Accept:** `pnpm test redis` — both implementations satisfy the same interface tests.
  - **Notes:**

- [ ] **B0.11** — Test harness
  - **Files:** `vitest.config.ts`, `test/setup.ts`, `test/helpers/db.ts`, `test/helpers/request.ts`, `test/helpers/contract.ts`, `test/helpers/factories/index.ts`
  - **Do:** Vitest with `unit` and `integration` projects. `db.ts` uses `mongodb-memory-server`, fresh DB per file, collections cleared between tests. `request.ts` exposes `buildRequest({ session, body, query, params })` returning a `Request`, plus a typed body reader. `contract.ts` exposes `expectMatchesContract(res, schema)`. Factories: `makeUser`, `makeOrg`, `makeMember` with partial overrides. **A network guard in `setup.ts` that fails any test attempting an outbound HTTP call.**
  - **Accept:** `pnpm test` green with a sample test using every helper. A test making a real `fetch` fails.
  - **Notes:** The network guard is what keeps B5 and B8 honest.

- [ ] **B0.12** — Seed script
  - **Files:** `scripts/seed.ts`
  - **Do:** `pnpm seed` creating one org and one owner. Idempotent — safe to re-run. Structured so each later phase appends its own section.
  - **Accept:** `pnpm seed && pnpm seed` succeeds twice with no duplicates.
  - **Notes:**

- [ ] **B0.13** — Health endpoint and `pnpm verify`
  - **Files:** `src/app/api/health/route.ts`, `package.json`
  - **Do:** `GET /api/health` checking Mongo and Redis, returning 200 when both are up and 503 otherwise with which failed. `verify` script = `typecheck && lint && test`.
  - **Accept:** `pnpm verify` green; health returns 503 with Mongo stopped.
  - **Notes:**

---

## Phase exit

- [ ] All 13 tasks checked and committed
- [ ] `pnpm verify` green from a clean clone
- [ ] The import boundary rule provably fails a violating import
- [ ] `tenantScoped` provably throws
- [ ] The network guard provably fails a real fetch
- [ ] `process.env` appears in exactly one file
- [ ] B0's review checklist in the spec signed off
- [ ] `STATUS.md` updated: active phase B1, generate `B1-TASKS.md`
