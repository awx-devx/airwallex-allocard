import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('PoweredByAirwallex', () => {
  const src = read('src/client/shell/PoweredByAirwallex.tsx')

  it('opens the Airwallex site in a new tab', () => {
    expect(src).toContain('href={AIRWALLEX_SITE_URL}')
    expect(src).toContain("AIRWALLEX_SITE_URL = 'https://www.airwallex.com'")
    expect(src).toContain('target="_blank"')
    expect(src).toContain('rel="noopener noreferrer"')
    expect(src).toContain('aria-label="Powered by Airwallex (opens in a new tab)"')
  })

  it('swaps lockups with the html.dark class, not useTheme', () => {
    expect(src).toContain('publicAsset.airwallexLight')
    expect(src).toContain('publicAsset.airwallexDark')
    expect(src).toContain('dark:hidden')
    expect(src).toContain('dark:inline')
    expect(src).not.toContain('useTheme')
  })

  it('is a horizontal tab hanging off its parent, with one breakpoint', () => {
    expect(src).toContain('absolute top-full')
    expect(src).toContain('items-center')
    expect(src).toContain('rounded-b-md')
    expect(src).toContain('border-t-0')
    expect(src).not.toContain('fixed')
    expect(src).not.toContain('rotate-90')
    expect(src).not.toContain('writing-mode')
    expect(src).not.toMatch(/\bsm:/)
    expect(src).not.toMatch(/\blg:/)
  })
})

describe('PoweredByAirwallex mount', () => {
  it('hangs off AppHeader and the pre-shell form column', () => {
    const header = read('src/client/shell/AppHeader.tsx')
    const shell = read('src/client/shell/AppShell.tsx')
    const frame = read('src/client/shell/CenteredBrandFrame.tsx')
    expect(header).toContain("from '@/client/shell/PoweredByAirwallex'")
    expect(header).toContain('<PoweredByAirwallex />')
    expect(header.indexOf('<PoweredByAirwallex />')).toBeLessThan(
      header.indexOf('bg-background/95'),
    )
    expect(shell).not.toContain('PoweredByAirwallex')
    expect(frame).toContain("from '@/client/shell/PoweredByAirwallex'")
    expect(frame).toContain('<PoweredByAirwallex />')
    expect(frame).toContain('{children}')
  })
})
