import type { Metadata } from 'next'
import { AppProviders } from '@/client/providers/AppProviders'
import { satoshiBlack } from '@/app/fonts'
import { publicAsset } from '@/lib/assets'
import { loadServerEnv } from '@/server/env'
import './globals.css'

const description = 'Dynamic attribute-based budget cards on Airwallex'

export const metadata: Metadata = {
  metadataBase: new URL(loadServerEnv().AUTH_URL),
  title: 'Allocard',
  description,
  icons: {
    icon: [{ url: publicAsset.icon, type: 'image/png', sizes: '192x192' }],
    apple: publicAsset.appleTouchIcon,
  },
  openGraph: {
    type: 'website',
    siteName: 'Allocard',
    title: 'Allocard',
    description,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Allocard',
    description,
  },
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
