/** How competing rule contributions combine for one field (RULES-ENGINE §4). */
export const MergeStrategy = {
  MIN: 'min',
  MAX: 'max',
  INTERSECT: 'intersect',
  UNION: 'union',
  MOST_RESTRICTIVE: 'most_restrictive',
} as const

export type MergeStrategy = (typeof MergeStrategy)[keyof typeof MergeStrategy]
