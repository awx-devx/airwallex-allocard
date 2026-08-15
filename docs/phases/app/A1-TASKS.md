# A1 — Auth & Onboarding Screens · Tasks

**Spec:** [A1-auth-onboarding.md](./A1-auth-onboarding.md)
**Model:** cheap / LOW — name every file, inline every field with type and constraints, copy the cited F3/F0/F1 file; do not invent endpoints, change B1 contracts, add primitives, or touch `AppShell`.
**Depends on:** F3, complete and verified

No new API contracts. B1 already shipped `authContracts`, `organizationContracts`, `inviteContracts`. The review gate is the locked policies + helper shapes below.

**Powers:** B1 · **Hooks (F1, already exist):** `useSignUp`, `useOnboardingStatus`, `useCreateOrganization`, `useInvitePreview`, `useAcceptInvite`, `useMe` · **Guards (F0, already exist):** `requireAnonymous`, `requireOnboarding`, `requireApp`

Recipe: [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). Visual tokens: [`../../VISUAL-DIRECTION.md`](../../VISUAL-DIRECTION.md).

---

## Deferred to A2 (do not do in A1)

**AppShell collapse** is A2. `src/client/shell/AppShell.tsx` currently has a always-visible `w-56` aside. A2’s first product-shell task must make the aside `hidden md:flex` and open the same `SideNav` / `OrgSwitcher` in F3 `Sheet` (`src/components/ui/sheet.tsx`, `side="left"`) behind a `md:hidden` menu button. Do **not** edit `AppShell.tsx`, `SideNav.tsx`, or `(app)/layout.tsx` in A1. A1 has **no** `AppShell`.

---

## A1.0 locked policies (do not reopen)

Approved 2026-08-15. Implementers follow these; do not re-litigate.

### 1. No new contracts, no new primitives, no AppShell

- Do **not** add or rename fields in `src/shared/schemas/*` or `src/shared/contracts/*`.
- Do **not** add a shadcn/pattern file. A1 screens compose F3 files listed in each task’s **Pattern**.
- Do **not** import `@/server/*` from any `'use client'` file. Server `page.tsx` files **may** import `isGoogleAuthEnabled` from `src/server/auth/config.ts` and pass `googleEnabled: boolean` as a prop.
- Do **not** call `call()` or `fetch` from a screen. Use F1 hooks. Auth.js `signIn` / `signOut` / `useSession` from `next-auth/react` are allowed (they are not `call()`).
- Do **not** import `signIn` / `signOut` from `@/server/auth` in client components.

### 2. Routes (A1 spec wins)

| URL                               | Files                                                          | Guard                        | Shell |
| --------------------------------- | -------------------------------------------------------------- | ---------------------------- | ----- |
| `/sign-up`                        | `src/app/(auth)/sign-up/page.tsx`                              | `requireAnonymous` (layout)  | none  |
| `/sign-in`                        | `src/app/(auth)/sign-in/page.tsx`                              | `requireAnonymous` (layout)  | none  |
| `/onboarding`                     | `src/app/(onboarding)/onboarding/page.tsx`                     | `requireOnboarding` (layout) | none  |
| `/onboarding/create-organization` | `src/app/(onboarding)/onboarding/create-organization/page.tsx` | `requireOnboarding` (layout) | none  |
| `/invite/[token]`                 | `src/app/(invite)/invite/[token]/page.tsx`                     | **none** (public preview)    | none  |

`ARCHITECTURE.md` still says `(onboarding)/accept-invite/[token]/`. **Ignore that path.** Product URL is `/invite/[token]` per the A1 spec. Preview is public (`GET /api/invites/preview/:token`), so the page cannot live under `(onboarding)` (`requireOnboarding` would bounce signed-out users) or `(auth)` (`requireAnonymous` would bounce signed-in users).

B1 currently logs invite links as `/accept-invite/${token}` in `src/server/services/invites/create.ts`. A1.4 updates that log (and its test) to `/invite/${token}` so demo links match the product route. That is a log-string change, not a contract change.

### 3. Layout — stack, centred column, no Sheet

Every A1 screen:

```tsx
<div className="flex min-h-screen items-center justify-center">
  <div className="w-full max-w-md px-4">{children}</div>
</div>
```

- **No** `md:grid`. **No** `Sheet`. **No** `sm:` / `lg:` / `xl:` / `2xl:`.
- Auth actions (password submit + Google): `flex flex-col gap-2` (full width).
- Cost-centre chips / extra actions: `flex flex-wrap gap-2`.
- One breakpoint (`md`) only if a later A1 task truly needs it — default is a single stacked column at both 375px and 768px.

### 4. Existing B1 contracts (copy these fields; do not redeclare)

**`POST /api/auth/sign-up`** — `authContracts.signUp` (`src/shared/contracts/auth.ts`)

- input `signUpInput` (`src/shared/schemas/user.ts`): `{ email: z.email(), password: z.string().min(8).max(128), name: z.string().min(1).max(120) }`
- output `userSchema`: `{ id: string min 1, email: z.email(), name: string min 1 max 120, image?: string min 1, defaultOrgId?: string min 1, createdAt: iso datetime }` — **never** `passwordHash`

**Auth.js credentials sign-in** — no contract. Mirrors `credentialsSchema` in `src/server/auth/config.ts`: `{ email: z.email(), password: z.string().min(1) }`. Client schema adds `.max(128)` on password. Provider id: `'credentials'`.

**Google** — Auth.js provider id `'google'`. Registered only when `AUTH_GOOGLE_ID` **and** `AUTH_GOOGLE_SECRET` are set (`isGoogleAuthEnabled()`). `allowDangerousEmailAccountLinking: true` — a Google sign-in for an email that already has a password account **links and succeeds**. Do not show an error for that case.

**`GET /api/onboarding/status`** — `authContracts.onboardingStatus`

- input `z.void()`
- output `onboardingStatusSchema`: `{ onboarded: boolean, pendingInvites: Array<{ orgName: string min 1, invitedByName: string min 1, orgRole: 'OWNER' \| 'ADMIN' \| 'MEMBER', expiresAt: iso datetime }> }`
- **No token. No invite id.** See policy §8.

**`POST /api/organizations`** — `organizationContracts.create` (`src/shared/contracts/organization.ts`)

- input `createOrganizationInput` (`src/shared/schemas/organization.ts`): `{ name: string min 1 max 120, slug?: string min 1 max 64 matching /^[a-z0-9]+(?:-[a-z0-9]+)*$/, country: string length 2, baseCurrency: string length 3, costCentres: string[] (each min 1, default []) }`
- output `organizationSchema`: `{ id, name, slug, country length 2, baseCurrency length 3, costCentres: string[], settings: { defaultApprovalPolicy: string \| null, notifications: Record<string, boolean> }, airwallexAccountId: string \| null, createdAt }`
- Form **omits** `slug` (server derives). Do not tighten the Zod schema.

**`GET /api/invites/preview/:token`** — `inviteContracts.preview` (public)

- params `{ token: string }`
- output `invitePreviewSchema`: `{ orgName: string min 1, invitedByName: string min 1, orgRole: 'OWNER' \| 'ADMIN' \| 'MEMBER', expiresAt: iso datetime }`
- Non-pending (revoked / accepted / unknown) → `404 NOT_FOUND`. Expired-by-time but still `PENDING` still previews; accept then returns `INVITE_EXPIRED`.

**`POST /api/invites/accept`** — `inviteContracts.accept` (authenticated, `requireOnboarded: false`)

- input `{ token: string min 1 }`
- output `membershipSchema`: `{ id, orgId, userId, orgRole: 'OWNER' \| 'ADMIN' \| 'MEMBER', status: 'ACTIVE' \| 'SUSPENDED' \| 'REMOVED', joinedAt: iso datetime }`
- Email mismatch → `403 PERMISSION_DENIED` with message `Invite email does not match signed-in user` (`AppError.inviteEmailMismatch`). Does **not** consume the invite.
- Expired → `INVITE_EXPIRED` (409). Revoked → `INVITE_REVOKED` (409). Already accepted → `INVITE_ALREADY_ACCEPTED` (409). Unknown → `NOT_FOUND` (404).

**`POST /api/auth/sign-up` duplicate email** → `409 CONFLICT`, message exactly `Unable to complete sign-up` (must not confirm account existence).

### 5. Query params and allowlists

Reuse `isSafeReturnPath` / `buildSignInHref` from `src/client/api/errorBehaviour.ts`. Do not reimplement open-redirect checks.

| Param      | Meaning                                        | Validation                                                                                         |
| ---------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| `returnTo` | post-sign-in path                              | `isSafeReturnPath`: starts with `/`, does not start with `//`                                      |
| `invite`   | raw invite token surviving the auth round trip | `isInviteToken`: `/^[A-Za-z0-9_-]{16,128}$/` (B1 tokens are 32-byte base64url, typically 43 chars) |

**Invite wins over `returnTo`.** If both present, post-auth dest is `/invite/${token}`.

`callbackUrl` passed to Auth.js `signIn` / `signOut` must be the output of `resolvePostAuthHref` / `buildAuthHref` — never a raw search param.

### 6. Locked copy (do not paraphrase)

| Situation                                   | Surface                       | Copy                                                                                              |
| ------------------------------------------- | ----------------------------- | ------------------------------------------------------------------------------------------------- |
| Sign-up `CONFLICT`                          | `Alert` variant `default`     | `Unable to complete sign-up`                                                                      |
| Credentials `signIn` failure                | `Alert` variant `destructive` | `Email or password is incorrect`                                                                  |
| Google `signIn` failure                     | `Alert` variant `destructive` | `Unable to sign in with Google`                                                                   |
| Google + existing password account          | none                          | accounts link; treat as success                                                                   |
| Preview `NOT_FOUND`                         | `ErrorState` (no Retry)       | `This invite is not available.`                                                                   |
| Accept `INVITE_EXPIRED`                     | `Alert` variant `warning`     | `This invite has expired. Ask the organisation owner to send a new one.`                          |
| Accept `INVITE_REVOKED`                     | `Alert` variant `warning`     | `This invite was revoked.`                                                                        |
| Accept `INVITE_ALREADY_ACCEPTED`            | `Alert` variant `info`        | `This invite has already been accepted.`                                                          |
| Accept `PERMISSION_DENIED` (email mismatch) | `Alert` variant `destructive` | `This invite was sent to a different email address. Sign in as the invited account to accept it.` |
| Accept `NOT_FOUND`                          | `Alert` variant `warning`     | `This invite is not available.`                                                                   |
| Sign-up `RATE_LIMITED`                      | `ErrorState` with Retry       | server `message`                                                                                  |

Do **not** use F0.5’s generic `toast` mapping for invite codes on the invite page — render the Alert copy above so each mode is distinguishable on-screen. Do **not** treat accept `PERMISSION_DENIED` as a `PermissionGate` (there is no project permission here).

### 7. Session refresh after org create / invite accept

JWT `onboarded` is cached (`src/server/auth/config.ts` jwt callback). After `useCreateOrganization` or `useAcceptInvite` succeeds, the client **must** `await update()` from `useSession()` (`next-auth/react`) **before** `router.push('/dashboard')`. Otherwise `requireApp` still sees `onboarded: false` and bounces back to `/onboarding`.

Also `invalidateFor` already runs on those mutations (F1). Still call `update()`.

### 8. Spec gap — fork cannot accept without a token (do not invent an endpoint)

`pendingInvites` are `invitePreview[]`: **no `id`, no `token`**. B1 stores only `tokenHash`, so onboarding status cannot return a raw token.

**Locked behaviour (confirmed 2026-08-15):** Accept happens only on `/invite/[token]`. Token survival (`?invite=`) is the accept path for a signed-out invite link. The `/onboarding` fork **lists** pending invites (org name, inviter, role, expiry) so the user understands they have been invited; it does **not** call `useAcceptInvite`. Primary CTA when invites exist: copy that they should open the invite link sent to their email, plus a text link to create an organisation instead. Primary CTA when none: create an organisation.

Do **not** add `POST /api/invites/accept-mine` or put tokens on `onboardingStatus`. One-click accept from the fork is a later B1 contract change if the `pending@allocard.local` demo (sign-up without the link) feels broken — not A1.

### 9. Passwords never appear in logs or error reports

- Password inputs: `type="password"`, `autoComplete="new-password"` (sign-up) / `"current-password"` (sign-in).
- Never `console.log` form values. Never pass `password` to `toastStore`. Never put the password in a URL, Alert, or `ErrorState` message.
- `signIn('credentials', { email, password, redirect: false })` is the only allowed transmission.

### 10. Geo combobox allowlist (UX only)

`src/shared/constants/geo.ts` — Combobox options for create-org. Do **not** change `createOrganizationInput` (still `country` length 2, `baseCurrency` length 3).

**Countries** (ISO 3166-1 alpha-2), exact set: `AU`, `CA`, `DE`, `FR`, `GB`, `HK`, `IE`, `JP`, `NL`, `NZ`, `SG`, `US`.

**Currencies** (ISO 4217), exact set: `AUD`, `CAD`, `EUR`, `GBP`, `HKD`, `JPY`, `NZD`, `SGD`, `USD`.

Labels: `countryName(code)` from `src/lib/format/country.ts`. Currency labels via `Intl.DisplayNames(..., { type: 'currency' })` in `geo.ts` (`currencyLabel(code)`); invalid → raw code.

### 11. Testing

- Prefer **pure helpers** in `src/client/lib/auth.ts` tested with vitest **node** (`src/client/lib/auth.test.ts`). Same spirit as `decideRequirePermission` / F3 layout helpers.
- Do **not** add `@testing-library/react`.
- Screen Accept always includes: `pnpm verify`, plus a **375px and 768px** don’t-break check: no page-level horizontal scrollbar; primary actions reachable; no overlapping chrome (`docs/RESPONSIVENESS.md`).

### 12. ESLint

Extend the `no-restricted-syntax` `fetch` ban **and** the `call()` import ban (copy the block on `src/app/(app)/**` in `eslint.config.mjs`) onto:

- `src/app/(auth)/**/*.{ts,tsx}`
- `src/app/(onboarding)/**/*.{ts,tsx}`
- `src/app/(invite)/**/*.{ts,tsx}`

Server `page.tsx` files still may import `@/server/auth/config`. Do not add a `@/server` ban on those route groups.

---

## Contracts first

- [x] **A1.0** — Auth helpers + geo constants (STOP for review)
  - **Files:**
    - `src/shared/constants/geo.ts`
    - `src/shared/constants/geo.test.ts`
    - `src/client/lib/auth.ts`
    - `src/client/lib/auth.test.ts`
    - re-export auth helpers from `src/client/lib/index.ts` (add `export * from '@/client/lib/auth'` — do not create a circular import; if `auth.ts` imported `index.ts`, skip the barrel and import `@/client/lib/auth` directly from screens)
  - **Do:** Implement the locked helper API below. No React, no screens, no `AppShell`.
    1. `ORG_COUNTRIES: readonly ['AU','CA','DE','FR','GB','HK','IE','JP','NL','NZ','SG','US']`
    2. `ORG_CURRENCIES: readonly ['AUD','CAD','EUR','GBP','HKD','JPY','NZD','SGD','USD']`
    3. `currencyLabel(code: string, locale?: string): string` — `Intl.DisplayNames([locale ?? 'en'], { type: 'currency' }).of(code.toUpperCase())`; length !== 3 or throw/missing → return the raw code.
    4. `countryOptions(): { value: string; label: string }[]` — map `ORG_COUNTRIES` through `countryName` from `src/lib/format/country.ts`.
    5. `currencyOptions(): { value: string; label: string }[]` — map `ORG_CURRENCIES` through `currencyLabel`.
    6. `isInviteToken(value: string): boolean` — `^[A-Za-z0-9_-]{16,128}$`
    7. `invitePath(token: string): string` — if `!isInviteToken(token)` throw; else `/invite/${token}` (token is base64url; do not `encodeURIComponent` in a way that changes `_` / `-`).
    8. `parseAuthSearchParams(input: { invite?: string \| string[] \| undefined; returnTo?: string \| string[] \| undefined }): { inviteToken: string \| null; returnTo: string \| null }` — if array, use `[0]`. `inviteToken` only when `isInviteToken`. `returnTo` only when `isSafeReturnPath` (import from `src/client/api/errorBehaviour.ts`).
    9. `buildAuthHref(which: 'sign-in' \| 'sign-up', opts: { inviteToken?: string \| null; returnTo?: string \| null }): string` — path `/sign-in` or `/sign-up`. If valid invite → `?invite=` + token (no `returnTo`). Else if safe `returnTo` → `?returnTo=` + `encodeURIComponent(returnTo)`. Else bare path.
    10. `resolvePostAuthHref(opts: { inviteToken?: string \| null; returnTo?: string \| null; onboarded: boolean }): string` — valid invite → `invitePath(token)`; else safe `returnTo`; else `onboarded ? '/dashboard' : '/onboarding'`.
    11. `isSafeCallbackUrl(url: string): boolean` — `isSafeReturnPath(url)` AND (url is `/dashboard` OR url is `/onboarding` OR url is `/onboarding/create-organization` OR url matches `^/invite/[A-Za-z0-9_-]{16,128}$` with no `?` / `#`).
    12. `signInFormSchema` = `z.object({ email: z.email(), password: z.string().min(1).max(128) })` — mirrors `credentialsSchema` in `src/server/auth/config.ts`. Comment that in the file header. Do **not** import the server file.
    13. `inviteErrorCopy(code: ErrorCode): { variant: 'warning' \| 'info' \| 'destructive'; message: string } | null` — map `INVITE_EXPIRED` / `INVITE_REVOKED` / `INVITE_ALREADY_ACCEPTED` / `NOT_FOUND` / `PERMISSION_DENIED` to the locked copy + variant in policy §6. Other codes → `null`.
  - **Pattern:** `src/client/api/errorBehaviour.ts` + `src/client/api/errorBehaviour.test.ts` (allowlist + exhaustive maps). Geo file style: `src/shared/constants/currency.ts`. `countryName`: `src/lib/format/country.ts`.
  - **STOP and get this reviewed before A1.1+.** Wrong allowlist or invite-query name after screens land is a rewrite.
  - **Accept:** `pnpm test client/lib/auth` and `pnpm test shared/constants/geo` — cover: unsafe `returnTo` (`//evil.com`, `https://evil.com`, `dashboard`) dropped; invite wins over `returnTo`; invalid invite tokens dropped; `isSafeCallbackUrl` rejects `/invite/../../x` and `/sign-in?returnTo=https://evil.com`; every invite `ErrorCode` in §6 mapped; country/currency sets exact.
  - **Notes:** Helpers in `src/client/lib/auth.ts` (re-exported from `src/client/lib/index.ts`); geo allowlist in `src/shared/constants/geo.ts`. Invite query wins over `returnTo`. STOP — review helper API before A1.1 screens.

---

## Tasks

### A1.1 — Auth chrome (layouts + invite route group)

- [x] **A1.1** — Centred column on auth / onboarding / invite layouts
  - **Files:**
    - `src/app/(auth)/layout.tsx` (edit)
    - `src/app/(onboarding)/layout.tsx` (edit)
    - `src/app/(invite)/layout.tsx` (create)
    - `src/app/(invite)/invite/[token]/page.tsx` (create placeholder only)
    - `eslint.config.mjs` (edit — policy §12)
  - **Do:**
    1. Keep existing guards: `(auth)` → `requireAnonymous()`; `(onboarding)` → `requireOnboarding()`. On failure `redirect(result.redirectTo)` as today.
    2. Wrap `children` in the centred column from policy §3 (`flex min-h-screen items-center justify-center` → inner `w-full max-w-md px-4`). Do not add `AppShell`. Do not add a logo-heavy marketing header.
    3. `(invite)/layout.tsx`: **no guard**. Same centred column. Public preview + signed-in accept share this layout.
    4. Placeholder invite page: `<main>A1: invite</main>` (A1.4 replaces it). Dynamic segment name **`token`**.
    5. ESLint: copy the `call()` + `fetch` bans from the `src/app/(app)/**` block onto `(auth)`, `(onboarding)`, `(invite)` globs. Do not ban `@/server` on those globs (server pages need `isGoogleAuthEnabled`).
  - **Layout:** stack, centred `max-w-md w-full px-4`. No `md:grid`. No `Sheet`.
  - **Pattern:** `src/app/(auth)/layout.tsx` and `src/app/(onboarding)/layout.tsx` (F0.11) for guards; chrome is the snippet in policy §3 / `docs/RESPONSIVENESS.md` “Auth screens (A1)”. ESLint copy: `eslint.config.mjs` `(app)` block (F0.15 / F3.0).
  - **Accept:** `pnpm lint && pnpm typecheck`. 375px and 768px: no page-level horizontal scrollbar on `/sign-in` placeholder (inner column ≤ 448px + `px-4`). Primary actions (when they exist in later tasks) stay inside the column.
  - **Notes:** Centred `max-w-md px-4` on `(auth)` / `(onboarding)` / `(invite)`. Invite group has no guard. `call()` + `fetch` bans copied onto those globs; `@/server` still allowed.

### A1.2 — Sign-up

- [ ] **A1.2** — `/sign-up`
  - **Files:**
    - `src/app/(auth)/sign-up/page.tsx` (server — replace placeholder)
    - `src/app/(auth)/sign-up/SignUpForm.tsx` (`'use client'`)
    - `src/app/(auth)/_components/GoogleButton.tsx` (`'use client'` — shared with sign-in)
  - **Do:**
    1. Server page: read `searchParams` (`invite`, `returnTo`), `parseAuthSearchParams`. Pass `googleEnabled={isGoogleAuthEnabled()}` (from `src/server/auth/config.ts`), `inviteToken`, `returnTo` to `SignUpForm`.
    2. Form: `useZodForm(signUpInput)` from `src/shared/schemas/user.ts` — fields `name` string min 1 max 120, `email` z.email(), `password` string min 8 max 128. `defaultValues: { name: '', email: '', password: '' }`.
    3. Compose F3: `Card` + `CardHeader`/`CardTitle`/`CardDescription` + `CardContent`; `Form` / `FormField` / `FormItem` / `FormLabel` / `FormControl` / `FormMessage`; `Input`; `Button` (`loading={mutation.isPending}`).
    4. Password `type="password"` `autoComplete="new-password"` `name="password"`. Email `type="email"` `autoComplete="email"`. Name `autoComplete="name"`.
    5. Submit: `useSignUp()` from `src/client/hooks/useSession.ts`. On `ApiError` `CONFLICT` → inline `Alert` variant `default` with locked copy (do not say the email exists). `VALIDATION_FAILED` → `applyServerErrorsFromApiError`. `RATE_LIMITED` → `ErrorState` with `code` + `onRetry` that resubmits. Other errors → `Alert` destructive with `error.message` (must not include the password).
    6. On sign-up success: `signIn('credentials', { email, password, redirect: false })` from `next-auth/react`. Then `await update()` from `useSession()`. Then `router.push(resolvePostAuthHref({ inviteToken, returnTo, onboarded: false }))` — new users are never onboarded yet; if `inviteToken` is set this lands on `/invite/${token}`.
    7. `GoogleButton`: if `!googleEnabled`, return `null` (hide, do not render a button that 500s). If enabled: `Button` variant `outline` type `button` label `Continue with Google`. `onClick` → `signIn('google', { callbackUrl })` where `callbackUrl = resolvePostAuthHref({ inviteToken, returnTo, onboarded: false })` and `isSafeCallbackUrl(callbackUrl)` (if not safe, use `/onboarding`). Do not mention account linking in the UI.
    8. Below actions: text link to `buildAuthHref('sign-in', { inviteToken, returnTo })` — “Already have an account? Sign in”.
    9. Action stack: `flex flex-col gap-2` — password submit, then Google (if shown). `Separator` between them optional; if used, copy `src/components/ui/separator.tsx`.
  - **Layout:** stack. Centred column already from layout. Actions `flex-col gap-2`. No `md:grid`. No `Sheet`.
  - **Pattern:** FormField demo in `src/app/dev/ui/sections/primitives.tsx` (`ValidFormFieldDemo`) + `src/components/ui/form.tsx` + `src/client/lib/forms/useZodForm.ts` + `applyServerErrorsFromApiError` in `src/client/lib/forms/applyServerErrors.ts`. Card/Alert/Button/Input/Label: `src/components/ui/{card,alert,button,input,label}.tsx`. Hook: `useSignUp` in `src/client/hooks/useSession.ts`.
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; Sign up and Google (when shown) reachable without sideways scroll. Confirm Google is absent when `AUTH_GOOGLE_ID` unset (local default).
  - **Notes:** _{filled in on completion}_

### A1.3 — Sign-in

- [ ] **A1.3** — `/sign-in` + return path
  - **Files:**
    - `src/app/(auth)/sign-in/page.tsx` (server — replace placeholder)
    - `src/app/(auth)/sign-in/SignInForm.tsx` (`'use client'`)
    - reuse `src/app/(auth)/_components/GoogleButton.tsx` (do not duplicate)
  - **Do:**
    1. Server page: same `parseAuthSearchParams` + `googleEnabled` as sign-up.
    2. Form: `useZodForm(signInFormSchema)` — `{ email: z.email(), password: z.string().min(1).max(128) }`. No `name` field.
    3. Same F3 Card/Form/Input/Button stack as sign-up. Password `type="password"` `autoComplete="current-password"`.
    4. Submit: `signIn('credentials', { email, password, redirect: false })`. On `result?.error` → `Alert` destructive `Email or password is incorrect` (do not confirm which field). On success: `await update()`; read `session.onboarded` from `useSession()` (after update); `router.push(resolvePostAuthHref({ inviteToken, returnTo, onboarded }))`.
    5. Google: same `GoogleButton`; `callbackUrl = resolvePostAuthHref({ inviteToken, returnTo, onboarded: false })` is acceptable for OAuth (server session after Google will send onboarded users through `requireAnonymous` on `/sign-in` if they somehow land there; prefer `callbackUrl` of `resolvePostAuthHref` with `onboarded: false` only when invite is set, else `/onboarding` — Auth.js then hits `(onboarding)` or `(app)` via guards). **Locked:** `callbackUrl` must pass `isSafeCallbackUrl`. If `returnTo` is safe, use it as `callbackUrl` when there is no invite (so `/projects` survives). If invite set, `callbackUrl = invitePath(token)`.
    6. Link to `buildAuthHref('sign-up', { inviteToken, returnTo })`.
    7. `requireAnonymous` already sends onboarded sessions to `/dashboard` and not-onboarded to `/onboarding` — do not duplicate that in the form except after a fresh credentials sign-in.
  - **Layout:** stack. Actions `flex-col gap-2`. No `md:grid`. No `Sheet`.
  - **Pattern:** Copy `src/app/(auth)/sign-up/SignUpForm.tsx` (A1.2) and drop `name` / `useSignUp`. Return-path rules already in `src/client/lib/auth.ts` + `src/client/api/errorBehaviour.ts`. Google button: A1.2 file.
  - **Accept:** `pnpm verify`. `pnpm test client/lib/auth` still green (returnTo allowlist). 375px and 768px: no page-level horizontal scrollbar; Sign in and Google reachable. Unsafe `?returnTo=//evil.com` must not be passed to `signIn` as `callbackUrl`.
  - **Notes:** _{filled in on completion}_

### A1.4 — Invite preview & accept

- [ ] **A1.4** — `/invite/[token]`
  - **Files:**
    - `src/app/(invite)/invite/[token]/page.tsx` (replace placeholder; thin server wrapper OK)
    - `src/app/(invite)/invite/[token]/InviteAccept.tsx` (`'use client'`)
    - `src/server/services/invites/create.ts` (log path only)
    - `test/api/invites.test.ts` (assert logged `path` is `/invite/${token}`)
  - **Do:**
    1. Client reads `token` from `useParams()`. If `!isInviteToken(token)` render `ErrorState` message `This invite is not available.` (no Retry).
    2. `useInvitePreview(token)` from `src/client/hooks/useOrganizations.ts`. Loading → `LoadingState`. `NOT_FOUND` → `ErrorState` locked copy, no Retry. Retryable codes → `ErrorState` with Retry calling `refetch`.
    3. Success: `Card` showing `orgName`, `invitedByName`, `orgRole` (plain text, not `StatusBadge`), `expiresAt` via `formatDate` from `src/lib/dates.ts` (en-GB).
    4. Session: `useSession()` from `next-auth/react` (status `unauthenticated` | `authenticated`).
       - **Signed out:** do **not** call `useAcceptInvite`. Actions `flex flex-col gap-2`: Button asChild/`<a>` to `buildAuthHref('sign-up', { inviteToken: token })` label `Sign up to accept`; outline Button to `buildAuthHref('sign-in', { inviteToken: token })` label `Sign in`. This is how the token survives the round trip (`?invite=`).
       - **Signed in:** Button `Accept invite` → `useAcceptInvite()` with input `{ token }` (`acceptInviteInput`: `{ token: string min 1 }`). On success: `await update()` then `router.push('/dashboard')`. On `ApiError`: `inviteErrorCopy(error.code)` → `Alert` with that variant + message. For `PERMISSION_DENIED`, also offer Button `Sign in as the invited account` → `signOut({ callbackUrl: buildAuthHref('sign-in', { inviteToken: token }) })` only if `isSafeCallbackUrl` of that href (sign-in href is `/sign-in?invite=…` — **not** in `isSafeCallbackUrl`’s dest list). **Locked:** pass `callbackUrl: buildAuthHref('sign-in', { inviteToken: token })` to `signOut` anyway; `isSafeReturnPath` already wraps the path. Do not invent a new ErrorCode.
    5. Change `console.info('[invite] accept link', { … path })` in `src/server/services/invites/create.ts` from `` `/accept-invite/${token}` `` to `` `/invite/${token}` ``. Update `test/api/invites.test.ts` expectation the same way. Do not change token hashing, email, or the create contract.
  - **Layout:** stack inside the centred column. Preview fields stacked. Actions `flex flex-col gap-2`. No `md:grid`. No `Sheet`.
  - **Pattern:** `ErrorState` `src/components/patterns/ErrorState.tsx` + `shouldShowErrorRetry`. `EmptyState` not required here. `LoadingState` `src/components/patterns/LoadingState.tsx`. Card/Alert/Button: F3 ui files. Hook: `useInvitePreview` / `useAcceptInvite` in `src/client/hooks/useOrganizations.ts`. Date: `src/lib/dates.ts` `formatDate`.
  - **Accept:** `pnpm verify` and `pnpm test api/invites`. 375px and 768px: no page-level horizontal scrollbar; Accept / Sign up / Sign in reachable. Manual: expired vs revoked vs already-accepted vs mismatch each show a **different** Alert message (policy §6).
  - **Notes:** _{filled in on completion}_

### A1.5 — Onboarding fork

- [ ] **A1.5** — `/onboarding`
  - **Files:**
    - `src/app/(onboarding)/onboarding/page.tsx` (replace placeholder)
    - `src/app/(onboarding)/onboarding/OnboardingFork.tsx` (`'use client'`)
  - **Do:**
    1. `useOnboardingStatus()` from `src/client/hooks/useSession.ts`. Loading → `LoadingState`. Retryable error → `ErrorState` with Retry. `onboarded === true` → `router.replace('/dashboard')` (layout already does this via `requireOnboarding`; keep the client redirect as belt-and-suspenders).
    2. `pendingInvites` is `invitePreview[]`: `{ orgName, invitedByName, orgRole, expiresAt }` — **no accept button** (policy §8).
    3. **If `pendingInvites.length > 0`:** lead with a heading `You've been invited`. Stack a `Card` per invite (`orgName` title; description `{invitedByName} invited you as {orgRole}`; `Expires {formatDate(expiresAt)}`). Then `Alert` variant `info`: `Open the invite link that was sent to your email to join. Creating an organisation is optional.` Then a secondary `Button` variant `outline` / link to `/onboarding/create-organization` label `Create an organisation instead`.
    4. **If none:** lead with create. `EmptyState` title `Create your organisation` description `You'll be the owner. You can invite people after.` `action: { label: 'Create organisation', onClick }` → `router.push('/onboarding/create-organization')`. Do not show a fake invite list.
    5. Do not call `useAcceptInvite` on this page.
  - **Layout:** stack (`flex flex-col gap-4`). Invite cards stacked, not `md:grid-cols-2`. Secondary create below. No `Sheet`.
  - **Pattern:** `EmptyState` `src/components/patterns/EmptyState.tsx`. Card/Alert/Button: F3. Hook: `useOnboardingStatus` in `src/client/hooks/useSession.ts`. `formatDate` `src/lib/dates.ts`.
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; create CTA reachable. Hitting `/onboarding` while onboarded still ends on `/dashboard` (layout test already in `src/app/_lib/guards.test.ts` — do not weaken it).
  - **Notes:** _{filled in on completion}_

### A1.6 — Create organisation

- [ ] **A1.6** — `/onboarding/create-organization`
  - **Files:**
    - `src/app/(onboarding)/onboarding/create-organization/page.tsx` (create)
    - `src/app/(onboarding)/onboarding/create-organization/CreateOrganizationForm.tsx` (`'use client'`)
  - **Do:**
    1. Form: `useZodForm(createOrganizationInput)` from `src/shared/schemas/organization.ts`. `defaultValues: { name: '', country: '', baseCurrency: '', costCentres: [] }`. **Do not** include `slug` (optional on the wire; server derives from name).
    2. Fields:
       - `name`: `Input` — string min 1 max 120
       - `country`: `Combobox` — `options={countryOptions()}` from `src/shared/constants/geo.ts`, `value={field.value || null}`, `onChange={(v) => field.onChange(v ?? '')}`. Stored value ISO2 length 2.
       - `baseCurrency`: `Combobox` — `options={currencyOptions()}`, same null↔`''` mapping. Stored value ISO4217 length 3.
       - `costCentres`: `string[]` each min 1. UI: `Input` + `Button` type `button` label `Add` appends `trim()` if length ≥ 1; list `flex flex-wrap gap-2` with a remove `Button` size `sm` variant `outline` per item (`aria-label={`Remove ${centre}`}`). Empty array is valid.
    3. Submit `Button` `loading={isPending}` disabled when `!form.formState.isValid`. `useCreateOrganization()` from `src/client/hooks/useOrganizations.ts` with the form values (`costCentres` default `[]`).
    4. `VALIDATION_FAILED` → `applyServerErrorsFromApiError`. `CONFLICT` (slug taken — rare without explicit slug) → `Alert` destructive with `error.message`. Other → `Alert` destructive `error.message`.
    5. Success: `await update()` from `useSession()` **then** `router.push('/dashboard')` (policy §7).
    6. Back link to `/onboarding`.
  - **Layout:** stack `flex flex-col gap-4`. Comboboxes full width of the `max-w-md` column (`Combobox` already `w-full` trigger). Chips `flex flex-wrap gap-2`. No `md:grid`. No `Sheet`. Money is not collected here (base currency is a code, not an amount) — do not use `type="number"`.
  - **Pattern:** FormField demo `src/app/dev/ui/sections/primitives.tsx`. Combobox `src/components/ui/combobox.tsx` (`ComboboxOption`: `{ value: string, label: string }`). `createOrganizationInput` `src/shared/schemas/organization.ts`. Hook `useCreateOrganization` `src/client/hooks/useOrganizations.ts`. Geo `src/shared/constants/geo.ts`.
  - **Accept:** `pnpm verify`. 375px and 768px: no page-level horizontal scrollbar; Create / Add cost centre reachable; Combobox popover not required to look good, but the trigger must be visible without sideways scroll.
  - **Notes:** _{filled in on completion}_

### A1.7 — Gate + password proofs

- [ ] **A1.7** — Onboarding gate is unavoidable; passwords stay off the wire in UI code
  - **Files:**
    - `src/app/_lib/guards.test.ts` (extend if any case is missing — do not weaken)
    - `src/client/lib/auth.test.ts` (extend)
    - `src/app/(app)/layout.tsx` — **read only**; do not add AppShell collapse
  - **Do:**
    1. Confirm (tests already in `guards.test.ts`, add only if missing):
       - anonymous + `requireApp` → `/sign-in` (safe `returnTo` preserved)
       - authenticated not onboarded + `requireApp` → `/onboarding`
       - authenticated onboarded + `requireAnonymous` → `/dashboard`
       - authenticated not onboarded + `requireAnonymous` → `/onboarding`
       - authenticated onboarded + `requireOnboarding` → `/dashboard`
    2. Assert `isSafeCallbackUrl` rejects `javascript:…`, `//evil.com`, `/invite/foo/../../../sign-in`.
    3. Grep-proof in `auth.test.ts` or a tiny comment test: `inviteErrorCopy` messages and `CONFLICT` copy do not contain `password`. Do not add a runtime log interceptor.
    4. Confirm `(app)/layout.tsx` still uses `requireApp()` — that is the unavoidable gate into the product. Do not change `AppShell` props or collapse behaviour.
  - **Layout:** n/a (proof task).
  - **Pattern:** `src/app/_lib/guards.test.ts` (F0.10). `src/client/api/errorBehaviour.test.ts` open-redirect cases.
  - **Accept:** `pnpm test app/_lib/guards` and `pnpm test client/lib/auth` and `pnpm verify`.
  - **Notes:** _{filled in on completion}_

---

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Spec’s review checklist in `A1-auth-onboarding.md` signed off:
  - [ ] The onboarding gate is unavoidable — no route reaches the app without an organisation
  - [ ] Invite tokens survive the sign-up round trip (`?invite=` → `/invite/[token]`)
  - [ ] Every invite failure mode has a distinct, human message (accept-time codes + preview `NOT_FOUND`)
  - [ ] Password fields never appear in any log or error report
  - [ ] Return paths are validated against an allowlist, not reflected blindly
  - [ ] 375px and 768px: no page-level horizontal scrollbar; sign-in and Google actions reachable without sideways scroll
- [ ] No `AppShell` on `(auth)` / `(onboarding)` / `(invite)`
- [ ] Google button hidden when `AUTH_GOOGLE_ID` unset
- [ ] `src/client/shell/AppShell.tsx` unchanged (collapse is A2)
- [ ] Spec’s review checklist signed off in `A1-auth-onboarding.md`
- [ ] `STATUS.md` updated with the next phase (**A2** — first task = AppShell collapse)

## Out of scope (do not do in A1)

- `AppShell` sidebar → `Sheet` (A2)
- Dashboard, projects, wizard (A2)
- Inviting members from the org (A3)
- Changing B1 preview to return distinct expired/revoked codes (preview stays 404)
- A new accept-by-id / accept-from-fork endpoint (policy §8)
- Email sending (B1 still logs the link)
- New F3 primitives or a second form library
- Tightening `createOrganizationInput` country/currency enums on the wire
