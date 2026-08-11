# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** F1 — Data layer (TanStack Query)
**Active task:** Generate F1-TASKS.md when starting F1 (do not invent until asked)
**Last green `pnpm verify`:** 2026-08-12 (F0 phase exit)
**Blocked on:** nothing

---

## Progress

| Track | Phase                   | Status       | Tasks   |
| ----- | ----------------------- | ------------ | ------- |
| B     | B0 Foundation           | **complete** | 13 / 13 |
| B     | B1 Auth & organisations | **complete** | 15 / 15 |
| B     | B2 Projects             | **complete** | 12 / 12 |
| B     | B3 Access control       | **complete** | 14 / 14 |
| B     | B4 Budget               | **complete** | 16 / 16 |
| B     | B5 Cards                | **complete** | 15 / 15 |
| B     | B6 Rules engine         | **complete** | 15 / 15 |
| B     | B7 Requests & approvals | **complete** | 11 / 11 |
| B     | B8 Money in motion      | **complete** | 11 / 11 |
| B     | B9 Reporting & closure  | **complete** | 11 / 11 |
| F     | F0 Client foundation    | **complete** | 17 / 17 |
| F     | F1 Data layer           | not started  | —       |
| F     | F2 Utils                | not started  | —       |
| F     | F3 UI library           | not started  | —       |
| A     | A1–A9 Application       | not started  | —       |

Task files are generated at the start of each phase. `F0-TASKS.md` exists — generate `F1-TASKS.md` from the F1 spec when you reach it. Do **not** invent F1-TASKS unless asked.

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

**F0 complete (2026-08-12).** Next: **F1** data layer — generate `docs/phases/frontend/F1-TASKS.md` from the F1 spec when starting; do **not** invent F1-TASKS until asked.

F0 phase exit: review + exit checklists signed off. Typed `call()`, `ApiError` behaviours, providers, server guards, route groups, shell slots, state conventions, `/dev/shell`, ESLint boundary + no-fetch proofs.

Fetch lint caveat (accepted at exit): `no-restricted-syntax` covers `shell/**`, `states/**`, `(app)/**` — not all of `src/client`; empirically only `src/client/api/client.ts` calls `fetch`.

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
