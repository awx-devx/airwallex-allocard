import { ProjectStatus } from '@/shared/enums/projectStatus'

/**
 * Data-dependent checks the transition *service* must run before mutating.
 * `canTransition` stays pure — it only declares which checks apply.
 */
export type TransitionGuard = 'readyForApproval'

export type TransitionResult =
  { ok: true; guards: readonly TransitionGuard[] } | { ok: false; reason: 'INVALID_TRANSITION' }

/**
 * Allowed edges from the B2 lifecycle graph:
 *
 *   DRAFT → PENDING_APPROVAL → ACTIVE → CLOSING → CLOSED → ARCHIVED
 *     └──────────────────────► CANCELLED
 *
 * CANCELLED attaches under DRAFT only (pre-submit abandon).
 * CLOSED and ARCHIVED (and CANCELLED) are terminal.
 *
 * **CLOSING is entered only via** `POST /api/projects/:id/closure/start`
 * (B9.0 lock) — not via generic `/transition`. ACTIVE has no outgoing edge here.
 */
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
