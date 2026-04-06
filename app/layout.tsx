import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import AuthShell from './components/AuthShell'

export const metadata: Metadata = {
  title: 'MHD CRM — Mauritius Holidays Direct',
  description: 'Sales CRM for Mauritius Holidays Direct',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AuthShell>{children}</AuthShell>
        </Providers>
      </body>
    </html>
  )
}
