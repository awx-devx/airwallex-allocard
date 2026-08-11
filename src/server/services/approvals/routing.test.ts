import { describe, expect, it } from 'vitest'
import { ApproverSelection } from '@/shared/enums/approverSelection'
import { ApprovalDecision } from '@/shared/enums/approvalDecision'
import {
  countDistinctApprovals,
  hasMetRequiredApprovals,
  resolveApprovers,
} from '@/server/services/approvals/routing'

const members = [
  { userId: 'u_owner', roleKey: 'project_manager' },
  { userId: 'u_approver', roleKey: 'approver' },
  { userId: 'u_approver2', roleKey: 'approver' },
  { userId: 'u_spender', roleKey: 'project_spender' },
  { userId: 'u_req', roleKey: 'approver' }, // requester also holds approver role
]

describe('approvals/routing', () => {
  it('resolves ROLE to distinct members excluding requester', () => {
    const ids = resolveApprovers({
      selection: { type: ApproverSelection.ROLE, roleKey: 'approver' },
      members,
      projectOwnerId: 'u_owner',
      excludeUserId: 'u_req',
    })
    expect(ids).toEqual(['u_approver', 'u_approver2'])
  })

  it('resolves NAMED_USERS and drops the requester', () => {
    const ids = resolveApprovers({
      selection: {
        type: ApproverSelection.NAMED_USERS,
        userIds: ['u_approver', 'u_req', 'u_approver', 'u_missing'],
      },
      members,
      projectOwnerId: 'u_owner',
      excludeUserId: 'u_req',
    })
    expect(ids).toEqual(['u_approver', 'u_missing'])
  })

  it('resolves PROJECT_OWNER and excludes requester-owner', () => {
    expect(
      resolveApprovers({
        selection: { type: ApproverSelection.PROJECT_OWNER },
        members,
        projectOwnerId: 'u_owner',
        excludeUserId: 'u_req',
      }),
    ).toEqual(['u_owner'])

    expect(
      resolveApprovers({
        selection: { type: ApproverSelection.PROJECT_OWNER },
        members,
        projectOwnerId: 'u_req',
        excludeUserId: 'u_req',
      }),
    ).toEqual([])
  })

  it('counts distinct APPROVE only — duplicate user does not count twice', () => {
    const approvals = [
      { approverId: 'a', decision: ApprovalDecision.APPROVE },
      { approverId: 'a', decision: ApprovalDecision.APPROVE },
      { approverId: 'b', decision: ApprovalDecision.APPROVE },
      { approverId: 'c', decision: ApprovalDecision.REJECT },
    ]
    expect(countDistinctApprovals(approvals)).toBe(2)
    expect(hasMetRequiredApprovals(approvals, 2)).toBe(true)
    expect(hasMetRequiredApprovals(approvals, 3)).toBe(false)
  })
})
