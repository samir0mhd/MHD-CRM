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
  const { data } = await supabase
    .from('targets')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  return (data as Target | null) || null
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
