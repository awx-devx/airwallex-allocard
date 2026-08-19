import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('StepWizard', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/patterns/StepWizard.tsx'), 'utf8')

  it('renders a numbered progress rail that wraps', () => {
    expect(src).toContain('flex flex-wrap')
    expect(src).toContain('aria-label="Progress"')
    expect(src).toContain("aria-current={current ? 'step' : undefined}")
    expect(src).toContain('<CheckIcon')
    expect(src).toContain('h-px w-5')
    expect(src).toContain('i + 1')
    expect(src).toContain('(optional)')
    expect(src).not.toMatch(/\bsm:/)
    expect(src).not.toMatch(/\blg:/)
  })

  it('puts the step body and actions on FormPanel', () => {
    expect(src).toContain('<FormPanel')
    expect(src).toContain('footer={')
    expect(src).toContain('Continue')
    expect(src).toContain('Back')
  })
})
