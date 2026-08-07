# B3 — Roles, Permissions & Members

**Track:** Backend · **Depends on:** B2 · **Powers:** A3

## Goal

Replace B0's placeholder `requirePermission` with the real thing, and expose the member management and permission-preview APIs. After this phase every mutation in the system is genuinely authorized.

This is the phase most likely to force changes in B1 and B2. Expect it, and budget for the rework.

## Deliverables

### Permission enum

A flat list in `shared/enums/permissions.ts`, derived from the CSV's permission matrix:

```
project.view  project.edit  project.create  project.close
budget.view   budget.edit   budget.request
member.view   member.manage role.assign
card.create   card.view     card.viewDetails  card.manage
payment.make  request.approve  control.edit
transaction.view  report.export
```

### Models

| Model | Notes |
| --- | --- |
| `Role` | orgId, key, name, `isTemplate`, permissions[], `defaultScope?` |
| `ProjectMember` | orgId, projectId, userId, roleId, scope, `effectivePermissions[]`, addedBy, addedAt, `removedAt?` |

Seven role templates seeded per organisation at creation: Finance Administrator, Project Manager, Approver, Project Spender, Procurement Lead, Contractor, Viewer. Templates are per-org copies, not global singletons — otherwise one org editing a template mutates everyone's.

### Access scopes

```ts
type AccessScope = {
  level: 'PROJECT' | 'WORKSTREAM' | 'CATEGORY' | 'CARD' | 'OWN' | 'ASSIGNED_MEMBERS'
  workstreamIds?: string[]; categoryIds?: string[]; cardIds?: string[]; memberIds?: string[]
  validFrom?: Date; validTo?: Date
}
```

### `computeEffectivePermissions`

Pure, exported, and the single authority — the same function backs the preview endpoint and runtime enforcement. If they ever diverge, the preview lies.

```ts
function computeEffectivePermissions(input: {
  orgRole: OrgRole; role: Role; scope: AccessScope; now: Date
}): { permissions: Permission[]; scope: AccessScope; reasons: Reason[] }
```

Composition rules:

- Start from the role's permissions
- A time-bounded scope outside its window yields an empty set
- Scope narrows *which subjects* a permission covers; it never adds permissions
- Org `OWNER`/`ADMIN` widens; a project role never silently narrows the org role
- `reasons[]` explains every grant and denial — this is what the preview screen renders, and what makes a `403` debuggable

Materialise the result onto `ProjectMember.effectivePermissions` on write. Recompute wholesale on any role, scope, or role-definition change; never patch incrementally.

### Real `requirePermission`

```ts
await requirePermission(ctx, 'card.manage', { projectId, cardId })
```

Resolves the caller's `ProjectMember`, checks the permission, then checks the scope against the specific subject. A permission without a subject check is only half an authorization — `card.manage` scoped to card X must not manage card Y.

### Retrofit

Every endpoint from B1 and B2 swaps its placeholder check for a real permission. Do this as an explicit sweep with a checklist, not opportunistically.

## Endpoints

| Method | Path | Permission | Notes |
| --- | --- | --- | --- |
| `GET` | `/api/roles` | `member.view` | Templates plus custom |
| `POST` | `/api/roles` | `role.assign` | Custom role |
| `PATCH` | `/api/roles/:id` | `role.assign` | Rejects edits to templates in use unless forced |
| `DELETE` | `/api/roles/:id` | `role.assign` | Rejected while assigned to anyone |
| `GET` | `/api/projects/:id/members` | `member.view` | Includes role and scope |
| `POST` | `/api/projects/:id/members` | `member.manage` | Add with role and scope |
| `PATCH` | `/api/projects/:id/members/:userId` | `member.manage` | Change role or scope; recomputes |
| `DELETE` | `/api/projects/:id/members/:userId` | `member.manage` | Soft-remove, sets `removedAt` |
| `POST` | `/api/projects/:id/members/preview` | `member.view` | **Effective permissions for a hypothetical role+scope, without saving** |
| `GET` | `/api/projects/:id/access-history` | `member.view` | From audit |
| `GET` | `/api/access-reviews` | `member.manage` | Items flagged for review |
| `POST` | `/api/access-reviews/:id/resolve` | `member.manage` | |
| `GET` | `/api/me/permissions` | authenticated | Effective permissions per project, for the client |

`GET /api/me/permissions` is what F2's client-side `can()` helper consumes so the UI can hide what the user can't do. It is a convenience, never a control.

## Events

`member.added`, `member.role_changed`, `member.scope_changed`, `member.removed`

## Tests

Beyond the standard matrix:

- An exhaustive table for `computeEffectivePermissions`: all seven templates × all six scope levels
- A scope outside its `validFrom`/`validTo` window yields no permissions
- Org `OWNER` retains full access regardless of project role
- `OWN` scope permits access to the caller's own transactions and denies others'
- `CARD` scope permits card X and denies card Y with the same permission
- Changing a role recomputes `effectivePermissions` completely, leaving no stale entries
- Removing a member revokes access immediately on the next request
- Editing a `Role` document recomputes every member holding it
- Preview output matches what enforcement actually does — assert both from the same fixtures
- Every B1 and B2 endpoint now rejects an under-permissioned caller

## Review checklist

- [ ] Preview and enforcement call the same function; there is no second implementation
- [ ] `requirePermission` checks the subject, not just the permission
- [ ] Every endpoint from B1 and B2 has been retrofitted — walk the list explicitly
- [ ] Role templates are per-org copies
- [ ] `reasons[]` is populated well enough to render a useful preview
- [ ] `effectivePermissions` is recomputed wholesale, never patched
- [ ] `GET /api/me/permissions` shape works for the client's `can()` helper

## Out of scope

Budget-specific permissions enforcement (B4 wires them), automation-driven access grants (B6), access expiry sweeps (B6's worker).
