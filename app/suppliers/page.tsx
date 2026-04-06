'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

type Supplier = {
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
  payment_terms: string | null
  credit_agreement: boolean | null
  notes: string | null
  created_at: string
  hotel_count?: number
}

type SupplierForm = {
  name: string
  account_code: string
  type: string
  company_reg: string
  description: string
  street_1: string
  street_2: string
  town: string
  country: string
  post_code: string
  contact_name: string
  email: string
  phone: string
  fax: string
  website: string
  account_contact_name: string
  account_contact_email: string
  account_contact_phone: string
  account_contact_fax: string
  sales_contact_name: string
  sales_contact_email: string
  sales_contact_phone: string
  sales_contact_fax: string
  bank_name: string
  bank_account_name: string
  bank_street_1: string
  bank_street_2: string
  bank_town: string
  bank_telephone: string
  bank_post_code: string
  bank_account_number: string
  bank_sort_code: string
  bank_iban: string
  bank_swift_code: string
  vat_number: string
  vat_registered: boolean
  product_types: string
  trading_terms_text: string
  commission_rate: string
  payment_due_days: string
  account_open_date: string
  payment_currency: string
  abta: string
  atol: string
  iata: string
  remarks: string
  payment_terms: string
  credit_agreement: boolean
  notes: string
}

const SUPPLIER_TYPES = ['hotel', 'flight', 'transfer', 'dmc', 'extras', 'other']
const TYPE_LABELS: Record<string, string> = {
  hotel: 'Hotel Supplier', flight: 'Flight Supplier', transfer: 'Transfer / DMC',
  dmc: 'DMC', extras: 'Holiday Extras', other: 'Other',
}
const TYPE_COLORS: Record<string, string> = {
  hotel: '#f59e0b', flight: '#3b82f6', transfer: '#10b981',
  dmc: '#8b5cf6', extras: '#ec4899', other: '#94a3b8',
}
const PAYMENT_TERMS = [
  { value: 'post-departure', label: 'Post-Departure' },
  { value: 'pre-arrival',    label: 'Pre-Arrival'    },
  { value: 'on-booking',     label: 'On Booking'     },
  { value: 'deposit',        label: 'Deposit + Balance' },
]
const PAY_COLORS: Record<string, string> = {
  'post-departure': '#10b981', 'pre-arrival': '#f59e0b',
  'on-booking': '#ef4444', 'deposit': '#3b82f6',
}

function generateAccountCode(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, '')
  const trimmed = letters.slice(0, 6)
  return trimmed.padEnd(6, 'X')
}

const EMPTY_FORM = {
  name: '', account_code: '', type: 'hotel', company_reg: '', description: '',
  street_1: '', street_2: '', town: '', country: 'Mauritius', post_code: '',
  contact_name: '', email: '', phone: '', fax: '', website: '',
  account_contact_name: '', account_contact_email: '', account_contact_phone: '', account_contact_fax: '',
  sales_contact_name: '', sales_contact_email: '', sales_contact_phone: '', sales_contact_fax: '',
  bank_name: '', bank_account_name: '', bank_street_1: '', bank_street_2: '', bank_town: '', bank_telephone: '',
  bank_post_code: '', bank_account_number: '', bank_sort_code: '', bank_iban: '', bank_swift_code: '',
  vat_number: '', vat_registered: false, product_types: '', trading_terms_text: '',
  commission_rate: '0.00', payment_due_days: '30', account_open_date: '', payment_currency: 'GBP',
  abta: '', atol: '', iata: '', remarks: '',
  payment_terms: 'post-departure', credit_agreement: false, notes: '',
} satisfies SupplierForm

export default function SuppliersPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [hotelCounts, setHotelCounts] = useState<Record<number, number>>({})
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState('')
  const [editing, setEditing]       = useState<Supplier | null>(null)
  const [isNew, setIsNew]           = useState(false)
  const [form, setForm]             = useState<SupplierForm>({ ...EMPTY_FORM })
  const [saving, setSaving]         = useState(false)
  const [nameError, setNameError]   = useState('')
  const [accountCodeTouched, setAccountCodeTouched] = useState(false)
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function load() {
    setLoading(true)
    try {
      const response = await fetch('/api/suppliers')
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.suppliers || [])
        setHotelCounts(data.hotelCounts || {})
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(timeoutId)
  }, [])

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  function openNew() {
    setForm({ ...EMPTY_FORM })
    setAccountCodeTouched(false)
    setNameError('')
    setIsNew(true)
    setEditing({} as Supplier)
  }

  function openEdit(s: Supplier) {
    setAccountCodeTouched(true)
    setForm({
      name: s.name, account_code: s.account_code || generateAccountCode(s.name), type: s.type || 'hotel',
      company_reg: s.company_reg || '', description: s.description || '',
      street_1: s.street_1 || '', street_2: s.street_2 || '', town: s.town || '', country: s.country || 'Mauritius', post_code: s.post_code || '',
      contact_name: s.contact_name || '', email: s.email || '',
      phone: s.phone || '', fax: s.fax || '', website: s.website || '',
      account_contact_name: s.account_contact_name || '', account_contact_email: s.account_contact_email || '', account_contact_phone: s.account_contact_phone || '', account_contact_fax: s.account_contact_fax || '',
      sales_contact_name: s.sales_contact_name || '', sales_contact_email: s.sales_contact_email || '', sales_contact_phone: s.sales_contact_phone || '', sales_contact_fax: s.sales_contact_fax || '',
      bank_name: s.bank_name || '', bank_account_name: s.bank_account_name || '', bank_street_1: s.bank_street_1 || '', bank_street_2: s.bank_street_2 || '', bank_town: s.bank_town || '', bank_telephone: s.bank_telephone || '',
      bank_post_code: s.bank_post_code || '', bank_account_number: s.bank_account_number || '', bank_sort_code: s.bank_sort_code || '', bank_iban: s.bank_iban || '', bank_swift_code: s.bank_swift_code || '',
      vat_number: s.vat_number || '', vat_registered: !!s.vat_registered, product_types: s.product_types || '', trading_terms_text: s.trading_terms_text || '',
      commission_rate: s.commission_rate != null ? String(s.commission_rate) : '0.00',
      payment_due_days: s.payment_due_days != null ? String(s.payment_due_days) : '30',
      account_open_date: s.account_open_date ? s.account_open_date.split('T')[0] : '',
      payment_currency: s.payment_currency || 'GBP',
      abta: s.abta || '', atol: s.atol || '', iata: s.iata || '', remarks: s.remarks || '',
      payment_terms: s.payment_terms || 'post-departure',
      credit_agreement: s.credit_agreement || false,
      notes: s.notes || '',
    })
    setNameError('')
    setIsNew(false)
    setEditing(s)
  }

  function closeEditor() {
    setEditing(null)
    setIsNew(false)
    setAccountCodeTouched(false)
    if (searchParams.get('edit')) {
      router.replace('/suppliers')
    }
  }

  useEffect(() => {
    const editId = searchParams.get('edit')
    if (!editId || suppliers.length === 0 || editing !== null) return

    const match = suppliers.find(supplier => supplier.id === Number(editId))
    if (!match) return

    const timeoutId = setTimeout(() => {
      openEdit(match)
      router.replace('/suppliers')
    }, 0)

    return () => clearTimeout(timeoutId)
  }, [searchParams, suppliers, editing, router])

  async function handleSave() {
    if (!form.name?.trim()) { setNameError('Supplier name is required'); return }
    setSaving(true)
    setNameError('')
    const generatedAccountCode = generateAccountCode(form.name)
    const payload: Partial<Supplier> = {
      name:             form.name.trim(),
      account_code:     form.account_code.trim() || generatedAccountCode,
      type:             form.type,
      company_reg:      form.company_reg.trim() || null,
      description:      form.description.trim() || null,
      street_1:         form.street_1.trim() || null,
      street_2:         form.street_2.trim() || null,
      town:             form.town.trim() || null,
      country:          form.country.trim() || null,
      post_code:        form.post_code.trim() || null,
      contact_name:     form.contact_name || null,
      email:            form.email || null,
      phone:            form.phone || null,
      fax:              form.fax || null,
      website:          form.website || null,
      account_contact_name:  form.account_contact_name.trim() || null,
      account_contact_email: form.account_contact_email.trim() || null,
      account_contact_phone: form.account_contact_phone.trim() || null,
      account_contact_fax:   form.account_contact_fax.trim() || null,
      sales_contact_name:    form.sales_contact_name.trim() || null,
      sales_contact_email:   form.sales_contact_email.trim() || null,
      sales_contact_phone:   form.sales_contact_phone.trim() || null,
      sales_contact_fax:     form.sales_contact_fax.trim() || null,
      bank_name:         form.bank_name.trim() || null,
      bank_account_name: form.bank_account_name.trim() || null,
      bank_street_1:     form.bank_street_1.trim() || null,
      bank_street_2:     form.bank_street_2.trim() || null,
      bank_town:         form.bank_town.trim() || null,
      bank_telephone:    form.bank_telephone.trim() || null,
      bank_post_code:    form.bank_post_code.trim() || null,
      bank_account_number: form.bank_account_number.trim() || null,
      bank_sort_code:    form.bank_sort_code.trim() || null,
      bank_iban:         form.bank_iban.trim() || null,
      bank_swift_code:   form.bank_swift_code.trim() || null,
      vat_number:        form.vat_number.trim() || null,
      vat_registered:    form.vat_registered,
      product_types:     form.product_types.trim() || null,
      trading_terms_text: form.trading_terms_text.trim() || null,
      commission_rate:   form.commission_rate.trim() ? Number(form.commission_rate) : null,
      payment_due_days:  form.payment_due_days.trim() ? Number(form.payment_due_days) : null,
      account_open_date: form.account_open_date || null,
      payment_currency:  form.payment_currency.trim() || null,
      abta:              form.abta.trim() || null,
      atol:              form.atol.trim() || null,
      iata:              form.iata.trim() || null,
      remarks:           form.remarks.trim() || null,
    }
    if (isNew) {
      const response = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const error = await response.json()
        if (error.code === '23505') setNameError('A supplier with this name already exists')
        else showToast('Failed: ' + error.error, 'error')
        setSaving(false); return
      }
      showToast('Supplier created ✓')
    } else if (editing) {
      const response = await fetch(`/api/suppliers/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!response.ok) {
        const error = await response.json()
        if (error.code === '23505') setNameError('A supplier with this name already exists')
        else showToast('Failed: ' + error.error, 'error')
        setSaving(false); return
      }
      showToast('Supplier updated ✓')
    }
    setSaving(false)
    closeEditor()
    load()
  }

  async function handleDelete(id: number) {
    await fetch(`/api/suppliers/${id}`, { method: 'DELETE' })
    showToast('Supplier deleted')
    setConfirmDelete(null)
    load()
  }

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.account_code || '').toLowerCase().includes(q) || (s.contact_name||'').toLowerCase().includes(q) || (s.email||'').toLowerCase().includes(q)
    const matchType   = !filterType || s.type === filterType
    return matchSearch && matchType
  })

  // ── EDIT / NEW PANEL ────────────────────────────────────
  if (editing !== null) {
    return (
      <div>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={closeEditor}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
              ← Suppliers
            </button>
            <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
            <div>
              <div className="page-title">{isNew ? 'Add Supplier' : form.name}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                {isNew ? 'Supplier name is permanent — choose carefully' : 'Edit supplier details'}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={closeEditor}>Cancel</button>
            <button className="btn btn-cta" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Create Supplier' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="page-body" style={{ maxWidth: '980px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* Identity */}
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '16px' }}>Identity</div>
              {isNew && (
                <div style={{ background: 'var(--amber-light,#fef3c744)', border: '1px solid var(--amber,#f59e0b)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '12.5px', color: 'var(--amber,#f59e0b)' }}>
                  The supplier name cannot be changed once hotels are linked to it. Make sure the spelling is correct.
                </div>
              )}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Supplier Name *</label>
                  <input className="input"
                    placeholder="e.g. Sunlife, Constance Group, Coquille Bonheur"
                    value={form.name}
                    onChange={e => {
                      const nextName = e.target.value
                      setForm(p => ({
                        ...p,
                        name: nextName,
                        account_code: isNew && !accountCodeTouched ? generateAccountCode(nextName) : p.account_code,
                      }))
                      setNameError('')
                    }}
                    style={ nameError ? { borderColor: 'var(--red)' } : {} }
                    readOnly={!isNew}
                  />
                  {nameError && <div style={{ fontSize: '12px', color: 'var(--red)', marginTop: '4px' }}>{nameError}</div>}
                  {!isNew && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Name is locked — delete and recreate to rename</div>}
                </div>
                <div>
                  <label className="label">Account Code</label>
                  <input className="input" placeholder="e.g. HER"
                    value={form.account_code}
                    onChange={e => {
                      setAccountCodeTouched(true)
                      setForm(p => ({ ...p, account_code: e.target.value.toUpperCase().slice(0, 6) }))
                    }} />
                </div>
                <div>
                  <label className="label">Supplier Type</label>
                  <select className="input" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                    {SUPPLIER_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Company Reg</label>
                  <input className="input" placeholder="Company registration"
                    value={form.company_reg}
                    onChange={e => setForm(p => ({ ...p, company_reg: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Payment Terms</label>
                  <select className="input" value={form.payment_terms} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))}>
                    {PAYMENT_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Description</label>
                  <input className="input" placeholder="e.g. 5* Hotel All Inclusive Resort"
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '18px' }}>
                  <input type="checkbox" id="credit" checked={!!form.credit_agreement}
                    onChange={e => setForm(p => ({ ...p, credit_agreement: e.target.checked }))}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
                  <label htmlFor="credit" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                    Credit agreement in place
                  </label>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '16px' }}>Supplier Address Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Street 1</label>
                  <input className="input" value={form.street_1}
                    onChange={e => setForm(p => ({ ...p, street_1: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" placeholder="heritage@veranda-resorts.com"
                    value={form.email}
                    onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Street 2</label>
                  <input className="input" value={form.street_2}
                    onChange={e => setForm(p => ({ ...p, street_2: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Website</label>
                  <input className="input" placeholder="https://www.supplier.com"
                    value={form.website}
                    onChange={e => setForm(p => ({ ...p, website: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Town</label>
                  <input className="input" value={form.town}
                    onChange={e => setForm(p => ({ ...p, town: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Telephone</label>
                  <input className="input" placeholder="e.g. +230 464 2847"
                    value={form.phone}
                    onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Country</label>
                  <input className="input" value={form.country}
                    onChange={e => setForm(p => ({ ...p, country: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Fax</label>
                  <input className="input" value={form.fax}
                    onChange={e => setForm(p => ({ ...p, fax: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Post Code</label>
                  <input className="input" value={form.post_code}
                    onChange={e => setForm(p => ({ ...p, post_code: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Main Contact Name</label>
                  <input className="input" value={form.contact_name}
                    onChange={e => setForm(p => ({ ...p, contact_name: e.target.value }))} />
                </div>
              </div>
            </div>

            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '16px' }}>Supplier Account Department Contact Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label className="label">Contact Name</label><input className="input" value={form.account_contact_name} onChange={e => setForm(p => ({ ...p, account_contact_name: e.target.value }))} /></div>
                <div><label className="label">Email</label><input className="input" type="email" value={form.account_contact_email} onChange={e => setForm(p => ({ ...p, account_contact_email: e.target.value }))} /></div>
                <div><label className="label">Account Dep Phone</label><input className="input" value={form.account_contact_phone} onChange={e => setForm(p => ({ ...p, account_contact_phone: e.target.value }))} /></div>
                <div><label className="label">Account Dep Fax</label><input className="input" value={form.account_contact_fax} onChange={e => setForm(p => ({ ...p, account_contact_fax: e.target.value }))} /></div>
              </div>
            </div>

            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '16px' }}>Supplier Sale Department Contact Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label className="label">Contact Name</label><input className="input" value={form.sales_contact_name} onChange={e => setForm(p => ({ ...p, sales_contact_name: e.target.value }))} /></div>
                <div><label className="label">Email</label><input className="input" type="email" value={form.sales_contact_email} onChange={e => setForm(p => ({ ...p, sales_contact_email: e.target.value }))} /></div>
                <div><label className="label">Sale Dep Phone</label><input className="input" value={form.sales_contact_phone} onChange={e => setForm(p => ({ ...p, sales_contact_phone: e.target.value }))} /></div>
                <div><label className="label">Sale Dep Fax</label><input className="input" value={form.sales_contact_fax} onChange={e => setForm(p => ({ ...p, sales_contact_fax: e.target.value }))} /></div>
              </div>
            </div>

            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '16px' }}>Supplier Bank Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label className="label">Bank Name</label><input className="input" value={form.bank_name} onChange={e => setForm(p => ({ ...p, bank_name: e.target.value }))} /></div>
                <div><label className="label">Account Name</label><input className="input" value={form.bank_account_name} onChange={e => setForm(p => ({ ...p, bank_account_name: e.target.value }))} /></div>
                <div><label className="label">Street 1</label><input className="input" value={form.bank_street_1} onChange={e => setForm(p => ({ ...p, bank_street_1: e.target.value }))} /></div>
                <div><label className="label">Account Number</label><input className="input" value={form.bank_account_number} onChange={e => setForm(p => ({ ...p, bank_account_number: e.target.value }))} /></div>
                <div><label className="label">Street 2</label><input className="input" value={form.bank_street_2} onChange={e => setForm(p => ({ ...p, bank_street_2: e.target.value }))} /></div>
                <div><label className="label">Sort Code</label><input className="input" value={form.bank_sort_code} onChange={e => setForm(p => ({ ...p, bank_sort_code: e.target.value }))} /></div>
                <div><label className="label">Town</label><input className="input" value={form.bank_town} onChange={e => setForm(p => ({ ...p, bank_town: e.target.value }))} /></div>
                <div><label className="label">IBAN No</label><input className="input" value={form.bank_iban} onChange={e => setForm(p => ({ ...p, bank_iban: e.target.value }))} /></div>
                <div><label className="label">Telephone</label><input className="input" value={form.bank_telephone} onChange={e => setForm(p => ({ ...p, bank_telephone: e.target.value }))} /></div>
                <div><label className="label">Swift Code</label><input className="input" value={form.bank_swift_code} onChange={e => setForm(p => ({ ...p, bank_swift_code: e.target.value }))} /></div>
                <div><label className="label">Post Code</label><input className="input" value={form.bank_post_code} onChange={e => setForm(p => ({ ...p, bank_post_code: e.target.value }))} /></div>
              </div>
            </div>

            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '16px' }}>Entering Supplier Terms</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div><label className="label">Vat Number</label><input className="input" value={form.vat_number} onChange={e => setForm(p => ({ ...p, vat_number: e.target.value }))} /></div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '18px' }}>
                  <input type="checkbox" id="vat_registered" checked={form.vat_registered} onChange={e => setForm(p => ({ ...p, vat_registered: e.target.checked }))} style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
                  <label htmlFor="vat_registered" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>VAT registered</label>
                </div>
                <div><label className="label">Type of Products</label><input className="input" placeholder="Hotel / Accommodation" value={form.product_types} onChange={e => setForm(p => ({ ...p, product_types: e.target.value }))} /></div>
                <div><label className="label">Commission Rate</label><input className="input" type="number" step="0.01" value={form.commission_rate} onChange={e => setForm(p => ({ ...p, commission_rate: e.target.value }))} /></div>
                <div><label className="label">Payment Due Days</label><input className="input" type="number" value={form.payment_due_days} onChange={e => setForm(p => ({ ...p, payment_due_days: e.target.value }))} /></div>
                <div><label className="label">Account Open Date</label><input className="input" type="date" value={form.account_open_date} onChange={e => setForm(p => ({ ...p, account_open_date: e.target.value }))} /></div>
                <div><label className="label">Payment Currency</label><input className="input" placeholder="GBP" value={form.payment_currency} onChange={e => setForm(p => ({ ...p, payment_currency: e.target.value }))} /></div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Trading Terms Text</label>
                  <textarea className="input" style={{ minHeight: '80px', resize: 'vertical', fontSize: '13px' }}
                    value={form.trading_terms_text}
                    onChange={e => setForm(p => ({ ...p, trading_terms_text: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Internal Notes</label>
                  <textarea className="input" style={{ minHeight: '80px', resize: 'vertical', fontSize: '13px' }}
                    placeholder="Any additional notes — payment instructions, account numbers, special terms…"
                    value={form.notes}
                    onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} />
                </div>
                <div><label className="label">ABTA</label><input className="input" value={form.abta} onChange={e => setForm(p => ({ ...p, abta: e.target.value }))} /></div>
                <div><label className="label">ATOL</label><input className="input" value={form.atol} onChange={e => setForm(p => ({ ...p, atol: e.target.value }))} /></div>
                <div><label className="label">IATA</label><input className="input" value={form.iata} onChange={e => setForm(p => ({ ...p, iata: e.target.value }))} /></div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Remarks</label>
                  <textarea className="input" style={{ minHeight: '80px', resize: 'vertical', fontSize: '13px' }}
                    value={form.remarks}
                    onChange={e => setForm(p => ({ ...p, remarks: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button className="btn btn-secondary" onClick={closeEditor}>Cancel</button>
            <button className="btn btn-cta" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Create Supplier' : 'Save Changes'}
            </button>
          </div>
        </div>

        {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>
    )
  }

  // ── MAIN LIST ───────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Suppliers</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {suppliers.length} suppliers · link hotels in Hotel Directory
          </div>
        </div>
        <button className="btn btn-cta" onClick={openNew}>+ Add Supplier</button>
      </div>

      <div className="page-body">
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input className="input" style={{ width: '260px' }} placeholder="Search suppliers…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" style={{ width: '180px' }} value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All types</option>
            {SUPPLIER_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'Fraunces,serif', fontSize: '20px', fontWeight: '300', marginBottom: '8px' }}>No suppliers yet</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Add your first supplier, then link hotels to it in the Hotel Directory</div>
            <button className="btn btn-cta" onClick={openNew}>+ Add Supplier</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Header */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 200px 160px 100px 80px', gap: '12px', padding: '0 16px', marginBottom: '2px' }}>
              {['Supplier', 'Type', 'Contact', 'Payment Terms', 'Hotels', ''].map((h, i) => (
                <div key={i} style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: '600' }}>{h}</div>
              ))}
            </div>

            {filtered.map(s => {
              const typeColor = TYPE_COLORS[s.type || 'other'] || '#94a3b8'
              const payColor  = PAY_COLORS[s.payment_terms || ''] || 'var(--text-muted)'
              const count     = hotelCounts[s.id] || 0
              return (
                <div key={s.id} className="card" style={{ padding: '14px 16px', transition: 'all 0.14s' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 130px 200px 160px 100px 80px', gap: '12px', alignItems: 'center' }}>

                    {/* Name */}
                    <div>
                      <Link href={`/suppliers/${s.id}`} style={{ fontSize: '14px', fontWeight: '500', color: 'var(--accent)', fontFamily: 'Outfit,sans-serif', marginBottom: '2px', textDecoration: 'none', display: 'inline-block' }}>
                        {s.name}
                      </Link>
                      <div>
                        <Link href={`/suppliers/${s.id}`} style={{ fontSize: '11px', color: 'var(--text-muted)', textDecoration: 'none' }}>
                          View Supplier Details
                        </Link>
                      </div>
                      {s.account_code && <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Code: {s.account_code}</div>}
                      {s.credit_agreement && (
                        <span style={{ fontSize: '10px', color: '#10b981', background: '#10b98118', padding: '1px 6px', borderRadius: '4px' }}>Credit ✓</span>
                      )}
                    </div>

                    {/* Type */}
                    <div>
                      <span style={{ fontSize: '11px', color: typeColor, background: `${typeColor}18`, padding: '3px 8px', borderRadius: '4px', fontWeight: '500' }}>
                        {TYPE_LABELS[s.type || 'other']}
                      </span>
                    </div>

                    {/* Contact */}
                    <div>
                      {s.contact_name && <div style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>👤 {s.contact_name}</div>}
                      {s.email && <a href={`mailto:${s.email}`} style={{ fontSize: '11.5px', color: 'var(--accent)', textDecoration: 'none', display: 'block' }}>✉ {s.email}</a>}
                      {s.phone && <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>📞 {s.phone}</div>}
                    </div>

                    {/* Payment terms */}
                    <div>
                      <span style={{ fontSize: '11px', color: payColor, background: `${payColor}18`, padding: '3px 8px', borderRadius: '4px' }}>
                        {PAYMENT_TERMS.find(t => t.value === s.payment_terms)?.label || s.payment_terms || '—'}
                      </span>
                    </div>

                    {/* Hotel count */}
                    <div>
                      {count > 0 ? (
                        <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>
                          🏨 {count} hotel{count !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No hotels</span>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {confirmDelete === s.id ? (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button className="btn btn-danger btn-xs" onClick={() => handleDelete(s.id)}>Delete</button>
                          <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDelete(null)}>Cancel</button>
                        </div>
                      ) : (
                        <>
                          <button className="btn btn-secondary btn-xs" onClick={() => openEdit(s)}>Edit</button>
                          <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)' }} onClick={() => setConfirmDelete(s.id)}>✕</button>
                        </>
                      )}
                    </div>
                  </div>

                  {s.notes && (
                    <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)' }}>
                      {s.notes}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
