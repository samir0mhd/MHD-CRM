'use client'

import { useEffect, useState, useRef, type MouseEvent } from 'react'
import { useRouter } from 'next/navigation'
import { isManager, type StaffUser } from '@/lib/access'
import { authedFetch } from '@/lib/api-client'

// ── TYPES ─────────────────────────────────────────────────
type Booking = {
  id: number
  deal_id: number
  booking_reference: string
  status: string
  staff_id: number | null
  departure_date: string | null
  return_date: string | null
  balance_due_date: string | null
  deposit_received: boolean
  total_sell: number | null
  gross_profit: number | null
  final_profit: number | null
  booking_notes: string | null
  total_passengers: number
  created_at: string
  deals?: {
    id: number
    title: string
    deal_value: number
    staff_id?: number | null
    clients?: {
      id: number
      first_name: string
      last_name: string
      phone: string
      email: string
      owner_staff_id?: number | null
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

function bookingNeedsOwnershipCleanup(booking: Booking) {
  if (booking.status === 'CANCELLED') return false
  const bookingStaffId = booking.staff_id ?? null
  const dealStaffId = booking.deals?.staff_id ?? null
  const clientOwnerId = booking.deals?.clients?.owner_staff_id ?? null
  return !bookingStaffId || bookingStaffId !== dealStaffId || bookingStaffId !== clientOwnerId
}

// ── MAIN PAGE ─────────────────────────────────────────────
export default function BookingsPage() {
  const [bookings, setBookings]         = useState<Booking[]>([])
  const [staffUsers, setStaffUsers]     = useState<StaffUser[]>([])
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(null)
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [staffFilter, setStaffFilter]   = useState<string>('ALL')
  const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'FIX_NEEDED'>('ALL')
  const router                           = useRouter()
  const [toast, setToast]               = useState<string | null>(null)
  const toastTimer                      = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function loadBookings() {
    setLoading(true)
    try {
      const response = await authedFetch('/api/bookings')
      const { data, error } = await response.json()
      if (error) throw error
      setBookings(data || [])
    } catch {
      // network error — bookings list stays empty
    } finally {
      setLoading(false)
    }
  }

  async function loadAccess() {
    const response = await authedFetch('/api/bookings/access')
    const data = await response.json()
    setStaffUsers(data.staffUsers || [])
    setCurrentStaff(data.currentStaff || null)
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadBookings()
      void loadAccess()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

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
    const matchStaff =
      staffFilter === 'ALL' ||
      (staffFilter === 'UNASSIGNED' ? !b.staff_id : b.staff_id === Number(staffFilter))
    const matchOwnership = ownershipFilter === 'ALL' || bookingNeedsOwnershipCleanup(b)
    return matchSearch && matchStatus && matchStaff && matchOwnership
  })

  const totalValue    = bookings.reduce((a, b) => a + (b.total_sell ?? b.deals?.deal_value ?? 0), 0)
  const departingSoon = bookings.filter(b => { const d = daysUntil(b.departure_date); return d !== null && d >= 0 && d <= 30 }).length
  const unassignedCount = bookings.filter(b => !b.staff_id).length
  const cleanupCount = bookings.filter(bookingNeedsOwnershipCleanup).length

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
          <select className="input" style={{ width: '180px' }} value={ownershipFilter} onChange={e => setOwnershipFilter(e.target.value as 'ALL' | 'FIX_NEEDED')}>
            <option value="ALL">All ownership</option>
            <option value="FIX_NEEDED">Needs cleanup</option>
          </select>
          <select className="input" style={{ width: '190px' }} value={staffFilter} onChange={e => setStaffFilter(e.target.value)}>
            <option value="ALL">All consultants</option>
            <option value="UNASSIGNED">Unassigned only</option>
            {staffUsers.map(staff => <option key={staff.id} value={String(staff.id)}>{staff.name}</option>)}
          </select>
          <input className="input" style={{ width: '260px' }}
            placeholder="Search ref, surname, deal…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      <div className="page-body">
        {cleanupCount > 0 && (
          <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', border: '1px solid #fdba74', background: '#fff7ed', display:'flex', justifyContent:'space-between', gap:'12px', flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ fontSize:'12.5px', color:'#9a3412', lineHeight:1.5 }}>
              {cleanupCount} live booking{cleanupCount === 1 ? '' : 's'} need ownership cleanup. Use the inline manager control to realign client, deal, and booking together so commission and future reporting stay clean.
            </div>
            {ownershipFilter !== 'FIX_NEEDED' && (
              <button className="btn btn-secondary btn-xs" onClick={() => setOwnershipFilter('FIX_NEEDED')}>Show Cleanup Only</button>
            )}
          </div>
        )}

        {/* KPI Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total Bookings',    val: bookings.length,              color: 'var(--accent-mid)',  sub: 'all time' },
            { label: 'Total Value',       val: fmt(totalValue),              color: 'var(--green)',       sub: 'confirmed bookings' },
            { label: 'Departing Soon',    val: departingSoon,                color: 'var(--amber)',       sub: 'within 30 days' },
            { label: 'Unassigned',        val: unassignedCount,              color: unassignedCount > 0 ? 'var(--red)' : 'var(--green)', sub: 'missing consultant' },
            { label: 'Needs Cleanup',     val: cleanupCount,                 color: cleanupCount > 0 ? 'var(--amber)' : 'var(--green)', sub: 'owner mismatch' },
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
                  {['Ref', 'Client', 'Deal / Hotel', 'Consultant', 'Departure', 'Return', 'Balance Due', 'Value', 'Progress', 'Status', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: '11px', fontWeight: '600',
                      textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((booking) => {
                  const client        = booking.deals?.clients
                  const tasks         = booking.booking_tasks || []
                  const progress      = taskProgress(tasks)
                  const depDays       = daysUntil(booking.departure_date)
                  const balDays       = daysUntil(booking.balance_due_date)
                  const balancePaid   = tasks.some((t: BookingTask) => t.task_key === 'balance_received' && t.is_done)
                  const cfg           = STATUS_CONFIG[booking.status] || STATUS_CONFIG.CONFIRMED
                  const consultant = staffUsers.find(staff => staff.id === booking.staff_id)
                  const needsCleanup = bookingNeedsOwnershipCleanup(booking)

                  return (
                    <tr key={booking.id}
                      style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.12s' }}
                      onClick={() => router.push(`/bookings/${booking.id}`)}
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

                      {/* Consultant */}
                      <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                        {consultant ? (
                          <div>
                            <div style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>{consultant.name}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{consultant.role || 'staff'}</div>
                            {needsCleanup && (
                              <div style={{ fontSize:'10.5px', color:'var(--amber)', fontWeight:'600', marginTop:'2px' }}>Needs realign</div>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'11.5px', fontWeight:'600', color:'var(--red)', background:'#fef2f2', border:'1px solid #fecaca', borderRadius:'999px', padding:'4px 10px' }}>
                              Unassigned
                            </span>
                            {needsCleanup && <div style={{ fontSize:'10.5px', color:'var(--amber)', fontWeight:'600', marginTop:'6px' }}>Needs realign</div>}
                          </div>
                        )}
                        {isManager(currentStaff) && needsCleanup && (
                          <OwnershipQuickFix
                            booking={booking}
                            staffUsers={staffUsers}
                            currentStaff={currentStaff}
                            onSaved={loadBookings}
                            showToast={showToast}
                          />
                        )}
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
                            <div style={{ fontSize: '13px', color: !balancePaid && balDays !== null && balDays <= 14 ? 'var(--red)' : 'var(--text-primary)' }}>
                              {fmtDate(booking.balance_due_date, { day: 'numeric', month: 'short' })}
                            </div>
                            {balancePaid ? (
                              <div style={{ fontSize: '11px', color: 'var(--green)', fontWeight: '500' }}>Paid ✓</div>
                            ) : balDays !== null && balDays >= 0 && (
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
                          {fmt(booking.total_sell ?? booking.deals?.deal_value ?? 0)}
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

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function OwnershipQuickFix({ booking, staffUsers, currentStaff, onSaved, showToast }: {
  booking: Booking
  staffUsers: StaffUser[]
  currentStaff: StaffUser | null
  onSaved: () => Promise<void>
  showToast: (msg: string) => void
}) {
  const [selectedStaffId, setSelectedStaffId] = useState(
    String(booking.staff_id || booking.deals?.staff_id || booking.deals?.clients?.owner_staff_id || '')
  )
  const [saving, setSaving] = useState(false)

  async function alignOwnership(e: MouseEvent<HTMLButtonElement>) {
    e.stopPropagation()
    if (!selectedStaffId || !isManager(currentStaff)) return
    const nextStaffId = Number(selectedStaffId)

    setSaving(true)
    try {
      const response = await authedFetch(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_ownership',
          staffId: nextStaffId,
        }),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.message)

      await onSaved()
      showToast('Ownership realigned ✓')
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to align ownership')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div onClick={e => e.stopPropagation()} style={{ display:'flex', gap:'6px', alignItems:'center', marginTop:'8px' }}>
      <select
        className="input"
        value={selectedStaffId}
        onChange={e => setSelectedStaffId(e.target.value)}
        style={{ width:'170px', fontSize:'11.5px', padding:'4px 8px' }}
      >
        <option value="">Select consultant…</option>
        {staffUsers.map(staff => (
          <option key={staff.id} value={staff.id}>{staff.name}</option>
        ))}
      </select>
      <button className="btn btn-secondary btn-xs" onClick={alignOwnership} disabled={saving || !selectedStaffId}>
        {saving ? 'Saving…' : 'Align'}
      </button>
    </div>
  )
}
