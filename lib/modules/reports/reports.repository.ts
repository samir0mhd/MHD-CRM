import { dbMutate } from '@/lib/api-client'
import { supabase } from '@/lib/supabase'

export type Target = {
  id: number
  month: number
  year: number
  revenue_target: number
  profit_target: number
  bookings_target: number
  quotes_target: number
  leads_target: number
  rotten_days?: number | null
  profit_target_bronze?: number | null
  profit_target_silver?: number | null
  profit_target_gold?: number | null
  bonus_bronze?: number | null
  bonus_silver?: number | null
  bonus_gold?: number | null
  [key: string]: unknown
}

export type Deal = {
  id: number
  title: string
  stage: string
  deal_value: number | null
  departure_date: string | null
  source: string | null
  created_at: string
  client_id?: number | null
  quotes?: Quote[]
}

export type Quote = {
  id: number
  deal_id: number
  hotel?: string
  price?: number
  profit?: number
  board_basis?: string
  sent_to_client?: boolean
  created_at: string
}

export type Booking = {
  id: number
  deal_id: number
  booking_reference: string
  created_at: string
  deals?: Deal
}

export type QuoteSummary = {
  id: number
  created_at: string
}

export type CommissionBooking = {
  id: number
  booking_reference: string
  total_sell: number
  final_profit: number
  staff_id: number
  deals?: {
    clients?: {
      last_name: string
    }
  }
}

export type Payment = {
  id: number
  booking_id: number
  amount: number
  payment_date: string
}

export type ClientOwner = {
  id: number
  owner_staff_id: number | null
}

export type DealOwner = {
  id: number
  staff_id: number | null
  stage: string
}

export type BookingOwner = {
  id: number
  staff_id: number | null
  booking_status: string
}

export type MonthlyData = {
  month: number
  year: number
  revenue: number
  profit: number
  bookings: number
  quotes: number
  leads: number
}

export type LostReason = {
  reason: string
  count: number
}

export type StageBreakdown = {
  stage: string
  count: number
  value: number
}

export type CommissionRow = {
  bookingId: number
  bookingReference: string
  surname: string
  clearedDate: string
  paymentReceived: number
  commissionableAmount: number
}

export type SalesRow = {
  staffId: number
  name: string
  role: string | null
  leads: number
  quotesSent: number
  bookings: number
  bookedValue: number
  bookedProfit: number
  avgBookingValue: number
  leadToBookingPct: number
  quoteToBookingPct: number
}

export type SalesBookingRow = {
  bookingId: number
  bookingReference: string
  staffId: number | null
  staffName: string
  clientSurname: string
  title: string
  bookedAt: string
  bookedValue: number
  bookedProfit: number
}

export type SalesUnassigned = {
  leads: number
  quotesSent: number
  bookings: number
  bookedValue: number
}

export type QuoteRow = {
  staffId: number
  name: string
  role: string | null
  quotesBuilt: number
  quotesSent: number
  quotedDeals: number
  sentDeals: number
  bookedDeals: number
  quotedValue: number
  quotedProfit: number
  avgQuoteValue: number
  avgVersionsPerDeal: number
  avgTurnaroundHours: number
  conversionPct: number
}

export type QuoteRecentRow = {
  quoteId: number
  quoteRef: string
  version: number | null
  staffId: number | null
  staffName: string
  clientSurname: string
  title: string
  hotel: string
  createdAt: string
  sentToClient: boolean
  booked: boolean
  quotedValue: number
  quotedProfit: number
}

export type QuoteUnassigned = {
  quotesBuilt: number
  quotesSent: number
  quotedDeals: number
}

export type AssignmentHealth = {
  clientsWithoutOwner: number
  dealsWithoutOwner: number
  bookingsWithoutOwner: number
}

export type StaffUser = {
  id: number
  name: string
  role: string | null
  is_active: boolean | null
}

// ── MONTHLY DATA QUERIES ──────────────────────────────────────
export async function getMonthlyData(year: number): Promise<MonthlyData[]> {
  const yearStart = new Date(year, 0, 1).toISOString()
  const yearEnd = new Date(year, 11, 31, 23, 59, 59).toISOString()

  const [
    { data: bookings },
    { data: quotes },
    { data: leads }
  ] = await Promise.all([
    supabase.from('bookings')
      .select('id, created_at, deal_id, deals(deal_value, quotes(profit, sent_to_client, created_at))')
      .eq('status', 'CONFIRMED')
      .gte('created_at', yearStart)
      .lte('created_at', yearEnd),
    supabase.from('quotes')
      .select('id, created_at')
      .eq('sent_to_client', true)
      .gte('created_at', yearStart)
      .lte('created_at', yearEnd),
    supabase.from('deals')
      .select('id, created_at')
      .gte('created_at', yearStart)
      .lte('created_at', yearEnd)
  ])

  // Build monthly breakdown
  const monthly: Record<number, MonthlyData> = {}
  for (let m = 1; m <= 12; m++) {
    monthly[m] = { month: m, year, revenue: 0, profit: 0, bookings: 0, quotes: 0, leads: 0 }
  }

  // Process bookings
  ;(bookings || []).forEach((b: Booking) => {
    const m = new Date(b.created_at).getMonth() + 1
    const sentQuotes = (b.deals?.quotes || []).filter((q: Quote) => q.sent_to_client).sort((a: Quote, z: Quote) => new Date(z.created_at).getTime() - new Date(a.created_at).getTime())
    const bestQuote = sentQuotes[0] || (b.deals?.quotes || [])[0]
    monthly[m].revenue += b.deals?.deal_value || 0
    monthly[m].profit += bestQuote?.profit || 0
    monthly[m].bookings += 1
  })

  // Process quotes and leads
  ;(quotes || []).forEach((q: QuoteSummary) => { monthly[new Date(q.created_at).getMonth() + 1].quotes++ })
  ;(leads || []).forEach((l: LeadSummary) => { monthly[new Date(l.created_at).getMonth() + 1].leads++ })

  return Object.values(monthly)
}

// ── LOST REASONS QUERY ────────────────────────────────────────
export async function getLostReasons(): Promise<LostReason[]> {
  const { data: lostDeals } = await supabase
    .from('deals')
    .select('lost_reason')
    .eq('stage', 'LOST')
    .not('lost_reason', 'is', null)

  const reasonMap: Record<string, number> = {}
  ;(lostDeals || []).forEach((d: LostDeal) => {
    const r = d.lost_reason?.trim()
    if (r) reasonMap[r] = (reasonMap[r] || 0) + 1
  })

  return Object.entries(reasonMap)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count }))
}

// ── STAGE BREAKDOWN QUERY ─────────────────────────────────────
export async function getStageBreakdown(): Promise<StageBreakdown[]> {
  const { data: allDeals } = await supabase.from('deals').select('stage, deal_value')

  const stageMap: Record<string, { count: number; value: number }> = {}
  ;(allDeals || []).forEach((d: DealSummary) => {
    if (!stageMap[d.stage]) stageMap[d.stage] = { count: 0, value: 0 }
    stageMap[d.stage].count++
    stageMap[d.stage].value += d.deal_value || 0
  })

  const stageOrder = ['NEW_LEAD', 'QUOTE_SENT', 'ENGAGED', 'FOLLOW_UP', 'DECISION_PENDING', 'BOOKED', 'LOST']
  const stageLabels: Record<string, string> = {
    NEW_LEAD: 'New Lead',
    QUOTE_SENT: 'Quote Sent',
    ENGAGED: 'Engaged',
    FOLLOW_UP: 'Follow Up',
    DECISION_PENDING: 'Decision Pending',
    BOOKED: 'Booked',
    LOST: 'Lost'
  }

  return stageOrder
    .filter(s => stageMap[s])
    .map(s => ({
      stage: stageLabels[s] || s,
      count: stageMap[s].count,
      value: stageMap[s].value
    }))
}

// ── COMMISSION DATA QUERIES ───────────────────────────────────
export async function getCommissionData(staffId: number, from: string, to: string): Promise<CommissionRow[]> {
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id, booking_reference, total_sell, final_profit, staff_id, deals(clients(last_name))')
    .eq('staff_id', staffId)
    .not('total_sell', 'is', null)
    .not('final_profit', 'is', null)

  const bookingIds = (bookings || []).map((b: CommissionBooking) => b.id)
  if (bookingIds.length === 0) return []

  const { data: payments } = await supabase
    .from('booking_payments')
    .select('id, booking_id, amount, payment_date')
    .in('booking_id', bookingIds)
    .order('payment_date', { ascending: true })
    .order('id', { ascending: true })

  const paymentsByBooking = new Map<number, Payment[]>()
  ;(payments || []).forEach((payment: Payment) => {
    const rows = paymentsByBooking.get(payment.booking_id) || []
    rows.push(payment)
    paymentsByBooking.set(payment.booking_id, rows)
  })

  const rows: CommissionRow[] = []
  ;(bookings || []).forEach((booking: CommissionBooking) => {
    const sell = Number(booking.total_sell || 0)
    const commissionable = Number(booking.final_profit || 0)
    if (sell <= 0 || commissionable <= 0) return

    let running = 0
    let clearedDate: string | null = null
    let paymentReceived = 0

    for (const payment of paymentsByBooking.get(booking.id) || []) {
      const amount = Number(payment.amount || 0)
      const before = running
      running += amount

      if (before < sell && running >= sell) {
        clearedDate = payment.payment_date
        paymentReceived = Math.max(Math.min(sell - before, amount), 0)
        break
      }
    }

    if (!clearedDate || clearedDate < from || clearedDate > to) return

    rows.push({
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      surname: booking.deals?.clients?.last_name || '—',
      clearedDate,
      paymentReceived,
      commissionableAmount: commissionable,
    })
  })

  rows.sort((a, b) => a.clearedDate.localeCompare(b.clearedDate) || a.bookingReference.localeCompare(b.bookingReference))
  return rows
}

// ── SALES DATA QUERIES ────────────────────────────────────────
export async function getSalesData(fromIso: string, toIso: string, staffUsers: StaffUser[]): Promise<{
  rows: SalesRow[]
  bookings: SalesBookingRow[]
  unassigned: SalesUnassigned
}> {
  const [
    { data: leadDeals },
    { data: dealLookupRows },
    { data: quoteRows },
    { data: bookingRows },
  ] = await Promise.all([
    supabase
      .from('deals')
      .select('id, staff_id, deal_value, created_at, stage')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('deals')
      .select('id, staff_id'),
    supabase
      .from('quotes')
      .select('id, deal_id, created_at')
      .eq('sent_to_client', true)
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
    supabase
      .from('bookings')
      .select('id, booking_reference, created_at, staff_id, total_sell, final_profit, booking_status, deals(title, deal_value, clients(last_name), quotes(profit, sent_to_client, created_at))')
      .gte('created_at', fromIso)
      .lte('created_at', toIso),
  ])

  const rowsMap = new Map<number, SalesRow>()
  staffUsers.forEach(staff => {
    rowsMap.set(staff.id, {
      staffId: staff.id,
      name: staff.name,
      role: staff.role,
      leads: 0,
      quotesSent: 0,
      bookings: 0,
      bookedValue: 0,
      bookedProfit: 0,
      avgBookingValue: 0,
      leadToBookingPct: 0,
      quoteToBookingPct: 0,
    })
  })

  const unassigned: SalesUnassigned = { leads: 0, quotesSent: 0, bookings: 0, bookedValue: 0 }
  const dealLookup = new Map<number, number | null>()
  ;((dealLookupRows || []) as { id: number; staff_id: number | null }[]).forEach(deal => {
    dealLookup.set(deal.id, deal.staff_id ?? null)
  })

  // Process leads
  ;((leadDeals || []) as { id: number; staff_id: number | null; deal_value: number | null; created_at: string; stage: string }[]).forEach(deal => {
    if (!deal.staff_id) {
      unassigned.leads += 1
      return
    }
    const row = rowsMap.get(deal.staff_id)
    if (!row) return
    row.leads += 1
  })

  // Process quotes
  ;((quoteRows || []) as { id: number; deal_id: number; created_at: string }[]).forEach(quote => {
    const staffId = dealLookup.get(quote.deal_id) ?? null
    if (!staffId) {
      unassigned.quotesSent += 1
      return
    }
    const row = rowsMap.get(staffId)
    if (!row) return
    row.quotesSent += 1
  })

  // Process bookings
  const bookingDetailRows: SalesBookingRow[] = []
  ;((bookingRows || []) as {
    id: number
    booking_reference: string
    created_at: string
    staff_id: number | null
    total_sell: number | null
    final_profit: number | null
    booking_status: string | null
    deals?: {
      title?: string | null
      deal_value?: number | null
      clients?: { last_name?: string | null } | null
      quotes?: { profit: number | null; sent_to_client?: boolean | null; created_at?: string | null }[] | null
    } | null
  }[]).forEach(booking => {
    if (booking.booking_status === 'cancelled') return
    const bookedValue = Number(booking.total_sell || booking.deals?.deal_value || 0)
    const bookedProfit = booking.final_profit != null
      ? Number(booking.final_profit || 0)
      : bestQuoteProfit(booking.deals?.quotes)
    const staffId = booking.staff_id ?? null

    if (!staffId) {
      unassigned.bookings += 1
      unassigned.bookedValue += bookedValue
      return
    }

    const row = rowsMap.get(staffId)
    if (!row) return

    row.bookings += 1
    row.bookedValue += bookedValue
    row.bookedProfit += bookedProfit
    bookingDetailRows.push({
      bookingId: booking.id,
      bookingReference: booking.booking_reference,
      staffId,
      staffName: row.name,
      clientSurname: booking.deals?.clients?.last_name || '—',
      title: booking.deals?.title || '—',
      bookedAt: booking.created_at,
      bookedValue,
      bookedProfit,
    })
  })

  const rows = [...rowsMap.values()]
    .map(row => ({
      ...row,
      avgBookingValue: row.bookings > 0 ? row.bookedValue / row.bookings : 0,
      leadToBookingPct: row.leads > 0 ? (row.bookings / row.leads) * 100 : 0,
      quoteToBookingPct: row.quotesSent > 0 ? (row.bookings / row.quotesSent) * 100 : 0,
    }))
    .filter(row => row.leads > 0 || row.quotesSent > 0 || row.bookings > 0)
    .sort((a, b) => b.bookedProfit - a.bookedProfit || b.bookings - a.bookings || a.name.localeCompare(b.name))

  bookingDetailRows.sort((a, b) => new Date(b.bookedAt).getTime() - new Date(a.bookedAt).getTime())

  return { rows, bookings: bookingDetailRows, unassigned }
}

// ── QUOTE DATA QUERIES ────────────────────────────────────────
export async function getQuoteData(fromIso: string, toIso: string, staffUsers: StaffUser[]): Promise<{
  rows: QuoteRow[]
  recentRows: QuoteRecentRow[]
  unassigned: QuoteUnassigned
}> {
  const { data: quotesData } = await supabase
    .from('quotes')
    .select('id, deal_id, quote_ref, version, hotel, price, profit, sent_to_client, created_at, deals(id, staff_id, title, stage, created_at, clients(last_name), bookings(id, booking_reference, created_at))')
    .gte('created_at', fromIso)
    .lte('created_at', toIso)

  const quoteRowsRaw = ((quotesData || []) as {
    id: number
    deal_id: number
    quote_ref: string
    version: number | null
    hotel: string | null
    price: number | null
    profit: number | null
    sent_to_client: boolean | null
    created_at: string
    deals?: {
      id: number
      staff_id: number | null
      title: string | null
      stage: string | null
      created_at: string | null
      clients?: { last_name?: string | null } | null
      bookings?: { id: number; booking_reference: string; created_at: string }[] | null
    } | null
  }[])

  const dealIds = [...new Set(quoteRowsRaw.map(quote => quote.deal_id))]
  const { data: allDealQuotes } = dealIds.length === 0
    ? { data: [] as { deal_id: number; created_at: string }[] }
    : await supabase
        .from('quotes')
        .select('deal_id, created_at')
        .in('deal_id', dealIds)

  const firstQuoteByDeal = new Map<number, string>()
  ;((allDealQuotes || []) as { deal_id: number; created_at: string }[]).forEach(quote => {
    const current = firstQuoteByDeal.get(quote.deal_id)
    if (!current || new Date(quote.created_at).getTime() < new Date(current).getTime()) {
      firstQuoteByDeal.set(quote.deal_id, quote.created_at)
    }
  })

  const rowsMap = new Map<number, QuoteRow>()
  staffUsers.forEach(staff => {
    rowsMap.set(staff.id, {
      staffId: staff.id,
      name: staff.name,
      role: staff.role,
      quotesBuilt: 0,
      quotesSent: 0,
      quotedDeals: 0,
      sentDeals: 0,
      bookedDeals: 0,
      quotedValue: 0,
      quotedProfit: 0,
      avgQuoteValue: 0,
      avgVersionsPerDeal: 0,
      avgTurnaroundHours: 0,
      conversionPct: 0,
    })
  })

  const recentRows: QuoteRecentRow[] = []
  const unassigned: QuoteUnassigned = { quotesBuilt: 0, quotesSent: 0, quotedDeals: 0 }
  const dealStats = new Map<number, { quotes: number; sent: number; value: number; profit: number; firstQuote: string; lastQuote: string; booked: boolean }>()

  quoteRowsRaw.forEach(quote => {
    const deal = quote.deals
    const staffId = deal?.staff_id ?? null
    const isSent = !!quote.sent_to_client
    const value = Number(quote.price || 0)
    const profit = Number(quote.profit || 0)

    if (!staffId) {
      unassigned.quotesBuilt += 1
      if (isSent) unassigned.quotesSent += 1
      return
    }

    const row = rowsMap.get(staffId)
    if (!row) return

    row.quotesBuilt += 1
    row.quotedValue += value
    row.quotedProfit += profit
    if (isSent) row.quotesSent += 1

    // Track deal stats
    const dealId = quote.deal_id
    const current = dealStats.get(dealId) || { quotes: 0, sent: 0, value: 0, profit: 0, firstQuote: quote.created_at, lastQuote: quote.created_at, booked: false }
    current.quotes += 1
    current.value += value
    current.profit += profit
    if (isSent) current.sent += 1
    if (deal?.bookings && deal.bookings.length > 0) current.booked = true
    current.firstQuote = new Date(Math.min(new Date(current.firstQuote).getTime(), new Date(quote.created_at).getTime())).toISOString()
    current.lastQuote = new Date(Math.max(new Date(current.lastQuote).getTime(), new Date(quote.created_at).getTime())).toISOString()
    dealStats.set(dealId, current)

    // Add to recent rows
    recentRows.push({
      quoteId: quote.id,
      quoteRef: quote.quote_ref,
      version: quote.version,
      staffId,
      staffName: row.name,
      clientSurname: deal?.clients?.last_name || '—',
      title: deal?.title || '—',
      hotel: quote.hotel || '—',
      createdAt: quote.created_at,
      sentToClient: isSent,
      booked: current.booked,
      quotedValue: value,
      quotedProfit: profit,
    })
  })

  // Process deal stats
  dealStats.forEach((stats, dealId) => {
    const staffId = quoteRowsRaw.find(q => q.deal_id === dealId)?.deals?.staff_id
    if (!staffId) return

    const row = rowsMap.get(staffId)
    if (!row) return

    row.quotedDeals += 1
    if (stats.sent > 0) row.sentDeals += 1
    if (stats.booked) row.bookedDeals += 1

    const turnaroundMs = new Date(stats.lastQuote).getTime() - new Date(stats.firstQuote).getTime()
    row.avgTurnaroundHours += turnaroundMs / (1000 * 60 * 60) // Convert to hours
  })

  const rows = [...rowsMap.values()]
    .map(row => ({
      ...row,
      avgQuoteValue: row.quotesBuilt > 0 ? row.quotedValue / row.quotesBuilt : 0,
      avgVersionsPerDeal: row.quotedDeals > 0 ? row.quotesBuilt / row.quotedDeals : 0,
      avgTurnaroundHours: row.quotedDeals > 0 ? row.avgTurnaroundHours / row.quotedDeals : 0,
      conversionPct: row.sentDeals > 0 ? (row.bookedDeals / row.sentDeals) * 100 : 0,
    }))
    .filter(row => row.quotesBuilt > 0)
    .sort((a, b) => b.quotedProfit - a.quotedProfit || b.quotesBuilt - a.quotesBuilt || a.name.localeCompare(b.name))

  recentRows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  return { rows, recentRows, unassigned }
}

// ── UTILITY QUERIES ───────────────────────────────────────────
export async function getStaffUsers(): Promise<StaffUser[]> {
  const { data } = await supabase
    .from('staff_users')
    .select('id, name, role, is_active')
    .eq('is_active', true)
    .order('name')
  return data || []
}

export async function getAssignmentHealth(): Promise<AssignmentHealth> {
  const [
    { data: clientOwners },
    { data: dealOwners },
    { data: bookingOwners }
  ] = await Promise.all([
    supabase.from('clients').select('id, owner_staff_id'),
    supabase.from('deals').select('id, staff_id, stage'),
    supabase.from('bookings').select('id, staff_id, booking_status'),
  ])

  return {
    clientsWithoutOwner: (clientOwners || []).filter((client: ClientOwner) => !client.owner_staff_id).length,
    dealsWithoutOwner: (dealOwners || []).filter((deal: DealOwner) => !deal.staff_id && deal.stage !== 'LOST').length,
    bookingsWithoutOwner: (bookingOwners || []).filter((booking: BookingOwner) => !booking.staff_id && booking.booking_status !== 'cancelled').length,
  }
}

export async function getTargets(month: number, year: number): Promise<Target | null> {
  const { data } = await supabase
    .from('targets')
    .select('*')
    .eq('month', month)
    .eq('year', year)
    .single()
  return data
}

export async function createStaffUser(values: {
  name: string
  role: string
  is_active: boolean
}) {
  return dbMutate({
    table: 'staff_users',
    action: 'insert',
    values,
  })
}

export async function saveTargets(values: Target) {
  return dbMutate({
    table: 'targets',
    action: 'upsert',
    values,
    options: { onConflict: 'month,year' },
  })
}

// ── UTILITY FUNCTIONS ─────────────────────────────────────────
function bestQuoteProfit(quotes: { profit: number | null; sent_to_client?: boolean | null; created_at?: string | null }[] | null | undefined): number {
  if (!quotes || quotes.length === 0) return 0
  const sentQuotes = quotes
    .filter(quote => !!quote.sent_to_client)
    .sort((a, z) => new Date(z.created_at || '').getTime() - new Date(a.created_at || '').getTime())
  const latest = sentQuotes[0] || [...quotes].sort((a, z) => new Date(z.created_at || '').getTime() - new Date(a.created_at || '').getTime())[0]
  return Number(latest?.profit || 0)
}
