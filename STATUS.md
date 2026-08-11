# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** B9 — Activity, audit, reports & closure
**Active task:** B9.10 — Events + audit + seed + budget:verify on closed project
**Last green `pnpm verify`:** 2026-08-12 (B9.9)
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
| B     | B7 Requests & approvals | **complete**    | 11 / 11 |
| B     | B8 Money in motion      | **complete**    | 11 / 11 |
| B     | B9 Reporting & closure  | **in progress** | 10 / 11 |
| F     | F0 Client foundation    | not started     | —       |
| F     | F1 Data layer           | not started     | —       |
| F     | F2 Utils                | not started     | —       |
| F     | F3 UI library           | not started     | —       |
| A     | A1–A9 Application       | not started     | —       |

Task files are generated at the start of each phase. B0–B9 exist — generate the next phase's `-TASKS.md` from its spec when you reach it.

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

B9.9 complete. Active: **B9.10** — events + audit + seed + budget:verify on closed project.

B9.9 notes: `INACTIVE_MEMBER_DAYS=30` — inactive = active `projectMember.updatedAt` older than 30d (no lastLogin). Sweep creates OPEN AccessReview for (1) scopes past `validTo`, (2) inactive members, (3) WOULD_APPLY `flag.review` actions (pipeline now resolves targets; B6 SKIPPED→WOULD_APPLY). Idempotent `(orgId, subjectId, reason)`. Worker `expire-access` → `sweepAccessReviews` (flag only; revoke stays B3 resolve). Audit `accessReview.flagged`.

B9.8 notes: POST `/closure/complete` requires both `confirmCloseCards`+`confirmArchive` literals. Advances SETTLE/REVOKE; CLOSE_CARDS via `closeCard({confirm:true})` only (not rules); CLOSING→CLOSED→ARCHIVED via `transitionProject` (emits `project.closed` / `project.archived` — added `PROJECT_ARCHIVED`). Final report snapshot via `markComplete` (completedAt only when ARCHIVED); GET `/report/final` = `project.view`. Idempotent resume. CLEARING after CLOSED still records. Use `card_fixture_001` when freezing/closing in tests.

B9.7 notes: GET `/closure/status` requires CLOSING + closure doc (409 if not CLOSING, 404 if missing doc/project). Status poll calls `settleClosure`. SETTLE DONE iff zero AUTHORIZED auth-type txs (AUTHORIZATION|INCREMENTAL_AUTHORIZATION); else BLOCKED with `N pending authorization(s)`; DONE advances currentStep → REVOKE. `revokeClosure` expires member `validTo` via `updateProjectMemberForProject`, strips `payment.make` via `rewriteEffectivePermissions` (OWNER/ADMIN widen), marks REVOKE DONE; advances to CLOSE_CARDS only when SETTLE DONE. Does not close cards.

B9.6 notes: Preflight `canStart === (blockers.length === 0)`. ACTIVE_CARD = `CardStatus.ACTIVE`. Start reuses `freezeCard` for non-CLOSED/non-INACTIVE cards; marks PREFLIGHT+FREEZE DONE, currentStep SETTLE. CLOSING only via `/closure/start` (generic `/transition` rejects; ACTIVE→CLOSING removed from `canTransition`). Resume returns status without re-freeze/re-emit.

B9.5 notes: Separate `projectClosures` collection; unique `projectId`. Methods: `upsertStart` (insert-only resume), `findByProject`, `updateStep`, `markComplete`. Cross-org → null.

B9.4 notes: Totals from `projectBudget(entries)`. Category/member actuals join ACTUAL ledger → lifecycleId → tx → card → categoryId / cardholder.userId. Org totals single-currency (`org.baseCurrency`); mixed-currency listed but excluded.

B9.3 notes: Pull-based CSV stream (assert generated===1 after first data chunk); audit on stream complete; `amount_minor`; `REPORT_EXPORT` org-wide via membership.

B9.0 locked policies (do not reopen):

1. Cursor = opaque `{ at, id }` base64url — never offset on feeds
2. Export `output: z.void()` + streamed `text/csv`
3. Separate `ProjectClosure` collection
4. `CLOSING` only via `/closure/start`
5. Org report single-currency totals; mixed-currency excluded from rollup
6. Preflight fully blocking (`canStart` iff no blockers)
7. Complete needs both confirm literals
8. Access-review HTTP = B3; B9 = sweep only

B9 task file: `docs/phases/backend/B9-TASKS.md` (LOW tier).

B8 locked policies (do not reopen): see B8.0 notes in B8-TASKS / prior STATUS notes.

B7 locked policies (do not reopen):

1. Status includes both CANCELLED (user) and EXPIRED (system)
2. Create → DRAFT only; submit runs policy
3. ApproverSelection discriminator shape for selection + escalateTo
4. Ledger via B4 PURCHASE_REQUEST sourceType; APPROVED→COMMITMENT; REJECTED|CANCELLED|EXPIRED→RELEASE
5. Preview and submit share `runPolicyCheck` → `evaluatePolicy`
6. Self-approval blocked in routing + decide; escalation idempotent via `markEscalated`

B6 exit locked (do not reopen): see prior notes.

Carried forward:

- **`TODO(B7)`:** overview approval counts stub to 0 — clear when overview wires B7 queue count
- **`TODO(B8)`:** transactions Airwallex stubs / funding balance — largely cleared as B8 shipped; residual stubs OK until live Airwallex
- **Cancel graph:** `CANCELLED` only from `DRAFT`
- **B2 matrix:** `#5` scope and `#9` idempotency N/A

B3 locked decisions (do not reopen): see prior notes / B3-TASKS.
