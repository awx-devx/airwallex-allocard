/**
 * CSV row serializer + async iterable → ReadableStream (text/csv).
 * Pull-based: one row per pull so consumers never force a full materialisation.
 */

export type CsvCell = string | number | boolean | null | undefined

/** RFC 4180-ish escaping: quote when the value contains comma, quote, or newline. */
export function escapeCsvValue(value: CsvCell): string {
  if (value === null || value === undefined) {
    return ''
  }
  const s = typeof value === 'string' ? value : String(value)
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export function serializeCsvRow(values: readonly CsvCell[]): string {
  return `${values.map(escapeCsvValue).join(',')}\n`
}

export type CsvRow = ReadonlyArray<CsvCell> | Readonly<Record<string, CsvCell>>

export type RowsToCsvStreamOptions = {
  /** Called once when the iterable is exhausted (successful end). Not called on cancel. */
  onComplete?: (rowCount: number) => void | Promise<void>
}

/**
 * Build a UTF-8 `ReadableStream` of CSV: header line, then one line per row.
 * Rows may be parallel arrays (ordered by `headers`) or records keyed by header.
 */
export function rowsToCsvStream(
  headers: readonly string[],
  rows: AsyncIterable<CsvRow>,
  options: RowsToCsvStreamOptions = {},
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  const iterator = rows[Symbol.asyncIterator]()
  let headerSent = false
  let rowCount = 0
  let completed = false

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        if (!headerSent) {
          headerSent = true
          controller.enqueue(encoder.encode(serializeCsvRow(headers)))
          return
        }

        const next = await iterator.next()
        if (next.done) {
          if (!completed) {
            completed = true
            await options.onComplete?.(rowCount)
          }
          controller.close()
          return
        }

        rowCount += 1
        const row = next.value
        const values = Array.isArray(row)
          ? row
          : headers.map((h) => (row as Readonly<Record<string, CsvCell>>)[h])
        controller.enqueue(encoder.encode(serializeCsvRow(values)))
      } catch (err) {
        controller.error(err)
      }
    },
    async cancel() {
      if (typeof iterator.return === 'function') {
        await iterator.return(undefined)
      }
    },
  })
}
