'use client'

import { useEffect, useState, useRef } from 'react'
import { getAccessContext, isManager, type StaffUser } from '@/lib/access'
import { markLost as markLostService } from '@/lib/modules/deals/deal.service'
import { LOST_REASONS } from '@/lib/modules/lost/constants'
import type { Deal } from '@/lib/supabase'
import Link from 'next/link'
import { authedFetch } from '@/lib/api-client'

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

const TEMP_COLORS = { hot: '#ef4444', warm: '#f59e0b', cold: '#60a5fa', frozen: '#94a3b8' }
const TEMP_LABELS = { hot: 'Hot', warm: 'Warm', cold: 'Cold', frozen: 'Frozen' }
const ACT_DISPLAY: Record<string, string> = {
  CALL: 'Call', EMAIL: 'Email', WHATSAPP: 'WhatsApp',
  NOTE: 'Note', MEETING: 'Meeting', FOLLOW_UP: 'Follow-up',
}

function fmt(n: number) {
  return '£' + (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

function formatShortDate(date: string) {
  return new Date(date + 'T12:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}


type DealWithClient = Deal & {
  staff_id?: number | null
  clients?: { first_name: string; last_name: string; owner_staff_id?: number | null }
  activities?: { created_at: string }[]
  quotes?: { id: number; quote_ref?: string; sent_to_client?: boolean }[]
}

type ClientResult = {
  id: number
  first_name: string
  last_name: string
  phone: string
  email: string
  owner_staff_id: number | null
}

type DealSignals = {
  daysUntilDeparture: number | null
  isOverdue: boolean
  overdueBy: number
  daysUntilActivity: number | null
  temp: 'hot' | 'warm' | 'cold' | 'frozen'
  valueTier: null | 'whale' | 'high'
}

function calculateDealSignals(deal: Deal, renderTime: number = Date.now()): DealSignals {
  let daysUntilDeparture: number | null = null
  if (deal.departure_date) {
    daysUntilDeparture = Math.ceil(
      (new Date(deal.departure_date + 'T12:00').getTime() - renderTime) / 86400000
    )
  }

  let isOverdue = false
  let overdueBy = 0
  let daysUntilActivity: number | null = null
  if (deal.next_activity_at) {
    const diff = (new Date(deal.next_activity_at).getTime() - renderTime) / 86400000
    if (diff < 0) {
      isOverdue = true
      overdueBy = Math.floor(Math.abs(diff))
    } else {
      daysUntilActivity = Math.ceil(diff)
    }
  }

  let temp: 'hot' | 'warm' | 'cold' | 'frozen'
  if (overdueBy >= 7) temp = 'frozen'
  else if (overdueBy >= 3 || !deal.next_activity_at) temp = 'cold'
  else if (
    (daysUntilDeparture !== null && daysUntilDeparture <= 45) ||
    (isOverdue && overdueBy <= 2) ||
    (daysUntilActivity !== null && daysUntilActivity <= 1)
  ) temp = 'hot'
  else if (
    (daysUntilDeparture !== null && daysUntilDeparture <= 120) ||
    (daysUntilActivity !== null && daysUntilActivity <= 7)
  ) temp = 'warm'
  else temp = 'cold'

  let valueTier: null | 'whale' | 'high' = null
  if ((deal.deal_value || 0) >= 8000) valueTier = 'whale'
  else if ((deal.deal_value || 0) >= 4000) valueTier = 'high'

  return { daysUntilDeparture, isOverdue, overdueBy, daysUntilActivity, temp, valueTier }
}

function resolveConsultantId(deal: DealWithClient) {
  return deal.staff_id ?? deal.clients?.owner_staff_id ?? null
}

function getPipelineSortBucket(sig: DealSignals) {
  if (sig.isOverdue && sig.temp === 'frozen') return 0
  if (sig.isOverdue) return 1
  if (sig.daysUntilActivity === 0) return 2
  return 3
}

function compareStageDeals(a: DealWithClient, b: DealWithClient, renderTime: number) {
  const sigA = calculateDealSignals(a, renderTime)
  const sigB = calculateDealSignals(b, renderTime)
  const bucketDelta = getPipelineSortBucket(sigA) - getPipelineSortBucket(sigB)
  if (bucketDelta !== 0) return bucketDelta

  if (sigA.isOverdue && sigB.isOverdue && sigA.overdueBy !== sigB.overdueBy) {
    return sigB.overdueBy - sigA.overdueBy
  }

  const departureA = sigA.daysUntilDeparture ?? Number.MAX_SAFE_INTEGER
  const departureB = sigB.daysUntilDeparture ?? Number.MAX_SAFE_INTEGER
  if (departureA !== departureB) return departureA - departureB

  const valueDelta = (b.deal_value || 0) - (a.deal_value || 0)
  if (valueDelta !== 0) return valueDelta

  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
}

function getCardTone(sig: DealSignals) {
  const isHighValue = sig.valueTier === 'whale' || sig.valueTier === 'high'
  const isCombinedRisk = isHighValue && sig.isOverdue

  if (isCombinedRisk) {
    return {
      background: 'linear-gradient(180deg, #fffaf4 0%, #fffefb 100%)',
      borderColor: '#d6b98b',
      shadow: '0 0 0 1px rgba(180, 131, 58, 0.18), 0 10px 26px rgba(71, 52, 24, 0.08)',
      accent: '#8b6a32',
    }
  }

  if (sig.isOverdue || sig.temp === 'frozen') {
    return {
      background: 'linear-gradient(180deg, #fff8f6 0%, #fffdfc 100%)',
      borderColor: '#e9c5bb',
      shadow: '0 0 0 1px rgba(184, 111, 88, 0.14), 0 8px 22px rgba(92, 58, 47, 0.06)',
      accent: '#a45e46',
    }
  }

  if (sig.temp === 'hot' || sig.daysUntilActivity === 0) {
    return {
      background: 'linear-gradient(180deg, #fffaf2 0%, #fffefd 100%)',
      borderColor: '#ecd8b2',
      shadow: '0 0 0 1px rgba(184, 144, 68, 0.10), 0 7px 18px rgba(94, 78, 42, 0.05)',
      accent: '#a06c1f',
    }
  }

  if (sig.temp === 'cold') {
    return {
      background: 'linear-gradient(180deg, #fbfcfe 0%, #ffffff 100%)',
      borderColor: '#dbe4ef',
      shadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
      accent: '#7a8da3',
    }
  }

  return {
    background: 'var(--surface)',
    borderColor: 'var(--border)',
    shadow: '0 1px 2px rgba(15, 23, 42, 0.05)',
    accent: '#8b98aa',
  }
}

export default function PipelinePage() {
  const [deals, setDeals]           = useState<DealWithClient[]>([])
  const [staffUsers, setStaffUsers] = useState<StaffUser[]>([])
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(null)
  const [accessLoaded, setAccessLoaded] = useState(false)
  const [loading, setLoading]       = useState(true)
  const [draggingId, setDraggingId] = useState<number | null>(null)
  const [dragOverStage, setDragOverStage] = useState<string | null>(null)
  const [toast, setToast]           = useState<string | null>(null)
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [newDealStage, setNewDealStage] = useState('NEW_LEAD')
  const [search, setSearch]         = useState('')
  const [view, setView]             = useState<'kanban' | 'list'>('kanban')
  const [sort, setSort]             = useState<'created' | 'value' | 'departure'>('created')
  const [consultantFilter, setConsultantFilter] = useState<string>('all')
  const [lostDeal, setLostDeal]     = useState<DealWithClient | null>(null)
  const [lostStructuredReason, setLostStructuredReason] = useState('')
  const [lostDetail, setLostDetail] = useState('')
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [renderNow] = useState(() => Date.now())

  async function loadDeals() {
    setLoading(true)
    try {
      const response = await authedFetch('/api/pipeline')
      if (response.ok) {
        const data = await response.json()
        setDeals(data || [])
      }
    } catch {
      // network error — deals stay as-is
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDeals()
      void loadAccess()
    }, 0)
    const onFocus = () => { void loadDeals() }
    const onVisibility = () => { if (!document.hidden) void loadDeals() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  async function loadAccess() {
    try {
      const access = await getAccessContext()
      setStaffUsers(access.staffUsers)
      setCurrentStaff(access.currentStaff)
      if (access.currentStaff && !isManager(access.currentStaff)) {
        setConsultantFilter(String(access.currentStaff.id))
      }
    } finally {
      setAccessLoaded(true)
    }
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
    
    const stageLabel = STAGES.find(s => s.key === newStage)?.label || newStage
    
    try {
      const response = await authedFetch('/api/pipeline/move', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, newStage, stageLabel }),
      })

      const result = await response.json()

      if (!result.success) {
        setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: deal.stage } : d))
        showToast('Failed to update deal')
      } else {
        showToast(`Moved to ${stageLabel}`)
      }
    } catch {
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stage: deal.stage } : d))
      showToast('Failed to update deal')
    }
  }

  async function snoozeDeal(dealId: number, days: number) {
    try {
      const response = await authedFetch('/api/pipeline/snooze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, days }),
      })

      const result = await response.json()

      if (!result.success) {
        showToast('Failed to snooze deal')
        return
      }

      const at = new Date()
      at.setDate(at.getDate() + days)
      const iso = at.toISOString()
      
      setDeals(prev => prev.map(d => d.id === dealId ? { ...d, next_activity_at: iso } : d))
      showToast(`Snoozed ${days} day${days > 1 ? 's' : ''}`)
    } catch {
      showToast('Failed to snooze deal')
    }
  }

  async function markLost() {
    if (!lostDeal || !lostStructuredReason) return
    try {
      await markLostService(lostDeal.id, lostStructuredReason, lostDetail)
      setDeals(prev => prev.filter(deal => deal.id !== lostDeal.id))
      setLostDeal(null)
      setLostStructuredReason('')
      setLostDetail('')
      showToast('Deal marked as lost')
      void loadDeals()
    } catch {
      showToast('Failed to mark deal as lost')
    }
  }

  const consultantScoped = deals.filter(deal => {
    if (!currentStaff) return true
    if (isManager(currentStaff)) {
      if (consultantFilter === 'all') return true
      return String(resolveConsultantId(deal) ?? '') === consultantFilter
    }
    return String(resolveConsultantId(deal) ?? '') === String(currentStaff.id)
  })

  const filtered = search
    ? consultantScoped.filter(d =>
        d.title?.toLowerCase().includes(search.toLowerCase()) ||
        d.clients?.first_name?.toLowerCase().includes(search.toLowerCase()) ||
        d.clients?.last_name?.toLowerCase().includes(search.toLowerCase())
      )
    : consultantScoped

  const totalPipeline = filtered.reduce((a, d) => a + (d.deal_value || 0), 0)

  const sortedFiltered = view === 'list' ? [...filtered].sort((a, b) => {
    if (sort === 'value') return (b.deal_value || 0) - (a.deal_value || 0)
    if (sort === 'departure') {
      if (!a.departure_date && !b.departure_date) return 0
      if (!a.departure_date) return 1
      if (!b.departure_date) return -1
      return new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime()
    }
    return 0
  }) : filtered

  if (loading || !accessLoaded) {
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
            {filtered.length} deals · {fmt(totalPipeline)} total
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input className="input" style={{ width: '220px' }} placeholder="Search deals…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select
            className="input"
            style={{ width: isManager(currentStaff) ? '170px' : '150px' }}
            value={isManager(currentStaff) ? consultantFilter : String(currentStaff?.id ?? '')}
            onChange={e => setConsultantFilter(e.target.value)}
            disabled={!isManager(currentStaff)}
          >
            {isManager(currentStaff) && <option value="all">All consultants</option>}
            {staffUsers.map(staff => (
              <option key={staff.id} value={String(staff.id)}>
                {staff.name}
              </option>
            ))}
          </select>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', padding: '3px', gap: '2px' }}>
            {(['kanban', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontSize: '12px', fontFamily: 'Outfit, sans-serif', fontWeight: '500',
                background: view === v ? 'var(--surface)' : 'transparent',
                color: view === v ? 'var(--text-primary)' : 'var(--text-muted)',
                boxShadow: view === v ? 'var(--shadow-sm)' : 'none',
                transition: 'all 0.15s',
              }}>
                {v === 'kanban' ? '⊞ Board' : '≡ List'}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => { setNewDealStage('NEW_LEAD'); setShowNewDeal(true) }}>
            + New Deal
          </button>
        </div>
      </div>

      {/* Stage funnel / distribution */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ display: 'flex', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', overflow: 'hidden' }}>
          {STAGES.map((stage, i) => {
            const count = filtered.filter(d => d.stage === stage.key).length
            const pct   = filtered.length > 0 ? Math.round(count / filtered.length * 100) : 0
            return (
              <div key={stage.key} style={{ flex: 1, padding: '12px 14px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none', position: 'relative', paddingBottom: '16px' }}>
                <div style={{ fontSize: '9.5px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: stage.color, marginBottom: '5px', fontFamily: 'Outfit, sans-serif' }}>{stage.label}</div>
                <div style={{ fontFamily: 'Fraunces, serif', fontSize: '22px', fontWeight: '300', color: 'var(--text-primary)', lineHeight: 1 }}>{count}</div>
                <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '3px', fontFamily: 'Outfit, sans-serif' }}>{pct}% of pipeline</div>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '3px', background: 'var(--border)' }}>
                  <div style={{ height: '100%', width: `${pct * 2}%`, maxWidth: '100%', background: stage.color, opacity: 0.5 }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Kanban board */}
      {view === 'kanban' && <div style={{ padding: '0 24px 20px', overflowX: 'auto' }}>
        <div className="kanban-board">
          {STAGES.map(stage => {
            const stageDeals   = [...filtered.filter(d => d.stage === stage.key)].sort((a, b) => compareStageDeals(a, b, renderNow))
            const stageVal     = stageDeals.reduce((a, d) => a + (d.deal_value || 0), 0)
            const isDragOver   = dragOverStage === stage.key

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
                    const client = deal.clients
                    const sig    = calculateDealSignals(deal, renderNow)
                    const hasQuotes = (deal.quotes || []).length > 0
                    const quoteSent = (deal.quotes || []).some(q => !!q.sent_to_client)
                    const isHighValue = sig.valueTier === 'whale' || sig.valueTier === 'high'
                    const isEscalated = sig.isOverdue && isHighValue
                    const cardTone = getCardTone(sig)
                    const refs = [...new Set((deal.quotes || []).map(q => q.quote_ref).filter(Boolean))]
                    const actionText = deal.next_activity_note?.trim() || 'No action note'
                    const displayTags: string[] = []
                    if (deal.source) displayTags.push(deal.source)
                    if (deal.departure_date) displayTags.push(`Departs ${formatShortDate(deal.departure_date)}`)
                    const urgencyTone = sig.isOverdue
                      ? { color: '#dc2626', background: '#fee2e2', border: '#fecaca' }
                      : sig.daysUntilActivity === 0
                      ? { color: '#92400e', background: '#fef3c7', border: '#fcd34d' }
                      : { color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', border: 'var(--border)' }
                    const urgencyText = !deal.next_activity_at
                      ? 'No due date'
                      : sig.isOverdue
                      ? `${Math.max(sig.overdueBy, 0)}d overdue`
                      : sig.daysUntilActivity === 0
                      ? 'Today'
                      : `in ${sig.daysUntilActivity}d`

                    return (
                      <div key={deal.id}
                        className={`deal-card ${draggingId === deal.id ? 'dragging' : ''}`}
                        draggable
                        onDragStart={() => setDraggingId(deal.id)}
                        onDragEnd={() => { setDraggingId(null); setDragOverStage(null) }}
                        style={{
                          background: cardTone.background,
                          borderColor: cardTone.borderColor,
                          boxShadow: cardTone.shadow,
                          borderLeft: `3px solid ${cardTone.accent}`,
                        }}>

                        <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: '12px', fontWeight: '600', color: sig.temp === 'cold' ? 'var(--text-secondary)' : 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', lineHeight: '1.3', marginBottom: '5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {client ? `${client.first_name} ${client.last_name}` : deal.title}
                              </div>
                              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '16px', fontWeight: isEscalated ? '500' : '400', color: 'var(--text-primary)', lineHeight: '1.28', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {deal.title}
                              </div>
                            </div>
                            <div style={{ flexShrink: 0, textAlign: 'right' }}>
                              <div style={{ fontFamily: 'Outfit, sans-serif', fontSize: isHighValue ? '18px' : '17px', fontWeight: isHighValue ? '800' : '700', letterSpacing: '-0.03em', color: deal.deal_value > 0 ? (isEscalated ? '#7c5b25' : isHighValue ? '#74511f' : 'var(--text-primary)') : 'var(--text-muted)' }}>
                                {deal.deal_value > 0 ? fmt(deal.deal_value) : '—'}
                              </div>
                              {sig.valueTier && (
                                <div style={{
                                  marginTop: '4px',
                                  fontSize: '9px',
                                  fontWeight: '700',
                                  textTransform: 'uppercase',
                                  letterSpacing: '0.06em',
                                  color: sig.valueTier === 'whale' ? '#8b6a32' : '#7c6b3d',
                                }}>
                                  {sig.valueTier === 'whale' ? 'Whale' : 'High Value'}
                                </div>
                              )}
                            </div>
                          </div>

                          <div style={{ fontSize: '13px', fontWeight: '600', color: sig.temp === 'cold' ? 'var(--text-secondary)' : 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', lineHeight: '1.45', marginBottom: '12px' }}>
                            {actionText}
                          </div>

                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '10px', fontSize: '11px', fontWeight: '600', color: urgencyTone.color, background: urgencyTone.background, border: `1px solid ${urgencyTone.border}`, borderRadius: '999px', padding: '4px 9px', fontFamily: 'Outfit, sans-serif' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: urgencyTone.color, display: 'inline-block', flexShrink: 0 }} />
                            {urgencyText}
                          </div>

                          {(hasQuotes || refs.length > 0) && (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', marginBottom: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                {hasQuotes && (
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    fontSize: '10px',
                                    fontWeight: '600',
                                    color: quoteSent ? '#0f766e' : '#8a5a18',
                                    background: quoteSent ? '#edfdfa' : '#fff8e8',
                                    border: `1px solid ${quoteSent ? '#99f6e4' : '#ead5a0'}`,
                                    padding: '3px 8px',
                                    borderRadius: '999px',
                                    fontFamily: 'Outfit, sans-serif',
                                  }}>
                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: quoteSent ? '#0f766e' : '#b7791f', display: 'inline-block', flexShrink: 0 }} />
                                    {quoteSent ? 'Sent' : 'Drafted'}
                                  </span>
                                )}
                              </div>
                              {refs.length > 0 && (
                                <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)', textAlign: 'right', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {refs[0]}{refs.length > 1 ? ` +${refs.length - 1}` : ''}
                                </div>
                              )}
                            </div>
                          )}

                          {displayTags.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap', marginBottom: '12px' }}>
                            {displayTags.map(tag => (
                              <span key={tag} style={{ fontSize: '8.5px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', background: 'var(--bg-tertiary)', padding: '2px 7px', borderRadius: '8px', border: '1px solid var(--border)', fontFamily: 'Outfit, sans-serif' }}>
                                {tag}
                              </span>
                            ))}
                            </div>
                          )}
                        </Link>

                        {/* Controls: stage movement + snooze (de-emphasised) */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexWrap: 'wrap' }}>
                          {STAGES.filter(s => s.key !== deal.stage).slice(0, 2).map(s => (
                            <button key={s.key}
                              onClick={e => { e.stopPropagation(); moveDeal(deal.id, s.key) }}
                              style={{ fontSize: '9.5px', padding: '2px 7px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', transition: 'all 0.12s', fontFamily: 'Outfit, sans-serif' }}
                              onMouseEnter={e => { e.currentTarget.style.background = s.color+'20'; e.currentTarget.style.color = s.color; e.currentTarget.style.borderColor = s.color+'60' }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)' }}>
                              → {s.label}
                            </button>
                          ))}
                          <span style={{ flex: 1 }} />
                          {[1, 3, 7].map(d => (
                            <button key={d}
                              onClick={e => { e.stopPropagation(); snoozeDeal(deal.id, d) }}
                              style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.1s', opacity: '0.7' }}
                              onMouseEnter={e => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.background = 'var(--bg-tertiary)' }}
                              onMouseLeave={e => { e.currentTarget.style.opacity = '0.7'; e.currentTarget.style.background = 'transparent' }}>
                              {d}d
                            </button>
                          ))}
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              setLostDeal(deal)
                              setLostStructuredReason('')
                              setLostDetail('')
                            }}
                            style={{ fontSize: '9px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #fecaca', background: '#fff1f2', color: '#b91c1c', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.1s' }}
                          >
                            Mark Lost
                          </button>
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
      </div>}

      {/* List view */}
      {view === 'list' && (
        <div style={{ padding: '0 24px 24px' }}>
          {/* Sort bar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif' }}>Sort by:</span>
            {([['created','Newest'],['value','Value ↓'],['departure','Departure']] as const).map(([key, label]) => (
              <button key={key} onClick={() => setSort(key)} style={{
                fontSize: '11.5px', padding: '3px 11px', borderRadius: '6px', border: '1px solid', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', transition: 'all 0.12s',
                borderColor: sort === key ? 'var(--accent)' : 'var(--border)',
                background:  sort === key ? 'var(--accent-light)' : 'transparent',
                color:       sort === key ? 'var(--accent)' : 'var(--text-muted)',
              }}>{label}</button>
            ))}
          </div>
          {/* Header row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '80px 145px 1fr 140px 110px 150px 150px',
            gap: '12px', padding: '0 16px 8px',
            borderBottom: '2px solid var(--border)',
          }}>
            {['Signal', 'Client', 'Deal', 'Stage', 'Value', 'Departure', 'Next Action'].map(h => (
              <div key={h} style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif' }}>{h}</div>
            ))}
          </div>

          {filtered.length === 0 && (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>No deals match your search.</div>
          )}

          {sortedFiltered.map(deal => {
            const client    = deal.clients
            const sig       = calculateDealSignals(deal, renderNow)
            const tc        = TEMP_COLORS[sig.temp]
            const stageInfo = STAGES.find(s => s.key === deal.stage)

            return (
              <div key={deal.id} style={{
                display: 'grid',
                gridTemplateColumns: '80px 145px 1fr 140px 110px 150px 150px',
                gap: '12px', padding: '11px 16px',
                borderLeft: `3px solid ${tc}`,
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                borderRadius: '0',
                alignItems: 'center',
                transition: 'background 0.1s',
                marginBottom: '2px',
                borderTopRightRadius: '8px', borderBottomRightRadius: '8px',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--surface)')}
              >

                {/* Temperature pill */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px',
                  background: tc + '15', border: `1px solid ${tc}40`,
                  borderRadius: '20px', padding: '3px 8px', width: 'fit-content' }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: tc, display: 'inline-block', flexShrink: 0 }} />
                  <span style={{ fontSize: '9.5px', fontWeight: '700', color: tc, textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: 'Outfit, sans-serif' }}>
                    {TEMP_LABELS[sig.temp]}
                  </span>
                </div>

                {/* Client */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', minWidth: 0 }}>
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                    background: (stageInfo?.color ?? '#888') + '18', border: `1.5px solid ${stageInfo?.color ?? '#888'}50`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', fontWeight: '700', color: stageInfo?.color ?? 'var(--text-muted)',
                    fontFamily: 'Outfit, sans-serif',
                  }}>
                    {client ? `${client.first_name[0]}${client.last_name?.[0] ?? ''}` : '?'}
                  </div>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {client ? `${client.first_name} ${client.last_name}` : '—'}
                  </span>
                </div>

                {/* Deal title */}
                <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none', minWidth: 0 }}>
                  <div style={{ fontFamily: 'Fraunces, serif', fontSize: '13.5px', fontWeight: '300', color: 'var(--text-primary)', letterSpacing: '-0.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {deal.title}
                  </div>
                  {deal.source && (
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif', marginTop: '1px' }}>{deal.source}</div>
                  )}
                  {(() => {
                    const refs = [...new Set((deal.quotes || []).map(q => q.quote_ref).filter(Boolean))]
                    return refs.length > 0 ? (
                      <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '1px' }}>
                        {refs[0]}{refs.length > 1 ? ` +${refs.length - 1}` : ''}
                      </div>
                    ) : null
                  })()}
                </Link>

                {/* Stage — select for quick move */}
                <select value={deal.stage} onChange={e => moveDeal(deal.id, e.target.value)}
                  style={{
                    fontSize: '11px', fontWeight: '600', padding: '4px 8px', borderRadius: '6px',
                    border: `1.5px solid ${stageInfo?.color ?? 'var(--border)'}55`,
                    background: (stageInfo?.color ?? '#888') + '15',
                    color: stageInfo?.color ?? 'var(--text-primary)',
                    cursor: 'pointer', fontFamily: 'Outfit, sans-serif',
                    outline: 'none', width: '100%',
                  }}>
                  {STAGES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                </select>

                {/* Value */}
                <div>
                  {deal.deal_value > 0 ? (
                    <>
                      <div style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', letterSpacing: '-0.02em' }}>
                        {fmt(deal.deal_value)}
                      </div>
                      {sig.valueTier === 'whale' && (
                        <div style={{ fontSize: '9px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--gold)', fontFamily: 'Outfit, sans-serif', marginTop: '1px' }}>◈ High Value</div>
                      )}
                      {sig.valueTier === 'high' && (
                        <div style={{ fontSize: '9px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--green)', fontFamily: 'Outfit, sans-serif', marginTop: '1px' }}>◆ Strong</div>
                      )}
                    </>
                  ) : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>}
                </div>

                {/* Departure */}
                <div style={{ fontSize: '11.5px', fontFamily: 'Outfit, sans-serif',
                  fontWeight: sig.daysUntilDeparture !== null && sig.daysUntilDeparture > 0 && sig.daysUntilDeparture <= 90 ? '600' : '400',
                  color: !sig.daysUntilDeparture || sig.daysUntilDeparture <= 0 ? 'var(--text-muted)'
                    : sig.daysUntilDeparture <= 30 ? 'var(--red)'
                    : sig.daysUntilDeparture <= 90 ? 'var(--amber)'
                    : 'var(--text-muted)',
                }}>
                  {sig.daysUntilDeparture === null ? '—'
                    : sig.daysUntilDeparture <= 0 ? 'Departed'
                    : sig.daysUntilDeparture === 1 ? '✈ Tomorrow'
                    : sig.daysUntilDeparture <= 14 ? `✈ ${sig.daysUntilDeparture}d away`
                    : `✈ ${new Date(deal.departure_date + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                </div>

                {/* Activity */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                  {sig.isOverdue ? (
                    <>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: sig.overdueBy >= 5 ? 'var(--red)' : 'var(--amber)', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '11.5px', fontWeight: '600', fontFamily: 'Outfit, sans-serif', color: sig.overdueBy >= 5 ? 'var(--red)' : 'var(--amber)' }}>
                        {deal.next_activity_type ? (ACT_DISPLAY[deal.next_activity_type] ?? deal.next_activity_type) + ' · ' : ''}
                        {sig.overdueBy === 0 ? 'due today' : `${sig.overdueBy}d overdue`}
                      </span>
                    </>
                  ) : deal.next_activity_at ? (
                    <>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--text-muted)', display: 'inline-block', flexShrink: 0, opacity: 0.5 }} />
                      <span style={{ fontSize: '11.5px', color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif' }}>
                        {deal.next_activity_type ? (ACT_DISPLAY[deal.next_activity_type] ?? deal.next_activity_type) + ' · ' : ''}
                        {sig.daysUntilActivity === 0 ? 'today'
                          : sig.daysUntilActivity === 1 ? 'tomorrow'
                          : new Date(deal.next_activity_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </span>
                    </>
                  ) : (
                    <>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--border-strong)', display: 'inline-block', flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', fontFamily: 'Outfit, sans-serif' }}>None scheduled</span>
                    </>
                  )}
                </div>

              </div>
            )
          })}
        </div>
      )}

      {showNewDeal && (
        <NewDealModal
          defaultStage={newDealStage}
          onClose={() => setShowNewDeal(false)}
          onSaved={() => { setShowNewDeal(false); loadDeals(); showToast('Deal created!') }}
        />
      )}

      {lostDeal && (
        <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) setLostDeal(null) }}>
          <div className="modal" style={{ maxWidth: '440px' }}>
            <div className="modal-title">Mark Deal as Lost</div>
            <div style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Select a reason for <strong style={{ color: 'var(--text-primary)' }}>{lostDeal.title}</strong> — this uses the existing structured lost workflow.
            </div>
            <label className="label">Reason <span style={{ color: 'var(--red)' }}>*</span></label>
            <select className="input" style={{ marginBottom: '14px' }} value={lostStructuredReason} onChange={e => setLostStructuredReason(e.target.value)}>
              <option value="">— select reason —</option>
              {LOST_REASONS.map(reason => (
                <option key={reason.key} value={reason.key}>{reason.label}</option>
              ))}
            </select>
            <label className="label">Detail <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <textarea
              className="input"
              style={{ minHeight: '70px', resize: 'vertical', marginBottom: '16px' }}
              placeholder="Any extra context…"
              value={lostDetail}
              onChange={e => setLostDetail(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => { setLostDeal(null); setLostStructuredReason(''); setLostDetail('') }}>Cancel</button>
              <button className="btn btn-danger" onClick={markLost} disabled={!lostStructuredReason}>Mark as Lost</button>
            </div>
          </div>
        </div>
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
  // Qualification
  const [adults, setAdults]             = useState('2')
  const [children, setChildren]         = useState('0')
  const [travelType, setTravelType]     = useState('')
  const [budgetConf, setBudgetConf]     = useState('TBC')

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')
  const searchTimer         = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Search clients as user types
  function handleClientSearch(val: string) {
    setClientSearch(val)
    setSelectedClient(null)
    setShowNewClient(false)
    if (!val.trim()) { setClientResults([]); return }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      const response = await authedFetch(`/api/pipeline/clients?q=${encodeURIComponent(val)}`)
      if (response.ok) {
        const data = await response.json()
        setClientResults(data || [])
      } else {
        setClientResults([])
      }
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
      const response = await authedFetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          selectedClientId: selectedClient?.id ?? null,
          title,
          dealValue,
          departureDate,
          source,
          stage,
          adults,
          children,
          travelType,
          budgetConf,
          newFirst,
          newLast,
          newEmail,
          newPhone,
        }),
      })

      if (!response.ok) {
        const result = await response.json().catch(() => null)
        setError(result?.error || 'Failed to create deal')
        setSaving(false)
        return
      }

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
                    + Create new client &quot;{clientSearch}&quot;
                  </div>
                </div>
              )}

              {/* No results — show create option */}
              {clientSearch.length >= 2 && clientResults.length === 0 && !searching && (
                <div style={{ marginTop: '6px' }}>
                  <button className="btn btn-secondary btn-sm" onClick={chooseNewClient}>
                    + Create new client &quot;{clientSearch}&quot;
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

        {/* Lead qualification */}
        <div style={{ marginTop: '16px', padding: '14px', background: 'var(--bg-tertiary)', borderRadius: '10px', border: '1px solid var(--border)' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--text-muted)', marginBottom: '12px', fontFamily: 'Outfit, sans-serif' }}>
            Lead Qualification
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label className="label">Adults</label>
              <input className="input" type="number" min="1" max="20" value={adults} onChange={e => setAdults(e.target.value)} />
            </div>
            <div>
              <label className="label">Children</label>
              <input className="input" type="number" min="0" max="10" value={children} onChange={e => setChildren(e.target.value)} />
            </div>
            <div>
              <label className="label">Travel Type</label>
              <select className="input" value={travelType} onChange={e => setTravelType(e.target.value)}>
                <option value="">Unknown</option>
                {['Beach Escape','Honeymoon','Anniversary','Family','Group','Luxury','Other'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Budget</label>
              <select className="input" value={budgetConf} onChange={e => setBudgetConf(e.target.value)}>
                <option>TBC</option>
                <option>Confirmed</option>
                <option>Approx</option>
              </select>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Create Deal'}
          </button>
        </div>
      </div>
    </div>
  )
}
