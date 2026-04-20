'use server'

import { supabase } from '@/lib/supabase'
import { dbMutate, dbRpc } from '@/lib/api-client'

export type Deal = {
  id: number
  title: string
  stage: string
  deal_value: number
  departure_date: string | null
  source: string | null
  next_activity_at: string | null
  next_activity_type: string | null
  next_activity_note: string | null
  lost_reason: string | null
  lost_structured_reason?: string | null
  lost_at?: string | null
  created_at: string
  client_id?: number | null
  staff_id?: number | null
  clients?: {
    id?: number
    first_name: string
    last_name: string
    phone: string
    email: string
    date_of_birth?: string | null
    owner_staff_id?: number | null
  }
  quotes?: Quote[]
  activities?: Activity[]
  bookings?: Booking[]
}

export type Quote = {
  id: number
  deal_id: number
  quote_ref?: string
  hotel?: string
  price?: number
  profit?: number
  margin_percent?: number
  board_basis?: string
  nights?: number
  departure_date?: string | null
  checkin_date?: string | null
  checkin_next_day?: boolean
  sent_to_client?: boolean
  cabin_class?: string | null
  room_type?: string | null
  airline?: string | null
  departure_airport?: string | null
  adults?: number
  children?: number
  infants?: number
  child_ages?: number[] | null
  additional_services?: string | null
  quote_type?: string | null
  flight_details?: {
    outbound?: FlightLeg[]
    return?: FlightLeg[]
    builder_state?: unknown
  } | null
  cost_breakdown?: CostBreakdown | null
  created_at: string
}

export type FlightLeg = {
  from?: string
  to?: string
  date?: string
  depart_time?: string
  arrival_time?: string
  overnight?: boolean
  airline?: string
  cabin?: string
}

export type CostBreakdownExtra = {
  label?: string
  net?: number
}

export type CostBreakdown = {
  flight_net?: number
  acc_net?: number
  trans_net?: number
  total_net?: number
  extras?: CostBreakdownExtra[]
}

export type MonthlyTargetRow = {
  profit_target_bronze: number | null
  profit_target_silver: number | null
  profit_target_gold: number | null
  bonus_bronze: number | null
  bonus_silver: number | null
  bonus_gold: number | null
}

export type BookingTargetLookup = {
  deals?: {
    quotes?: Quote[]
  } | null
}

export type Activity = {
  id: number
  deal_id: number
  activity_type: string
  notes: string | null
  created_at: string
}

export type Booking = {
  id: number
  deal_id: number
  booking_reference: string
  staff_id: number | null
  status?: string
  departure_date?: string | null
  originating_quote_ref?: string | null
  originating_quote_id?: number | null
  total_sell?: number | null
  gross_profit?: number | null
  final_profit?: number | null
}

export type BookingTask = {
  booking_id: number
  task_name: string
  task_key: string
  category: string
  sort_order: number
  is_done: boolean
}

export type BookingPassenger = {
  booking_id: number
  title: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  passenger_type: string
  is_lead: boolean
}

export type PipelineClientResult = {
  id: number
  first_name: string
  last_name: string
  phone: string
  email: string
  owner_staff_id: number | null
}

export async function getAllDeals(): Promise<Deal[]> {
  const { data } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name, phone, email), quotes(id, price, profit, sent_to_client, quote_ref), bookings(id, booking_reference)')
    .order('created_at', { ascending: false })

  return data || []
}

export async function getActivePipelineDeals(): Promise<Deal[]> {
  const { data } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name), activities(created_at), quotes(id, quote_ref, sent_to_client)')
    .not('stage', 'in', '("BOOKED","LOST")')
    .order('created_at', { ascending: false })

  return data || []
}

export async function getDealById(id: number | string): Promise<Deal | null> {
  const { data } = await supabase
    .from('deals')
    .select('*, clients(*), quotes(*), activities(*), bookings(id, booking_reference, staff_id, originating_quote_ref, originating_quote_id, total_sell, gross_profit, final_profit)')
    .eq('id', id)
    .single()

  return data || null
}

export async function searchClients(query: string): Promise<PipelineClientResult[]> {
  const { data } = await supabase
    .from('clients')
    .select('id, first_name, last_name, phone, email, owner_staff_id')
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,phone.ilike.%${query}%,email.ilike.%${query}%`)
    .limit(6)

  return (data as PipelineClientResult[]) || []
}

export async function getClientLookup(id: number): Promise<PipelineClientResult | null> {
  const { data } = await supabase
    .from('clients')
    .select('id, first_name, last_name, phone, email, owner_staff_id')
    .eq('id', id)
    .maybeSingle()

  return (data as PipelineClientResult | null) || null
}

export async function updateDeal(id: number, values: Partial<Deal>) {
  return dbMutate({
    table: 'deals',
    action: 'update',
    values,
    filters: [{ column: 'id', value: id }],
  })
}

export async function insertClient(values: {
  first_name: string
  last_name: string
  email: string
  phone: string
  owner_staff_id: number | null
}) {
  return dbMutate<{ id: number; owner_staff_id: number | null }>({
    table: 'clients',
    action: 'insert',
    values,
    select: 'id, owner_staff_id',
    returning: 'single',
  })
}

export async function insertDeal(values: {
  title: string
  client_id: number
  staff_id: number | null
  stage: string
  deal_value: number | null
  departure_date: string | null
  source: string
}) {
  return dbMutate<{ id: number }>({
    table: 'deals',
    action: 'insert',
    values,
    select: 'id',
    returning: 'single',
  })
}

export async function insertActivity(activity: { deal_id: number; activity_type: string; notes: string }) {
  return dbMutate({
    table: 'activities',
    action: 'insert',
    values: activity,
  })
}

export async function getBookingsByDealId(dealId: number) {
  const { data } = await supabase
    .from('bookings')
    .select('id,booking_reference,staff_id')
    .eq('deal_id', dealId)

  return data || []
}

export async function getFollowUpSequencesByDeal(dealId: number) {
  const { data } = await supabase
    .from('follow_up_sequences')
    .select('id')
    .eq('deal_id', dealId)

  return data || []
}

export async function insertFollowUpSequences(sequences: { deal_id: number; sequence_day: number; status: string; scheduled_for: string }[]) {
  return dbMutate({
    table: 'follow_up_sequences',
    action: 'insert',
    values: sequences,
  })
}

export async function updateQuoteSent(quoteId: number) {
  return updateQuotesSent([quoteId])
}

export async function updateQuotesSent(quoteIds: number[]) {
  if (quoteIds.length === 0) return

  return dbMutate({
    table: 'quotes',
    action: 'update',
    values: { sent_to_client: true },
    filters: [{ column: 'id', op: 'in', value: quoteIds }],
  })
}

export async function deleteQuote(quoteId: number) {
  return deleteQuotes([quoteId])
}

export async function deleteQuotes(quoteIds: number[]) {
  if (quoteIds.length === 0) return

  return dbMutate({
    table: 'quotes',
    action: 'delete',
    filters: [{ column: 'id', op: 'in', value: quoteIds }],
  })
}

export async function executeNextBookingRef() {
  return dbRpc<string>('next_booking_ref')
}

export async function insertBooking(booking: {
  deal_id: number
  booking_reference: string
  departure_date: string | null
  status: string
  balance_due_date: string | null
  deposit_received: boolean
  staff_id: number | null
  originating_quote_ref?: string | null
  originating_quote_id?: number | null
}) {
  return dbMutate<{ id: number }>({
    table: 'bookings',
    action: 'insert',
    values: booking,
    select: '*',
    returning: 'single',
  })
}

export async function insertBookingTasks(tasks: BookingTask[]) {
  return dbMutate({
    table: 'booking_tasks',
    action: 'insert',
    values: tasks,
  })
}

export async function insertBookingPassenger(passenger: BookingPassenger) {
  return dbMutate({
    table: 'booking_passengers',
    action: 'insert',
    values: passenger,
  })
}

export async function getMonthlyTargets(month: number, year: number): Promise<MonthlyTargetRow | null> {
  const { data } = await supabase
    .from('targets')
    .select('profit_target_bronze,profit_target_silver,profit_target_gold,bonus_bronze,bonus_silver,bonus_gold')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  return (data as MonthlyTargetRow | null) || null
}

export async function getConfirmedBookingsWithQuotes(
  staffId: number,
  monthStart: string,
  monthEnd: string,
): Promise<BookingTargetLookup[]> {
  const { data } = await supabase
    .from('bookings')
    .select('deals(quotes(profit, sent_to_client, created_at))')
    .eq('staff_id', staffId)
    .eq('status', 'CONFIRMED')
    .gte('created_at', monthStart)
    .lte('created_at', monthEnd)

  return (data as BookingTargetLookup[]) || []
}

export async function updateBookingStaff(bookingIds: number[], staffId: number) {
  return dbMutate({
    table: 'bookings',
    action: 'update',
    values: { staff_id: staffId },
    filters: [{ column: 'id', op: 'in', value: bookingIds }],
  })
}

export async function updateClientOwner(clientId: number, nextStaffId: number) {
  return dbMutate({
    table: 'clients',
    action: 'update',
    values: { owner_staff_id: nextStaffId },
    filters: [{ column: 'id', value: clientId }],
  })
}

export async function updateBookingPageOwner(bookingId: number, staffId: number) {
  return dbMutate({
    table: 'bookings',
    action: 'update',
    values: { staff_id: staffId },
    filters: [{ column: 'id', value: bookingId }],
  })
}
