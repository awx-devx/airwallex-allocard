'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, type ReactNode } from 'react'
import { isApiError } from '@/client/api/errors'
import { useProjects } from '@/client/hooks/useProjects'
import { useMe } from '@/client/hooks/useSession'
import { useTransactions, useUploadReceipt } from '@/client/hooks/useTransactions'
import { permissionGateAllowed } from '@/client/lib/access'
import { useCan } from '@/client/lib/permissions/useCan'
import { activeOrgRole } from '@/client/lib/projects'
import {
  RECEIPT_MAX_BASE64_CHARS,
  badReceiptTypeMessage,
  base64FromDataUrl,
  flattenTransactionPages,
  needsReceipt,
  noReceiptsEmpty,
  parseReceiptsSearchParams,
  receiptContentType,
  receiptsListHref,
  receiptsLoadMoreHint,
  receiptTooLargeMessage,
  requiresProjectIdOnTxList,
  selectProjectEmpty,
  transactionHref,
  viewTransactionsDenialMessage,
  type ReceiptsListSearch,
} from '@/client/lib/transactions'
import { useActiveOrg } from '@/client/providers/ActiveOrgProvider'
import type { TxFilter } from '@/client/queryKeys'
import { DataTable } from '@/components/patterns/DataTable'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { MoneyDisplay } from '@/components/patterns/MoneyDisplay'
import { PermissionGateView } from '@/components/patterns/PermissionGate'
import type { DataTableColumn } from '@/components/patterns/types'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { DateRangePicker } from '@/components/ui/date-range-picker'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { formatDateTime } from '@/lib/dates'
import { Permission } from '@/shared/enums/permissions'
import type { Transaction } from '@/shared/types/transaction'

const ALL = '__all__'
const FILE_ACCEPT = '.pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'

function toClearedFilter(filter: ReceiptsListSearch): TxFilter {
  const next: Partial<TxFilter> = { pageSize: 20, status: 'CLEARED' }
  if (filter.projectId !== undefined) next.projectId = filter.projectId
  if (filter.from !== undefined) next.from = filter.from
  if (filter.to !== undefined) next.to = filter.to
  return next as TxFilter
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
        return
      }
      reject(new Error('Unable to read file'))
    }
    reader.onerror = () => reject(new Error('Unable to read file'))
    reader.readAsDataURL(file)
  })
}

export function AttachReceiptSheet({
  transactionId,
  open,
  onOpenChange,
}: {
  transactionId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const upload = useUploadReceipt()
  const [alertMessage, setAlertMessage] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    setAlertMessage(null)
    if (file === undefined || transactionId === null) return
    const contentType = receiptContentType(file.type)
    if (contentType === null || file.name.length < 1 || file.name.length > 255) {
      setAlertMessage(badReceiptTypeMessage())
      return
    }
    try {
      const dataUrl = await readAsDataUrl(file)
      const contentBase64 = base64FromDataUrl(dataUrl)
      if (contentBase64.length > RECEIPT_MAX_BASE64_CHARS) {
        setAlertMessage(receiptTooLargeMessage())
        return
      }
      await upload.mutateAsync({
        id: transactionId,
        input: { fileName: file.name, contentType, contentBase64 },
      })
      onOpenChange(false)
    } catch (error) {
      setAlertMessage(isApiError(error) ? error.message : 'Unable to attach receipt')
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="min-w-0 overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Attach receipt</SheetTitle>
        </SheetHeader>
        <div className="flex min-w-0 flex-col gap-4 px-4 pb-4">
          {alertMessage ? (
            <Alert variant="destructive">
              <AlertDescription>{alertMessage}</AlertDescription>
            </Alert>
          ) : null}
          <Label htmlFor="attach-receipt-file">Attach receipt</Label>
          <input
            id="attach-receipt-file"
            type="file"
            accept={FILE_ACCEPT}
            aria-label="Attach receipt"
            disabled={upload.isPending || transactionId === null}
            onChange={(event) => {
              const file = event.target.files?.[0]
              void onFile(file)
              event.target.value = ''
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  )
}

function AttachReceiptButton({ projectId, onClick }: { projectId: string; onClick: () => void }) {
  const { can, isLoading } = useCan(projectId)
  const allowed = permissionGateAllowed(can(Permission.TRANSACTION_VIEW), isLoading)
  return (
    <PermissionGateView allowed={allowed} denialMessage={viewTransactionsDenialMessage()}>
      <Button type="button" disabled={!allowed} onClick={onClick}>
        Attach receipt
      </Button>
    </PermissionGateView>
  )
}

function ReceiptsToolbar({
  filter,
  projectItems,
  allowAllProjects,
  onChange,
}: {
  filter: ReceiptsListSearch
  projectItems: ReadonlyArray<{ id: string; name: string }>
  allowAllProjects: boolean
  onChange: (next: ReceiptsListSearch) => void
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-2">
      <div className="flex min-w-0 flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Project</Label>
        <Select
          value={filter.projectId ?? (allowAllProjects ? ALL : undefined)}
          onValueChange={(value) =>
            onChange({
              ...filter,
              projectId: value === ALL ? undefined : value,
            })
          }
        >
          <SelectTrigger aria-label="Project">
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            {allowAllProjects ? <SelectItem value={ALL}>All</SelectItem> : null}
            {projectItems.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <Label className="text-xs text-muted-foreground">Dates</Label>
        <DateRangePicker
          from={filter.from ?? null}
          to={filter.to ?? null}
          onChange={({ from, to }) =>
            onChange({
              ...filter,
              from: from ?? undefined,
              to: to ?? undefined,
            })
          }
        />
      </div>
    </div>
  )
}

export function ReceiptsQueue() {
  const router = useRouter()
  const params = useSearchParams()
  const filter = parseReceiptsSearchParams({
    projectId: params.get('projectId') ?? undefined,
    from: params.get('from') ?? undefined,
    to: params.get('to') ?? undefined,
  })
  const me = useMe()
  const { orgId } = useActiveOrg()
  const projects = useProjects({ page: 1, pageSize: 100 })
  const orgRole = activeOrgRole(me.data?.memberships ?? [], orgId ?? me.data?.activeOrg?.id ?? null)
  const needsProject = requiresProjectIdOnTxList(orgRole)

  function pushFilter(next: ReceiptsListSearch) {
    router.push(receiptsListHref(next))
  }

  const toolbar = (
    <ReceiptsToolbar
      filter={filter}
      projectItems={projects.data?.items ?? []}
      allowAllProjects={!needsProject && !me.isPending}
      onChange={pushFilter}
    />
  )

  if (me.isPending) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        <LoadingState />
      </div>
    )
  }

  if (needsProject && filter.projectId === undefined) {
    const empty = selectProjectEmpty()
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        <EmptyState title={empty.title} description={empty.description} />
      </div>
    )
  }

  return <ReceiptsQueueResults filter={filter} toolbar={toolbar} />
}

function ReceiptsQueueResults({
  filter,
  toolbar,
}: {
  filter: ReceiptsListSearch
  toolbar: ReactNode
}) {
  const query = useTransactions(toClearedFilter(filter))
  const flattened = flattenTransactionPages(query.data?.pages) as Transaction[]
  const rows = flattened.filter(needsReceipt)
  const [attachId, setAttachId] = useState<string | null>(null)

  if (query.error) {
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        <ErrorState
          message={isApiError(query.error) ? query.error.message : 'Unable to load receipts'}
        />
      </div>
    )
  }

  if (!query.isPending && !query.hasNextPage && rows.length === 0) {
    const empty = noReceiptsEmpty()
    return (
      <div className="flex min-w-0 flex-col gap-4">
        {toolbar}
        <EmptyState title={empty.title} description={empty.description} />
      </div>
    )
  }

  const columns: DataTableColumn<Transaction>[] = [
    {
      id: 'transactedAt',
      header: 'Date',
      cell: (row) => formatDateTime(row.transactedAt),
    },
    {
      id: 'merchant',
      header: 'Merchant',
      cell: (row) => (
        <Link href={transactionHref(row.id)} className="min-w-0 break-words hover:underline">
          {row.merchant.name}
        </Link>
      ),
    },
    {
      id: 'amount',
      header: 'Amount',
      cell: (row) => (
        <MoneyDisplay money={{ amount: row.amount, currency: row.currency }} colorBySign />
      ),
    },
    {
      id: 'attach',
      header: 'Receipt',
      cell: (row) => (
        <AttachReceiptButton projectId={row.projectId} onClick={() => setAttachId(row.id)} />
      ),
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {toolbar}
      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.id}
        pagination={{
          mode: 'cursor',
          nextCursor: query.hasNextPage ? 'next' : null,
          onLoadMore: () => {
            void query.fetchNextPage()
          },
          isFetchingMore: query.isFetchingNextPage,
        }}
        loading={query.isPending}
        empty={noReceiptsEmpty()}
      />
      {query.hasNextPage ? (
        <p className="text-sm text-muted-foreground">{receiptsLoadMoreHint()}</p>
      ) : null}
      <AttachReceiptSheet
        transactionId={attachId}
        open={attachId !== null}
        onOpenChange={(open) => {
          if (!open) setAttachId(null)
        }}
      />
    </div>
  )
}
