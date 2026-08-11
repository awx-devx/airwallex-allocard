# Status

Single source of truth for _where the build is_. Update at the end of every task.

**Active phase:** B8 — Webhooks, transactions & remote authorization
**Active task:** B8.1 — WebhookEvent + Transaction models
**Last green `pnpm verify`:** 2026-08-11 (B8.0)
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
| B     | B8 Money in motion      | **in progress** | 1 / 11  |
| B     | B9 Reporting & closure  | not started     | —       |
| F     | F0 Client foundation    | not started     | —       |
| F     | F1 Data layer           | not started     | —       |
| F     | F2 Utils                | not started     | —       |
| F     | F3 UI library           | not started     | —       |
| A     | A1–A9 Application       | not started     | —       |

Task files are generated at the start of each phase. B0–B8 exist — generate the next phase's `-TASKS.md` from its spec when you reach it.

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

B8.0 contracts reviewed and locked. Active: **B8.1** — WebhookEvent + Transaction models.

B8.0 locked policies (do not reopen):

1. `WebhookEventStatus` = `RECEIVED | PROCESSED | FAILED`
2. `TransactionType` = core trio + ledger subtypes (`PARTIAL_CLEARING`, `EXPIRED_AUTHORIZATION`, `CLEARING_REVERSAL`, …)
3. `TransactionStatus` = card-transaction lifecycle (`AUTHORIZED | VERIFIED | CLEARED | REVERSED | EXPIRED | DECLINED`)
4. `lifecycleId` required on Transaction
5. Money boundary: remote-auth wire = Airwallex major floats; domain = minor ints — convert at boundary
6. Fail-open: env config; `status_reason: policy_snapshot_unavailable`
7. `transactionDetail.lifecycleEvents`; receipt upload `{ fileName, contentType, contentBase64 }`; simulator minor-unit input → same decide path

Read `docs/AIRWALLEX-INTEGRATION.md` and `docs/ARCHITECTURE.md` §5/§8/§10 before B8.1.

B7 locked policies (do not reopen):

1. Status includes both CANCELLED (user) and EXPIRED (system)
2. Create → DRAFT only; submit runs policy
3. ApproverSelection discriminator shape for selection + escalateTo
4. Ledger via B4 PURCHASE_REQUEST sourceType; APPROVED→COMMITMENT; REJECTED|CANCELLED|EXPIRED→RELEASE
5. Preview and submit share `runPolicyCheck` → `evaluatePolicy`
6. Self-approval blocked in routing + decide; escalation idempotent via `markEscalated`

B6 exit locked (do not reopen): see prior notes.

B6.0 / B5 locked policies (do not reopen): see prior notes.

Carried forward:

- **`TODO(B7)`:** overview approval counts stub to 0 — clear when overview wires B7 queue count
- **`TODO(B8)`:** transactions Airwallex stubs; `FundingSource.availableBalance` — clear as B8 ships
- **Cancel graph:** `CANCELLED` only from `DRAFT`
- **B2 matrix:** `#5` scope and `#9` idempotency N/A

B3 locked decisions (do not reopen): see prior notes / B3-TASKS.
