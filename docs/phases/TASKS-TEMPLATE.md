# Task File Template

Copy this when starting a phase. Generate the task list from the phase spec, one task per session-sized unit of work.

**The phase spec is immutable; this file is the mutable state.** Never record progress by editing a spec.

---

## Writing tasks for a cheap model

Per `STATUS.md`, B2, B4, B7, B9 and most of Track A run on a cheap model. For those phases:

- **Name every file.** "Create the project model" becomes `src/server/models/Project.ts`.
- **Inline the shapes.** Don't write "a Zod schema for the project" — write the fields, types, and constraints. Field-name drift across sessions is the dominant failure mode.
- **Make acceptance a command.** `pnpm test projects/transition` is checkable; "transitions work correctly" is not.
- **Point at the file to copy.** "Follow `src/server/models/Project.ts`" beats any description of the pattern. Cheap models pattern-match far better than they design.
- **One task = one commit = one session.** If a task needs more than ~5 files, split it.

For strong-model phases (B0, B1, B6) you can reference the spec section instead of inlining it.

---

## Template

```markdown
# {PHASE} — {Name} · Tasks

**Spec:** [{PHASE}.md](./{PHASE}.md)
**Model:** {strong | mid | cheap}
**Depends on:** {previous phase}, complete and verified

## Contracts first

- [ ] **{P}.0** — Write `src/shared/schemas/{domain}.ts` and `src/shared/contracts/{domain}.ts`
  - Every endpoint in the spec's table gets a contract entry
  - **Stop here and get this reviewed before implementing.** A contract change now costs a rename; after Track A it costs a rename plus a hook plus a screen.
  - Accept: `pnpm typecheck`

## Tasks

- [ ] **{P}.1** — {Short title}
  - **Files:** `path/to/file.ts`, `path/to/other.ts`
  - **Do:** {Concrete instructions. Inline shapes for cheap-model phases.}
  - **Pattern:** {existing file to copy, if any}
  - **Accept:** `pnpm test {pattern}`
  - **Notes:** _{filled in on completion — surprises, deviations, follow-ups}_

## Phase exit

- [ ] All tasks checked and committed
- [ ] `pnpm verify` green
- [ ] Standard endpoint matrix passing for every endpoint
- [ ] Seed script extended
- [ ] Spec's review checklist signed off
- [ ] `STATUS.md` updated with the next phase
```

---

## Task states

| Mark | Meaning |
| --- | --- |
| `- [ ]` | Not started |
| `- [~]` | Started, incomplete — **must** have a note saying what remains |
| `- [x]` | Complete, committed, verify green |
| `- [!]` | Blocked — note names the blocker and what's needed |

A `[~]` or `[!]` without a note is a bug in the process. The note is what makes a lost session recoverable.

## When a task reveals a spec gap

Do not improvise. Add a line under **Decisions pending user review** in `STATUS.md`, mark the task `[!]`, and stop. An invented decision propagates into every later phase before anyone notices.
