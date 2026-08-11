import { ApiError } from '@/client/api/errors'
import { getActiveOrgId } from '@/client/providers/activeOrg'
import { exportContracts } from '@/shared/contracts/export'
import type { ExportInput } from '@/shared/types/export'

export type ExportKind = 'budget' | 'transactions' | 'cards' | 'audit'

const contracts = {
  budget: exportContracts.budget,
  transactions: exportContracts.transactions,
  cards: exportContracts.cards,
  audit: exportContracts.audit,
} as const

function filenameFromDisposition(header: string | null, kind: ExportKind): string {
  if (header) {
    const match = /filename\*?=(?:UTF-8''|")?([^\";]+)/i.exec(header)
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1].replace(/"/g, '').trim())
      } catch {
        return match[1].replace(/"/g, '').trim()
      }
    }
  }
  return `export-${kind}.csv`
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined') return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

/**
 * Streamed CSV export — do not use `call()` (JSON parse).
 * Uses fetch + credentials + x-org-id, then triggers a file download.
 */
export async function downloadExport(
  kind: ExportKind,
  input: ExportInput,
  options?: { orgId?: string; signal?: AbortSignal },
): Promise<void> {
  const contract = contracts[kind]
  const orgId = options?.orgId ?? getActiveOrgId() ?? undefined
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (orgId) headers['x-org-id'] = orgId

  const res = await fetch(contract.path, {
    method: contract.method,
    headers,
    body: JSON.stringify(input),
    credentials: 'include',
    signal: options?.signal,
  })

  if (!res.ok) {
    const errBody = await res.json().catch(() => null)
    throw ApiError.fromResponse(res.status, errBody)
  }

  const blob = await res.blob()
  const filename = filenameFromDisposition(res.headers.get('Content-Disposition'), kind)
  triggerBrowserDownload(blob, filename)
}
