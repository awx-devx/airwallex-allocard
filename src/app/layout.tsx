import type { Metadata } from 'next'
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
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
