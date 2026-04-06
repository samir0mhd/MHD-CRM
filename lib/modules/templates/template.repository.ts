import { supabase } from '@/lib/supabase'
import { dbMutate } from '@/lib/api-client'

export type Template = {
  id: number
  name: string
  description: string
  subject_line: string
  opening_hook: string
  why_choose_us: string
  urgency_notice: string
  closing_cta: string
  is_built_in: boolean
  created_at: string
}

export async function getCustomTemplates(): Promise<Template[]> {
  const { data } = await supabase
    .from('email_templates')
    .select('*')
    .eq('is_built_in', false)
    .order('created_at', { ascending: false })

  return (data as Template[]) || []
}

export async function createTemplate(values: Omit<Template, 'id' | 'created_at'>) {
  return dbMutate({
    table: 'email_templates',
    action: 'insert',
    values,
  })
}

export async function updateTemplate(id: number, values: Partial<Template>) {
  return dbMutate({
    table: 'email_templates',
    action: 'update',
    values,
    filters: [{ column: 'id', value: id }],
  })
}

export async function deleteTemplate(id: number) {
  return dbMutate({
    table: 'email_templates',
    action: 'delete',
    filters: [{ column: 'id', value: id }],
  })
}
