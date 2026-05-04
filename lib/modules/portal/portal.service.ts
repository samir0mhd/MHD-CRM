import {
  getTokenRecord, getActiveTokenByBooking, insertPortalToken,
  revokeAllBookingTokens, getPortalBookingData, getPortalConsultant,
  getPortalAccommodations, getPortalFlights, getPortalTransfers,
  getPortalPassengers, getPaymentsTotal, getPassportUploads,
  getClientRequests, getVisibleNotifications, deleteBookingNotifications,
  insertNotifications, initPassportRows, getBookingReadinessData,
} from './portal.repository'
import {
  REQUEST_STATUS_LABEL, REQUEST_CATEGORY_LABEL, PASSPORT_STATUS_LABEL,
  type PortalBookingView, type PortalReadinessResult, type PortalTokenMeta,
  type NotificationType, type RequestCategory, type RequestStatus,
} from './portal.types'

const PORTAL_BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'

// ── Token validation ───────────────────────────────────────
export type TokenValidationResult =
  | { valid: true; bookingId: number; clientId: number }
  | { valid: false; reason: 'not_found' | 'revoked' | 'expired' }

export async function validatePortalToken(token: string): Promise<TokenValidationResult> {
  const record = await getTokenRecord(token)
  if (!record) return { valid: false, reason: 'not_found' }
  if (record.revoked_at) return { valid: false, reason: 'revoked' }
  if (new Date(record.expires_at) < new Date()) return { valid: false, reason: 'expired' }
  return { valid: true, bookingId: record.booking_id, clientId: record.client_id }
}

// ── Portal data assembly ───────────────────────────────────
export async function assemblePortalView(bookingId: number): Promise<PortalBookingView | null> {
  const booking = await getPortalBookingData(bookingId)
  if (!booking) return null

  const [
    consultant,
    accommodations,
    flights,
    transfers,
    passengers,
    totalPaid,
    passportUploads,
    requests,
    notifications,
  ] = await Promise.all([
    booking.staff_id ? getPortalConsultant(booking.staff_id) : null,
    getPortalAccommodations(bookingId),
    getPortalFlights(bookingId),
    getPortalTransfers(bookingId),
    getPortalPassengers(bookingId),
    getPaymentsTotal(bookingId),
    getPassportUploads(bookingId),
    getClientRequests(bookingId),
    getVisibleNotifications(bookingId),
  ])

  const passportMap = new Map(passportUploads.map(p => [p.passenger_id, p]))

  return {
    booking_reference: booking.booking_reference ?? '',
    destination:       booking.destination,
    departure_date:    booking.departure_date,
    return_date:       booking.return_date,
    booking_notes:     booking.booking_notes,

    consultant: consultant ? {
      name:              consultant.name,
      email:             consultant.email,
      profile_photo_url: consultant.profile_photo_url,
    } : null,

    accommodation: accommodations.map(a => ({
      hotel_name:    a.hotel_name,
      checkin_date:  a.checkin_date,
      checkout_date: a.checkout_date,
      nights:        a.nights,
      room_type:     a.room_type,
      board_basis:   a.board_basis,
    })),

    flights: flights.map(f => ({
      direction:      f.direction,
      leg_order:      f.leg_order,
      airline:        f.airline,
      flight_number:  f.flight_number,
      origin:         f.origin,
      destination:    f.destination,
      departure_date: f.departure_date,
      departure_time: f.departure_time,
      arrival_date:   f.arrival_date,
      arrival_time:   f.arrival_time,
      cabin_class:    f.cabin_class,
    })),

    transfers: transfers.map(t => ({
      transfer_type:    t.transfer_type,
      supplier_name:    t.supplier_name,
      meet_greet:       t.meet_greet,
      local_rep:        t.local_rep,
      arrival_date:     t.arrival_date,
      arrival_time:     t.arrival_time,
      arrival_flight:   t.arrival_flight,
      departure_date:   t.departure_date,
      departure_time:   t.departure_time,
      departure_flight: t.departure_flight,
      notes:            t.notes,
    })),

    passengers: passengers.map(p => {
      const upload = passportMap.get(p.id)
      return {
        id:             p.id,
        first_name:     p.first_name,
        last_name:      p.last_name,
        passenger_type: p.passenger_type,
        is_lead:        p.is_lead,
        passport: {
          status:      upload?.status ?? 'pending',
          uploaded_at: upload?.uploaded_at ?? null,
        },
      }
    }),

    balance: (() => {
      const effectiveSell = Math.max(0, Number(booking.total_sell ?? 0) - Number((booking as any).discount ?? 0))
      return {
        total_sell:       effectiveSell,
        total_paid:       totalPaid,
        balance_due:      Math.max(0, effectiveSell - totalPaid),
        balance_due_date: booking.balance_due_date,
        overpayment:      Math.max(0, totalPaid - effectiveSell),
      }
    })(),

    requests: requests.map(r => ({
      id:             r.id,
      category:       r.category,
      category_label: REQUEST_CATEGORY_LABEL[r.category as RequestCategory] ?? r.category,
      message:        r.message,
      status_label:   REQUEST_STATUS_LABEL[r.status as RequestStatus] ?? r.status,
      created_at:     r.created_at,
    })),

    notifications: notifications.map(n => ({
      id:            n.id,
      type:          n.type,
      body:          n.body,
      scheduled_for: n.scheduled_for,
      read_at:       n.read_at,
    })),
  }
}

// ── Completeness gate ──────────────────────────────────────
export async function checkPortalReadiness(bookingId: number): Promise<PortalReadinessResult> {
  const { booking, hasPassengers, hasAccommodation } = await getBookingReadinessData(bookingId)

  const missing: PortalReadinessResult['missing'] = []

  if (!booking) return { ready: false, missing: [{ field: 'booking', label: 'Booking not found', section: 'overview' }] }

  if (booking.status !== 'CONFIRMED')
    missing.push({ field: 'status', label: 'Booking must be confirmed', section: 'overview' })
  if (!booking.return_date)
    missing.push({ field: 'return_date', label: 'Set return date', section: 'overview' })
  if (!booking.departure_date)
    missing.push({ field: 'departure_date', label: 'Set departure date', section: 'overview' })
  if (!booking.total_sell)
    missing.push({ field: 'total_sell', label: 'Set booking total', section: 'costing' })
  if (!booking.balance_due_date)
    missing.push({ field: 'balance_due_date', label: 'Set balance due date', section: 'costing' })
  if (!booking.staff_id)
    missing.push({ field: 'staff_id', label: 'Assign a consultant', section: 'overview' })
  if (!hasPassengers)
    missing.push({ field: 'passengers', label: 'Add at least one passenger', section: 'passengers' })
  if (!hasAccommodation)
    missing.push({ field: 'accommodation', label: 'Add accommodation', section: 'accommodation' })

  return { ready: missing.length === 0, missing }
}

// ── Token management ───────────────────────────────────────
export async function generatePortalLink(
  bookingId: number,
  clientId: number,
  returnDate: string,
  staffId: number | null,
): Promise<{ portalUrl: string; expiresAt: string }> {
  // Revoke any active tokens first
  await revokeAllBookingTokens(bookingId)

  // Token expires 30 days after return date
  const expiresAt = new Date(returnDate)
  expiresAt.setDate(expiresAt.getDate() + 30)

  const { data } = await insertPortalToken({
    booking_id: bookingId,
    client_id: clientId,
    expires_at: expiresAt.toISOString(),
    created_by_staff_id: staffId,
  })

  if (!data) throw new Error('Failed to create portal token')

  // Initialise passport rows for all passengers
  const passengers = await getPortalPassengers(bookingId)
  if (passengers.length > 0) {
    await initPassportRows(bookingId, passengers.map(p => p.id))
  }

  // Build notification schedule
  await scheduleNotifications(bookingId)

  const portalUrl = `${PORTAL_BASE_URL}/portal/${data.token}`
  return { portalUrl, expiresAt: expiresAt.toISOString() }
}

export async function getPortalTokenMeta(bookingId: number): Promise<PortalTokenMeta> {
  const token = await getActiveTokenByBooking(bookingId)

  if (!token) return { active: false, token: null, expires_at: null, revoked_at: null, last_accessed_at: null, portal_url: null }

  const isExpired = new Date(token.expires_at) < new Date()

  return {
    active:           !isExpired,
    token:            token.token,
    expires_at:       token.expires_at,
    revoked_at:       token.revoked_at,
    last_accessed_at: null, // Phase 2: track last access
    portal_url:       `${PORTAL_BASE_URL}/portal/${token.token}`,
  }
}

// ── Notification schedule ──────────────────────────────────
export async function scheduleNotifications(bookingId: number) {
  const booking = await getPortalBookingData(bookingId)
  if (!booking) return

  // Clear existing scheduled (not yet sent) notifications
  await deleteBookingNotifications(bookingId)

  const now = new Date()
  const rows: { booking_id: number; type: NotificationType; body: string; scheduled_for: string }[] = []

  function addIfFuture(type: NotificationType, body: string, date: Date) {
    if (date > now) rows.push({ booking_id: bookingId, type, body, scheduled_for: date.toISOString() })
  }

  // balance_reminder: 30d, 14d, 7d before balance_due_date
  if (booking.balance_due_date && booking.total_sell) {
    const amount = `£${Number(booking.total_sell).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
    const dueDate = new Date(booking.balance_due_date)
    const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

    ;[30, 14, 7].forEach(days => {
      const d = new Date(dueDate)
      d.setDate(d.getDate() - days)
      addIfFuture('balance_reminder', `Your balance of ${amount} is due ${fmt(dueDate)}. Please contact us to arrange payment.`, d)
    })
  }

  // passport_reminder: 60d before departure
  if (booking.departure_date) {
    const dep = new Date(booking.departure_date)
    const d = new Date(dep)
    d.setDate(d.getDate() - 60)
    addIfFuture('passport_reminder', "We're still waiting for passport details for one or more travellers. Please upload them as soon as possible.", d)
  }

  // documents_coming: 14d before departure
  if (booking.departure_date) {
    const dep = new Date(booking.departure_date)
    const d = new Date(dep)
    d.setDate(d.getDate() - 14)
    addIfFuture('documents_coming', 'Your final travel documents will be with you very shortly. We look forward to seeing you off.', d)
  }

  // countdown: 3d before departure — suppressed if same day as balance/passport
  if (booking.departure_date) {
    const dep = new Date(booking.departure_date)
    const countdownDate = new Date(dep)
    countdownDate.setDate(countdownDate.getDate() - 3)

    const countdownDay = countdownDate.toDateString()
    const conflictExists = rows.some(r =>
      (r.type === 'balance_reminder' || r.type === 'passport_reminder') &&
      new Date(r.scheduled_for).toDateString() === countdownDay
    )

    if (!conflictExists) {
      addIfFuture('countdown', 'Your trip is almost here. We hope you have a truly wonderful time.', countdownDate)
    }
  }

  await insertNotifications(rows)
}
