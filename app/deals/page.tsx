'use client'

import { useEffect, useState } from 'react'
import { fetchDeals, reopenDeal as reopenDealService } from '@/lib/modules/deals/deal.service'
import Link from 'next/link'

type Deal = {
  id: number
  title: string
  stage: string
  deal_value: number
  departure_date: string | null
  source: string | null
  next_activity_at: string | null
  next_activity_type: string | null
  lost_reason: string | null
  created_at: string
  clients?: { first_name: string; last_name: string; phone: string; email: string }
  quotes?: { id: number; price?: number; profit?: number; sent_to_client?: boolean; quote_ref?: string }[]
  bookings?: { id: number; booking_reference: string }[]
}

const STAGE_CONFIG: Record<string, { label: string; color: string }> = {
  NEW_LEAD:         { label: 'New Lead',         color: '#8b5cf6' },
  QUOTE_SENT:       { label: 'Quote Sent',       color: '#f59e0b' },
  ENGAGED:          { label: 'Engaged',          color: '#3b82f6' },
  FOLLOW_UP:        { label: 'Follow Up',        color: '#f97316' },
  DECISION_PENDING: { label: 'Decision Pending', color: '#ec4899' },
  BOOKED:           { label: 'Booked',           color: '#10b981' },
  LOST:             { label: 'Lost',             color: '#ef4444' },
}

const STAGE_FILTERS = [
  { key: 'ALL',              label: 'All'              },
  { key: 'NEW_LEAD',         label: 'New Lead'         },
  { key: 'QUOTE_SENT',       label: 'Quote Sent'       },
  { key: 'ENGAGED',          label: 'Engaged'          },
  { key: 'FOLLOW_UP',        label: 'Follow Up'        },
  { key: 'DECISION_PENDING', label: 'Decision Pending' },
  { key: 'BOOKED',           label: 'Booked'           },
  { key: 'LOST',             label: 'Lost'             },
]

const SOURCES = [
  'All Sources','Website','Referral','Instagram','Facebook',
  'Travel Fair','Repeat Client','Phone Enquiry','Email Enquiry',
  'Google','CPC','SEO','Other',
]

const fmt      = (n: number) => '£' + (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtDate  = (d: string | null) => !d ? '—' : new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const fmtShort = (d: string)        => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: '2-digit' })
const daysSince = (d: string)       => Math.floor((Date.now() - new Date(d).getTime()) / 86400000)

export default function AllDealsPage() {
  const [deals, setDeals]               = useState<Deal[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [stageFilter, setStageFilter]   = useState('ALL')
  const [sourceFilter, setSourceFilter] = useState('All Sources')
  const [activeOnly, setActiveOnly]     = useState(true)
  const [sortBy, setSortBy]             = useState<'created_at' | 'deal_value' | 'departure_date'>('created_at')
  const [sortDir, setSortDir]           = useState<'desc' | 'asc'>('desc')
  const [reopening, setReopening]       = useState<number | null>(null)
  const [toast, setToast]               = useState<string | null>(null)

  async function loadDeals() {
    setLoading(true)
    const data = await fetchDeals()
    setDeals(data || [])
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => { void loadDeals() }, 0)
    return () => clearTimeout(timeoutId)
  }, [])

  async function reopenDeal(deal: Deal) {
    setReopening(deal.id)
    await reopenDealService(deal)
    setToast(`${deal.title} reopened ✓`)
    setTimeout(() => setToast(null), 3000)
    setReopening(null)
    loadDeals()
  }

  function toggleSort(field: typeof sortBy) {
    if (sortBy === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortBy(field); setSortDir('desc') }
  }

  const allActive = deals.filter(d => !['BOOKED','LOST'].includes(d.stage))
  const allBooked = deals.filter(d => d.stage === 'BOOKED')
  const allLost   = deals.filter(d => d.stage === 'LOST')

  const filtered = deals
    .filter(d => {
      if (activeOnly && ['BOOKED','LOST'].includes(d.stage)) return false
      if (stageFilter !== 'ALL' && d.stage !== stageFilter) return false
      if (sourceFilter !== 'All Sources' && d.source !== sourceFilter) return false
      const q = search.toLowerCase()
      if (!q) return true
      return (
        d.title?.toLowerCase().includes(q) ||
        d.clients?.first_name?.toLowerCase().includes(q) ||
        d.clients?.last_name?.toLowerCase().includes(q) ||
        d.clients?.phone?.toLowerCase().includes(q)
      )
    })
    .sort((a, b) => {
      const dir = sortDir === 'desc' ? -1 : 1
      if (sortBy === 'deal_value')     return dir * ((a.deal_value || 0) - (b.deal_value || 0))
      if (sortBy === 'departure_date') {
        if (!a.departure_date) return 1
        if (!b.departure_date) return -1
        return dir * (new Date(a.departure_date).getTime() - new Date(b.departure_date).getTime())
      }
      return dir * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    })

  const pipelineVal   = allActive.reduce((a, d) => a + (d.deal_value || 0), 0)
  const bookedVal     = allBooked.reduce((a, d) => a + (d.deal_value || 0), 0)
  const convRate      = deals.length > 0 ? ((allBooked.length / deals.length) * 100).toFixed(1) : '0'
  const filteredVal   = filtered.reduce((a, d) => a + (d.deal_value || 0), 0)
  const filteredAvg   = filtered.length > 0 ? Math.round(filteredVal / filtered.length) : 0

  // Lost reasons breakdown
  const lostReasonMap: Record<string, number> = {}
  allLost.forEach(d => {
    const r = d.lost_reason?.trim()
    if (r) lostReasonMap[r] = (lostReasonMap[r] || 0) + 1
  })
  const lostReasons  = Object.entries(lostReasonMap).sort((a, b) => b[1] - a[1])
  const maxLostCount = lostReasons[0]?.[1] || 1

  const SortIcon = ({ field }: { field: typeof sortBy }) => (
    <span style={{ marginLeft: '4px', opacity: sortBy === field ? 1 : 0.3, fontSize: '10px' }}>
      {sortBy === field ? (sortDir === 'desc' ? '▼' : '▲') : '▼'}
    </span>
  )

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading deals…</div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">All Deals</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {allActive.length} active · {allBooked.length} booked · {allLost.length} lost · {fmt(pipelineVal)} pipeline
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input className="input" style={{ width: '240px' }} placeholder="Search deals, clients…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <Link href="/bookings"><button className="btn btn-ghost">✦ Bookings</button></Link>
          <Link href="/pipeline"><button className="btn btn-secondary">⬡ Kanban</button></Link>
        </div>
      </div>

      <div className="page-body">

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[
            { label: 'Active Pipeline', val: fmt(pipelineVal),  color: 'var(--accent-mid)'  },
            { label: 'Active Deals',    val: allActive.length,  color: 'var(--text-primary)' },
            { label: 'Booked Value',    val: fmt(bookedVal),    color: 'var(--green)'        },
            { label: 'Lost Deals',      val: allLost.length,    color: 'var(--red)'          },
            { label: 'Conv. Rate',      val: convRate + '%',    color: parseFloat(convRate) >= 20 ? 'var(--green)' : 'var(--amber)' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ padding: '16px 18px' }}>
              <div className="stat-label">{s.label}</div>
              <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '26px', color: s.color, lineHeight: 1, marginTop: '4px' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          {/* Toggle */}
          <button onClick={() => { setActiveOnly(p => !p); setStageFilter('ALL') }}
            style={{ padding: '6px 16px', borderRadius: '20px', border: '1.5px solid', fontSize: '12.5px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px',
              borderColor: activeOnly ? 'var(--accent)' : 'var(--border)',
              background:  activeOnly ? 'var(--accent-light)' : 'transparent',
              color:       activeOnly ? 'var(--accent)' : 'var(--text-muted)' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: activeOnly ? 'var(--accent)' : 'var(--text-muted)', display: 'inline-block' }} />
            {activeOnly ? 'Active only' : 'Showing all'}
          </button>

          <div style={{ width: '1px', height: '24px', background: 'var(--border)' }} />

          {/* Stage pills */}
          {STAGE_FILTERS
            .filter(s => activeOnly ? !['BOOKED','LOST'].includes(s.key) : true)
            .map(s => {
              const cfg   = STAGE_CONFIG[s.key]
              const count = s.key === 'ALL'
                ? (activeOnly ? allActive.length : deals.length)
                : deals.filter(d => d.stage === s.key).length
              const active = stageFilter === s.key
              return (
                <button key={s.key} onClick={() => setStageFilter(s.key)}
                  style={{ padding: '5px 12px', borderRadius: '20px', border: '1.5px solid', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap',
                    borderColor: active ? (cfg?.color || 'var(--accent)') : 'var(--border)',
                    background:  active ? (cfg?.color || 'var(--accent)') + '22' : 'transparent',
                    color:       active ? (cfg?.color || 'var(--accent)') : 'var(--text-muted)' }}>
                  {s.label} ({count})
                </button>
              )
            })}

          {/* Source */}
          <select className="input" style={{ width: 'auto', padding: '6px 12px', fontSize: '12.5px', marginLeft: 'auto' }}
            value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
            {SOURCES.map(s => <option key={s}>{s}</option>)}
          </select>
        </div>

        {/* Count */}
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '12px' }}>
          Showing {filtered.length} of {deals.length} deals
          {!activeOnly && <span style={{ marginLeft: '10px' }}>
            <span style={{ color: 'var(--green)' }}>● booked</span>
            <span style={{ color: 'var(--red)', marginLeft: '8px' }}>● lost</span>
            {' '}shown with coloured border
          </span>}
        </div>

        {/* Lost reasons — only shown when Lost filter is active */}
        {stageFilter === 'LOST' && lostReasons.length > 0 && (
          <div className="card" style={{ padding: '18px 20px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '17px', marginBottom: '14px' }}>Lost Reasons</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {lostReasons.map(([reason, count]) => (
                <div key={reason}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
                    <span style={{ color: 'var(--text-primary)' }}>{reason}</span>
                    <span style={{ color: 'var(--red)', fontWeight: '600' }}>{count} deal{count !== 1 ? 's' : ''}</span>
                  </div>
                  <div style={{ height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(count / maxLostCount) * 100}%`, background: 'var(--red)', opacity: 0.6, borderRadius: '3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Table */}
        {filtered.length === 0 ? (
          <div className="card empty-state">
            <div style={{ fontSize: '32px' }}>◈</div>
            <div className="empty-state-title">{search || stageFilter !== 'ALL' ? 'No deals match' : 'No deals yet'}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Try adjusting your filters</div>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                  {[
                    { label: 'Deal',        field: null              },
                    { label: 'Client',      field: null              },
                    { label: 'Stage',       field: null              },
                    { label: 'Value',       field: 'deal_value'      },
                    { label: 'Departure',   field: 'departure_date'  },
                    { label: 'Next Action', field: null              },
                    { label: 'Quotes',      field: null              },
                    { label: 'Source',      field: null              },
                    { label: 'Created',     field: 'created_at'      },
                    { label: '',            field: null              },
                  ].map(col => (
                    <th key={col.label}
                      onClick={col.field ? () => toggleSort(col.field as typeof sortBy) : undefined}
                      style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600',
                        textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
                        whiteSpace: 'nowrap', cursor: col.field ? 'pointer' : 'default', userSelect: 'none' }}>
                      {col.label}{col.field && <SortIcon field={col.field as typeof sortBy} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map(deal => {
                  const cfg         = STAGE_CONFIG[deal.stage]
                  const isBooked    = deal.stage === 'BOOKED'
                  const isLost      = deal.stage === 'LOST'
                  const isOverdue   = !isBooked && !isLost && !!deal.next_activity_at && new Date(deal.next_activity_at) < new Date()
                  const overdueDays = isOverdue ? daysSince(deal.next_activity_at!) : 0
                  const isRotten    = overdueDays >= 5
                  const quotes      = deal.quotes || []
                  const sentQuotes  = quotes.filter(q => q.sent_to_client).length
                  const totalProfit = quotes.reduce((a, q) => a + (q.profit || 0), 0)
                  const bookingRef  = deal.bookings?.[0]?.booking_reference
                  const client      = deal.clients

                  const borderLeft = isBooked ? '3px solid #10b981'
                    : isLost    ? '3px solid #ef4444'
                    : isRotten  ? '3px solid var(--red)'
                    : '3px solid transparent'

                  return (
                    <tr key={deal.id}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s', borderLeft, opacity: isLost ? 0.65 : 1 }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                      {/* Deal */}
                      <td style={{ padding: '12px 14px', maxWidth: '200px' }}>
                        <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                          <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '15px', color: 'var(--text-primary)',
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            textDecoration: isLost ? 'line-through' : 'none' }}>
                            {deal.title}
                          </div>
                        </Link>
                        {isLost && deal.lost_reason && (
                          <div style={{ fontSize: '11px', color: 'var(--red)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {deal.lost_reason}
                          </div>
                        )}
                      </td>

                      {/* Client */}
                      <td style={{ padding: '12px 14px' }}>
                        {client ? (
                          <div>
                            <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '1px' }}>
                              {client.first_name} {client.last_name}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{client.phone}</div>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>}
                      </td>

                      {/* Stage */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: '500',
                          background: (cfg?.color || '#888') + '22', color: cfg?.color || '#888', whiteSpace: 'nowrap' }}>
                          {cfg?.label || deal.stage}
                        </span>
                      </td>

                      {/* Value */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '500', color: isBooked ? 'var(--green)' : 'var(--text-primary)' }}>
                          {fmt(deal.deal_value || 0)}
                        </div>
                        {totalProfit > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--gold)' }}>+{fmt(totalProfit)} profit</div>
                        )}
                      </td>

                      {/* Departure */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{fmtDate(deal.departure_date)}</div>
                      </td>

                      {/* Next action */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {isBooked ? (
                          <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: '500' }}>✓ Booked</span>
                        ) : isLost ? (
                          <span style={{ fontSize: '12px', color: 'var(--red)' }}>✕ Lost</span>
                        ) : deal.next_activity_at ? (
                          <div>
                            <div style={{ fontSize: '12px', fontWeight: '500', color: isOverdue ? 'var(--red)' : 'var(--text-primary)' }}>
                              {deal.next_activity_type || 'Follow up'}
                            </div>
                            <div style={{ fontSize: '11px', color: isOverdue ? 'var(--red)' : 'var(--text-muted)' }}>
                              {isOverdue ? `${overdueDays}d overdue` : fmtDate(deal.next_activity_at)}
                            </div>
                          </div>
                        ) : <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>—</span>}
                      </td>

                      {/* Quotes */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                          {quotes.length > 0 ? `${quotes.length} quote${quotes.length > 1 ? 's' : ''}` : '—'}
                        </div>
                        {sentQuotes > 0 && <div style={{ fontSize: '11px', color: 'var(--accent-mid)' }}>{sentQuotes} sent</div>}
                        {quotes.length > 0 && (() => {
                          const refs = [...new Set(quotes.map(q => q.quote_ref).filter(Boolean))]
                          return refs.length > 0 ? (
                            <div style={{ fontSize: '10px', fontFamily: 'monospace', color: 'var(--text-muted)', marginTop: '2px' }}>
                              {refs[0]}{refs.length > 1 ? ` +${refs.length - 1}` : ''}
                            </div>
                          ) : null
                        })()}
                      </td>

                      {/* Source */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{deal.source || '—'}</span>
                      </td>

                      {/* Created */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{fmtShort(deal.created_at)}</span>
                      </td>

                      {/* Action */}
                      <td style={{ padding: '12px 14px' }}>
                        {isLost ? (
                          <button
                            onClick={e => { e.stopPropagation(); reopenDeal(deal) }}
                            disabled={reopening === deal.id}
                            style={{ padding: '4px 10px', borderRadius: '6px', border: '1.5px solid var(--green)', background: 'var(--green-light)', color: 'var(--green)', fontSize: '11.5px', cursor: 'pointer', fontFamily: 'Outfit, sans-serif', fontWeight: '600', whiteSpace: 'nowrap' }}>
                            {reopening === deal.id ? '…' : '↩ Reopen'}
                          </button>
                        ) : isBooked && bookingRef ? (
                          <Link href="/bookings" onClick={e => e.stopPropagation()}
                            style={{ fontSize: '11.5px', color: 'var(--green)', textDecoration: 'none', fontWeight: '500', whiteSpace: 'nowrap' }}>
                            {bookingRef} →
                          </Link>
                        ) : (
                          <Link href={`/deals/${deal.id}`} onClick={e => e.stopPropagation()}
                            style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: '16px' }}>
                            →
                          </Link>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', color: 'var(--text-muted)' }}>
            <span>{filtered.length} deal{filtered.length !== 1 ? 's' : ''} shown</span>
            <div style={{ display: 'flex', gap: '20px' }}>
              <span>Total: <strong style={{ color: 'var(--green)' }}>{fmt(filteredVal)}</strong></span>
              <span>Avg: <strong style={{ color: 'var(--text-primary)' }}>{fmt(filteredAvg)}</strong></span>
            </div>
          </div>
        )}
      </div>

      {toast && <div className="toast success">{toast}</div>}
    </div>
  )
}
