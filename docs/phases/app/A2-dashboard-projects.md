# A2 — Dashboard & Projects

**Track:** Application · **Powers:** B2 · **Hooks:** `useProjects`, `useSession`

## Screens

| Route            | Purpose                                                           |
| ---------------- | ----------------------------------------------------------------- |
| `/dashboard`     | Home: active projects, pending approvals, recent activity, alerts |
| `/projects`      | Filterable, sortable project list                                 |
| `/projects/new`  | The multi-step creation wizard                                    |
| `/projects/[id]` | Workspace shell with tabs — shell only; tabs land in A3–A9        |

## The wizard

Nine steps, per the PRD: details → budget → members → roles → card structure → controls → approval rules → review → launch.

Build it on `StepWizard` from F3, saving to a `DRAFT` project after each step via `PATCH`. Steps beyond the first two depend on later backend phases, so build the shell and the first steps now and let A4–A7 fill their own steps in. Note that dependency explicitly in the code rather than leaving stubs that look finished.

The review step must show everything about to be created, especially the cards that will be issued and the limits they'll carry. A user should never press Launch without seeing what it does.

Launch calls `POST /api/projects/:id/transition` with `to: ACTIVE`. That emits `project.launched`, which is what causes cards to appear. Show the resulting activity rather than a bare success toast — this is the first moment the product's premise is visible, and a silent redirect wastes it.

## Notes

The workspace shell owns the tab layout and project context for A3–A9. Get the loading behaviour right here: the project header should render from cached list data while tab content loads, rather than blocking the whole page.

Dashboard cards should link into filtered views rather than being dead summaries.

## Layout

**This phase owns the shell collapse.** `AppShell`'s `w-56` aside is `hidden md:flex`; a `md:hidden` menu button opens F3 `Sheet` (`side="left"`) with the same `SideNav` and `OrgSwitcher`. Do not build a second nav. Do this in the first A2 task that mounts the shell.

- Dashboard summaries: `grid-cols-1 md:grid-cols-2` (or 3). Every card is a link.
- Project list: `DataTable` with `overflow-x-auto` on its root (add it here so A3–A9 inherit).
- Wizard: step rail `flex-wrap`, or a `<select>` of steps below `md`. Step content is one column.
- Workspace tabs (shell for A3–A9): `flex flex-wrap`.

Recipe: [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md). One breakpoint: `md`.

## States to handle

- Zero projects — an empty state that leads into creation
- A wizard abandoned mid-way — resumable from the draft, listed as `DRAFT`
- Insufficient permission to create — the button is gated, with an explanation
- A project in each lifecycle status, with appropriate available actions

## Review checklist

- [ ] The wizard saves per step and is resumable
- [ ] Invalid lifecycle transitions aren't offered in the UI, and are handled if attempted
- [ ] The review step shows the cards and limits that Launch will create
- [ ] Launch surfaces what happened, not just success
- [ ] The shell renders the header from cache while tabs load
- [ ] List filters map to B2's query parameters without client-side refiltering
- [ ] `AppShell` sidebar is a `Sheet` below `md`; same `SideNav`, no second nav
- [ ] 375px and 768px: no page-level horizontal scrollbar; wizard Next/Launch and list actions reachable
