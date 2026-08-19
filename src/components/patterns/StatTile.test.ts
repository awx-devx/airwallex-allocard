import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

describe('StatTile', () => {
  const src = readFileSync(join(process.cwd(), 'src/components/patterns/StatTile.tsx'), 'utf8')

  it('is a compact fact cell, not a padded Card', () => {
    expect(src).toContain('px-3 py-2.5')
    expect(src).toContain('min-w-0')
    expect(src).not.toContain('<Card')
    expect(src).not.toContain('py-6')
    expect(src).not.toMatch(/\bsm:/)
    expect(src).not.toMatch(/\blg:/)
  })

  it('replaces skinny Cards on overview, card detail, org report, and catalogue', () => {
    const overview = readFileSync(
      join(process.cwd(), 'src/app/(app)/projects/[id]/ProjectOverview.tsx'),
      'utf8',
    )
    const card = readFileSync(
      join(process.cwd(), 'src/app/(app)/cards/[id]/CardDetail.tsx'),
      'utf8',
    )
    const org = readFileSync(
      join(process.cwd(), 'src/app/(app)/reports/organization/OrganizationReport.tsx'),
      'utf8',
    )
    const catalogue = readFileSync(
      join(process.cwd(), 'src/app/(app)/reports/ReportCatalogue.tsx'),
      'utf8',
    )
    expect(overview).toContain('<StatTile')
    expect(overview).toContain('md:grid-cols-3')
    expect(card).toContain('<StatTile')
    expect(org).toContain('<StatTile')
    expect(catalogue).toContain('<StatTile')
  })
})
