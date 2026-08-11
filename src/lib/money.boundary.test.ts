/**
 * Boundary proof: UI layers must not perform ad-hoc money maths.
 * Scans client shell/states/app routes for parseFloat( and `/ 100` money smells.
 * Allowed: src/lib/money.ts (and server/shared — not scanned here).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOT = path.resolve(import.meta.dirname, '..')
const SCAN_DIRS = [
  path.join(ROOT, 'client/shell'),
  path.join(ROOT, 'client/states'),
  path.join(ROOT, 'app/(app)'),
]

const ALLOWED_RELATIVE = new Set(['src/lib/money.ts'])

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
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

function relativeFromRoot(abs: string): string {
  return path.relative(path.join(ROOT, '..'), abs).split(path.sep).join('/')
}

function findViolations(source: string): string[] {
  const hits: string[] = []
  if (source.includes('parseFloat(')) {
    hits.push('parseFloat(')
  }
  if (/\/\s*100/.test(source)) {
    hits.push('/ 100')
  }
  return hits
}

describe('lib/money.boundary', () => {
  it('client UI layers do not use parseFloat or / 100 for money', () => {
    const violations: { file: string; smells: string[] }[] = []

    for (const dir of SCAN_DIRS) {
      for (const file of listSourceFiles(dir)) {
        const rel = relativeFromRoot(file)
        if (ALLOWED_RELATIVE.has(rel)) {
          continue
        }
        const source = readFileSync(file, 'utf8')
        const smells = findViolations(source)
        if (smells.length > 0) {
          violations.push({ file: rel, smells })
        }
      }
    }

    expect(violations).toEqual([])
  })

  it('detects parseFloat as a money smell (proof logic)', () => {
    expect(findViolations('const x = parseFloat(amount)')).toContain('parseFloat(')
    expect(findViolations('const major = amount / 100')).toContain('/ 100')
    expect(findViolations('formatMoney(m)')).toEqual([])
  })
})
