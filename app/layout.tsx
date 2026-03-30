import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import Sidebar from './components/Sidebar'

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
          <div className="main-layout">
            <Sidebar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  )
}
