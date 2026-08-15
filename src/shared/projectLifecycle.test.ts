import { describe, expect, it } from 'vitest'
import {
  canTransition,
  offeredTransitions,
  permissionForTransition,
} from '@/shared/projectLifecycle'
import { Permission } from '@/shared/enums/permissions'
import { ProjectStatus } from '@/shared/enums/projectStatus'

const ALL_STATUSES = Object.values(ProjectStatus)

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
  { from: ProjectStatus.CLOSING, to: ProjectStatus.CLOSED, guards: [] },
  { from: ProjectStatus.CLOSED, to: ProjectStatus.ARCHIVED, guards: [] },
]

function isValidPair(from: ProjectStatus, to: ProjectStatus): boolean {
  return VALID.some((edge) => edge.from === from && edge.to === to)
}

describe('shared/projectLifecycle', () => {
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

  it('does not allow ACTIVE → CLOSING', () => {
    expect(canTransition(ProjectStatus.ACTIVE, ProjectStatus.CLOSING)).toEqual({
      ok: false,
      reason: 'INVALID_TRANSITION',
    })
    expect(offeredTransitions(ProjectStatus.ACTIVE)).not.toContain(ProjectStatus.CLOSING)
    expect(offeredTransitions(ProjectStatus.ACTIVE)).toEqual([])
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

  it('maps permissionForTransition by target status', () => {
    expect(permissionForTransition(ProjectStatus.PENDING_APPROVAL)).toBe(Permission.PROJECT_EDIT)
    expect(permissionForTransition(ProjectStatus.CANCELLED)).toBe(Permission.PROJECT_EDIT)
    expect(permissionForTransition(ProjectStatus.ACTIVE)).toBe(Permission.REQUEST_APPROVE)
    expect(permissionForTransition(ProjectStatus.CLOSING)).toBe(Permission.PROJECT_CLOSE)
    expect(permissionForTransition(ProjectStatus.CLOSED)).toBe(Permission.PROJECT_CLOSE)
    expect(permissionForTransition(ProjectStatus.ARCHIVED)).toBe(Permission.PROJECT_CLOSE)
    expect(permissionForTransition(ProjectStatus.DRAFT)).toBe(Permission.PROJECT_EDIT)
  })

  it('offers DRAFT → PENDING_APPROVAL and CANCELLED', () => {
    expect(offeredTransitions(ProjectStatus.DRAFT)).toEqual([
      ProjectStatus.PENDING_APPROVAL,
      ProjectStatus.CANCELLED,
    ])
  })

  it('offeredTransitions matches the A2 graph for every status and never CLOSING from ACTIVE', () => {
    const expected: Record<ProjectStatus, ProjectStatus[]> = {
      [ProjectStatus.DRAFT]: [ProjectStatus.PENDING_APPROVAL, ProjectStatus.CANCELLED],
      [ProjectStatus.PENDING_APPROVAL]: [ProjectStatus.ACTIVE],
      [ProjectStatus.ACTIVE]: [],
      [ProjectStatus.CLOSING]: [ProjectStatus.CLOSED],
      [ProjectStatus.CLOSED]: [ProjectStatus.ARCHIVED],
      [ProjectStatus.ARCHIVED]: [],
      [ProjectStatus.CANCELLED]: [],
    }
    for (const status of ALL_STATUSES) {
      expect(offeredTransitions(status)).toEqual(expected[status])
      expect(offeredTransitions(status)).not.toContain(ProjectStatus.CLOSING)
    }
    expect(offeredTransitions(ProjectStatus.ACTIVE)).not.toContain(ProjectStatus.CLOSING)
  })
})
