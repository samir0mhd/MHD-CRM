import { supabase } from '@/lib/supabase'
import { dbMutate } from '@/lib/api-client'

export type FollowUp = {
  id: number
  deal_id: number
  sequence_day: number
  status: 'pending' | 'sent' | 'skipped'
  scheduled_for: string
  sent_at: string | null
  email_subject: string | null
  email_body: string | null
  created_at: string
  deals?: {
    id: number
    title: string
    stage: string
    clients?: { first_name: string; last_name: string; email: string }
  }
}

export async function getAllFollowUps(): Promise<FollowUp[]> {
  const { data } = await supabase
    .from('follow_up_sequences')
    .select('*, deals(id, title, stage, clients(first_name, last_name, email))')
    .order('scheduled_for', { ascending: true })

  return (data as FollowUp[]) || []
}

export async function updateFollowUp(id: number, values: Partial<FollowUp>) {
  return dbMutate({
    table: 'follow_up_sequences',
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
