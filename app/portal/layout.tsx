import type { ReactNode } from 'react'

export const metadata = { title: 'Your Booking — Mauritius Holidays Direct' }

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div style={{ margin: 0, background: '#f8f7f4', fontFamily: "'Inter', -apple-system, sans-serif", color: '#1a1a1a', minHeight: '100dvh' }}>
      {children}
    </div>
  )
}
