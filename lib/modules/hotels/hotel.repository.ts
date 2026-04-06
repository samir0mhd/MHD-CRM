import { supabase } from '@/lib/supabase'
import { dbMutate } from '@/lib/api-client'

export type Supplier = {
  id: number
  name: string
  type: string | null
  payment_terms: string | null
  credit_agreement: boolean | null
  contact_name: string | null
  email: string | null
  phone: string | null
}

export type Hotel = {
  id: number
  name: string
  description: string | null
  star_rating: number | null
  region: string | null
  website_url: string | null
  mhd_url: string | null
  brochure_url: string | null
  room_types: string[] | null
  meal_plans: string[] | null
  highlights: string[] | null
  supplier_id: number | null
  supplier_group: string | null
  booking_method: string | null
  platform_name: string | null
  reservation_contact: string | null
  reservation_email: string | null
  reservation_phone: string | null
  reservation_address: string | null
  payment_terms: string | null
  credit_agreement: boolean | null
  created_at: string
}

export async function getHotels(): Promise<Hotel[]> {
  const { data } = await supabase.from('hotel_list').select('*').order('name')
  return (data as Hotel[]) || []
}

export async function getSuppliers(): Promise<Supplier[]> {
  const { data } = await supabase
    .from('suppliers')
    .select('id,name,type,payment_terms,credit_agreement,contact_name,email,phone')
    .order('name')
  return (data as Supplier[]) || []
}

export async function createHotel(values: Partial<Hotel>) {
  return dbMutate({
    table: 'hotel_list',
    action: 'insert',
    values,
  })
}

export async function updateHotel(id: number, values: Partial<Hotel>) {
  return dbMutate({
    table: 'hotel_list',
    action: 'update',
    values,
    filters: [{ column: 'id', value: id }],
  })
}

export async function deleteHotel(id: number) {
  return dbMutate({
    table: 'hotel_list',
    action: 'delete',
    filters: [{ column: 'id', value: id }],
  })
}
