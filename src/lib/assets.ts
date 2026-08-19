/**
 * Files in `public/` are served from the site root.
 *
 * - Official logomark: `public/brand/logomark.png` → `/brand/logomark.png`
 * - Wordmark outlines: `public/brand/wordmark.svg` → `/brand/wordmark.svg`
 * - Square derivatives: `public/brand/icon.png` is a cutout (transparent field) for the tab favicon; `apple-touch-icon.png` stays opaque for iOS
 * - App Router copies Next.js reads from `src/app/`: `favicon.ico` (32×32 RGBA PNG-in-ICO; paletted PNGs fail Turbopack), `icon.png`, `apple-icon.png`
 * - Everything else: `public/images/` → `/images/hero.png`
 */
export const publicAsset = {
  logomark: '/brand/logomark.png',
  wordmark: '/brand/wordmark.svg',
  icon: '/brand/icon.png',
  appleTouchIcon: '/brand/apple-touch-icon.png',
} as const
