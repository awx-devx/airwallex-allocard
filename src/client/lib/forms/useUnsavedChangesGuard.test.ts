import { describe, expect, it, vi } from 'vitest'
import { syncBeforeUnload } from '@/client/lib/forms/useUnsavedChangesGuard'

describe('client/lib/forms/useUnsavedChangesGuard', () => {
  it('syncBeforeUnload does nothing when not dirty', () => {
    const event = { preventDefault: vi.fn(), returnValue: '' } as unknown as BeforeUnloadEvent
    expect(syncBeforeUnload(false, event)).toBeUndefined()
    expect(event.preventDefault).not.toHaveBeenCalled()
  })

  it('syncBeforeUnload prevents default when dirty', () => {
    const event = { preventDefault: vi.fn(), returnValue: '' } as unknown as BeforeUnloadEvent
    expect(syncBeforeUnload(true, event)).toBe('')
    expect(event.preventDefault).toHaveBeenCalled()
    expect(event.returnValue).toBe('')
  })
})
