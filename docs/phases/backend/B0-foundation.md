# B0 — Foundation

**Track:** Backend · **Depends on:** nothing · **Powers:** every subsequent phase

## Goal

Establish every convention so that B1 onwards is domain work, not decision-making. Nothing product-facing ships here. The test is whether someone could write B1 without inventing a single new pattern.

## Deliverables

### Project setup

- Next.js App Router, TypeScript `strict: true`, `noUncheckedIndexedAccess: true`
- pnpm, path alias `@/*` → `src/*`
- ESLint with an **import boundary rule**: `src/shared` may not import from `src/server` or `src/client`; `src/client` may not import from `src/server`
- Prettier, lint-staged, a pre-commit hook running typecheck and lint
- Scripts: `dev`, `dev:worker`, `build`, `start`, `worker`, `test`, `test:watch`, `seed`, `typecheck`

### Environment

`src/server/env.ts` — Zod-validated, parsed once at import, throws on boot if anything is missing. Never read `process.env` anywhere else.

```ts
export const env = envSchema.parse(process.env)
```

Separate `serverEnv` and `publicEnv` objects so nothing server-only can be referenced from client code.

### Database

- `server/db/connect.ts` — Mongoose connection cached on `globalThis` to survive HMR
- `server/models/base.ts` — `baseOptions` (timestamps, `toJSON` transform, `strict: 'throw'`), the `tenantScoped` plugin, and `toDomain` helpers
- Index sync on boot in development; a `pnpm db:indexes` script for production

See [`../../ARCHITECTURE.md`](../../ARCHITECTURE.md) §5 for the model pattern and §6 for `tenantScoped`.

### Shared layer skeleton

```
src/shared/
  schemas/    base.ts       objectIdString, isoDate, money, pagination
  types/      index.ts
  contracts/  index.ts      the contract type helper
  enums/      errors.ts, permissions.ts (populated in B3)
  constants/
```

The `money` schema and helper land here now because B4 onwards depends on it:

```ts
export const moneySchema = z.object({
  amount:   z.number().int(),     // minor units
  currency: z.string().length(3),
})
```

### Error envelope

One shape for every failure, from one `AppError` class:

```json
{ "error": { "code": "PERMISSION_DENIED", "message": "Missing card.create", "details": { "permission": "card.create" } } }
```

| Code | Status | When |
| --- | --- | --- |
| `UNAUTHENTICATED` | 401 | No valid session |
| `ONBOARDING_INCOMPLETE` | 403 | Session exists, no organisation |
| `PERMISSION_DENIED` | 403 | Authenticated, lacks the permission |
| `NOT_FOUND` | 404 | Missing, **or belongs to another org** |
| `CONFLICT` | 409 | State machine violation, duplicate key |
| `VALIDATION_FAILED` | 422 | Zod parse failure, with field errors |
| `RATE_LIMITED` | 429 | |
| `UPSTREAM_ERROR` | 502 | Airwallex failed |
| `INTERNAL` | 500 | Unhandled |

Cross-tenant access returns `404`, never `403` — a `403` confirms the resource exists.

### HTTP primitives

`server/http/` provides the wrappers every route handler composes:

```ts
export const POST = withAuth(
  withValidation(createProjectInput, async (ctx, input) => {
    await requirePermission(ctx, 'project.create')
    const project = await projectService.create(ctx, input)
    return created(project)
  })
)
```

- `withAuth` — resolves the session, builds `OrgContext`, enforces the onboarding gate, throws `UNAUTHENTICATED` / `ONBOARDING_INCOMPLETE`
- `withValidation` — parses body and query against a Zod schema, throws `VALIDATION_FAILED` with field errors
- `requirePermission` — a stub in B0 that allows org `OWNER`/`ADMIN` and throws otherwise; made real in B3
- `respond` helpers — `ok`, `created`, `noContent`, and a catch-all error serialiser

### Audit primitive

`auditLogs` model plus `audit(ctx, { action, subjectType, subjectId, before, after })`. Every mutation from B1 onward calls it. Write it in the same unit of work as the mutation.

### Redis

`server/redis.ts` — lazily connected, and a no-op in-memory fallback when `REDIS_URL` is unset so B1–B4 can run without it.

### Test harness

- Vitest, with separate `unit` and `integration` projects
- `test/helpers/db.ts` — `mongodb-memory-server`, fresh database per file, collections cleared between tests
- `test/helpers/request.ts` — builds a `Request` with a session, calls a route handler directly, returns a typed parsed body
- `test/helpers/factories/` — `makeUser`, `makeOrg`, `makeMember`; extended by each later phase
- A shared assertion `expectMatchesContract(res, contract.output)`

### Seed script

`pnpm seed` — starts as one org with one owner. Every later phase extends it. Idempotent, and safe to re-run.

## Endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Verifies Mongo and Redis connectivity; used by Railway |

## Tests

- `env.ts` throws when a required variable is missing
- `tenantScoped` throws on a query without `orgId`, and allows one with `allowCrossTenant`
- The `toJSON` transform produces `id` (string) and drops `_id` and `__v`
- The error serialiser maps every `AppError` code to the right status
- `withAuth` returns 401 with no session and 403 with a session lacking an org
- `mongodb-memory-server` spins up and tears down cleanly

## Review checklist

- [ ] `pnpm typecheck`, `pnpm lint`, and `pnpm test` all pass from a clean clone
- [ ] The ESLint boundary rule actually fails a build when `shared` imports from `server`
- [ ] `process.env` appears in exactly one file
- [ ] The error envelope is identical for every failure mode
- [ ] `tenantScoped` is applied to a sample model and provably throws
- [ ] `pnpm seed` runs twice without error
- [ ] `GET /api/health` returns 200 with both dependencies up, non-200 with either down

## Out of scope

Real permissions (B3), any domain model beyond `auditLogs`, the Airwallex client (B5), the worker process (B6).
