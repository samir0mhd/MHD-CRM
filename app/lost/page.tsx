'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { LOST_REASONS, getLostReasonLabel } from '@/lib/modules/lost/constants'

type LostDeal = {
  id: number
  title: string
  stage: string
  deal_value: number | null
  departure_date: string | null
  next_activity_at: string | null
  next_activity_type: string | null
  next_activity_note: string | null
  lost_reason: string | null
  lost_structured_reason: string | null
  lost_at: string | null
  source: string | null
  created_at: string
  clients?: { first_name: string; last_name: string }
  quotes?: { id: number; quote_ref: string | null; price: number | null }[]
}

function fmt(n: number) {
  return '£' + (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

export default function LostDealsPage() {
  const [deals, setDeals]     = useState<LostDeal[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [toast, setToast]     = useState<string | null>(null)
  const [reopening, setReopening] = useState<number | null>(null)
  const [renderTime] = useState(() => Date.now())
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function loadDeals() {
    setLoading(true)
    const response = await fetch('/api/lost')
    if (response.ok) {
      const data = await response.json()
      setDeals(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => { void loadDeals() }, 0)
    return () => clearTimeout(timeoutId)
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  async function reopen(deal: LostDeal) {
    setReopening(deal.id)
    const response = await fetch(`/api/lost/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reopen' }),
    })
    if (response.ok) {
      showToast(`Reopened: ${deal.title}`)
      loadDeals()
    }
    setReopening(null)
  }

  async function scheduleWinback(deal: LostDeal, days: number) {
    const response = await fetch(`/api/lost/${deal.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'schedule_winback',
        days,
        structured_reason: deal.lost_structured_reason,
      }),
    })
    if (response.ok) showToast(`Win-back scheduled in ${days} days`)
    loadDeals()
  }

  const filtered = deals.filter(d => {
    const q = search.toLowerCase()
    return !q
      || d.title?.toLowerCase().includes(q)
      || d.clients?.first_name?.toLowerCase().includes(q)
      || d.clients?.last_name?.toLowerCase().includes(q)
      || getLostReasonLabel(d.lost_structured_reason).toLowerCase().includes(q)
      || d.lost_reason?.toLowerCase().includes(q)
  })

  // ── Stats ──────────────────────────────────────────────────
  const totalLostValue = deals.reduce((a, d) => a + (d.deal_value || 0), 0)

  // Group by structured reason key using the fixed LOST_REASONS order
  const reasonCounts: Record<string, number> = {}
  deals.forEach(d => {
    const key = d.lost_structured_reason || 'other'
    reasonCounts[key] = (reasonCounts[key] || 0) + 1
  })
  const structuredBreakdown = LOST_REASONS
    .map(r => ({ key: r.key, label: r.label, count: reasonCounts[r.key] || 0 }))
    .filter(r => r.count > 0)
    .sort((a, b) => b.count - a.count)
  const maxReasonCount = structuredBreakdown[0]?.count || 1

  const winbackScheduled = deals.filter(d => d.next_activity_at && new Date(d.next_activity_at) > new Date()).length
  const topReason = structuredBreakdown[0]

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading lost deals…</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Lost Deals</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {deals.length} lost · {fmt(totalLostValue)} missed revenue · {winbackScheduled} win-backs scheduled
          </div>
        </div>
        <input className="input" style={{ width: '240px' }} placeholder="Search deals, clients, reasons…"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      <div className="page-body">

        {/* ── Stats row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '28px' }}>
          {[
            { label: 'Total Lost',       val: String(deals.length),            sub: 'deals',            color: 'var(--red)'   },
            { label: 'Revenue Missed',   val: fmt(totalLostValue),              sub: 'pipeline value',   color: 'var(--amber)' },
            { label: 'Win-backs Queued', val: String(winbackScheduled),        sub: 'scheduled',        color: 'var(--accent)' },
            { label: 'Top Reason',       val: topReason ? topReason.label : '—', sub: topReason ? `${topReason.count} deals` : '', color: 'var(--text-primary)' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '16px 20px' }}>
              <div style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '6px', fontFamily: 'Outfit, sans-serif' }}>{s.label}</div>
              <div style={{ fontFamily: 'Fraunces, serif', fontSize: '22px', fontWeight: '300', color: s.color, lineHeight: 1 }}>{s.val}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontFamily: 'Outfit, sans-serif' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '20px', alignItems: 'flex-start' }}>

          {/* ── Lost deals list ── */}
          <div>
            {/* Header */}
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 110px 110px 150px 130px',
              gap: '12px', padding: '0 16px 8px',
              borderBottom: '2px solid var(--border)',
              marginBottom: '4px',
            }}>
              {['Deal', 'Value', 'Date Lost', 'Reason', 'Actions'].map(h => (
                <div key={h} style={{ fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif' }}>{h}</div>
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '14px' }}>
                {search ? 'No deals match your search.' : 'No lost deals — great work!'}
              </div>
            )}

            {filtered.map(deal => {
              const hasWinback = deal.next_activity_at && new Date(deal.next_activity_at) > new Date()
              const daysUntilWinback = hasWinback
                ? Math.ceil((new Date(deal.next_activity_at!).getTime() - renderTime) / 86400000)
                : null
              const latestQuote = deal.quotes && deal.quotes.length > 0
                ? deal.quotes[deal.quotes.length - 1]
                : null

              return (
                <div key={deal.id} style={{
                  display: 'grid', gridTemplateColumns: '1fr 110px 110px 150px 130px',
                  gap: '12px', padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  background: 'var(--surface)',
                  alignItems: 'center',
                  marginBottom: '2px',
                  borderLeft: '3px solid var(--red)',
                  borderTopRightRadius: '8px', borderBottomRightRadius: '8px',
                  opacity: hasWinback ? 1 : 0.85,
                  transition: 'opacity 0.15s',
                }}>

                  {/* Deal + client + quote ref */}
                  <div style={{ minWidth: 0 }}>
                    <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                      <div style={{ fontFamily: 'Fraunces, serif', fontSize: '13.5px', fontWeight: '300', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>
                        {deal.title}
                      </div>
                    </Link>
                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px', flexWrap: 'wrap' }}>
                      {deal.clients && (
                        <span style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif' }}>
                          {deal.clients.first_name} {deal.clients.last_name}
                          {deal.source && <span style={{ marginLeft: '6px', opacity: 0.7 }}>· {deal.source}</span>}
                        </span>
                      )}
                      {latestQuote?.quote_ref && (
                        <span style={{ fontSize: '10px', fontWeight: '600', fontFamily: 'Outfit, sans-serif', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', borderRadius: '4px', padding: '1px 5px', letterSpacing: '0.03em' }}>
                          {latestQuote.quote_ref}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Value */}
                  <div style={{ fontSize: '13.5px', fontWeight: '700', fontFamily: 'Outfit, sans-serif', color: deal.deal_value ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {deal.deal_value ? fmt(deal.deal_value) : '—'}
                  </div>

                  {/* Date lost */}
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif' }}>
                    {deal.lost_at
                      ? new Date(deal.lost_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                      : new Date(deal.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    }
                  </div>

                  {/* Lost reason */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '11.5px', color: 'var(--red)', fontFamily: 'Outfit, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {deal.lost_structured_reason
                        ? getLostReasonLabel(deal.lost_structured_reason)
                        : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No reason given</span>
                      }
                    </div>
                    {deal.lost_reason && (
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                        {deal.lost_reason}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {hasWinback ? (
                      <span style={{ fontSize: '10.5px', color: 'var(--accent)', fontWeight: '600', fontFamily: 'Outfit, sans-serif' }}>
                        Win-back in {daysUntilWinback}d
                      </span>
                    ) : (
                      <WinbackMenu deal={deal} onSchedule={scheduleWinback} />
                    )}
                    <button
                      onClick={() => reopen(deal)}
                      disabled={reopening === deal.id}
                      style={{ fontSize: '10.5px', padding: '2px 8px', borderRadius: '5px', border: '1px solid var(--green)', background: 'var(--green-light)', color: 'var(--green)', cursor: 'pointer', fontWeight: '600', fontFamily: 'Outfit, sans-serif' }}>
                      {reopening === deal.id ? '…' : '↩ Reopen'}
                    </button>
                  </div>

                </div>
              )
            })}
          </div>

          {/* ── Lost reasons breakdown ── */}
          <div className="card" style={{ padding: '20px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '16px', fontFamily: 'Outfit, sans-serif' }}>
              Why Deals Were Lost
            </div>

            {structuredBreakdown.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>No data yet.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {structuredBreakdown.map(({ key, label, count }) => (
                  <div key={key}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif', flex: 1, paddingRight: '8px' }}>{label}</span>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif' }}>{count}</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--bg-tertiary)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${(count / maxReasonCount) * 100}%`, background: 'var(--red)', borderRadius: '3px', transition: 'width 0.4s' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {deals.length > 0 && (
              <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '10px', fontFamily: 'Outfit, sans-serif' }}>
                  Lost by Source
                </div>
                {Object.entries(
                  deals.reduce((acc, d) => {
                    const s = d.source || 'Unknown'
                    acc[s] = (acc[s] || 0) + 1
                    return acc
                  }, {} as Record<string, number>)
                ).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([src, count]) => (
                  <div key={src} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontFamily: 'Outfit, sans-serif' }}>{src}</span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', fontFamily: 'Outfit, sans-serif' }}>{count}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ── WIN-BACK DROPDOWN ──────────────────────────────────────
function WinbackMenu({ deal, onSchedule }: { deal: LostDeal; onSchedule: (deal: LostDeal, days: number) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)} style={{
        fontSize: '10.5px', padding: '2px 8px', borderRadius: '5px',
        border: '1px solid var(--accent)', background: 'var(--accent-light)',
        color: 'var(--accent)', cursor: 'pointer', fontWeight: '600', fontFamily: 'Outfit, sans-serif',
      }}>
        ↻ Win-back ▾
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, zIndex: 100, marginTop: '4px',
          background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px',
          boxShadow: 'var(--shadow-md)', overflow: 'hidden', minWidth: '130px',
        }}>
          {[
            { label: 'In 30 days',  days: 30  },
            { label: 'In 60 days',  days: 60  },
            { label: 'In 90 days',  days: 90  },
          ].map(o => (
            <button key={o.days} onClick={() => { onSchedule(deal, o.days); setOpen(false) }}
              style={{ display: 'block', width: '100%', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', fontSize: '12.5px', color: 'var(--text-primary)', fontFamily: 'Outfit, sans-serif' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}>
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
