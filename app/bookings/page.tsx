'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ── TYPES ─────────────────────────────────────────────────
type Booking = {
  id: number
  deal_id: number
  booking_reference: string
  status: string
  departure_date: string | null
  return_date: string | null
  balance_due_date: string | null
  deposit_received: boolean
  final_profit: number | null
  booking_notes: string | null
  total_passengers: number
  created_at: string
  deals?: {
    id: number
    title: string
    deal_value: number
    clients?: {
      id: number
      first_name: string
      last_name: string
      phone: string
      email: string
    }
  }
  booking_tasks?: BookingTask[]
  booking_passengers?: Passenger[]
}

type BookingTask = {
  id: number
  booking_id: number
  task_name: string
  task_key: string
  category: string
  sort_order: number
  is_done: boolean
  completed_at: string | null
  notes: string | null
  due_date: string | null
}

type Passenger = {
  id: number
  booking_id: number
  title: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  passenger_type: string
  is_lead: boolean
  passport_number: string | null
  passport_expiry: string | null
}

// ── TASK TEMPLATE ──────────────────────────────────────────
const TASK_TEMPLATE = [
  // Financial
  { key: 'deposit_received',       name: 'Deposit received',              category: 'Financial',     sort: 1  },
  { key: 'balance_due_set',        name: 'Balance due date set',          category: 'Financial',     sort: 2  },
  { key: 'balance_chased',         name: 'Balance payment chased',        category: 'Financial',     sort: 3  },
  { key: 'balance_received',       name: 'Balance payment received',      category: 'Financial',     sort: 4  },
  { key: 'final_costing',          name: 'Final costing confirmed',       category: 'Financial',     sort: 5  },
  // Flights
  { key: 'flights_ticketed',       name: 'Flights ticketed',              category: 'Flights',       sort: 6  },
  { key: 'ticket_numbers',         name: 'Ticket numbers recorded',       category: 'Flights',       sort: 7  },
  { key: 'etickets_sent',          name: 'E-tickets sent to client',      category: 'Flights',       sort: 8  },
  // Accommodation
  { key: 'hotel_confirmation',     name: 'Hotel confirmation received',   category: 'Accommodation', sort: 9  },
  { key: 'rooming_list',           name: 'Hotel rooming list sent',       category: 'Accommodation', sort: 10 },
  { key: 'special_requests',       name: 'Special requests confirmed',    category: 'Accommodation', sort: 11 },
  // Transfers
  { key: 'transfers_booked',       name: 'Transfers booked with DMC',    category: 'Transfers',     sort: 12 },
  { key: 'transfer_confirmation',  name: 'Transfer confirmation received',category: 'Transfers',     sort: 13 },
  { key: 'arrival_details_sent',   name: 'Arrival details sent to DMC',  category: 'Transfers',     sort: 14 },
  // Documents
  { key: 'booking_confirmation',   name: 'Booking confirmation sent',    category: 'Documents',     sort: 15 },
  { key: 'travel_docs',            name: 'Travel documents issued',      category: 'Documents',     sort: 16 },
  { key: 'welcome_pack',           name: 'Welcome pack sent',            category: 'Documents',     sort: 17 },
  { key: 'atol_certificate',       name: 'ATOL certificate issued',      category: 'Documents',     sort: 18 },
  // Pre-departure
  { key: 'predeparture_call',      name: 'Pre-departure call made',      category: 'Pre-Departure', sort: 19 },
  { key: 'emergency_contact',      name: 'Emergency contact confirmed',  category: 'Pre-Departure', sort: 20 },
  // Post-trip
  { key: 'welcome_back_call',      name: 'Welcome back call made',       category: 'Post-Trip',     sort: 21 },
  { key: 'review_requested',       name: 'Review requested (Trustpilot)',category: 'Post-Trip',     sort: 22 },
  { key: 'rebook_conversation',    name: 'Re-booking conversation started',category: 'Post-Trip',   sort: 23 },
]

const CATEGORY_ICONS: Record<string, string> = {
  Financial: '💷', Flights: '✈', Accommodation: '🏨',
  Transfers: '🚗', Documents: '📄', 'Pre-Departure': '📞', 'Post-Trip': '🌟',
}

const CATEGORY_COLORS: Record<string, string> = {
  Financial: '#10b981', Flights: '#3b82f6', Accommodation: '#8b5cf6',
  Transfers: '#f97316', Documents: '#f59e0b', 'Pre-Departure': '#ec4899', 'Post-Trip': '#14b8a6',
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  CONFIRMED:   { label: 'Confirmed',   color: '#10b981', bg: '#e6f4ee' },
  PENDING:     { label: 'Pending',     color: '#f59e0b', bg: '#fdf0e0' },
  CANCELLED:   { label: 'Cancelled',   color: '#ef4444', bg: '#fdeaea' },
  COMPLETED:   { label: 'Completed',   color: '#6366f1', bg: '#eef2ff' },
}

// ── HELPERS ───────────────────────────────────────────────
function fmt(n: number) {
  return '£' + (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

function daysUntil(dateStr: string | null) {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
}

function fmtDate(dateStr: string | null, opts?: Intl.DateTimeFormatOptions) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-GB', opts || { day: 'numeric', month: 'short', year: 'numeric' })
}

function taskProgress(tasks: BookingTask[]) {
  if (!tasks?.length) return 0
  return Math.round((tasks.filter(t => t.is_done).length / tasks.length) * 100)
}

// ── MAIN PAGE ─────────────────────────────────────────────
export default function BookingsPage() {
  const [bookings, setBookings]         = useState<Booking[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selectedBooking, setSelected]  = useState<Booking | null>(null)
  const [toast, setToast]               = useState<string | null>(null)
  const toastTimer                      = useRef<any>(null)

  useEffect(() => { loadBookings() }, [])

  async function loadBookings() {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select(`
        *,
        deals(id, title, deal_value, clients(id, first_name, last_name, phone, email)),
        booking_tasks(*),
        booking_passengers(*)
      `)
      .order('departure_date', { ascending: true })
    setBookings(data || [])
    setLoading(false)
  }

  function showToast(msg: string) {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }

  const filtered = bookings.filter(b => {
    const client = b.deals?.clients
    const q = search.toLowerCase()
    const matchSearch = !q ||
      b.booking_reference?.toLowerCase().includes(q) ||
      b.deals?.title?.toLowerCase().includes(q) ||
      client?.first_name?.toLowerCase().includes(q) ||
      client?.last_name?.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'ALL' || b.status === statusFilter
    return matchSearch && matchStatus
  })

  const totalValue    = bookings.reduce((a, b) => a + (b.deals?.deal_value || 0), 0)
  const totalProfit   = bookings.reduce((a, b) => a + (b.final_profit || 0), 0)
  const departingSoon = bookings.filter(b => { const d = daysUntil(b.departure_date); return d !== null && d >= 0 && d <= 30 }).length
  const balanceDue    = bookings.filter(b => { const d = daysUntil(b.balance_due_date); return d !== null && d >= 0 && d <= 14 && !b.deposit_received }).length

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading bookings…</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Bookings</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {bookings.length} bookings · {fmt(totalValue)} total value
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input className="input" style={{ width: '260px' }}
            placeholder="Search ref, surname, deal…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="page-body">

        {/* KPI Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total Bookings',    val: bookings.length,              color: 'var(--accent-mid)',  sub: 'all time' },
            { label: 'Total Value',       val: fmt(totalValue),              color: 'var(--green)',       sub: 'confirmed bookings' },
            { label: 'Departing Soon',    val: departingSoon,                color: 'var(--amber)',       sub: 'within 30 days' },
            { label: 'Balance Due',       val: balanceDue,                   color: 'var(--red)',         sub: 'within 14 days' },
          ].map(s => (
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color, fontSize: '28px' }}>{s.val}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* Status filters */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '18px', flexWrap: 'wrap' }}>
          {['ALL', 'CONFIRMED', 'PENDING', 'COMPLETED', 'CANCELLED'].map(s => {
            const cfg = s === 'ALL' ? null : STATUS_CONFIG[s]
            const active = statusFilter === s
            const count = s === 'ALL' ? bookings.length : bookings.filter(b => b.status === s).length
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                style={{ padding: '5px 14px', borderRadius: '20px', border: '1.5px solid', fontSize: '12.5px', cursor: 'pointer',
                  borderColor: active ? (cfg?.color || 'var(--accent)') : 'var(--border)',
                  background: active ? (cfg?.bg || 'var(--accent-light)') : 'transparent',
                  color: active ? (cfg?.color || 'var(--accent)') : 'var(--text-muted)' }}>
                {s === 'ALL' ? 'All' : cfg?.label} ({count})
              </button>
            )
          })}
        </div>

        {/* Bookings table */}
        {filtered.length === 0 ? (
          <div className="card empty-state">
            <div style={{ fontSize: '32px' }}>✦</div>
            <div className="empty-state-title">{search ? 'No bookings match' : 'No bookings yet'}</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {search ? 'Try a different search' : 'Bookings appear here when deals are marked as Booked'}
            </div>
          </div>
        ) : (
          <div className="card" style={{ overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-tertiary)', borderBottom: '1px solid var(--border)' }}>
                  {['Ref', 'Client', 'Deal / Hotel', 'Departure', 'Return', 'Balance Due', 'Value', 'Progress', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600',
                      textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking, i) => {
                  const client   = booking.deals?.clients
                  const tasks    = booking.booking_tasks || []
                  const progress = taskProgress(tasks)
                  const depDays  = daysUntil(booking.departure_date)
                  const balDays  = daysUntil(booking.balance_due_date)
                  const cfg      = STATUS_CONFIG[booking.status] || STATUS_CONFIG.CONFIRMED

                  return (
                    <tr key={booking.id}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s' }}
                      onClick={() => setSelected(booking)}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

                      {/* Ref */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ fontFamily: 'monospace', fontWeight: '700', color: 'var(--accent)', fontSize: '14px' }}>
                          {booking.booking_reference || '—'}
                        </span>
                      </td>

                      {/* Client */}
                      <td style={{ padding: '12px 14px' }}>
                        {client ? (
                          <div>
                            <div style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--text-primary)' }}>
                              {client.first_name} {client.last_name}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{client.phone}</div>
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>}
                      </td>

                      {/* Deal */}
                      <td style={{ padding: '12px 14px', maxWidth: '200px' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {booking.deals?.title || '—'}
                        </div>
                      </td>

                      {/* Departure */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-primary)' }}>{fmtDate(booking.departure_date)}</div>
                        {depDays !== null && depDays >= 0 && (
                          <div style={{ fontSize: '11px', color: depDays <= 7 ? 'var(--red)' : depDays <= 30 ? 'var(--amber)' : 'var(--text-muted)', fontWeight: '500' }}>
                            {depDays === 0 ? 'Today!' : depDays === 1 ? 'Tomorrow' : `${depDays}d away`}
                          </div>
                        )}
                      </td>

                      {/* Return */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{fmtDate(booking.return_date)}</div>
                      </td>

                      {/* Balance due */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {booking.balance_due_date ? (
                          <div>
                            <div style={{ fontSize: '13px', color: balDays !== null && balDays <= 14 ? 'var(--red)' : 'var(--text-primary)' }}>
                              {fmtDate(booking.balance_due_date, { day: 'numeric', month: 'short' })}
                            </div>
                            {balDays !== null && balDays >= 0 && (
                              <div style={{ fontSize: '11px', color: balDays <= 14 ? 'var(--red)' : 'var(--text-muted)', fontWeight: '500' }}>
                                {balDays === 0 ? 'Due today!' : `${balDays}d`}
                              </div>
                            )}
                          </div>
                        ) : <span style={{ color: 'var(--text-muted)', fontSize: '13px' }}>—</span>}
                      </td>

                      {/* Value */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ fontSize: '13.5px', fontWeight: '500', color: 'var(--green)' }}>
                          {fmt(booking.deals?.deal_value || 0)}
                        </div>
                      </td>

                      {/* Progress */}
                      <td style={{ padding: '12px 14px', minWidth: '100px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ flex: 1, height: '5px', background: 'var(--border)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', width: `${progress}%`, background: progress === 100 ? 'var(--green)' : 'var(--accent)', borderRadius: '3px', transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{progress}%</span>
                        </div>
                        <div style={{ fontSize: '10.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {tasks.filter(t => t.is_done).length}/{tasks.length} tasks
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: '500', background: cfg.bg, color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </td>

                      {/* Open */}
                      <td style={{ padding: '12px 14px' }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '16px' }}>→</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Booking detail panel */}
      {selectedBooking && (
        <BookingDetailPanel
          booking={selectedBooking}
          onClose={() => setSelected(null)}
          onRefresh={() => { loadBookings(); setSelected(null) }}
          showToast={showToast}
        />
      )}

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

// ── BOOKING DETAIL PANEL ───────────────────────────────────
function BookingDetailPanel({ booking, onClose, onRefresh, showToast }: {
  booking: Booking
  onClose: () => void
  onRefresh: () => void
  showToast: (msg: string) => void
}) {
  const [tasks, setTasks]               = useState<BookingTask[]>(booking.booking_tasks || [])
  const [passengers, setPassengers]     = useState<Passenger[]>(booking.booking_passengers || [])
  const [tab, setTab]                   = useState<'tasks' | 'passengers' | 'financials' | 'notes'>('tasks')
  const [saving, setSaving]             = useState(false)
  const [showAddPax, setShowAddPax]     = useState(false)
  const [bookingNotes, setBookingNotes] = useState(booking.booking_notes || '')
  const [editingNotes, setEditingNotes] = useState(false)

  const client   = booking.deals?.clients
  const depDays  = daysUntil(booking.departure_date)
  const balDays  = daysUntil(booking.balance_due_date)
  const progress = taskProgress(tasks)
  const cfg      = STATUS_CONFIG[booking.status] || STATUS_CONFIG.CONFIRMED

  // Initialize tasks if none exist
  useEffect(() => {
    if (tasks.length === 0) initializeTasks()
  }, [])

  async function initializeTasks() {
    const inserts = TASK_TEMPLATE.map(t => ({
      booking_id: booking.id,
      task_name:  t.name,
      task_key:   t.key,
      category:   t.category,
      sort_order: t.sort,
      is_done:    false,
    }))
    const { data } = await supabase.from('booking_tasks').insert(inserts).select()
    if (data) setTasks(data)
  }

  async function toggleTask(task: BookingTask) {
    const newDone = !task.is_done
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, is_done: newDone, completed_at: newDone ? new Date().toISOString() : null } : t))
    await supabase.from('booking_tasks').update({
      is_done: newDone,
      completed_at: newDone ? new Date().toISOString() : null,
    }).eq('id', task.id)
  }

  async function saveNotes() {
    await supabase.from('bookings').update({ booking_notes: bookingNotes }).eq('id', booking.id)
    setEditingNotes(false)
    showToast('Notes saved')
  }

  async function updateStatus(status: string) {
    await supabase.from('bookings').update({ status }).eq('id', booking.id)
    showToast(`Status updated to ${STATUS_CONFIG[status]?.label}`)
    onRefresh()
  }

  // Group tasks by category
  const tasksByCategory = TASK_TEMPLATE.reduce((acc, tmpl) => {
    if (!acc[tmpl.category]) acc[tmpl.category] = []
    const task = tasks.find(t => t.task_key === tmpl.key)
    if (task) acc[tmpl.category].push(task)
    return acc
  }, {} as Record<string, BookingTask[]>)

  const TABS = [
    { key: 'tasks',      label: `Tasks (${tasks.filter(t => t.is_done).length}/${tasks.length})` },
    { key: 'passengers', label: `Passengers (${passengers.length})` },
    { key: 'financials', label: 'Financials' },
    { key: 'notes',      label: 'Notes' },
  ] as const

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,14,13,0.55)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', justifyContent: 'flex-end' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{ width: '560px', background: 'var(--surface)', height: '100vh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column' }}>

        {/* Panel header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, background: 'var(--surface)', zIndex: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontFamily: 'monospace', fontWeight: '800', fontSize: '20px', color: 'var(--accent)' }}>
                  {booking.booking_reference}
                </span>
                <span style={{ padding: '3px 10px', borderRadius: '20px', fontSize: '11.5px', fontWeight: '500', background: cfg.bg, color: cfg.color }}>
                  {cfg.label}
                </span>
              </div>
              <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '18px', color: 'var(--text-primary)', marginBottom: '2px' }}>
                {booking.deals?.title || '—'}
              </div>
              {client && (
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                  {client.first_name} {client.last_name}
                  {client.phone && ` · ${client.phone}`}
                </div>
              )}
            </div>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>✕</button>
          </div>

          {/* Quick stats bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
            {[
              { label: 'Departure', val: fmtDate(booking.departure_date, { day: 'numeric', month: 'short', year: 'numeric' }), sub: depDays !== null && depDays >= 0 ? `${depDays}d away` : 'Past', color: depDays !== null && depDays <= 7 ? 'var(--red)' : 'var(--text-muted)' },
              { label: 'Return', val: fmtDate(booking.return_date, { day: 'numeric', month: 'short', year: 'numeric' }), sub: '', color: 'var(--text-muted)' },
              { label: 'Balance Due', val: fmtDate(booking.balance_due_date, { day: 'numeric', month: 'short' }), sub: balDays !== null && balDays >= 0 ? `${balDays}d` : 'Overdue', color: balDays !== null && balDays <= 14 ? 'var(--red)' : 'var(--text-muted)' },
            ].map(s => (
              <div key={s.label} style={{ background: 'var(--bg-tertiary)', borderRadius: '8px', padding: '8px 12px' }}>
                <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '3px' }}>{s.label}</div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>{s.val}</div>
                {s.sub && <div style={{ fontSize: '11px', color: s.color, fontWeight: '500' }}>{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '5px' }}>
              <span>Booking progress</span>
              <span style={{ fontWeight: '600', color: progress === 100 ? 'var(--green)' : 'var(--text-primary)' }}>{progress}%</span>
            </div>
            <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${progress}%`, borderRadius: '4px', transition: 'width 0.4s', background: progress === 100 ? 'var(--green)' : progress >= 60 ? 'var(--accent)' : progress >= 30 ? 'var(--amber)' : 'var(--red)' }} />
            </div>
          </div>

          {/* Quick actions */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {client?.phone && (
              <>
                <a href={`tel:${client.phone}`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>📞 Call</a>
                <a href={`https://wa.me/${client.phone.replace(/\D/g, '')}`} target="_blank" className="btn btn-sm btn-sm"
                  style={{ textDecoration: 'none', background: '#e8f9ef', color: '#1a9e52', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', padding: '5px 11px', borderRadius: '6px', fontSize: '12px', fontWeight: '500', fontFamily: 'DM Sans, sans-serif' }}>
                  💬 WhatsApp
                </a>
              </>
            )}
            <Link href={`/deals/${booking.deal_id}`} className="btn btn-secondary btn-sm" style={{ textDecoration: 'none' }}>
              Open Deal →
            </Link>
            <select className="input" style={{ padding: '5px 10px', fontSize: '12px', width: 'auto' }}
              value={booking.status} onChange={e => updateStatus(e.target.value)}>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ padding: '0 24px', borderBottom: '1px solid var(--border)', display: 'flex', gap: '0' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '12px 16px', border: 'none', background: 'transparent', fontSize: '13px', cursor: 'pointer', whiteSpace: 'nowrap',
                color: tab === t.key ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: tab === t.key ? '500' : '400',
                borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom: '-1px' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div style={{ padding: '20px 24px', flex: 1 }}>

          {/* TASKS TAB */}
          {tab === 'tasks' && (
            <div>
              {tasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                  <div style={{ marginBottom: '12px' }}>Initialising tasks…</div>
                </div>
              ) : (
                Object.entries(tasksByCategory).map(([category, catTasks]) => {
                  if (catTasks.length === 0) return null
                  const catDone = catTasks.filter(t => t.is_done).length
                  const catColor = CATEGORY_COLORS[category] || 'var(--accent)'
                  return (
                    <div key={category} style={{ marginBottom: '20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                        <span style={{ fontSize: '16px' }}>{CATEGORY_ICONS[category]}</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.07em', color: catColor }}>
                          {category}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>
                          {catDone}/{catTasks.length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {catTasks.map(task => (
                          <div key={task.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px',
                              background: task.is_done ? 'var(--green-light)' : 'var(--bg-tertiary)',
                              border: '1px solid', borderColor: task.is_done ? 'var(--green)' + '44' : 'var(--border)',
                              cursor: 'pointer', transition: 'all 0.15s' }}
                            onClick={() => toggleTask(task)}>
                            <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid',
                              borderColor: task.is_done ? 'var(--green)' : 'var(--border)',
                              background: task.is_done ? 'var(--green)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: 'white', fontSize: '11px', flexShrink: 0, transition: 'all 0.15s' }}>
                              {task.is_done ? '✓' : ''}
                            </div>
                            <span style={{ fontSize: '13.5px', color: task.is_done ? 'var(--green)' : 'var(--text-primary)',
                              textDecoration: task.is_done ? 'line-through' : 'none', flex: 1,
                              opacity: task.is_done ? 0.75 : 1 }}>
                              {task.task_name}
                            </span>
                            {task.completed_at && (
                              <span style={{ fontSize: '10.5px', color: 'var(--green)', whiteSpace: 'nowrap' }}>
                                {new Date(task.completed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* PASSENGERS TAB */}
          {tab === 'passengers' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{passengers.length} passenger{passengers.length !== 1 ? 's' : ''}</div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAddPax(true)}>+ Add Passenger</button>
              </div>

              {passengers.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '24px', marginBottom: '10px' }}>👥</div>
                  <div style={{ fontSize: '13px', marginBottom: '14px' }}>No passengers added yet</div>
                  <button className="btn btn-primary btn-sm" onClick={() => setShowAddPax(true)}>Add first passenger</button>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {passengers.map(pax => (
                    <div key={pax.id} className="card" style={{ padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '16px', color: 'var(--text-primary)', flex: 1 }}>
                          {pax.title} {pax.first_name} {pax.last_name}
                        </div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {pax.is_lead && (
                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--accent-light)', color: 'var(--accent)', fontWeight: '500' }}>Lead</span>
                          )}
                          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>{pax.passenger_type}</span>
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {pax.date_of_birth && <span>DOB: {fmtDate(pax.date_of_birth)}</span>}
                        {pax.passport_number && <span>Passport: {pax.passport_number}</span>}
                        {pax.passport_expiry && <span>Expires: {fmtDate(pax.passport_expiry)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {showAddPax && (
                <AddPassengerForm
                  bookingId={booking.id}
                  onSaved={async () => {
                    const { data } = await supabase.from('booking_passengers').select('*').eq('booking_id', booking.id)
                    setPassengers(data || [])
                    setShowAddPax(false)
                    showToast('Passenger added ✓')
                  }}
                  onCancel={() => setShowAddPax(false)}
                />
              )}
            </div>
          )}

          {/* FINANCIALS TAB */}
          {tab === 'financials' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'Total Holiday Value', val: fmt(booking.deals?.deal_value || 0), color: 'var(--green)', large: true },
                { label: 'Final Profit', val: booking.final_profit ? fmt(booking.final_profit) : 'Not set', color: 'var(--gold)', large: true },
                { label: 'Deposit Received', val: booking.deposit_received ? '✓ Yes' : '✗ Pending', color: booking.deposit_received ? 'var(--green)' : 'var(--red)', large: false },
                { label: 'Balance Due Date', val: fmtDate(booking.balance_due_date), color: balDays !== null && balDays <= 14 ? 'var(--red)' : 'var(--text-primary)', large: false },
              ].map(f => (
                <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', background: 'var(--bg-tertiary)', borderRadius: '10px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>{f.label}</span>
                  <span style={{ fontFamily: f.large ? 'Instrument Serif, serif' : 'DM Sans, sans-serif', fontSize: f.large ? '22px' : '14px', fontWeight: f.large ? '400' : '500', color: f.color }}>{f.val}</span>
                </div>
              ))}

              {/* Balance due urgency alert */}
              {balDays !== null && balDays <= 14 && balDays >= 0 && (
                <div style={{ background: 'var(--red-light)', border: '1px solid var(--red)', borderRadius: '10px', padding: '14px 16px', display: 'flex', gap: '10px' }}>
                  <span style={{ fontSize: '20px' }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: '13.5px', fontWeight: '600', color: 'var(--red)', marginBottom: '2px' }}>Balance due in {balDays} day{balDays !== 1 ? 's' : ''}</div>
                    <div style={{ fontSize: '12.5px', color: 'var(--red)' }}>Contact client to arrange payment before {fmtDate(booking.balance_due_date)}</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* NOTES TAB */}
          {tab === 'notes' && (
            <div>
              {editingNotes ? (
                <div>
                  <textarea className="input" style={{ minHeight: '200px', resize: 'vertical', marginBottom: '12px' }}
                    value={bookingNotes} onChange={e => setBookingNotes(e.target.value)}
                    placeholder="Booking notes, special requests, important information…" />
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="btn btn-primary btn-sm" onClick={saveNotes}>Save Notes</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setEditingNotes(false)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditingNotes(true)}>Edit Notes</button>
                  </div>
                  {bookingNotes ? (
                    <div style={{ background: 'var(--gold-light)', borderRadius: '10px', padding: '16px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.7', whiteSpace: 'pre-wrap', border: '1px solid var(--border)' }}>
                      {bookingNotes}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                      <div style={{ fontSize: '24px', marginBottom: '10px' }}>📝</div>
                      No notes yet
                      <div style={{ marginTop: '12px' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingNotes(true)}>Add Notes</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── ADD PASSENGER FORM ─────────────────────────────────────
function AddPassengerForm({ bookingId, onSaved, onCancel }: {
  bookingId: number
  onSaved: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    title: 'Mr', first_name: '', last_name: '',
    date_of_birth: '', passenger_type: 'Adult',
    is_lead: false, passport_number: '', passport_expiry: '',
  })
  const [saving, setSaving] = useState(false)
  const up = (f: string, v: any) => setForm(p => ({ ...p, [f]: v }))

  async function save() {
    if (!form.first_name.trim()) return
    setSaving(true)
    await supabase.from('booking_passengers').insert({
      booking_id:      bookingId,
      title:           form.title,
      first_name:      form.first_name.trim(),
      last_name:       form.last_name.trim(),
      date_of_birth:   form.date_of_birth || null,
      passenger_type:  form.passenger_type,
      is_lead:         form.is_lead,
      passport_number: form.passport_number || null,
      passport_expiry: form.passport_expiry || null,
    })
    setSaving(false)
    onSaved()
  }

  return (
    <div style={{ marginTop: '20px', padding: '18px', background: 'var(--bg-tertiary)', borderRadius: '12px', border: '1px solid var(--border)' }}>
      <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '16px', marginBottom: '14px' }}>Add Passenger</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <div>
          <label className="label">Title</label>
          <select className="input" style={{ width: '70px' }} value={form.title} onChange={e => up('title', e.target.value)}>
            {['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Prof'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">First Name *</label>
          <input className="input" placeholder="John" value={form.first_name} onChange={e => up('first_name', e.target.value)} />
        </div>
        <div>
          <label className="label">Last Name</label>
          <input className="input" placeholder="Smith" value={form.last_name} onChange={e => up('last_name', e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
        <div>
          <label className="label">Date of Birth</label>
          <input className="input" type="date" value={form.date_of_birth} onChange={e => up('date_of_birth', e.target.value)} />
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" value={form.passenger_type} onChange={e => up('passenger_type', e.target.value)}>
            {['Adult', 'Child', 'Infant'].map(t => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Passport Number</label>
          <input className="input" placeholder="123456789" value={form.passport_number} onChange={e => up('passport_number', e.target.value)} />
        </div>
        <div>
          <label className="label">Passport Expiry</label>
          <input className="input" type="date" value={form.passport_expiry} onChange={e => up('passport_expiry', e.target.value)} />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <input type="checkbox" id="islead" checked={form.is_lead} onChange={e => up('is_lead', e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
        <label htmlFor="islead" style={{ fontSize: '13.5px', color: 'var(--text-secondary)', cursor: 'pointer' }}>Lead passenger</label>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !form.first_name.trim()}>
          {saving ? 'Saving…' : 'Add Passenger'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}
