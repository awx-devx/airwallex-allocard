import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('FormItem', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/ui/form.tsx'), 'utf8')

  it('does not stretch beside a sibling with helper text', () => {
    expect(src).toContain('content-start')
    expect(src).toContain('self-start')
    expect(src).toContain('FormDescription')
  })
})
