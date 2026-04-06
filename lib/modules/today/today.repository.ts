import { supabase } from '@/lib/supabase'
import { dbMutate } from '@/lib/api-client'

export type DealActionQuery = {
  id: number
  title: string
  stage: string
  deal_value: number
  next_activity_at: string
  next_activity_type: string | null
  clients?: { first_name: string; last_name: string; phone?: string; email?: string }
}

export type BalanceAlertQuery = {
  id: number
  booking_reference: string
  departure_date: string | null
  balance_due_date: string
  total_sell: number | null
  deals?: { title: string; clients?: { first_name: string; last_name: string; phone?: string; email?: string } }
}

export type TicketAlertQuery = {
  id: number
  booking_id: number
  flight_number: string | null
  airline: string | null
  origin: string | null
  destination: string | null
  ticketing_deadline: string
  departure_date: string | null
  bookings?: { status?: string | null; booking_reference: string; deals?: { title: string; clients?: { first_name: string; last_name: string; phone?: string; email?: string } } }
}

export type DepartureAlertQuery = {
  id: number
  booking_reference: string
  departure_date: string
  destination: string | null
  status?: string | null
  deals?: { title: string; clients?: { first_name: string; last_name: string } }
}

export type BookingTaskAlertQuery = {
  id: number
  booking_id: number
  task_name: string
  task_key: string
  category: string
  notes: string | null
  due_date: string
  bookings?: {
    status?: string | null
    booking_reference: string
    departure_date: string | null
    deals?: { title: string; clients?: { first_name: string; last_name: string; phone?: string; email?: string } }
  }
}

export async function getDueDeals() {
  const { data } = await supabase
    .from('deals')
    .select('id,title,stage,deal_value,next_activity_at,next_activity_type,clients(first_name,last_name,phone,email)')
    .not('stage', 'in', '("BOOKED","LOST")')
    .not('next_activity_at', 'is', null)
    .order('next_activity_at', { ascending: true })

  return (data as DealActionQuery[]) || []
}

export async function getBalanceAlerts(in7days: string) {
  const { data } = await supabase
    .from('bookings')
    .select('id,booking_reference,departure_date,balance_due_date,total_sell,deals(title,clients(first_name,last_name,phone,email))')
    .not('balance_due_date', 'is', null)
    .lte('balance_due_date', in7days)
    .not('status', 'eq', 'CANCELLED')
    .is('balance_cleared_at', null)
    .order('balance_due_date', { ascending: true })

  return (data as BalanceAlertQuery[]) || []
}

export async function getTicketAlerts(in14days: string) {
  const { data } = await supabase
    .from('booking_flights')
    .select('id,booking_id,flight_number,airline,origin,destination,ticketing_deadline,departure_date,bookings(status,booking_reference,deals(title,clients(first_name,last_name,phone,email)))')
    .not('ticketing_deadline', 'is', null)
    .lte('ticketing_deadline', in14days)
    .not('net_cost', 'is', null)
    .order('ticketing_deadline', { ascending: true })

  return (data as TicketAlertQuery[]) || []
}

export async function getDepartureAlerts(today: string, in14days: string) {
  const { data } = await supabase
    .from('bookings')
    .select('id,booking_reference,departure_date,destination,status,deals(title,clients(first_name,last_name))')
    .not('departure_date', 'is', null)
    .gte('departure_date', today)
    .lte('departure_date', in14days)
    .order('departure_date', { ascending: true })

  return (data as DepartureAlertQuery[]) || []
}

export async function getTaskAlerts(in14days: string) {
  const { data } = await supabase
    .from('booking_tasks')
    .select('id,booking_id,task_name,task_key,category,notes,due_date,bookings!inner(booking_reference,departure_date,status,deals(title,clients(first_name,last_name,phone,email)))')
    .eq('is_done', false)
    .not('due_date', 'is', null)
    .lte('due_date', in14days)
    .order('due_date', { ascending: true })

  return (data as BookingTaskAlertQuery[]) || []
}

export async function clearDealNextAction(id: number) {
  return dbMutate({
    table: 'deals',
    action: 'update',
    values: { next_activity_at: null, next_activity_type: null },
    filters: [{ column: 'id', value: id }],
  })
}

export async function addDealActivity(dealId: number, activityType: string, notes: string) {
  return dbMutate({
    table: 'activities',
    action: 'insert',
    values: {
      deal_id: dealId,
      activity_type: activityType,
      notes,
    },
  })
}

export async function updateDealNextAction(id: number, nextActivityAt: string) {
  return dbMutate({
    table: 'deals',
    action: 'update',
    values: { next_activity_at: nextActivityAt },
    filters: [{ column: 'id', value: id }],
  })
}

export async function completeBookingTask(id: number, completedAt: string) {
  return dbMutate({
    table: 'booking_tasks',
    action: 'update',
    values: { status: 'done', is_done: true, completed_at: completedAt },
    filters: [{ column: 'id', value: id }],
  })
}

export async function getTaskWithBookingInfo(taskId: number): Promise<{ task_name: string; booking_reference: string; deal_id: number } | null> {
  const { data } = await supabase
    .from('booking_tasks')
    .select('task_name, bookings(booking_reference, deal_id)')
    .eq('id', taskId)
    .maybeSingle()
  if (!data) return null
  const booking = data.bookings as { booking_reference: string; deal_id: number } | null
  if (!booking?.deal_id) return null
  return {
    task_name: data.task_name,
    booking_reference: booking.booking_reference,
    deal_id: booking.deal_id,
  }
}
