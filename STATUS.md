# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** B4 — Budget ledger
**Active task:** B4.7 — Categories CRUD
**Last green `pnpm verify`:** 2026-08-09 (B4.6)
**Blocked on:** nothing

---

## Progress

| Track | Phase                   | Status          | Tasks   |
| ----- | ----------------------- | --------------- | ------- |
| B     | B0 Foundation           | **complete**    | 13 / 13 |
| B     | B1 Auth & organisations | **complete**    | 15 / 15 |
| B     | B2 Projects             | **complete**    | 12 / 12 |
| B     | B3 Access control       | **complete**    | 14 / 14 |
| B     | B4 Budget               | **in progress** | 7 / 16  |
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

Task files are generated at the start of each phase. B0–B4 exist — generate the next phase's `-TASKS.md` from its spec when you reach it.

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

B4.6 GET/PUT budget complete. Next: B4.7 categories CRUD.

B4.0 locked policies (do not reopen):

1. Σ(category.allocated) > approvedAmount → `422 VALIDATION_FAILED`
2. `remaining` may be negative; `overCommitted: remaining < 0` — never clamp
3. Public POST entries: no `type` on wire; service forces `ADJUSTMENT`+`MANUAL`
4. GET with no budget → `{ budget: null, projection: zeros }`
5. Category create: if both `allocated` and `formula`, formula wins
6. History mirrors `projectHistoryEntrySchema` (`at`)
7. `lifecycleId` on entries, nullable until B8
8. Default `thresholdPcts`: `[80, 90, 100]`
9. `Project.budgetSnapshot` on public project schema (null until first ledger write)

Carried forward into B4:

- **`TODO(B4)`:** `projectReadyForApproval.hasBudget` is a soft stub — harden in B4.12
- **`TODO(B4)`:** overview `budgetRemaining` / `budgetSpent` stay null until B4.12
- **`TODO(B4)`:** workstream delete does not yet check budget-category references — B4.12
- **`TODO(B5)` / `TODO(B7)`:** overview card/approval counts stub to 0 (memberCount available via project members)
- **`TODO(B5)`:** `noActiveCards` guard is a no-op allow on → CLOSING
- **Cancel graph:** `CANCELLED` only from `DRAFT` (spec `└`); not from `PENDING_APPROVAL`
- **PATCH editability:** non-terminal statuses allow all update fields; tighten per-status later if product requires
- **B2 matrix:** `#5` scope and `#9` idempotency N/A; onboarding `#2` locked in `test/api/b2-matrix-onboarding.test.ts`

B3 locked decisions (do not reopen):

- Preview `reasons[]` is structured `{ permission, allowed, message }`
- `accessReview` minimal: OPEN/RESOLVED, CONFIRM/REVOKE, subjectType `projectMember`
- Project-member inputs named `*ProjectMember*`
- Transition map: →PENDING_APPROVAL/CANCELLED=`project.edit`, →ACTIVE=`request.approve`, →CLOSING/CLOSED/ARCHIVED=`project.close`
- Org-wide via membership: `project.view|create`, `member.*`, `role.assign`; `org.manage` OWNER/ADMIN only

---

## How to recover a lost session

1. `git log --oneline -20` — the last commit's task ID is the real last-completed task.
2. `pnpm verify` — if red, the last task is incomplete regardless of its checkbox.
3. Compare against the phase's `-TASKS.md`; correct any checkbox that disagrees with git.
4. Resume from the first genuinely incomplete task.

Trust order: **tests > git > checkboxes.**
