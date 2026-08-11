import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { debounceValue } from '@/client/lib/hooks/useDebouncedValue'

describe('client/lib/hooks/useDebouncedValue', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('debounceValue returns immediately when delay elapsed', () => {
    const result = debounceValue('b', 300, 1000, 600)
    expect(result.value).toBe('b')
    expect(result.shouldSchedule).toBe(false)
  })

  it('debounceValue indicates scheduling while within delay window', () => {
    const result = debounceValue('b', 300, 700, 600)
    expect(result.shouldSchedule).toBe(true)
  })
})
