/** Cursor pagination — next page param from a list response with nextCursor. */
export function cursorNextParam(last: { nextCursor: string | null }): string | undefined {
  return last.nextCursor ?? undefined
}

/** Offset pagination — next page number while items remain. */
export function pageNextParam(last: {
  page: number
  pageSize: number
  total: number
}): number | undefined {
  return last.page * last.pageSize < last.total ? last.page + 1 : undefined
}
