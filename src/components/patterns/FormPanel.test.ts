import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('FormPanel', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/patterns/FormPanel.tsx'), 'utf8')

  it('is a card with stacked fields and an optional footer', () => {
    expect(src).toContain('<Card')
    expect(src).toContain('CardContent')
    expect(src).toContain('flex min-w-0 flex-col gap-4')
    expect(src).toContain('footer')
    expect(src).toContain('border-t')
    expect(src).not.toMatch(/\bsm:/)
    expect(src).not.toMatch(/\blg:/)
  })

  it('is the form surface on wizards and page forms', () => {
    const wizard = readFileSync(
      join(process.cwd(), 'src/components/patterns/StepWizard.tsx'),
      'utf8',
    )
    const request = readFileSync(
      join(process.cwd(), 'src/app/(app)/requests/new/RequestForm.tsx'),
      'utf8',
    )
    const member = readFileSync(
      join(process.cwd(), 'src/app/(app)/projects/[id]/people/add/AddMemberForm.tsx'),
      'utf8',
    )
    const rules = readFileSync(
      join(process.cwd(), 'src/app/(app)/settings/rules/[id]/RuleBuilder.tsx'),
      'utf8',
    )
    const approval = readFileSync(
      join(process.cwd(), 'src/app/(app)/projects/[id]/controls/ApprovalRuleEditor.tsx'),
      'utf8',
    )
    const simulate = readFileSync(
      join(process.cwd(), 'src/app/(app)/settings/rules/[id]/simulate/SimulateRule.tsx'),
      'utf8',
    )
    expect(wizard).toContain('<FormPanel')
    expect(request).toContain('<FormPanel')
    expect(member).toContain('<FormPanel')
    expect(rules).toContain('<FormPanel')
    expect(approval).toContain('<FormPanel')
    expect(simulate).toContain('<FormPanel')
  })
})
