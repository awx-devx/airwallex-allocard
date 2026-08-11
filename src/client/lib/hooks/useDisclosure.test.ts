import { describe, expect, it } from 'vitest'
import { disclosureReducer } from '@/client/lib/hooks/useDisclosure'

describe('client/lib/hooks/useDisclosure', () => {
  it('disclosureReducer opens, closes, toggles, and sets explicitly', () => {
    expect(disclosureReducer(false, 'open')).toBe(true)
    expect(disclosureReducer(true, 'close')).toBe(false)
    expect(disclosureReducer(false, 'toggle')).toBe(true)
    expect(disclosureReducer(true, 'toggle')).toBe(false)
    expect(disclosureReducer(false, true)).toBe(true)
    expect(disclosureReducer(true, false)).toBe(false)
  })
})
