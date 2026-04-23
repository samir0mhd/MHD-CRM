'use server'

import { supabase } from '@/lib/supabase'
import { dbMutate } from '@/lib/api-client'
import type { PassportStatus, RequestCategory, RequestStatus, NotificationType } from './portal.types'

// ── Token queries ──────────────────────────────────────────
export async function getTokenRecord(token: string) {
  const { data } = await supabase
    .from('portal_access_tokens')
    .select('id, booking_id, client_id, token, expires_at, revoked_at, created_at')
    .eq('token', token)
    .maybeSingle()
  return data
}

export async function getActiveTokenByBooking(bookingId: number) {
  const { data } = await supabase
    .from('portal_access_tokens')
    .select('id, token, expires_at, revoked_at, created_at')
    .eq('booking_id', bookingId)
    .is('revoked_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function insertPortalToken(values: {
  booking_id: number
  client_id: number
  expires_at: string
  created_by_staff_id: number | null
}) {
  return dbMutate<{ id: string; token: string }>({
    table: 'portal_access_tokens',
    action: 'insert',
    values,
    select: 'id, token',
    returning: 'single',
  })
}

export async function revokePortalToken(tokenId: string) {
  return dbMutate({
    table: 'portal_access_tokens',
    action: 'update',
    values: { revoked_at: new Date().toISOString() },
    filters: [{ column: 'id', value: tokenId }],
  })
}

export async function revokeAllBookingTokens(bookingId: number) {
  await supabase
    .from('portal_access_tokens')
    .update({ revoked_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .is('revoked_at', null)
}

// ── Booking data queries (booking-side only) ───────────────
export async function getPortalBookingData(bookingId: number) {
  const { data } = await supabase
    .from('bookings')
    .select(`
      booking_reference,
      destination,
      departure_date,
      return_date,
      booking_notes,
      total_sell,
      balance_due_date,
      staff_id,
      status
    `)
    .eq('id', bookingId)
    .single()
  return data
}

export async function getPortalConsultant(staffId: number) {
  const { data } = await supabase
    .from('staff_users')
    .select('name, email, profile_photo_url')
    .eq('id', staffId)
    .maybeSingle()
  return data
}

export async function getPortalAccommodations(bookingId: number) {
  const { data } = await supabase
    .from('booking_accommodations')
    .select('hotel_name, checkin_date, checkout_date, nights, room_type, board_basis')
    .eq('booking_id', bookingId)
    .order('stay_order', { ascending: true })
  return data || []
}

export async function getPortalFlights(bookingId: number) {
  const { data } = await supabase
    .from('booking_flights')
    .select('direction, leg_order, airline, flight_number, origin, destination, departure_date, departure_time, arrival_date, arrival_time, cabin_class')
    .eq('booking_id', bookingId)
    .order('direction', { ascending: true })
    .order('leg_order', { ascending: true })
  return data || []
}

export async function getPortalTransfers(bookingId: number) {
  const { data } = await supabase
    .from('booking_transfers')
    .select('transfer_type, supplier_name, meet_greet, local_rep, arrival_date, arrival_time, arrival_flight, departure_date, departure_time, departure_flight, notes')
    .eq('booking_id', bookingId)
    .order('arrival_date', { ascending: true })
  return data || []
}

export async function getPortalPassengers(bookingId: number) {
  const { data } = await supabase
    .from('booking_passengers')
    .select('id, first_name, last_name, passenger_type, is_lead')
    .eq('booking_id', bookingId)
    .order('is_lead', { ascending: false })
    .order('id', { ascending: true })
  return data || []
}

export async function getPaymentsTotal(bookingId: number): Promise<number> {
  const { data } = await supabase
    .from('booking_payments')
    .select('amount')
    .eq('booking_id', bookingId)
  if (!data) return 0
  return data.reduce((sum, p) => sum + Number(p.amount || 0), 0)
}

// ── Passport queries ───────────────────────────────────────
export async function getPassportUploads(bookingId: number) {
  const { data } = await supabase
    .from('passport_uploads')
    .select('id, booking_id, passenger_id, storage_path, status, uploaded_at, issue_note, checked_at, checked_by_staff_id')
    .eq('booking_id', bookingId)
  return data || []
}

export async function getPassportUpload(uploadId: string) {
  const { data } = await supabase
    .from('passport_uploads')
    .select('id, booking_id, passenger_id, status')
    .eq('id', uploadId)
    .maybeSingle()
  return data
}

export async function upsertPassportUpload(values: {
  booking_id: number
  passenger_id: number
  status: PassportStatus
  storage_path?: string
  uploaded_at?: string
}) {
  return dbMutate<{ id: string }>({
    table: 'passport_uploads',
    action: 'upsert',
    values,
    select: 'id',
    returning: 'single',
  })
}

export async function updatePassportStatus(uploadId: string, values: {
  status: PassportStatus
  issue_note?: string | null
  checked_at?: string | null
  checked_by_staff_id?: number | null
}) {
  return dbMutate({
    table: 'passport_uploads',
    action: 'update',
    values,
    filters: [{ column: 'id', value: uploadId }],
  })
}

export async function initPassportRows(bookingId: number, passengerIds: number[]) {
  const rows = passengerIds.map(passenger_id => ({
    booking_id: bookingId,
    passenger_id,
    status: 'pending' as PassportStatus,
  }))
  return dbMutate({
    table: 'passport_uploads',
    action: 'upsert',
    values: rows,
  })
}

// ── Request queries ────────────────────────────────────────
export async function getClientRequests(bookingId: number) {
  const { data } = await supabase
    .from('client_requests')
    .select('id, booking_id, category, message, status, created_at, seen_at, actioned_at, actioned_by_staff_id')
    .eq('booking_id', bookingId)
    .order('created_at', { ascending: false })
  return data || []
}

export async function insertClientRequest(values: {
  booking_id: number
  category: RequestCategory
  message: string
}) {
  return dbMutate<{ id: string }>({
    table: 'client_requests',
    action: 'insert',
    values,
    select: 'id',
    returning: 'single',
  })
}

export async function updateRequestStatus(requestId: string, values: {
  status: RequestStatus
  seen_at?: string | null
  actioned_at?: string | null
  actioned_by_staff_id?: number | null
}) {
  return dbMutate({
    table: 'client_requests',
    action: 'update',
    values,
    filters: [{ column: 'id', value: requestId }],
  })
}

// ── Notification queries ───────────────────────────────────
export async function getVisibleNotifications(bookingId: number) {
  const { data } = await supabase
    .from('portal_notifications')
    .select('id, type, body, scheduled_for, sent_at, read_at')
    .eq('booking_id', bookingId)
    .lte('scheduled_for', new Date().toISOString())
    .order('scheduled_for', { ascending: false })
  return data || []
}

export async function deleteBookingNotifications(bookingId: number) {
  return dbMutate({
    table: 'portal_notifications',
    action: 'delete',
    filters: [{ column: 'booking_id', value: bookingId }],
  })
}

export async function insertNotifications(rows: {
  booking_id: number
  type: NotificationType
  body: string
  scheduled_for: string
}[]) {
  if (rows.length === 0) return
  return dbMutate({
    table: 'portal_notifications',
    action: 'insert',
    values: rows,
  })
}

export async function markNotificationRead(notificationId: string, bookingId: number) {
  return dbMutate({
    table: 'portal_notifications',
    action: 'update',
    values: { read_at: new Date().toISOString() },
    filters: [
      { column: 'id', value: notificationId },
      { column: 'booking_id', value: bookingId },
    ],
  })
}

// ── Completeness gate raw query ────────────────────────────
export async function getBookingReadinessData(bookingId: number) {
  const [bookingRes, passengersRes, accommodationsRes] = await Promise.all([
    supabase
      .from('bookings')
      .select('destination, return_date, departure_date, total_sell, balance_due_date, staff_id, status')
      .eq('id', bookingId)
      .single(),
    supabase
      .from('booking_passengers')
      .select('id')
      .eq('booking_id', bookingId)
      .limit(1),
    supabase
      .from('booking_accommodations')
      .select('id')
      .eq('booking_id', bookingId)
      .limit(1),
  ])
  return {
    booking: bookingRes.data,
    hasPassengers: (passengersRes.data?.length ?? 0) > 0,
    hasAccommodation: (accommodationsRes.data?.length ?? 0) > 0,
  }
}
