import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Deal = {
  id: number
  title: string
  client_id: number
  stage: string
  deal_value: number
  departure_date: string
  source: string
  next_activity_at: string
  next_activity_type: string
  lost_reason: string
  created_at: string
  clients?: Client
}

export type Client = {
  id: number
  first_name: string
  last_name: string
  email: string
  phone: string
  created_at: string
}

export type Quote = {
  id: number
  deal_id: number
  hotel: string
  board_basis: string
  price: number
  profit: number
  version: number
  quote_ref: string
  departure_date: string
  nights: number
  adults: number
  children: number
  infants: number
  departure_airport: string
  airline: string
  sent_to_client: boolean
  consultant_initials: string
  created_at: string
}

export type Activity = {
  id: number
  deal_id: number
  activity_type: string
  notes: string
  created_at: string
}

export type Booking = {
  id: number
  deal_id: number
  booking_reference: string
  deposit_received: boolean
  balance_due_date: string
  departure_date: string
  return_date: string
  created_at: string
}

export type BookingTask = {
  id: number
  booking_id: number
  task_name: string
  task_key: string
  sort_order: number
  is_done: boolean
  status: string
  due_date: string
  completed_at: string
}

export const STAGES = [
  'NEW_LEAD',
  'QUOTE_SENT', 
  'ENGAGED',
  'FOLLOW_UP',
  'DECISION_PENDING',
  'BOOKED',
  'LOST',
] as const

export const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: 'New Lead',
  QUOTE_SENT: 'Quote Sent',
  ENGAGED: 'Engaged',
  FOLLOW_UP: 'Follow Up',
  DECISION_PENDING: 'Decision Pending',
  BOOKED: 'Booked',
  LOST: 'Lost',
}

export const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: '#6366f1',
  QUOTE_SENT: '#f59e0b',
  ENGAGED: '#3b82f6',
  FOLLOW_UP: '#8b5cf6',
  DECISION_PENDING: '#ec4899',
  BOOKED: '#10b981',
  LOST: '#ef4444',
}