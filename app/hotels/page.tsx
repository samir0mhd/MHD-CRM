'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

type Supplier = {
  id: number
  name: string
  type: string | null
  payment_terms: string | null
  credit_agreement: boolean | null
  contact_name: string | null
  email: string | null
  phone: string | null
}

type Hotel = {
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

const REGIONS = [
  'North Mauritius', 'South Mauritius', 'East Mauritius', 'West Mauritius',
  'Central Mauritius', 'Île aux Cerfs', 'Dubai', 'Maldives', 'Seychelles',
  'Cape Town', 'Other',
]

const STANDARD_MEAL_PLANS = [
  'Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board',
  'All Inclusive', 'Ultra All Inclusive', 'Premium All Inclusive',
  'Gourmet Half Board', 'Gourmet Full Board', 'Serenity Plus',
  'Gourmet Bliss', 'Beachcomber Plus', 'Dine Around',
]

const PAYMENT_TERMS = [
  { value: 'post-departure', label: 'Post-Departure' },
  { value: 'pre-arrival',    label: 'Pre-Arrival'    },
  { value: 'on-booking',     label: 'On Booking'     },
  { value: 'deposit',        label: 'Deposit + Balance' },
]

const PAYMENT_COLORS: Record<string, string> = {
  'post-departure': 'var(--green)',
  'pre-arrival':    'var(--amber)',
  'on-booking':     'var(--red)',
  'deposit':        'var(--blue)',
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>No rating</span>
  return (
    <span style={{ color: '#f59e0b', fontSize: '14px', letterSpacing: '1px' }}>
      {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>{rating}</span>
    </span>
  )
}

export default function HotelsPage() {
  const [hotels, setHotels]         = useState<Hotel[]>([])
  const [suppliers, setSuppliers]   = useState<Supplier[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterRegion, setRegion]   = useState('')
  const [filterGroup, setGroup]     = useState('')
  const [editing, setEditing]       = useState<Hotel | null>(null)
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const toastTimer                  = useRef<any>(null)

  const [form, setForm] = useState<Partial<Hotel & { room_types_text: string; meal_plans_text: string; highlights_text: string }>>({})
  const [isNew, setIsNew] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [{ data: hotelData }, { data: supplierData }] = await Promise.all([
      supabase.from('hotel_list').select('*').order('name'),
      supabase.from('suppliers').select('id,name,type,payment_terms,credit_agreement,contact_name,email,phone').order('name'),
    ])
    setHotels(hotelData || [])
    setSuppliers(supplierData || [])
    setLoading(false)
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  function openEdit(hotel: Hotel) {
    setForm({
      ...hotel,
      room_types_text:  (hotel.room_types  || []).join('\n'),
      meal_plans_text:  (hotel.meal_plans  || []).join('\n'),
      highlights_text:  (hotel.highlights  || []).join('\n'),
    })
    setIsNew(false)
    setEditing(hotel)
  }

  function openNew() {
    setForm({
      room_types_text: '', meal_plans_text: '', highlights_text: '',
      booking_method: 'direct', payment_terms: 'post-departure', credit_agreement: false,
    })
    setIsNew(true)
    setEditing({} as Hotel)
  }

  async function handleSave() {
    if (!editing) return
    if (isNew && !(form.name?.trim())) { showToast('Hotel name is required', 'error'); return }
    setSaving(true)
    const { room_types_text, meal_plans_text, highlights_text, ...rest } = form
    const payload = {
      ...rest,
      room_types:  room_types_text ? room_types_text.split('\n').map(s => s.trim()).filter(Boolean) : [],
      meal_plans:  meal_plans_text ? meal_plans_text.split('\n').map(s => s.trim()).filter(Boolean) : [],
      highlights:  highlights_text ? highlights_text.split('\n').map(s => s.trim()).filter(Boolean) : [],
    }
    if (isNew) {
      const { error } = await supabase.from('hotel_list').insert(payload)
      if (error) { showToast('Failed: ' + error.message, 'error'); setSaving(false); return }
      showToast('Hotel added ✓')
    } else {
      const { error } = await supabase.from('hotel_list').update(payload).eq('id', editing.id)
      if (error) { showToast('Failed: ' + error.message, 'error'); setSaving(false); return }
      showToast('Hotel updated ✓')
    }
    setSaving(false)
    setEditing(null)
    setIsNew(false)
    load()
  }

  async function handleDelete(id: number) {
    await supabase.from('hotel_list').delete().eq('id', id)
    showToast('Hotel deleted')
    setConfirmDelete(null)
    load()
  }

  const supplierMap = Object.fromEntries(suppliers.map(s => [s.id, s]))

  const filtered = hotels.filter(h => {
    const q = search.toLowerCase()
    const supName = h.supplier_id ? (supplierMap[h.supplier_id]?.name || '') : ''
    const matchSearch = !q || h.name.toLowerCase().includes(q) || (h.region||'').toLowerCase().includes(q) || supName.toLowerCase().includes(q) || (h.reservation_contact||'').toLowerCase().includes(q)
    const matchRegion = !filterRegion || h.region === filterRegion
    const matchGroup  = !filterGroup  || String(h.supplier_id) === filterGroup
    return matchSearch && matchRegion && matchGroup
  })

  const withContact   = hotels.filter(h => h.reservation_email || h.reservation_phone).length
  const withoutContact = hotels.length - withContact

  // ── EDIT PANEL ─────────────────────────────────────────
  if (editing) {
    return (
      <div>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => { setEditing(null); setIsNew(false) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>← Hotels</button>
            <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
            <div>
              <div className="page-title">{isNew ? 'Add Hotel' : editing.name}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{isNew ? 'Create a new hotel profile' : 'Edit hotel profile'}</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => { setEditing(null); setIsNew(false) }}>Cancel</button>
            <button className="btn btn-cta" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isNew ? 'Add Hotel' : 'Save Profile'}</button>
          </div>
        </div>

        <div className="page-body" style={{ maxWidth: '860px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            {/* Basic info */}
            <div className="card" style={{ padding: '20px 22px', gridColumn: '1/-1' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '16px' }}>Basic Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {isNew && (
                  <div style={{ gridColumn: '1/-1' }}>
                    <label className="label">Hotel Name *</label>
                    <input className="input" placeholder="e.g. One&Only Le Saint Geran" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} autoFocus />
                  </div>
                )}
                <div>
                  <label className="label">Star Rating</label>
                  <select className="input" value={form.star_rating || ''} onChange={e => setForm(p => ({ ...p, star_rating: e.target.value ? Number(e.target.value) : null }))}>
                    <option value="">Not rated</option>
                    {[3, 3.5, 4, 4.5, 5].map(r => <option key={r} value={r}>{r} Stars</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Region</label>
                  <select className="input" value={form.region || ''} onChange={e => setForm(p => ({ ...p, region: e.target.value || null }))}>
                    <option value="">Select region…</option>
                    {REGIONS.map(r => <option key={r}>{r}</option>)}
                  </select>
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Resort Highlights <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: '0' }}>(one per line)</span></label>
                  <textarea className="input" style={{ minHeight: '80px', resize: 'vertical', fontSize: '13px' }}
                    placeholder={'Overwater bungalows with direct lagoon access\nPrivate beach stretching 800m'}
                    value={form.highlights_text || ''}
                    onChange={e => setForm(p => ({ ...p, highlights_text: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Description</label>
                  <textarea className="input" style={{ minHeight: '100px', resize: 'vertical', fontSize: '13px' }}
                    placeholder="Full resort description — location, style, ideal for…"
                    value={form.description || ''}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Supplier & Reservations */}
            <div className="card" style={{ padding: '20px 22px', gridColumn: '1/-1' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '4px' }}>Supplier & Reservations</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Used to auto-generate reservation emails and accommodation vouchers</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

                <div>
                  <label className="label">Supplier</label>
                  <select className="input" value={form.supplier_id || ''} onChange={e => {
                    const id = e.target.value ? Number(e.target.value) : null
                    const sup = suppliers.find(s => s.id === id)
                    setForm(p => ({
                      ...p,
                      supplier_id: id,
                      supplier_group: sup?.name || null,
                      payment_terms: sup?.payment_terms || p.payment_terms,
                      credit_agreement: sup?.credit_agreement ?? p.credit_agreement,
                      reservation_contact: p.reservation_contact || sup?.contact_name || null,
                      reservation_email: p.reservation_email || sup?.email || null,
                      reservation_phone: p.reservation_phone || sup?.phone || null,
                    }))
                  }}>
                    <option value="">No supplier / independent</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {suppliers.length === 0 && (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      No suppliers yet — <a href="/suppliers" style={{ color: 'var(--accent)' }}>add one in Suppliers</a>
                    </div>
                  )}
                </div>

                <div>
                  <label className="label">Booking Method</label>
                  <select className="input" value={form.booking_method || 'direct'} onChange={e => setForm(p => ({ ...p, booking_method: e.target.value }))}>
                    <option value="direct">Direct (email to hotel)</option>
                    <option value="platform">Via Platform</option>
                  </select>
                </div>

                {form.booking_method === 'platform' && (
                  <div>
                    <label className="label">Platform Name</label>
                    <input className="input" placeholder="e.g. TBO, Travco, HotelBeds, Yalago"
                      value={form.platform_name || ''}
                      onChange={e => setForm(p => ({ ...p, platform_name: e.target.value || null }))} />
                  </div>
                )}

                <div>
                  <label className="label">Payment Terms</label>
                  <select className="input" value={form.payment_terms || 'post-departure'} onChange={e => setForm(p => ({ ...p, payment_terms: e.target.value }))}>
                    {PAYMENT_TERMS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', paddingTop: '18px' }}>
                  <input type="checkbox" id="credit" checked={!!form.credit_agreement}
                    onChange={e => setForm(p => ({ ...p, credit_agreement: e.target.checked }))}
                    style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
                  <label htmlFor="credit" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>Credit agreement in place</label>
                </div>

                <div style={{ gridColumn: '1/-1', height: '1px', background: 'var(--border)', margin: '4px 0' }} />

                <div>
                  <label className="label">Reservation Contact Name</label>
                  <input className="input" placeholder="e.g. Beth, Lisa, Azhar Nunhuck"
                    value={form.reservation_contact || ''}
                    onChange={e => setForm(p => ({ ...p, reservation_contact: e.target.value || null }))} />
                </div>

                <div>
                  <label className="label">Reservation Email</label>
                  <input className="input" type="email" placeholder="reservations@hotel.com"
                    value={form.reservation_email || ''}
                    onChange={e => setForm(p => ({ ...p, reservation_email: e.target.value || null }))} />
                </div>

                <div>
                  <label className="label">Reservation Phone</label>
                  <input className="input" placeholder="e.g. 00230 4151083"
                    value={form.reservation_phone || ''}
                    onChange={e => setForm(p => ({ ...p, reservation_phone: e.target.value || null }))} />
                </div>

                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Hotel Address <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: '0' }}>(appears on accommodation voucher)</span></label>
                  <textarea className="input" style={{ minHeight: '70px', resize: 'vertical', fontSize: '13px' }}
                    placeholder={'Poste De Flacq\nMauritius'}
                    value={form.reservation_address || ''}
                    onChange={e => setForm(p => ({ ...p, reservation_address: e.target.value || null }))} />
                </div>
              </div>
            </div>

            {/* Room types */}
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '6px' }}>Room Types</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>One per line — auto-suggest in quote builder</div>
              <textarea className="input" style={{ minHeight: '180px', resize: 'vertical', fontSize: '13px' }}
                placeholder={'Deluxe Garden Room\nDeluxe Beach Room\nJunior Suite\nJunior Suite Ocean Front\nPrestige Suite\nRoyal Suite'}
                value={form.room_types_text || ''}
                onChange={e => setForm(p => ({ ...p, room_types_text: e.target.value }))} />
            </div>

            {/* Meal plans */}
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '6px' }}>Meal Plans Available</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>One per line — include hotel-specific names</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
                {STANDARD_MEAL_PLANS.map(plan => (
                  <button key={plan} onClick={() => {
                    const current = (form.meal_plans_text || '').split('\n').map(s => s.trim()).filter(Boolean)
                    if (!current.includes(plan)) setForm(p => ({ ...p, meal_plans_text: [...current, plan].join('\n') }))
                  }}
                    style={{ padding: '3px 8px', borderRadius: '20px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: '11px', cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
                    + {plan}
                  </button>
                ))}
              </div>
              <textarea className="input" style={{ minHeight: '100px', resize: 'vertical', fontSize: '13px' }}
                placeholder="All Inclusive&#10;Gourmet Bliss&#10;Serenity Plus"
                value={form.meal_plans_text || ''}
                onChange={e => setForm(p => ({ ...p, meal_plans_text: e.target.value }))} />
            </div>

            {/* Links */}
            <div className="card" style={{ padding: '20px 22px', gridColumn: '1/-1' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '16px' }}>Links & Resources</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label className="label">Hotel Website URL</label>
                  <input className="input" placeholder="https://www.hotelname.com" value={form.website_url || ''} onChange={e => setForm(p => ({ ...p, website_url: e.target.value || null }))} />
                </div>
                <div>
                  <label className="label">MHD Website Page</label>
                  <input className="input" placeholder="https://mauritiusholidaysdirect.co.uk/hotels/…" value={form.mhd_url || ''} onChange={e => setForm(p => ({ ...p, mhd_url: e.target.value || null }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Brochure / Fact Sheet URL</label>
                  <input className="input" placeholder="https://drive.google.com/file/d/…" value={form.brochure_url || ''} onChange={e => setForm(p => ({ ...p, brochure_url: e.target.value || null }))} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button className="btn btn-secondary" onClick={() => { setEditing(null); setIsNew(false) }}>Cancel</button>
            <button className="btn btn-cta" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isNew ? 'Add Hotel' : 'Save Profile'}</button>
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
          <div className="page-title">Hotel Directory</div>
          <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {hotels.length} hotels · {withContact} with reservation contacts · <span style={{ color: 'var(--amber)' }}>{withoutContact} missing contacts</span>
          </div>
        </div>
        <button className="btn btn-cta" onClick={openNew}>+ Add Hotel</button>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input className="input" style={{ width: '240px' }} placeholder="Search hotels, groups, contacts…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" style={{ width: '180px' }} value={filterRegion} onChange={e => setRegion(e.target.value)}>
            <option value="">All regions</option>
            {REGIONS.map(r => <option key={r}>{r}</option>)}
          </select>
          {suppliers.length > 0 && (
            <select className="input" style={{ width: '180px' }} value={filterGroup} onChange={e => setGroup(e.target.value)}>
              <option value="">All suppliers</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          )}
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
            {filtered.map(h => {
              const hasContact  = !!(h.reservation_email || h.reservation_phone)
              const payColor    = PAYMENT_COLORS[h.payment_terms || ''] || 'var(--text-muted)'
              const supplierName = h.supplier_id ? (supplierMap[h.supplier_id]?.name || null) : null
              return (
                <div key={h.id} className="card" style={{ padding: '16px 18px', transition: 'all 0.14s', borderLeft: `3px solid ${hasContact ? 'var(--green)' : 'var(--border)'}` }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}>

                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '4px' }}>
                    <div style={{ fontFamily: 'Fraunces,serif', fontSize: '15px', fontWeight: '300', color: 'var(--text-primary)', lineHeight: '1.3', flex: 1, marginRight: '8px', cursor: 'pointer' }}
                      onClick={() => openEdit(h)}>{h.name}</div>
                    <Stars rating={h.star_rating} />
                  </div>

                  {/* Region + supplier group */}
                  <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                    {h.region && <span style={{ fontSize: '11px', color: 'var(--accent-mid)', fontWeight: '500' }}>📍 {h.region}</span>}
                    {supplierName && (
                      <span style={{ fontSize: '10.5px', background: 'var(--accent-light)', color: 'var(--accent)', padding: '1px 7px', borderRadius: '10px', fontWeight: '500' }}>
                        {supplierName}
                      </span>
                    )}
                    {h.booking_method === 'platform' && h.platform_name && (
                      <span style={{ fontSize: '10.5px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', padding: '1px 7px', borderRadius: '10px' }}>
                        via {h.platform_name}
                      </span>
                    )}
                  </div>

                  {/* Reservation contact */}
                  {(h.reservation_contact || h.reservation_email || h.reservation_phone) ? (
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '8px', padding: '8px 10px', marginBottom: '8px' }}>
                      {h.reservation_contact && (
                        <div style={{ fontSize: '12px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '2px' }}>
                          👤 {h.reservation_contact}
                        </div>
                      )}
                      {h.reservation_email && (
                        <a href={`mailto:${h.reservation_email}`} style={{ fontSize: '11.5px', color: 'var(--accent)', textDecoration: 'none', display: 'block' }}>
                          ✉ {h.reservation_email}
                        </a>
                      )}
                      {h.reservation_phone && (
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                          📞 {h.reservation_phone}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontStyle: 'italic', marginBottom: '8px' }}>No reservation contact yet</div>
                  )}

                  {/* Chips */}
                  <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {h.payment_terms && (
                      <span style={{ fontSize: '10.5px', color: payColor, background: `${payColor}18`, padding: '2px 7px', borderRadius: '4px', fontWeight: '500' }}>
                        {PAYMENT_TERMS.find(t => t.value === h.payment_terms)?.label || h.payment_terms}
                      </span>
                    )}
                    {h.credit_agreement && (
                      <span style={{ fontSize: '10.5px', color: 'var(--green)', background: 'var(--green-light)', padding: '2px 7px', borderRadius: '4px' }}>Credit ✓</span>
                    )}
                    {h.room_types?.length ? <span style={{ fontSize: '10.5px', color: 'var(--blue)', background: 'var(--blue-light)', padding: '2px 7px', borderRadius: '4px' }}>{h.room_types.length} rooms</span> : null}
                    {h.meal_plans?.length ? <span style={{ fontSize: '10.5px', color: 'var(--teal)', background: 'var(--teal-light)', padding: '2px 7px', borderRadius: '4px' }}>{h.meal_plans.length} plans</span> : null}
                    {h.website_url && <a href={h.website_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10.5px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 7px', borderRadius: '4px', textDecoration: 'none' }}>🔗 Website</a>}
                    {h.brochure_url && <a href={h.brochure_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '10.5px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 7px', borderRadius: '4px', textDecoration: 'none' }}>📄 Brochure</a>}
                  </div>

                  {/* Actions */}
                  {confirmDelete === h.id ? (
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', padding: '8px 10px', background: 'var(--red-light)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '12px', color: 'var(--red)', flex: 1 }}>Delete this hotel?</span>
                      <button className="btn btn-danger btn-xs" onClick={() => handleDelete(h.id)}>Yes</button>
                      <button className="btn btn-ghost btn-xs" onClick={() => setConfirmDelete(null)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => openEdit(h)}>✏ Edit</button>
                      {h.reservation_email && (
                        <a href={`mailto:${h.reservation_email}`} className="btn btn-ghost btn-xs" style={{ textDecoration: 'none' }}>✉ Email</a>
                      )}
                      <button className="btn btn-ghost btn-xs" style={{ color: 'var(--red)', marginLeft: 'auto' }} onClick={() => setConfirmDelete(h.id)}>Delete</button>
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
