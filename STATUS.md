# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** B3 — Access control
**Active task:** B3.12 — Events + audit coverage (await go-ahead)
**Last green `pnpm verify`:** 2026-08-09 (B3.11)
**Blocked on:** user confirmation before starting B3.12

---

## Progress

| Track | Phase                   | Status          | Tasks   |
| ----- | ----------------------- | --------------- | ------- |
| B     | B0 Foundation           | **complete**    | 13 / 13 |
| B     | B1 Auth & organisations | **complete**    | 15 / 15 |
| B     | B2 Projects             | **complete**    | 12 / 12 |
| B     | B3 Access control       | **in progress** | 12 / 14 |
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

Task files are generated at the start of each phase. B0–B3 exist — generate the next phase's `-TASKS.md` from its spec when you reach it.

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

B2 phase exit complete. Generated `docs/phases/backend/B3-TASKS.md`.

Carried forward:

- **`TODO(B4)`:** `projectReadyForApproval.hasBudget` is a soft stub — harden when budget exists
- **`TODO(B4)`:** overview `budgetRemaining` / `budgetSpent` stay null until B4
- **`TODO(B4)`:** workstream delete does not yet check budget-category references
- **`TODO(B5)` / `TODO(B7)`:** overview card/approval counts stub to 0 (memberCount lands with B3)
- **`TODO(B5)`:** `noActiveCards` guard is a no-op allow on → CLOSING
- **Cancel graph:** `CANCELLED` only from `DRAFT` (spec `└`); not from `PENDING_APPROVAL`
- **PATCH editability:** non-terminal statuses allow all update fields; tighten per-status later if product requires
- **B2 matrix:** `#5` scope and `#9` idempotency N/A; onboarding `#2` locked in `test/api/b2-matrix-onboarding.test.ts`

B3.11 committed. Do not start B3.12 until the user confirms.
Role template permission lists approved from PRD personas (no CSV in-repo).
`computeEffectivePermissions`: OWNER/ADMIN widen past role + time window; MEMBER empty outside window; `scopeCoversSubject` handles OWN/CARD narrowing.
`requirePermission`: OWNER/ADMIN short-circuit; project subject when present; org-wide via any membership for `project.view|create`, `member.*`, `role.assign`; `org.manage` OWNER/ADMIN only; resource-scoped perms without `projectId` denied.
Transition map: →PENDING_APPROVAL/CANCELLED=`project.edit`, →ACTIVE=`request.approve`, →CLOSING/CLOSED/ARCHIVED=`project.close`.
MEMBER project list filtered to projects granting `project.view`.
Preview uses the same `computeEffectivePermissions` as enforcement (hypothetical org MEMBER).
Access reviews: CONFIRM keeps access; REVOKE soft-removes the project member.
`GET /api/me/permissions`: OWNER/ADMIN → all org projects with full permissions; MEMBER → recomputed active memberships only.

Contract notes locked in B3.0:

- Preview `reasons[]` is structured `{ permission, allowed, message }` (not ARCHITECTURE’s `string[]`)
- `accessReview` is minimal: OPEN/RESOLVED, CONFIRM/REVOKE, subjectType `projectMember` only
- Project-member inputs named `*ProjectMember*` to avoid colliding with org `updateMemberInput`

---

## How to recover a lost session

1. `git log --oneline -20` — the last commit's task ID is the real last-completed task.
2. `pnpm verify` — if red, the last task is incomplete regardless of its checkbox.
3. Compare against the phase's `-TASKS.md`; correct any checkbox that disagrees with git.
4. Resume from the first genuinely incomplete task.

Trust order: **tests > git > checkboxes.**
