'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { Deal } from '@/lib/supabase'
import Link from 'next/link'

const STAGES = [
  { key: 'NEW_LEAD',         label: 'New Lead',         color: '#8b5cf6' },
  { key: 'QUOTE_SENT',       label: 'Quote Sent',       color: '#f59e0b' },
  { key: 'ENGAGED',          label: 'Engaged',          color: '#3b82f6' },
  { key: 'FOLLOW_UP',        label: 'Follow Up',        color: '#f97316' },
  { key: 'DECISION_PENDING', label: 'Decision Pending', color: '#ec4899' },
]

const SOURCES = [
  'Website','Referral','Instagram','Facebook','Travel Fair',
  'Repeat Client','Phone Enquiry','Email Enquiry','Google','CPC','SEO','Other',
]

function fmt(n: number) {
  return '£' + (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

function daysOverdue(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

type DealWithClient = Deal & {
  clients?: { first_name: string; last_name: string }
}

type ClientResult = {
  id: number
  first_name: string
  last_name: string
  phone: string
  email: string
}

export default function PipelinePage() {
  const [deals, setDeals]           = useState<DealWithClient[]>([])
  const [loading, setLoading]       = useState(true)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [toast, setToast]           = useState<string | null>(null)
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [newDealStage, setNewDealStage] = useState('NEW_LEAD')
  const [search, setSearch]         = useState('')
  const toastTimer = useRef<any>(null)

  useEffect(() => { loadDeals() }, [])

  async function loadDeals() {
    setLoading(true)
    const { data } = await supabase
      .from('deals')
      .select('*, clients(first_name, last_name)')
      .not('stage', 'in', '("BOOKED","LOST")')
      .order('created_at', { ascending: false })
    setDeals(data || [])
    setLoading(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  async function moveDeal(dealId: number, newStage: string) {
    const deal = deals.find(d => d.id === dealId)
    if (!deal || deal.stage === newStage) return
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: newStage } : d))
    const { error } = await supabase.from('deals').update({ stage: newStage }).eq('id', dealId)
    if (error) {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: deal.stage } : d))
      showToast('Failed to update deal')
    } else {
      await supabase.from('activities').insert({
        deal_id: dealId,
        activity_type: 'STAGE_CHANGE',
        notes: `Moved to ${STAGES.find(s => s.key === newStage)?.label || newStage}`,
      })
      showToast(`Moved to ${STAGES.find(s => s.key === newStage)?.label}`)
    }
  }

  const filtered = search
    ? deals.filter(d =>
        d.title?.toLowerCase().includes(search.toLowerCase()) ||
        d.clients?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.clients?.last_name?.toLowerCase().includes(search.toLowerCase())
      )
    : deals

  const totalPipeline = deals.reduce((a, d) => a + (d.deal_value || 0), 0)

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading pipeline…</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Pipeline</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {deals.length} deals · {fmt(totalPipeline)} total
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input className="input" style={{ width: '220px' }} placeholder="Search deals…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <button className="btn btn-primary" onClick={() => { setNewDealStage('NEW_LEAD'); setShowNewDeal(true) }}>
            + New Deal
          </button>
        </div>
      </div>

      {/* Kanban board */}
      <div style={{ padding: '20px 24px', overflowX: 'auto' }}>
        <div className="kanban-board">
          {STAGES.map(stage => {
            const stageDeals = filtered.filter(d => d.stage === stage.key)
            const stageVal   = stageDeals.reduce((a, d) => a + (d.deal_value || 0), 0)
            const isDragOver = dragOverStage === stage.key

            return (
              <div key={stage.key} className="kanban-col"
                style={{ borderTop: `3px solid ${stage.color}` }}
                onDragOver={e => { e.preventDefault(); setDragOverStage(stage.key) }}
                onDragLeave={() => setDragOverStage(null)}
                onDrop={e => { e.preventDefault(); setDragOverStage(null); if (draggingId) moveDeal(draggingId, stage.key) }}>

                <div className="kanban-col-header">
                  <div>
                    <div className="kanban-col-title" style={{ color: stage.color }}>{stage.label}</div>
                    {stageVal > 0 && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{fmt(stageVal)}</div>}
                  </div>
                  <span style={{ background: stage.color+'22', color: stage.color, borderRadius: '12px', padding: '2px 8px', fontSize: '11.5px', fontWeight: '600' }}>
                    {stageDeals.length}
                  </span>
                </div>

                <div style={{ minHeight: '80px', borderRadius: '8px', padding: isDragOver ? '6px' : '0',
                  background: isDragOver ? 'var(--accent-light)' : 'transparent',
                  border: isDragOver ? '2px dashed var(--accent-mid)' : '2px dashed transparent',
                  transition: 'all 0.15s' }}>

                  {stageDeals.map(deal => {
                    const client     = deal.clients
                    const isOverdue  = deal.next_activity_at && new Date(deal.next_activity_at) < new Date()
                    const overdueDays = isOverdue ? daysOverdue(deal.next_activity_at!) : 0
                    const isRotten   = overdueDays >= 5

                    return (
                      <div key={deal.id} className={`deal-card ${draggingId === deal.id ? 'dragging' : ''}`}
                        draggable
                        onDragStart={() => setDraggingId(deal.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverStage(null) }}
                        style={{ borderLeft: isRotten ? '3px solid var(--red)' : undefined }}>

                        <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '14.5px', color: 'var(--text-primary)', marginBottom: '4px', lineHeight: '1.3' }}>
                            {deal.title}
                          </div>
                        </Link>

                        {client && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>
                            {client.first_name} {client.last_name}
                          </div>
                        )}

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          {deal.deal_value ? (
                            <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--green)' }}>{fmt(deal.deal_value)}</span>
                          ) : <span />}
                          {deal.departure_date && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                              {new Date(deal.departure_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          )}
                        </div>

                        {isOverdue && (
                          <div style={{ fontSize: '11px', color: isRotten ? 'var(--red)' : 'var(--amber)', fontWeight: '500', marginBottom: '6px' }}>
                            {isRotten ? `🔴 ${overdueDays}d overdue` : `⚠ ${overdueDays}d overdue`}
                          </div>
                        )}

                        <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {STAGES.filter(s => s.key !== deal.stage).slice(0, 2).map(s => (
                            <button key={s.key}
                              onClick={e => { e.stopPropagation(); moveDeal(deal.id, s.key) }}
                              style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.12s' }}
                              onMouseEnter={e => { e.currentTarget.style.background = s.color+'22'; e.currentTarget.style.color = s.color; e.currentTarget.style.borderColor = s.color }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                              → {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <button className="btn btn-ghost btn-sm"
                  style={{ width: '100%', marginTop: '8px', border: '1.5px dashed var(--border)', justifyContent: 'center' }}
                  onClick={() => { setNewDealStage(stage.key); setShowNewDeal(true) }}>
                  + Add deal
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {showNewDeal && (
        <NewDealModal
          defaultStage={newDealStage}
          onClose={() => setShowNewDeal(false)}
          onSaved={() => { setShowNewDeal(false); loadDeals(); showToast('Deal created!') }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ── NEW DEAL MODAL ─────────────────────────────────────────
function NewDealModal({ defaultStage, onClose, onSaved }: {
  defaultStage: string
  onClose: () => void
  onSaved: () => void
}) {
  // Client search state
  const [clientSearch, setClientSearch]     = useState('')
  const [clientResults, setClientResults]   = useState<ClientResult[]>([])
  const [selectedClient, setSelectedClient] = useState<ClientResult | null>(null)
  const [showNewClient, setShowNewClient]   = useState(false)
  const [searching, setSearching]           = useState(false)

  // New client fields (only used if creating new)
  const [newFirst, setNewFirst]   = useState('')
  const [newLast, setNewLast]     = useState('')
  const [newEmail, setNewEmail]   = useState('')
  const [newPhone, setNewPhone]   = useState('')

  // Deal fields
  const [title, setTitle]               = useState('')
  const [dealValue, setDealValue]       = useState('')
  const [departureDate, setDeparture]   = useState('')
  const [source, setSource]             = useState('Website')
  const [stage, setStage]               = useState(defaultStage)

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const searchTimer         = useRef<any>(null)

  // Search clients as user types
  function handleClientSearch(val: string) {
    setClientSearch(val)
    setSelectedClient(null)
    setShowNewClient(false)
    if (!val.trim()) { setClientResults([]); return }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const { data } = await supabase
        .from('clients')
        .select('id, first_name, last_name, phone, email')
        .or(`first_name.ilike.%${val}%,last_name.ilike.%${val}%,phone.ilike.%${val}%,email.ilike.%${val}%`)
        .limit(6)
      setClientResults(data || [])
      setSearching(false)
    }, 300)
  }

  function selectClient(c: ClientResult) {
    setSelectedClient(c)
    setClientSearch(`${c.first_name} ${c.last_name}`)
    setClientResults([])
    setShowNewClient(false)
    // Auto-fill deal title if empty
    if (!title.trim()) setTitle(`${c.last_name} — Mauritius`)
  }

  function chooseNewClient() {
    setSelectedClient(null)
    setShowNewClient(true)
    setClientResults([])
    // Pre-fill from search if they typed a name
    const parts = clientSearch.trim().split(' ')
    if (parts[0]) setNewFirst(parts[0])
    if (parts[1]) setNewLast(parts.slice(1).join(' '))
  }

  async function handleSave() {
    if (!title.trim()) { setError('Deal title is required'); return }
    if (!selectedClient && !showNewClient) { setError('Please select or create a client'); return }
    if (showNewClient && !newFirst.trim()) { setError('Client first name is required'); return }

    setSaving(true); setError('')
    try {
      let clientId: number

      if (selectedClient) {
        clientId = selectedClient.id
      } else {
        // Create new client
        const { data: newClient, error: cErr } = await supabase
          .from('clients')
          .insert({
            first_name: newFirst.trim(),
            last_name:  newLast.trim(),
            email:      newEmail.trim(),
            phone:      newPhone.trim(),
          })
          .select('id').single()
        if (cErr || !newClient) { setError('Failed to create client'); setSaving(false); return }
        clientId = newClient.id
      }

      // Create deal
      const { error: dErr } = await supabase.from('deals').insert({
        title:          title.trim(),
        client_id:      clientId,
        stage,
        deal_value:     dealValue ? parseFloat(dealValue) : null,
        departure_date: departureDate || null,
        source,
      })
      if (dErr) { setError('Failed to create deal'); setSaving(false); return }
      onSaved()
    } catch {
      setError('Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: '520px' }}>
        <div className="modal-title">New Deal</div>

        {error && (
          <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        {/* ── CLIENT SEARCH ── */}
        <div style={{ marginBottom: '16px' }}>
          <label className="label">Client *</label>

          {/* Search box */}
          {!selectedClient && (
            <div style={{ position: 'relative' }}>
              <input
                className="input"
                placeholder="Search by name or phone…"
                value={clientSearch}
                onChange={e => handleClientSearch(e.target.value)}
                autoFocus
              />
              {searching && (
                <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '11px', color: 'var(--text-muted)' }}>
                  Searching…
                </div>
              )}

              {/* Search results dropdown */}
              {clientResults.length > 0 && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px', boxShadow: 'var(--shadow-md)', zIndex: 50, overflow: 'hidden', marginTop: '4px' }}>
                  {clientResults.map(c => (
                    <div key={c.id}
                      onClick={() => selectClient(c)}
                      style={{ padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--text-primary)' }}>
                          {c.first_name} {c.last_name}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{c.phone || c.email}</div>
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--accent)' }}>Select →</span>
                    </div>
                  ))}
                  {/* Option to create new */}
                  <div onClick={chooseNewClient}
                    style={{ padding: '10px 14px', cursor: 'pointer', color: 'var(--accent)', fontSize: '13px', fontWeight: '500' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    + Create new client "{clientSearch}"
                  </div>
                </div>
              )}

              {/* No results — show create option */}
              {clientSearch.length >= 2 && clientResults.length === 0 && !searching && (
                <div style={{ marginTop: '6px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={chooseNewClient}>
                    + Create new client "{clientSearch}"
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Selected client badge */}
          {selectedClient && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--accent-light)', borderRadius: '8px', border: '1.5px solid var(--accent)' }}>
              <div>
                <div style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--accent)' }}>
                  {selectedClient.first_name} {selectedClient.last_name}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--accent-mid)' }}>{selectedClient.phone || selectedClient.email}</div>
              </div>
              <button onClick={() => { setSelectedClient(null); setClientSearch('') }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '16px' }}>
                ✕
              </button>
            </div>
          )}
        </div>

        {/* New client fields — shown only when creating new */}
        {showNewClient && !selectedClient && (
          <div style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '14px', marginBottom: '16px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>
              New Client Details
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label className="label">First Name *</label>
                <input className="input" placeholder="John" value={newFirst} onChange={e => setNewFirst(e.target.value)} />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input className="input" placeholder="Smith" value={newLast} onChange={e => setNewLast(e.target.value)} />
              </div>
              <div>
                <label className="label">Phone</label>
                <input className="input" placeholder="+44 7700 000000" value={newPhone} onChange={e => setNewPhone(e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="john@email.com" value={newEmail} onChange={e => setNewEmail(e.target.value)} />
              </div>
            </div>
          </div>
        )}

        {/* Deal fields */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <label className="label">Deal Title *</label>
            <input className="input" placeholder="e.g. Smith Family — Mauritius Nov 2026"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="label">Deal Value (£)</label>
            <input className="input" type="number" placeholder="4500"
              value={dealValue} onChange={e => setDealValue(e.target.value)} />
          </div>
          <div>
            <label className="label">Departure Date</label>
            <input className="input" type="date" value={departureDate} onChange={e => setDeparture(e.target.value)} />
          </div>
          <div>
            <label className="label">Source</label>
            <select className="input" value={source} onChange={e => setSource(e.target.value)}>
              {SOURCES.map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Stage</label>
            <select className="input" value={stage} onChange={e => setStage(e.target.value)}>
              {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '22px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Create Deal'}
          </button>
        </div>
      </div>
    </div>
  )
}
