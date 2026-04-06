'use server'

import { supabase } from '@/lib/supabase'
import { dbMutate } from '@/lib/api-client'

export type Client = {
  id: number
  first_name: string
  last_name: string
  phone: string
  email: string
  date_of_birth: string | null
  budget_min: number | null
  budget_max: number | null
  special_occasions: string | null
  behaviour_tags: string[]
  advisor_notes: string | null
  source: string | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_postcode: string | null
  billing_country: string | null
  owner_staff_id: number | null
  created_at: string
}

export type DealSnap = {
  id: number
  title: string
  stage: string
  deal_value: number
  departure_date: string | null
  created_at: string
}

export type ClientWithDeals = Client & {
  deals?: DealSnap[]
}

// ── DATA QUERIES ───────────────────────────────────────────
export async function getClientsWithDeals(): Promise<ClientWithDeals[]> {
  const { data } = await supabase
    .from('clients')
    .select('*, deals(id, title, stage, deal_value, departure_date, created_at)')
    .order('created_at', { ascending: false })

  return (data || []) as ClientWithDeals[]
}

export async function getClientById(id: number): Promise<ClientWithDeals | null> {
  const { data } = await supabase
    .from('clients')
    .select('*, deals(id, title, stage, deal_value, departure_date, created_at)')
    .eq('id', id)
    .single()

  return data as ClientWithDeals | null
}

// ── MUTATIONS ──────────────────────────────────────────────
export type CreateClientData = Omit<Client, 'id' | 'created_at'>

export async function createClient(data: CreateClientData): Promise<{ id: number }> {
  const { data: result, error } = await dbMutate<{ id: number }>({
    table: 'clients',
    action: 'insert',
    values: data,
    select: 'id',
    returning: 'single',
  })

  if (error) throw new Error(error.message)
  if (!result) throw new Error('Failed to create client')

  return result
}

export type UpdateClientData = Partial<CreateClientData>

export async function updateClient(id: number, data: UpdateClientData): Promise<{ id: number }> {
  const { data: result, error } = await dbMutate<{ id: number }>({
    table: 'clients',
    action: 'update',
    values: data,
    filters: [{ column: 'id', value: id }],
    select: 'id',
    returning: 'single',
  })

  if (error) throw new Error(error.message)
  if (!result) throw new Error('Failed to update client')

  return result
}