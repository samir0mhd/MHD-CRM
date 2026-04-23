'use client'

import { useEffect, useState, useRef } from 'react'
import { getAccessContext, isManager, type StaffUser } from '@/lib/access'
import { authedFetch } from '@/lib/api-client'
import { type ClientWithStats, BEHAVIOUR_TAGS, SOURCES, BUDGET_RANGES, formatCurrency, getClientInitials, getAvatarColor, getTagInfo, calculateClientAge, getBudgetRangeLabel } from '@/lib/modules/clients/client.service'
import Link from 'next/link'

// ── TYPES ─────────────────────────────────────────────────
type Client = ClientWithStats

// ── CONSTANTS ─────────────────────────────────────────────

// ── HELPERS ───────────────────────────────────────────────
function fmt(n: number) {
  return formatCurrency(n)
}

function initials(c: { first_name: string; last_name: string }) {
  return getClientInitials(c)
}

function avatarColor(id: number) {
  return getAvatarColor(id)
}

function calcAge(dob: string | null) {
  return calculateClientAge(dob)
}

function budgetLabel(min: number | null, max: number | null) {
  return getBudgetRangeLabel(min, max)
}

function tagInfo(key: string) {
  return getTagInfo(key)
}

function fmtDate(value: string | null) {
  if (!value) return 'No date'
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function historyStatusStyle(statusLabel: string) {
  if (statusLabel === 'Booked') return { background: '#e6f4ee', color: '#10b981' }
  if (statusLabel === 'Lost') return { background: '#fee2e2', color: '#dc2626' }
  if (statusLabel === 'Cancelled') return { background: '#f3f4f6', color: '#6b7280' }
  if (statusLabel === 'Quoted') return { background: '#fff7ed', color: '#f97316' }
  return { background: '#eef2ff', color: '#4f46e5' }
}

function historyValueColor(valueTone: 'booked' | 'pipeline' | 'lost' | 'muted') {
  if (valueTone === 'booked') return 'var(--green)'
  if (valueTone === 'lost') return '#dc2626'
  if (valueTone === 'pipeline') return 'var(--text-primary)'
  return 'var(--text-muted)'
}

// ── BLANK FORM ─────────────────────────────────────────────
function blankForm() {
  return {
    first_name: '', last_name: '', phone: '', email: '',
    date_of_birth: '', source: '',
    budget_min: '', budget_max: '',
    special_occasions: '', behaviour_tags: [] as string[],
    advisor_notes: '',
    billing_address_line1: '', billing_address_line2: '',
    billing_city: '', billing_postcode: '', billing_country: 'United Kingdom',
    owner_staff_id: '',
  }
}

// ── MAIN PAGE ─────────────────────────────────────────────
export default function ClientsPage() {
  const [clients, setClients]         = useState<ClientWithStats[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterTag, setFilterTag]     = useState<string | null>(null)
  const [showModal, setShowModal]     = useState(false)
  const [selectedClient, setSelectedClient] = useState<ClientWithStats | null>(null)
  const [editClient, setEditClient]   = useState<Client | null>(null)
  const [staffUsers, setStaffUsers]   = useState<StaffUser[]>([])
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(null)
  const [toast, setToast]             = useState<string | null>(null)
  const [view, setView]               = useState<'grid' | 'list'>('grid')
  const toastTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-open client panel if ?id= param is in URL
  useEffect(() => {
    if (typeof window === 'undefined') return
    const id = Number(new URLSearchParams(window.location.search).get('id'))
    if (!id || clients.length === 0) return
    const found = clients.find(c => c.id === id)
    if (!found) return
    const frame = window.requestAnimationFrame(() => setSelectedClient(found))
    return () => window.cancelAnimationFrame(frame)
  }, [clients])

  async function loadClients(silent = false) {
    if (!silent) setLoading(true)
    try {
      const res = await authedFetch('/api/clients')
      const result = await res.json()
      if (result.success && Array.isArray(result.data)) {
        setClients(result.data as ClientWithStats[])
      }
    } catch (err) {
      console.error('[loadClients] failed:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  async function loadAccess() {
    const { staffUsers, currentStaff } = await getAccessContext()
    setStaffUsers(staffUsers)
    setCurrentStaff(currentStaff)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadClients()
      void loadAccess()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    const matchSearch = !q || [c.first_name, c.last_name, c.phone, c.email].some(f => f?.toLowerCase().includes(q))
    const matchTag = !filterTag || (c.behaviour_tags || []).includes(filterTag)
    return matchSearch && matchTag
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading clients…</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Clients</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {clients.length} clients · {clients.reduce((sum, client) => sum + client.bookingCount, 0)} bookings · {fmt(clients.reduce((sum, client) => sum + client.bookedLifetimeValue, 0))} booked lifetime value · {fmt(clients.reduce((sum, client) => sum + client.openPipelineValue, 0))} open pipeline
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input className="input" style={{ width: '240px' }} placeholder="Search name, phone, email…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            {(['grid', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontFamily: 'Outfit, sans-serif', fontWeight: '500',
                background: view === v ? 'var(--surface)' : 'transparent',
                color: view === v ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: view === v ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s',
              }}>
                {v === 'grid' ? '⊞ Cards' : '≡ List'}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => { setEditClient(null); setShowModal(true) }}>
            + New Client
          </button>
        </div>
      </div>

      <div className="page-body">

        {/* Tag filters */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '20px' }}>
          <button
            onClick={() => setFilterTag(null)}
            style={{ padding: '5px 13px', borderRadius: '20px', border: '1.5px solid', fontSize: '12px', cursor: 'pointer',
              borderColor: !filterTag ? 'var(--accent)' : 'var(--border)',
              background: !filterTag ? 'var(--accent-light)' : 'transparent',
              color: !filterTag ? 'var(--accent)' : 'var(--text-muted)' }}>
            All clients
          </button>
          {BEHAVIOUR_TAGS.map(tag => {
            const count = clients.filter(c => (c.behaviour_tags || []).includes(tag.key)).length
            if (count === 0) return null
            const active = filterTag === tag.key
            return (
              <button key={tag.key} onClick={() => setFilterTag(active ? null : tag.key)}
                style={{ padding: '5px 13px', borderRadius: '20px', border: '1.5px solid', fontSize: '12px', cursor: 'pointer',
                  borderColor: active ? tag.color : 'var(--border)',
                  background: active ? tag.color + '22' : 'transparent',
                  color: active ? tag.color : 'var(--text-muted)' }}>
                {tag.icon} {tag.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="card empty-state">
            <div style={{ fontSize: '32px' }}>◑</div>
            <div className="empty-state-title">{search || filterTag ? 'No clients match' : 'No clients yet'}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {search || filterTag ? 'Try a different search or filter' : 'Add your first client to get started'}
            </div>
            {!search && !filterTag && (
              <button className="btn btn-primary" style={{ marginTop: '14px' }} onClick={() => { setEditClient(null); setShowModal(true) }}>
                + Add Client
              </button>
            )}
          </div>
        )}

        {/* ── CARD VIEW ── */}
        {view === 'grid' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
            {filtered.map(client => {
              const ownerName = client.owner_staff_id ? staffUsers.find(staff => staff.id === client.owner_staff_id)?.name : null
              return (
              <div key={client.id} className="card"
                style={{ padding: '20px', cursor: 'pointer', transition: 'all 0.15s' }}
                onClick={() => setSelectedClient(client)}
                onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}>

                {/* Avatar + name */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: avatarColor(client.id), color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Instrument Serif, serif', fontSize: '17px', flexShrink: 0 }}>
                    {initials(client)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '18px', color: 'var(--text-primary)', marginBottom: '1px' }}>
                      {client.first_name} {client.last_name}
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {client.phone && <span>{client.phone}</span>}
                      {client.phone && client.email && <span> · </span>}
                      {client.email && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '160px', verticalAlign: 'bottom' }}>{client.email}</span>}
                    </div>
                    {ownerName && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>
                        Owner: {ownerName}
                      </div>
                    )}
                  </div>
                  {client.behaviour_tags?.includes('vip') && (
                    <span style={{ fontSize: '18px' }}>⭐</span>
                  )}
                </div>

                {/* Behaviour tags */}
                {(client.behaviour_tags || []).length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                    {(client.behaviour_tags || []).slice(0, 4).map(key => {
                      const tag = tagInfo(key)
                      if (!tag) return null
                      return (
                        <span key={key} style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: tag.color + '18', color: tag.color, fontWeight: '500' }}>
                          {tag.icon} {tag.label}
                        </span>
                      )
                    })}
                    {(client.behaviour_tags || []).length > 4 && (
                      <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                        +{client.behaviour_tags.length - 4}
                      </span>
                    )}
                  </div>
                )}

                {/* Budget + occasions */}
                {(client.budget_min || client.budget_max) && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    Budget: <strong style={{ color: 'var(--text-primary)' }}>{budgetLabel(client.budget_min, client.budget_max)}</strong>
                  </div>
                )}
                {client.special_occasions && (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    {client.special_occasions}
                  </div>
                )}

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0', paddingTop: '12px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
                  {[
                    { label: 'Enquiries', val: client.enquiryCount, color: 'var(--text-primary)' },
                    { label: 'Bookings', val: client.bookingCount, color: 'var(--green)' },
                    { label: 'Booked Value', val: client.bookedLifetimeValue > 0 ? fmt(client.bookedLifetimeValue) : '£0', color: client.bookedLifetimeValue > 0 ? 'var(--green)' : 'var(--text-primary)' },
                    { label: 'Open Pipeline', val: client.openPipelineValue > 0 ? fmt(client.openPipelineValue) : '£0', color: client.openPipelineValue > 0 ? 'var(--accent)' : 'var(--text-primary)' },
                  ].map((s, i) => (
                    <div key={s.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '18px', color: s.color }}>{s.val}</div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            )})}
          </div>
        )}

        {/* ── LIST VIEW ── */}
        {view === 'list' && filtered.length > 0 && (
          <div>
            {/* Header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '190px 1fr 170px 110px 75px 85px 110px 110px',
              gap: '12px', padding: '0 16px 8px',
              borderBottom: '2px solid var(--border)',
            }}>
              {['Client', 'Tags', 'Contact', 'Budget', 'Enquiries', 'Bookings', 'Booked Value', 'Open Pipeline'].map(h => (
                <div key={h} style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif' }}>{h}</div>
              ))}
            </div>

            {filtered.map(client => {
              const ownerName = client.owner_staff_id ? staffUsers.find(staff => staff.id === client.owner_staff_id)?.name : null
              return (
              <div key={client.id}
                onClick={() => setSelectedClient(client)}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '190px 1fr 170px 110px 75px 85px 110px 110px',
                  gap: '12px', padding: '11px 16px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface)',
                  alignItems: 'center',
                  cursor: 'pointer',
                  borderRadius: '0',
                  marginBottom: '2px',
                  borderTopRightRadius: '8px', borderBottomRightRadius: '8px',
                  borderLeft: client.behaviour_tags?.includes('vip')
                    ? '3px solid var(--gold)'
                    : client.bookedLifetimeValue > 0
                    ? '3px solid var(--green)'
                    : '3px solid var(--border)',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
              >
                {/* Client name + avatar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: avatarColor(client.id), color: 'white',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'Outfit, sans-serif', fontSize: '11px', fontWeight: '700',
                  }}>
                    {initials(client)}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: '13.5px', fontWeight: '600', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {client.first_name} {client.last_name}
                    </div>
                    {client.lastDealDate && (
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        Last enquiry {new Date(client.lastDealDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    )}
                    {ownerName && (
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>
                        Owner: {ownerName}
                      </div>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {(client.behaviour_tags || []).slice(0, 3).map(key => {
                    const tag = tagInfo(key)
                    if (!tag) return null
                    return (
                      <span key={key} style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: tag.color + '18', color: tag.color, fontWeight: '600', whiteSpace: 'nowrap' }}>
                        {tag.label}
                      </span>
                    )
                  })}
                  {(client.behaviour_tags || []).length > 3 && (
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+{client.behaviour_tags.length - 3}</span>
                  )}
                </div>

                {/* Contact */}
                <div style={{ minWidth: 0 }}>
                  {client.phone && (
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.phone}</div>
                  )}
                  {client.email && (
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.email}</div>
                  )}
                </div>

                {/* Budget */}
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif' }}>
                  {budgetLabel(client.budget_min, client.budget_max) ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                </div>

                {/* Deals */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>{client.enquiryCount}</div>
                </div>

                {/* Bookings */}
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '14px', fontWeight: '700', color: client.bookingCount > 0 ? 'var(--green)' : 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}>{client.bookingCount}</div>
                </div>

                {/* Booked value */}
                <div style={{ fontSize: '13.5px', fontWeight: '700', fontFamily: 'Outfit, sans-serif', color: client.bookedLifetimeValue > 0 ? 'var(--green)' : 'var(--text-muted)' }}>
                  {client.bookedLifetimeValue > 0 ? fmt(client.bookedLifetimeValue) : '—'}
                </div>

                {/* Open pipeline */}
                <div style={{ fontSize: '13.5px', fontWeight: '700', fontFamily: 'Outfit, sans-serif', color: client.openPipelineValue > 0 ? 'var(--accent)' : 'var(--text-muted)' }}>
                  {client.openPipelineValue > 0 ? fmt(client.openPipelineValue) : '—'}
                </div>
              </div>
            )})}
          </div>
        )}
      </div>

      {/* Client detail panel */}
      {selectedClient && (
        <ClientDetailPanel
          client={selectedClient}
          staffUsers={staffUsers}
          onClose={() => setSelectedClient(null)}
          onEdit={() => { setEditClient(selectedClient); setShowModal(true); setSelectedClient(null) }}
        />
      )}

      {/* New / Edit modal */}
      {showModal && (
        <ClientModal
          client={editClient}
          staffUsers={staffUsers}
          currentStaff={currentStaff}
          onClose={() => { setShowModal(false); setEditClient(null) }}
          onSaved={() => { setShowModal(false); setEditClient(null); void loadClients(true); showToast(editClient ? 'Client updated ✓' : 'Client created ✓') }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ── CLIENT DETAIL PANEL ────────────────────────────────────
function ClientDetailPanel({ client, staffUsers, onClose, onEdit }: {
  client: ClientWithStats
  staffUsers: StaffUser[]
  onClose: () => void
  onEdit: () => void
}) {
  const clientAge = calcAge(client.date_of_birth)
  const ownerName = client.owner_staff_id ? staffUsers.find(staff => staff.id === client.owner_staff_id)?.name : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,14,13,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '480px', background: 'var(--surface)', height: '100vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column' }}>

        {/* Panel header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '14px', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
          <div style={{ width: '46px', height: '46px', borderRadius: '50%', background: avatarColor(client.id), color: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Instrument Serif, serif', fontSize: '18px', flexShrink: 0 }}>
            {initials(client)}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '20px', color: 'var(--text-primary)' }}>
              {client.first_name} {client.last_name}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Client since {new Date(client.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
            </div>
            {ownerName && (
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Owner: {ownerName}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={onEdit}>Edit</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>
        </div>

        <div style={{ padding: '20px 24px', flex: 1 }}>

          {/* Quick contact */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
            {client.phone && (
              <>
                <a href={`tel:${client.phone}`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}>📞 Call</a>
                <a href={`https://wa.me/${client.phone.replace(/\D/g, '')}`} target="_blank" className="btn btn-sm" style={{ textDecoration: 'none', flex: 1, justifyContent: 'center', background: '#e8f9ef', color: '#1a9e52', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', borderRadius: '8px', fontFamily: 'DM Sans, sans-serif', fontSize: '12px', fontWeight: '500' }}>💬 WhatsApp</a>
              </>
            )}
            {client.email && (
              <a href={`mailto:${client.email}`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none', flex: 1, justifyContent: 'center' }}>📧 Email</a>
            )}
          </div>

          {/* Commercial summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Enquiries', val: client.commercialSummary.enquiries, color: 'var(--accent-mid)' },
              { label: 'Bookings', val: client.commercialSummary.bookings, color: 'var(--green)' },
              { label: 'Booked Lifetime Value', val: fmt(client.commercialSummary.bookedLifetimeValue), color: 'var(--green)' },
              { label: 'Open Pipeline Value', val: fmt(client.commercialSummary.openPipelineValue), color: 'var(--accent)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-tertiary)', borderRadius: '10px', padding: '12px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '22px', color: s.color }}>{s.val}</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Behaviour tags */}
          {(client.behaviour_tags || []).length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>Client Profile</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {(client.behaviour_tags || []).map(key => {
                  const tag = tagInfo(key)
                  if (!tag) return null
                  return (
                    <span key={key} style={{ fontSize: '12px', padding: '4px 10px', borderRadius: '20px', background: tag.color + '18', color: tag.color, fontWeight: '500' }}>
                      {tag.icon} {tag.label}
                    </span>
                  )
                })}
              </div>
            </div>
          )}

          {/* Contact & personal details */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Contact & Personal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { label: 'Phone', val: client.phone },
                { label: 'Email', val: client.email },
                { label: 'Date of birth', val: client.date_of_birth ? `${new Date(client.date_of_birth).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}${clientAge ? ` (age ${clientAge})` : ''}` : null },
                { label: 'Source', val: client.source },
                { label: 'Budget', val: budgetLabel(client.budget_min, client.budget_max) },
                { label: 'Special occasions', val: client.special_occasions },
              ].filter(f => f.val).map(f => (
                <div key={f.label} style={{ display: 'flex', gap: '12px', fontSize: '13.5px' }}>
                  <span style={{ color: 'var(--text-muted)', minWidth: '120px', fontSize: '12px' }}>{f.label}</span>
                  <span style={{ color: 'var(--text-primary)', flex: 1 }}>{f.val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Billing address — shown only if filled */}
          {(client.billing_address_line1 || client.billing_city || client.billing_postcode) && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>Billing Address</div>
              <div style={{ fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: '1.8' }}>
                {client.billing_address_line1 && <div>{client.billing_address_line1}</div>}
                {client.billing_address_line2 && <div>{client.billing_address_line2}</div>}
                {client.billing_city && <div>{client.billing_city}</div>}
                {client.billing_postcode && <div>{client.billing_postcode}</div>}
                {client.billing_country && <div>{client.billing_country}</div>}
              </div>
            </div>
          )}

          {/* Advisor notes */}
          {client.advisor_notes && (
            <div style={{ marginBottom: '20px', background: 'var(--gold-light)', borderRadius: '10px', padding: '14px 16px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px' }}>📝 Advisor Notes</div>
              <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{client.advisor_notes}</div>
            </div>
          )}

          {/* Deal history */}
          <div>
            <div style={{ fontSize: '11px', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '10px' }}>
              Deal & Booking History ({client.commercialHistory.length})
            </div>
            {client.commercialHistory.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No deals yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {client.commercialHistory.map(item => {
                  const statusStyle = historyStatusStyle(item.statusLabel)
                  return (
                  <Link key={item.id} href={`/deals/${item.dealId}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'background 0.12s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '2px' }}>{item.name}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {fmtDate(item.date)}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: historyValueColor(item.valueTone), marginBottom: '3px' }}>
                          {item.value !== null ? fmt(item.value) : '—'}
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                          {item.valueLabel}
                        </div>
                        <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '10px', background: statusStyle.background, color: statusStyle.color, fontWeight: '500' }}>
                          {item.statusLabel}
                        </span>
                      </div>
                    </div>
                  </Link>
                )})}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── CLIENT MODAL (NEW / EDIT) ──────────────────────────────
function ClientModal({ client, staffUsers, currentStaff, onClose, onSaved }: {
  client: Client | null
  staffUsers: StaffUser[]
  currentStaff: StaffUser | null
  onClose: () => void
  onSaved: () => void
}) {
  type ClientForm = ReturnType<typeof blankForm>

  const [form, setForm]     = useState<ClientForm>(() => client ? {
    first_name: client.first_name || '',
    last_name: client.last_name || '',
    phone: client.phone || '',
    email: client.email || '',
    date_of_birth: client.date_of_birth || '',
    source: client.source || '',
    budget_min: String(client.budget_min || ''),
    budget_max: String(client.budget_max || ''),
    special_occasions: client.special_occasions || '',
    behaviour_tags: client.behaviour_tags || [],
    advisor_notes: client.advisor_notes || '',
    billing_address_line1: client.billing_address_line1 || '',
    billing_address_line2: client.billing_address_line2 || '',
    billing_city: client.billing_city || '',
    billing_postcode: client.billing_postcode || '',
    billing_country: client.billing_country || 'United Kingdom',
    owner_staff_id: String(client.owner_staff_id || ''),
  } : blankForm())
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [tab, setTab]       = useState<'details' | 'profile' | 'billing'>('details')

  const up = <K extends keyof ClientForm>(field: K, val: ClientForm[K]) => {
    setForm(prev => ({ ...prev, [field]: val }))
  }

  function toggleTag(key: string) {
    setForm(p => ({
      ...p,
      behaviour_tags: p.behaviour_tags.includes(key)
        ? p.behaviour_tags.filter(t => t !== key)
        : [...p.behaviour_tags, key],
    }))
  }

  function setBudgetRange(min: number, max: number) {
    setForm(p => ({ ...p, budget_min: String(min), budget_max: String(max) }))
  }

  async function handleSave() {
    if (!form.first_name.trim()) { setError('First name is required'); return }

    // Guard: if client prop is set but has no valid integer id, it's a corrupted edit state.
    // Treat it as a new client rather than silently hitting PUT /api/clients/undefined.
    const isEdit = client != null && Number.isFinite(Number(client.id))

    setSaving(true); setError('')

    const payload = {
      first_name:           form.first_name.trim(),
      last_name:            form.last_name.trim(),
      phone:                form.phone.trim(),
      email:                form.email.trim(),
      date_of_birth:        form.date_of_birth || null,
      source:               form.source || null,
      budget_min:           form.budget_min ? parseFloat(form.budget_min) : null,
      budget_max:           form.budget_max ? parseFloat(form.budget_max) : null,
      special_occasions:    form.special_occasions || null,
      behaviour_tags:       form.behaviour_tags,
      advisor_notes:        form.advisor_notes || null,
      billing_address_line1: form.billing_address_line1 || null,
      billing_address_line2: form.billing_address_line2 || null,
      billing_city:         form.billing_city || null,
      billing_postcode:     form.billing_postcode || null,
      billing_country:      form.billing_country || 'United Kingdom',
      owner_staff_id: isManager(currentStaff)
        ? (form.owner_staff_id ? Number(form.owner_staff_id) : null)
        : (client?.owner_staff_id ?? currentStaff?.id ?? null),
    }

    try {
      const response = await authedFetch(isEdit ? `/api/clients/${client!.id}` : '/api/clients', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      const result = await response.json()

      if (!result.success) {
        setError(result.message)
        setSaving(false)
        return
      }

      setSaving(false)
      onSaved()
    } catch {
      setError('Failed to save client')
      setSaving(false)
    }
  }

  const TABS = [
    { key: 'details', label: 'Contact & Personal' },
    { key: 'profile', label: 'Sales Profile' },
    { key: 'billing', label: 'Billing Address' },
  ] as const

  return (
    <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal" style={{ maxWidth: '580px' }}>
        <div className="modal-title">{client ? `Edit — ${client.first_name} ${client.last_name}` : 'New Client'}</div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '2px', marginBottom: '20px', background: 'var(--bg-tertiary)', padding: '4px', borderRadius: '10px', width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', fontSize: '12.5px', cursor: 'pointer',
                fontWeight: tab === t.key ? '500' : '400',
                background: tab === t.key ? 'var(--surface)' : 'transparent',
                color: tab === t.key ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: tab === t.key ? 'var(--shadow-sm)' : 'none' }}>
              {t.label}
            </button>
          ))}
        </div>

        {error && <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '10px 14px', borderRadius: '8px', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

        {/* CONTACT TAB */}
        {tab === 'details' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label">First Name *</label>
                <input className="input" placeholder="John" value={form.first_name} onChange={e => up('first_name', e.target.value)} />
              </div>
              <div>
                <label className="label">Last Name</label>
                <input className="input" placeholder="Smith" value={form.last_name} onChange={e => up('last_name', e.target.value)} />
              </div>
              <div>
                <label className="label">Phone / WhatsApp</label>
                <input className="input" placeholder="+44 7700 000000" value={form.phone} onChange={e => up('phone', e.target.value)} />
              </div>
              <div>
                <label className="label">Email</label>
                <input className="input" type="email" placeholder="john@email.com" value={form.email} onChange={e => up('email', e.target.value)} />
              </div>
              <div>
                <label className="label">Date of Birth</label>
                <input className="input" type="date" value={form.date_of_birth} onChange={e => up('date_of_birth', e.target.value)} />
              </div>
              <div>
                <label className="label">Source</label>
                <select className="input" value={form.source} onChange={e => up('source', e.target.value)}>
                  <option value="">Select…</option>
                  {SOURCES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label">Special Occasions</label>
              <input className="input" placeholder="e.g. Anniversary in June, Honeymoon, 50th Birthday" value={form.special_occasions} onChange={e => up('special_occasions', e.target.value)} />
            </div>
            <div>
              <label className="label">Owner</label>
              {isManager(currentStaff) ? (
                <select className="input" value={form.owner_staff_id} onChange={e => up('owner_staff_id', e.target.value)}>
                  <option value="">Unassigned</option>
                  {staffUsers.map(staff => <option key={staff.id} value={staff.id}>{staff.name} · {staff.role || 'staff'}</option>)}
                </select>
              ) : (
                <div className="input" style={{ display:'flex', alignItems:'center', background:'var(--bg-secondary)' }}>
                  {staffUsers.find(staff => staff.id === Number(form.owner_staff_id || currentStaff?.id || 0))?.name || currentStaff?.name || 'Unassigned'}
                </div>
              )}
            </div>
            <div>
              <label className="label">Advisor Notes (internal only)</label>
              <textarea className="input" style={{ minHeight: '80px', resize: 'vertical' }}
                placeholder="Anything useful to know — preferences, history, quirks, family details…"
                value={form.advisor_notes} onChange={e => up('advisor_notes', e.target.value)} />
            </div>
          </div>
        )}

        {/* PROFILE TAB */}
        {tab === 'profile' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Budget */}
            <div>
              <label className="label" style={{ marginBottom: '10px' }}>Budget Range</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {BUDGET_RANGES.map(r => {
                  const active = String(r.min) === form.budget_min && String(r.max) === form.budget_max
                  return (
                    <button key={r.label} onClick={() => active ? setForm(p => ({ ...p, budget_min: '', budget_max: '' })) : setBudgetRange(r.min, r.max)}
                      style={{ padding: '6px 14px', borderRadius: '20px', border: '1.5px solid', fontSize: '12.5px', cursor: 'pointer',
                        borderColor: active ? 'var(--accent)' : 'var(--border)',
                        background: active ? 'var(--accent-light)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-muted)' }}>
                      {r.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Behaviour tags */}
            <div>
              <label className="label" style={{ marginBottom: '10px' }}>Behaviour Tags</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {BEHAVIOUR_TAGS.map(tag => {
                  const active = form.behaviour_tags.includes(tag.key)
                  return (
                    <button key={tag.key} onClick={() => toggleTag(tag.key)}
                      style={{ padding: '10px 16px', borderRadius: '10px', border: '1.5px solid', fontSize: '13px', cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '10px',
                        borderColor: active ? tag.color : 'var(--border)',
                        background: active ? tag.color + '18' : 'var(--bg-tertiary)',
                        color: active ? tag.color : 'var(--text-secondary)' }}>
                      <span style={{ fontSize: '18px' }}>{tag.icon}</span>
                      <span style={{ flex: 1, fontWeight: active ? '500' : '400' }}>{tag.label}</span>
                      {active && <span style={{ fontSize: '12px' }}>✓</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* BILLING TAB */}
        {tab === 'billing' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ padding: '10px 14px', background: 'var(--accent-light)', borderRadius: '8px', fontSize: '12.5px', color: 'var(--accent)' }}>
              💡 Add billing address once the client has confirmed a booking
            </div>
            <div>
              <label className="label">Address Line 1</label>
              <input className="input" placeholder="123 High Street" value={form.billing_address_line1} onChange={e => up('billing_address_line1', e.target.value)} />
            </div>
            <div>
              <label className="label">Address Line 2</label>
              <input className="input" placeholder="Flat 4B" value={form.billing_address_line2} onChange={e => up('billing_address_line2', e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label className="label">City / Town</label>
                <input className="input" placeholder="London" value={form.billing_city} onChange={e => up('billing_city', e.target.value)} />
              </div>
              <div>
                <label className="label">Postcode</label>
                <input className="input" placeholder="SW1A 1AA" value={form.billing_postcode} onChange={e => up('billing_postcode', e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label">Country</label>
              <input className="input" placeholder="United Kingdom" value={form.billing_country} onChange={e => up('billing_country', e.target.value)} />
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : client ? 'Update Client' : 'Create Client'}
          </button>
        </div>
      </div>
    </div>
  )
}
