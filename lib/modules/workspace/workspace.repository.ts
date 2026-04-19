import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type StaffWorkspaceProfile = {
  id: number
  name: string
  role: string | null
  email: string | null
  job_title: string | null
  profile_photo_url: string | null
  email_signature: string | null
}

export type QuoteActivity = {
  id: number
  deal_id: number
  created_at: string
}

export type WorkspaceDeal = {
  id: number
  title: string
  stage: string
  deal_value: number | null
  next_activity_at: string | null
  created_at: string
  departure_date: string | null
  clients?: {
    first_name?: string | null
    last_name?: string | null
  } | null
  quotes?: {
    profit?: number | null
    sent_to_client?: boolean | null
    created_at?: string | null
  }[] | null
}

export type WorkspaceBooking = {
  id: number
  booking_reference: string
  created_at: string
  departure_date: string | null
  status: string
  booking_status: string | null
  total_sell: number | null
  deals?: {
    title?: string | null
    clients?: {
      first_name?: string | null
      last_name?: string | null
    } | null
  } | null
}

export type SharedBookingRow = {
  booking_id: number
  share_percent: number
  is_primary: boolean
  bookings: (WorkspaceBooking & {
    booking_commissions?: { staff_id: number; share_percent: number; is_primary: boolean }[]
  }) | null
}

export type PendingShareItem = {
  id: number
  booking_id: number
  reason: string
  created_at: string
  claimant?: { name: string } | null
  bookings?: {
    booking_reference: string
    deals?: {
      title?: string | null
      clients?: { first_name?: string | null; last_name?: string | null } | null
    } | null
  } | null
}

export type RecognisedShareRow = {
  bookingId: number
  recognitionPeriod: string
  sharePercent: number
  staffShare: number
}

export type TargetRow = {
  month: number
  year: number
  revenue_target: number | null
  profit_target_gold: number | null
  profit_target_silver: number | null
  profit_target_bronze: number | null
  bonus_bronze: number | null
  bonus_silver: number | null
  bonus_gold: number | null
}

export async function getWorkspaceProfile(staffId: number): Promise<StaffWorkspaceProfile | null> {
  const { data } = await supabase
    .from('staff_users')
    .select('id,name,role,email,job_title,profile_photo_url,email_signature')
    .eq('id', staffId)
    .maybeSingle()
  return data as StaffWorkspaceProfile | null
}

export async function updateWorkspaceProfile(
  staffId: number,
  values: Partial<Pick<StaffWorkspaceProfile, 'job_title' | 'profile_photo_url' | 'email_signature'>>,
): Promise<StaffWorkspaceProfile> {
  const client = supabaseAdmin ?? supabase
  const { data, error } = await client
    .from('staff_users')
    .update(values)
    .eq('id', staffId)
    .select('id,name,role,email,job_title,profile_photo_url,email_signature')
    .single()
  if (error) throw error
  return data as StaffWorkspaceProfile
}

export async function getCurrentTarget(month: number, year: number): Promise<TargetRow | null> {
  const { data: exact } = await supabase
    .from('targets')
    .select('month,year,revenue_target,profit_target_gold,profit_target_silver,profit_target_bronze,bonus_bronze,bonus_silver,bonus_gold')
    .eq('month', month)
    .eq('year', year)
    .maybeSingle()

  if (exact) return exact as TargetRow

  const { data: latest } = await supabase
    .from('targets')
    .select('month,year,revenue_target,profit_target_gold,profit_target_silver,profit_target_bronze,bonus_bronze,bonus_silver,bonus_gold')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  return (latest as TargetRow | null) || null
}

export async function getYearTargets(year: number): Promise<TargetRow[]> {
  const { data } = await supabase
    .from('targets')
    .select('month,year,revenue_target,profit_target_gold,profit_target_silver,profit_target_bronze,bonus_bronze,bonus_silver,bonus_gold')
    .eq('year', year)
    .order('month')
  return (data || []) as TargetRow[]
}

export async function getDealsForStaff(staffId: number): Promise<WorkspaceDeal[]> {
  const { data } = await supabase
    .from('deals')
    .select('id,title,stage,deal_value,next_activity_at,created_at,departure_date,clients(first_name,last_name),quotes(profit,sent_to_client,created_at)')
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false })
  return (data || []) as WorkspaceDeal[]
}

export async function getQuoteActivityForDeals(
  dealIds: number[],
  fromIso: string,
  toIso: string,
): Promise<QuoteActivity[]> {
  if (dealIds.length === 0) return []
  const { data } = await supabase
    .from('quotes')
    .select('id,deal_id,created_at')
    .in('deal_id', dealIds)
    .eq('sent_to_client', true)
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
  return (data || []) as QuoteActivity[]
}

export async function getConfirmedBookingsForStaff(
  staffId: number,
  fromIso: string,
  toIso: string,
): Promise<WorkspaceBooking[]> {
  const { data } = await supabase
    .from('bookings')
    .select('id,booking_reference,created_at,departure_date,status,booking_status,total_sell,deals(title,clients(first_name,last_name))')
    .eq('staff_id', staffId)
    .eq('status', 'CONFIRMED')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)
    .order('created_at', { ascending: false })
  return (data || []) as WorkspaceBooking[]
}

export async function getActiveBookingsForStaff(staffId: number): Promise<WorkspaceBooking[]> {
  const { data } = await supabase
    .from('bookings')
    .select('id,booking_reference,created_at,departure_date,status,booking_status,total_sell,deals(title,clients(first_name,last_name))')
    .eq('staff_id', staffId)
    .eq('status', 'CONFIRMED')
    .neq('booking_status', 'cancelled')
    .order('departure_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  return (data || []) as WorkspaceBooking[]
}

export async function getSharedBookingsForStaff(staffId: number): Promise<SharedBookingRow[]> {
  const { data } = await supabase
    .from('booking_commissions')
    .select(`
      booking_id, share_percent, is_primary,
      bookings!inner(
        id, booking_reference, created_at, departure_date, status, booking_status, total_sell,
        deals(title, clients(first_name, last_name)),
        booking_commissions(staff_id, share_percent, is_primary)
      )
    `)
    .eq('staff_id', staffId)
    .order('booking_id', { ascending: false })

  return ((data || []) as unknown as SharedBookingRow[]).filter(row => (row.bookings?.booking_commissions?.length || 0) > 1)
}

export async function getPendingShareItems(
  staffId: number,
): Promise<PendingShareItem[]> {
  const query = supabase
    .from('booking_ownership_claims')
    .select(`
      id, booking_id, reason, created_at,
      claimant:staff_users!claimant_id(name),
      bookings(booking_reference, deals(title, clients(first_name, last_name)))
    `)
    .eq('status', 'pending')
    .eq('claimant_id', staffId)
    .order('created_at')

  const { data } = await query
  return (data || []) as unknown as PendingShareItem[]
}

export async function getRecognisedSharesForStaff(
  staffId: number,
  fromPeriod: string,
  toPeriod: string,
): Promise<RecognisedShareRow[]> {
  const { data: events } = await supabase
    .from('booking_profit_events')
    .select('id, booking_id, recognition_period')
    .eq('commissionable', true)
    .gte('recognition_period', fromPeriod)
    .lte('recognition_period', toPeriod)

  if (!events?.length) return []

  const eventIds = (events as { id: number; booking_id: number; recognition_period: string | null }[]).map(event => event.id)
  const byEvent = new Map(
    (events as { id: number; booking_id: number; recognition_period: string | null }[]).map(event => [
      event.id,
      { bookingId: event.booking_id, recognitionPeriod: event.recognition_period ?? fromPeriod },
    ]),
  )

  const { data: allocations } = await supabase
    .from('booking_profit_allocations')
    .select('profit_event_id, profit_share, share_percent')
    .eq('staff_id', staffId)
    .in('profit_event_id', eventIds)

  if (!allocations?.length) return []

  const grouped = new Map<string, RecognisedShareRow>()
  ;(allocations as { profit_event_id: number; profit_share: number; share_percent: number }[]).forEach(allocation => {
    const event = byEvent.get(allocation.profit_event_id)
    if (!event) return
    const key = `${event.recognitionPeriod}:${event.bookingId}`
    const existing = grouped.get(key)
    grouped.set(key, {
      bookingId: event.bookingId,
      recognitionPeriod: event.recognitionPeriod,
      sharePercent: Number(allocation.share_percent),
      staffShare: Number(((existing?.staffShare ?? 0) + Number(allocation.profit_share)).toFixed(2)),
    })
  })

  return [...grouped.values()]
}
