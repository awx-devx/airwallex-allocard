# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** F2 — Utils (**complete**)
**Active task:** none — F3 starts in a separate session when asked
**Last green `pnpm verify`:** 2026-08-12 (F2 exit)
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
| F     | F1 Data layer           | **complete** | 15 / 15 |
| F     | F2 Utils                | **complete** | 11 / 11 |
| F     | F3 UI library           | not started  | —       |
| A     | A1–A9 Application       | not started  | —       |

F2 fully closed (implementation + review + exit). **F3 is separate** — do not invent `F3-TASKS.md` until an F3 session explicitly starts.

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

**F2 complete (2026-08-12).** Next work is **F3** (UI library) in a **separate session**: generate `docs/phases/frontend/F3-TASKS.md` from `F3-ui-library.md` when starting; do not invent F3-TASKS until asked.

F2 exit: all task checkboxes + `F2-utils.md` review checklist signed off. F3 cutover of active phase deferred by design (F3 taken separately).

F2.0 locked policies (do not reopen) — see `F2-TASKS.md`. Shared currency + scope; `useCan` (not F1 `usePermissions` rename); no `reasons[]` on me/permissions.

F1.0 locked policies (do not reopen):

1. Dual infinite pagination — cursor for activity/audit; page-based for transactions/rule runs; **no** contract migration
2. No browser hooks for webhook, remote-auth decide, attribute ingest
3. Extra endpoint → file table in `F1-TASKS.md` (incl. `useSimulatePurchase` in `useRules.ts`)
4. Spec aliases map to real contracts (`useUpdateCard`, rule CRUD as save-rule invalidation, `useSetBudget` → put, `useSetAttributeValue` → putValue)
5. Extra `qk.*` keys in F1.0; ephemeral mutations in map as `[]`; liberal `cards()` invalidation

F0 phase exit (prior): typed `call()`, `ApiError` behaviours, providers, guards, route groups, shell, states, `/dev/shell`, ESLint boundary + no-fetch proofs. Fetch lint caveat: `no-restricted-syntax` covers `shell/**`, `states/**`, `(app)/**` — empirically `src/client/api/client.ts` + F1 `download.ts` call `fetch`.

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
