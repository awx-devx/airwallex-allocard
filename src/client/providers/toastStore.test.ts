import { describe, expect, it } from 'vitest'
import { toastStore } from '@/client/providers/toastStore'

describe('toastStore', () => {
  it('pushes and clears toasts', () => {
    toastStore.clear()
    toastStore.success('ok')
    toastStore.error('bad')
    expect(toastStore.getSnapshot()).toHaveLength(2)
    const id = toastStore.getSnapshot()[0]!.id
    toastStore.dismiss(id)
    expect(toastStore.getSnapshot()).toHaveLength(1)
    toastStore.clear()
    expect(toastStore.getSnapshot()).toHaveLength(0)
  })

  it('returns a cached empty snapshot for SSR', () => {
    expect(toastStore.getServerSnapshot()).toBe(toastStore.getServerSnapshot())
    expect(toastStore.getServerSnapshot()).toEqual([])
  })
})
