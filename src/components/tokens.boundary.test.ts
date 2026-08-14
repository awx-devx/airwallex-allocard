/**
 * Boundary proof: UI layers must use design tokens, not hardcoded colours.
 * Scans components, shell, states, and /dev galleries.
 * Allowed: `src/app/globals.css` (not in scan dirs). `hsl(var(--…))` is allowed.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const SRC = path.resolve(import.meta.dirname, '..')
const SCAN_DIRS = [
  path.join(SRC, 'components'),
  path.join(SRC, 'client/shell'),
  path.join(SRC, 'client/states'),
  path.join(SRC, 'app/dev'),
]

function listSourceFiles(dir: string): string[] {
  if (!statSync(dir, { throwIfNoEntry: false })?.isDirectory()) {
    return []
  }
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      out.push(...listSourceFiles(full))
    } else if (/\.(tsx?|jsx?)$/.test(entry) && !entry.endsWith('.test.ts')) {
      out.push(full)
    }
  }
  return out
}

function relativeFromSrc(abs: string): string {
  return path.relative(path.join(SRC, '..'), abs).split(path.sep).join('/')
}

function findColorViolations(source: string): string[] {
  const hits: string[] = []
  if (/bg-\[#/.test(source)) hits.push('bg-[#')
  if (/bg-red-/.test(source)) hits.push('bg-red-')
  if (/text-gray-/.test(source)) hits.push('text-gray-')
  if (/rgb\(/.test(source)) hits.push('rgb(')
  if (/hsl\((?!var\(--)/.test(source)) hits.push('hsl(')
  if (/['"`]#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})['"`]/.test(source)) {
    hits.push('hex')
  }
  if (/style=\{\{[^}]*#[0-9A-Fa-f]{3,8}/.test(source)) {
    hits.push('hex-in-style')
  }
  return hits
}

describe('components/tokens.boundary', () => {
  it('detects hardcoded colours (proof logic)', () => {
    expect(findColorViolations('className="bg-[#fff]"')).toContain('bg-[#')
    expect(findColorViolations("style={{ color: '#666' }}")).toContain('hex')
    expect(findColorViolations('className="bg-red-500"')).toContain('bg-red-')
    expect(findColorViolations('className="text-gray-900"')).toContain('text-gray-')
    expect(findColorViolations('color: rgb(0, 0, 0)')).toContain('rgb(')
    expect(findColorViolations('color: hsl(0 0% 10%)')).toContain('hsl(')
    expect(findColorViolations('bg-[hsl(var(--background))]')).toEqual([])
    expect(findColorViolations('href="#pagination"')).toEqual([])
    expect(findColorViolations('className="bg-background text-foreground"')).toEqual([])
  })

  it('components, shell, states, and /dev use tokens only', () => {
    const violations: { file: string; smells: string[] }[] = []

    for (const dir of SCAN_DIRS) {
      for (const file of listSourceFiles(dir)) {
        const source = readFileSync(file, 'utf8')
        const smells = findColorViolations(source)
        if (smells.length > 0) {
          violations.push({ file: relativeFromSrc(file), smells })
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('has one spinner and one skeleton', () => {
    const files = listSourceFiles(path.join(SRC, 'components'))
    const names = files.map((file) => path.basename(file))
    expect(names.filter((name) => name === 'spinner.tsx')).toEqual(['spinner.tsx'])
    expect(names.filter((name) => name === 'skeleton.tsx')).toEqual(['skeleton.tsx'])
  })

  it('patterns do not call toLocaleDateString', () => {
    const hits: string[] = []
    for (const file of listSourceFiles(path.join(SRC, 'components/patterns'))) {
      const source = readFileSync(file, 'utf8')
      if (source.includes('toLocaleDateString')) {
        hits.push(relativeFromSrc(file))
      }
    }
    expect(hits).toEqual([])
  })
})
