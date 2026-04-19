import { supabase } from '@/lib/supabase'

export type Supplier = {
  id: number
  name: string
  account_code: string | null
  type: string | null
  company_reg: string | null
  description: string | null
  street_1: string | null
  street_2: string | null
  town: string | null
  country: string | null
  post_code: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  fax: string | null
  website: string | null
  account_contact_name: string | null
  account_contact_email: string | null
  account_contact_phone: string | null
  account_contact_fax: string | null
  sales_contact_name: string | null
  sales_contact_email: string | null
  sales_contact_phone: string | null
  sales_contact_fax: string | null
  bank_name: string | null
  bank_account_name: string | null
  bank_street_1: string | null
  bank_street_2: string | null
  bank_town: string | null
  bank_telephone: string | null
  bank_post_code: string | null
  bank_account_number: string | null
  bank_sort_code: string | null
  bank_iban: string | null
  bank_swift_code: string | null
  vat_number: string | null
  vat_registered: boolean | null
  product_types: string | null
  trading_terms_text: string | null
  commission_rate: number | null
  payment_due_days: number | null
  account_open_date: string | null
  payment_currency: string | null
  abta: string | null
  atol: string | null
  iata: string | null
  remarks: string | null
  created_at?: string
}

const SUPPLIER_WRITE_FIELDS = [
  'name',
  'account_code',
  'type',
  'company_reg',
  'description',
  'street_1',
  'street_2',
  'town',
  'country',
  'post_code',
  'contact_name',
  'email',
  'phone',
  'fax',
  'website',
  'account_contact_name',
  'account_contact_email',
  'account_contact_phone',
  'account_contact_fax',
  'sales_contact_name',
  'sales_contact_email',
  'sales_contact_phone',
  'sales_contact_fax',
  'bank_name',
  'bank_account_name',
  'bank_street_1',
  'bank_street_2',
  'bank_town',
  'bank_telephone',
  'bank_post_code',
  'bank_account_number',
  'bank_sort_code',
  'bank_iban',
  'bank_swift_code',
  'vat_number',
  'vat_registered',
  'product_types',
  'trading_terms_text',
  'commission_rate',
  'payment_due_days',
  'account_open_date',
  'payment_currency',
  'abta',
  'atol',
  'iata',
  'remarks',
] as const

function pickSupplierWriteValues(values: Partial<Supplier>) {
  const payload: Partial<Supplier> = {}
  for (const field of SUPPLIER_WRITE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(values, field)) {
      payload[field] = values[field] as never
    }
  }
  return payload
}

export async function getAllSuppliers(): Promise<Supplier[]> {
  const { data } = await supabase.from('suppliers').select('*').order('name')
  return (data as Supplier[]) || []
}

export async function getSupplierById(id: number): Promise<Supplier | null> {
  const { data } = await supabase.from('suppliers').select('*').eq('id', id).maybeSingle()
  return (data as Supplier | null) || null
}

export async function getHotelSupplierCounts(): Promise<Record<number, number>> {
  const { data } = await supabase.from('hotel_list').select('supplier_id').not('supplier_id', 'is', null)
  const counts: Record<number, number> = {}
  for (const hotel of data || []) {
    if (hotel.supplier_id) counts[hotel.supplier_id] = (counts[hotel.supplier_id] || 0) + 1
  }
  return counts
}

export async function createSupplier(values: Partial<Supplier>) {
  const { error } = await supabase
    .from('suppliers')
    .insert(pickSupplierWriteValues(values))
  return { error }
}

export async function updateSupplier(id: number, values: Partial<Supplier>) {
  const { error } = await supabase
    .from('suppliers')
    .update(pickSupplierWriteValues(values))
    .eq('id', id)
  return { error }
}

export async function unlinkHotelsFromSupplier(id: number) {
  const { error } = await supabase
    .from('hotel_list')
    .update({ supplier_id: null })
    .eq('supplier_id', id)
  return { error }
}

export async function deleteSupplier(id: number) {
  const { error } = await supabase
    .from('suppliers')
    .delete()
    .eq('id', id)
  if (error) throw error
}
