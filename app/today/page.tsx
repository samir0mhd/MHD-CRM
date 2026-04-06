'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { authedFetch } from '@/lib/api-client'

// --- Types (same contract as /api/today) ---

type DealAction = {
  id: number
  title: string
  stage: string
  deal_value: number
  next_activity_at: string
  next_activity_type: string | null
  priority_score: number
  days_overdue: number
  clients?: { first_name: string; last_name: string; phone?: string; email?: string }
}

type BalanceAlert = {
  id: number
  booking_reference: string
  departure_date: string | null
  balance_due_date: string
  total_sell: number | null
  days_overdue: number
  deals?: { title: string; clients?: { first_name: string; last_name: string; phone?: string; email?: string } }
}

type TicketAlert = {
  id: number
  booking_id: number
  flight_number: string | null
  airline: string | null
  origin: string | null
  destination: string | null
  ticketing_deadline: string
  departure_date: string | null
  days_until: number
  bookings?: {
    status?: string | null
    booking_reference: string
    deals?: { title: string; clients?: { first_name: string; last_name: string; phone?: string; email?: string } }
  }
}

type DepartureAlert = {
  id: number
  booking_reference: string
  departure_date: string
  destination: string | null
  status?: string | null
  days_until: number
  deals?: { title: string; clients?: { first_name: string; last_name: string } }
}

type BookingTaskAlert = {
  id: number
  booking_id: number
  task_name: string
  task_key: string
  category: string
  notes: string | null
  due_date: string
  days_until: number
  bookings?: {
    status?: string | null
    booking_reference: string
    departure_date: string | null
    deals?: { title: string; clients?: { first_name: string; last_name: string; phone?: string; email?: string } }
  }
}

type TodayData = {
  actions: DealAction[]
  upcoming: DealAction[]
  balanceAlerts: BalanceAlert[]
  ticketAlerts: TicketAlert[]
  departureAlerts: DepartureAlert[]
  taskAlerts: BookingTaskAlert[]
}

// --- Constants ---

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: 'New Lead',
  QUOTE_SENT: 'Quote Sent',
  ENGAGED: 'Engaged',
  FOLLOW_UP: 'Follow Up',
  DECISION_PENDING: 'Decision Pending',
}

const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: '#8b5cf6',
  QUOTE_SENT: '#f59e0b',
  ENGAGED: '#3b82f6',
  FOLLOW_UP: '#f97316',
  DECISION_PENDING: '#ec4899',
}

const ACT_ICONS: Record<string, string> = {
  CALL: '📞',
  EMAIL: '📧',
  WHATSAPP: '💬',
  NOTE: '📝',
  MEETING: '🤝',
  FOLLOW_UP: '🔔',
}

const ACT_LABELS: Record<string, string> = {
  CALL: 'Call client',
  EMAIL: 'Email client',
  WHATSAPP: 'WhatsApp client',
  NOTE: 'Add note',
  MEETING: 'Schedule meeting',
  FOLLOW_UP: 'Follow up',
}

// --- Helpers ---

const fmt = (n: number) => '£' + (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d.includes('T') ? d : d + 'T12:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function priorityLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 100) return { label: '🔴 Critical', color: 'var(--red)', bg: 'var(--red-light)' }
  if (score >= 50) return { label: '🟠 High', color: 'var(--amber)', bg: 'var(--amber-light)' }
  if (score >= 20) return { label: '🟡 Medium', color: 'var(--gold)', bg: 'var(--gold-light)' }
  return { label: '🟢 Normal', color: 'var(--green)', bg: 'var(--green-light)' }
}

function buildWhatsApp(phone: string, clientName: string, actType: string | null, dealTitle: string): string {
  const first = clientName.split(' ')[0]
  const messages: Record<string, string> = {
    CALL: `Hi ${first}, I tried calling you regarding your Mauritius holiday. Please give me a call when you get a chance — 020 8951 6922. Samir`,
    WHATSAPP: `Hi ${first}, just following up on your Mauritius holiday quote. Happy to answer any questions — just reply here. Samir`,
    FOLLOW_UP: `Hi ${first}, wanted to check in on the Mauritius quote I sent over. Have you had a chance to review it? Samir`,
    EMAIL: `Hi ${first}, just a quick follow up on the Mauritius holiday enquiry. Let me know if you have any questions. Samir`,
    default: `Hi ${first}, following up on your Mauritius holiday — ${dealTitle}. Let me know if you have any questions. Samir`,
  }
  const msg = messages[actType || 'default'] || messages.default
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
}

function buildMailto(email: string, clientName: string, actType: string | null, dealTitle: string): string {
  const first = clientName.split(' ')[0]
  const subjects: Record<string, string> = {
    FOLLOW_UP: 'Following up — Your Mauritius Holiday Quote',
    EMAIL: `Your Mauritius Holiday — ${dealTitle}`,
    default: 'Your Mauritius Holiday Enquiry',
  }
  const bodies: Record<string, string> = {
    FOLLOW_UP: `Dear ${first},\n\nI hope you're well. I wanted to follow up on the Mauritius holiday quote I sent over and see if you had any questions or if there's anything you'd like me to adjust.\n\nPlease don't hesitate to call me on 020 8951 6922 or reply to this email.\n\nWarm regards,\nSamir Abattouy\nMauritius Holidays Direct\n020 8951 6922`,
    EMAIL: `Dear ${first},\n\nI wanted to reach out regarding your Mauritius holiday enquiry.\n\nWarm regards,\nSamir Abattouy\nMauritius Holidays Direct\n020 8951 6922`,
    default: `Dear ${first},\n\nFollowing up on your Mauritius holiday enquiry.\n\nWarm regards,\nSamir Abattouy\nMauritius Holidays Direct\n020 8951 6922`,
  }
  const subject = encodeURIComponent(subjects[actType || 'default'] || subjects.default)
  const body = encodeURIComponent(bodies[actType || 'default'] || bodies.default)
  return `mailto:${email}?subject=${subject}&body=${body}`
}

// --- Styles ---

const smallButtonStyle = {
  padding: '7px 14px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: '12px',
  cursor: 'pointer',
  fontFamily: 'Outfit,sans-serif',
} as const

const tinyButtonStyle = {
  padding: '5px 10px',
  borderRadius: '6px',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-muted)',
  fontSize: '11px',
  cursor: 'pointer',
  fontFamily: 'Outfit,sans-serif',
} as const

const smallLinkStyle = {
  padding: '7px 14px',
  borderRadius: '8px',
  border: '1px solid var(--border)',
  background: 'transparent',
  color: 'var(--text-secondary)',
  fontSize: '12px',
  textDecoration: 'none',
} as const

// --- Page ---

const EMPTY_DATA: TodayData = {
  actions: [],
  upcoming: [],
  balanceAlerts: [],
  ticketAlerts: [],
  departureAlerts: [],
  taskAlerts: [],
}

export default function TodayPage() {
  const [data, setData] = useState<TodayData>(EMPTY_DATA)
  const [loading, setLoading] = useState(true)
  // 'deal-{id}' | 'task-{id}' | 'snooze-{id}' — one active action at a time
  const [completingId, setCompletingId] = useState<string | null>(null)
  const [copied, setCopied] = useState<number | null>(null)
  const [showNextAdminWindow, setShowNextAdminWindow] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // --- Data loading ---

  async function load(silent = false) {
    if (!silent) setLoading(true)
    try {
      const res = await authedFetch('/api/today', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load today data')
      const next = (await res.json()) as TodayData
      setData({
        actions: next.actions ?? [],
        upcoming: next.upcoming ?? [],
        balanceAlerts: next.balanceAlerts ?? [],
        ticketAlerts: next.ticketAlerts ?? [],
        departureAlerts: next.departureAlerts ?? [],
        taskAlerts: next.taskAlerts ?? [],
      })
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to load today data', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  // --- Toast ---

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  // --- Mutations ---

  async function completeTask(task: BookingTaskAlert) {
    const key = `task-${task.id}`
    setCompletingId(key)
    try {
      const res = await authedFetch(`/api/today/tasks/${task.id}/complete`, { method: 'POST' })
      const result = await res.json().catch(() => null)
      if (!res.ok) throw new Error(result?.error || 'Could not complete task')
      setData(prev => ({ ...prev, taskAlerts: prev.taskAlerts.filter(t => t.id !== task.id) }))
      showToast('Task completed ✓')
      void load(true)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not complete task', 'error')
    } finally {
      setCompletingId(null)
    }
  }

  async function completeDealAction(deal: DealAction) {
    const key = `deal-${deal.id}`
    setCompletingId(key)
    try {
      const res = await authedFetch(`/api/today/deals/${deal.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: STAGE_LABELS[deal.stage] || deal.stage, next_activity_type: deal.next_activity_type }),
      })
      const result = await res.json().catch(() => null)
      if (!res.ok) throw new Error(result?.error || 'Could not complete action')
      setData(prev => ({
        ...prev,
        actions: prev.actions.filter(d => d.id !== deal.id),
        upcoming: prev.upcoming.filter(d => d.id !== deal.id),
      }))
      showToast('✓ Action completed')
      void load(true)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not complete action', 'error')
    } finally {
      setCompletingId(null)
    }
  }

  async function snoozeDealAction(deal: DealAction, days: number) {
    const key = `snooze-${deal.id}`
    setCompletingId(key)
    try {
      const res = await authedFetch(`/api/today/deals/${deal.id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days }),
      })
      const result = await res.json().catch(() => null)
      if (!res.ok) throw new Error(result?.error || 'Could not snooze action')
      setData(prev => ({
        ...prev,
        actions: prev.actions.filter(d => d.id !== deal.id),
        upcoming: prev.upcoming.filter(d => d.id !== deal.id),
      }))
      showToast(`Snoozed ${days} day${days > 1 ? 's' : ''}`)
      void load(true)
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Could not snooze action', 'error')
    } finally {
      setCompletingId(null)
    }
  }

  function copyPhone(phone: string, id: number) {
    navigator.clipboard.writeText(phone)
    setCopied(id)
    window.setTimeout(() => setCopied(null), 2000)
  }

  // --- Display sections (single derivation, no duplicate rendering) ---

  const win3 = showNextAdminWindow

  const tasksDue      = data.taskAlerts.filter(t => t.days_until <= (win3 ? 3 : 0))
  const balanceDue    = data.balanceAlerts.filter(b => b.days_overdue >= (win3 ? -3 : 0))
  const ticketsDue    = data.ticketAlerts.filter(t => t.days_until <= (win3 ? 3 : 0))
  const departuresDue = data.departureAlerts.filter(d => d.days_until <= (win3 ? 3 : 1))

  const opsItems = [...balanceDue, ...ticketsDue, ...departuresDue]
  const opsUpcomingCount =
    data.balanceAlerts.filter(b => b.days_overdue < (win3 ? -3 : 0)).length +
    data.ticketAlerts.filter(t => t.days_until > (win3 ? 3 : 0)).length +
    data.departureAlerts.filter(d => d.days_until > (win3 ? 3 : 1)).length

  // Only count what is actually rendered — drives the empty state
  const totalVisible = tasksDue.length + opsItems.length + data.actions.length + data.upcoming.length

  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-muted)', marginBottom: '2px' }}>{today}</div>
          <div className="page-title">Today&apos;s Actions</div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {tasksDue.length > 0 && <span style={{ fontSize: '13px', color: 'var(--red)', fontWeight: '600' }}>{tasksDue.length} booking task{tasksDue.length !== 1 ? 's' : ''} due</span>}
          {data.actions.length > 0 && <span style={{ fontSize: '13px', color: 'var(--amber)', fontWeight: '600' }}>{data.actions.length} follow-up{data.actions.length !== 1 ? 's' : ''} due</span>}
          <Link href="/pipeline"><button className="btn btn-secondary btn-sm">Pipeline →</button></Link>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
        ) : totalVisible === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">✓</div>
            <div className="empty-state-title">All clear</div>
            <div className="empty-state-desc">No actions or alerts today.</div>
            <Link href="/pipeline"><button className="btn btn-cta" style={{ marginTop: '16px' }}>Open Pipeline →</button></Link>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

            {/* ── Booking Tasks ── */}
            {tasksDue.length > 0 && (
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ fontFamily: 'Fraunces,serif', fontSize: '21px', fontWeight: '400' }}>🛎 Booking Tasks</div>
                  <div style={{ background: 'var(--red)', color: 'white', borderRadius: '20px', padding: '3px 12px', fontSize: '12px', fontWeight: '700' }}>{tasksDue.length}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {tasksDue.map(task => {
                    const booking = task.bookings
                    const client = booking?.deals?.clients
                    const clientName = client ? `${client.first_name} ${client.last_name}` : '—'
                    const isOverdue = task.days_until < 0
                    const isActive = completingId === `task-${task.id}`
                    return (
                      <div
                        key={task.id}
                        className="card"
                        style={{ padding: '14px 18px', borderLeft: `4px solid ${isOverdue ? 'var(--red)' : 'var(--amber)'}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}
                      >
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '12px', fontWeight: '700', padding: '4px 10px', borderRadius: '4px', background: isOverdue ? 'var(--red-light)' : '#fef3c7', color: isOverdue ? 'var(--red)' : '#92400e' }}>
                              {isOverdue ? `⚠ ${Math.abs(task.days_until)}d overdue` : task.days_until === 0 ? '🔴 Due today' : `⏰ Due in ${task.days_until}d`}
                            </span>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{booking?.booking_reference}</span>
                          </div>
                          <div style={{ fontFamily: 'Fraunces,serif', fontSize: '18px', fontWeight: '300', color: 'var(--text-primary)', marginBottom: '4px' }}>{task.task_name}</div>
                          <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                            <strong>{booking?.deals?.title || 'Confirmed booking'}</strong>
                            {clientName !== '—' ? ` · ${clientName}` : ''}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                            {task.category}
                            {booking?.departure_date ? ` · Departs ${fmtDate(booking.departure_date)}` : ''}
                          </div>
                          {task.notes && <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '8px', fontStyle: 'italic' }}>📝 {task.notes}</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', flexShrink: 0 }}>
                          <button
                            onClick={() => completeTask(task)}
                            disabled={isActive}
                            style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: isOverdue ? 'var(--red)' : 'var(--green)', color: 'white', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'Outfit,sans-serif', whiteSpace: 'nowrap' }}
                          >
                            {isActive ? '…' : '✓ Done'}
                          </button>
                          {task.booking_id && (
                            <Link href={`/bookings/${task.booking_id}`}>
                              <button style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: '11.5px', cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}>
                                Open
                              </button>
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Operations Radar ── */}
            {(opsItems.length > 0 || opsUpcomingCount > 0) && (
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ fontFamily: 'Fraunces,serif', fontSize: '19px', fontWeight: '300' }}>Operations Radar</div>
                  <div style={{ background: 'var(--amber)', color: 'white', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: '700' }}>{opsItems.length}</div>
                  <div style={{ background: '#fef3c7', color: '#92400e', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: '700' }}>
                    {win3 ? 'Next 3 Days' : 'Due Now'}
                  </div>
                  {opsUpcomingCount > 0 && (
                    <div style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: '700' }}>
                      {opsUpcomingCount} Upcoming
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
                  <button className="btn btn-secondary btn-xs" onClick={() => setShowNextAdminWindow(prev => !prev)}>
                    {win3 ? 'Due Now' : 'Next 3 Days'}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {balanceDue.map(item => {
                    const client = item.deals?.clients
                    return (
                      <div key={`balance-${item.id}`} className="card" style={{ padding: '14px 18px', borderLeft: '3px solid var(--amber)', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#92400e', marginBottom: '4px' }}>Informational alert · Balance due</div>
                          <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', color: 'var(--text-primary)' }}>{item.deals?.title || item.booking_reference}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {item.booking_reference}
                            {client ? ` · ${client.first_name} ${client.last_name}` : ''}
                            {item.total_sell ? ` · ${fmt(item.total_sell)}` : ''}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                            {item.days_overdue >= 0 ? `${item.days_overdue}d overdue` : `Due in ${Math.abs(item.days_overdue)}d`} · {fmtDate(item.balance_due_date)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {client?.phone && <a href={`tel:${client.phone}`} style={smallLinkStyle}>📞 Call</a>}
                          {client?.email && <a href={buildMailto(client.email, `${client.first_name} ${client.last_name}`, 'EMAIL', item.deals?.title || item.booking_reference)} style={smallLinkStyle}>📧 Email</a>}
                          <Link href={`/bookings/${item.id}`}><button style={smallButtonStyle}>Open booking →</button></Link>
                        </div>
                      </div>
                    )
                  })}

                  {ticketsDue.map(item => {
                    const booking = item.bookings
                    const client = booking?.deals?.clients
                    const clientName = client ? `${client.first_name} ${client.last_name}` : 'Unknown client'
                    return (
                      <div key={`ticket-${item.id}`} className="card" style={{ padding: '14px 18px', borderLeft: '3px solid #6366f1', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: '700', color: '#4c1d95', marginBottom: '4px' }}>Informational alert · Ticket deadline</div>
                          <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', color: 'var(--text-primary)' }}>{`${item.airline || 'Flight'} ${item.flight_number || ''}`.trim()}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {booking?.booking_reference}
                            {client ? ` · ${clientName}` : ''}
                            {item.origin || item.destination ? ` · ${item.origin || '—'} → ${item.destination || '—'}` : ''}
                          </div>
                          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                            {item.days_until <= 0 ? `${Math.abs(item.days_until)}d overdue` : `Due in ${item.days_until}d`} · {fmtDate(item.ticketing_deadline)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {client?.phone && <a href={`tel:${client.phone}`} style={smallLinkStyle}>📞 Call</a>}
                          {client?.email && <a href={buildMailto(client.email, clientName, 'EMAIL', booking?.deals?.title || booking?.booking_reference || 'Booking')} style={smallLinkStyle}>📧 Email</a>}
                          <Link href={`/bookings/${item.booking_id}`}><button style={smallButtonStyle}>Open booking →</button></Link>
                        </div>
                      </div>
                    )
                  })}

                  {departuresDue.map(item => (
                    <div key={`departure-${item.id}`} className="card" style={{ padding: '14px 18px', borderLeft: '3px solid var(--green)', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: '700', color: '#065f46', marginBottom: '4px' }}>Informational alert · Departure</div>
                        <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', color: 'var(--text-primary)' }}>{item.deals?.title || item.booking_reference}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {item.booking_reference}
                          {item.deals?.clients ? ` · ${item.deals.clients.first_name} ${item.deals.clients.last_name}` : ''}
                          {item.destination ? ` · ${item.destination}` : ''}
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                          {item.days_until === 0 ? 'Departing today' : item.days_until === 1 ? 'Departing tomorrow' : `Departing in ${item.days_until}d`} · {fmtDate(item.departure_date)}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                        <Link href={`/bookings/${item.id}`}><button style={smallButtonStyle}>Open booking →</button></Link>
                      </div>
                    </div>
                  ))}

                  {opsItems.length === 0 && (
                    <div className="card" style={{ padding: '14px 18px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: '13px' }}>
                      No urgent operations items right now.
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Follow-ups Due ── */}
            {data.actions.length > 0 && (
              <section>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                  <div style={{ fontFamily: 'Fraunces,serif', fontSize: '19px', fontWeight: '300' }}>Follow-ups Due</div>
                  <div style={{ background: 'var(--red)', color: 'white', borderRadius: '20px', padding: '2px 10px', fontSize: '12px', fontWeight: '700' }}>{data.actions.length}</div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {data.actions.map(deal => {
                    const client = deal.clients
                    const clientName = client ? `${client.first_name} ${client.last_name}` : 'Unknown'
                    const priority = priorityLabel(deal.priority_score)
                    const stageCol = STAGE_COLORS[deal.stage] || 'var(--accent)'
                    const isActive = completingId === `deal-${deal.id}` || completingId === `snooze-${deal.id}`
                    const isDueToday = deal.days_overdue === 0
                    const isOverdue = deal.days_overdue > 0
                    return (
                      <div key={deal.id} className="card" style={{ overflow: 'hidden', borderLeft: `3px solid ${stageCol}` }}>
                        <div style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '4px', background: priority.bg, color: priority.color }}>{priority.label}</span>
                                <span style={{ fontSize: '11px', fontWeight: '600', color: stageCol, background: `${stageCol}18`, padding: '2px 8px', borderRadius: '4px' }}>{STAGE_LABELS[deal.stage] || deal.stage}</span>
                                {deal.next_activity_type && <span title={ACT_LABELS[deal.next_activity_type] || deal.next_activity_type} style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{ACT_ICONS[deal.next_activity_type]} {deal.next_activity_type.charAt(0) + deal.next_activity_type.slice(1).toLowerCase().replace('_', ' ')}</span>}
                                {isOverdue && <span style={{ fontSize: '11px', color: 'var(--red)', fontWeight: '600' }}>⚠ {deal.days_overdue}d overdue</span>}
                                {isDueToday && <span style={{ fontSize: '11px', color: 'var(--amber)', fontWeight: '600' }}>Due today</span>}
                              </div>
                              <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                                <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', color: 'var(--text-primary)', marginBottom: '2px' }}>{deal.title}</div>
                              </Link>
                              <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>{clientName}{deal.deal_value ? ` · ${fmt(deal.deal_value)}` : ''}</div>
                            </div>
                            <div style={{ textAlign: 'right', marginLeft: '12px', flexShrink: 0 }}>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Priority score</div>
                              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '22px', fontWeight: '300', color: priority.color }}>{deal.priority_score}</div>
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
                            {client?.phone && (
                              <>
                                <button
                                  onClick={() => copyPhone(client.phone!, deal.id)}
                                  style={{ padding: '6px 12px', borderRadius: '7px', border: '1.5px solid var(--border)', background: copied === deal.id ? 'var(--green-light)' : 'transparent', color: copied === deal.id ? 'var(--green)' : 'var(--text-secondary)', fontSize: '12px', cursor: 'pointer', fontFamily: 'Outfit,sans-serif' }}
                                >
                                  {copied === deal.id ? '✓ Copied' : '📋 Copy Number'}
                                </button>
                                <a href={buildWhatsApp(client.phone, clientName, deal.next_activity_type, deal.title)} target="_blank" rel="noreferrer" style={{ ...smallLinkStyle, border: '1.5px solid #25d366', background: '#e8f9ef', color: '#1a9e52' }}>💬 WhatsApp</a>
                              </>
                            )}
                            {client?.email && <a href={buildMailto(client.email, clientName, deal.next_activity_type, deal.title)} style={smallLinkStyle}>📧 Email</a>}
                            <div style={{ flex: 1 }} />
                            {[1, 3, 7].map(days => (
                              <button key={days} onClick={() => snoozeDealAction(deal, days)} disabled={isActive} style={tinyButtonStyle}>
                                +{days}d
                              </button>
                            ))}
                            <button
                              onClick={() => completeDealAction(deal)}
                              disabled={isActive}
                              style={{ padding: '6px 14px', borderRadius: '7px', border: 'none', background: 'var(--green)', color: 'white', fontSize: '12px', cursor: 'pointer', fontFamily: 'Outfit,sans-serif', fontWeight: '600' }}
                            >
                              {completingId === `deal-${deal.id}` ? '…' : '✓ Done'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── This Week ── */}
            {data.upcoming.length > 0 && (
              <section>
                <div style={{ fontFamily: 'Fraunces,serif', fontSize: '19px', fontWeight: '300', marginBottom: '12px' }}>This Week</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {data.upcoming.map(deal => {
                    const client = deal.clients
                    const clientName = client ? `${client.first_name} ${client.last_name}` : 'Unknown'
                    const dueDate = new Date(deal.next_activity_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
                    return (
                      <div key={deal.id} className="card" style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                        <div>
                          <div style={{ fontFamily: 'Fraunces,serif', fontSize: '16px', fontWeight: '300', color: 'var(--text-primary)' }}>{deal.title}</div>
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>
                            {ACT_ICONS[deal.next_activity_type || 'FOLLOW_UP']} {ACT_LABELS[deal.next_activity_type || 'FOLLOW_UP'] || deal.next_activity_type}
                            {` · ${dueDate}`}
                            {client ? ` · ${clientName}` : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                          {client?.phone && <a href={buildWhatsApp(client.phone, clientName, deal.next_activity_type, deal.title)} target="_blank" rel="noreferrer" style={{ ...smallLinkStyle, border: '1.5px solid #25d366', background: '#e8f9ef', color: '#1a9e52' }}>💬 WhatsApp</a>}
                          {client?.email && <a href={buildMailto(client.email, clientName, deal.next_activity_type, deal.title)} style={smallLinkStyle}>📧 Email</a>}
                          <Link href={`/deals/${deal.id}`}><button style={smallButtonStyle}>Open deal →</button></Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
