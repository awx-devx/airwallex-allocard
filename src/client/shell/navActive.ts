/** `/projects/x/y` selects `/projects`, not a shorter sibling prefix like `/project`. */
export function isNavHrefActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function activeNavHref(pathname: string, hrefs: readonly string[]): string | undefined {
  let best: string | undefined
  for (const href of hrefs) {
    if (!isNavHrefActive(pathname, href)) continue
    if (!best || href.length > best.length) best = href
  }
  return best
}
