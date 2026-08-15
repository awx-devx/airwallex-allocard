'use client'

import { nextSorting } from '@/components/patterns/dataTableSort'
import type { DataTableProps } from '@/components/patterns/types'
import { EmptyState } from '@/components/patterns/EmptyState'
import { ErrorState } from '@/components/patterns/ErrorState'
import { LoadingState } from '@/components/patterns/LoadingState'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cursorNextParam, pageNextParam } from '@/lib/pagination'

export function DataTable<T>({
  columns,
  rows,
  getRowId,
  sorting = null,
  onSortingChange,
  pagination,
  rowSelection,
  columnVisibility,
  loading,
  error,
  empty,
  toolbar,
}: DataTableProps<T>) {
  const hidden = new Set(columnVisibility?.hiddenIds ?? [])
  const visibleCols = columns.filter((col) => !hidden.has(col.id))
  const ids = rows.map(getRowId)
  const selected = new Set(rowSelection?.selectedIds ?? [])
  const allSelected = ids.length > 0 && ids.every((id) => selected.has(id))

  if (loading) return <LoadingState />
  if (error) return <ErrorState message={error.message} onRetry={error.onRetry} />
  if (rows.length === 0) {
    return <EmptyState title={empty.title} description={empty.description} action={empty.action} />
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>{toolbar}</div>
        {columnVisibility ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm">
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {columns.map((col) => (
                <DropdownMenuCheckboxItem
                  key={col.id}
                  checked={!hidden.has(col.id)}
                  onCheckedChange={(checked) => {
                    const next = new Set(hidden)
                    if (checked) next.delete(col.id)
                    else next.add(col.id)
                    columnVisibility.onChange([...next])
                  }}
                >
                  {col.header}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {rowSelection ? (
                <TableHead>
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={(checked) => {
                      rowSelection.onChange(checked ? ids : [])
                    }}
                    aria-label="Select all rows"
                  />
                </TableHead>
              ) : null}
              {visibleCols.map((col) => (
                <TableHead key={col.id}>
                  {col.sortable ? (
                    <button
                      type="button"
                      className="font-medium"
                      onClick={() => onSortingChange?.(nextSorting(sorting, col.id))}
                    >
                      {col.header}
                      {sorting?.id === col.id ? (sorting.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </button>
                  ) : (
                    col.header
                  )}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const id = getRowId(row)
              return (
                <TableRow key={id} data-state={selected.has(id) ? 'selected' : undefined}>
                  {rowSelection ? (
                    <TableCell>
                      <Checkbox
                        checked={selected.has(id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(selected)
                          if (checked) next.add(id)
                          else next.delete(id)
                          rowSelection.onChange([...next])
                        }}
                        aria-label={`Select ${id}`}
                      />
                    </TableCell>
                  ) : null}
                  {visibleCols.map((col) => (
                    <TableCell key={col.id}>{col.cell(row)}</TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
      {pagination.mode === 'page' ? (
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => pagination.onPageChange(pagination.page - 1)}
          >
            Previous
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={pageNextParam(pagination) === undefined}
            onClick={() => pagination.onPageChange(pagination.page + 1)}
          >
            Next
          </Button>
        </div>
      ) : cursorNextParam({ nextCursor: pagination.nextCursor }) ? (
        <Button
          type="button"
          variant="outline"
          loading={pagination.isFetchingMore}
          onClick={pagination.onLoadMore}
        >
          Load more
        </Button>
      ) : null}
    </div>
  )
}
