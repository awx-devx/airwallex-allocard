import { afterEach, describe, expect, it, vi } from 'vitest'
import { copyToClipboard } from '@/client/lib/clipboard'
import { toastStore } from '@/client/providers/toastStore'

describe('client/lib/clipboard', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('copyToClipboard uses navigator.clipboard and shows success toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    const success = vi.spyOn(toastStore, 'success')

    const ok = await copyToClipboard('hello')
    expect(ok).toBe(true)
    expect(writeText).toHaveBeenCalledWith('hello')
    expect(success).toHaveBeenCalledWith('Copied')
  })

  it('copyToClipboard shows error toast on failure', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    })
    const error = vi.spyOn(toastStore, 'error')

    const ok = await copyToClipboard('hello')
    expect(ok).toBe(false)
    expect(error).toHaveBeenCalledWith('Copy failed')
  })
})
