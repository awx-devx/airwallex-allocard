export const AccessScopeLevel = {
  PROJECT: 'PROJECT',
  WORKSTREAM: 'WORKSTREAM',
  CATEGORY: 'CATEGORY',
  CARD: 'CARD',
  OWN: 'OWN',
  ASSIGNED_MEMBERS: 'ASSIGNED_MEMBERS',
} as const

export type AccessScopeLevel = (typeof AccessScopeLevel)[keyof typeof AccessScopeLevel]
