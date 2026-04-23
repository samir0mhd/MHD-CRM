import type { PortalBookingView } from '@/lib/modules/portal/portal.types'

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function fmtShort(d: string | null) {
  if (!d) return null
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export default function BookingHero({ booking }: { booking: PortalBookingView }) {
  const hotel = booking.accommodation[0]
  const depShort = fmtShort(booking.departure_date)
  const retShort = fmtShort(booking.return_date)
  const nights = hotel?.nights ?? null

  return (
    <div style={{ padding: '28px 20px 24px', background: '#fff' }}>
      {/* Status pill */}
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ecfdf5', color: '#059669', fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 20, marginBottom: 16, letterSpacing: '0.04em' }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
        Booking Confirmed
      </div>

      {/* Destination */}
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: '0 0 4px', color: '#111827', lineHeight: 1.2 }}>
        {booking.destination ?? 'Your trip'}
      </h1>

      {/* Hotel */}
      {hotel && (
        <p style={{ fontSize: 15, color: '#374151', margin: '0 0 16px', fontWeight: 500 }}>
          {hotel.hotel_name}
          {hotel.board_basis && <span style={{ color: '#9ca3af', fontWeight: 400 }}> · {hotel.board_basis}</span>}
          {hotel.room_type && <span style={{ color: '#9ca3af', fontWeight: 400 }}> · {hotel.room_type}</span>}
        </p>
      )}

      {/* Dates row */}
      {(depShort || retShort) && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' as const }}>
          {depShort && retShort && (
            <span style={{ fontSize: 14, color: '#4b5563', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 12px' }}>
              {depShort} — {retShort}
              {nights && <span style={{ color: '#9ca3af' }}> · {nights} nights</span>}
            </span>
          )}
        </div>
      )}

      {/* Notes */}
      {booking.booking_notes && (
        <p style={{ marginTop: 16, fontSize: 14, color: '#6b7280', lineHeight: 1.6, padding: '12px 14px', background: '#f9fafb', borderRadius: 8, borderLeft: '3px solid #e5e7eb' }}>
          {booking.booking_notes}
        </p>
      )}
    </div>
  )
}
