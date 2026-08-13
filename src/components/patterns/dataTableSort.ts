import type { DataTableSorting } from '@/components/patterns/types'

export function nextSorting(
  current: DataTableSorting | null | undefined,
  columnId: string,
): DataTableSorting | null {
  if (!current || current.id !== columnId) {
    return { id: columnId, direction: 'asc' }
  }
  if (current.direction === 'asc') {
    return { id: columnId, direction: 'desc' }
  }
  return null
}
