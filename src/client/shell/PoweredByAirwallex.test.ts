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
    expect(src).toContain('rotate-90')
    expect(src).not.toContain('useTheme')
  })

  it('peeks from the right edge with one breakpoint', () => {
    expect(src).toContain('fixed right-0')
    expect(src).toContain('z-30')
    expect(src).toContain('hover:translate-x-0')
    expect(src).toContain('focus-visible:translate-x-0')
    expect(src).toContain('[writing-mode:vertical-rl]')
    expect(src).toContain('[text-orientation:sideways]')
    expect(src).not.toContain('rotate-180')
    expect(src).not.toMatch(/\bsm:/)
    expect(src).not.toMatch(/\blg:/)
  })
})

describe('PoweredByAirwallex mount', () => {
  it('renders in AppShell and CenteredBrandFrame', () => {
    const shell = read('src/client/shell/AppShell.tsx')
    const frame = read('src/client/shell/CenteredBrandFrame.tsx')
    expect(shell).toContain("from '@/client/shell/PoweredByAirwallex'")
    expect(shell).toContain('<PoweredByAirwallex />')
    expect(frame).toContain("from '@/client/shell/PoweredByAirwallex'")
    expect(frame).toContain('<PoweredByAirwallex />')
  })
})
