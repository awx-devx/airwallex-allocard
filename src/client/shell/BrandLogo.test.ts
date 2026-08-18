import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function read(rel: string) {
  return readFileSync(join(root, rel), 'utf8')
}

describe('BrandLogo', () => {
  const src = read('src/client/shell/BrandLogo.tsx')

  it('pairs the official logomark with the Satoshi Black SVG wordmark', () => {
    expect(src).toContain('publicAsset.logomark')
    expect(src).toContain("from '@/client/shell/BrandWordmark'")
    expect(src).toContain('aria-label="Allocard"')
    expect(src).not.toContain('truncate')
    expect(src).not.toContain('font-brand')
  })

  it('keeps lg as a larger row lockup for auth', () => {
    expect(src).not.toContain('flex-col')
    expect(src).toContain('h-[1em]')
    expect(src).toContain('h-[0.75em]')
  })
})

describe('BrandWordmark', () => {
  const src = read('src/client/shell/BrandWordmark.tsx')

  it('is an SVG path lockup that follows currentColor', () => {
    expect(src).toContain('viewBox="0 0 3984 767"')
    expect(src).toContain('fill="currentColor"')
    expect(src).toContain('<path d=')
  })
})

describe('CenteredBrandFrame', () => {
  const src = read('src/client/shell/CenteredBrandFrame.tsx')

  it('centers BrandLogo above a max-w-md pre-shell column', () => {
    expect(src).toContain("from '@/client/shell/BrandLogo'")
    expect(src).toContain('justify-center')
    expect(src).toContain('max-w-md')
    expect(src).toContain('px-4')
  })
})

describe('pre-shell layouts', () => {
  it.each([
    'src/app/(auth)/layout.tsx',
    'src/app/(onboarding)/layout.tsx',
    'src/app/(invite)/layout.tsx',
  ])('wraps %s in CenteredBrandFrame', (rel) => {
    expect(read(rel)).toContain("from '@/client/shell/CenteredBrandFrame'")
  })

  it('loads the lockup eagerly at lg on the auth layout', () => {
    const src = read('src/app/(auth)/layout.tsx')
    expect(src).toContain('priority')
    expect(src).toContain('size="lg"')
  })
})

describe('PatternGallery', () => {
  it('shows a BrandLogo specimen', () => {
    const src = read('src/app/dev/ui/PatternGallery.tsx')
    expect(src).toContain("from '@/client/shell/BrandLogo'")
    expect(src).toContain('<BrandLogo />')
  })
})
