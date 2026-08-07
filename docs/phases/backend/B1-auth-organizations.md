# B1 — Auth, Organisations & Onboarding

**Track:** Backend · **Depends on:** B0 · **Powers:** A1

## Goal

A user can sign up, and can then either create an organisation or accept an invite to one. Until one of those happens they are authenticated but not onboarded, and every org-scoped endpoint refuses them.

## Deliverables

### Models

| Model          | Notes                                                                                                                                                                       |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `User`         | email (unique, lowercased), name, image, `passwordHash?`, `defaultOrgId?`                                                                                                   |
| `Organization` | name, slug (unique), country, baseCurrency, costCentres, settings, `airwallexAccountId?` (null — see [`../../AIRWALLEX-INTEGRATION.md`](../../AIRWALLEX-INTEGRATION.md) §2) |
| `Membership`   | orgId, userId, orgRole, status; unique on `(orgId, userId)`                                                                                                                 |
| `Invite`       | orgId, email, orgRole, `tokenHash`, expiresAt, status, invitedBy                                                                                                            |

### Auth

Auth.js with a Mongoose adapter, credentials provider (argon2) plus **Google** OAuth. Session strategy: JWT, carrying `userId`, `orgId`, `orgRole`, and `onboarded`.

**Why Google, and why credentials as well.** Allocard's users are finance managers, project owners, and procurement leads — Google Workspace accounts, not GitHub ones. Credentials stay because the demo needs seeded personas you can sign in as instantly; you cannot seed real Google accounts for "the finance manager".

Register Google with `allowDangerousEmailAccountLinking` so a user who signed up with a password can later sign in with Google on the same email. The flag is named for the risk that a provider reports an unverified address; Google verifies ownership, which is what makes it acceptable here and would not make it acceptable for every provider. Google credentials are **optional** — with `AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET` unset the provider is not registered and the app runs email/password only, so a fresh clone needs no OAuth setup.

**Onboarding is derived, never stored.** A user is onboarded iff they have at least one `ACTIVE` membership. Compute it in the session callback and cache it on the token; recompute on org creation and invite acceptance. A stored boolean will drift the first time a membership is revoked.

### Org context resolution

A user may belong to several organisations. The active one comes from, in order: an explicit `orgId` in the request, `user.defaultOrgId`, or the sole membership. `withAuth` resolves this and rejects if the user has no membership in the requested org — with `404`, not `403`.

### Invites

- Store only a hash of the token; the raw token exists only in the emailed link.
- Invites expire (7 days default) and are single-use.
- Accepting an invite for an email that doesn't match the signed-in user is a `403` — otherwise a forwarded link grants access to the wrong person.
- A pending invite for an email that later signs up should surface on the onboarding screen, so B1 needs a lookup by email.

## Endpoints

| Method   | Path                                     | Permission                    | Notes                                           |
| -------- | ---------------------------------------- | ----------------------------- | ----------------------------------------------- |
| `POST`   | `/api/auth/sign-up`                      | public                        | Creates a user; does **not** create an org      |
| `*`      | `/api/auth/[...nextauth]`                | public                        | Auth.js handlers                                |
| `GET`    | `/api/me`                                | authenticated                 | User, memberships, active org, `onboarded`      |
| `PATCH`  | `/api/me`                                | authenticated                 | Name, image, `defaultOrgId`                     |
| `POST`   | `/api/organizations`                     | authenticated, not org-scoped | Creates org, makes caller `OWNER`               |
| `GET`    | `/api/organizations/:id`                 | member                        |                                                 |
| `PATCH`  | `/api/organizations/:id`                 | `org.manage`                  | Name, country, currency, cost centres, settings |
| `GET`    | `/api/organizations/:id/members`         | member                        | Org-level membership list                       |
| `PATCH`  | `/api/organizations/:id/members/:userId` | `org.manage`                  | Change org role, suspend                        |
| `DELETE` | `/api/organizations/:id/members/:userId` | `org.manage`                  | Remove from org                                 |
| `POST`   | `/api/invites`                           | `org.manage`                  | Create and send                                 |
| `GET`    | `/api/invites`                           | `org.manage`                  | Pending invites for the org                     |
| `DELETE` | `/api/invites/:id`                       | `org.manage`                  | Revoke                                          |
| `GET`    | `/api/invites/preview/:token`            | public                        | Org name and inviter, for the accept screen     |
| `POST`   | `/api/invites/accept`                    | authenticated                 | Consumes the token, creates the membership      |
| `GET`    | `/api/onboarding/status`                 | authenticated                 | `onboarded`, pending invites for this email     |

## Events

`organization.created`, `member.invited`, `member.joined`, `member.removed`

## Tests

Beyond the standard matrix:

- Sign-up with an existing email fails cleanly, and doesn't reveal whether the account exists
- A brand-new user hitting any org-scoped endpoint gets `403 ONBOARDING_INCOMPLETE`
- Creating an org flips `onboarded` to true on the very next request
- Accepting an invite flips `onboarded` and creates exactly one membership
- Accepting the same invite twice fails the second time
- Accepting an expired or revoked invite fails
- Accepting an invite while signed in as a different email fails with `403`
- Removing the last `OWNER` of an organisation is rejected
- A user in org A requesting org B's record gets `404`
- Password hashes never appear in any response body

## Review checklist

- [ ] No endpoint other than sign-up, the Auth.js routes, and invite preview is reachable unauthenticated
- [ ] The onboarding gate is enforced in `withAuth`, not per-route
- [ ] `onboarded` is derived from memberships, not stored on the user
- [ ] Invite tokens are stored hashed
- [ ] Cross-org reads return `404`
- [ ] Audit entries exist for org creation, invite issue, invite accept, member removal
- [ ] `GET /api/me` returns everything A1 and the app shell will need — this is the endpoint most likely to need a second round trip later

## Out of scope

Project-level roles and permissions (B3 — `org.manage` here is the coarse org role check from B0), email delivery beyond a logged link, SSO.
