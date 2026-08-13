import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'CardVisual.tsx'), 'utf8')

describe('CardVisual PAN boundary', () => {
  it('does not mention cvv, expiry, or a 13–19 digit literal', () => {
    expect(source.toLowerCase()).not.toMatch(/cvv/)
    expect(source.toLowerCase()).not.toMatch(/expiry/)
    expect(source.toLowerCase()).not.toMatch(/expiration/)
    expect(source).not.toMatch(/\d{13,19}/)
  })
})
