/**
 * Pure project lifecycle graph — no I/O.
 * Relocated from `src/server/services/projects/transitions.ts` so the client
 * can hide invalid status actions. Server re-exports; do not change the edges.
 *
 *   DRAFT → PENDING_APPROVAL → ACTIVE → CLOSING → CLOSED → ARCHIVED
 *     └──────────────────────► CANCELLED
 *
 * CLOSING is entered only via `POST /api/projects/:id/closure/start` (B9.0) —
 * not via generic `/transition`. ACTIVE has no outgoing edge here.
 */
import { Permission } from '@/shared/enums/permissions'
import { ProjectStatus } from '@/shared/enums/projectStatus'

export type TransitionGuard = 'readyForApproval'

export type TransitionResult =
  { ok: true; guards: readonly TransitionGuard[] } | { ok: false; reason: 'INVALID_TRANSITION' }

const EDGES: Readonly<
  Record<ProjectStatus, ReadonlyArray<{ to: ProjectStatus; guards: readonly TransitionGuard[] }>>
> = {
  [ProjectStatus.DRAFT]: [
    { to: ProjectStatus.PENDING_APPROVAL, guards: ['readyForApproval'] },
    { to: ProjectStatus.CANCELLED, guards: [] },
  ],
  [ProjectStatus.PENDING_APPROVAL]: [{ to: ProjectStatus.ACTIVE, guards: [] }],
  [ProjectStatus.ACTIVE]: [],
  [ProjectStatus.CLOSING]: [{ to: ProjectStatus.CLOSED, guards: [] }],
  [ProjectStatus.CLOSED]: [{ to: ProjectStatus.ARCHIVED, guards: [] }],
  [ProjectStatus.ARCHIVED]: [],
  [ProjectStatus.CANCELLED]: [],
}

/** Pure lifecycle authority — no I/O. Handlers must not branch on status themselves. */
export function canTransition(from: ProjectStatus, to: ProjectStatus): TransitionResult {
  if (from === to) {
    return { ok: false, reason: 'INVALID_TRANSITION' }
  }

  const edge = EDGES[from].find((candidate) => candidate.to === to)
  if (!edge) {
    return { ok: false, reason: 'INVALID_TRANSITION' }
  }

  return { ok: true, guards: edge.guards }
}

/** Targets where `canTransition(from, to)` is ok, in graph order. */
export function offeredTransitions(from: ProjectStatus): ProjectStatus[] {
  return EDGES[from].map((edge) => edge.to)
}

/**
 * Permission required to transition *to* the given status.
 * Submit / draft-cancel → edit; approve+launch → request.approve; lifecycle end → close.
 */
export function permissionForTransition(to: ProjectStatus): Permission {
  switch (to) {
    case ProjectStatus.PENDING_APPROVAL:
    case ProjectStatus.CANCELLED:
      return Permission.PROJECT_EDIT
    case ProjectStatus.ACTIVE:
      return Permission.REQUEST_APPROVE
    case ProjectStatus.CLOSING:
    case ProjectStatus.CLOSED:
    case ProjectStatus.ARCHIVED:
      return Permission.PROJECT_CLOSE
    default:
      return Permission.PROJECT_EDIT
  }
}
