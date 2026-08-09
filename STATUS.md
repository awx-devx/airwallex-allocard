# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** B5 — Airwallex client, cardholders & cards
**Active task:** B5.0 — Schemas and contracts
**Last green `pnpm verify`:** 2026-08-09 (B4 complete)
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
| B     | B5 Cards                | **in progress** | 0 / 15  |
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

B4 complete. Active: **B5.0** — card/cardholder contracts (STOP for review before implementing).

Read `docs/AIRWALLEX-INTEGRATION.md` before B5.0.

B4 locked policies (do not reopen):

1. Σ(category.allocated) > approvedAmount → `422 VALIDATION_FAILED`
2. `remaining` may be negative; `overCommitted: remaining < 0` — never clamp
3. Public POST entries: no `type` on wire; service forces `ADJUSTMENT`+`MANUAL`
4. GET with no budget → `{ budget: null, projection: zeros }`
5. Category create: if both `allocated` and `formula`, formula wins
6. History mirrors `projectHistoryEntrySchema` (`at`)
7. `lifecycleId` on entries, nullable until B8
8. Default `thresholdPcts`: `[80, 90, 100]`
9. `Project.budgetSnapshot` on public project schema (null until first ledger write)

Carried forward:

- **`TODO(B5)`:** `noActiveCards` guard is a no-op allow on → CLOSING — harden in B5.12
- **`TODO(B5)` / `TODO(B7)`:** overview card/approval counts stub to 0
- **Cancel graph:** `CANCELLED` only from `DRAFT`
- **B2 matrix:** `#5` scope and `#9` idempotency N/A

B3 locked decisions (do not reopen): see prior notes / B3-TASKS.
