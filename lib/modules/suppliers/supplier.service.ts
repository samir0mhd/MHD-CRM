import * as repo from './supplier.repository'

export type Supplier = repo.Supplier

export type SupplierListResponse = {
  suppliers: Supplier[]
  hotelCounts: Record<number, number>
}

export function generateAccountCode(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '')
  const trimmed = letters.slice(0, 6)
  return trimmed.padEnd(6, 'X')
}

function normalizeString(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function buildSupplierPayload(values: Partial<Supplier>): Partial<Supplier> {
  const name = normalizeString(values.name)
  if (!name) {
    throw new Error('Supplier name is required')
  }

  return {
    name,
    account_code: normalizeString(values.account_code) || generateAccountCode(name),
    type: normalizeString(values.type),
    company_reg: normalizeString(values.company_reg),
    description: normalizeString(values.description),
    street_1: normalizeString(values.street_1),
    street_2: normalizeString(values.street_2),
    town: normalizeString(values.town),
    country: normalizeString(values.country),
    post_code: normalizeString(values.post_code),
    contact_name: normalizeString(values.contact_name),
    email: normalizeString(values.email),
    phone: normalizeString(values.phone),
    fax: normalizeString(values.fax),
    website: normalizeString(values.website),
    account_contact_name: normalizeString(values.account_contact_name),
    account_contact_email: normalizeString(values.account_contact_email),
    account_contact_phone: normalizeString(values.account_contact_phone),
    account_contact_fax: normalizeString(values.account_contact_fax),
    sales_contact_name: normalizeString(values.sales_contact_name),
    sales_contact_email: normalizeString(values.sales_contact_email),
    sales_contact_phone: normalizeString(values.sales_contact_phone),
    sales_contact_fax: normalizeString(values.sales_contact_fax),
    bank_name: normalizeString(values.bank_name),
    bank_account_name: normalizeString(values.bank_account_name),
    bank_street_1: normalizeString(values.bank_street_1),
    bank_street_2: normalizeString(values.bank_street_2),
    bank_town: normalizeString(values.bank_town),
    bank_telephone: normalizeString(values.bank_telephone),
    bank_post_code: normalizeString(values.bank_post_code),
    bank_account_number: normalizeString(values.bank_account_number),
    bank_sort_code: normalizeString(values.bank_sort_code),
    bank_iban: normalizeString(values.bank_iban),
    bank_swift_code: normalizeString(values.bank_swift_code),
    vat_number: normalizeString(values.vat_number),
    vat_registered: values.vat_registered ?? false,
    product_types: normalizeString(values.product_types),
    trading_terms_text: normalizeString(values.trading_terms_text),
    commission_rate: values.commission_rate ?? null,
    payment_due_days: values.payment_due_days ?? null,
    account_open_date: normalizeString(values.account_open_date),
    payment_currency: normalizeString(values.payment_currency),
    abta: normalizeString(values.abta),
    atol: normalizeString(values.atol),
    iata: normalizeString(values.iata),
    remarks: normalizeString(values.remarks),
  }
}

export async function fetchSuppliers(): Promise<SupplierListResponse> {
  const [suppliers, hotelCounts] = await Promise.all([
    repo.getAllSuppliers(),
    repo.getHotelSupplierCounts(),
  ])

  return { suppliers, hotelCounts }
}

export async function fetchSupplierById(id: number): Promise<Supplier | null> {
  return repo.getSupplierById(id)
}

export async function createSupplier(values: Partial<Supplier>) {
  return repo.createSupplier(buildSupplierPayload(values))
}

export async function updateSupplier(id: number, values: Partial<Supplier>) {
  return repo.updateSupplier(id, buildSupplierPayload(values))
}

export async function removeSupplier(id: number) {
  await repo.unlinkHotelsFromSupplier(id)
  await repo.deleteSupplier(id)
}
