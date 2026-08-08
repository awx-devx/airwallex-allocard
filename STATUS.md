# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** B2 — Projects
**Active task:** B2.1 — Project model
**Last green `pnpm verify`:** 2026-08-09 (B2.0)
**Blocked on:** nothing

---

## Progress

| Track | Phase                   | Status          | Tasks   |
| ----- | ----------------------- | --------------- | ------- |
| B     | B0 Foundation           | **complete**    | 13 / 13 |
| B     | B1 Auth & organisations | **complete**    | 15 / 15 |
| B     | B2 Projects             | **in progress** | 1 / 12  |
| B     | B3 Access control       | not started     | —       |
| B     | B4 Budget               | not started     | —       |
| B     | B5 Cards                | not started     | —       |
| B     | B6 Rules engine         | not started     | —       |
| B     | B7 Requests & approvals | not started     | —       |
| B     | B8 Money in motion      | not started     | —       |
| B     | B9 Reporting & closure  | not started     | —       |
| F     | F0 Client foundation    | not started     | —       |
| F     | F1 Data layer           | not started     | —       |
| F     | F2 Utils                | not started     | —       |
| F     | F3 UI library           | not started     | —       |
| A     | A1–A9 Application       | not started     | —       |

Task files are generated at the start of each phase. B0–B2 exist — generate the next phase's `-TASKS.md` from its spec when you reach it.

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

B2.0 contracts committed and reviewed. Next: B2.1 Project model.

Carried forward:

- **`TODO(B3)`:** `seedRoleTemplates` is a no-op until Role model exists (from B1.7)
- **`TODO(B4)`:** `projectReadyForApproval.hasBudget` is a soft stub — harden when budget exists
- **`TODO(B4)`:** overview `budgetRemaining` / `budgetSpent` stay null until B4
- **`TODO(B3)` / `TODO(B5)` / `TODO(B7)`:** overview member/card/approval counts stub to 0

---

## How to recover a lost session

1. `git log --oneline -20` — the last commit's task ID is the real last-completed task.
2. `pnpm verify` — if red, the last task is incomplete regardless of its checkbox.
3. Compare against the phase's `-TASKS.md`; correct any checkbox that disagrees with git.
4. Resume from the first genuinely incomplete task.

Trust order: **tests > git > checkboxes.**
