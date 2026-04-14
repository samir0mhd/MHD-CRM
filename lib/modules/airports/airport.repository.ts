'use server'

import { supabase } from '@/lib/supabase'

export type StoredAirport = {
  code: string
  name: string
  city: string
  country: string
  created_at?: string
}

export async function listStoredAirports(): Promise<StoredAirport[]> {
  const { data, error } = await supabase
    .from('airport_codes')
    .select('code,name,city,country,created_at')
    .order('code')

  if (error) {
    if (error.code === '42P01') return []
    throw error
  }
  return (data || []) as StoredAirport[]
}

export async function insertAirport(values: StoredAirport): Promise<StoredAirport> {
  const { data, error } = await supabase
    .from('airport_codes')
    .insert(values)
    .select('code,name,city,country,created_at')
    .single()

  if (error) {
    if (error.code === '23505') throw new Error(`Airport code ${values.code} already exists`)
    if (error.code === '42P01') throw new Error('Airport lookup table is not installed yet')
    throw new Error(error.message)
  }

  return data as StoredAirport
}
