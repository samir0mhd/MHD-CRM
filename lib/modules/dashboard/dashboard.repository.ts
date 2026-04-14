import { supabase } from '@/lib/supabase'

export type Target = {
  revenue_target: number
  profit_target_bronze: number
  profit_target_silver: number
  profit_target_gold: number
  quotes_target: number
  leads_target: number
  bonus_bronze: number
  bonus_silver: number
  bonus_gold: number
  rotten_days: number
}

export type QuoteProfit = {
  profit?: number | null
  sent_to_client?: boolean | null
  created_at?: string | null
}

export type BookingWithQuotes = {
  id: number
  deal_id?: number | null
  booking_reference?: string | null
  departure_date?: string | null
  created_at?: string
  deals?: {
    id?: number
    title?: string | null
    deal_value?: number | null
    clients?: {
      first_name?: string | null
      last_name?: string | null
    } | null
    quotes?: QuoteProfit[] | null
  } | null
}

export type PipelineDeal = {
  id: number
  title: string
  stage: string
  deal_value: number | null
  next_activity_at: string | null
  created_at: string
  clients?: {
    first_name?: string | null
    last_name?: string | null
  } | null
  quotes?: QuoteProfit[] | null
}

export type LostDeal = {
  lost_reason?: string | null
}

export type UpcomingDeparture = {
  id: number
  booking_reference: string
  departure_date: string
  deals?: {
    title?: string | null
    clients?: {
      first_name?: string | null
      last_name?: string | null
    } | null
  } | null
}

export async function getTarget(month: number, year: number): Promise<Target | null> {
  // Try exact month/year match first, then fall back to the most recent row.
  // Targets are configured once and reused across months until explicitly updated.
  const { data: exact } = await supabase
    .from('targets')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (exact) return exact as Target

  const { data: latest } = await supabase
    .from('targets')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (latest as Target | null) || null
}

export async function getConfirmedBookingsInRange(from: string, to: string): Promise<BookingWithQuotes[]> {
  const { data } = await supabase
    .from('bookings')
    .select('id, deal_id, booking_reference, departure_date, created_at, deals(id, title, deal_value, clients(first_name, last_name), quotes(profit, sent_to_client, created_at))')
    .eq('status', 'CONFIRMED')
    .gte('created_at', from)
    .lte('created_at', to)

  return (data as BookingWithQuotes[]) || []
}

export async function getConfirmedBookingsSince(from: string): Promise<BookingWithQuotes[]> {
  const { data } = await supabase
    .from('bookings')
    .select('id, deal_id, deals(deal_value, quotes(profit, sent_to_client, created_at))')
    .eq('status', 'CONFIRMED')
    .gte('created_at', from)

  return (data as BookingWithQuotes[]) || []
}

export async function countQuotesSentInRange(from: string, to: string): Promise<number> {
  const { count } = await supabase
    .from('quotes')
    .select('id', { count: 'exact', head: true })
    .eq('sent_to_client', true)
    .gte('created_at', from)
    .lte('created_at', to)

  return count || 0
}

export async function countDealsCreatedInRange(from: string, to: string): Promise<number> {
  const { count } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .gte('created_at', from)
    .lte('created_at', to)

  return count || 0
}

export async function countAllDeals(): Promise<number> {
  const { count } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })

  return count || 0
}

export async function countBookedDeals(): Promise<number> {
  const { count } = await supabase
    .from('deals')
    .select('id', { count: 'exact', head: true })
    .eq('stage', 'BOOKED')

  return count || 0
}

export async function getActivePipelineDeals(): Promise<PipelineDeal[]> {
  const { data } = await supabase
    .from('deals')
    .select('id, title, stage, deal_value, next_activity_at, created_at, clients(first_name, last_name), quotes(profit, sent_to_client, created_at)')
    .not('stage', 'in', '("BOOKED","LOST")')
    .order('created_at', { ascending: false })

  return (data as PipelineDeal[]) || []
}

export async function getLostDeals(): Promise<LostDeal[]> {
  const { data } = await supabase
    .from('deals')
    .select('lost_reason')
    .eq('stage', 'LOST')
    .not('lost_reason', 'is', null)

  return (data as LostDeal[]) || []
}

// ── COMMISSION / RECOGNISED PROFIT ───────────────────────────

export type CommercialEvent = {
  bookingId: number
  bookingReference: string
  clientSurname: string | null
  status: string
  totalSell: number
  finalProfit: number
  staffShare: number       // this staff member's allocated share
  sharePercent: number
  recognitionPeriod: string
  balanceClearedAt: string | null
}

/**
 * Returns the sum of commissionable profit allocated to a staff member for a
 * given recognition period, plus individual booking-level detail for surfacing
 * on the dashboard. This is the authoritative source — it matches the commission
 * report exactly.
 */
export async function getRecognisedProfitForPeriod(
  staffId: number,
  period: string,
): Promise<{ total: number; events: CommercialEvent[] }> {
  // Step 1: all commissionable events for this period
  const { data: events } = await supabase
    .from('booking_profit_events')
    .select('id, booking_id, type, profit_delta')
    .eq('commissionable', true)
    .eq('recognition_period', period)

  if (!events?.length) return { total: 0, events: [] }

  const eventIds = (events as { id: number; booking_id: number }[]).map(e => e.id)
  const eventToBooking = new Map(
    (events as { id: number; booking_id: number }[]).map(e => [e.id, e.booking_id]),
  )

  // Step 2: allocations for this staff member across those events
  const { data: allocations } = await supabase
    .from('booking_profit_allocations')
    .select('profit_event_id, profit_share, share_percent')
    .eq('staff_id', staffId)
    .in('profit_event_id', eventIds)

  if (!allocations?.length) return { total: 0, events: [] }

  // Sum profit_share per booking
  const byBooking = new Map<number, { staffShare: number; sharePercent: number }>()
  ;(allocations as { profit_event_id: number; profit_share: number; share_percent: number }[]).forEach(a => {
    const bookingId = eventToBooking.get(a.profit_event_id)
    if (bookingId == null) return
    const existing = byBooking.get(bookingId)
    byBooking.set(bookingId, {
      staffShare: (existing?.staffShare ?? 0) + Number(a.profit_share),
      sharePercent: Number(a.share_percent),
    })
  })

  const bookingIds = [...byBooking.keys()]
  const total = [...byBooking.values()].reduce((sum, v) => sum + v.staffShare, 0)

  // Step 3: load booking + client details
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_reference, status, total_sell, final_profit, balance_cleared_at, deals(clients(last_name))')
    .in('id', bookingIds)

  const result: CommercialEvent[] = []
  ;(bookings || []).forEach((b: {
    id: number
    booking_reference: string
    status: string
    total_sell: number | null
    final_profit: number | null
    balance_cleared_at: string | null
    deals?: { clients?: { last_name?: string | null } | null } | null
  }) => {
    const share = byBooking.get(b.id)
    if (!share || share.staffShare <= 0) return
    result.push({
      bookingId: b.id,
      bookingReference: b.booking_reference,
      clientSurname: b.deals?.clients?.last_name ?? null,
      status: b.status,
      totalSell: Number(b.total_sell || 0),
      finalProfit: Number(b.final_profit || 0),
      staffShare: Number(share.staffShare.toFixed(2)),
      sharePercent: share.sharePercent,
      recognitionPeriod: period,
      balanceClearedAt: b.balance_cleared_at ?? null,
    })
  })

  result.sort((a, b) => (a.balanceClearedAt ?? '').localeCompare(b.balanceClearedAt ?? ''))
  return { total: Number(total.toFixed(2)), events: result }
}

export async function getUpcomingDepartures(from: string, to: string): Promise<UpcomingDeparture[]> {
  const { data } = await supabase
    .from('bookings')
    .select('id, booking_reference, departure_date, deals(title, clients(first_name, last_name))')
    .eq('status', 'CONFIRMED')
    .gte('departure_date', from)
    .lte('departure_date', to)
    .order('departure_date', { ascending: true })
    .limit(5)

  return (data as UpcomingDeparture[]) || []
}
