import type { Metadata, Viewport } from 'next'
import { AppProviders } from '@/client/providers/AppProviders'
import { satoshiBlack } from '@/app/fonts'
import { loadServerEnv } from '@/server/env'
import './globals.css'

const description = 'Dynamic attribute-based budget cards on Airwallex'

export const metadata: Metadata = {
  metadataBase: new URL(loadServerEnv().AUTH_URL),
  applicationName: 'Allocard',
  title: {
    default: 'Allocard',
    template: '%s · Allocard',
  },
  description,
  openGraph: {
    type: 'website',
    locale: 'en',
    siteName: 'Allocard',
    title: 'Allocard',
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Allocard',
    description,
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
