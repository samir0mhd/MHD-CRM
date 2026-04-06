import * as repo from './dashboard.repository'

export type DashData = {
  confirmedRevenue: number
  confirmedProfit: number
  quotesThisMonth: number
  leadsThisMonth: number
  conversionRate: number
  pipelineValue: number
  expectedProfit: number
  activeDeals: number
  rottenDeals: number
  yearRevenue: number
  yearProfit: number
  recentDeals: repo.PipelineDeal[]
  recentBookings: (repo.BookingWithQuotes & { profit: number })[]
  lostReasons: { reason: string; count: number }[]
  upcomingDepartures: repo.UpcomingDeparture[]
}

export type DashboardResponse = {
  target: repo.Target | null
  data: DashData
}

function bestQuoteProfit(quotes: repo.QuoteProfit[] | null | undefined): number {
  if (!quotes || quotes.length === 0) return 0
  const sentQuotes = quotes
    .filter(quote => !!quote.sent_to_client)
    .sort((a, z) => new Date(z.created_at || '').getTime() - new Date(a.created_at || '').getTime())
  const bestQuote = sentQuotes[0] || [...quotes].sort((a, z) => new Date(z.created_at || '').getTime() - new Date(a.created_at || '').getTime())[0]
  return Number(bestQuote?.profit || 0)
}

export async function getDashboardData(): Promise<DashboardResponse> {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()
  const monthStart = new Date(year, month - 1, 1).toISOString()
  const monthEnd = new Date(year, month, 0, 23, 59, 59).toISOString()
  const yearStart = new Date(year, 0, 1).toISOString()

  const [
    target,
    bookings,
    yearBookings,
    quotesThisMonth,
    leadsThisMonth,
    totalDeals,
    totalBooked,
    pipeline,
    lostDeals,
    upcomingDepartures,
  ] = await Promise.all([
    repo.getTarget(month, year),
    repo.getConfirmedBookingsInRange(monthStart, monthEnd),
    repo.getConfirmedBookingsSince(yearStart),
    repo.countQuotesSentInRange(monthStart, monthEnd),
    repo.countDealsCreatedInRange(monthStart, monthEnd),
    repo.countAllDeals(),
    repo.countBookedDeals(),
    repo.getActivePipelineDeals(),
    repo.getLostDeals(),
    repo.getUpcomingDepartures(now.toISOString().split('T')[0], new Date(now.getTime() + 30 * 86400000).toISOString().split('T')[0]),
  ])

  let confirmedRevenue = 0
  let confirmedProfit = 0
  const recentBookings: (repo.BookingWithQuotes & { profit: number })[] = []
  bookings.forEach(booking => {
    const profit = bestQuoteProfit(booking.deals?.quotes)
    confirmedRevenue += Number(booking.deals?.deal_value || 0)
    confirmedProfit += profit
    recentBookings.push({ ...booking, profit })
  })

  let yearRevenue = 0
  let yearProfit = 0
  yearBookings.forEach(booking => {
    yearRevenue += Number(booking.deals?.deal_value || 0)
    yearProfit += bestQuoteProfit(booking.deals?.quotes)
  })

  const rottenDays = target?.rotten_days || 3
  let pipelineValue = 0
  let expectedProfit = 0
  let rottenDeals = 0
  pipeline.forEach(deal => {
    pipelineValue += Number(deal.deal_value || 0)
    expectedProfit += bestQuoteProfit(deal.quotes)
    if (deal.next_activity_at && Math.floor((Date.now() - new Date(deal.next_activity_at).getTime()) / 86400000) >= rottenDays) {
      rottenDeals += 1
    }
  })

  const reasonMap: Record<string, number> = {}
  lostDeals.forEach(deal => {
    const reason = deal.lost_reason?.trim()
    if (reason) {
      reasonMap[reason] = (reasonMap[reason] || 0) + 1
    }
  })
  const lostReasons = Object.entries(reasonMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => ({ reason, count }))

  return {
    target,
    data: {
      confirmedRevenue,
      confirmedProfit,
      quotesThisMonth,
      leadsThisMonth,
      conversionRate: totalDeals ? Math.round((totalBooked / totalDeals) * 100) : 0,
      pipelineValue,
      expectedProfit,
      activeDeals: pipeline.length,
      rottenDeals,
      yearRevenue,
      yearProfit,
      recentDeals: pipeline.slice(0, 5),
      recentBookings,
      lostReasons,
      upcomingDepartures,
    },
  }
}
