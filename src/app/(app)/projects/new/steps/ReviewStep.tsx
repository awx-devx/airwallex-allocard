'use client'

import { useBudget } from '@/client/hooks/useBudget'
import { useProject } from '@/client/hooks/useProjects'
import { useMe } from '@/client/hooks/useSession'
import {
  cardStructureReviewLines,
  hasBudgetFrom,
  isReadyForApprovalInput,
} from '@/client/lib/projects'
import { BudgetBar } from '@/components/patterns/BudgetBar'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatRange } from '@/lib/dates'

export function ReviewStep({ draftId }: { draftId: string }) {
  const me = useMe()
  const projectQuery = useProject(draftId)
  const budgetQuery = useBudget(draftId)
  const project = projectQuery.data

  if (projectQuery.isPending || budgetQuery.isPending) {
    return <LoadingState label="Loading review" />
  }
  if (!project) {
    return null
  }

  const approved = budgetQuery.data?.budget?.approvedAmount ?? null
  const projection = budgetQuery.data?.projection
  const budgetOk = hasBudgetFrom(project, approved)
  const ready = isReadyForApprovalInput(project, budgetOk)
  const displayCurrency =
    me.data?.activeOrg?.baseCurrency ??
    (approved !== null && budgetQuery.data?.budget?.currency
      ? budgetQuery.data.budget.currency
      : null)
  const dates =
    project.startDate && project.endDate
      ? formatRange(project.startDate, project.endDate)
      : 'Dates not set'

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {!ready ? (
        <Alert variant="warning">
          <AlertDescription>
            Launch will fail until name, owner, dates, and budget are set.
          </AlertDescription>
        </Alert>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="flex min-w-0 flex-col gap-2 text-sm">
          <p className="min-w-0 break-all">{project.name}</p>
          <p className="min-w-0 break-all">{project.code}</p>
          <p className="min-w-0 break-all">{project.description || '—'}</p>
          <p>{dates}</p>
          <p>Cost centre: {project.costCentre ?? '—'}</p>
          <p>Owner: {project.ownerId ?? '—'}</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Budget</CardTitle>
        </CardHeader>
        <CardContent>
          {projection && displayCurrency ? (
            <BudgetBar
              currency={displayCurrency}
              approved={projection.approved}
              committed={projection.committed}
              actual={projection.actual}
              remaining={projection.remaining}
              utilisationPct={projection.utilisationPct}
              overCommitted={projection.overCommitted}
            />
          ) : displayCurrency && approved !== null ? (
            <MoneyDisplay money={{ amount: approved, currency: displayCurrency }} />
          ) : (
            <p className="text-sm text-muted-foreground">No budget yet.</p>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Card structure</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {cardStructureReviewLines(project.cardStructure).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
