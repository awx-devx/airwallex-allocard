/**
 * Date formatting for ISO 8601 wire strings.
 * Default locale: en-GB (day-month-year, e.g. "1 Aug 2026").
 */
const DEFAULT_LOCALE = 'en-GB'

export function formatDate(iso: string, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatDateTime(iso: string, locale = DEFAULT_LOCALE): string {
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

export function formatRelative(iso: string, now: Date = new Date()): string {
  const target = new Date(iso).getTime()
  const base = now.getTime()
  const diffSec = Math.round((target - base) / 1000)
  const abs = Math.abs(diffSec)
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

  if (abs < 60) {
    return rtf.format(diffSec, 'second')
  }
  const diffMin = Math.round(diffSec / 60)
  if (Math.abs(diffMin) < 60) {
    return rtf.format(diffMin, 'minute')
  }
  const diffHour = Math.round(diffSec / 3600)
  if (Math.abs(diffHour) < 24) {
    return rtf.format(diffHour, 'hour')
  }
  const diffDay = Math.round(diffSec / 86400)
  if (Math.abs(diffDay) < 30) {
    return rtf.format(diffDay, 'day')
  }
  const diffMonth = Math.round(diffSec / (86400 * 30))
  if (Math.abs(diffMonth) < 12) {
    return rtf.format(diffMonth, 'month')
  }
  return rtf.format(Math.round(diffSec / (86400 * 365)), 'year')
}

/**
 * Inclusive calendar range with an en dash.
 * Same calendar year → omit year on the start date.
 */
export function formatRange(fromIso: string, toIso: string, locale = DEFAULT_LOCALE): string {
  const from = new Date(fromIso)
  const to = new Date(toIso)
  const sameYear = from.getUTCFullYear() === to.getUTCFullYear()
  const start = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  }).format(from)
  const end = formatDate(toIso, locale)
  return `${start} – ${end}`
}

/**
 * Whole UTC calendar-day difference from `now` to the target date
 * (trunc toward zero of (targetUTCMidnight - nowUTCMidnight) / 86400000).
 * Negative when the target day is in the past.
 */
export function daysRemaining(iso: string, now: Date = new Date()): number {
  const target = new Date(iso)
  const targetUtc = Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), target.getUTCDate())
  const nowUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  return Math.trunc((targetUtc - nowUtc) / 86_400_000)
}

/**
 * Attribute staleness — identical to server `attributes/resolve.isStale`.
 * `ttlSec === null` → never stale.
 */
export function isStale(
  observedAt: string,
  ttlSec: number | null,
  now: Date = new Date(),
): boolean {
  if (ttlSec === null) {
    return false
  }
  return new Date(observedAt).getTime() + ttlSec * 1000 < now.getTime()
}
