import { supabase } from '@/lib/supabase'
import { dbMutate } from '@/lib/api-client'

export type LostDeal = {
  id: number
  title: string
  stage: string
  deal_value: number | null
  departure_date: string | null
  next_activity_at: string | null
  next_activity_type: string | null
  next_activity_note: string | null
  lost_reason: string | null
  lost_structured_reason: string | null
  lost_at: string | null
  source: string | null
  created_at: string
  clients?: { first_name: string; last_name: string }
  quotes?: { id: number; quote_ref: string | null; price: number | null }[]
}

export async function getLostDeals(): Promise<LostDeal[]> {
  const { data } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name), quotes(id, quote_ref, price)')
    .eq('stage', 'LOST')
    .order('lost_at', { ascending: false, nullsFirst: false })

  return (data as LostDeal[]) || []
}

export async function updateDeal(id: number, values: Partial<LostDeal>) {
  return dbMutate({
    table: 'deals',
    action: 'update',
    values,
    filters: [{ column: 'id', value: id }],
  })
}

export async function createActivity(values: { deal_id: number; activity_type: string; notes: string }) {
  return dbMutate({
    table: 'activities',
    action: 'insert',
    values,
  })
}
