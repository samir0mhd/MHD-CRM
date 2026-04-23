import type { ReactNode } from 'react'

export const metadata = { title: 'Your Booking — Mauritius Holidays Direct' }

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body style={{ margin: 0, background: '#f8f7f4', fontFamily: "'Inter', -apple-system, sans-serif", color: '#1a1a1a' }}>
        {children}
      </body>
    </html>
  )
}
