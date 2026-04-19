'use server'

import { supabase } from '@/lib/supabase'
import { dbMutate } from '@/lib/api-client'

// Types
export interface FlightLeg {
  id: string
  flight_number?: string
  date?: string
  depart_time?: string
  arrival_time?: string
  checkin_time?: string
  airline?: string
  from?: string
  to?: string
  cabin?: string
  overnight?: boolean
}

export interface ExtraItem {
  id: string
  label: string
  net: number
}

export interface HotelOption {
  id: string
  hotel: string
  roomType?: string
  boardBasis: string
  nights: string
  checkinDate?: string
  checkinNextDay: boolean
  outLegs: FlightLeg[]
  retLegs: FlightLeg[]
  flightNet: string
  accNet: string
  transNet: string
  extras: ExtraItem[]
  sellPrice: string
  margin: string
  profit: string
}

export interface Centre {
  id: string
  destination: string
  hotel: string
  roomType?: string
  boardBasis: string
  nights: string
  checkinDate?: string
  checkinNextDay: boolean
  inboundLegs: FlightLeg[]
  outboundLegs: FlightLeg[]
  flightNet: string
  accNet: string
  transNet: string
  extras: ExtraItem[]
}

export interface DealInfo {
  id: number
  title: string
  departure_date?: string
  clients?: {
    first_name: string
    last_name: string
    email: string
    phone?: string
  }
}

export interface EmailTemplate {
  id: number
  name: string
  description?: string
  opening_hook?: string
  why_choose_us?: string
  urgency_notice?: string
  closing_cta?: string
}

export interface QuoteReferenceRow {
  id: number
  quote_ref?: string | null
}

export interface CreatedQuoteRow {
  id: number
  quote_ref?: string | null
  version?: number | null
}

// Repository functions
export async function searchTable(table: string, query: string): Promise<string[]> {
  if (!query.trim()) return []

  const { data } = await supabase
    .from(table)
    .select('name')
    .ilike('name', `%${query}%`)
    .limit(10)

  return data?.map(item => item.name) || []
}

export async function saveToTable(table: string, field: string, value: string): Promise<void> {
  await dbMutate({
    table,
    action: 'insert',
    values: { [field]: value.trim() },
  })
}

export async function getAllDeals(): Promise<DealInfo[]> {
  const { data } = await supabase
    .from('deals')
    .select('id,title,departure_date,clients(first_name,last_name,email)')
    .not('stage', 'in', '("BOOKED","LOST")')
    .order('created_at', { ascending: false })

  return (data || []) as unknown as DealInfo[]
}

export async function getDealById(id: number): Promise<DealInfo | null> {
  const { data } = await supabase
    .from('deals')
    .select('id,title,departure_date,clients(first_name,last_name,email,phone)')
    .eq('id', id)
    .single()

  return data as unknown as DealInfo | null
}

export async function getQuoteReferenceRowsForDeal(dealId: number): Promise<QuoteReferenceRow[]> {
  const { data } = await supabase
    .from('quotes')
    .select('id,quote_ref')
    .eq('deal_id', dealId)

  return (data as QuoteReferenceRow[]) || []
}

export async function getQuoteCountForDeal(dealId: number): Promise<number> {
  const quoteRows = await getQuoteReferenceRowsForDeal(dealId)
  const logicalQuotes = new Set(
    quoteRows.map(quote => quote.quote_ref?.trim() || `legacy:${quote.id}`)
  )

  return logicalQuotes.size
}

export async function getQuoteById(quoteId: number): Promise<any> {
  const { data } = await supabase
    .from('quotes')
    .select('*')
    .eq('id', quoteId)
    .single()

  return data
}

export async function getQuotesByRef(dealId: number, quoteRef: string): Promise<any[]> {
  if (!quoteRef.trim()) return []

  const { data } = await supabase
    .from('quotes')
    .select('*')
    .eq('deal_id', dealId)
    .eq('quote_ref', quoteRef)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })

  return data || []
}

export async function getCustomTemplates(): Promise<EmailTemplate[]> {
  const { data } = await supabase
    .from('email_templates')
    .select('id,name,description,opening_hook,why_choose_us,urgency_notice,closing_cta')
    .eq('is_built_in', false)
    .order('created_at', { ascending: false })

  return data || []
}

export async function createQuote(quoteData: any): Promise<CreatedQuoteRow | null> {
  const { data } = await dbMutate<CreatedQuoteRow>({
    table: 'quotes',
    action: 'insert',
    values: quoteData,
    select: 'id,quote_ref,version',
    returning: 'single',
  })

  return data
}

export async function updateQuote(quoteId: number, quoteData: any): Promise<void> {
  await dbMutate({
    table: 'quotes',
    action: 'update',
    values: quoteData,
    filters: [{ column: 'id', value: quoteId }],
  })
}

export async function deleteQuotes(quoteIds: number[]): Promise<void> {
  if (quoteIds.length === 0) return

  await dbMutate({
    table: 'quotes',
    action: 'delete',
    filters: [{ column: 'id', op: 'in', value: quoteIds }],
  })
}

export async function updateDeal(dealId: number, dealData: any): Promise<void> {
  await dbMutate({
    table: 'deals',
    action: 'update',
    values: dealData,
    filters: [{ column: 'id', value: dealId }],
  })
}

export async function createActivity(activityData: any): Promise<void> {
  await dbMutate({
    table: 'activities',
    action: 'insert',
    values: activityData,
  })
}
