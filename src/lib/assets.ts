/**
 * Files in `public/` are served from the site root.
 *
 * - Official logomark: `public/brand/logomark.png` → `/brand/logomark.png`
 * - Wordmark outlines: `public/brand/wordmark.svg` → `/brand/wordmark.svg`
 * - Square derivatives (favicon / apple): `public/brand/icon.png`, `apple-touch-icon.png`
 * - Everything else: `public/images/` → `/images/hero.png`
 */
export const publicAsset = {
  logomark: '/brand/logomark.png',
  wordmark: '/brand/wordmark.svg',
  icon: '/brand/icon.png',
  appleTouchIcon: '/brand/apple-touch-icon.png',
} as const
