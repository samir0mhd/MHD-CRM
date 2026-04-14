import { supabase } from '@/lib/supabase'

export type PendingClaimRow = {
  id: number
  booking_id: number
  reason: string
  created_at: string
  claimant: { name: string } | null
  bookings: {
    booking_reference: string
    deals: { title: string; clients: { first_name: string; last_name: string } | null } | null
  } | null
}

export type PendingFlagRow = {
  id: number
  booking_id: number
  flagged_at: string
  original_staff: { name: string } | null
  handling_staff: { name: string } | null
  bookings: {
    booking_reference: string
    deals: { title: string; clients: { first_name: string; last_name: string } | null } | null
  } | null
}

export async function getPendingClaims(): Promise<PendingClaimRow[]> {
  const { data } = await supabase
    .from('booking_ownership_claims')
    .select(`
      id, booking_id, reason, created_at,
      claimant:staff_users!claimant_id(name),
      bookings(booking_reference, deals(title, clients(first_name, last_name)))
    `)
    .eq('status', 'pending')
    .order('created_at')
  return (data || []) as unknown as PendingClaimRow[]
}

export async function getPendingRepeatFlags(): Promise<PendingFlagRow[]> {
  const { data } = await supabase
    .from('client_repeat_flags')
    .select(`
      id, booking_id, flagged_at,
      original_staff:staff_users!original_staff_id(name),
      handling_staff:staff_users!handling_staff_id(name),
      bookings(booking_reference, deals(title, clients(first_name, last_name)))
    `)
    .is('resolution', null)
    .order('flagged_at')
  return (data || []) as unknown as PendingFlagRow[]
}
