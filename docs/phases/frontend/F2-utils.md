# F2 — Utilities & Libraries

**Track:** Client foundation · **Depends on:** F0 · **Powers:** F3, all of Track A

## Goal

Every helper a screen will reach for, built and tested once. The test of this phase is that Track A adds no new utilities — if a screen needs a formatter that doesn't exist here, the gap was in this phase.

## Deliverables

### Money

The backend stores integer minor units; the UI must never do arithmetic on displayed strings.

```ts
formatMoney({ amount: 402350, currency: 'USD' })        // "$4,023.50"
formatMoneyCompact({ amount: 402350, currency: 'USD' }) // "$4.02K"
parseMoneyInput('4,023.50', 'USD')                      // { amount: 402350, ... }
percentOf(spent, total)                                 // integer-safe
```

Locale-aware via `Intl.NumberFormat`. Zero-decimal currencies (JPY, KRW) must be handled — a hardcoded divide-by-100 is wrong for them, and it's the kind of bug that only shows up in a demo with a Japanese vendor.

### Dates

```ts
formatDate(iso)            formatDateTime(iso)
formatRelative(iso)        // "15 minutes ago" — used for observedAt
formatRange(from, to)      // "1 Aug – 31 Dec 2026"
daysRemaining(iso)
isStale(observedAt, ttlSec)
```

Everything takes ISO strings, matching the wire format. `formatRelative` and `isStale` carry real product weight: they're how the UI communicates that an attribute driving a limit is not live.

### Permissions

A client mirror of the server's check, consuming `GET /api/me/permissions`:

```ts
const { can } = usePermissions(projectId)
can('card.create')
can('card.manage', { cardId })   // scope-aware
```

**This is a convenience, never a control.** Hiding a button is UX; the server rejecting the mutation is security. Say so in the file header, because someone will eventually be tempted to lean on it.

Pair it with a `<RequirePermission>` wrapper and a `<PermissionTooltip>` that explains *why* an action is unavailable, using the `reasons[]` from B3.

### Forms

React Hook Form with a Zod resolver pointed at the **shared** input schemas — the same objects the server validates with. Client and server validation cannot disagree, because they are literally the same schema.

```ts
const form = useZodForm(createProjectInput)
```

Plus `applyServerErrors(form, apiError.details)`, mapping a `422` onto fields, and a dirty-state guard for the project wizard.

### Formatting and display

Status badge variants for every enum (project status, card status, request status, rule run status), MCC code → human label, country code → name, merchant name normalisation, card number masking, and truncation with a title attribute.

### Rules helpers

Client-side support for the A6 rule builder: a DSL-to-readable-sentence renderer ("When remaining budget drops below 10%, freeze member cards"), attribute label lookup, operator labels, and a formula syntax highlighter. Validation itself stays server-side via `POST /api/rules/validate` — do not build a second parser in the client.

### Misc

Cursor pagination helpers for infinite queries, CSV download trigger, clipboard with confirmation, debounce and throttle hooks, and a `useDisclosure` for modals.

## Tests

Pure functions, so test them properly:

- Money formatting across locales and zero-decimal currencies; round-tripping `parse → format`
- `percentOf` stays integer-safe and handles a zero denominator
- Date formatting and `isStale` boundary conditions
- `can()` matches the server's decision for the same role and scope fixtures — **reuse B3's fixtures** so the two cannot drift
- `applyServerErrors` maps nested field paths correctly
- The DSL sentence renderer covers every operator and action

## Review checklist

- [ ] No money arithmetic anywhere outside these helpers
- [ ] Zero-decimal currencies handled
- [ ] Form schemas are imported from `shared`, never redefined
- [ ] `can()` is documented as non-authoritative
- [ ] `can()` is tested against the same fixtures as the server's checker
- [ ] No second formula or DSL parser exists in the client
- [ ] Every helper has a test; none are added during Track A

## Out of scope

Components (F3), anything requiring a design decision about a specific screen.
