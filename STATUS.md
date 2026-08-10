# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** B5 — Airwallex client, cardholders & cards
**Active task:** B5.5 — Controls mapping (domain ↔ authorization_controls)
**Last green `pnpm verify`:** 2026-08-11 (B5.4)
**Blocked on:** nothing

---

## Progress

| Track | Phase                   | Status          | Tasks   |
| ----- | ----------------------- | --------------- | ------- |
| B     | B0 Foundation           | **complete**    | 13 / 13 |
| B     | B1 Auth & organisations | **complete**    | 15 / 15 |
| B     | B2 Projects             | **complete**    | 12 / 12 |
| B     | B3 Access control       | **complete**    | 14 / 14 |
| B     | B4 Budget               | **complete**    | 16 / 16 |
| B     | B5 Cards                | **in progress** | 5 / 15  |
| B     | B6 Rules engine         | not started     | —       |
| B     | B7 Requests & approvals | not started     | —       |
| B     | B8 Money in motion      | not started     | —       |
| B     | B9 Reporting & closure  | not started     | —       |
| F     | F0 Client foundation    | not started     | —       |
| F     | F1 Data layer           | not started     | —       |
| F     | F2 Utils                | not started     | —       |
| F     | F3 UI library           | not started     | —       |
| A     | A1–A9 Application       | not started     | —       |

Task files are generated at the start of each phase. B0–B5 exist — generate the next phase's `-TASKS.md` from its spec when you reach it.

---

## Model assignment

| Phases         | Model      | Why                                                                         |
| -------------- | ---------- | --------------------------------------------------------------------------- |
| B0, B1         | **Strong** | These set the patterns every later phase copies. Get them right.            |
| B2, B4, B7, B9 | Cheap      | Repetitive CRUD following B1's established pattern                          |
| B3, B5, B8     | Mid        | Authorization, external API, and money correctness                          |
| B6             | **Strong** | The rules engine is the product. Non-obvious merge and evaluation semantics |
| F0–F3          | Mid        | Pattern-heavy but decisions are already made                                |
| A1–A9          | Cheap–Mid  | Assembly from existing hooks and components                                 |

---

## Known issues

_None yet._

---

## Decisions pending user review

_None yet._

---

## Notes for the next session

Active: **B5.5** — Controls mapping (domain ↔ authorization_controls).

B5.0 contracts reviewed and locked. Do not reopen:

1. Purpose enum `SHARED | MEMBER | VENDOR | ONE_TIME` (`perMember` ↔ `MEMBER`)
2. Allowlists: domain `null` = unconstrained; wire `[]` → 422; empty intersection = conflict
3. `allowedTransactionCount` immutable; VENDOR/ONE_TIME → SINGLE; SHARED/MEMBER → MULTIPLE
4. Domain amounts = minor units; Airwallex limits = major — convert only in `controls.ts`
5. Never call `GET /issuing/cards/{id}/details`; PAN via pantoken + iframe only
6. `request_id`: `allocard-card-{id}` / `allocard-cardholder-{id}`
7. Cross-org 404; scope miss 403; CLOSED → 409
8. Non-READY cardholder on create → 409 CONFLICT + `details: { retryable: true, cardholderStatus }`

Read `docs/AIRWALLEX-INTEGRATION.md` before Airwallex client work (B5.2+).

B4 locked policies (do not reopen): see prior notes / B4-TASKS.

Carried forward:

- **`TODO(B5)`:** `noActiveCards` guard is a no-op allow on → CLOSING — harden in B5.12
- **`TODO(B5)` / `TODO(B7)`:** overview card/approval counts stub to 0
- **Cancel graph:** `CANCELLED` only from `DRAFT`
- **B2 matrix:** `#5` scope and `#9` idempotency N/A

B3 locked decisions (do not reopen): see prior notes / B3-TASKS.
