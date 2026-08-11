import { ApproverSelection } from '@/shared/enums/approverSelection'
import type { ApproverSelector } from '@/shared/types/approvalRule'

/** Member row already resolved with roleKey (null if role missing). */
export type ApproverPoolMember = {
  userId: string
  roleKey: string | null
}

export type ResolveApproversInput = {
  selection: ApproverSelector
  members: readonly ApproverPoolMember[]
  /** Project owner user id; null if unset. */
  projectOwnerId: string | null
  /** Requester is never returned — self-approval is impossible. */
  excludeUserId: string
}

/**
 * Resolve ROLE / NAMED_USERS / PROJECT_OWNER to distinct user ids.
 * Pure — caller loads members/owner. Sorted for determinism.
 */
export function resolveApprovers(input: ResolveApproversInput): string[] {
  const excluded = input.excludeUserId
  let candidates: string[] = []

  switch (input.selection.type) {
    case ApproverSelection.ROLE: {
      const key = input.selection.roleKey
      candidates = input.members.filter((m) => m.roleKey === key).map((m) => m.userId)
      break
    }
    case ApproverSelection.NAMED_USERS: {
      candidates = [...input.selection.userIds]
      break
    }
    case ApproverSelection.PROJECT_OWNER: {
      if (input.projectOwnerId) {
        candidates = [input.projectOwnerId]
      }
      break
    }
  }

  return [...new Set(candidates.filter((id) => id !== excluded))].sort()
}

/**
 * Distinct APPROVE decisions so far. Same user approving twice does not count twice.
 */
export function countDistinctApprovals(
  approvals: readonly { approverId: string; decision: string }[],
  approveValue = 'APPROVE',
): number {
  const ids = new Set<string>()
  for (const entry of approvals) {
    if (entry.decision === approveValue) {
      ids.add(entry.approverId)
    }
  }
  return ids.size
}

/** True when distinct approvers meet requiredCount. */
export function hasMetRequiredApprovals(
  approvals: readonly { approverId: string; decision: string }[],
  requiredCount: number,
): boolean {
  return countDistinctApprovals(approvals) >= requiredCount
}
