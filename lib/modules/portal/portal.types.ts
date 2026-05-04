// ── Portal types ───────────────────────────────────────────
// Only booking-side operational data. No quotes, no deals.

export type PassportStatus = 'pending' | 'uploaded' | 'needs_attention' | 'checked'
export type RequestCategory = 'room' | 'dietary' | 'celebration' | 'accessibility' | 'general'
export type RequestStatus = 'submitted' | 'seen' | 'actioned'
export type NotificationType = 'balance_reminder' | 'passport_reminder' | 'documents_coming' | 'countdown' | 'general'

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  submitted: 'Submitted',
  seen:      'In progress',
  actioned:  'Arranged',
}

export const REQUEST_CATEGORY_LABEL: Record<RequestCategory, string> = {
  room:          'Room request',
  dietary:       'Dietary requirements',
  celebration:   'Special celebration',
  accessibility: 'Accessibility needs',
  general:       'General request',
}

export const PASSPORT_STATUS_LABEL: Record<PassportStatus, string> = {
  pending:          'Please upload your passport copy',
  uploaded:         'Received — under review by our team',
  needs_attention:  'Please contact your consultant',
  checked:          'Passport confirmed',
}

// ── View types returned to portal components ───────────────
// No internal fields (gross_profit, final_profit, issue_note, payment_method, deal_id, etc.)

export type PortalPassengerView = {
  id: number
  first_name: string
  last_name: string
  passenger_type: string
  is_lead: boolean
  passport: {
    status: PassportStatus
    uploaded_at: string | null
  }
}

export type PortalAccommodationView = {
  hotel_name: string
  checkin_date: string | null
  checkout_date: string | null
  nights: number | null
  room_type: string | null
  board_basis: string | null
}

export type PortalFlightView = {
  direction: string
  leg_order: number
  airline: string | null
  flight_number: string | null
  origin: string | null
  destination: string | null
  departure_date: string | null
  departure_time: string | null
  arrival_date: string | null
  arrival_time: string | null
  cabin_class: string | null
}

export type PortalTransferView = {
  transfer_type: string | null
  supplier_name: string | null
  meet_greet: boolean
  local_rep: boolean
  arrival_date: string | null
  arrival_time: string | null
  arrival_flight: string | null
  departure_date: string | null
  departure_time: string | null
  departure_flight: string | null
  notes: string | null
}

export type PortalConsultantView = {
  name: string
  email: string | null
  profile_photo_url: string | null
}

export type PortalBalanceView = {
  total_sell: number
  total_paid: number
  balance_due: number
  balance_due_date: string | null
  overpayment: number
}

export type PortalRequestView = {
  id: string
  category: RequestCategory
  category_label: string
  message: string
  status_label: string
  created_at: string
}

export type PortalNotificationView = {
  id: string
  type: NotificationType
  body: string
  scheduled_for: string
  read_at: string | null
}

export type PortalBookingView = {
  booking_reference: string
  destination: string | null
  departure_date: string | null
  return_date: string | null
  booking_notes: string | null
  consultant: PortalConsultantView | null
  accommodation: PortalAccommodationView[]
  flights: PortalFlightView[]
  transfers: PortalTransferView[]
  passengers: PortalPassengerView[]
  balance: PortalBalanceView
  requests: PortalRequestView[]
  notifications: PortalNotificationView[]
}

// ── Completeness gate ──────────────────────────────────────
export type PortalReadinessResult = {
  ready: boolean
  missing: { field: string; label: string; section: string }[]
}

// ── Token meta returned to CRM ─────────────────────────────
export type PortalTokenMeta = {
  active: boolean
  token: string | null
  expires_at: string | null
  revoked_at: string | null
  last_accessed_at: string | null
  portal_url: string | null
}
