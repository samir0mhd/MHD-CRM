import { supabase } from '@/lib/supabase'
import { dbMutate } from '@/lib/api-client'

// ── TYPES ────────────────────────────────────────────────────
export type Booking = {
  id: number
  booking_reference: string
  deal_id: number
  status: string
  booking_status: string | null
  departure_date: string | null
  return_date: string | null
  balance_due_date: string | null
  deposit_received: boolean
  destination: string | null
  total_sell: number | null
  total_net: number | null
  gross_profit: number | null
  discount: number | null
  final_profit: number | null
  booking_notes: string | null
  cc_surcharge: number | null
  balance_cleared_at: string | null
  staff_id: number | null
  created_at: string
  cancellation_type: 'deposit_only' | 'post_payment' | 'tickets_issued' | null
  cancellation_date: string | null
  cancellation_actioned_by: string | null
  cancellation_checklist: Record<string, boolean> | null
  cancellation_notes: string | null
  deals?: { id: number; title: string; deal_value: number; staff_id?: number | null; clients?: Client; activities?: Activity[] }
}

export type Activity = {
  id: number
  deal_id: number
  activity_type: string
  notes: string | null
  created_at: string
}

export type Client = { id: number; first_name: string; last_name: string; phone: string; email: string; owner_staff_id?: number | null }

export type Passenger = {
  id: number; booking_id: number; title: string; first_name: string; last_name: string
  date_of_birth: string | null; passenger_type: string; is_lead: boolean
  passport_number: string | null; passport_expiry: string | null
}

export type Flight = {
  id: number; booking_id: number; direction: string; leg_order: number; segment_id: number | null
  flight_number: string | null; airline: string | null; origin: string | null; destination: string | null
  departure_date: string | null; departure_time: string | null
  arrival_date: string | null; arrival_time: string | null; next_day: boolean
  cabin_class: string; pnr: string | null; flight_supplier: string | null
  net_cost: number | null; baggage_notes: string | null; cabin_notes: string | null
  terminal: string | null; ticketing_deadline: string | null
}

export type Accommodation = {
  id: number; booking_id: number; stay_order: number
  hotel_id: number | null; hotel_name: string | null; supplier_id: number | null
  hotel_confirmation: string | null; checkin_date: string | null; checkout_date: string | null
  nights: number | null; room_type: string | null; room_quantity: number; board_basis: string | null
  adults: number; children: number; infants: number; net_cost: number | null
  special_occasion: string | null; special_requests: string | null
  reservation_status: string; reservation_sent_at: string | null; reservation_email_to: string | null
}

export type Transfer = {
  id: number; booking_id: number; supplier_id: number | null; supplier_name: string | null
  transfer_type: string; meet_greet: boolean; local_rep: boolean
  arrival_date: string | null; arrival_time: string | null; arrival_flight: string | null
  departure_date: string | null; departure_time: string | null; departure_flight: string | null
  inter_hotel_dates: string | null; net_cost: number | null; notes: string | null
}

export type Extra = {
  id: number; booking_id: number; extra_type: string | null; description: string | null
  supplier: string | null; net_cost: number | null; notes: string | null
}

export type Payment = {
  id: number; booking_id: number; amount: number; payment_date: string
  debit_card: number; credit_card: number; amex: number; bank_transfer: number
  notes: string | null; invoice_sent: boolean; invoice_sent_at: string | null
}

export type BookingTask = {
  id: number; booking_id: number; task_name: string; task_key: string
  category: string; sort_order: number; is_done: boolean; status?: string | null
  completed_at: string | null; notes: string | null; due_date: string | null
}

export type KnownFlight = {
  flight_number: string
  airline: string | null
  origin: string | null
  destination: string | null
  departure_time: string | null
  arrival_time: string | null
  next_day: boolean | null
}

export type BookingCommission = {
  id: number
  booking_id: number
  staff_id: number
  share_percent: number
  is_primary: boolean
  created_at: string
}

export type BookingProfitEvent = {
  id: number
  booking_id: number
  type: 'original' | 'amendment'
  profit_delta: number
  created_at: string
}

export type BookingProfitAllocation = {
  id: number
  profit_event_id: number
  staff_id: number
  share_percent: number
  profit_share: number
  created_at: string
}

export type OwnershipClaim = {
  id: number
  booking_id: number
  claimant_id: number
  reason: string
  status: 'pending' | 'approved' | 'rejected'
  reviewed_by: number | null
  review_notes: string | null
  approved_split: number | null
  created_at: string
  reviewed_at: string | null
  // joined
  claimant?: { name: string }
}

export type OwnershipHistory = {
  id: number
  booking_id: number
  changed_by: number | null
  change_type: 'initial_assignment' | 'manager_reassignment' | 'claim_approved' | 'claim_rejected' | 'repeat_client_enforcement'
  previous_primary_staff_id: number | null
  new_primary_staff_id: number | null
  commission_snapshot: Record<string, unknown>[] | null
  claim_id: number | null
  notes: string | null
  created_at: string
}

export type ClientRepeatFlag = {
  id: number
  client_id: number
  booking_id: number
  original_staff_id: number | null
  handling_staff_id: number | null
  flagged_at: string
  resolved_by: number | null
  resolution: 'enforced_50_50' | 'reassigned_to_original' | 'manager_override' | 'dismissed' | null
  resolved_at: string | null
  // joined
  original_staff?: { name: string }
  handling_staff?: { name: string }
}

// ── CLAIM QUERIES ─────────────────────────────────────────────
export async function getPendingClaimsForBooking(bookingId: number): Promise<OwnershipClaim[]> {
  const { data } = await supabase
    .from('booking_ownership_claims')
    .select('*, claimant:staff_users!claimant_id(name)')
    .eq('booking_id', bookingId)
    .eq('status', 'pending')
    .order('created_at')
  return (data || []) as OwnershipClaim[]
}

export async function getMyPendingClaim(bookingId: number, claimantId: number): Promise<OwnershipClaim | null> {
  const { data } = await supabase
    .from('booking_ownership_claims')
    .select('*')
    .eq('booking_id', bookingId)
    .eq('claimant_id', claimantId)
    .eq('status', 'pending')
    .maybeSingle()
  return data as OwnershipClaim | null
}

export async function insertOwnershipClaim(values: Pick<OwnershipClaim, 'booking_id' | 'claimant_id' | 'reason'>): Promise<OwnershipClaim> {
  const { data, error } = await supabase
    .from('booking_ownership_claims')
    .insert(values)
    .select('*')
    .single()
  if (error) throw error
  return data as OwnershipClaim
}

export async function updateOwnershipClaim(id: number, values: Partial<Pick<OwnershipClaim, 'status' | 'reviewed_by' | 'review_notes' | 'approved_split' | 'reviewed_at'>>) {
  const { error } = await supabase
    .from('booking_ownership_claims')
    .update(values)
    .eq('id', id)
  if (error) throw error
}

export async function rejectAllPendingClaims(bookingId: number, reviewedBy: number, notes: string) {
  const { error } = await supabase
    .from('booking_ownership_claims')
    .update({ status: 'rejected', reviewed_by: reviewedBy, review_notes: notes, reviewed_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .eq('status', 'pending')
  if (error) throw error
}

// ── OWNERSHIP HISTORY ────────────────────────────────────────
export async function insertOwnershipHistory(values: Omit<OwnershipHistory, 'id' | 'created_at'>) {
  const { error } = await supabase
    .from('booking_ownership_history')
    .insert(values)
  if (error) throw error
}

// ── REPEAT FLAG QUERIES ──────────────────────────────────────
export async function getUnresolvedRepeatFlag(bookingId: number): Promise<ClientRepeatFlag | null> {
  const { data } = await supabase
    .from('client_repeat_flags')
    .select('*, original_staff:staff_users!original_staff_id(name), handling_staff:staff_users!handling_staff_id(name)')
    .eq('booking_id', bookingId)
    .is('resolution', null)
    .maybeSingle()
  return data as ClientRepeatFlag | null
}

export async function insertRepeatFlag(values: Pick<ClientRepeatFlag, 'client_id' | 'booking_id' | 'original_staff_id' | 'handling_staff_id'>) {
  const { error } = await supabase
    .from('client_repeat_flags')
    .insert(values)
  // ignore unique-violation — flag may already exist
  if (error && error.code !== '23505') throw error
}

export async function resolveRepeatFlag(bookingId: number, resolvedBy: number, resolution: NonNullable<ClientRepeatFlag['resolution']>) {
  const { error } = await supabase
    .from('client_repeat_flags')
    .update({ resolved_by: resolvedBy, resolution, resolved_at: new Date().toISOString() })
    .eq('booking_id', bookingId)
    .is('resolution', null)
  if (error) throw error
}

// ── BOOKING QUERIES ───────────────────────────────────────────
export async function getAllBookings(): Promise<Booking[]> {
  const { data } = await supabase
    .from('bookings')
    .select(`
      *,
      deals(id, title, deal_value, staff_id, clients(id, first_name, last_name, phone, email, owner_staff_id)),
      booking_tasks(*),
      booking_passengers(*)
    `)
    .order('departure_date', { ascending: true })
  return data || []
}

export async function getBookingById(id: number | string): Promise<Booking | null> {
  const { data } = await supabase
    .from('bookings')
    .select('*, deals(id,title,deal_value,staff_id,clients(*),activities(id,deal_id,activity_type,notes,created_at))')
    .eq('id', id)
    .single()
  return data
}

export async function getBookingWithAllData(id: number | string): Promise<{
  booking: Booking | null
  passengers: Passenger[]
  flights: Flight[]
  accommodations: Accommodation[]
  transfers: Transfer[]
  extras: Extra[]
  payments: Payment[]
  tasks: BookingTask[]
}> {
  const [
    { data: booking },
    { data: passengers },
    { data: flights },
    { data: accommodations },
    { data: transfers },
    { data: extras },
    { data: payments },
    { data: tasks },
  ] = await Promise.all([
    supabase.from('bookings').select('*, deals(id,title,deal_value,staff_id,clients(*),activities(id,deal_id,activity_type,notes,created_at))').eq('id', id).single(),
    supabase.from('booking_passengers').select('*').eq('booking_id', id).order('is_lead', { ascending: false }),
    supabase.from('booking_flights').select('*').eq('booking_id', id).order('direction').order('leg_order'),
    supabase.from('booking_accommodations').select('*').eq('booking_id', id).order('stay_order'),
    supabase.from('booking_transfers').select('*').eq('booking_id', id),
    supabase.from('booking_extras').select('*').eq('booking_id', id),
    supabase.from('booking_payments').select('*').eq('booking_id', id).order('payment_date'),
    supabase.from('booking_tasks').select('*').eq('booking_id', id).order('sort_order'),
  ])

  return {
    booking,
    passengers: passengers || [],
    flights: flights || [],
    accommodations: accommodations || [],
    transfers: transfers || [],
    extras: extras || [],
    payments: payments || [],
    tasks: tasks || [],
  }
}

// ── BOOKING UPDATES ───────────────────────────────────────────
export async function updateBooking(id: number, values: Partial<Booking>) {
  return dbMutate({
    table: 'bookings',
    action: 'update',
    values,
    filters: [{ column: 'id', value: id }],
  })
}

// ── OWNERSHIP UPDATES ─────────────────────────────────────────
export async function updateClientOwner(clientId: number, staffId: number) {
  return dbMutate({
    table: 'clients',
    action: 'update',
    values: { owner_staff_id: staffId },
    filters: [{ column: 'id', value: clientId }]
  })
}

export async function updateDealStaff(dealId: number, staffId: number) {
  return dbMutate({
    table: 'deals',
    action: 'update',
    values: { staff_id: staffId },
    filters: [{ column: 'id', value: dealId }]
  })
}

export async function updateBookingStaff(bookingId: number, staffId: number) {
  return dbMutate({
    table: 'bookings',
    action: 'update',
    values: { staff_id: staffId },
    filters: [{ column: 'id', value: bookingId }]
  })
}

export async function getBookingCommissions(bookingId: number): Promise<BookingCommission[]> {
  const { data } = await supabase
    .from('booking_commissions')
    .select('*')
    .eq('booking_id', bookingId)
    .order('is_primary', { ascending: false })
    .order('created_at')
  return (data || []) as BookingCommission[]
}

export async function replaceBookingCommissions(
  bookingId: number,
  rows: Omit<BookingCommission, 'id' | 'created_at'>[],
): Promise<BookingCommission[]> {
  const { error: deleteError } = await supabase
    .from('booking_commissions')
    .delete()
    .eq('booking_id', bookingId)
  if (deleteError) throw deleteError

  const { data, error } = await supabase
    .from('booking_commissions')
    .insert(rows)
    .select('*')
  if (error) throw error
  return (data || []) as BookingCommission[]
}

export async function getBookingProfitEvents(bookingId: number): Promise<BookingProfitEvent[]> {
  const { data } = await supabase
    .from('booking_profit_events')
    .select('*')
    .eq('booking_id', bookingId)
    .order('created_at')
  return (data || []) as BookingProfitEvent[]
}

export async function insertBookingProfitEvent(values: Omit<BookingProfitEvent, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('booking_profit_events')
    .insert(values)
    .select('*')
    .single()
  if (error) throw error
  return data as BookingProfitEvent
}

export async function insertProfitAllocations(
  rows: Omit<BookingProfitAllocation, 'id' | 'created_at'>[],
): Promise<void> {
  if (rows.length === 0) return
  const { error } = await supabase
    .from('booking_profit_allocations')
    .insert(rows)
  if (error) throw error
}

// ── PASSENGER OPERATIONS ──────────────────────────────────────
export async function insertPassenger(passenger: Omit<Passenger, 'id'>) {
  const { data, error } = await supabase
    .from('booking_passengers')
    .insert(passenger)
    .select('*')
    .single()

  if (error) throw error
  return data as Passenger
}

export async function updatePassenger(id: number, values: Partial<Passenger>) {
  const { data, error } = await supabase
    .from('booking_passengers')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw error
  return data as Passenger
}

export async function deletePassenger(id: number) {
  const { error } = await supabase
    .from('booking_passengers')
    .delete()
    .eq('id', id)

  if (error) throw error
}

// ── TASK OPERATIONS ───────────────────────────────────────────
export async function insertTasks(tasks: Omit<BookingTask, 'id' | 'completed_at' | 'notes' | 'due_date'>[]) {
  return dbMutate({
    table: 'booking_tasks',
    action: 'insert',
    values: tasks,
  })
}

export async function updateTask(id: number, values: Partial<BookingTask>) {
  return dbMutate({
    table: 'booking_tasks',
    action: 'update',
    values,
    filters: [{ column: 'id', value: id }],
  })
}

export async function insertOperationalTask(task: Omit<BookingTask, 'id'>) {
  return dbMutate({
    table: 'booking_tasks',
    action: 'insert',
    values: task,
  })
}

// ── CANCELLATION OPERATIONS ───────────────────────────────────
export async function cancelBooking(id: number, cancellationData: {
  booking_status: 'cancelled'
  status: 'CANCELLED'
  cancellation_type: string
  cancellation_date: string
  cancellation_actioned_by: string
  cancellation_checklist: Record<string, boolean>
  cancellation_notes: string | null
}) {
  return dbMutate({
    table: 'bookings',
    action: 'update',
    values: cancellationData,
    filters: [{ column: 'id', value: id }],
  })
}

export async function insertCancellationFollowupTasks(tasks: Omit<BookingTask, 'id'>[]) {
  return dbMutate({
    table: 'booking_tasks',
    action: 'insert',
    values: tasks,
  })
}

// ── FLIGHT OPERATIONS ───────────────────────────────────────
export async function findKnownFlightByNumber(flightNumber: string): Promise<KnownFlight | null> {
  const { data } = await supabase
    .from('known_flights')
    .select('flight_number,airline,origin,destination,departure_time,arrival_time,next_day')
    .eq('flight_number', flightNumber)
    .maybeSingle()
  return data
}

export async function getBookingFlights(bookingId: number) {
  const { data } = await supabase
    .from('booking_flights')
    .select('*')
    .eq('booking_id', bookingId)
    .order('direction')
    .order('leg_order')
  return (data || []) as Flight[]
}

export async function insertBookingFlights(rows: Omit<Flight, 'id' | 'arrival_date'>[] & Record<string, unknown>[]) {
  const { data, error } = await supabase
    .from('booking_flights')
    .insert(rows)
    .select('*')
  if (error) throw error
  return (data || []) as Flight[]
}

export async function updateBookingFlight(id: number, values: Partial<Flight> & Record<string, unknown>) {
  const { data, error } = await supabase
    .from('booking_flights')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Flight
}

export async function deleteBookingFlight(id: number) {
  const { error } = await supabase
    .from('booking_flights')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function upsertKnownFlight(values: Record<string, unknown>) {
  const { error } = await supabase
    .from('known_flights')
    .upsert(values, { onConflict: 'flight_number' })
  if (error) throw error
}

// ── ACCOMMODATION OPERATIONS ────────────────────────────────
export async function insertAccommodation(values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('booking_accommodations')
    .insert(values)
    .select('*')
    .single()
  if (error) throw error
  return data as Accommodation
}

export async function updateAccommodation(id: number, values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('booking_accommodations')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Accommodation
}

export async function deleteAccommodation(id: number) {
  const { error } = await supabase
    .from('booking_accommodations')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── TRANSFER OPERATIONS ─────────────────────────────────────
export async function insertTransfer(values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('booking_transfers')
    .insert(values)
    .select('*')
    .single()
  if (error) throw error
  return data as Transfer
}

export async function updateTransfer(id: number, values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('booking_transfers')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Transfer
}

export async function deleteTransfer(id: number) {
  const { error } = await supabase
    .from('booking_transfers')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── EXTRA OPERATIONS ────────────────────────────────────────
export async function insertExtra(values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('booking_extras')
    .insert(values)
    .select('*')
    .single()
  if (error) throw error
  return data as Extra
}

export async function updateExtra(id: number, values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('booking_extras')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Extra
}

export async function deleteExtra(id: number) {
  const { error } = await supabase
    .from('booking_extras')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── PAYMENT OPERATIONS ──────────────────────────────────────
export async function insertPayment(values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('booking_payments')
    .insert(values)
    .select('*')
    .single()
  if (error) throw error
  return data as Payment
}

export async function updatePayment(id: number, values: Record<string, unknown>) {
  const { data, error } = await supabase
    .from('booking_payments')
    .update(values)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Payment
}

export async function deletePayment(id: number) {
  const { error } = await supabase
    .from('booking_payments')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ── UTILITY QUERIES ───────────────────────────────────────────
export async function getHotels() {
  const { data } = await supabase
    .from('hotel_list')
    .select('id,name,room_types,meal_plans,reservation_email,reservation_phone,reservation_address,reservation_contact')
    .order('name')
  return data || []
}

export async function getSuppliers() {
  const { data } = await supabase
    .from('suppliers')
    .select('id,name,type')
    .order('name')
  return data || []
}
