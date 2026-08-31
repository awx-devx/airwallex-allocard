import type { Metadata, Viewport } from 'next'
import { AppProviders } from '@/client/providers/AppProviders'
import { satoshiBlack } from '@/app/fonts'
import { loadServerEnv } from '@/server/env'
import './globals.css'

const title = 'Allocard | Powered by Airwallex'
const description =
  'Demo of Allocard on Airwallex Issuing: launch projects, derive card limits from budget, roles, and rules, issue and freeze cards, run approvals, and reconcile spend. Airwallex enforces; Allocard decides. Powered by Airwallex.'
const ogImage = {
  url: '/images/og-image.png',
  width: 1920,
  height: 1008,
  alt: 'Allocard',
}

export const metadata: Metadata = {
  metadataBase: new URL(loadServerEnv().AUTH_URL),
  applicationName: 'Allocard',
  title: {
    default: title,
    template: '%s · Allocard',
  },
  description,
  openGraph: {
    type: 'website',
    locale: 'en',
    siteName: 'Allocard',
    title,
    description,
    images: [ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [ogImage.url],
  },
  appleWebApp: {
    capable: true,
    title: 'Allocard',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#e9eaec' },
    { media: '(prefers-color-scheme: dark)', color: '#101113' },
  ],
  colorScheme: 'light dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={satoshiBlack.variable} suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
