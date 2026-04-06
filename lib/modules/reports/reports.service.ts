import * as repo from './reports.repository'

export type Target = {
  id?: number
  month: number
  year: number
  revenue_target?: number
  profit_target?: number
  bookings_target?: number
  quotes_target?: number
  leads_target?: number
  rotten_days?: number
  profit_target_bronze?: number
  profit_target_silver?: number
  profit_target_gold?: number
  bonus_bronze?: number
  bonus_silver?: number
  bonus_gold?: number
  [key: string]: unknown
}

export type ReportData = {
  monthlyData: repo.MonthlyData[]
  lostReasons: repo.LostReason[]
  stageBreakdown: repo.StageBreakdown[]
  targets: Target | null
  staffUsers: repo.StaffUser[]
  assignmentHealth: repo.AssignmentHealth
}

export type CommissionData = {
  rows: repo.CommissionRow[]
}

export type SalesData = {
  rows: repo.SalesRow[]
  bookings: repo.SalesBookingRow[]
  unassigned: repo.SalesUnassigned
}

export type QuoteData = {
  rows: repo.QuoteRow[]
  recentRows: repo.QuoteRecentRow[]
  unassigned: repo.QuoteUnassigned
}

export type StaffUserInput = {
  name: string
  role: string
}

// ── MAIN REPORT DATA ──────────────────────────────────────────
export async function getReportData(year: number): Promise<ReportData> {
  const [
    monthlyData,
    lostReasons,
    stageBreakdown,
    staffUsers,
    assignmentHealth,
    targets
  ] = await Promise.all([
    repo.getMonthlyData(year),
    repo.getLostReasons(),
    repo.getStageBreakdown(),
    repo.getStaffUsers(),
    repo.getAssignmentHealth(),
    repo.getTargets(new Date().getMonth() + 1, new Date().getFullYear())
  ])

  return {
    monthlyData,
    lostReasons,
    stageBreakdown,
    targets,
    staffUsers,
    assignmentHealth,
  }
}

// ── COMMISSION REPORT ─────────────────────────────────────────
export async function getCommissionReport(staffId: number, from: string, to: string): Promise<CommissionData> {
  const rows = await repo.getCommissionData(staffId, from, to)
  return { rows }
}

// ── SALES REPORT ──────────────────────────────────────────────
export async function getSalesReport(from: string, to: string): Promise<SalesData> {
  const staffUsers = await repo.getStaffUsers()
  const { fromIso, toIso } = dateTimeRange(from, to)
  const result = await repo.getSalesData(fromIso, toIso, staffUsers)
  return result
}

// ── QUOTES REPORT ─────────────────────────────────────────────
export async function getQuotesReport(from: string, to: string): Promise<QuoteData> {
  const staffUsers = await repo.getStaffUsers()
  const { fromIso, toIso } = dateTimeRange(from, to)
  const result = await repo.getQuoteData(fromIso, toIso, staffUsers)
  return result
}

export async function createStaffUser(input: StaffUserInput) {
  const name = input.name.trim()
  if (!name) {
    throw new Error('Staff name is required')
  }

  return repo.createStaffUser({
    name,
    role: input.role,
    is_active: true,
  })
}

export async function saveTargets(input: Target) {
  const now = new Date()
  return repo.saveTargets({
    ...input,
    month: now.getMonth() + 1,
    year: now.getFullYear(),
  } as repo.Target)
}

// ── UTILITY FUNCTIONS ─────────────────────────────────────────
function dateTimeRange(from: string, to: string) {
  return {
    fromIso: `${from}T00:00:00.000Z`,
    toIso: `${to}T23:59:59.999Z`,
  }
}

export function calculateCommission(total: number): number {
  const firstBand = Math.min(total, 10000)
  const secondBand = Math.max(total - 10000, 0)
  return firstBand * 0.1 + secondBand * 0.15
}

export function formatDuration(hours: number): string {
  if (!hours || hours <= 0) return '—'
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

export function startOfMonth(value: string): string {
  return `${value}-01`
}

export function endOfMonth(value: string): string {
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month, 0).toISOString().split('T')[0]
}

export function previousMonthValue(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function previousMonthRange(): { from: string; to: string } {
  const monthValue = previousMonthValue()
  return {
    from: startOfMonth(monthValue),
    to: endOfMonth(monthValue),
  }
}

export function currentMonthRange(): { from: string; to: string } {
  const now = new Date()
  const monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return {
    from: startOfMonth(monthValue),
    to: now.toISOString().split('T')[0],
  }
}
