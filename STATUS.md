# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** B7 — Purchase requests & approvals
**Active task:** B7.9 — Escalate-approvals worker job
**Last green `pnpm verify`:** 2026-08-11 (B7.8)
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
| B     | B5 Cards                | **complete**    | 15 / 15 |
| B     | B6 Rules engine         | **complete**    | 15 / 15 |
| B     | B7 Requests & approvals | **in progress** | 9 / 11  |
| B     | B8 Money in motion      | not started     | —       |
| B     | B9 Reporting & closure  | not started     | —       |
| F     | F0 Client foundation    | not started     | —       |
| F     | F1 Data layer           | not started     | —       |
| F     | F2 Utils                | not started     | —       |
| F     | F3 UI library           | not started     | —       |
| A     | A1–A9 Application       | not started     | —       |

Task files are generated at the start of each phase. B0–B7 exist — generate the next phase's `-TASKS.md` from its spec when you reach it.

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

Active: **B7.9** — escalate-approvals worker job.

B7.0 locked policies (do not reopen):

1. Status includes both CANCELLED (user) and EXPIRED (system)
2. Create → DRAFT only; submit runs policy
3. ApproverSelection discriminator shape for selection + escalateTo
4. Ledger via existing B4 PURCHASE_REQUEST sourceType; APPROVED→COMMITMENT; REJECTED|CANCELLED|EXPIRED→RELEASE

B6 exit locked (do not reopen):

1. `sweep-rules` calls `sweepScheduledRules` → `evaluateAndApply` with `SCHEDULED_SWEEP`; event-only rules ignored; healthy system records nothing
2. Matrix: `#5` N/A for org-wide `control.edit`; `#9` idempotency N/A; ingest is secret-auth
3. Freeze beats limit by restrictiveness; priority orders explanations only
4. Impossible merge → `PARTIAL`, no Airwallex call

B6.0 locked policies (do not reopen): see prior notes.

B5 locked policies (do not reopen): see prior notes.

Carried forward:

- **`TODO(B7)`:** overview approval counts stub to 0 — clear when B7 ships
- **`TODO(B8)`:** transactions Airwallex stubs; `FundingSource.availableBalance`
- **Cancel graph:** `CANCELLED` only from `DRAFT`
- **B2 matrix:** `#5` scope and `#9` idempotency N/A

B3 locked decisions (do not reopen): see prior notes / B3-TASKS.
