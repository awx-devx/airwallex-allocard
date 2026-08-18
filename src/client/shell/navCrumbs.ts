/** Pathname → header crumbs. Pure — no React. */

export type Crumb = {
  href: string
  label: string
}

export type CrumbLabels = {
  projectName?: string
}

const STATIC_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  projects: 'Projects',
  new: 'New',
  people: 'People',
  add: 'Add',
  budget: 'Budget',
  categories: 'Categories',
  history: 'History',
  requests: 'Requests',
  cards: 'Cards',
  controls: 'Controls',
  activity: 'Activity',
  closure: 'Closure',
  final: 'Final report',
  explain: 'Why this limit?',
  reveal: 'Reveal',
  approvals: 'Approvals',
  declined: 'Declined',
  transactions: 'Transactions',
  receipts: 'Receipts',
  automation: 'Automation',
  reports: 'Reports',
  organization: 'Organization',
  audit: 'Audit',
  roles: 'Roles',
  'access-reviews': 'Access reviews',
  rules: 'Rules',
  attributes: 'Attributes',
  simulate: 'Simulate',
}

/** Segments that are not product pages — never emit a crumb (would 404). */
const SKIP = new Set(['settings', 'report', 'project'])

const PARAM_AFTER: Record<string, { fallback: string; project?: boolean }> = {
  projects: { fallback: 'Project', project: true },
  cards: { fallback: 'Card' },
  requests: { fallback: 'Request' },
  approvals: { fallback: 'Approval' },
  transactions: { fallback: 'Transaction' },
  rules: { fallback: 'Rule' },
  project: { fallback: 'Project', project: true },
}

function splitPathname(pathname: string): string[] {
  const path = pathname.split(/[?#]/, 1)[0] ?? pathname
  return path.split('/').filter(Boolean)
}

function titleCase(segment: string): string {
  return segment
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export function projectIdFromPathname(pathname: string): string | null {
  const segments = splitPathname(pathname)
  if (segments[0] === 'projects' && segments[1] && segments[1] !== 'new') {
    return segments[1]
  }
  if (segments[0] === 'reports' && segments[1] === 'project' && segments[2]) {
    return segments[2]
  }
  return null
}

export function crumbsForPathname(pathname: string, labels: CrumbLabels = {}): Crumb[] {
  const segments = splitPathname(pathname)
  const crumbs: Crumb[] = []
  let href = ''
  let previous: string | undefined

  for (const segment of segments) {
    href += `/${segment}`
    if (SKIP.has(segment)) {
      previous = segment
      continue
    }

    const staticLabel = STATIC_LABELS[segment]
    if (staticLabel !== undefined) {
      crumbs.push({ href, label: staticLabel })
      previous = segment
      continue
    }

    const param = previous ? PARAM_AFTER[previous] : undefined
    if (param) {
      const label = param.project && labels.projectName ? labels.projectName : param.fallback
      crumbs.push({ href, label })
    } else {
      crumbs.push({ href, label: titleCase(segment) })
    }
    previous = segment
  }

  return crumbs
}
