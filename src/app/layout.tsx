import type { Metadata } from 'next'
import { AppProviders } from '@/client/providers/AppProviders'
import './globals.css'

export const metadata: Metadata = {
  title: 'Allocard',
  description: 'Dynamic attribute-based budget cards on Airwallex',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  )
}
