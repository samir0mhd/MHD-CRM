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
  lost_reason: string | null
  source: string | null
  created_at: string
  clients?: { first_name: string; last_name: string }
}

export async function getLostDeals(): Promise<LostDeal[]> {
  const { data } = await supabase
    .from('deals')
    .select('*, clients(first_name, last_name)')
    .eq('stage', 'LOST')
    .order('created_at', { ascending: false })

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
