/**
 * How approvers are resolved for a purchase request.
 * ROLE — members holding the named role key.
 * NAMED_USERS — explicit user id list.
 * PROJECT_OWNER — the project's owner membership.
 */
export const ApproverSelection = {
  ROLE: 'ROLE',
  NAMED_USERS: 'NAMED_USERS',
  PROJECT_OWNER: 'PROJECT_OWNER',
} as const

export type ApproverSelection = (typeof ApproverSelection)[keyof typeof ApproverSelection]
