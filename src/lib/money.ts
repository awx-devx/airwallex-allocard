/**
 * Money display and parsing — integer minor units only.
 * All UI money arithmetic must go through this module (F2 policy #7).
 * Never use parseFloat on an amount field; never hardcode ÷100 (use currencyExponent).
 */
import { currencyExponent } from '@/shared/constants/currency'
import type { Money } from '@/shared/schemas/base'

export function minorToMajor(amountMinor: number, currency: string): number {
  const exp = currencyExponent(currency)
  if (exp === 0) {
    return amountMinor
  }
  return amountMinor / 100
}

export function majorToMinor(amountMajor: number, currency: string): number {
  const exp = currencyExponent(currency)
  if (exp === 0) {
    return Math.round(amountMajor)
  }
  return Math.round(amountMajor * 100)
}

export function formatMoney(money: Money, locale = 'en-US'): string {
  const major = minorToMajor(money.amount, money.currency)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
  }).format(major)
}

export function formatMoneyCompact(money: Money, locale = 'en-US'): string {
  const major = minorToMajor(money.amount, money.currency)
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: money.currency,
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 2,
  }).format(major)
}

/**
 * Parse a user-entered major-unit string into integer minor units.
 * Strips spaces and `,` grouping; uses `.` as the decimal separator.
 * Zero-decimal currencies reject a fractional part.
 */
export function parseMoneyInput(raw: string, currency: string): Money {
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    throw new Error('Invalid money input')
  }

  const normalised = trimmed.replace(/[\s,]/g, '')
  if (normalised.length === 0 || normalised === '-' || normalised === '.') {
    throw new Error('Invalid money input')
  }

  const exp = currencyExponent(currency)
  if (exp === 0) {
    if (normalised.includes('.')) {
      throw new Error('Invalid money input')
    }
    if (!/^-?\d+$/.test(normalised)) {
      throw new Error('Invalid money input')
    }
    const amount = Number(normalised)
    if (!Number.isFinite(amount) || !Number.isInteger(amount)) {
      throw new Error('Invalid money input')
    }
    return { amount, currency: currency.toUpperCase() }
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalised)) {
    throw new Error('Invalid money input')
  }
  const major = Number(normalised)
  if (!Number.isFinite(major)) {
    throw new Error('Invalid money input')
  }
  const amount = majorToMinor(major, currency)
  if (!Number.isInteger(amount)) {
    throw new Error('Invalid money input')
  }
  return { amount, currency: currency.toUpperCase() }
}

/** Integer-safe percent: trunc((spent * 100) / total); 0 when total <= 0. */
export function percentOf(spent: number, total: number): number {
  if (total <= 0) {
    return 0
  }
  return Math.trunc((spent * 100) / total)
}
