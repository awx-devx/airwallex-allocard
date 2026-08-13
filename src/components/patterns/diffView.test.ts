import { describe, expect, it } from 'vitest'
import { diffEntries } from '@/components/patterns/DiffView'

describe('diffEntries', () => {
  it('marks a changed status key', () => {
    const entries = diffEntries({ status: 'ACTIVE' }, { status: 'INACTIVE' })
    expect(entries).toEqual([{ key: 'status', before: 'ACTIVE', after: 'INACTIVE', changed: true }])
  })

  it('marks identical objects unchanged', () => {
    const entries = diffEntries({ status: 'ACTIVE' }, { status: 'ACTIVE' })
    expect(entries[0]?.changed).toBe(false)
  })

  it('treats null before as added keys', () => {
    const entries = diffEntries(null, { status: 'ACTIVE' })
    expect(entries).toEqual([{ key: 'status', before: undefined, after: 'ACTIVE', changed: true }])
  })
})
