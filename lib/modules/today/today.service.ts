import * as repo from './today.repository'
import type { StaffUser } from '@/lib/access'
import {
  dayOffsetFromToday,
  getDisplayActionNote,
  getDisplayActionType,
  toDateOnly,
} from '@/lib/modules/deals/next-action'

export type ActionUrgency = 'overdue' | 'today' | 'coming_up'

export type DealAction = {
  id: number
  title: string
  stage: string
  deal_value: number
  action_type: string
  action_note: string
  due_date: string
  priority_score: number
  urgency: ActionUrgency
  days_overdue: number
  days_until: number
  clients?: repo.DealActionQuery['clients']
}

export type ActionSection = {
  key: ActionUrgency
  label: string
  items: DealAction[]
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
  actionSections: ActionSection[]
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

function todayDateOnly(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function priorityScore(dealValue: number, daysOverdue: number, stage: string): number {
  return Math.round(Math.min(dealValue / 1000, 50) + Math.min(daysOverdue * 10, 100) + (STAGE_WEIGHT[stage] || 0))
}

function buildActionSections(dealData: repo.DealActionQuery[], today: string): ActionSection[] {
  const sections: Record<ActionUrgency, DealAction[]> = {
    overdue: [],
    today: [],
    coming_up: [],
  }

  for (const deal of dealData) {
    const dueDate = toDateOnly(deal.next_activity_at)
    if (!dueDate) continue

    const dayOffset = dayOffsetFromToday(dueDate, today)
    const daysOverdue = dayOffset < 0 ? Math.abs(dayOffset) : 0
    const urgency: ActionUrgency = dayOffset < 0 ? 'overdue' : dayOffset === 0 ? 'today' : 'coming_up'
    const actionType = getDisplayActionType(deal.next_activity_type, true)
    const actionNote = getDisplayActionNote(deal.next_activity_note, true)

    if (!actionType || !actionNote) continue

    sections[urgency].push({
      id: deal.id,
      title: deal.title,
      stage: deal.stage,
      deal_value: deal.deal_value || 0,
      action_type: actionType,
      action_note: actionNote,
      due_date: dueDate,
      urgency,
      days_overdue: daysOverdue,
      days_until: dayOffset > 0 ? dayOffset : 0,
      priority_score: priorityScore(deal.deal_value || 0, daysOverdue, deal.stage),
      clients: deal.clients,
    })
  }

  sections.overdue.sort((a, b) => a.due_date.localeCompare(b.due_date) || b.priority_score - a.priority_score)
  sections.today.sort((a, b) => b.priority_score - a.priority_score || a.title.localeCompare(b.title))
  sections.coming_up.sort((a, b) => a.due_date.localeCompare(b.due_date) || b.priority_score - a.priority_score)

  return [
    { key: 'overdue', label: 'Overdue', items: sections.overdue },
    { key: 'today', label: 'Today', items: sections.today },
    { key: 'coming_up', label: 'Coming Up', items: sections.coming_up },
  ]
}

export async function getTodayData(): Promise<TodayData> {
  const now = new Date()
  const today = todayDateOnly(now)
  const in7days = new Date(now.getTime() + 7 * 86400000).toISOString().split('T')[0]
  const in14days = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0]

  const [dealData, balData, tickData, depData, taskData] = await Promise.all([
    repo.getDueDeals(),
    repo.getBalanceAlerts(in7days),
    repo.getTicketAlerts(in14days),
    repo.getDepartureAlerts(today, in14days),
    repo.getTaskAlerts(in14days),
  ])

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
    actionSections: buildActionSections(dealData, today),
    balanceAlerts,
    ticketAlerts,
    departureAlerts,
    taskAlerts,
  }
}

export async function completeDealAction(deal: { id: number; stage: string; action_type: string | null }) {
  await repo.clearDealNextAction(deal.id)
  await repo.addDealActivity(
    deal.id,
    deal.action_type || 'NOTE',
    `Action completed - ${deal.stage}`
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
