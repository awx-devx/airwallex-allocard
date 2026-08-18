import localFont from 'next/font/local'

/** Satoshi Black (ITF / Fontshare). Brand wordmark only — not UI body type. */
export const satoshiBlack = localFont({
  src: './fonts/Satoshi-Black.woff2',
  weight: '900',
  style: 'normal',
  display: 'swap',
  variable: '--font-satoshi',
  preload: true,
})
