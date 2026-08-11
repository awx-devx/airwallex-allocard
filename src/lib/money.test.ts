import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  formatMoney,
  formatMoneyCompact,
  majorToMinor,
  minorToMajor,
  parseMoneyInput,
  percentOf,
} from '@/lib/money'

describe('lib/money', () => {
  it('formats USD and EUR with cents', () => {
    expect(formatMoney({ amount: 402350, currency: 'USD' }, 'en-US')).toBe('$4,023.50')
    expect(formatMoney({ amount: 100, currency: 'EUR' }, 'en-US')).toMatch(/1\.00/)
  })

  it('formats JPY/KRW without a decimal fraction', () => {
    const jpy = formatMoney({ amount: 1234, currency: 'JPY' }, 'en-US')
    expect(jpy).not.toMatch(/\.\d/)
    expect(jpy).toMatch(/1,234/)

    const krw = formatMoney({ amount: 5000, currency: 'KRW' }, 'en-US')
    expect(krw).not.toMatch(/\.\d/)
  })

  it('formatMoneyCompact uses compact notation', () => {
    const compact = formatMoneyCompact({ amount: 402350, currency: 'USD' }, 'en-US')
    expect(compact).toMatch(/\$4(\.\d+)?K/i)
  })

  it('round-trips USD via parse after stripping currency/grouping from format', () => {
    const money = { amount: 402350, currency: 'USD' }
    const formatted = formatMoney(money, 'en-US')
    const stripped = formatted.replace(/[^0-9.,-]/g, '')
    expect(parseMoneyInput(stripped, 'USD')).toEqual(money)
  })

  it('parses JPY/KRW as identity minor units and rejects fractions', () => {
    expect(parseMoneyInput('1234', 'JPY')).toEqual({ amount: 1234, currency: 'JPY' })
    expect(parseMoneyInput('5000', 'KRW')).toEqual({ amount: 5000, currency: 'KRW' })
    expect(() => parseMoneyInput('12.5', 'JPY')).toThrow('Invalid money input')
  })

  it('rejects empty or malformed input', () => {
    expect(() => parseMoneyInput('', 'USD')).toThrow('Invalid money input')
    expect(() => parseMoneyInput('abc', 'USD')).toThrow('Invalid money input')
    expect(() => parseMoneyInput('1.2.3', 'USD')).toThrow('Invalid money input')
  })

  it('percentOf is integer-safe and handles zero denominator', () => {
    expect(percentOf(1, 0)).toBe(0)
    expect(percentOf(50, 200)).toBe(25)
    expect(percentOf(250, 200)).toBe(125)
  })

  it('majorToMinor / minorToMajor match Airwallex mapping maths', () => {
    expect(minorToMajor(400_000, 'USD')).toBe(4000)
    expect(majorToMinor(4000, 'USD')).toBe(400_000)
    expect(minorToMajor(1234, 'JPY')).toBe(1234)
    expect(majorToMinor(1234, 'JPY')).toBe(1234)
  })

  it('does not call parseFloat in the implementation', () => {
    const source = readFileSync(path.join(import.meta.dirname, 'money.ts'), 'utf8')
    expect(source).not.toMatch(/parseFloat\s*\(/)
  })
})
