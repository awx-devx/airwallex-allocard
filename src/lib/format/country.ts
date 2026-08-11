const displayNamesCache = new Map<string, Intl.DisplayNames>()

function getDisplayNames(locale: string): Intl.DisplayNames {
  const cached = displayNamesCache.get(locale)
  if (cached) {
    return cached
  }
  const dn = new Intl.DisplayNames([locale], { type: 'region' })
  displayNamesCache.set(locale, dn)
  return dn
}

/** ISO 3166-1 alpha-2 region name via Intl.DisplayNames. Invalid codes pass through. */
export function countryName(iso2: string, locale = 'en'): string {
  const code = iso2.trim().toUpperCase()
  if (code.length !== 2) {
    return iso2
  }
  try {
    const name = getDisplayNames(locale).of(code)
    return name ?? iso2
  } catch {
    return iso2
  }
}
