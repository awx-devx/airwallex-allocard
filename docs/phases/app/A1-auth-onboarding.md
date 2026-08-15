# A1 — Auth & Onboarding Screens

**Track:** Application · **Powers:** B1 · **Hooks:** `useSession`, `useOrganizations`

## Screens

| Route                             | Purpose                                                      |
| --------------------------------- | ------------------------------------------------------------ |
| `/sign-up`                        | Email + password, or Google                                  |
| `/sign-in`                        | Same, plus a return-path redirect                            |
| `/onboarding`                     | The fork: create an organisation, or accept a pending invite |
| `/onboarding/create-organization` | Name, country, base currency, cost centres                   |
| `/invite/[token]`                 | Invite preview and acceptance                                |

## Notes

**The onboarding fork is the important screen.** A new user lands here having just signed up, and they need to immediately understand which of two paths applies. Call `GET /api/onboarding/status` on load: if pending invites exist for their email, lead with those and offer organisation creation as secondary. If not, lead with creation.

An invite link opened by a signed-out user should preserve the token through sign-up and land back on acceptance. Losing the token in the auth round trip is the most common way this flow breaks.

An invite whose email doesn't match the signed-in user must explain the mismatch clearly and offer to sign in as the right account — the raw `403` from B1 is correct but useless to a human.

## Layout

No `AppShell`. A centred column: `max-w-md w-full px-4`. Google and password actions `flex-col gap-2`. That is the whole narrow layout — see [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md).

## States to handle

- Sign-up with an existing email — a neutral message that doesn't confirm account existence
- Expired, revoked, or already-accepted invite, each distinguishable
- Google returning an email that already has a password account — the accounts link, by design
- Google not configured (`AUTH_GOOGLE_ID` unset) — hide the button rather than render one that 500s
- A user who is already onboarded hitting `/onboarding` — redirect to the dashboard

## Review checklist

- [x] The onboarding gate is unavoidable — no route reaches the app without an organisation
- [x] Invite tokens survive the sign-up round trip
- [x] Every invite failure mode has a distinct, human message
- [x] Password fields never appear in any log or error report
- [x] Return paths are validated against an allowlist, not reflected blindly
- [x] 375px and 768px: no page-level horizontal scrollbar; sign-in and Google actions reachable without sideways scroll
