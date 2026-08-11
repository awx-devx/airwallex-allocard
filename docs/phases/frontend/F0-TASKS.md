# F0 — Client Foundation · Tasks

**Spec:** [F0-foundation.md](./F0-foundation.md)

**Model:** cheap / LOW — name every file, inline every shape, copy the cited B0/B1/shared file; do not invent new API endpoints or product screens.

**Depends on:** B9, complete and verified

No domain contracts task: F0 builds client machinery on existing `shared/contracts`. The shared error envelope below is the review gate (client must parse the same wire shape B0 already emits).

## Contracts first

- [x] **F0.0** — Shared error envelope schema
  - **Files:**
    - `src/shared/schemas/error.ts`
    - `src/shared/types/error.ts`
    - re-export from `src/shared/types/index.ts`
  - **Do:** Move the wire shape of `serializeError` into Zod so the client can parse it. Do **not** change status mapping or server constructors.
    - `errorEnvelopeSchema`: `{ error: { code: nativeEnum(ErrorCode), message: string min 1, details?: unknown } }` — `ErrorCode` from `src/shared/enums/errors.ts`
    - `ErrorEnvelope` type = `z.infer<typeof errorEnvelopeSchema>`
    - Update `src/server/http/errors.ts` to import `ErrorEnvelope` from `@/shared/types/error` (or schemas) instead of declaring its own — keep `serializeError` behaviour identical
  - **Pattern:** `src/shared/schemas/auth.ts` + `src/shared/enums/errors.ts` + `src/server/http/errors.ts` (envelope type today)
  - **STOP and get reviewed before implementing the rest of F0.**
  - **Accept:** `pnpm typecheck` and `pnpm test http/errors`
  - **Notes:** Schema + type added; `server/http/errors.ts` re-exports `ErrorEnvelope` from shared. `serializeError` unchanged. `z.nativeEnum(ErrorCode)` matches other TS enums (e.g. `ActorType`).

## Implementation tasks

### F0.1 — Client deps

- [x] **F0.1** — Client deps: TanStack Query
  - **Files:** `package.json`, `pnpm-lock.yaml`
  - **Do:** Add `@tanstack/react-query` (current major compatible with React 19). Do not add UI libraries yet (F3). `next-auth` already present for `SessionProvider`.
  - **Pattern:** dependency add style in `package.json` (existing deps block)
  - **Accept:** `pnpm install` succeeds; `pnpm typecheck`
  - **Notes:** `@tanstack/react-query` 5.101.4.

### F0.2 — ApiError

- [x] **F0.2** — `ApiError` class
  - **Files:** `src/client/api/errors.ts`, `src/client/api/errors.test.ts`
  - **Do:** Client-side error class mirroring the server envelope (do **not** import `@/server/*`).
    - Fields: `code: ErrorCode`, `message: string`, `details?: unknown`, `status: number` (HTTP status from the response)
    - `name = 'ApiError'`
    - Static `fromResponse(status: number, body: unknown): ApiError` — parse with `errorEnvelopeSchema`; if parse fails, return `code: INTERNAL`, `message: 'Internal error'`, given `status` (or 500)
    - `isApiError(e: unknown): e is ApiError`
  - **Pattern:** `src/server/http/errors.ts` (`AppError` + `serializeError` envelope) — mirror, do not import
  - **Accept:** `pnpm test client/api/errors`
  - **Notes:** `fromResponse` uses shared `errorEnvelopeSchema`; bad body → INTERNAL.

### F0.3 — Path builder

- [x] **F0.3** — Path builder for contract paths
  - **Files:** `src/client/api/path.ts`, `src/client/api/path.test.ts`
  - **Do:**
    1. Contracts use Express-style segments (`/api/projects/:id/members/:userId`).
    2. `type PathParams<C>` — map of param names extracted from `C['path']` to `string` (require `Record<string, string>` when path has `:params`; empty/undefined when none).
    3. `buildUrl(path: string, params?: Record<string, string>): string` — replace each `:name` with `encodeURIComponent(params[name])`; throw if a `:name` is missing; throw if leftover unused keys.
    4. For `GET` with Zod object `input`, later `call()` appends query string; this task is path-only.
  - **Pattern:** contract paths in `src/shared/contracts/project.ts` / `src/shared/contracts/organization.ts` (`:id` style)
  - **Accept:** `pnpm test client/api/path` — covers multi-param paths and missing/extra params
  - **Notes:** `buildUrl` encodes values; missing/unused params throw.

### F0.4 — Typed call()

- [x] **F0.4** — Typed `call()` client
  - **Files:** `src/client/api/client.ts`, `src/client/api/client.test.ts`, `src/client/api/index.ts`
  - **Do:** Implement `call<C extends Contract>(contract, args?)` returning `Promise<z.infer<C['output']>>`.
    - Args: `params?: Record<string, string>`, `input?: z.infer<C['input']>`, `orgId?: string` (active org for tenancy — sent as `x-org-id`; omit when none), `signal?: AbortSignal`
    1. `url = buildUrl(contract.path, args?.params)`
    2. If method is `GET`|`DELETE` and `input` is a plain object (not void/undefined): append as query string (`URLSearchParams`; skip `undefined`; stringify primitives)
    3. If method is `POST`|`PUT`|`PATCH` and `input` is defined and not void: JSON body + `Content-Type: application/json`
    4. `credentials: 'include'`
    5. If `orgId` set: header `x-org-id: orgId` (same as `src/server/auth/session.ts` `getExplicitOrgId`)
    6. On non-OK: `throw ApiError.fromResponse(status, await res.json().catch(() => null))`
    7. On OK with `output` of `z.void()` / empty 204: return `undefined as z.infer<C['output']>`
    8. Otherwise parse JSON. In development (`process.env.NODE_ENV !== 'production'`): `contract.output.parse(data)` and throw a loud Error naming the contract path on failure. In production: return data without parse (trust server).
    9. Never call a hand-written URL string from outside this module — consumers pass a contract.
  - **Pattern:** `src/shared/contracts/types.ts` (`Contract`, `defineContract`) + `src/shared/contracts/auth.ts` (`authContracts.me` as first consumer in tests) + `src/server/auth/session.ts` (`x-org-id`)
  - **Accept:** `pnpm test client/api/client` — mock `fetch`; assert URL, method, credentials, `x-org-id`, body, query, `ApiError` on envelope, output parse failure in non-production
  - **Notes:** Dev output parse via `safeParse`; prod trusts server. Void/204 → undefined.

### F0.5 — Error behaviour map

- [x] **F0.5** — Error → client behaviour map
  - **Files:** `src/client/api/errorBehaviour.ts`, `src/client/api/errorBehaviour.test.ts`
  - **Do:** Pure functions — no React. Encode F0's table once via `resolveErrorBehaviour(error: ApiError): ErrorBehaviour`:
    - `UNAUTHENTICATED` → `{ type: 'redirect', to: '/sign-in', preserveReturn: true }`
    - `ONBOARDING_INCOMPLETE` → `{ type: 'redirect', to: '/onboarding', preserveReturn: false }`
    - `PERMISSION_DENIED` → `{ type: 'inline-permission', permission?: string }` — read `details.permission` when string
    - `NOT_FOUND` → `{ type: 'not-found' }`
    - `VALIDATION_FAILED` → `{ type: 'field-errors', fieldErrors: Record<string, string[]> }` — read `details.fieldErrors`
    - `CONFLICT` → `{ type: 'toast-refetch', message: string }`
    - `RATE_LIMITED` | `UPSTREAM_ERROR` | `INTERNAL` → `{ type: 'retryable', message: string }`
    - `INVITE_EXPIRED` | `INVITE_REVOKED` | `INVITE_ALREADY_ACCEPTED` → `{ type: 'toast', message: string }` (A1 specialises copy; do not invent new codes)
    - Also `buildSignInHref(returnPath: string): string` — only allow relative paths starting with `/` and **not** starting with `//`; otherwise drop return → `/sign-in`. Query: `?returnTo=` + `encodeURIComponent(path)`.
  - **Pattern:** F0 spec error table + `ErrorCode` in `src/shared/enums/errors.ts` + server `AppError.validationFailed` / `permissionDenied` detail shapes in `src/server/http/errors.ts`
  - **Accept:** `pnpm test client/api/errorBehaviour` — every `ErrorCode` covered; open-redirect attempts rejected
  - **Notes:** Exhaustive switch; invite codes → toast; open-redirect rejected.

### F0.6 — QueryClient factory

- [x] **F0.6** — QueryClient factory (F1 defaults)
  - **Files:** `src/client/providers/queryClient.ts`, `src/client/providers/queryClient.test.ts`
  - **Do:** Single factory `createAppQueryClient(): QueryClient` with defaults from F1:
    - `staleTime: 30_000`
    - `gcTime: 5 * 60_000`
    - `retry: (n, e) => e instanceof ApiError && e.status >= 500 && n < 2`
    - `refetchOnWindowFocus: true`
    - Never retry when `e instanceof ApiError && e.status < 500`. For non-`ApiError`, pick **no retry** (keep tests simple; document in Notes).
    - Prefer creating inside the provider (next task); module-level getter only if needed for non-React callers.
  - **Pattern:** F1 spec “Query defaults” block in `docs/phases/frontend/F1-data-layer.md`
  - **Accept:** `pnpm test client/providers/queryClient` — 4xx not retried; 5xx `ApiError` retries twice max
  - **Notes:** Non-ApiError: no retry.

### F0.7 — Toast + error boundary

- [x] **F0.7** — Toast host + top-level error boundary
  - **Files:**
    - `src/client/providers/ToastProvider.tsx`
    - `src/client/providers/toastStore.ts`
    - `src/client/providers/ErrorBoundary.tsx`
  - **Do:**
    1. Minimal toast API (F3 will restyle): `toastStore.success/error/info(message: string)`, subscribe + render a fixed region. No external toast library.
    2. `ErrorBoundary` class component: `getDerivedStateFromError` → render a fallback with message + “Retry” calling `this.setState({ error: null })`. Log via `console.error` only.
  - **Pattern:** keep tiny — F3 owns polished Toast/Alert; this is the host the error map and shell need now
  - **Accept:** `pnpm typecheck`; smoke test optional `pnpm test client/providers/toast` if store is pure
  - **Notes:** Pure `toastStore` + minimal host; ErrorBoundary with Retry.

### F0.8 — App providers

- [x] **F0.8** — App providers composition
  - **Files:**
    - `src/client/providers/AppProviders.tsx`
    - `src/client/providers/SessionProvider.tsx`
    - `src/app/layout.tsx`
  - **Do:**
    1. `SessionProvider` — re-export/wrap `next-auth/react`'s `SessionProvider` (client component).
    2. `AppProviders` (client): `SessionProvider` → `QueryClientProvider` (client from F0.6, one instance via `useState(() => createAppQueryClient())`) → `ToastProvider` → `ErrorBoundary` → `children`.
    3. Root `src/app/layout.tsx`: wrap `{children}` with `AppProviders`. Keep existing metadata.
  - **Pattern:** `src/app/layout.tsx` (current) + Auth.js client pattern; session config lives in `src/server/auth/config.ts` / `src/server/auth/index.ts` (`auth`, `handlers`) — do not duplicate config
  - **Accept:** `pnpm typecheck && pnpm build`
  - **Notes:** Root layout wraps `AppProviders` (Session → Query → ActiveOrg → Toast → ErrorBoundary).

### F0.9 — Active org context

- [x] **F0.9** — Active org context (client)
  - **Files:** `src/client/providers/ActiveOrgProvider.tsx`, `src/client/providers/activeOrg.tsx`
  - **Do:**
    1. Context value: `{ orgId: string | null, setOrgId: (id: string | null) => void }`
    2. Persist last choice in `localStorage` key `allocard:activeOrgId` (browser only).
    3. `useActiveOrg()` hook.
    4. For F0, exporting `getActiveOrgId()` from a module ref set by the provider is enough for non-hook code; every `call()` must pass `orgId: useActiveOrg().orgId ?? undefined`. Prefer `useCall()` later in F1.
    5. When `meResponse.activeOrg` arrives (shell task), initialise from `activeOrg.id` if no localStorage value.
  - **Pattern:** server resolution order in `src/server/auth/session.ts` — client must send `x-org-id` when multiple memberships; `meResponse` shape in `src/shared/schemas/auth.ts`
  - **Accept:** `pnpm typecheck`
  - **Notes:** `localStorage` key `allocard:activeOrgId`; `getActiveOrgId()` module ref.

### F0.10 — Route guards

- [x] **F0.10** — Server-side route guard helpers
  - **Files:** `src/app/_lib/guards.ts`, `src/app/_lib/guards.test.ts`
  - **Do:** Server-only helpers used by layouts (this file may import `@/server/auth`). **A client redirect is not a guard.**
    - `GuardResult` = `{ ok: true; session: /* non-null auth session */ }` | `{ ok: false; redirectTo: string }`
    - `requireAnonymous(): Promise<GuardResult>` — unauthenticated only; if session exists → `/dashboard` (or `/onboarding` if `!onboarded`)
    - `requireOnboarding(): Promise<GuardResult>` — authenticated but not onboarded; else → `/sign-in` or `/dashboard`
    - `requireApp(): Promise<GuardResult>` — authenticated + onboarded; else → `/sign-in` or `/onboarding`
    - Use `auth()` from `src/server/auth/index.ts`.
    - Session must expose onboarded: Auth.js JWT already carries `onboarded` (B1.3/B1.4). If the typed session lacks it, read from token fields the same way `src/server/auth/config.ts` sets them — do not invent a second source of truth.
    - Return paths: when redirecting anonymous users from `requireApp`, use `returnTo` only if the current path is a safe relative path (same rules as F0.5).
  - **Pattern:** `src/server/auth/index.ts` (`auth`) + onboarding rules in `src/server/auth/session.ts` + B1.4 notes
  - **Accept:** `pnpm test app/_lib/guards` — mock `auth()`; cover anonymous / onboarded / not-onboarded matrix for all three helpers
  - **Notes:** `requireAnonymous` / `requireOnboarding` / `requireApp`; safe `returnTo`.

### F0.11 — Route groups

- [x] **F0.11** — Route groups + layouts
  - **Files:**
    - `src/app/(auth)/layout.tsx`
    - `src/app/(auth)/sign-in/page.tsx`
    - `src/app/(auth)/sign-up/page.tsx`
    - `src/app/(onboarding)/layout.tsx`
    - `src/app/(onboarding)/onboarding/page.tsx`
    - `src/app/(app)/layout.tsx`
    - `src/app/(app)/dashboard/page.tsx`
    - Move or replace `src/app/page.tsx` → redirect to `/dashboard` (server `redirect`)
  - **Do:**
    1. `(auth)/layout.tsx`: `requireAnonymous()`; on failure `redirect(redirectTo)`. Children only — **no app shell**.
    2. `(onboarding)/layout.tsx`: `requireOnboarding()`; no app shell.
    3. `(app)/layout.tsx`: `requireApp()`; wrap children with `AppShell` (next task — if over file budget, stub `AppShell` as `{children}` and replace in F0.12).
    4. Placeholder pages: minimal text `"A1: sign-in"`, `"A1: sign-up"`, `"A1: onboarding"`, `"A2: dashboard"` — **no product UI**.
  - **Pattern:** route groups from F0 spec; `redirect` from `next/navigation`; guards from F0.10
  - **Accept:** `pnpm typecheck && pnpm build`
  - **Notes:** Route groups + placeholder pages; `/` redirects to `/dashboard`.

### F0.12 — App shell

- [x] **F0.12** — App shell (slots only)
  - **Files:**
    - `src/client/shell/AppShell.tsx`
    - `src/client/shell/SideNav.tsx`
    - `src/client/shell/OrgSwitcher.tsx`
    - `src/client/shell/ProjectContext.tsx`
    - `src/client/shell/UserMenu.tsx`
    - `src/client/shell/ApprovalsBadge.tsx`
  - **Do:** Slots for Track A — mocked props OK; do not fetch product lists yet (F1 hooks).
    1. `AppShell`: left nav + top bar regions + `children` main.
    2. `SideNav`: links as props `items: { href: string; label: string; badge?: number }[]` — default stub items: Dashboard `/dashboard`, Projects `/projects`, Approvals `/approvals`, Activity `/activity`, Reports `/reports` (pages need not exist yet; links are fine).
    3. `OrgSwitcher`: props `memberships: { orgId: string; name: string; slug: string }[]`, `activeOrgId: string | null`, `onSwitch(orgId: string)`. Shape matches `meResponse.memberships[].org` (`id`, `name`, `slug`) from `organizationSummarySchema` in `src/shared/schemas/organization.ts`.
    4. `ProjectContext`: props `project: { id: string; name: string; code: string; status: string } | null` — renders nothing useful when null (dashboard); when set, shows name/code placeholder for A2 workspace.
    5. `UserMenu`: props `user: { name: string; email: string; image?: string }`, actions `onSignOut`.
    6. `ApprovalsBadge`: props `count: number` — hide when `0`; show integer otherwise. Wire-ready for `approvalsCountSchema`: `{ count: z.number().int().nonnegative() }` from `src/shared/schemas/purchaseRequest.ts`.
    7. Wire `AppShell` into `(app)/layout.tsx`. Prefer **mocked** props from a `mockShellData` constant so the shell works without DB. Real `call(authContracts.me)` waits for F1 `useSession`.
  - **Pattern:** `meResponseSchema` fields in `src/shared/schemas/auth.ts` / B1.0; `approvalsCountSchema` in `src/shared/schemas/purchaseRequest.ts`; architecture tree `client/` + shell description in F0 spec
  - **Accept:** `pnpm typecheck`
  - **Notes:** Slots with `mockShellData`; ApprovalsBadge hides at 0.

### F0.13 — State conventions

- [x] **F0.13** — State convention primitives
  - **Files:**
    - `src/client/states/types.ts`
    - `src/client/states/LoadingState.tsx`
    - `src/client/states/EmptyState.tsx`
    - `src/client/states/ErrorState.tsx`
    - `src/client/states/PartialState.tsx`
  - **Do:** Decide the four states now; keep visuals minimal (F3 restyles `EmptyState` / `ErrorState`).
    1. `LoadingState`: props `{ label?: string; rows?: number }` — skeleton blocks matching a simple list layout (avoid layout shift: fixed min-height).
    2. `EmptyState`: props `{ title: string; description: string; action?: { label: string; onClick: () => void } }` — illustration slot as optional `ReactNode`.
    3. `ErrorState`: props `{ message: string; onRetry?: () => void }` — maps to retryable / generic errors from F0.5.
    4. `PartialState`: props `{ children: ReactNode; observedAt: string /* iso datetime */; staleAfterMs?: number }` — when `Date.now() - Date.parse(observedAt) > (staleAfterMs ?? 15 * 60_000)`, show subtle “Updated {relative}” indicator; still render children. For attribute values carrying `observedAt` (`attributeValueSchema.observedAt: isoDateSchema` in `src/shared/schemas/attribute.ts`).
  - **Pattern:** F0 “State conventions” section; `observedAt` on `attributeValueSchema` in `src/shared/schemas/attribute.ts`
  - **Accept:** `pnpm typecheck`
  - **Notes:** Loading/Empty/Error/Partial; stale default 15m.

### F0.14 — Dev shell gallery

- [x] **F0.14** — Dev shell gallery (all states)
  - **Files:** `src/app/dev/shell/page.tsx`, `src/app/dev/shell/layout.tsx`
  - **Do:**
    1. Available only when `process.env.NODE_ENV !== 'production'` — in production layout `notFound()`.
    2. Render `AppShell` with mocked data **and** each state primitive: loading, empty, error, partial (fresh + stale `observedAt`).
    3. No auth guard required (dev only), but do not import `@/server/*` secrets.
  - **Pattern:** F3 kitchen-sink idea (`/dev/ui` in F3 spec) — this is the F0 equivalent for shell/states
  - **Accept:** `pnpm typecheck && pnpm build`
  - **Notes:** `/dev/shell` gallery; `notFound()` in production.

### F0.15 — ESLint boundary proofs

- [x] **F0.15** — ESLint boundary proof + no raw `fetch` in client UI
  - **Files:** `eslint.config.mjs` (extend), temporary proof files deleted after
  - **Do:**
    1. Confirm existing rule: `src/client/**` cannot import `@/server/*` (B0.2). Add a temporary `src/client/_boundary_proof.ts` importing `@/server/env` — `pnpm lint` must fail. Delete the file.
    2. Add a targeted restriction for `fetch(` under `src/client/shell/**/*`, `src/client/states/**/*`, and `src/app/(app)/**/*` — message: use `call()` from `@/client/api`. Allow `fetch` inside `src/client/api/**`.
    3. Prove a forbidden `fetch` in `src/client/shell/_fetch_proof.ts` fails lint; delete after.
  - **Pattern:** B0.2 in `docs/phases/backend/B0-TASKS.md` + `eslint.config.mjs`
  - **Accept:** Proof failures observed; proofs deleted; `pnpm lint` green afterward
  - **Notes:** Boundary + no-fetch proofs observed then deleted; `no-restricted-syntax` on shell/states/(app).

### F0.16 — Me smoke test

- [x] **F0.16** — Integration smoke: `call(authContracts.me)` against test harness
  - **Files:** `src/client/api/me.integration.test.ts` (or `test/client/me-call.test.ts`)
  - **Do:** Using existing API test helpers (`test/helpers/request.ts`, auth factories from B1), hit `GET /api/me` through the real route handler **and** assert the JSON parses with `meResponseSchema`. Separately assert `call(authContracts.me, { orgId })` builds the right request (mock fetch) — already partly in F0.4; here assert `output` matches `meResponseSchema` fields:
    - `user`: `id, email, name, image?, defaultOrgId?, createdAt`
    - `memberships[]`: `id, orgId, userId, orgRole, status, joinedAt, org: { id, name, slug }`
    - `activeOrg?`: full `organizationSchema`
    - `onboarded`: `boolean`
  - **Pattern:** `src/shared/contracts/auth.ts` + `pnpm test api/me` style from B1.6 + `test/helpers/contract.ts` `expectMatchesContract`
  - **Accept:** `pnpm test client/api/me` (or the path you chose)
  - **Notes:** `test/client/me-call.test.ts` — route + `call(authContracts.me)` smoke.

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] No component outside `src/client/api/**` calls `fetch` directly (lint rule)
- [ ] Response validation against contracts active when `NODE_ENV !== 'production'`
- [ ] Every `ErrorCode` has a defined client behaviour (F0.5)
- [ ] Route guards run server-side in `(auth)` / `(onboarding)` / `(app)` layouts (not client-only)
- [ ] `/dev/shell` renders shell + loading/empty/error/partial
- [ ] No server-only import reachable from `src/client` (ESLint boundary proof)
- [ ] Spec's review checklist in `F0-foundation.md` signed off
- [ ] `STATUS.md` updated: active phase F1, generate `F1-TASKS.md` when starting F1

## Out of scope (do not do in F0)

- Query hooks / `queryKeys` (F1)
- Money/date/`can()` utils (F2)
- shadcn primitives / `/dev/ui` (F3)
- Real sign-in, onboarding, or dashboard product screens (A1–A2)
- Changing any existing B0–B9 contract field names
