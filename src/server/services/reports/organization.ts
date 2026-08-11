/**
 * B9.4 — Organization report rollup.
 *
 * `currency` = org.baseCurrency (primary). Projects in other currencies appear
 * in `projects[]` but are excluded from `totals` (B9.0 locked policy).
 * Projects without a budget are treated as primary-currency (zeros).
 */
import { connectDb } from '@/server/db/connect'
import { AppError } from '@/server/http/errors'
import { projectIdsGrantingPermission } from '@/server/http/requirePermission'
import type { OrgContext } from '@/server/http/types'
import { findEntriesByProject } from '@/server/repositories/budgetEntries'
import { findBudgetByProject } from '@/server/repositories/budgets'
import { findOrganizationById } from '@/server/repositories/organizations'
import { listProjects, type ListProjectsFilter } from '@/server/repositories/projects'
import { projectBudget } from '@/server/services/budget/projectProjection'
import { OrgRole } from '@/shared/enums/orgRole'
import { Permission } from '@/shared/enums/permissions'
import type { Project } from '@/shared/types/project'
import type { OrganizationReport } from '@/shared/types/report'

function isElevated(orgRole: OrgRole): boolean {
  return orgRole === OrgRole.OWNER || orgRole === OrgRole.ADMIN
}

type ProjectRow = OrganizationReport['projects'][number]

async function projectRow(
  ctx: OrgContext,
  project: Project,
  primaryCurrency: string,
): Promise<{ row: ProjectRow; includeInTotals: boolean }> {
  const [budget, entries] = await Promise.all([
    findBudgetByProject(ctx, project.id),
    findEntriesByProject(ctx, project.id),
  ])

  const values = projectBudget(entries)
  const currency = budget?.currency ?? primaryCurrency

  return {
    includeInTotals: currency === primaryCurrency,
    row: {
      projectId: project.id,
      name: project.name,
      approved: values.approved,
      committed: values.committed,
      actual: values.actual,
      remaining: values.remaining,
      utilisationPct: values.utilisationPct,
    },
  }
}

/**
 * Org rollup for `report.export`. MEMBER sees only projects granting the perm.
 */
export async function getOrganizationReport(ctx: OrgContext): Promise<OrganizationReport> {
  await connectDb()

  const org = await findOrganizationById(ctx.orgId)
  if (!org) {
    throw AppError.notFound()
  }

  const primaryCurrency = org.baseCurrency

  const filter: ListProjectsFilter = { pageSize: 500 }
  if (!isElevated(ctx.orgRole)) {
    const ids = await projectIdsGrantingPermission(ctx, Permission.REPORT_EXPORT)
    if (ids.length === 0) {
      throw AppError.permissionDenied(Permission.REPORT_EXPORT)
    }
    filter.ids = ids
  }

  const listed = await listProjects(ctx, filter)
  const projects: ProjectRow[] = []
  let totalsApproved = 0
  let totalsCommitted = 0
  let totalsActual = 0
  let totalsRemaining = 0

  for (const p of listed.items) {
    const { row, includeInTotals } = await projectRow(ctx, p, primaryCurrency)
    projects.push(row)
    if (includeInTotals) {
      totalsApproved += row.approved
      totalsCommitted += row.committed
      totalsActual += row.actual
      totalsRemaining += row.remaining
    }
  }

  projects.sort((a, b) => a.projectId.localeCompare(b.projectId))

  return {
    currency: primaryCurrency,
    projects,
    totals: {
      approved: totalsApproved,
      committed: totalsCommitted,
      actual: totalsActual,
      remaining: totalsRemaining,
    },
    generatedAt: new Date().toISOString(),
  }
}
