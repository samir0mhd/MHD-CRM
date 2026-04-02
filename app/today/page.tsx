'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ── TYPES ────────────────────────────────────────────────────
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
  bookings?: { status?: string | null; booking_reference: string; deals?: { title: string; clients?: { first_name: string; last_name: string; phone?: string; email?: string } } }
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

type DealQuery = Omit<DealAction, 'days_overdue' | 'priority_score'>
type BalanceAlertQuery = Omit<BalanceAlert, 'days_overdue'>
type TicketAlertQuery = Omit<TicketAlert, 'days_until'>
type DepartureAlertQuery = Omit<DepartureAlert, 'days_until'>
type BookingTaskAlertQuery = Omit<BookingTaskAlert, 'days_until'>

// ── CONSTANTS ────────────────────────────────────────────────
const STAGE_LABELS: Record<string,string> = {
  NEW_LEAD:'New Lead', QUOTE_SENT:'Quote Sent', ENGAGED:'Engaged',
  FOLLOW_UP:'Follow Up', DECISION_PENDING:'Decision Pending',
}
const STAGE_COLORS: Record<string,string> = {
  NEW_LEAD:'#8b5cf6', QUOTE_SENT:'#f59e0b', ENGAGED:'#3b82f6',
  FOLLOW_UP:'#f97316', DECISION_PENDING:'#ec4899',
}
const STAGE_WEIGHT: Record<string,number> = {
  DECISION_PENDING:50, FOLLOW_UP:30, ENGAGED:20, QUOTE_SENT:10, NEW_LEAD:5,
}
const ACT_ICONS: Record<string,string> = {
  CALL:'📞', EMAIL:'📧', WHATSAPP:'💬', NOTE:'📝', MEETING:'🤝', FOLLOW_UP:'🔔',
}

// ── HELPERS ──────────────────────────────────────────────────
const fmt = (n: number) => '£' + (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })

function fmtDate(d: string | null) {
  if (!d) return '—'
  return new Date(d.includes('T') ? d : d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function priorityScore(deal_value: number, days_overdue: number, stage: string): number {
  return Math.round(Math.min(deal_value / 1000, 50) + Math.min(days_overdue * 10, 100) + (STAGE_WEIGHT[stage] || 0))
}

function priorityLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 100) return { label: '🔴 Critical', color: 'var(--red)',   bg: 'var(--red-light)'   }
  if (score >= 50)  return { label: '🟠 High',     color: 'var(--amber)', bg: 'var(--amber-light)' }
  if (score >= 20)  return { label: '🟡 Medium',   color: 'var(--gold)',  bg: 'var(--gold-light)'  }
  return                   { label: '🟢 Normal',   color: 'var(--green)', bg: 'var(--green-light)' }
}

function buildWhatsApp(phone: string, clientName: string, actType: string | null, dealTitle: string): string {
  const first = clientName.split(' ')[0]
  const messages: Record<string, string> = {
    CALL:      `Hi ${first}, I tried calling you regarding your Mauritius holiday. Please give me a call when you get a chance — 020 8951 6922. Samir`,
    WHATSAPP:  `Hi ${first}, just following up on your Mauritius holiday quote. Happy to answer any questions — just reply here. Samir`,
    FOLLOW_UP: `Hi ${first}, wanted to check in on the Mauritius quote I sent over. Have you had a chance to review it? Samir`,
    EMAIL:     `Hi ${first}, just a quick follow up on your Mauritius holiday enquiry. Let me know if you have any questions. Samir`,
    default:   `Hi ${first}, following up on your Mauritius holiday — ${dealTitle}. Let me know if you have any questions. Samir`,
  }
  const msg = messages[actType || 'default'] || messages.default
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`
}

function buildMailto(email: string, clientName: string, actType: string | null, dealTitle: string): string {
  const first = clientName.split(' ')[0]
  const subjects: Record<string, string> = {
    FOLLOW_UP: `Following up — Your Mauritius Holiday Quote`,
    EMAIL:     `Your Mauritius Holiday — ${dealTitle}`,
    default:   `Your Mauritius Holiday Enquiry`,
  }
  const bodies: Record<string, string> = {
    FOLLOW_UP: `Dear ${first},\n\nI hope you're well. I wanted to follow up on the Mauritius holiday quote I sent over and see if you had any questions or if there's anything you'd like me to adjust.\n\nPlease don't hesitate to call me on 020 8951 6922 or reply to this email.\n\nWarm regards,\nSamir Abattouy\nMauritius Holidays Direct\n020 8951 6922`,
    EMAIL:     `Dear ${first},\n\nI wanted to reach out regarding your Mauritius holiday enquiry.\n\nWarm regards,\nSamir Abattouy\nMauritius Holidays Direct\n020 8951 6922`,
    default:   `Dear ${first},\n\nFollowing up on your Mauritius holiday enquiry.\n\nWarm regards,\nSamir Abattouy\nMauritius Holidays Direct\n020 8951 6922`,
  }
  const subject = encodeURIComponent(subjects[actType || 'default'] || subjects.default)
  const body    = encodeURIComponent(bodies[actType || 'default']    || bodies.default)
  return `mailto:${email}?subject=${subject}&body=${body}`
}

// ── MAIN PAGE ────────────────────────────────────────────────
export default function TodayPage() {
  const [actions, setActions]         = useState<DealAction[]>([])
  const [upcoming, setUpcoming]       = useState<DealAction[]>([])
  const [balanceAlerts, setBalanceAlerts]   = useState<BalanceAlert[]>([])
  const [ticketAlerts, setTicketAlerts]     = useState<TicketAlert[]>([])
  const [departureAlerts, setDepartureAlerts] = useState<DepartureAlert[]>([])
  const [taskAlerts, setTaskAlerts]         = useState<BookingTaskAlert[]>([])
  const [loading, setLoading]         = useState(true)
  const [completing, setCompleting]   = useState<number | null>(null)
  const [completingTask, setCompletingTask] = useState<number | null>(null)
  const [snoozing, setSnoozing]       = useState<number | null>(null)
  const [toast, setToast]             = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const [copied, setCopied]           = useState<number | null>(null)
  const [showNextAdminWindow, setShowNextAdminWindow] = useState(false)

  async function load() {
    setLoading(true)
    const now       = new Date()
    const todayEnd  = new Date(now); todayEnd.setHours(23, 59, 59, 999)
    const weekAhead = new Date(now.getTime() + 7 * 86400000).toISOString()
    const today     = now.toISOString().split('T')[0]
    const in7days   = new Date(now.getTime() + 7  * 86400000).toISOString().split('T')[0]
    const in14days  = new Date(now.getTime() + 14 * 86400000).toISOString().split('T')[0]

    // ── Deal follow-ups ──
    const { data: dealData } = await supabase.from('deals')
      .select('id,title,stage,deal_value,next_activity_at,next_activity_type,clients(first_name,last_name,phone,email)')
      .not('stage', 'in', '("BOOKED","LOST")')
      .not('next_activity_at', 'is', null)
      .order('next_activity_at', { ascending: true })

    const overdueDue: DealAction[] = []
    const upcomingList: DealAction[] = []
    for (const d of ((dealData || []) as DealQuery[])) {
      const daysOverdue = Math.floor((now.getTime() - new Date(d.next_activity_at).getTime()) / 86400000)
      const score = priorityScore(d.deal_value || 0, daysOverdue, d.stage)
      const item: DealAction = { ...d, days_overdue: daysOverdue, priority_score: score }
      if (new Date(d.next_activity_at) <= todayEnd) overdueDue.push(item)
      else if (new Date(d.next_activity_at) <= new Date(weekAhead)) upcomingList.push(item)
    }
    overdueDue.sort((a, b) => b.priority_score - a.priority_score)
    upcomingList.sort((a, b) => new Date(a.next_activity_at).getTime() - new Date(b.next_activity_at).getTime())
    setActions(overdueDue)
    setUpcoming(upcomingList)

    // ── Balance due alerts (overdue or due within 7 days) ──
    const { data: balData } = await supabase.from('bookings')
      .select('id,booking_reference,departure_date,balance_due_date,total_sell,deals(title,clients(first_name,last_name,phone,email))')
      .not('balance_due_date', 'is', null)
      .lte('balance_due_date', in7days)
      .not('status', 'eq', 'CANCELLED')
      .order('balance_due_date', { ascending: true })
    const balAlerts: BalanceAlert[] = ((balData || []) as BalanceAlertQuery[]).map(b => ({
      ...b,
      days_overdue: Math.floor((now.getTime() - new Date(b.balance_due_date + 'T12:00').getTime()) / 86400000),
    }))
    setBalanceAlerts(balAlerts)

    // ── Ticketing deadline alerts (due within 14 days, first leg per segment) ──
    const { data: tickData } = await supabase.from('booking_flights')
      .select('id,booking_id,flight_number,airline,origin,destination,ticketing_deadline,departure_date,bookings(status,booking_reference,deals(title,clients(first_name,last_name,phone,email)))')
      .not('ticketing_deadline', 'is', null)
      .lte('ticketing_deadline', in14days)
      .not('net_cost', 'is', null)   // first leg of segment only
      .order('ticketing_deadline', { ascending: true })
    const tickAlerts: TicketAlert[] = ((tickData || []) as TicketAlertQuery[])
      .filter(f => f.bookings?.status !== 'CANCELLED')
      .map(f => ({
        ...f,
        days_until: Math.floor((new Date(f.ticketing_deadline + 'T12:00').getTime() - now.getTime()) / 86400000),
      }))
    setTicketAlerts(tickAlerts)

    // ── Departure alerts (departing within 14 days) ──
    const { data: depData } = await supabase.from('bookings')
      .select('id,booking_reference,departure_date,destination,status,deals(title,clients(first_name,last_name))')
      .not('departure_date', 'is', null)
      .gte('departure_date', today)
      .lte('departure_date', in14days)
      .order('departure_date', { ascending: true })
    const depAlerts: DepartureAlert[] = ((depData || []) as DepartureAlertQuery[])
      .filter(b => b.status !== 'CANCELLED')
      .map(b => ({
        ...b,
        days_until: Math.floor((new Date(b.departure_date + 'T12:00').getTime() - now.getTime()) / 86400000),
      }))
    setDepartureAlerts(depAlerts)

    // ── Booking task alerts (dated ops reminders + cancellation follow-ups) ──
    const { data: taskData } = await supabase.from('booking_tasks')
      .select('id,booking_id,task_name,task_key,category,notes,due_date,bookings!inner(booking_reference,departure_date,status,deals(title,clients(first_name,last_name,phone,email)))')
      .eq('is_done', false)
      .not('due_date', 'is', null)
      .lte('due_date', in14days)
      .order('due_date', { ascending: true })
    const datedTasks: BookingTaskAlert[] = ((taskData || []) as BookingTaskAlertQuery[])
      .filter(task => {
        const bookingStatus = task.bookings?.status
        if (task.task_key?.startsWith('ops_request_')) return bookingStatus === 'CONFIRMED'
        if (task.task_key?.startsWith('cancel_followup_')) return bookingStatus === 'CANCELLED'
        return false
      })
      .map(task => ({
        ...task,
        days_until: Math.floor((new Date(task.due_date + 'T12:00').getTime() - now.getTime()) / 86400000),
      }))
    setTaskAlerts(datedTasks)

    setLoading(false)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  async function markComplete(deal: DealAction) {
    setCompleting(deal.id)
    await supabase.from('deals').update({ next_activity_at: null, next_activity_type: null }).eq('id', deal.id)
    await supabase.from('activities').insert({ deal_id: deal.id, activity_type: deal.next_activity_type || 'NOTE', notes: `Action completed — ${STAGE_LABELS[deal.stage] || deal.stage}` })
    showToast('✓ Action completed')
    setCompleting(null)
    load()
  }

  async function snooze(deal: DealAction, days: number) {
    setSnoozing(deal.id)
    const newDate = new Date()
    newDate.setDate(newDate.getDate() + days)
    newDate.setHours(9, 0, 0, 0)
    await supabase.from('deals').update({ next_activity_at: newDate.toISOString() }).eq('id', deal.id)
    showToast(`Snoozed ${days} day${days > 1 ? 's' : ''}`)
    setSnoozing(null)
    load()
  }

  async function completeTask(task: BookingTaskAlert) {
    setCompletingTask(task.id)
    const { error } = await supabase
      .from('booking_tasks')
      .update({ is_done: true, completed_at: new Date().toISOString() })
      .eq('id', task.id)
    if (error) {
      showToast(error.message || 'Could not complete task', 'error')
      setCompletingTask(null)
      return
    }
    showToast('Task completed ✓')
    setCompletingTask(null)
    load()
  }

  function copyPhone(phone: string, id: number) {
    navigator.clipboard.writeText(phone)
    setCopied(id)
    setTimeout(() => setCopied(null), 2000)
  }

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2800)
  }

  const visibleTaskAlerts = taskAlerts.filter(task => showNextAdminWindow ? task.days_until <= 3 : task.days_until <= 0)
  const laterTaskAlerts = taskAlerts.filter(task => showNextAdminWindow ? task.days_until > 3 : task.days_until > 0)
  const visibleBalanceAlerts = balanceAlerts.filter(b => showNextAdminWindow ? b.days_overdue >= -3 : b.days_overdue >= 0)
  const laterBalanceAlerts = balanceAlerts.filter(b => showNextAdminWindow ? b.days_overdue < -3 : b.days_overdue < 0)
  const visibleTicketAlerts = ticketAlerts.filter(f => showNextAdminWindow ? f.days_until <= 3 : f.days_until <= 0)
  const laterTicketAlerts = ticketAlerts.filter(f => showNextAdminWindow ? f.days_until > 3 : f.days_until > 0)
  const visibleDepartureAlerts = departureAlerts.filter(b => showNextAdminWindow ? b.days_until <= 3 : b.days_until <= 1)
  const laterDepartureAlerts = departureAlerts.filter(b => showNextAdminWindow ? b.days_until > 3 : b.days_until > 1)
  const totalAlerts = balanceAlerts.length + ticketAlerts.length + departureAlerts.length + taskAlerts.length
  const visibleAdminCount =
    visibleBalanceAlerts.length +
    visibleTicketAlerts.length +
    visibleDepartureAlerts.length +
    visibleTaskAlerts.length
  const laterAdminCount =
    laterBalanceAlerts.length +
    laterTicketAlerts.length +
    laterDepartureAlerts.length +
    laterTaskAlerts.length
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-muted)', marginBottom:'2px' }}>{today}</div>
          <div className="page-title">Today&apos;s Actions</div>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {actions.length > 0 && <span style={{ fontSize:'13px', color:'var(--red)', fontWeight:'600' }}>{actions.length} follow-up{actions.length !== 1 ? 's' : ''} due</span>}
          {visibleAdminCount > 0 && <span style={{ fontSize:'13px', color:'var(--amber)', fontWeight:'600' }}>{visibleAdminCount} urgent admin item{visibleAdminCount !== 1 ? 's' : ''}</span>}
          <Link href="/pipeline"><button className="btn btn-secondary btn-sm">Pipeline →</button></Link>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ color:'var(--text-muted)', fontSize:'13px' }}>Loading…</div>
        ) : actions.length === 0 && upcoming.length === 0 && totalAlerts === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">✓</div>
            <div className="empty-state-title">All clear</div>
            <div className="empty-state-desc">No actions or alerts today.</div>
            <Link href="/pipeline"><button className="btn btn-cta" style={{ marginTop:'16px' }}>Open Pipeline →</button></Link>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'24px' }}>

            {/* ── BOOKING ALERTS ─────────────────────────────── */}
            {totalAlerts > 0 && (
              <div style={{ order: 3 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:'19px', fontWeight:'300' }}>Operations Radar</div>
                  <div style={{ background:'var(--amber)', color:'white', borderRadius:'20px', padding:'2px 10px', fontSize:'12px', fontWeight:'700' }}>{visibleAdminCount}</div>
                  {visibleAdminCount > 0 && (
                    <div style={{ background:'#fef3c7', color:'#92400e', borderRadius:'20px', padding:'2px 10px', fontSize:'12px', fontWeight:'700' }}>
                      {showNextAdminWindow ? 'Next 3 Days' : 'Due Now'}
                    </div>
                  )}
                  {laterAdminCount > 0 && (
                    <div style={{ background:'var(--bg-secondary)', color:'var(--text-muted)', borderRadius:'20px', padding:'2px 10px', fontSize:'12px', fontWeight:'700' }}>
                      {laterAdminCount} Upcoming
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', justifyContent:'flex-end', gap:'12px', flexWrap:'wrap', marginBottom:'10px' }}>
                  <button className="btn btn-secondary btn-xs" onClick={() => setShowNextAdminWindow(prev => !prev)}>
                    {showNextAdminWindow ? 'Due Now' : 'Next 3 Days'}
                  </button>
                </div>
                {laterAdminCount > 0 && (
                  <div className="card" style={{ padding:'12px 14px', marginBottom:'10px', background:'var(--bg-secondary)' }}>
                    <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                      {laterTaskAlerts.length > 0 && <span style={{ fontSize:'11px', color:'#4c1d95', background:'#ede9fe', padding:'4px 8px', borderRadius:'999px', fontWeight:'600' }}>{laterTaskAlerts.length} Requests</span>}
                      {laterBalanceAlerts.length > 0 && <span style={{ fontSize:'11px', color:'#92400e', background:'#fef3c7', padding:'4px 8px', borderRadius:'999px', fontWeight:'600' }}>{laterBalanceAlerts.length} Balances</span>}
                      {laterTicketAlerts.length > 0 && <span style={{ fontSize:'11px', color:'#4c1d95', background:'#ede9fe', padding:'4px 8px', borderRadius:'999px', fontWeight:'600' }}>{laterTicketAlerts.length} Ticket Deadlines</span>}
                      {laterDepartureAlerts.length > 0 && <span style={{ fontSize:'11px', color:'#065f46', background:'#d1fae5', padding:'4px 8px', borderRadius:'999px', fontWeight:'600' }}>{laterDepartureAlerts.length} Departures</span>}
                    </div>
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {visibleAdminCount === 0 && (
                    <div className="card" style={{ padding:'14px 18px', background:'var(--bg-secondary)', color:'var(--text-muted)', fontSize:'13px' }}>
                      No urgent operations items right now.
                    </div>
                  )}

                  {/* Dated booking tasks / client requests */}
                  {visibleTaskAlerts.map(task => {
                    const booking = task.bookings
                    const client = booking?.deals?.clients
                    const clientName = client ? `${client.first_name} ${client.last_name}` : '—'
                    const isOverdue = task.days_until < 0
                    const isUrgent = task.days_until >= 0 && task.days_until <= 3
                    const isCancellationFollowUp = task.task_key?.startsWith('cancel_followup_')
                    return (
                      <div key={`task-${task.id}`} className="card" style={{ padding:'14px 18px', borderLeft:`3px solid ${isOverdue ? 'var(--red)' : isUrgent ? 'var(--amber)' : '#6366f1'}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'4px',
                              background: isOverdue ? 'var(--red-light)' : isUrgent ? '#fef3c7' : '#ede9fe',
                              color: isOverdue ? 'var(--red)' : isUrgent ? '#92400e' : '#4c1d95',
                            }}>
                              🛎 {isOverdue ? `${Math.abs(task.days_until)}d overdue` : task.days_until === 0 ? 'Due today' : `Due in ${task.days_until}d`}
                            </span>
                            <span style={{ fontSize:'11px', color:isCancellationFollowUp ? '#9f1239' : '#4c1d95', background:isCancellationFollowUp ? '#ffe4e6' : '#ede9fe', padding:'2px 8px', borderRadius:'4px', fontWeight:'600' }}>
                              {isCancellationFollowUp ? 'Cancellation' : task.category}
                            </span>
                            {booking && <span style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'monospace' }}>{booking.booking_reference}</span>}
                          </div>
                          <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', color:'var(--text-primary)', marginBottom:'1px' }}>
                            {task.task_name}
                          </div>
                          <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                            {booking?.deals?.title || booking?.booking_reference || 'Confirmed booking'}{clientName !== '—' ? ` · ${clientName}` : ''}{booking?.departure_date ? ` · Departs ${fmtDate(booking.departure_date)}` : ''}
                          </div>
                          {task.notes && <div style={{ fontSize:'12px', color:'var(--text-secondary)', marginTop:'5px' }}>{task.notes}</div>}
                        </div>
                        <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
                          <span style={{ fontSize:'13px', fontWeight:'600', color: isOverdue ? 'var(--red)' : isUrgent ? 'var(--amber)' : '#4c1d95' }}>{fmtDate(task.due_date)}</span>
                          <button
                            onClick={() => completeTask(task)}
                            disabled={completingTask === task.id}
                            style={{ padding:'5px 10px', borderRadius:'6px', border:'1.5px solid var(--green)', background:'transparent', color:'var(--green)', fontSize:'11.5px', cursor:'pointer', fontFamily:'Outfit,sans-serif', fontWeight:'600' }}
                          >
                            {completingTask === task.id ? '…' : 'Done'}
                          </button>
                          {task.booking_id && (
                            <Link href={`/bookings/${task.booking_id}`}>
                              <button style={{ padding:'5px 10px', borderRadius:'6px', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:'11.5px', cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>Open →</button>
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Balance due */}
                  {visibleBalanceAlerts.map(b => {
                    const client = b.deals?.clients
                    const clientName = client ? `${client.first_name} ${client.last_name}` : '—'
                    const isOverdue = b.days_overdue > 0
                    return (
                      <div key={`bal-${b.id}`} className="card" style={{ padding:'14px 18px', borderLeft:`3px solid ${isOverdue ? 'var(--red)' : 'var(--amber)'}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'4px', background: isOverdue ? 'var(--red-light)' : '#fef3c7', color: isOverdue ? 'var(--red)' : '#92400e' }}>
                              💳 {isOverdue ? `Balance ${b.days_overdue}d overdue` : `Balance due ${b.days_overdue === 0 ? 'today' : `in ${-b.days_overdue}d`}`}
                            </span>
                            <span style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'monospace' }}>{b.booking_reference}</span>
                          </div>
                          <Link href={`/bookings/${b.id}`} style={{ textDecoration:'none' }}>
                            <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', color:'var(--text-primary)', marginBottom:'1px' }}>{b.deals?.title || b.booking_reference}</div>
                          </Link>
                          <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                            {clientName}{b.total_sell ? ` · ${fmt(b.total_sell)}` : ''}{b.departure_date ? ` · Departs ${fmtDate(b.departure_date)}` : ''}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
                          <span style={{ fontSize:'13px', fontWeight:'600', color: isOverdue ? 'var(--red)' : 'var(--amber)' }}>{fmtDate(b.balance_due_date)}</span>
                          {client?.phone && (
                            <a href={`tel:${client.phone}`}
                              style={{ padding:'5px 10px', borderRadius:'6px', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:'11.5px', textDecoration:'none' }}>
                              📞
                            </a>
                          )}
                          <Link href={`/bookings/${b.id}`}>
                            <button style={{ padding:'5px 10px', borderRadius:'6px', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:'11.5px', cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>Open →</button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}

                  {/* Ticketing deadlines */}
                  {visibleTicketAlerts.map(f => {
                    const booking = f.bookings
                    const client  = booking?.deals?.clients
                    const clientName = client ? `${client.first_name} ${client.last_name}` : '—'
                    const isOverdue  = f.days_until < 0
                    const isUrgent   = f.days_until >= 0 && f.days_until <= 3
                    return (
                      <div key={`tick-${f.id}`} className="card" style={{ padding:'14px 18px', borderLeft:`3px solid ${isOverdue ? 'var(--red)' : isUrgent ? 'var(--amber)' : '#6366f1'}`, display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'4px',
                              background: isOverdue ? 'var(--red-light)' : isUrgent ? '#fef3c7' : '#ede9fe',
                              color:      isOverdue ? 'var(--red)'       : isUrgent ? '#92400e' : '#4c1d95',
                            }}>
                              🎫 {isOverdue ? `Ticket ${Math.abs(f.days_until)}d overdue` : f.days_until === 0 ? 'Ticket due today' : `Ticket due in ${f.days_until}d`}
                            </span>
                            {booking && <span style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'monospace' }}>{booking.booking_reference}</span>}
                          </div>
                          <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', color:'var(--text-primary)', marginBottom:'1px' }}>
                            {f.flight_number} · {f.origin} → {f.destination}
                          </div>
                          <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                            {f.airline}{clientName !== '—' ? ` · ${clientName}` : ''}{f.departure_date ? ` · Departs ${fmtDate(f.departure_date)}` : ''}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
                          <span style={{ fontSize:'13px', fontWeight:'600', color: isOverdue ? 'var(--red)' : isUrgent ? 'var(--amber)' : 'var(--text-primary)' }}>{fmtDate(f.ticketing_deadline)}</span>
                          {f.booking_id && (
                            <Link href={`/bookings/${f.booking_id}`}>
                              <button style={{ padding:'5px 10px', borderRadius:'6px', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:'11.5px', cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>Open →</button>
                            </Link>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Upcoming departures */}
                  {visibleDepartureAlerts.map(b => {
                    const client = b.deals?.clients
                    const clientName = client ? `${client.first_name} ${client.last_name}` : '—'
                    const isToday = b.days_until === 0
                    const isTomorrow = b.days_until === 1
                    return (
                      <div key={`dep-${b.id}`} className="card" style={{ padding:'14px 18px', borderLeft:'3px solid var(--green)', display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px', flexWrap:'wrap' }}>
                            <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'4px', background:'#d1fae5', color:'#065f46' }}>
                              ✈ {isToday ? 'Departing today' : isTomorrow ? 'Departing tomorrow' : `Departing in ${b.days_until}d`}
                            </span>
                            <span style={{ fontSize:'11px', color:'var(--text-muted)', fontFamily:'monospace' }}>{b.booking_reference}</span>
                          </div>
                          <Link href={`/bookings/${b.id}`} style={{ textDecoration:'none' }}>
                            <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', color:'var(--text-primary)', marginBottom:'1px' }}>{b.deals?.title || b.booking_reference}</div>
                          </Link>
                          <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                            {clientName}{b.destination ? ` · ${b.destination}` : ''}
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
                          <span style={{ fontSize:'13px', fontWeight:'600', color:'var(--green)' }}>{fmtDate(b.departure_date)}</span>
                          <Link href={`/bookings/${b.id}`}>
                            <button style={{ padding:'5px 10px', borderRadius:'6px', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:'11.5px', cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>Open →</button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}

                </div>
              </div>
            )}

            {/* ── DEAL FOLLOW-UPS DUE NOW ─────────────────────── */}
            {actions.length > 0 && (
              <div style={{ order: 1 }}>
                <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:'19px', fontWeight:'300' }}>Follow-ups Due</div>
                  <div style={{ background:'var(--red)', color:'white', borderRadius:'20px', padding:'2px 10px', fontSize:'12px', fontWeight:'700' }}>{actions.length}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {actions.map(deal => {
                    const client     = deal.clients
                    const clientName = client ? `${client.first_name} ${client.last_name}` : 'Unknown'
                    const priority   = priorityLabel(deal.priority_score)
                    const stageCol   = STAGE_COLORS[deal.stage] || 'var(--accent)'
                    const isDueToday = deal.days_overdue === 0
                    const isOverdue  = deal.days_overdue > 0
                    return (
                      <div key={deal.id} className="card" style={{ overflow:'hidden', borderLeft:`3px solid ${stageCol}` }}>
                        <div style={{ padding:'14px 18px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px', flexWrap:'wrap' }}>
                                <span style={{ fontSize:'11px', fontWeight:'700', padding:'2px 8px', borderRadius:'4px', background:priority.bg, color:priority.color }}>{priority.label}</span>
                                <span style={{ fontSize:'11px', fontWeight:'600', color:stageCol, background:`${stageCol}18`, padding:'2px 8px', borderRadius:'4px' }}>{STAGE_LABELS[deal.stage] || deal.stage}</span>
                                {deal.next_activity_type && <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>{ACT_ICONS[deal.next_activity_type]} {deal.next_activity_type.charAt(0) + deal.next_activity_type.slice(1).toLowerCase().replace('_', ' ')}</span>}
                                {isOverdue  && <span style={{ fontSize:'11px', color:'var(--red)',   fontWeight:'600' }}>⚠ {deal.days_overdue}d overdue</span>}
                                {isDueToday && <span style={{ fontSize:'11px', color:'var(--amber)', fontWeight:'600' }}>Due today</span>}
                              </div>
                              <Link href={`/deals/${deal.id}`} style={{ textDecoration:'none' }}>
                                <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', color:'var(--text-primary)', marginBottom:'2px' }}>{deal.title}</div>
                              </Link>
                              <div style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>{clientName}{deal.deal_value ? ` · ${fmt(deal.deal_value)}` : ''}</div>
                            </div>
                            <div style={{ textAlign:'right', marginLeft:'12px', flexShrink:0 }}>
                              <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'4px' }}>Priority score</div>
                              <div style={{ fontFamily:'Fraunces,serif', fontSize:'22px', fontWeight:'300', color:priority.color }}>{deal.priority_score}</div>
                            </div>
                          </div>
                          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', paddingTop:'10px', borderTop:'1px solid var(--border)' }}>
                            {client?.phone && (
                              <>
                                <button onClick={() => copyPhone(client.phone!, deal.id)}
                                  style={{ padding:'6px 12px', borderRadius:'7px', border:'1.5px solid var(--border)', background:copied===deal.id ? 'var(--green-light)' : 'transparent', color:copied===deal.id ? 'var(--green)' : 'var(--text-secondary)', fontSize:'12px', cursor:'pointer', fontFamily:'Outfit,sans-serif', transition:'all 0.15s' }}>
                                  {copied === deal.id ? '✓ Copied' : '📋 Copy Number'}
                                </button>
                                <a href={buildWhatsApp(client.phone, clientName, deal.next_activity_type, deal.title)} target="_blank"
                                  style={{ padding:'6px 12px', borderRadius:'7px', border:'1.5px solid #25d366', background:'#e8f9ef', color:'#1a9e52', fontSize:'12px', cursor:'pointer', fontFamily:'Outfit,sans-serif', textDecoration:'none', display:'inline-flex', alignItems:'center' }}>
                                  💬 WhatsApp
                                </a>
                              </>
                            )}
                            {client?.email && (
                              <a href={buildMailto(client.email, clientName, deal.next_activity_type, deal.title)}
                                style={{ padding:'6px 12px', borderRadius:'7px', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:'12px', cursor:'pointer', fontFamily:'Outfit,sans-serif', textDecoration:'none', display:'inline-flex', alignItems:'center' }}>
                                📧 Email
                              </a>
                            )}
                            <div style={{ flex:1 }}/>
                            <div style={{ display:'flex', gap:'4px' }}>
                              {[1, 3, 7].map(d => (
                                <button key={d} onClick={() => snooze(deal, d)} disabled={snoozing === deal.id}
                                  style={{ padding:'5px 10px', borderRadius:'6px', border:'1px solid var(--border)', background:'transparent', color:'var(--text-muted)', fontSize:'11px', cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>
                                  +{d}d
                                </button>
                              ))}
                            </div>
                            <button onClick={() => markComplete(deal)} disabled={completing === deal.id}
                              style={{ padding:'6px 14px', borderRadius:'7px', border:'none', background:'var(--green)', color:'white', fontSize:'12px', cursor:'pointer', fontFamily:'Outfit,sans-serif', fontWeight:'600' }}>
                              {completing === deal.id ? '…' : '✓ Done'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── UPCOMING THIS WEEK ──────────────────────────── */}
            {upcoming.length > 0 && (
              <div style={{ order: 2 }}>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:'19px', fontWeight:'300', marginBottom:'12px' }}>This Week</div>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {upcoming.map(deal => {
                    const client     = deal.clients
                    const clientName = client ? `${client.first_name} ${client.last_name}` : 'Unknown'
                    const stageCol   = STAGE_COLORS[deal.stage] || 'var(--accent)'
                    const dueDate    = new Date(deal.next_activity_at).toLocaleDateString('en-GB', { weekday:'short', day:'numeric', month:'short' })
                    return (
                      <div key={deal.id} className="card" style={{ padding:'12px 16px', borderLeft:`3px solid ${stageCol}`, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                        <div style={{ flex:1 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'2px' }}>
                            {deal.next_activity_type && <span style={{ fontSize:'12px' }}>{ACT_ICONS[deal.next_activity_type]}</span>}
                            <Link href={`/deals/${deal.id}`} style={{ textDecoration:'none' }}>
                              <span style={{ fontSize:'13.5px', fontWeight:'500', color:'var(--text-primary)' }}>{deal.title}</span>
                            </Link>
                            <span style={{ fontSize:'11px', color:stageCol, fontWeight:'600', background:`${stageCol}18`, padding:'1px 7px', borderRadius:'4px' }}>{STAGE_LABELS[deal.stage] || deal.stage}</span>
                          </div>
                          <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{clientName}{deal.deal_value ? ` · ${fmt(deal.deal_value)}` : ''}</div>
                        </div>
                        <div style={{ display:'flex', gap:'6px', alignItems:'center', marginLeft:'12px', flexShrink:0 }}>
                          <span style={{ fontSize:'12px', color:'var(--text-muted)', fontWeight:'500' }}>{dueDate}</span>
                          {client?.phone && (
                            <a href={buildWhatsApp(client.phone, clientName, deal.next_activity_type, deal.title)} target="_blank"
                              style={{ padding:'4px 10px', borderRadius:'6px', border:'1.5px solid #25d366', background:'#e8f9ef', color:'#1a9e52', fontSize:'11.5px', textDecoration:'none' }}>
                              💬
                            </a>
                          )}
                          {client?.email && (
                            <a href={buildMailto(client.email, clientName, deal.next_activity_type, deal.title)}
                              style={{ padding:'4px 10px', borderRadius:'6px', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:'11.5px', textDecoration:'none' }}>
                              📧
                            </a>
                          )}
                          <Link href={`/deals/${deal.id}`}>
                            <button style={{ padding:'4px 10px', borderRadius:'6px', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-secondary)', fontSize:'11.5px', cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>Open →</button>
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
