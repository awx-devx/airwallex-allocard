'use client'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { isApiError } from '@/client/api/errors'
import {
  useBudget,
  useBudgetChangeRequests,
  useBudgetEntries,
  useCreateBudgetEntry,
  useSetBudget,
} from '@/client/hooks/useBudget'
import { useProjectCards } from '@/client/hooks/useCards'
import { useProject } from '@/client/hooks/useProjects'
import { useFinalReport } from '@/client/hooks/useReports'
import { useMe } from '@/client/hooks/useSession'
import { permissionGateAllowed } from '@/client/lib/access'
import {
  budgetRequestsHref,
  diffCardTransactionLimits,
  editBudgetDenialMessage,
  hasBudgetRecord,
  overCommittedMessage,
  pendingChangeRequests,
  projectionToBudgetBarProps,
  requestBudgetDenialMessage,
  snapshotCardTransactionLimits,
  type CardTransactionLimitDiff,
} from '@/client/lib/budget'
import { useCan } from '@/client/lib/permissions/useCan'
import {
  finalReportHref,
  finalReportLink,
  isProjectArchived,
  reportToBudgetBar,
} from '@/client/lib/reports'
import { qk } from '@/client/queryKeys'
import { AdjustDialog } from '@/app/(app)/projects/[id]/budget/AdjustDialog'
import { CardLimitMoves } from '@/app/(app)/projects/[id]/budget/CardLimitMoves'
import { SetApprovedDialog } from '@/app/(app)/projects/[id]/budget/SetApprovedDialog'
import { BudgetBar } from '@/components/patterns/BudgetBar'
import { DataTable } from '@/components/patterns/DataTable'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import type { DataTableColumn } from '@/components/patterns/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/dates'
import { ErrorCode } from '@/shared/enums/errors'
import { Permission } from '@/shared/enums/permissions'
import { ProjectStatus } from '@/shared/enums/projectStatus'
import type { BudgetEntry } from '@/shared/types/budget'
import type { CardList } from '@/shared/types/card'

const ENTRY_PAGE_SIZE = 20
const CARD_PAGE = { page: 1, pageSize: 100 } as const

export function BudgetHome() {
  const raw = useParams().id
  const id = typeof raw === 'string' ? raw : Array.isArray(raw) ? (raw[0] ?? '') : ''
  const [page, setPage] = useState(1)
  const [setOpen, setSetOpen] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [limitMoves, setLimitMoves] = useState<{
    diffs: CardTransactionLimitDiff[]
    cardTotal: number
  } | null>(null)
  const queryClient = useQueryClient()
  const budgetQuery = useBudget(id)
  const project = useProject(id)
  const me = useMe()
  const changeRequests = useBudgetChangeRequests(id)
  const entries = useBudgetEntries(id, { page, pageSize: ENTRY_PAGE_SIZE })
  const cards = useProjectCards(id, CARD_PAGE)
  const setBudget = useSetBudget()
  const createEntry = useCreateBudgetEntry()
  const { can, isLoading } = useCan(id)
  const projectStatus = project.data?.status ?? ''
  const archived = isProjectArchived(projectStatus)
  const snapshotFallback = archived || projectStatus === ProjectStatus.CLOSED
  const finalReport = useFinalReport(snapshotFallback ? id : '')

  async function runWithLimitDiff(mutate: () => Promise<void>): Promise<void> {
    const before = snapshotCardTransactionLimits(cards.data?.items ?? [])
    await mutate()
    await queryClient.refetchQueries({ queryKey: qk.cardsForProject(id) })
    const afterList = queryClient.getQueryData<CardList>(qk.cardsForProject(id, CARD_PAGE))
    const afterItems = afterList?.items ?? cards.data?.items ?? []
    const diffs = diffCardTransactionLimits(before, snapshotCardTransactionLimits(afterItems))
    setLimitMoves({ diffs, cardTotal: afterList?.total ?? cards.data?.total ?? 0 })
  }

  if (!id) {
    return <ErrorState message="This project is not available." />
  }

  if (budgetQuery.isPending) {
    return <LoadingState />
  }

  if (budgetQuery.error) {
    if (isApiError(budgetQuery.error) && budgetQuery.error.code === ErrorCode.NOT_FOUND) {
      return <ErrorState message="This project is not available." />
    }
    return (
      <ErrorState
        message={
          isApiError(budgetQuery.error) ? budgetQuery.error.message : 'Unable to load budget'
        }
      />
    )
  }

  const detail = budgetQuery.data
  const canEdit = permissionGateAllowed(can(Permission.BUDGET_EDIT), isLoading)
  const canRequest = permissionGateAllowed(can(Permission.BUDGET_REQUEST), isLoading)
  const orgCurrency = me.data?.activeOrg?.baseCurrency ?? ''
  const currency = detail?.budget?.currency ?? orgCurrency

  const setApprovedControl = archived ? null : (
    <PermissionGateView allowed={canEdit} denialMessage={editBudgetDenialMessage()}>
      <Button
        type="button"
        disabled={!canEdit || currency.length !== 3}
        onClick={() => setSetOpen(true)}
      >
        Set budget
      </Button>
    </PermissionGateView>
  )

  const dialogs =
    currency.length === 3 ? (
      <>
        <SetApprovedDialog
          key={setOpen ? 'set-open' : 'set-closed'}
          open={setOpen}
          onOpenChange={setSetOpen}
          currency={currency}
          currentApproved={detail?.budget?.approvedAmount ?? 0}
          loading={setBudget.isPending}
          onSave={async (approvedAmount) => {
            await runWithLimitDiff(async () => {
              await setBudget.mutateAsync({ id, input: { currency, approvedAmount } })
              await queryClient.invalidateQueries({ queryKey: qk.budgetEntries(id) })
              await queryClient.invalidateQueries({ queryKey: qk.budgetHistory(id) })
            })
          }}
        />
        <AdjustDialog
          key={adjustOpen ? 'adjust-open' : 'adjust-closed'}
          open={adjustOpen}
          onOpenChange={setAdjustOpen}
          currency={currency}
          loading={createEntry.isPending}
          onSave={async ({ amount, note }) => {
            await runWithLimitDiff(async () => {
              await createEntry.mutateAsync({ id, input: { amount, note } })
              await queryClient.invalidateQueries({ queryKey: qk.budgetHistory(id) })
            })
          }}
        />
      </>
    ) : null

  if (!detail || !hasBudgetRecord(detail.budget) || detail.budget === null) {
    if (project.isPending || (snapshotFallback && finalReport.isPending)) {
      return <LoadingState />
    }
    const snapshot = finalReport.data
    if (snapshot) {
      return (
        <div className="flex min-w-0 flex-col gap-4">
          <Card className="laser-cap">
            <CardHeader>
              <CardTitle>Budget</CardTitle>
            </CardHeader>
            <CardContent>
              <BudgetBar {...reportToBudgetBar(snapshot)} />
            </CardContent>
          </Card>
          <Link href={finalReportHref(id)} className={buttonVariants({ variant: 'ghost' })}>
            {finalReportLink()}
          </Link>
        </div>
      )
    }
    return (
      <div className="flex min-w-0 flex-col gap-4">
        <EmptyState
          title="No budget set yet"
          description="Set an approved amount. Categories and formulas come next."
        />
        {setApprovedControl}
        {limitMoves ? (
          <CardLimitMoves
            diffs={limitMoves.diffs}
            cardTotal={limitMoves.cardTotal}
            projectId={id}
          />
        ) : null}
        {archived ? null : dialogs}
      </div>
    )
  }

  if (!currency) {
    return <LoadingState />
  }

  const projection = detail.projection
  const pending = pendingChangeRequests(changeRequests.data ?? [])
  const overCommitted = projection.overCommitted || projection.remaining < 0

  const columns: DataTableColumn<BudgetEntry>[] = [
    {
      id: 'type',
      header: 'Type',
      cell: (row) => <Badge variant="outline">{row.type}</Badge>,
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: (row) => <MoneyDisplay money={{ amount: row.amount, currency: row.currency }} />,
    },
    {
      id: 'sourceType',
      header: 'Source',
      cell: (row) => row.sourceType,
    },
    {
      id: 'note',
      header: 'Note',
      cell: (row) => row.note ?? '—',
    },
    {
      id: 'createdAt',
      header: 'Created',
      cell: (row) => formatDate(row.createdAt),
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Card className="laser-cap">
        <CardHeader>
          <CardTitle>Budget</CardTitle>
        </CardHeader>
        <CardContent>
          <BudgetBar {...projectionToBudgetBarProps(projection, currency)} />
        </CardContent>
      </Card>
      {overCommitted ? (
        <Alert variant="destructive">
          <AlertDescription>{overCommittedMessage()}</AlertDescription>
        </Alert>
      ) : null}
      {pending.length > 0 ? (
        <Alert>
          <AlertDescription>
            <p>A budget change is pending.</p>
            <ul className="mt-2 flex flex-col gap-2">
              {pending.map((row) => (
                <li key={row.id} className="flex min-w-0 flex-wrap items-center gap-2">
                  <MoneyDisplay money={{ amount: row.deltaAmount, currency }} />
                  <span className="min-w-0 truncate" title={row.reason}>
                    {row.reason}
                  </span>
                  <Link
                    href={budgetRequestsHref(id)}
                    className="underline-offset-4 hover:underline"
                  >
                    Review requests
                  </Link>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {limitMoves ? (
        <CardLimitMoves diffs={limitMoves.diffs} cardTotal={limitMoves.cardTotal} projectId={id} />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {archived ? null : (
          <>
            <PermissionGateView allowed={canEdit} denialMessage={editBudgetDenialMessage()}>
              <Button type="button" disabled={!canEdit} onClick={() => setSetOpen(true)}>
                Set approved
              </Button>
            </PermissionGateView>
            <PermissionGateView allowed={canEdit} denialMessage={editBudgetDenialMessage()}>
              <Button type="button" disabled={!canEdit} onClick={() => setAdjustOpen(true)}>
                Record adjustment
              </Button>
            </PermissionGateView>
            <PermissionGateView allowed={canRequest} denialMessage={requestBudgetDenialMessage()}>
              {canRequest ? (
                <Link
                  href={budgetRequestsHref(id)}
                  className={buttonVariants({ variant: 'outline' })}
                >
                  Request change
                </Link>
              ) : (
                <Button type="button" variant="outline" disabled>
                  Request change
                </Button>
              )}
            </PermissionGateView>
          </>
        )}
      </div>
      <h2 className="text-sm font-medium">Recent entries</h2>
      <DataTable
        columns={columns}
        rows={entries.data?.items ?? []}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'page',
          page: entries.data?.page ?? page,
          pageSize: entries.data?.pageSize ?? ENTRY_PAGE_SIZE,
          total: entries.data?.total ?? 0,
          onPageChange: setPage,
        }}
        loading={entries.isPending}
        error={
          entries.error
            ? {
                message: isApiError(entries.error)
                  ? entries.error.message
                  : 'Unable to load entries',
                onRetry: () => void entries.refetch(),
              }
            : undefined
        }
        empty={{
          title: 'No ledger entries yet',
          description: 'Approvals, commitments, actuals, and adjustments appear here.',
        }}
      />
      {archived ? null : dialogs}
    </div>
  )
}
