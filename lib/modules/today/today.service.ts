import * as repo from './today.repository'
import type { StaffUser } from '@/lib/access'

export type DealAction = repo.DealActionQuery & {
  priority_score: number
  days_overdue: number
}

export type BalanceAlert = repo.BalanceAlertQuery & {
  days_overdue: number
}

export type TicketAlert = repo.TicketAlertQuery & {
  days_until: number
}

export type DepartureAlert = repo.DepartureAlertQuery & {
  days_until: number
}

export type BookingTaskAlert = repo.BookingTaskAlertQuery & {
  days_until: number
}

export type TodayData = {
  actions: DealAction[]
  upcoming: DealAction[]
  balanceAlerts: BalanceAlert[]
  ticketAlerts: TicketAlert[]
  departureAlerts: DepartureAlert[]
  taskAlerts: BookingTaskAlert[]
}

const STAGE_WEIGHT: Record<string, number> = {
  DECISION_PENDING: 50,
  FOLLOW_UP: 30,
  ENGAGED: 20,
  QUOTE_SENT: 10,
  NEW_LEAD: 5,
}

function priorityScore(dealValue: number, daysOverdue: number, stage: string): number {
  return Math.round(Math.min(dealValue / 1000, 50) + Math.min(daysOverdue * 10, 100) + (STAGE_WEIGHT[stage] || 0))
}

export async function getTodayData(): Promise<TodayData> {
  const now = new Date()
  const todayEnd = new Date(now)
  todayEnd.setHours(23, 59, 59, 999)
  const weekAhead = new Date(now.getTime() + 7 * 86400000)
  const today = now.toISOString().split('T')[0]
  const in7days = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0]
  const in14days = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0]

  const [dealData, balData, tickData, depData, taskData] = await Promise.all([
    repo.getDueDeals(),
    repo.getBalanceAlerts(in7days),
    repo.getTicketAlerts(in14days),
    repo.getDepartureAlerts(today, in14days),
    repo.getTaskAlerts(in14days),
  ])

  const overdueDue: DealAction[] = []
  const upcomingList: DealAction[] = []
  for (const deal of dealData) {
    const daysOverdue = Math.floor((now.getTime() - new Date(deal.next_activity_at).getTime()) / 86400000)
    const item: DealAction = {
      ...deal,
      days_overdue: daysOverdue,
      priority_score: priorityScore(deal.deal_value || 0, daysOverdue, deal.stage),
    }
    if (new Date(deal.next_activity_at) <= todayEnd) overdueDue.push(item)
    else if (new Date(deal.next_activity_at) <= weekAhead) upcomingList.push(item)
  }
  overdueDue.sort((a, b) => b.priority_score - a.priority_score)
  upcomingList.sort((a, b) => new Date(a.next_activity_at).getTime() - new Date(b.next_activity_at).getTime())

  const balanceAlerts: BalanceAlert[] = balData.map(booking => ({
    ...booking,
    days_overdue: Math.floor((now.getTime() - new Date(booking.balance_due_date + 'T12:00').getTime()) / 86400000),
  }))

  const ticketAlerts: TicketAlert[] = tickData
    .filter(flight => flight.bookings?.status !== 'CANCELLED')
    .map(flight => ({
      ...flight,
      days_until: Math.floor((new Date(flight.ticketing_deadline + 'T12:00').getTime() - now.getTime()) / 86400000),
    }))

  const departureAlerts: DepartureAlert[] = depData
    .filter(booking => booking.status !== 'CANCELLED')
    .map(booking => ({
      ...booking,
      days_until: Math.floor((new Date(booking.departure_date + 'T12:00').getTime() - now.getTime()) / 86400000),
    }))

  const taskAlerts: BookingTaskAlert[] = taskData
    .filter(task => {
      const bookingStatus = task.bookings?.status
      if (task.task_key?.startsWith('ops_request_')) return bookingStatus === 'CONFIRMED'
      if (task.task_key?.startsWith('cancel_followup_')) return bookingStatus === 'CANCELLED'
      return false
    })
    .map(task => ({
      ...task,
      days_until: Math.floor((new Date(task.due_date + 'T12:00').getTime() - now.getTime()) / 86400000),
    }))

  return {
    actions: overdueDue,
    upcoming: upcomingList,
    balanceAlerts,
    ticketAlerts,
    departureAlerts,
    taskAlerts,
  }
}

export async function completeDealAction(deal: { id: number; stage: string; next_activity_type: string | null }) {
  await repo.clearDealNextAction(deal.id)
  await repo.addDealActivity(
    deal.id,
    deal.next_activity_type || 'NOTE',
    `Action completed — ${deal.stage}`
  )
}

export async function snoozeDealAction(dealId: number, days: number) {
  const newDate = new Date()
  newDate.setDate(newDate.getDate() + days)
  newDate.setHours(9, 0, 0, 0)
  await repo.updateDealNextAction(dealId, newDate.toISOString())
}

export async function completeTask(id: number, currentStaff: StaffUser | null = null) {
  const info = await repo.getTaskWithBookingInfo(id).catch(() => null)
  const completedAt = new Date().toISOString()
  const result = await repo.completeBookingTask(id, completedAt)
  if (!result.error && info?.deal_id) {
    const actor = currentStaff?.name || 'Unknown staff'
    await repo.addDealActivity(
      info.deal_id,
      'TASK_COMPLETED',
      `${actor} completed booking task "${info.task_name}" for ${info.booking_reference}`
    ).catch(() => null)
  }
  return result
}
