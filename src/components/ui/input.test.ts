import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('Input / Textarea field edge', () => {
  const input = readFileSync(join(process.cwd(), 'src/components/ui/input.tsx'), 'utf8')
  const textarea = readFileSync(join(process.cwd(), 'src/components/ui/textarea.tsx'), 'utf8')

  it('uses a real border-input like SelectTrigger, not a fake hsl(var(--border)) ring', () => {
    for (const src of [input, textarea]) {
      expect(src).toContain('border-input')
      expect(src).not.toContain('border-0 bg-')
      expect(src).not.toContain('hsl(var(--border)')
    }
  })
})
