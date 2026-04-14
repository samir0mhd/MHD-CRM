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

// ── PAYROLL SHEETS ────────────────────────────────────────────

/** Computes payable_month = period + 1 calendar month. */
function nextMonth(period: string): string {
  const [y, m] = period.split('-').map(Number)
  const next = new Date(y, m, 1) // m is already 1-based; new Date(y, m, 1) = first of month+1
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}`
}

export type IssueSheetInput = {
  period: string        // 'YYYY-MM'
  staffId: number
  issuedById: number
  totalCommission: number
  manualBonus: number   // manual override — separate from tier bonus
}

/**
 * Issues a payroll sheet for the given staff member + recognition period.
 * Auto-reads the bonus event for the period (if any) and snapshots it.
 * total_payable = commission + tier_bonus + manual_bonus
 * Idempotent — re-issuing updates the snapshot.
 */
export async function issuePayrollSheet(input: IssueSheetInput): Promise<repo.PayrollSheet> {
  const bonusEvent = await repo.getBonusEvent(input.staffId, input.period)
  const bonusAmount = bonusEvent ? Number(bonusEvent.bonus_amount) : 0
  const totalPayable = Number(
    (input.totalCommission + bonusAmount + input.manualBonus).toFixed(2),
  )
  return repo.issuePayrollSheet({
    period: input.period,
    staff_id: input.staffId,
    payable_month: nextMonth(input.period),
    issued_by: input.issuedById,
    total_commission: Number(input.totalCommission.toFixed(2)),
    manual_bonus: Number(input.manualBonus.toFixed(2)),
    bonus_amount: Number(bonusAmount.toFixed(2)),
    bonus_tier: bonusEvent?.tier ?? null,
    total_payable: totalPayable,
  })
}

// ── BONUS EVENTS ──────────────────────────────────────────────

export type BonusEvent = repo.BonusEvent

/**
 * Computes the tier bonus for a staff member in a given recognition period.
 * Reads recognised profit from the DB, evaluates tier thresholds from the targets table,
 * and upserts a commission_bonus_events row.
 * Returns null if no tier threshold is met or targets are not configured.
 * Idempotent — safe to call multiple times for the same period.
 */
export async function ensureBonusEvent(
  staffId: number,
  period: string,
): Promise<repo.BonusEvent | null> {
  const [recognisedProfit, rawTargets] = await Promise.all([
    repo.getRecognisedProfitTotal(staffId, period),
    repo.getTargets(
      Number(period.split('-')[1]),
      Number(period.split('-')[0]),
    ),
  ])

  if (!rawTargets || recognisedProfit <= 0) return null

  const bronze = rawTargets.profit_target_bronze ?? null
  const silver = rawTargets.profit_target_silver ?? null
  const gold   = rawTargets.profit_target_gold   ?? null

  let tier: repo.BonusTier | null = null
  let bonusAmount = 0

  if (gold != null && recognisedProfit >= gold && (rawTargets.bonus_gold ?? 0) > 0) {
    tier = 'gold'
    bonusAmount = rawTargets.bonus_gold ?? 0
  } else if (silver != null && recognisedProfit >= silver && (rawTargets.bonus_silver ?? 0) > 0) {
    tier = 'silver'
    bonusAmount = rawTargets.bonus_silver ?? 0
  } else if (bronze != null && recognisedProfit >= bronze && (rawTargets.bonus_bronze ?? 0) > 0) {
    tier = 'bronze'
    bonusAmount = rawTargets.bonus_bronze ?? 0
  }

  if (!tier || bonusAmount <= 0) return null

  return repo.upsertBonusEvent(staffId, period, bonusAmount, tier, recognisedProfit)
}

/** Returns the current bonus event for a staff member + period. */
export async function getBonusEventForPeriod(
  staffId: number,
  period: string,
): Promise<repo.BonusEvent | null> {
  return repo.getBonusEvent(staffId, period)
}

export async function getPayrollSheetsForPeriod(period: string): Promise<repo.PayrollSheet[]> {
  return repo.getPayrollSheetsByPeriod(period)
}

export async function getPayrollSheet(period: string, staffId: number): Promise<repo.PayrollSheet | null> {
  return repo.getPayrollSheet(period, staffId)
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
