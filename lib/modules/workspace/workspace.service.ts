import * as repo from './workspace.repository'
import { calculateCommission } from '@/lib/modules/reports/reports.service'

export type WorkspaceMetrics = {
  quotesSent: number
  bookingsConverted: number
  conversionRate: number
  recognisedProfit: number
  commission: number
}

export type WorkspaceTargetProgress = {
  configuredMonths: number
  revenueTarget: number | null
  recognisedProfitTarget: number | null
  revenueProgressPct: number | null
  recognisedProfitProgressPct: number | null
}

export type BonusTierProgress = {
  bronze: number
  silver: number
  gold: number
  bonusBronze: number
  bonusSilver: number
  bonusGold: number
  currentRecognisedProfit: number
}

export type WorkspaceSummaryList<T> = {
  total: number
  items: T[]
}

export type WorkspaceResponse = {
  profile: repo.StaffWorkspaceProfile
  monthly: WorkspaceMetrics
  yearToDate: WorkspaceMetrics & {
    revenue: number
    targetProgress: WorkspaceTargetProgress
  }
  monthlyBonusTier: BonusTierProgress | null
  potential: {
    pipelineValue: number
    expectedProfit: number
  }
  workload: {
    activeDeals: number
    confirmedBookings: number
    sharedBookings: number
    pendingShareItems: number
  }
  lists: {
    myDeals: WorkspaceSummaryList<repo.WorkspaceDeal>
    myBookings: WorkspaceSummaryList<repo.WorkspaceBooking>
    sharedBookings: WorkspaceSummaryList<repo.SharedBookingRow>
    pendingShareItems: WorkspaceSummaryList<repo.PendingShareItem>
  }
}

type ProfileUpdateInput = {
  job_title?: string
  profile_photo_url?: string
  email_signature?: string
}

function pct(value: number, max: number | null) {
  if (!max || max <= 0) return null
  return Math.min(Math.round((value / max) * 100), 100)
}

function computeMetrics(recognisedShares: repo.RecognisedShareRow[], quotesSent: number, bookingsConverted: number): WorkspaceMetrics {
  const recognisedProfit = Number(
    recognisedShares.reduce((sum, row) => sum + Number(row.staffShare || 0), 0).toFixed(2),
  )
  const commission = Number(
    recognisedShares.reduce((sum, row) => sum + calculateCommission(row.staffShare), 0).toFixed(2),
  )

  return {
    quotesSent,
    bookingsConverted,
    conversionRate: quotesSent > 0 ? Math.round((bookingsConverted / quotesSent) * 100) : 0,
    recognisedProfit,
    commission,
  }
}

function bestQuoteProfit(deal: repo.WorkspaceDeal) {
  const quotes = deal.quotes || []
  if (quotes.length === 0) return 0
  const sentQuotes = quotes
    .filter(quote => !!quote.sent_to_client)
    .sort((a, z) => new Date(z.created_at || '').getTime() - new Date(a.created_at || '').getTime())
  const best = sentQuotes[0] || [...quotes].sort((a, z) => new Date(z.created_at || '').getTime() - new Date(a.created_at || '').getTime())[0]
  return Number(best?.profit || 0)
}

export async function getWorkspaceData(staffId: number): Promise<WorkspaceResponse> {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const currentPeriod = `${year}-${String(month).padStart(2, '0')}`
  const yearStartPeriod = `${year}-01`
  const monthStartIso = new Date(year, month - 1, 1).toISOString()
  const monthEndIso = new Date(year, month, 0, 23, 59, 59).toISOString()
  const yearStartIso = new Date(year, 0, 1).toISOString()
  const nowIso = now.toISOString()

  const [
    profile,
    currentTarget,
    yearTargets,
    deals,
    monthBookings,
    yearBookings,
    activeBookings,
    sharedBookings,
    pendingShareItems,
    monthRecognisedShares,
    ytdRecognisedShares,
  ] = await Promise.all([
    repo.getWorkspaceProfile(staffId),
    repo.getCurrentTarget(month, year),
    repo.getYearTargets(year),
    repo.getDealsForStaff(staffId),
    repo.getConfirmedBookingsForStaff(staffId, monthStartIso, monthEndIso),
    repo.getConfirmedBookingsForStaff(staffId, yearStartIso, nowIso),
    repo.getActiveBookingsForStaff(staffId),
    repo.getSharedBookingsForStaff(staffId),
    repo.getPendingShareItems(staffId),
    repo.getRecognisedSharesForStaff(staffId, currentPeriod, currentPeriod),
    repo.getRecognisedSharesForStaff(staffId, yearStartPeriod, currentPeriod),
  ])

  if (!profile) {
    throw new Error('Workspace profile not found')
  }

  const dealIds = deals.map(deal => deal.id)
  const [monthQuoteRows, yearQuoteRows] = await Promise.all([
    repo.getQuoteActivityForDeals(dealIds, monthStartIso, monthEndIso),
    repo.getQuoteActivityForDeals(dealIds, yearStartIso, nowIso),
  ])

  const myDeals = deals.filter(deal => !['BOOKED', 'LOST'].includes(deal.stage))
  const potential = myDeals.reduce((sum, deal) => ({
    pipelineValue: sum.pipelineValue + Number(deal.deal_value || 0),
    expectedProfit: sum.expectedProfit + bestQuoteProfit(deal),
  }), { pipelineValue: 0, expectedProfit: 0 })

  const monthly = computeMetrics(monthRecognisedShares, monthQuoteRows.length, monthBookings.length)
  const yearMetrics = computeMetrics(ytdRecognisedShares, yearQuoteRows.length, yearBookings.length)

  const yearRevenue = Number(
    yearBookings.reduce((sum, booking) => sum + Number(booking.total_sell || 0), 0).toFixed(2),
  )
  const annualRevenueTarget = yearTargets.length > 0
    ? Number(yearTargets.reduce((sum, row) => sum + Number(row.revenue_target || 0), 0).toFixed(2))
    : null
  const annualRecognisedProfitTarget = yearTargets.length > 0
    ? Number(yearTargets.reduce((sum, row) => sum + Number(row.profit_target_gold || 0), 0).toFixed(2))
    : null

  return {
    profile,
    monthly,
    yearToDate: {
      ...yearMetrics,
      revenue: yearRevenue,
      targetProgress: {
        configuredMonths: yearTargets.length,
        revenueTarget: annualRevenueTarget,
        recognisedProfitTarget: annualRecognisedProfitTarget,
        revenueProgressPct: pct(yearRevenue, annualRevenueTarget),
        recognisedProfitProgressPct: pct(yearMetrics.recognisedProfit, annualRecognisedProfitTarget),
      },
    },
    monthlyBonusTier: currentTarget ? {
      bronze: Number(currentTarget.profit_target_bronze || 0),
      silver: Number(currentTarget.profit_target_silver || 0),
      gold: Number(currentTarget.profit_target_gold || 0),
      bonusBronze: Number(currentTarget.bonus_bronze || 0),
      bonusSilver: Number(currentTarget.bonus_silver || 0),
      bonusGold: Number(currentTarget.bonus_gold || 0),
      currentRecognisedProfit: monthly.recognisedProfit,
    } : null,
    potential: {
      pipelineValue: Number(potential.pipelineValue.toFixed(2)),
      expectedProfit: Number(potential.expectedProfit.toFixed(2)),
    },
    workload: {
      activeDeals: myDeals.length,
      confirmedBookings: activeBookings.length,
      sharedBookings: sharedBookings.length,
      pendingShareItems: pendingShareItems.length,
    },
    lists: {
      myDeals: {
        total: myDeals.length,
        items: myDeals.slice(0, 6),
      },
      myBookings: {
        total: activeBookings.length,
        items: activeBookings.slice(0, 6),
      },
      sharedBookings: {
        total: sharedBookings.length,
        items: sharedBookings.slice(0, 6),
      },
      pendingShareItems: {
        total: pendingShareItems.length,
        items: pendingShareItems.slice(0, 6),
      },
    },
  }
}

export async function updateWorkspaceProfile(staffId: number, input: ProfileUpdateInput) {
  const values = {
    job_title: input.job_title?.trim() || null,
    profile_photo_url: input.profile_photo_url?.trim() || null,
    email_signature: input.email_signature?.trim() || null,
  }

  return repo.updateWorkspaceProfile(staffId, values)
}
