import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/client/api/errors'
import { downloadExport } from '@/client/api/download'
import { ErrorCode } from '@/shared/enums/errors'

describe('downloadExport', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('POSTs JSON with credentials and org header on OK', async () => {
    const blob = new Blob(['a,b\n1,2\n'], { type: 'text/csv' })
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(blob, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="budget.csv"',
        },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    // Node test env has no document — download trigger is a no-op there.
    await downloadExport('budget', { projectId: 'p1' }, { orgId: 'o1' })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/exports/budget',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'x-org-id': 'o1',
        }),
        body: JSON.stringify({ projectId: 'p1' }),
      }),
    )
  })

  it('throws ApiError on non-OK envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { code: ErrorCode.NOT_FOUND, message: 'nope' } }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(downloadExport('cards', {})).rejects.toBeInstanceOf(ApiError)
  })
})
