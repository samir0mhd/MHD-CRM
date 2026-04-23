'use client'

import type React from 'react'
import type { PortalBookingView } from '@/lib/modules/portal/portal.types'
import BookingHero from './BookingHero'
import ConsultantCard from './ConsultantCard'
import BalanceSection from './BalanceSection'
import PassengersSection from './PassengersSection'
import RequestsSection from './RequestsSection'
import NotificationsTimeline from './NotificationsTimeline'

const S = {
  wrap: { maxWidth: 480, margin: '0 auto', paddingBottom: 48 } as React.CSSProperties,
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 10 } as React.CSSProperties,
  brand: { fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', color: '#1a3a5c', textTransform: 'uppercase' as const },
  ref: { fontSize: 12, color: '#9ca3af' },
  body: { padding: '0 0 24px' },
  divider: { height: 8, background: '#f3f0ec', margin: '0' },
}

export default function PortalShell({ booking, token }: { booking: PortalBookingView; token: string }) {
  return (
    <div style={S.wrap}>
      <header style={S.header}>
        <span style={S.brand}>Mauritius Holidays Direct</span>
        <span style={S.ref}>{booking.booking_reference}</span>
      </header>

      <div style={S.body}>
        <BookingHero booking={booking} />
        <div style={S.divider} />

        {booking.consultant && (
          <>
            <ConsultantCard consultant={booking.consultant} />
            <div style={S.divider} />
          </>
        )}

        {booking.balance.total_sell > 0 && (
          <>
            <BalanceSection balance={booking.balance} />
            <div style={S.divider} />
          </>
        )}

        <PassengersSection passengers={booking.passengers} token={token} />
        <div style={S.divider} />

        <RequestsSection requests={booking.requests} token={token} />
        <div style={S.divider} />

        {booking.notifications.length > 0 && (
          <NotificationsTimeline notifications={booking.notifications} token={token} />
        )}
      </div>
    </div>
  )
}
