# Allocard | Powered by Airwallex

A **demo** of dynamic, attribute-based budget cards on [Airwallex Issuing](https://www.airwallex.com). Card limits are **derived** from business attributes (budget, headcount, approval status, campaign performance) — never typed by a human. Airwallex enforces; Allocard decides.

This is a working product demo, not a production card program. Sensitive card details (PAN, CVV, expiry) never enter application code, logs, or the database; they render only in Airwallex-hosted iframes.

## What it does

- Sign up / sign in (credentials or Google), create or join an organisation
- Launch projects with a budget, members, roles, and a card structure
- Issue, freeze, and close cards through Airwallex; limits and allowlists come from rules
- Re-evaluate controls when attributes change (rules engine + worker)
- Purchase requests, approval queues, activity, transactions, receipts
- Reports, audit log, and project closure

## Stack

| Layer                 | Choice                                                                 |
| --------------------- | ---------------------------------------------------------------------- |
| App                   | Next.js 16 (App Router), React 19, TypeScript                          |
| API & domain          | Route handlers + services; Zod contracts in `src/shared`               |
| Data                  | MongoDB + Mongoose                                                     |
| Queue / cache / locks | Redis (Streams for events; optional locally until you need the worker) |
| Auth                  | Auth.js (credentials + Google)                                         |
| UI                    | Tailwind, Radix, TanStack Query                                        |
| Tests                 | Vitest + `mongodb-memory-server`                                       |
| Issuing               | Airwallex Demo API (`api-demo.airwallex.com`)                          |

Two processes, one codebase: **web** (`pnpm dev` / `next start`) and **worker** (`pnpm dev:worker`).

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
pnpm seed
pnpm dev
```

In a second terminal, for rules, pending cardholders, and Redis-backed events:

```bash
pnpm dev:worker
```

App URL is `AUTH_URL` (default `http://localhost:3000`).

### Environment

Copy [`.env.example`](./.env.example). Required for the web process:

| Variable                                                                 | Role     |
| ------------------------------------------------------------------------ | -------- |
| `MONGODB_URI` / `MONGODB_DB`                                             | Database |
| `AUTH_SECRET` / `AUTH_URL`                                               | Auth.js  |
| `AIRWALLEX_CLIENT_ID` / `AIRWALLEX_API_KEY` / `AIRWALLEX_WEBHOOK_SECRET` | Issuing  |

Useful optionals: `REDIS_URL`, `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`, `AIRWALLEX_ACCOUNT_ID`, `REMOTE_AUTH_MODE` (`simulate` by default), `AIRWALLEX_USE_FIXTURES` (tests default to fixtures).

Do not commit `.env`.

### Seed personas

`pnpm seed` is idempotent. Shared password: `password123`.

| Email                        | Role                                  |
| ---------------------------- | ------------------------------------- |
| `owner@allocard.local`       | Org owner                             |
| `admin@allocard.local`       | Admin                                 |
| `member@allocard.local`      | Member                                |
| `approver@allocard.local`    | Approver (on the active seed project) |
| `spender@allocard.local`     | Spender                               |
| `contractor@allocard.local`  | Contractor                            |
| `procurement@allocard.local` | Procurement                           |

Org: **Acme Demo**. Projects include `SEED-DRAFT`, `SEED-ACTIVE`, `SEED-CLOSING`, `SEED-CLOSED`, `SEED-ARCHIVED`.

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

Invariants (tenancy, integer money, no PAN, contracts first) live in [`AGENTS.md`](./AGENTS.md). Build status is [`STATUS.md`](./STATUS.md).

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

Tracks **B** (API), **F** (client foundation), and **A** (screens) are complete. Specs are under [`docs/phases/`](./docs/phases/).
