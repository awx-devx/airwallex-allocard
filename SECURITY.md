# Security

Allocard is a **demo**, not a production card program. Treat any deployed instance as untrusted: seed passwords are public, and every organisation shares one Airwallex sandbox account.

## Reporting a vulnerability

Do not open a public issue for secrets, authentication bypasses, or tenancy leaks.

Use [GitHub private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability) on this repository, or open an issue that describes the impact without reproduction details.

## Secrets

Never commit `.env`. Copy [`.env.example`](./.env.example) and fill values locally.

If this repository was ever cloned with a real `.env`, or keys were pasted into chat, tickets, or CI, **rotate them** before making the repo public:

- Airwallex demo client id, API key, and webhook secret
- `AUTH_SECRET` and Google OAuth client secret
- MongoDB and Redis URLs that embed credentials
- `ADMIN_JOB_SECRET`

Recorded Airwallex fixtures under `src/server/airwallex/fixtures/recordings/` are synthetic (Visa test PAN `4111111111111111`, fake tokens). They are not live credentials.

## What this demo deliberately does not do

- **No production Airwallex.** Default base URL is `https://api-demo.airwallex.com`. Do not point `AIRWALLEX_BASE_URL` at production.
- **No PAN persistence.** Organisation cards may reveal number, expiry, and CVV from Airwallex `GET .../details` in memory for the reveal UI. Those values are never stored, logged, or written to audit. Leftover individual cards still render only in Airwallex-hosted iframes.
- **Application-level tenancy.** All Allocard organisations share one sandbox Issuing account. Isolation is `metadata.orgId` on every Airwallex object plus `ctx.orgId` on every read. Connected accounts are the production model; they are out of scope here. See [`docs/AIRWALLEX-INTEGRATION.md`](./docs/AIRWALLEX-INTEGRATION.md) §2.
