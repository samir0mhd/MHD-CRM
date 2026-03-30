
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'

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
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterRegion, setRegion]   = useState('')
  const [editing, setEditing]       = useState<Hotel | null>(null)
  const [saving, setSaving]         = useState(false)
  const [toast, setToast]           = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const toastTimer                  = useRef<any>(null)

  // Form state
  const [form, setForm] = useState<Partial<Hotel & { room_types_text: string; meal_plans_text: string; highlights_text: string }>>({})

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('hotel_list').select('*').order('name')
    setHotels(data || [])
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
    setEditing(hotel)
  }

  async function handleSave() {
    if (!editing) return
    setSaving(true)
    const { room_types_text, meal_plans_text, highlights_text, ...rest } = form
    const payload = {
      ...rest,
      room_types:  room_types_text ? room_types_text.split('\n').map(s => s.trim()).filter(Boolean) : [],
      meal_plans:  meal_plans_text ? meal_plans_text.split('\n').map(s => s.trim()).filter(Boolean) : [],
      highlights:  highlights_text ? highlights_text.split('\n').map(s => s.trim()).filter(Boolean) : [],
    }
    const { error } = await supabase.from('hotel_list').update(payload).eq('id', editing.id)
    if (error) { showToast('Failed: ' + error.message, 'error'); setSaving(false); return }
    showToast('Hotel updated ✓')
    setSaving(false)
    setEditing(null)
    load()
  }

  const filtered = hotels.filter(h => {
    const q = search.toLowerCase()
    const matchSearch = !q || h.name.toLowerCase().includes(q) || (h.region||'').toLowerCase().includes(q)
    const matchRegion = !filterRegion || h.region === filterRegion
    return matchSearch && matchRegion
  })

  const withProfile  = hotels.filter(h => h.description || h.star_rating || (h.room_types?.length))
  const withoutProfile = hotels.length - withProfile.length

  // ── EDIT PANEL ─────────────────────────────────────────
  if (editing) {
    return (
      <div>
        <div className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={() => setEditing(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '13px', cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>← Hotels</button>
            <div style={{ width: '1px', height: '20px', background: 'var(--border)' }} />
            <div>
              <div className="page-title">{editing.name}</div>
              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Edit hotel profile</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-cta" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
          </div>
        </div>

        <div className="page-body" style={{ maxWidth: '860px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

            {/* Basic info */}
            <div className="card" style={{ padding: '20px 22px', gridColumn: '1/-1' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '16px' }}>Basic Information</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
                  <label className="label">Resort Highlights <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: '0' }}>(one per line — shown as bullet points)</span></label>
                  <textarea className="input" style={{ minHeight: '100px', resize: 'vertical', fontSize: '13px' }}
                    placeholder={'Overwater bungalows with direct lagoon access\nPrivate beach stretching 800m\nMichelin-starred dining experience\nWorld-class spa with local treatments'}
                    value={form.highlights_text || ''}
                    onChange={e => setForm(p => ({ ...p, highlights_text: e.target.value }))} />
                </div>
                <div style={{ gridColumn: '1/-1' }}>
                  <label className="label">Description</label>
                  <textarea className="input" style={{ minHeight: '120px', resize: 'vertical', fontSize: '13px' }}
                    placeholder="Full resort description — location, style, ideal for…"
                    value={form.description || ''}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
                </div>
              </div>
            </div>

            {/* Room types */}
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '6px' }}>Room Types</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>One per line — these appear in the quote builder room type suggestions</div>
              <textarea className="input" style={{ minHeight: '180px', resize: 'vertical', fontSize: '13px' }}
                placeholder={'Deluxe Garden Room\nDeluxe Beach Room\nJunior Suite\nJunior Suite Ocean Front\nPrestige Suite\nRoyal Suite'}
                value={form.room_types_text || ''}
                onChange={e => setForm(p => ({ ...p, room_types_text: e.target.value }))} />
            </div>

            {/* Meal plans */}
            <div className="card" style={{ padding: '20px 22px' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '6px' }}>Meal Plans Available</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>One per line — include hotel-specific names (e.g. Gourmet Bliss, Serenity Plus)</div>
              {/* Quick add standard plans */}
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
              <textarea className="input" style={{ minHeight: '120px', resize: 'vertical', fontSize: '13px' }}
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
                  <label className="label">Brochure / Fact Sheet URL <span style={{ fontWeight: '400', textTransform: 'none', letterSpacing: '0' }}>(Google Drive, Dropbox, or direct PDF link)</span></label>
                  <input className="input" placeholder="https://drive.google.com/file/d/…" value={form.brochure_url || ''} onChange={e => setForm(p => ({ ...p, brochure_url: e.target.value || null }))} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
            <button className="btn btn-cta" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
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
            {hotels.length} hotels · {withProfile.length} with profiles · <span style={{ color: 'var(--amber)' }}>{withoutProfile} need info</span>
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
          <input className="input" style={{ width: '260px' }} placeholder="Search hotels…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="input" style={{ width: '200px' }} value={filterRegion} onChange={e => setRegion(e.target.value)}>
            <option value="">All regions</option>
            {REGIONS.map(r => <option key={r}>{r}</option>)}
          </select>
          <div style={{ flex: 1 }} />
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--green)' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Has profile</span>
            <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--border-strong)', marginLeft: '8px' }} />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Needs info</span>
          </div>
        </div>

        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '10px' }}>
            {filtered.map(h => {
              const hasProfile = !!(h.description || h.star_rating || h.room_types?.length)
              return (
                <div key={h.id} className="card" style={{ padding: '16px 18px', cursor: 'pointer', transition: 'all 0.14s', borderLeft: `3px solid ${hasProfile ? 'var(--green)' : 'var(--border)'}` }}
                  onClick={() => openEdit(h)}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                    <div style={{ fontFamily: 'Fraunces,serif', fontSize: '15px', fontWeight: '300', color: 'var(--text-primary)', lineHeight: '1.3', flex: 1, marginRight: '8px' }}>{h.name}</div>
                    <Stars rating={h.star_rating} />
                  </div>
                  {h.region && <div style={{ fontSize: '11.5px', color: 'var(--accent-mid)', fontWeight: '500', marginBottom: '4px' }}>📍 {h.region}</div>}
                  {h.highlights?.length ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.6' }}>
                      {h.highlights.slice(0, 2).map((hi, i) => <div key={i}>· {hi}</div>)}
                      {h.highlights.length > 2 && <div style={{ color: 'var(--accent)', fontSize: '11px' }}>+{h.highlights.length - 2} more</div>}
                    </div>
                  ) : h.description ? (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.5' }}>{h.description.slice(0, 100)}{h.description.length > 100 ? '…' : ''}</div>
                  ) : (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>No profile yet — click to add</div>
                  )}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    {h.room_types?.length && <span style={{ fontSize: '10.5px', color: 'var(--blue)', background: 'var(--blue-light)', padding: '2px 7px', borderRadius: '4px' }}>{h.room_types.length} room types</span>}
                    {h.meal_plans?.length && <span style={{ fontSize: '10.5px', color: 'var(--teal)', background: 'var(--teal-light)', padding: '2px 7px', borderRadius: '4px' }}>{h.meal_plans.length} meal plans</span>}
                    {h.website_url && <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 7px', borderRadius: '4px' }}>🔗 Website</span>}
                    {h.brochure_url && <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 7px', borderRadius: '4px' }}>📄 Brochure</span>}
                  </div>
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
