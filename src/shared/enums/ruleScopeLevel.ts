/** Rule applicability: org-wide or a single project (RULES-ENGINE §3). */
export const RuleScopeLevel = {
  ORG: 'ORG',
  PROJECT: 'PROJECT',
} as const

export type RuleScopeLevel = (typeof RuleScopeLevel)[keyof typeof RuleScopeLevel]
