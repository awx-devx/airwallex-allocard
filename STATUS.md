# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** F0 — Client foundation
**Active task:** F0.0 reviewed — awaiting approval before F0.1
**Last green `pnpm verify`:** 2026-08-12 (F0.0: typecheck + `http/errors`)
**Blocked on:** F0.0 contract review (shared error envelope)

---

## Progress

| Track | Phase                   | Status          | Tasks   |
| ----- | ----------------------- | --------------- | ------- |
| B     | B0 Foundation           | **complete**    | 13 / 13 |
| B     | B1 Auth & organisations | **complete**    | 15 / 15 |
| B     | B2 Projects             | **complete**    | 12 / 12 |
| B     | B3 Access control       | **complete**    | 14 / 14 |
| B     | B4 Budget               | **complete**    | 16 / 16 |
| B     | B5 Cards                | **complete**    | 15 / 15 |
| B     | B6 Rules engine         | **complete**    | 15 / 15 |
| B     | B7 Requests & approvals | **complete**    | 11 / 11 |
| B     | B8 Money in motion      | **complete**    | 11 / 11 |
| B     | B9 Reporting & closure  | **complete**    | 11 / 11 |
| F     | F0 Client foundation    | **in progress** | 1 / 17  |
| F     | F1 Data layer           | not started     | —       |
| F     | F2 Utils                | not started     | —       |
| F     | F3 UI library           | not started     | —       |
| A     | A1–A9 Application       | not started     | —       |

Task files are generated at the start of each phase. `F0-TASKS.md` exists. Generate the next phase's `-TASKS.md` from its spec when you reach it.

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

**F0 in progress.** F0.0 (shared `errorEnvelopeSchema`) done — **stop for review** before F0.1.

F0.0 locked shape:

- `errorEnvelopeSchema`: `{ error: { code: ErrorCode, message: string min 1, details?: unknown } }`
- Server still owns status mapping + `AppError` constructors; client will parse the same Zod schema in F0.2+

B9 phase exit (2026-08-12): matrices completed for all B9 endpoints; `card.close` gated by `allowDestructive` (pipeline SKIPPED without flag; apply refuses CLOSED unless `allowDestructiveClose`); review + phase-exit checklists signed off.

B9.0 locked policies (do not reopen):

1. Cursor = opaque `{ at, id }` base64url — never offset on feeds
2. Export `output: z.void()` + streamed `text/csv`
3. Separate `ProjectClosure` collection
4. `CLOSING` only via `/closure/start`
5. Org report single-currency totals; mixed-currency excluded from rollup
6. Preflight fully blocking (`canStart` iff no blockers)
7. Complete needs both confirm literals
8. Access-review HTTP = B3; B9 = sweep only
9. `card.close` from rules requires `params.allowDestructive: true` (else skip; apply belt-and-suspenders)

Carried forward:

- **`TODO(B7)`:** overview approval counts stub to 0 — clear when overview wires B7 queue count
- **`TODO(B8)`:** transactions Airwallex stubs / funding balance — residual stubs OK until live Airwallex
- **Cancel graph:** `CANCELLED` only from `DRAFT`
- **B2 matrix:** `#5` scope and `#9` idempotency N/A
