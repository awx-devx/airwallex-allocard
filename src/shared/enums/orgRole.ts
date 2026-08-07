export const OrgRole = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  MEMBER: 'MEMBER',
} as const

export type OrgRole = (typeof OrgRole)[keyof typeof OrgRole]
