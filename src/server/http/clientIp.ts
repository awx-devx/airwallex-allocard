/** Best-effort client IP for rate limiting (proxies via x-forwarded-for). */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) {
      return first
    }
  }
  const realIp = req.headers.get('x-real-ip')?.trim()
  if (realIp) {
    return realIp
  }
  return 'unknown'
}
