# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** B1 — Auth & organisations
**Active task:** B1.1 — Models (blocked on B1.0 `meResponse` review)
**Last green `pnpm verify`:** 2026-08-08 (B1.0)
**Blocked on:** B1.0 contract review — especially `meResponse`

---

## Progress

| Track | Phase                   | Status          | Tasks   |
| ----- | ----------------------- | --------------- | ------- |
| B     | B0 Foundation           | **complete**    | 13 / 13 |
| B     | B1 Auth & organisations | **in progress** | 1 / 15  |
| B     | B2 Projects             | not started     | —       |
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

Task files are generated at the start of each phase. B0 and B1 exist — generate the next phase's `-TASKS.md` from its spec when you reach it.

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

### B1.0 — `meResponse` and contracts

Written contracts are in `src/shared/contracts/{auth,organization,invite}.ts`. **Do not start B1.1 until reviewed.**

Open questions for review:

1. **`meResponse.memberships`** are raw memberships (`orgId`, no org name/slug). Org switcher in F0 may need a second round trip — enrich memberships, or add `organizations[]`?
2. **`organization.airwallexAccountId`** added beyond the B1.0 field list (nullable D1 seam from the phase model table). Keep on the wire?
3. **`listMembers` output** is bare `membership[]` (no user name/email). Enrich for B1.8 UI, or leave for later?

---

## Notes for the next session

B1.0 schemas/contracts committed. **Waiting on `meResponse` review** before B1.1 Models. After approval: implement User/Organization/Membership/Invite models per B1.1.

---

## How to recover a lost session

1. `git log --oneline -20` — the last commit's task ID is the real last-completed task.
2. `pnpm verify` — if red, the last task is incomplete regardless of its checkbox.
3. Compare against the phase's `-TASKS.md`; correct any checkbox that disagrees with git.
4. Resume from the first genuinely incomplete task.

Trust order: **tests > git > checkboxes.**
