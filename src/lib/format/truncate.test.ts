import { describe, expect, it } from 'vitest'
import { truncate } from '@/lib/format/truncate'

describe('lib/format/truncate', () => {
  it('returns as-is when within maxLen', () => {
    expect(truncate('hello', 10)).toEqual({
      text: 'hello',
      truncated: false,
      title: 'hello',
    })
  })

  it('truncates with ellipsis and preserves full title', () => {
    expect(truncate('hello world', 8)).toEqual({
      text: 'hello w…',
      truncated: true,
      title: 'hello world',
    })
  })
})
