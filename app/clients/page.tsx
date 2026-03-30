'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ── TYPES ─────────────────────────────────────────────────
type Client = {
  id: number
  first_name: string
  last_name: string
  phone: string
  email: string
  date_of_birth: string | null
  budget_min: number | null
  budget_max: number | null
  special_occasions: string | null
  behaviour_tags: string[]
  advisor_notes: string | null
  source: string | null
  billing_address_line1: string | null
  billing_address_line2: string | null
  billing_city: string | null
  billing_postcode: string | null
  billing_country: string | null
  created_at: string
  deals?: DealSnap[]
}

type DealSnap = {
  id: number
  title: string
  stage: string
  deal_value: number
  departure_date: string | null
  created_at: string
}

type ClientWithStats = Client & {
  dealCount: number
  bookedCount: number
  lifetimeValue: number
  lastDealDate: string | null
}

// ── CONSTANTS ─────────────────────────────────────────────
const BEHAVIOUR_TAGS = [
  { key: 'price-driven',         label: 'Price-driven',        icon: '💰', color: '#ef4444' },
  { key: 'value-seeker',         label: 'Value seeker',        icon: '🔍', color: '#f97316' },
  { key: 'luxury-spender',       label: 'Luxury spender',      icon: '💎', color: '#8b5cf6' },
  { key: 'repeat-client',        label: 'Repeat client',       icon: '🔁', color: '#10b981' },
  { key: 'vip',                  label: 'VIP',                 icon: '⭐', color: '#f59e0b' },
  { key: 'fast-decision',        label: 'Fast decision',       icon: '⚡', color: '#3b82f6' },
  { key: 'slow-to-commit',       label: 'Slow to commit',      icon: '🐢', color: '#6b7280' },
  { key: 'cancellation-history', label: 'Cancellation history',icon: '⚠️', color: '#dc2626' },
  { key: 'prefers-whatsapp',     label: 'Prefers WhatsApp',    icon: '💬', color: '#25d366' },
  { key: 'prefers-phone',        label: 'Prefers phone',       icon: '📞', color: '#1a3a5c' },
]

const SOURCES = ['Referral', 'Website', 'Instagram', 'Facebook', 'Travel Fair', 'Repeat Client', 'Phone Enquiry', 'Email Enquiry', 'Google', 'Other']

const BUDGET_RANGES = [
  { label: 'Under £3,000',   min: 0,     max: 3000  },
  { label: '£3,000–£5,000',  min: 3000,  max: 5000  },
  { label: '£5,000–£8,000',  min: 5000,  max: 8000  },
  { label: '£8,000–£12,000', min: 8000,  max: 12000 },
  { label: '£12,000–£20,000',min: 12000, max: 20000 },
  { label: '£20,000+',       min: 20000, max: 999999 },
]

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: 'New Lead', QUOTE_SENT: 'Quote Sent', ENGAGED: 'Engaged',
  FOLLOW_UP: 'Follow Up', DECISION_PENDING: 'Decision Pending',
  BOOKED: 'Booked', LOST: 'Lost',
}

const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: '#8b5cf6', QUOTE_SENT: '#f59e0b', ENGAGED: '#3b82f6',
  FOLLOW_UP: '#f97316', DECISION_PENDING: '#ec4899',
  BOOKED: '#10b981', LOST: '#ef4444',
}

const AVATAR_COLORS = [
  '#1a3a5c','#534AB7','#0F6E56','#993C1D','#BA7517',
  '#185FA5','#3B6D11','#8b5cf6','#0d9488','#b45309',
]

// ── HELPERS ───────────────────────────────────────────────
function fmt(n: number) {
  return '£' + (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

function initials(c: { first_name: string; last_name: string }) {
  return ((c.first_name?.[0] || '') + (c.last_name?.[0] || '')).toUpperCase()
}

function avatarColor(id: number) {
  return AVATAR_COLORS[id % AVATAR_COLORS.length]
}

function calcAge(dob: string | null) {
  if (!dob) return null
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 86400000))
}

function budgetLabel(min: number | null, max: number | null) {
  if (!min && !max) return null
  const r = BUDGET_RANGES.find(b => b.min === min && b.max === max)
  return r ? r.label : `${fmt(min || 0)} – ${max === 999999 ? '£20,000+' : fmt(max || 0)}`
}

function tagInfo(key: string) {
  return BEHAVIOUR_TAGS.find(t => t.key === key)
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
  const [toast, setToast]             = useState<string | null>(null)
  const [view, setView]               = useState<'grid' | 'list'>('grid')
  const toastTimer                    = useRef<any>(null)

  useEffect(() => { loadClients() }, [])

  async function loadClients() {
    setLoading(true)
    const { data } = await supabase
      .from('clients')
      .select('*, deals(id, title, stage, deal_value, departure_date, created_at)')
      .order('created_at', { ascending: false })

    const enriched: ClientWithStats[] = (data || []).map((c: any) => {
      const deals = c.deals || []
      return {
        ...c,
        behaviour_tags: c.behaviour_tags || [],
        dealCount:     deals.length,
        bookedCount:   deals.filter((d: any) => d.stage === 'BOOKED').length,
        lifetimeValue: deals.filter((d: any) => d.stage === 'BOOKED').reduce((a: number, d: any) => a + (d.deal_value || 0), 0),
        lastDealDate:  deals.length > 0 ? deals.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0].created_at : null,
      }
    })
    setClients(enriched)
    setLoading(false)
  }

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
            {clients.length} clients · {clients.filter(c => c.bookedCount > 0).length} have booked · {fmt(clients.reduce((a, c) => a + c.lifetimeValue, 0))} lifetime value
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input className="input" style={{ width: '240px' }} placeholder="Search name, phone, email…"
            value={search} onChange={e => setSearch(e.target.value)} />
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

        {/* Client grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '16px' }}>
          {filtered.map(client => (
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
                  💷 Budget: <strong style={{ color: 'var(--text-primary)' }}>{budgetLabel(client.budget_min, client.budget_max)}</strong>
                </div>
              )}
              {client.special_occasions && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  🎉 {client.special_occasions}
                </div>
              )}

              {/* Stats */}
              <div style={{ display: 'flex', gap: '0', paddingTop: '12px', borderTop: '1px solid var(--border)', marginTop: '4px' }}>
                {[
                  { label: 'Enquiries', val: client.dealCount },
                  { label: 'Booked', val: client.bookedCount },
                  { label: 'Lifetime', val: client.lifetimeValue > 0 ? fmt(client.lifetimeValue) : '£0' },
                ].map((s, i) => (
                  <div key={s.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '18px', color: i === 2 && client.lifetimeValue > 0 ? 'var(--green)' : 'var(--text-primary)' }}>{s.val}</div>
                    <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Client detail panel */}
      {selectedClient && (
        <ClientDetailPanel
          client={selectedClient}
          onClose={() => setSelectedClient(null)}
          onEdit={() => { setEditClient(selectedClient); setShowModal(true); setSelectedClient(null) }}
          onRefresh={() => { loadClients(); setSelectedClient(null) }}
          showToast={showToast}
        />
      )}

      {/* New / Edit modal */}
      {showModal && (
        <ClientModal
          client={editClient}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadClients(); showToast(editClient ? 'Client updated ✓' : 'Client created ✓') }}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ── CLIENT DETAIL PANEL ────────────────────────────────────
function ClientDetailPanel({ client, onClose, onEdit, onRefresh, showToast }: {
  client: ClientWithStats
  onClose: () => void
  onEdit: () => void
  onRefresh: () => void
  showToast: (msg: string) => void
}) {
  const deals  = (client.deals || []) as DealSnap[]
  const clientAge = calcAge(client.date_of_birth)

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

          {/* Lifetime stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '20px' }}>
            {[
              { label: 'Enquiries', val: client.dealCount, color: 'var(--accent-mid)' },
              { label: 'Bookings', val: client.bookedCount, color: 'var(--green)' },
              { label: 'Lifetime Value', val: fmt(client.lifetimeValue), color: 'var(--gold)' },
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
              Deal History ({deals.length})
            </div>
            {deals.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>No deals yet</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {deals.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(deal => (
                  <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '12px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      transition: 'background 0.12s', cursor: 'pointer' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-light)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}>
                      <div>
                        <div style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '2px' }}>{deal.title}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                          {deal.departure_date ? new Date(deal.departure_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'No date'}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--green)', marginBottom: '3px' }}>{fmt(deal.deal_value || 0)}</div>
                        <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '10px', background: (STAGE_COLORS[deal.stage] || '#888') + '22', color: STAGE_COLORS[deal.stage] || '#888', fontWeight: '500' }}>
                          {STAGE_LABELS[deal.stage] || deal.stage}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}

// ── CLIENT MODAL (NEW / EDIT) ──────────────────────────────
function ClientModal({ client, onClose, onSaved }: {
  client: Client | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm]     = useState(() => client ? {
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
  } : blankForm())
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const [tab, setTab]       = useState<'details' | 'profile' | 'billing'>('details')

  const up = (field: string, val: any) => setForm(p => ({ ...p, [field]: val }))

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
    }

    const { error: err } = client
      ? await supabase.from('clients').update(payload).eq('id', client.id)
      : await supabase.from('clients').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
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
