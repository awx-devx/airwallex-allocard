# Allocard

**Powered by [Airwallex](https://www.airwallex.com) Issuing.** Dynamic, attribute-based budget cards: limits are **derived** from business attributes (budget, headcount, approval status, campaign performance) — never typed by a human. Airwallex enforces; Allocard decides.

```
attribute changes  →  rules evaluate  →  desired card state  →  reconciler  →  Airwallex
        ▲                                                                          │
        └────────────── webhook (transaction cleared) ◄────────────────────────────┘
```

## Disclaimers

- **Demo, not a card program.** This is a working product demo. It is not certified, PCI-audited, or ready to run real spend. Do not use production Airwallex keys or production cardholder data.
- **Not an official Airwallex product.** Airwallex is a trademark of Airwallex. This repository is an independent demo built on the [Issuing APIs](https://www.airwallex.com/docs/api/issuing/cards/create.md).
- **Sandbox only.** Default API host is `https://api-demo.airwallex.com`. Issuing must be enabled on that demo account.
- **Shared sandbox account.** Every Allocard organisation in a given deployment hits **one** Airwallex demo account. Tenant isolation is Allocard's job (`metadata.orgId` on every card, `orgId` on every read). Connected accounts are the production tenancy model and are out of scope. Details in [`docs/AIRWALLEX-INTEGRATION.md`](./docs/AIRWALLEX-INTEGRATION.md) §2.
- **Seed passwords are public.** `pnpm seed` creates personas that all share `password123`. Change that before exposing a hosted instance.
- **No warranty.** Provided as-is under the [MIT License](./LICENSE).

Sensitive card details: organisation (non-personalized) cards reveal number, expiry, and CVV from Airwallex `GET /issuing/cards/{id}/details` in the app — those values are **never** stored, logged, or written to audit. Leftover individual (personalized) cards still render only inside Airwallex-hosted iframes. See [`SECURITY.md`](./SECURITY.md).

## What it does

- Sign up / sign in (credentials or Google), create or join an organisation
- Launch projects with a budget, members, roles, and a card structure
- Issue, freeze, and close cards through Airwallex; limits and allowlists come from rules
- Re-evaluate controls when attributes change (rules engine + worker)
- Purchase requests, approval queues, activity, transactions, receipts
- Reports, audit log, and project closure

## Architecture

Two processes, one codebase: **web** (`pnpm dev` / `next start`) and **worker** (`pnpm dev:worker`). Neither owns business logic — both call `src/server/services`.

```
┌─────────────────────────────────┐   ┌─────────────────────────────────┐
│  web  (next start)              │   │  worker                         │
│  Auth, app screens, Route       │   │  Redis Stream consumers         │
│  Handlers, webhooks,            │   │  Sweeps (rules, drift,          │
│  remote-auth (<2.5s)            │   │  attributes, transactions)      │
└──────────────┬──────────────────┘   └──────────────┬──────────────────┘
               │                                     │
               └──────────────┬──────────────────────┘
                              │
              ┌───────────────▼────────────────┐
              │  Domain services + contracts   │
              │  (Zod in src/shared)           │
              └───┬───────────────┬────────────┘
                  │               │
             MongoDB            Redis          Airwallex demo Issuing
```

| Layer                 | Choice                                                             |
| --------------------- | ------------------------------------------------------------------ |
| App                   | Next.js 16 (App Router), React 19, TypeScript                      |
| API & domain          | Route handlers + services; Zod contracts in `src/shared`           |
| Data                  | MongoDB + Mongoose                                                 |
| Queue / cache / locks | Redis (Streams for events; optional until you need live issuance)  |
| Auth                  | Auth.js (credentials + Google)                                     |
| UI                    | Tailwind, Radix, TanStack Query                                    |
| Tests                 | Vitest + `mongodb-memory-server` + recorded Airwallex fixtures     |
| Issuing               | Airwallex Demo API (`api-demo.airwallex.com`), pinned `2024-02-22` |

Invariants (tenancy, integer money, no PAN persistence, contracts first) live in [`AGENTS.md`](./AGENTS.md). Full design: [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Happy paths

### 1. Explore the seeded org (fastest)

No Redis and no live card issuance required. You will see budgets, people, rules, sample transactions, and a fixture-backed card on `SEED-ACTIVE`.

```bash
pnpm install
cp .env.example .env
# fill MONGODB_URI, AUTH_SECRET, and Airwallex demo keys (seed still validates env)
pnpm seed
pnpm dev
```

Sign in at `http://localhost:3000` (or `AUTH_URL`):

| Email                        | Role on **Acme Demo**     | What to open                            |
| ---------------------------- | ------------------------- | --------------------------------------- |
| `owner@allocard.local`       | Owner                     | Dashboard, org settings, every project  |
| `admin@allocard.local`       | Admin                     | Same operational surfaces as owner      |
| `approver@allocard.local`    | Approver on `SEED-ACTIVE` | `/approvals` — pending purchase request |
| `spender@allocard.local`     | Spender                   | Assigned card on `SEED-ACTIVE`          |
| `member@allocard.local`      | Member                    | Project list; scoped access             |
| `contractor@allocard.local`  | Contractor                | Narrow project access                   |
| `procurement@allocard.local` | Procurement               | Cards / vendor-oriented views           |

Shared password: `password123`.

Projects: `SEED-DRAFT`, `SEED-ACTIVE`, `SEED-CLOSING`, `SEED-CLOSED`, `SEED-ARCHIVED`.

Walk the product thesis on `SEED-ACTIVE`: **Budget** (approved / remaining is an input, not a report) → **Cards** (limits come from rules, not a form) → **Controls** (open a rule, then **Why this limit?** on a card) → **Requests / Approvals** as the other personas.

### 2. Launch a project and issue live sandbox cards

Needs Redis, the worker, and Issuing enabled on the Airwallex **demo** account. Demo cards are `issue_to: ORGANISATION` (company cards). The PM never types a limit.

1. Set `REDIS_URL` and start Redis.
2. `pnpm dev` and, in a second terminal, `pnpm dev:worker`.
3. Sign in as owner. **New project**: details → budget → card structure → review → **Launch**.
4. Launch moves the project to `ACTIVE` and publishes `project.launched`. The worker evaluates rules, provisions a DELEGATE cardholder if needed, and issues cards.
5. Open the project **Cards** tab. Reveal uses `GET .../details` (organisation cards) and does not persist PAN/CVV/expiry.

If cardholders stay `PENDING`, the worker's `refresh-attributes` sweep retries about every 60s. Webhooks from Airwallex need a public URL (`cloudflared` or `ngrok`); see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) §9.

### 3. Prove the loop: budget moves, cards follow

On an `ACTIVE` project with live cards and the worker running:

1. A cleared transaction (or a budget adjustment) changes `project.budget.remaining`.
2. `budget.updated` re-evaluates rules.
3. Desired controls are patched to Airwallex. Open the card → **Why this limit?** to see the governing rules.

Remote authorization (`/api/remote-auth`) defaults to `REMOTE_AUTH_MODE=simulate`. Live mode is a config flag; do not enable it against production.

### 4. Verify the build

```bash
pnpm verify   # typecheck, lint, tests — tests never hit the network
```

## Prerequisites

- Node.js 20+ and [pnpm](https://pnpm.io) 10
- MongoDB (local or Atlas)
- Redis if you want live issuance, webhooks, and scheduled sweeps
- An Airwallex **demo** Issuing API key (client id, API key, webhook secret)

## Quick start

```bash
pnpm install
cp .env.example .env
# fill MONGODB_URI, AUTH_SECRET, and Airwallex keys
# AUTH_SECRET: openssl rand -base64 32
pnpm seed
pnpm dev
```

In a second terminal, for rules, pending cardholders, and Redis-backed events:

```bash
pnpm dev:worker
```

### Environment

Copy [`.env.example`](./.env.example). **Do not commit `.env`.** Required for the web process:

| Variable                                                                 | Role     |
| ------------------------------------------------------------------------ | -------- |
| `MONGODB_URI` / `MONGODB_DB`                                             | Database |
| `AUTH_SECRET` / `AUTH_URL`                                               | Auth.js  |
| `AIRWALLEX_CLIENT_ID` / `AIRWALLEX_API_KEY` / `AIRWALLEX_WEBHOOK_SECRET` | Issuing  |

Useful optionals: `REDIS_URL`, `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, `AIRWALLEX_ACCOUNT_ID`, `REMOTE_AUTH_MODE` (`simulate` by default), `AIRWALLEX_USE_FIXTURES` (tests default to fixtures; leave unset for live demo issuing), `ADMIN_JOB_SECRET`.

Keep `AIRWALLEX_BASE_URL` on `https://api-demo.airwallex.com`. If keys may have been shared before this repo was public, rotate them — see [`SECURITY.md`](./SECURITY.md).

## Scripts

| Command                         | Purpose                                        |
| ------------------------------- | ---------------------------------------------- |
| `pnpm dev`                      | Next.js dev server                             |
| `pnpm dev:worker`               | Worker with file watch                         |
| `pnpm seed`                     | Demo org, users, projects, rules, sample spend |
| `pnpm verify`                   | Typecheck, lint, tests                         |
| `pnpm test` / `pnpm test:watch` | Vitest                                         |
| `pnpm build` / `pnpm start`     | Production web                                 |
| `pnpm worker`                   | Production worker                              |

## Repo map

```
src/app          Routes and Route Handlers
src/client       Query hooks, screens, API client
src/server       Services, repositories, Airwallex, auth, env
src/shared       Contracts, schemas, enums (no server/client imports)
src/worker       Redis consumers and sweeps
src/components   UI primitives and patterns
docs/            PRD, architecture, rules, Airwallex, phases
```

Build status (session log) is [`STATUS.md`](./STATUS.md). Tracks **B** (API), **F** (client foundation), and **A** (screens) are complete.

## Docs

| Doc                                                                | When                                      |
| ------------------------------------------------------------------ | ----------------------------------------- |
| [`docs/README.md`](./docs/README.md)                               | Doc index and one-paragraph product story |
| [`docs/PRD.md`](./docs/PRD.md)                                     | Intent, personas, journeys                |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)                   | Types, tenancy, worker, testing           |
| [`docs/RULES-ENGINE.md`](./docs/RULES-ENGINE.md)                   | Attributes, DSL, merge                    |
| [`docs/AIRWALLEX-INTEGRATION.md`](./docs/AIRWALLEX-INTEGRATION.md) | Cards, webhooks, remote auth, PCI         |
| [`docs/VISUAL-DIRECTION.md`](./docs/VISUAL-DIRECTION.md)           | Visual language                           |
| [`docs/RESPONSIVENESS.md`](./docs/RESPONSIVENESS.md)               | One breakpoint (`md`)                     |
| [`SECURITY.md`](./SECURITY.md)                                     | Secrets, reporting, demo threat model     |

Phase specs (the original build plan) are under [`docs/phases/`](./docs/phases/).

## License

[MIT](./LICENSE).
