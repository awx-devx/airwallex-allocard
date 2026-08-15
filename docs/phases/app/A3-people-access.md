# A3 — Project Overview, People & Access

**Track:** Application · **Powers:** B3 · **Hooks:** `useMembers`, `useProjects`

## Screens

| Route                           | Purpose                                                                                   |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `/projects/[id]` (overview tab) | Status, remaining budget, spent, active cards, pending approvals, recent activity, alerts |
| `/projects/[id]/people`         | Member list with role and scope                                                           |
| `/projects/[id]/people/add`     | Add member: select user, role, scope, preview, confirm                                    |
| `/settings/roles`               | Role templates and custom roles, permission matrix editor                                 |
| `/settings/access-reviews`      | Flagged access awaiting review                                                            |

## The permission preview

The centrepiece of this phase. Before confirming a member, the admin sees exactly what that person will be able to do, rendered from `POST /api/projects/:id/members/preview` — the same function that enforces at runtime.

Render `reasons[]`, not just a permission list. "Can view budget — granted by Project Manager role" and "Cannot manage cards — scope limited to workstream Retail" is what makes the access model comprehensible instead of mystifying.

Update the preview live as role or scope changes. It's a cheap call and the immediacy is what teaches the model.

## The permission matrix

A grid of roles against permissions. Dense by nature, so lean on F3's table patterns and make it scannable — sticky headers, grouped permissions, clear inherited-versus-explicit distinction.

Editing a role affects every member holding it. Say so before saving, and show how many members are affected.

## Notes

The overview tab is the most-visited screen in the product. Everything on it links somewhere; nothing is a dead summary.

Scope selection is the hardest control here. Six levels with different sub-selections needs progressive disclosure — pick a level, then only the relevant sub-picker appears. A form showing all six at once is unusable.

## Layout

Permission matrix and member `DataTable`: scroll inside (`overflow-x-auto`), do not restyle as cards. Sticky first column is optional; a sideways table inside the page is the intended narrow behaviour. Add-member form + live preview: `flex-col md:flex-row`. Scope picker already progressive — keep it one column. Tabs wrap (`flex-wrap`). [`../../RESPONSIVENESS.md`](../../RESPONSIVENESS.md).

## States to handle

- A member whose time-bounded scope has expired — shown as inactive with the reason
- A member with no cards yet
- A role in use, being edited — with an affected-member count
- The last admin — removal blocked with an explanation

## Review checklist

- [x] The preview renders `reasons[]` and updates live
- [x] The preview matches actual enforcement — spot-check against a real `403`
- [x] Scope selection uses progressive disclosure
- [x] Role edits warn about affected members
- [x] Every overview element links somewhere useful
- [x] `can()` gates actions, and the server still rejects them if bypassed
- [x] 375px and 768px: no page-level horizontal scrollbar; matrix may scroll internally; Add / Save reachable
