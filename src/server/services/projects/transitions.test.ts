import { describe, expect, it } from 'vitest'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import { canTransition } from '@/server/services/projects/transitions'

const ALL_STATUSES = Object.values(ProjectStatus)

/** Spec graph: only these edges are valid. */
const VALID: ReadonlyArray<{
  from: ProjectStatus
  to: ProjectStatus
  guards: readonly string[]
}> = [
  {
    from: ProjectStatus.DRAFT,
    to: ProjectStatus.PENDING_APPROVAL,
    guards: ['readyForApproval'],
  },
  { from: ProjectStatus.DRAFT, to: ProjectStatus.CANCELLED, guards: [] },
  { from: ProjectStatus.PENDING_APPROVAL, to: ProjectStatus.ACTIVE, guards: [] },
  // ACTIVE → CLOSING is only via /closure/start (B9.0), not canTransition.
  { from: ProjectStatus.CLOSING, to: ProjectStatus.CLOSED, guards: [] },
  { from: ProjectStatus.CLOSED, to: ProjectStatus.ARCHIVED, guards: [] },
]

function isValidPair(from: ProjectStatus, to: ProjectStatus): boolean {
  return VALID.some((edge) => edge.from === from && edge.to === to)
}

describe('projects/transitions', () => {
  it('accepts every valid edge with the expected guards', () => {
    for (const edge of VALID) {
      expect(canTransition(edge.from, edge.to)).toEqual({
        ok: true,
        guards: edge.guards,
      })
    }
  })

  it('rejects every other (from, to) pair including identity', () => {
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        if (isValidPair(from, to)) {
          continue
        }
        expect(canTransition(from, to)).toEqual({
          ok: false,
          reason: 'INVALID_TRANSITION',
        })
      }
    }
  })

  it('covers the full 7×7 matrix (49 pairs)', () => {
    expect(ALL_STATUSES).toHaveLength(7)
    let checked = 0
    for (const from of ALL_STATUSES) {
      for (const to of ALL_STATUSES) {
        const result = canTransition(from, to)
        if (isValidPair(from, to)) {
          expect(result.ok).toBe(true)
        } else {
          expect(result).toEqual({ ok: false, reason: 'INVALID_TRANSITION' })
        }
        checked += 1
      }
    }
    expect(checked).toBe(49)
  })

  it('treats ARCHIVED and CANCELLED as fully terminal; CLOSED only → ARCHIVED', () => {
    for (const to of ALL_STATUSES) {
      expect(canTransition(ProjectStatus.ARCHIVED, to).ok).toBe(false)
      expect(canTransition(ProjectStatus.CANCELLED, to).ok).toBe(false)
      if (to === ProjectStatus.ARCHIVED) {
        expect(canTransition(ProjectStatus.CLOSED, to).ok).toBe(true)
      } else {
        expect(canTransition(ProjectStatus.CLOSED, to).ok).toBe(false)
      }
    }
  })
})
