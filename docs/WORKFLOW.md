# Build Workflow

How to actually drive this build. The specs say _what_ to build; this says _how to run the sessions_.

---

## 1. The daily loop

One task, one chat, one commit. That's the whole thing.

```
New chat  →  "Next task."  →  review the diff  →  "Verify and commit."  →  new chat
```

Start a **fresh chat for every task**. `AGENTS.md` loads automatically, the model reads `STATUS.md` to find its place, and it does one task. A long chat spanning six tasks degrades quality on every model and degrades it fastest on the cheap ones you'll use most.

Expect roughly 150–200 tasks across the whole build. Most are a two-minute review. A handful genuinely matter, and section 4 says which.

---

## 2. Phase-by-phase plan

**Tiers:** High = Opus 5 thinking · Medium = Sonnet 5 thinking or GPT-5.6 · Low = Composer 2.5 fast or Grok 4.5 fast

| Phase                        | Tier     | What's different about this phase                                                                                                     |
| ---------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **B0** Foundation            | **High** | Sets every pattern that follows. `models/base.ts`, the test harness, and the three guards are worth real money. Don't economise.      |
| **B1** Auth & orgs           | **High** | The second pattern-setter — B2 onward is "do what B1 did." Also security-critical. Review `meResponse` carefully.                     |
| **B2** Projects              | Low      | Pure CRUD copying B1. The phase that proves whether B1 was a good enough template. If a low model struggles here, B1 needs work.      |
| **B3** Access control        | Med–High | Permission computation is subtle and a mistake is a security hole, not a bug. Use High if the effective-permission merge looks hairy. |
| **B4** Budget                | Low–Med  | Append-only ledger plus derived projections. Pattern is clear; the arithmetic must be exact.                                          |
| **B5** Cards                 | Med      | First external API, plus the PCI boundary. Fixtures keep it honest.                                                                   |
| **B6** Rules engine          | **High** | This _is_ the product. Merge semantics, evaluation order, event fan-out. Budget the most time here.                                   |
| **B7** Requests & approvals  | Low–Med  | State machine over established patterns.                                                                                              |
| **B8** Money in motion       | Med–High | Webhooks, idempotency, ledger mapping. Bugs here mean wrong money, and they're quiet.                                                 |
| **B9** Reporting & closure   | Low      | Read-mostly aggregations and exports.                                                                                                 |
| **F0** Client foundation     | Med      | Sets the client-side patterns the way B0 set the server's.                                                                            |
| **F1** Data layer            | **Low**  | The cheapest phase in the build — hooks derive mechanically from contracts. If it isn't mechanical, a contract is wrong.              |
| **F2** Utils                 | Low      | Pure functions with obvious tests.                                                                                                    |
| **F3** UI library            | Med      | Needs design judgment, and every screen inherits from it. Review the `/dev/ui` page yourself.                                         |
| **A1** Auth & onboarding     | Low–Med  |                                                                                                                                       |
| **A2** Dashboard & projects  | Med      | The creation wizard has real state complexity.                                                                                        |
| **A3** People & access       | Low      |                                                                                                                                       |
| **A4** Budget                | Low–Med  |                                                                                                                                       |
| **A5** Cards                 | Med      | Airwallex iframe integration is fiddly and easy to get subtly wrong.                                                                  |
| **A6** Controls & automation | **High** | The rule builder and simulator are the demo centrepiece. This is what people will actually look at.                                   |
| **A7** Approvals             | Low      |                                                                                                                                       |
| **A8** Activity              | Low      |                                                                                                                                       |
| **A9** Reports & closure     | Low–Med  |                                                                                                                                       |

**Rule of thumb:** upgrade a tier when the phase invents a pattern, involves money correctness, or is a security boundary. Downgrade when it copies an existing file.

---

## 3. The prompt library

### Every task — the workhorse

```
Next task.
```

That's genuinely enough on a High or Medium model, because `AGENTS.md` already defines the loop. For a Low model, spell it out:

```
Read STATUS.md and AGENTS.md. Do ONLY the next unchecked task in the active
phase's TASKS file — not the one after it. Then run pnpm verify, commit with
the task ID in the message, tick the checkbox, and update STATUS.md.
```

### Starting a phase — generate its task file

Run this on a **Medium or High** model even when the phase itself is Low tier. Writing the tasks is harder than doing them.

```
Starting phase B2. Read docs/phases/backend/B2-projects.md and generate
docs/phases/backend/B2-TASKS.md following docs/phases/TASKS-TEMPLATE.md.

Target model tier for execution: LOW. So name every file explicitly, inline
every schema field with its type and constraints, and point each task at the
equivalent B1 file to copy.

For Track A, also read docs/RESPONSIVENESS.md. Each screen task must name
the layout (stack vs md:grid, wrap vs Sheet) and include the 375px / 768px
don't-break check in Accept. A2 must include the AppShell collapse task.

Write the task file only — no implementation code. Then stop; I'll review it.
```

### After the contracts task — the review that saves hours

```
Summarise the contracts you just wrote as a table: endpoint, method, input
fields, output fields. Flag anything you had to invent because the spec
didn't specify it. Change nothing.
```

### Ending a phase

```
All B2 tasks are checked. Run the phase exit checklist in B2-TASKS.md and the
review checklist in B2-projects.md. Report pass or fail per item with
evidence. Fix nothing yet.
```

### When a session is lost or you lose track

```
Fresh session, previous one was lost. Follow "How to recover a lost session"
in STATUS.md. Report the true state and any checkbox that disagrees with git.
Do not start new work.
```

### When it's stuck, looping, or about to cheat

The single most valuable prompt in this file. Use it the moment you see a model editing a test it should be satisfying.

```
Stop. Do not modify the test or weaken the assertion. Explain in plain terms
why it fails, what you think the correct fix is, and what decision you need
from me.
```

### When you spot drift in review

```
The contract says `name` but the handler uses `title`. Fix the handler to
match the contract, never the reverse — then check whether anything else in
this phase drifted the same way.
```

### End of a track — invariant audit

Run on **High**, after B9, after F3, and before the demo.

```
Audit all code from phases B0–B9 against the invariants in AGENTS.md. Report
every violation with file and line. Fix nothing — I want the list first.
```

---

## 4. Where to actually pay attention

You cannot review 200 diffs carefully. Four moments carry most of the risk:

1. **The contracts task at each phase start.** Five minutes. Every field name you approve here gets baked into a model, a handler, a test, a hook, and a screen. Fixing it now is a rename; fixing it in Track A is five files across three phases.
2. **Any time the model says it's blocked.** `AGENTS.md` tells it to stop rather than guess. When it does, that's the system working — answer properly rather than saying "just pick one."
3. **Phase exit.** Run the exit checklist before moving on. A phase that leaks into the next one is how a two-week build becomes a five-week one.
4. **B0.2, B0.5, B0.11 — the three guards.** Each has an acceptance criterion requiring you to prove a _failure_: a bad import must fail lint, `tenantScoped` must throw, a real network call must fail the test run. Actually watch those fail. They're what catches cheap-model mistakes for the remaining 190 tasks.
5. **A2 shell collapse.** First product use of `AppShell`. Confirm the aside is `hidden md:flex` and the same `SideNav` opens in F3's `Sheet` below `md`. After that, every A-phase is copy-the-four-patterns from `docs/RESPONSIVENESS.md`.

Everything else can be a quick skim of the diff plus a green `pnpm verify`.

---

## 5. Habits that keep this cheap

**Never accept a red test.** If `pnpm verify` isn't green, the task isn't done, regardless of what the checkbox says or how confident the summary sounds.

**Never let a model weaken a test to pass.** This is the one failure mode that silently destroys the value of the whole test suite. `AGENTS.md` forbids it; watch for it anyway, especially on cheap models.

**Trust order is tests > git > checkboxes.** A checkbox records what the model believed. A commit records what changed. A passing test records what works.

**If a Low-tier phase keeps going wrong, the task file is the problem, not the model.** Regenerate it with more explicit shapes and a clearer file to copy, rather than upgrading the model and paying for every remaining task.

**Re-read `STATUS.md` yourself once a day.** It's the only place that knows the whole picture, and it's cheap to keep accurate.
