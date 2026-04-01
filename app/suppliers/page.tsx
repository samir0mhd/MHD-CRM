'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Supplier = {
  id: number
  name: string
  type: string | null
  contact_name: string | null
  email: string | null
  phone: string | null
  website: string | null
  payment_terms: string | null
  credit_agreement: boolean | null
  notes: string | null
  created_at: string
  hotel_count?: number
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

const EMPTY_FORM = {
  name: '', type: 'hotel', contact_name: '', email: '',
  phone: '', website: '', payment_terms: 'post-departure',
  credit_agreement: false, notes: '',
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [hotelCounts, setHotelCounts] = useState<Record<number, number>>({})
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState('')
  const [editing, setEditing]       = useState<Supplier | null>(null)
  const [isNew, setIsNew]           = useState(false)
  const [form, setForm]             = useState<any>({ ...EMPTY_FORM })
  const [saving, setSaving]         = useState(false)
  const [nameError, setNameError]   = useState('')
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)
  const toastTimer = useRef<any>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: sups }, { data: hotels }] = await Promise.all([
      supabase.from('suppliers').select('*').order('name'),
      supabase.from('hotel_list').select('supplier_id').not('supplier_id', 'is', null),
    ])
    const counts: Record<number, number> = {}
    for (const h of (hotels || [])) {
      if (h.supplier_id) counts[h.supplier_id] = (counts[h.supplier_id] || 0) + 1
    }
    setSuppliers(sups || [])
    setHotelCounts(counts)
    setLoading(false)
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  function openNew() {
    setForm({ ...EMPTY_FORM })
    setNameError('')
    setIsNew(true)
    setEditing({} as Supplier)
  }

  function openEdit(s: Supplier) {
    setForm({
      name: s.name, type: s.type || 'hotel',
      contact_name: s.contact_name || '', email: s.email || '',
      phone: s.phone || '', website: s.website || '',
      payment_terms: s.payment_terms || 'post-departure',
      credit_agreement: s.credit_agreement || false,
      notes: s.notes || '',
    })
    setNameError('')
    setIsNew(false)
    setEditing(s)
  }

  async function handleSave() {
    if (!form.name?.trim()) { setNameError('Supplier name is required'); return }
    setSaving(true)
    setNameError('')
    const payload = {
      name:             form.name.trim(),
      type:             form.type,
      contact_name:     form.contact_name || null,
      email:            form.email || null,
      phone:            form.phone || null,
      website:          form.website || null,
      payment_terms:    form.payment_terms,
      credit_agreement: form.credit_agreement,
      notes:            form.notes || null,
    }
    if (isNew) {
      const { error } = await supabase.from('suppliers').insert(payload)
      if (error) {
        if (error.code === '23505') setNameError('A supplier with this name already exists')
        else showToast('Failed: ' + error.message, 'error')
        setSaving(false); return
      }
      showToast('Supplier created ✓')
    } else if (editing) {
      const { error } = await supabase.from('suppliers').update(payload).eq('id', editing.id)
      if (error) {
        if (error.code === '23505') setNameError('A supplier with this name already exists')
        else showToast('Failed: ' + error.message, 'error')
        setSaving(false); return
      }
      showToast('Supplier updated ✓')
    }
    setSaving(false)
    setEditing(null)
    setIsNew(false)
    load()
  }

  async function handleDelete(id: number) {
    // Unlink hotels first
    await supabase.from('hotel_list').update({ supplier_id: null }).eq('supplier_id', id)
    await supabase.from('suppliers').delete().eq('id', id)
    showToast('Supplier deleted')
    setConfirmDelete(null)
    load()
  }

  const filtered = suppliers.filter(s => {
    const q = search.toLowerCase()
    const matchSearch = !q || s.name.toLowerCase().includes(q) || (s.contact_name||'').toLowerCase().includes(q) || (s.email||'').toLowerCase().includes(q)
    const matchType   = !filterType || s.type === filterType
    return matchSearch && matchType
  })

  // ── EDIT / NEW PANEL ────────────────────────────────────
  if (editing !== null) {
    return (
      <div>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => { setEditing(null); setIsNew(false) }}
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
            <button className="btn btn-secondary" onClick={() => { setEditing(null); setIsNew(false) }}>Cancel</button>
            <button className="btn btn-cta" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : isNew ? 'Create Supplier' : 'Save Changes'}
            </button>
          </div>
        </div>

        <div className="page-body" style={{ maxWidth: '720px' }}>
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
                    onChange={e => { setForm((p: any) => ({ ...p, name: e.target.value })); setNameError('') }}
                    style={ nameError ? { borderColor: 'var(--red)' } : {} }
                    readOnly={!isNew}
                  />
                  {nameError && <div style={{ fontSize: '12px', color: 'var(--red)', marginTop: '4px' }}>{nameError}</div>}
                  {!isNew && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>Name is locked — delete and recreate to rename</div>}
                </div>
                <div>
                  <label className="label">Supplier Type</label>
                  <select className="input" value={form.type} onChange={e => setForm((p: any) => ({ ...p, type: e.target.value }))}>
                    {SUPPLIER_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Payment Terms</label>
                  <select className="input" value={form.payment_terms} onChange={e => setForm((p: any) => ({ ...p, payment_terms: e.target.value }))}>
                    {PAYMENT_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '18px' }}>
                  <input type="checkbox" id="credit" checked={!!form.credit_agreement}
                    onChange={e => setForm((p: any) => ({ ...p, credit_agreement: e.target.checked }))}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
                  <label htmlFor="credit" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                    Credit agreement in place
                  </label>
                </div>
              </div>
            </div>

            {/* Contact */}
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '16px' }}>Contact Details</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Contact Name</label>
                  <input className="input" placeholder="e.g. Beth, Lisa, Azhar Nunhuck"
                    value={form.contact_name}
                    onChange={e => setForm((p: any) => ({ ...p, contact_name: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input className="input" type="email" placeholder="reservations@supplier.com"
                    value={form.email}
                    onChange={e => setForm((p: any) => ({ ...p, email: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Phone</label>
                  <input className="input" placeholder="e.g. +230 464 2847"
                    value={form.phone}
                    onChange={e => setForm((p: any) => ({ ...p, phone: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Website</label>
                  <input className="input" placeholder="https://www.supplier.com"
                    value={form.website}
                    onChange={e => setForm((p: any) => ({ ...p, website: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Notes</label>
                  <textarea className="input" style={{ minHeight: '80px', resize: 'vertical', fontSize: '13px' }}
                    placeholder="Any additional notes — payment instructions, account numbers, special terms…"
                    value={form.notes}
                    onChange={e => setForm((p: any) => ({ ...p, notes: e.target.value }))} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button className="btn btn-secondary" onClick={() => { setEditing(null); setIsNew(false) }}>Cancel</button>
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
                      <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--text-primary)', fontFamily: 'Outfit,sans-serif', marginBottom: '2px' }}>
                        {s.name}
                      </div>
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
