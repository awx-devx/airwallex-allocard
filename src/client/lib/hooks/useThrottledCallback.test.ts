import { describe, expect, it, vi } from 'vitest'
import { createThrottledInvoker } from '@/client/lib/hooks/useThrottledCallback'

describe('client/lib/hooks/useThrottledCallback', () => {
  it('createThrottledInvoker calls on leading edge only within interval', () => {
    const fn = vi.fn()
    let now = 0
    const throttled = createThrottledInvoker(fn, 100, () => now)

    throttled('a')
    expect(fn).toHaveBeenCalledTimes(1)

    now = 50
    throttled('b')
    expect(fn).toHaveBeenCalledTimes(1)

    now = 100
    throttled('c')
    expect(fn).toHaveBeenCalledTimes(2)
    expect(fn).toHaveBeenLastCalledWith('c')
  })
})
