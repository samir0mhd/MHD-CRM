'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { isManager, type StaffUser } from '@/lib/access'
import Link from 'next/link'
import { authedFetch } from '@/lib/api-client'
import DateInput from '@/app/components/DateInput'

// ── TYPES ────────────────────────────────────────────────────
type Booking = {
  id: number
  booking_reference: string
  deal_id: number
  status: string
  booking_status: string | null
  departure_date: string | null
  return_date: string | null
  balance_due_date: string | null
  deposit_received: boolean
  destination: string | null
  total_sell: number | null
  total_net: number | null
  gross_profit: number | null
  discount: number | null
  final_profit: number | null
  booking_notes: string | null
  cc_surcharge: number | null
  balance_cleared_at: string | null
  staff_id: number | null
  created_at: string
  cancellation_type: 'deposit_only' | 'post_payment' | 'tickets_issued' | null
  cancellation_date: string | null
  cancellation_actioned_by: string | null
  cancellation_checklist: Record<string, boolean> | null
  cancellation_notes: string | null
  originating_quote_ref: string | null
  originating_quote_id: number | null
  deals?: { id: number; title: string; deal_value: number; staff_id?: number | null; clients?: Client; activities?: Activity[] }
}
type Activity = {
  id: number
  deal_id: number
  activity_type: string
  notes: string | null
  created_at: string
}
type Client = { id: number; first_name: string; last_name: string; phone: string; email: string; owner_staff_id?: number | null }
type Passenger = {
  id: number; booking_id: number; title: string; first_name: string; last_name: string
  date_of_birth: string | null; passenger_type: string; is_lead: boolean
  passport_number: string | null; passport_expiry: string | null
}
type Flight = {
  id: number; booking_id: number; direction: string; leg_order: number; segment_id: number | null
  flight_number: string | null; airline: string | null; origin: string | null; destination: string | null
  departure_date: string | null; departure_time: string | null
  arrival_date: string | null; arrival_time: string | null; next_day: boolean
  cabin_class: string; pnr: string | null; flight_supplier: string | null
  net_cost: number | null; baggage_notes: string | null; cabin_notes: string | null
  terminal: string | null; ticketing_deadline: string | null
}
type Accommodation = {
  id: number; booking_id: number; stay_order: number
  hotel_id: number | null; hotel_name: string | null; supplier_id: number | null
  hotel_confirmation: string | null; checkin_date: string | null; checkout_date: string | null
  nights: number | null; room_type: string | null; room_quantity: number; board_basis: string | null
  adults: number; children: number; infants: number; net_cost: number | null
  special_occasion: string | null; special_requests: string | null
  reservation_status: string; reservation_sent_at: string | null; reservation_email_to: string | null
}
type Transfer = {
  id: number; booking_id: number; supplier_id: number | null; supplier_name: string | null
  transfer_type: string; meet_greet: boolean; local_rep: boolean
  arrival_date: string | null; arrival_time: string | null; arrival_flight: string | null
  departure_date: string | null; departure_time: string | null; departure_flight: string | null
  inter_hotel_dates: string | null; net_cost: number | null; notes: string | null
  confirmation_reference: string | null
}
type Extra = {
  id: number; booking_id: number; extra_type: string | null; description: string | null
  supplier: string | null; net_cost: number | null; notes: string | null
}
type Payment = {
  id: number; booking_id: number; amount: number; payment_date: string
  debit_card: number; credit_card: number; amex: number; bank_transfer: number
  notes: string | null; invoice_sent: boolean; invoice_sent_at: string | null
}
type BookingTask = {
  id: number; booking_id: number; task_name: string; task_key: string
  category: string; sort_order: number; is_done: boolean
  completed_at: string | null; notes: string | null; due_date: string | null
}
type Hotel = { id: number; name: string; room_types: string[] | null; meal_plans: string[] | null; reservation_email: string | null; reservation_phone: string | null; reservation_address: string | null; reservation_contact: string | null }
type Supplier = { id: number; name: string; type: string | null }
type BookingCommission = { id: number; booking_id: number; staff_id: number; share_percent: number; is_primary: boolean; created_at: string }

// ── CONSTANTS ────────────────────────────────────────────────
const CABIN_CLASSES = ['Economy', 'Premium Economy', 'Business Class', 'First Class']
const AIRPORTS = [
  { code:'LGW', name:'London Gatwick'             }, { code:'LHR', name:'London Heathrow'           },
  { code:'MAN', name:'Manchester'                 }, { code:'BHX', name:'Birmingham'                },
  { code:'BRS', name:'Bristol'                    }, { code:'EDI', name:'Edinburgh'                 },
  { code:'GLA', name:'Glasgow'                    }, { code:'LPL', name:'Liverpool John Lennon'     },
  { code:'NCL', name:'Newcastle'                  }, { code:'LTN', name:'London Luton'              },
  { code:'STN', name:'London Stansted'            }, { code:'BFS', name:'Belfast International'     },
  { code:'MRU', name:'Mauritius Sir Seewoosagur'  }, { code:'RRG', name:'Rodrigues Plaine Corail'   },
  { code:'DXB', name:'Dubai International'        }, { code:'CDG', name:'Paris Charles de Gaulle'   },
  { code:'AMS', name:'Amsterdam Schiphol'         }, { code:'FRA', name:'Frankfurt'                 },
  { code:'ZRH', name:'Zurich'                     }, { code:'CMB', name:'Colombo Bandaranaike'      },
  { code:'HKG', name:'Hong Kong'                  }, { code:'SIN', name:'Singapore Changi'          },
  { code:'BKK', name:'Bangkok Suvarnabhumi'       }, { code:'SEZ', name:'Mahé Seychelles'           },
  { code:'MAD', name:'Madrid Barajas'             }, { code:'BCN', name:'Barcelona El Prat'         },
  { code:'GVA', name:'Geneva'                     }, { code:'FCO', name:'Rome Fiumicino'            },
]
const AIRLINES = [
  'Air Mauritius','British Airways','Virgin Atlantic','Air France','Emirates','KLM',
  'Condor','Corsair','TUI Airways','Lufthansa','Swiss','Austrian Airlines',
  'Qatar Airways','Etihad Airways','Singapore Airlines','Cathay Pacific',
  'Kenya Airways','Air Canada','Iberia','Alitalia',
]
const BOARD_BASIS   = ['Room Only', 'Bed & Breakfast', 'Half Board', 'Full Board', 'All Inclusive', 'Ultra All Inclusive', 'Premium All Inclusive', 'Gourmet Half Board', 'Gourmet Bliss', 'Serenity Plus', 'Beachcomber Plus', 'Dine Around']
const TRANSFER_TYPES = [
  { value: 'private',      label: 'Private (up to 2 pax)' },
  { value: 'comfort_plus', label: 'Comfort Plus (up to 3 pax)' },
  { value: 'family',       label: 'Special Family (up to 7 pax)' },
  { value: 'coach',        label: 'Standard Coach' },
]
const SPECIAL_OCCASIONS = ['Honeymoon', 'Anniversary', 'Birthday', 'Retirement', 'Family Gathering', 'New Year Celebration', 'Christmas', 'Proposal', 'Other']
const RES_STATUS: Record<string, { label: string; color: string }> = {
  pending:     { label: 'Pending',       color: '#94a3b8' },
  sent:        { label: 'Email Sent',    color: '#f59e0b' },
  confirmed:   { label: 'Confirmed',     color: '#10b981' },
  ref_received:{ label: 'Ref Received',  color: '#6366f1' },
}
const TITLES = ['Mr', 'Mrs', 'Ms', 'Miss', 'Dr', 'Master']
const PAX_TYPES = ['Adult', 'Child', 'Infant']
const TASK_TEMPLATE = [
  { key:'deposit_received',      name:'Deposit received',               category:'Financial',     sort:1  },
  { key:'balance_due_set',       name:'Balance due date set',           category:'Financial',     sort:2  },
  { key:'balance_received',      name:'Balance received',               category:'Financial',     sort:3  },
  { key:'final_costing',         name:'Final costing confirmed',        category:'Financial',     sort:4  },
  { key:'flights_ticketed',      name:'Flights ticketed',               category:'Flights',       sort:5  },
  { key:'etickets_sent',         name:'E-tickets sent to client',       category:'Flights',       sort:6  },
  { key:'hotel_confirmation',    name:'Hotel confirmation received',    category:'Accommodation', sort:7  },
  { key:'special_requests',      name:'Special requests confirmed',     category:'Accommodation', sort:8  },
  { key:'transfer_confirmation', name:'Transfers confirmed',            category:'Transfers',     sort:9  },
  { key:'booking_confirmation',  name:'Booking confirmation sent',      category:'Documents',     sort:10 },
  { key:'travel_docs',           name:'Travel documents issued',        category:'Documents',     sort:11 },
  { key:'atol_certificate',      name:'ATOL certificate issued',        category:'Documents',     sort:12 },
  { key:'predeparture_call',     name:'Pre-departure contact made',     category:'Pre-Departure', sort:13 },
  { key:'review_requested',      name:'Post-trip review requested',     category:'Post-Trip',     sort:14 },
  { key:'rebook_conversation',   name:'Re-book conversation started',   category:'Post-Trip',     sort:15 },
]
const CAT_COLORS: Record<string,string> = {
  Financial:'#10b981', Flights:'#3b82f6', Accommodation:'#8b5cf6',
  Transfers:'#f97316', Documents:'#f59e0b', 'Pre-Departure':'#ec4899', 'Post-Trip':'#14b8a6', Operations:'#6366f1',
}
const CAT_ICONS: Record<string,string> = {
  Financial:'💷', Flights:'✈', Accommodation:'🏨',
  Transfers:'🚗', Documents:'📄', 'Pre-Departure':'📞', 'Post-Trip':'🌟', Operations:'🛎',
}

// ── HELPERS ──────────────────────────────────────────────────
const fmt     = (n: number | null | undefined) => '£' + (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtDate = (d: string | null) => !d ? '—' : new Date(d.includes('T') ? d : d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const daysUntil = (d: string | null) => !d ? null : Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
const TASK_CATEGORY_ORDER = ['Financial', 'Flights', 'Accommodation', 'Transfers', 'Documents', 'Pre-Departure', 'Post-Trip', 'Operations']

function calcAge(dob: string | null): number | null {
  if (!dob) return null
  const d = new Date(dob.includes('T') ? dob : dob + 'T12:00')
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--
  return age
}

function calcNights(checkin: string | null, checkout: string | null): number | null {
  if (!checkin || !checkout) return null
  return Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000)
}

function asDateOnly(d: string | null | undefined) {
  return d ? d.split('T')[0] : null
}

function getFlightDerivedDates(flights: Flight[]) {
  const outbound = flights
    .filter(f => f.direction === 'outbound' && f.departure_date)
    .sort((a, b) => new Date(a.departure_date!).getTime() - new Date(b.departure_date!).getTime())
  const returns = flights
    .filter(f => f.direction === 'return' && (f.arrival_date || f.departure_date))
    .sort((a, b) => {
      const aDate = a.arrival_date || a.departure_date || ''
      const bDate = b.arrival_date || b.departure_date || ''
      return new Date(aDate).getTime() - new Date(bDate).getTime()
    })

  return {
    departure_date: asDateOnly(outbound[0]?.departure_date),
    return_date: asDateOnly(returns[returns.length - 1]?.arrival_date || returns[returns.length - 1]?.departure_date),
  }
}

async function apiRequest<T = any>(url: string, init?: RequestInit) {
  const response = await authedFetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || json?.success === false || json?.error) {
    throw new Error(json?.message || json?.error || 'Request failed')
  }
  return json as T
}

// ── PAGE ─────────────────────────────────────────────────────
export default function BookingDetailPage() {
  const { id }    = useParams()
  const router    = useRouter()

  const [booking, setBooking]           = useState<Booking | null>(null)
  const [passengers, setPassengers]     = useState<Passenger[]>([])
  const [flights, setFlights]           = useState<Flight[]>([])
  const [accommodations, setAccoms]     = useState<Accommodation[]>([])
  const [transfers, setTransfers]       = useState<Transfer[]>([])
  const [extras, setExtras]             = useState<Extra[]>([])
  const [payments, setPayments]         = useState<Payment[]>([])
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(null)
  const [staffUsers, setStaffUsers]     = useState<StaffUser[]>([])
  const [tasks, setTasks]               = useState<BookingTask[]>([])
  const [hotels, setHotels]             = useState<Hotel[]>([])
  const [suppliers, setSuppliers]       = useState<Supplier[]>([])
  const [commissions, setCommissions]   = useState<BookingCommission[]>([])
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState<'overview'|'passengers'|'flights'|'accommodation'|'transfers'|'extras'|'payments'|'costing'|'tasks'|'documents'|'portal'>('overview')
  const [toast, setToast]               = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [saving, setSaving]             = useState(false)
  const [cancelModal, setCancelModal]   = useState(false)
  const [ownerDraft, setOwnerDraft]     = useState('')
  const [savingOwner, setSavingOwner]   = useState(false)
  const [pendingClaims, setPendingClaims] = useState<any[]>([])
  const [repeatFlag, setRepeatFlag]       = useState<any>(null)
  const [myPendingClaim, setMyPendingClaim] = useState<any>(null)
  const [claimReason, setClaimReason]     = useState('')
  const [submittingClaim, setSubmittingClaim] = useState(false)
  const [claimSplits, setClaimSplits]     = useState<Record<number, string>>({})
  const [claimNotes, setClaimNotes]       = useState<Record<number, string>>({})
  const [savingClaim, setSavingClaim]     = useState<number|null>(null)
  const [directShareStaff, setDirectShareStaff] = useState('')
  const [directSharePct, setDirectSharePct]     = useState('')
  const [savingDirectShare, setSavingDirectShare] = useState(false)
  const toastTimer                        = useRef<any>(null)

  useEffect(() => { loadAll(); void loadClaims() }, [id])
  useEffect(() => { void loadAccess() }, [])

  async function loadAccess() {
    try {
      const { staffUsers, currentStaff } = await apiRequest<{ staffUsers: StaffUser[]; currentStaff: StaffUser | null }>('/api/bookings/access')
      setStaffUsers(staffUsers)
      setCurrentStaff(currentStaff)
    } catch (err) {
      console.error('Failed to load access context:', err)
    }
  }

  async function loadClaims() {
    try {
      const data = await apiRequest<{ pendingClaims: any[]; repeatFlag: any; myPendingClaim: any }>(`/api/bookings/${id}/claims`)
      setPendingClaims(data.pendingClaims || [])
      setRepeatFlag(data.repeatFlag || null)
      setMyPendingClaim(data.myPendingClaim || null)
    } catch { /* non-fatal */ }
  }

  async function loadAll(silent = false) {
    if (!silent) setLoading(true)
    try {
      const { data } = await apiRequest<{
        data: {
          booking: Booking | null
          passengers: Passenger[]
          flights: Flight[]
          accommodations: Accommodation[]
          transfers: Transfer[]
          extras: Extra[]
          payments: Payment[]
          tasks: BookingTask[]
          hotels: Hotel[]
          suppliers: Supplier[]
          commissions: BookingCommission[]
        }
      }>(`/api/bookings/${id}?all=true`)

      const { booking, passengers, flights, accommodations, transfers, extras, payments, tasks, hotels, suppliers, commissions } = data

      setBooking(booking)
      setOwnerDraft(String(booking?.staff_id || booking?.deals?.clients?.owner_staff_id || ''))
      setPassengers(passengers || [])
      setFlights(flights || [])
      setAccoms(accommodations || [])
      setTransfers(transfers || [])
      setExtras(extras || [])
      setPayments(payments || [])
      setTasks(tasks || [])
      setHotels(hotels || [])
      setSuppliers(suppliers || [])
      setCommissions(commissions || [])
    } catch (error: any) {
      if (!silent) setBooking(null)
      showToast(error.message || 'Failed to load booking', 'error')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  async function submitClaim() {
    if (!booking || !claimReason.trim() || claimReason.trim().length < 20) {
      showToast('Reason must be at least 20 characters', 'error'); return
    }
    setSubmittingClaim(true)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}/claims`, {
        method: 'POST',
        body: JSON.stringify({ reason: claimReason }),
      })
      showToast(result.message || 'Request submitted ✓')
      setClaimReason('')
      await loadClaims()
    } catch (err: any) {
      showToast(err.message || 'Failed to submit', 'error')
    } finally {
      setSubmittingClaim(false)
    }
  }

  async function actOnClaim(claimId: number, action: 'approve_claim' | 'reject_claim') {
    if (!booking) return
    setSavingClaim(claimId)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}/claims`, {
        method: 'PUT',
        body: JSON.stringify({
          action,
          claimId,
          claimantShare: Number(claimSplits[claimId] || 0),
          reviewNotes: claimNotes[claimId] || '',
        }),
      })
      showToast(result.message || 'Done ✓')
      await loadClaims()
      await loadAll()
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error')
    } finally {
      setSavingClaim(null)
    }
  }

  async function saveDirectShare() {
    if (!booking) return
    const pct = Number(directSharePct)
    if (!directShareStaff || !pct || pct < 1 || pct > 99) {
      showToast('Select a staff member and enter a share between 1–99%', 'error'); return
    }
    setSavingDirectShare(true)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}/claims`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'manager_direct_share', secondStaffId: Number(directShareStaff), secondStaffShare: pct }),
      })
      showToast(result.message || 'Split saved ✓')
      setDirectShareStaff('')
      setDirectSharePct('')
      await loadAll()
    } catch (err: any) {
      showToast(err.message || 'Failed to save split', 'error')
    } finally {
      setSavingDirectShare(false)
    }
  }

  async function undoDirectShare() {
    if (!booking) return
    setSavingDirectShare(true)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}/claims`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'manager_direct_unsplit' }),
      })
      showToast(result.message || 'Split removed ✓')
      setDirectShareStaff('')
      setDirectSharePct('')
      await loadAll()
    } catch (err: any) {
      showToast(err.message || 'Failed to undo split', 'error')
    } finally {
      setSavingDirectShare(false)
    }
  }

  async function resolveRepeatFlag(resolution: string) {
    if (!booking) return
    setSavingOwner(true)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}/claims`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'resolve_repeat_flag', resolution }),
      })
      showToast(result.message || 'Done ✓')
      await loadClaims()
      await loadAll()
    } catch (err: any) {
      showToast(err.message || 'Failed', 'error')
    } finally {
      setSavingOwner(false)
    }
  }

  async function saveOwnership() {
    if (!booking || !isManager(currentStaff) || !ownerDraft) return
    const nextStaffId = Number(ownerDraft)

    setSavingOwner(true)
    try {
      const response = await authedFetch(`/api/bookings/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_ownership',
          staffId: nextStaffId,
        }),
      })
      const result = await response.json()
      if (!result.success) throw new Error(result.message)

      showToast('Ownership updated ✓')
      await loadAll()
    } catch (err: any) {
      showToast(err.message || 'Failed to update ownership', 'error')
    } finally {
      setSavingOwner(false)
    }
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh' }}><div style={{ color:'var(--text-muted)', fontSize:'14px' }}>Loading booking…</div></div>
  if (!booking) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh' }}><div style={{ color:'var(--text-muted)', fontSize:'14px' }}>Booking not found</div></div>

  const client      = booking.deals?.clients
  const totalPaid   = payments.reduce((a, p) => a + (p.amount || 0), 0)
  const balance     = (booking.total_sell || booking.deals?.deal_value || 0) - totalPaid
  const tasksDone   = tasks.filter(t => t.is_done).length
  const taskPct     = tasks.length ? Math.round((tasksDone / tasks.length) * 100) : 0
  const depDays     = daysUntil(booking.departure_date)
  const balDays     = daysUntil(booking.balance_due_date)
  const outbound    = flights.filter(f => f.direction === 'outbound').sort((a,b) => a.leg_order - b.leg_order)
  const returnFlts  = flights.filter(f => f.direction === 'return').sort((a,b) => a.leg_order - b.leg_order)
  const assignedStaffId = booking.staff_id || booking.deals?.staff_id || client?.owner_staff_id || null
  const assignedStaff = staffUsers.find(staff => staff.id === assignedStaffId) || null
  const ownershipMismatch =
    (client?.owner_staff_id ?? null) !== (booking.staff_id ?? null) ||
    (booking.deals?.staff_id ?? null) !== (booking.staff_id ?? null)

  const TABS = [
    { key:'overview',      label:'Overview'                              },
    { key:'passengers',    label:`Passengers (${passengers.length})`    },
    { key:'flights',       label:`Flights (${flights.length})`          },
    { key:'accommodation', label:`Accommodation (${accommodations.length})` },
    { key:'transfers',     label:`Transfers (${transfers.length})`      },
    { key:'extras',        label:`Extras (${extras.length})`            },
    { key:'payments',      label:`Payments (${payments.length})`        },
    { key:'costing',       label:'Costing'                              },
    { key:'tasks',         label:`Tasks ${taskPct}%`                    },
    { key:'documents',     label:'Documents'                             },
    { key:'portal',        label:'Portal'                                },
  ] as const

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <Link href="/bookings" style={{ color:'var(--text-muted)', textDecoration:'none', fontSize:'13px' }}>← Bookings</Link>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
              <div className="page-title" style={{ fontSize:'22px', fontFamily:'monospace', letterSpacing:'0.05em' }}>{booking.booking_reference}</div>
              <span style={{ fontSize:'12px', padding:'3px 10px', borderRadius:'20px', fontWeight:'500',
                background: booking.booking_status === 'cancelled' ? '#fee2e2' : '#e6f4ee',
                color:      booking.booking_status === 'cancelled' ? '#dc2626' : '#10b981' }}>
                {booking.booking_status === 'cancelled' ? 'CANCELLED' : booking.status}
              </span>
            </div>
            <div style={{ fontSize:'13px', color:'var(--text-muted)', marginTop:'2px' }}>
              {client ? `${client.first_name} ${client.last_name}` : '—'} · {fmtDate(booking.departure_date)}{booking.return_date ? ` → ${fmtDate(booking.return_date)}` : ''}
              {booking.destination ? ` · ${booking.destination}` : ''}
              {assignedStaff ? ` · Consultant: ${assignedStaff.name}` : ' · Consultant: Unassigned'}
            </div>
            {booking.originating_quote_ref && (
              <div style={{ marginTop:'5px', display:'flex', alignItems:'center', gap:'6px' }}>
                <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>Converted from quote</span>
                <span style={{ fontFamily:'monospace', fontSize:'11px', fontWeight:'700', color:'var(--accent)', background:'var(--accent-light)', padding:'1px 7px', borderRadius:'4px' }}>{booking.originating_quote_ref}</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <Link href={`/deals/${booking.deal_id}`}><button className="btn btn-secondary">← Deal</button></Link>
          {booking.booking_status !== 'cancelled' && isManager(currentStaff) && (
            <button className="btn" onClick={() => setCancelModal(true)}
              style={{ background:'#fee2e2', color:'#dc2626', border:'1px solid #fca5a5', fontWeight:'500' }}>
              Cancel Booking
            </button>
          )}
        </div>
      </div>

      {/* Pre-body alerts + ownership */}
      <div style={{ padding:'16px 28px 0' }}>

      {/* Cancelled banner */}
      {booking.booking_status === 'cancelled' && (
        <div style={{ marginBottom:'16px', background:'#fee2e2', border:'1px solid #fca5a5', borderRadius:'10px', padding:'14px 18px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom: booking.cancellation_type ? '6px' : '0' }}>
            <span style={{ fontSize:'18px' }}>🚫</span>
            <div style={{ flex:1, fontSize:'13.5px', color:'#dc2626', fontWeight:'600' }}>
              This booking has been cancelled
              {booking.cancellation_date ? ` — ${fmtDate(booking.cancellation_date)}` : ''}
              {booking.cancellation_actioned_by ? ` · actioned by ${booking.cancellation_actioned_by}` : ''}
            </div>
          </div>
          {booking.cancellation_type && (
            <div style={{ fontSize:'12.5px', color:'#b91c1c', paddingLeft:'28px' }}>
              {booking.cancellation_type === 'deposit_only' && 'Deposit only paid — deposit retained as cancellation charge'}
              {booking.cancellation_type === 'post_payment' && 'Full payment received — refer to Customer Service / Case Management'}
              {booking.cancellation_type === 'tickets_issued' && 'Tickets already issued — handled by Ticketing & Admin department'}
              {booking.cancellation_notes ? ` · ${booking.cancellation_notes}` : ''}
            </div>
          )}
        </div>
      )}

      {/* Balance due alert */}
      {booking.booking_status !== 'cancelled' && balDays !== null && balDays <= 14 && balDays >= 0 && balance > 0 && (
        <div style={{ marginBottom:'16px', background:'#fdeaea', border:'1px solid var(--red)', borderRadius:'10px', padding:'12px 18px', display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'18px' }}>⚠️</span>
          <div style={{ flex:1, fontSize:'13.5px', color:'var(--red)', fontWeight:'500' }}>
            Balance of {fmt(balance)} due {balDays === 0 ? 'TODAY' : `in ${balDays} day${balDays===1?'':'s'}`} — {fmtDate(booking.balance_due_date)}
          </div>
        </div>
      )}

      <div style={{ marginBottom:'16px' }} className="card">
        <div style={{ padding:'16px 18px', display:'flex', justifyContent:'space-between', gap:'16px', alignItems:'flex-start', flexWrap:'wrap' }}>
          <div>
            {commissions.length > 1 ? (
              <>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'6px' }}>Shared Ownership</div>
                {commissions.map(c => {
                  const staff = staffUsers.find(s => s.id === c.staff_id)
                  return (
                    <div key={c.id} style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'14px', fontWeight:'600', color:'var(--text-primary)' }}>{staff?.name || `Staff #${c.staff_id}`}</span>
                      <span style={{ fontSize:'12px', color:'var(--text-muted)', background:'var(--bg-secondary)', borderRadius:'4px', padding:'1px 6px' }}>{c.share_percent}%</span>
                      {c.is_primary && <span style={{ fontSize:'11px', color:'var(--accent-mid)' }}>primary</span>}
                    </div>
                  )
                })}
              </>
            ) : (
              <>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'4px' }}>Assigned Consultant</div>
                <div style={{ fontSize:'14px', fontWeight:'600', color:'var(--text-primary)' }}>{assignedStaff?.name || 'Unassigned'}</div>
                <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px' }}>
                  {assignedStaff?.role || 'Needs assignment to appear correctly in commission reporting'}
                </div>
              </>
            )}
          </div>

          <div style={{ minWidth:'300px', display:'flex', flexDirection:'column', gap:'10px' }}>

            {/* ── Repeat-client flag — manager only ── */}
            {isManager(currentStaff) && repeatFlag && (
              <div style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:'10px', padding:'12px 14px' }}>
                <div style={{ fontSize:'12.5px', fontWeight:'600', color:'#92400e', marginBottom:'6px' }}>
                  ⚠ Repeat client — originally with {repeatFlag.original_staff?.name || `Staff #${repeatFlag.original_staff_id}`}
                </div>
                <div style={{ fontSize:'12px', color:'#78350f', marginBottom:'10px' }}>
                  This booking is assigned to {repeatFlag.handling_staff?.name || `Staff #${repeatFlag.handling_staff_id}`}
                </div>
                <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
                  <button className="btn btn-secondary btn-xs" onClick={() => resolveRepeatFlag('enforced_50_50')} disabled={savingOwner}>Enforce 50/50</button>
                  <button className="btn btn-secondary btn-xs" onClick={() => resolveRepeatFlag('reassigned_to_original')} disabled={savingOwner}>Reassign to original</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => resolveRepeatFlag('dismissed')} disabled={savingOwner}>Dismiss</button>
                </div>
              </div>
            )}

            {/* ── Manager: ownership reassignment ── */}
            {isManager(currentStaff) && (
              <>
                {ownershipMismatch && (
                  <div style={{ background:'#fff7ed', border:'1px solid #fdba74', borderRadius:'10px', padding:'10px 12px', fontSize:'12px', color:'#9a3412', lineHeight:1.5 }}>
                    Client ownership and booking consultant are not aligned. Updating here will realign client, deal and booking together.
                  </div>
                )}
                <select className="input" value={ownerDraft} onChange={e => setOwnerDraft(e.target.value)}>
                  <option value="">Select consultant…</option>
                  {staffUsers.map(staff => <option key={staff.id} value={String(staff.id)}>{staff.name} · {staff.role || 'staff'}</option>)}
                </select>
                <div style={{ display:'flex', justifyContent:'flex-end' }}>
                  <button className="btn btn-secondary" onClick={saveOwnership} disabled={savingOwner || !ownerDraft}>
                    {savingOwner ? 'Saving…' : 'Update Ownership'}
                  </button>
                </div>
              </>
            )}

            {/* ── Manager: pending claims ── */}
            {isManager(currentStaff) && pendingClaims.length > 0 && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:'12px', display:'flex', flexDirection:'column', gap:'10px' }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Pending Share Requests</div>
                {pendingClaims.map((claim: any) => (
                  <div key={claim.id} style={{ background:'var(--bg-secondary)', borderRadius:'8px', padding:'12px 14px', border:'1px solid var(--border)' }}>
                    <div style={{ fontSize:'13px', fontWeight:'600', marginBottom:'2px' }}>{claim.claimant?.name || `Staff #${claim.claimant_id}`}</div>
                    <div style={{ fontSize:'11.5px', color:'var(--text-muted)', marginBottom:'6px' }}>{fmtDate(claim.created_at)}</div>
                    <div style={{ fontSize:'12.5px', color:'var(--text-primary)', marginBottom:'10px', fontStyle:'italic' }}>"{claim.reason}"</div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px', marginBottom:'10px' }}>
                      <div>
                        <label className="label">Claimant share %</label>
                        <input className="input" type="number" min="1" max="99" placeholder="e.g. 30"
                          value={claimSplits[claim.id] || ''}
                          onChange={e => setClaimSplits(p => ({ ...p, [claim.id]: e.target.value }))} />
                      </div>
                      <div>
                        <label className="label">Review note (optional)</label>
                        <input className="input" placeholder="Optional note"
                          value={claimNotes[claim.id] || ''}
                          onChange={e => setClaimNotes(p => ({ ...p, [claim.id]: e.target.value }))} />
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end' }}>
                      <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }}
                        onClick={() => actOnClaim(claim.id, 'reject_claim')}
                        disabled={savingClaim === claim.id}>
                        {savingClaim === claim.id ? '…' : 'Reject'}
                      </button>
                      <button className="btn btn-cta btn-xs"
                        onClick={() => actOnClaim(claim.id, 'approve_claim')}
                        disabled={savingClaim === claim.id || !claimSplits[claim.id]}>
                        {savingClaim === claim.id ? 'Saving…' : 'Approve with split'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Manager: direct share creation ── */}
            {isManager(currentStaff) && (
              <div style={{ borderTop:'1px solid var(--border)', paddingTop:'12px' }}>
                <div style={{ fontSize:'11px', fontWeight:'700', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>
                  {commissions.length > 1 ? 'Replace Split Directly' : 'Create Split Directly'}
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:'8px', marginBottom:'8px' }}>
                  <select className="input" value={directShareStaff} onChange={e => setDirectShareStaff(e.target.value)}>
                    <option value="">Select second staff member…</option>
                    {staffUsers.filter(s => s.id !== (booking.staff_id ?? null)).map(s => (
                      <option key={s.id} value={String(s.id)}>{s.name} · {s.role || 'staff'}</option>
                    ))}
                  </select>
                  <input className="input" type="number" min="1" max="99" placeholder="%" style={{ width:'64px' }}
                    value={directSharePct} onChange={e => setDirectSharePct(e.target.value)} />
                </div>
                {directShareStaff && directSharePct && Number(directSharePct) > 0 && Number(directSharePct) < 100 && (
                  <div style={{ fontSize:'11.5px', color:'var(--text-muted)', marginBottom:'8px' }}>
                    Primary owner: <strong>{100 - Number(directSharePct)}%</strong> · {staffUsers.find(s => s.id === Number(directShareStaff))?.name}: <strong>{directSharePct}%</strong>
                  </div>
                )}
                {commissions.length > 1 && (
                  <div style={{ fontSize:'11.5px', color:'var(--text-muted)', marginBottom:'8px' }}>
                    Saving a new split replaces the current live split completely. Undo share restores one 100% primary-owner row.
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'flex-end', gap:'8px' }}>
                  {commissions.length > 1 && (
                    <button className="btn btn-secondary btn-xs" onClick={undoDirectShare} disabled={savingDirectShare}>
                      {savingDirectShare ? 'Saving…' : 'Undo Share'}
                    </button>
                  )}
                  <button className="btn btn-cta btn-xs" onClick={saveDirectShare}
                    disabled={savingDirectShare || !directShareStaff || !directSharePct}>
                    {savingDirectShare ? 'Saving…' : commissions.length > 1 ? 'Replace Split' : 'Save Split'}
                  </button>
                </div>
              </div>
            )}

            {/* ── Sales: not the owner ── */}
            {!isManager(currentStaff) && booking.staff_id !== currentStaff?.id && (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {myPendingClaim ? (
                  <div style={{ background:'#eff6ff', border:'1px solid #93c5fd', borderRadius:'8px', padding:'10px 12px', fontSize:'12.5px', color:'#1d4ed8' }}>
                    Share request pending manager review.
                  </div>
                ) : (
                  <>
                    <textarea
                      className="input"
                      rows={3}
                      placeholder="Reason for share request (min 20 characters)…"
                      value={claimReason}
                      onChange={e => setClaimReason(e.target.value)}
                      style={{ resize:'vertical', fontSize:'13px' }}
                    />
                    <div style={{ display:'flex', justifyContent:'flex-end' }}>
                      <button className="btn btn-secondary btn-xs"
                        onClick={submitClaim}
                        disabled={submittingClaim || claimReason.trim().length < 20}>
                        {submittingClaim ? 'Submitting…' : 'Request Share on This Booking'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── Sales: is the owner ── */}
            {!isManager(currentStaff) && booking.staff_id === currentStaff?.id && (
              <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                Ownership stays manager-controlled so commission and client ownership remain clean.
              </div>
            )}

          </div>
        </div>
      </div>

      </div>{/* end pre-body */}

      <div className="page-body">
        {/* Tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:'20px', overflowX:'auto' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              style={{ padding:'10px 16px', border:'none', background:'transparent', fontSize:'13px', cursor:'pointer', whiteSpace:'nowrap',
                color: tab===t.key ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: tab===t.key ? '500' : '400',
                borderBottom: tab===t.key ? '2px solid var(--accent)' : '2px solid transparent',
                marginBottom:'-1px' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ─────────────────────────────── */}
        {tab === 'overview' && (
          <OverviewTab booking={booking} client={client} balance={balance} taskPct={taskPct}
            tasksDone={tasksDone} tasksTotal={tasks.length}
            depDays={depDays} accommodations={accommodations} outbound={outbound}
            flights={[...outbound,...returnFlts]} transfers={transfers} extras={extras} tasks={tasks}
            onJumpTab={setTab}
            onUpdate={() => loadAll(true)} showToast={showToast} />
        )}

        {/* ── PASSENGERS TAB ───────────────────────────── */}
        {tab === 'passengers' && (
          <PassengersTab bookingId={booking.id} passengers={passengers} onUpdate={() => loadAll(true)} showToast={showToast} />
        )}

        {/* ── FLIGHTS TAB ──────────────────────────────── */}
        {tab === 'flights' && (
          <FlightsTab bookingId={booking.id} outbound={outbound} returnFlts={returnFlts}
            suppliers={suppliers} onUpdate={() => loadAll(true)} showToast={showToast} />
        )}

        {/* ── ACCOMMODATION TAB ────────────────────────── */}
        {tab === 'accommodation' && (
          <AccommodationTab bookingId={booking.id} accommodations={accommodations}
            hotels={hotels} suppliers={suppliers} passengers={passengers}
            onUpdate={() => loadAll(true)} showToast={showToast} />
        )}

        {/* ── TRANSFERS TAB ────────────────────────────── */}
        {tab === 'transfers' && (
          <TransfersTab bookingId={booking.id} transfers={transfers} suppliers={suppliers}
            flights={flights} onUpdate={() => loadAll(true)} showToast={showToast} />
        )}

        {/* ── EXTRAS TAB ───────────────────────────────── */}
        {tab === 'extras' && (
          <ExtrasTab bookingId={booking.id} extras={extras} onUpdate={() => loadAll(true)} showToast={showToast} />
        )}

        {/* ── PAYMENTS TAB ─────────────────────────────── */}
        {tab === 'payments' && (
          <PaymentsTab booking={booking} payments={payments} balance={balance}
            onUpdate={() => loadAll(true)} showToast={showToast} currentStaff={currentStaff} />
        )}

        {/* ── COSTING TAB ──────────────────────────────── */}
        {tab === 'costing' && (
          <CostingTab booking={booking} flights={[...outbound, ...returnFlts]}
            accommodations={accommodations} transfers={transfers}
            extras={extras} payments={payments} suppliers={suppliers}
            onUpdate={() => loadAll(true)} showToast={showToast} currentStaff={currentStaff} />
        )}

        {/* ── TASKS TAB ────────────────────────────────── */}
        {tab === 'tasks' && (
          <TasksTab tasks={tasks} activities={booking.deals?.activities || []} bookingReference={booking.booking_reference} onUpdate={() => loadAll(true)} showToast={showToast} />
        )}

        {/* ── DOCUMENTS TAB ────────────────────────────── */}
        {tab === 'documents' && (
          <DocumentsTab booking={booking} client={client} passengers={passengers}
            outbound={outbound} returnFlts={returnFlts} accommodations={accommodations}
            transfers={transfers} payments={payments} tasks={tasks} onUpdate={() => loadAll(true)} showToast={showToast} />
        )}

        {/* ── PORTAL TAB ───────────────────────────────── */}
        {tab === 'portal' && (
          <PortalTab bookingId={booking.id} passengers={passengers} showToast={showToast} />
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}

      {cancelModal && (
        <CancellationModal
          booking={booking}
          hasFlights={flights.length > 0}
          hasAccommodation={accommodations.length > 0}
          hasTransfers={transfers.length > 0}
          hasExtras={extras.length > 0}
          totalPaid={totalPaid}
          defaultActionedBy={currentStaff?.name || ''}
          onClose={() => setCancelModal(false)}
          onConfirm={async (type, checklist, notes, actionedBy) => {
            try {
              const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}`, {
                method: 'PUT',
                body: JSON.stringify({
                  action: 'cancel_booking',
                  type,
                  checklist,
                  notes: notes || null,
                  actionedBy,
                  totalPaid,
                }),
              })
              setCancelModal(false)
              showToast(result.message || 'Booking cancelled')
              void loadAll()
            } catch (error: any) {
              showToast(error.message || 'Failed to cancel booking', 'error')
            }
          }}
        />
      )}
    </div>
  )
}

// ── OVERVIEW TAB ─────────────────────────────────────────────
function OverviewTab({ booking, client, balance, taskPct, tasksDone, tasksTotal, depDays, accommodations, outbound, flights, transfers, extras, tasks, onJumpTab, onUpdate, showToast }: any) {
  const [form, setForm]       = useState({
    destination:    booking.destination || '',
    booking_notes:  booking.booking_notes || '',
  })
  const [saving, setSaving]         = useState(false)
  const [editingBalDue, setEditingBalDue] = useState(false)
  const [balDueDraft, setBalDueDraft]     = useState(booking.balance_due_date?.split('T')[0] || '')
  const [requestForm, setRequestForm] = useState({
    task_name: '',
    notes: '',
    due_date: new Date().toISOString().split('T')[0],
    category: 'Operations',
  })
  const [savingRequest, setSavingRequest] = useState(false)

  useEffect(() => {
    setForm({ destination: booking.destination || '', booking_notes: booking.booking_notes || '' })
    setBalDueDraft(booking.balance_due_date?.split('T')[0] || '')
  }, [booking])

  const sell      = booking.total_sell || booking.deals?.deal_value || 0
  const profit    = booking.final_profit ?? booking.gross_profit ?? 0
  const commission = profit > 0 ? (profit - 10) * 0.1 : 0

  async function saveBalDue() {
    try {
      const response = await authedFetch(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_balance_due',
          balance_due_date: balDueDraft || null,
        }),
      })
      const result = await response.json()
      if (result.success) {
        await onUpdate()
        showToast('Balance due date updated ✓')
        setEditingBalDue(false)
      } else {
        showToast('Failed: ' + result.message, 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update balance due date', 'error')
    }
  }

  async function save() {
    setSaving(true)
    try {
      const response = await authedFetch(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'save_notes',
          destination: form.destination,
          booking_notes: form.booking_notes,
        }),
      })
      const result = await response.json()
      if (result.success) {
        await onUpdate()
        showToast('Overview details updated ✓')
      } else {
        showToast('Save failed: ' + result.message, 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to save overview', 'error')
    } finally {
      setSaving(false)
    }
  }

  const firstFlight    = outbound[0]
  const firstHotel     = accommodations?.[0] ?? null
  const derivedDates   = getFlightDerivedDates(flights || [])
  const flightDepDate  = derivedDates.departure_date
  const flightReturnDate = derivedDates.return_date
  const bookingDepDate = booking.departure_date?.split('T')[0] ?? null
  const bookingReturnDate = booking.return_date?.split('T')[0] ?? null
  const depDateMismatch = flightDepDate && flightDepDate !== bookingDepDate
  const returnDateMismatch = flightReturnDate && flightReturnDate !== bookingReturnDate
  const operationalTasks = (tasks || []).filter((task: BookingTask) => task.task_key.startsWith('ops_request_') && !task.is_done && !!task.due_date)

  async function syncDepartureFromFlight() {
    if (!flightDepDate) return
    const response = await authedFetch(`/api/bookings/${booking.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_departure_from_flight',
      }),
    })
    const result = await response.json()
    if (result.success) {
      await onUpdate()
      showToast('Departure date synced from flight ✓')
    } else {
      showToast('Failed: ' + result.message, 'error')
    }
  }

  async function syncReturnFromFlight() {
    if (!flightReturnDate) return
    const response = await authedFetch(`/api/bookings/${booking.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'sync_return_from_flight',
      }),
    })
    const result = await response.json()
    if (result.success) {
      await onUpdate()
      showToast('Return date synced from flights ✓')
    } else {
      showToast('Failed: ' + result.message, 'error')
    }
  }

  async function addClientRequest() {
    const taskName = requestForm.task_name.trim()
    const notes = requestForm.notes.trim()
    if (!taskName && !notes) { showToast('Add the request or reminder first', 'error'); return }
    if (!requestForm.due_date) { showToast('Choose a due date', 'error'); return }
    setSavingRequest(true)
    try {
      const response = await authedFetch(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_operational_request',
          task_name: taskName,
          notes: notes,
          due_date: requestForm.due_date,
          category: requestForm.category,
        }),
      })
      const result = await response.json()
      if (result.success) {
        await onUpdate()
        setRequestForm({
          task_name: '',
          notes: '',
          due_date: new Date().toISOString().split('T')[0],
          category: 'Operations',
        })
        showToast('Request added to Today work ✓')
      } else {
        showToast('Failed: ' + result.message, 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add request', 'error')
    } finally {
      setSavingRequest(false)
    }
  }

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'20px' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
        <div className="card" style={{ padding:'18px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', flexWrap:'wrap' }}>
            <div>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Commercial</div>
              <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>
                Keep the overview client-and-trip focused. Financial work lives in Costing and Payments.
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
              <button className="btn btn-secondary btn-xs" onClick={() => onJumpTab('costing')}>Open Costing →</button>
              <button className="btn btn-secondary btn-xs" onClick={() => onJumpTab('payments')}>Open Payments →</button>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4, minmax(0,1fr))', gap:'10px', marginTop:'14px' }}>
            {[
              { label:'Client Total', value: fmt(sell), color:'var(--accent-mid)' },
              { label:'Gross Profit', value: fmt(profit), color: profit >= 0 ? 'var(--green)' : 'var(--red)' },
              { label:'Balance', value: fmt(balance), color: balance > 0 ? 'var(--red)' : 'var(--green)' },
              { label:'Commission', value: profit > 0 ? fmt(commission) : '—', color:'var(--text-primary)' },
            ].map(item => (
              <div key={item.label} style={{ background:'var(--bg-secondary)', borderRadius:'8px', padding:'12px 14px' }}>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>{item.label}</div>
                <div style={{ fontSize:'16px', fontWeight:'600', color:item.color }}>{item.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Trip summary */}
        {(firstHotel || firstFlight) && (
          <div className="card" style={{ padding:'20px 22px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', marginBottom:'14px', flexWrap:'wrap' }}>
              <div>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Trip Summary</div>
                <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>
                  Operational detail first, so we can see the shape of the trip at a glance.
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                <button className="btn btn-secondary btn-xs" onClick={() => onJumpTab('flights')}>Flights →</button>
                <button className="btn btn-secondary btn-xs" onClick={() => onJumpTab('accommodation')}>Hotels →</button>
                <button className="btn btn-secondary btn-xs" onClick={() => onJumpTab('transfers')}>Transfers →</button>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {outbound.length > 0 && (
                <div style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
                  <span style={{ fontSize:'18px' }}>✈</span>
                  <div>
                    <div style={{ fontSize:'13.5px', fontWeight:'500' }}>Outbound flights</div>
                    <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                      {outbound[0]?.origin} → {outbound[outbound.length - 1]?.destination} · {fmtDate(outbound[0]?.departure_date || null)}
                    </div>
                    <div style={{ fontSize:'12px', color:'var(--text-primary)', marginTop:'3px' }}>
                      {outbound.map((f: Flight) => `${f.airline || 'Flight'} ${f.flight_number || ''}`.trim()).join(' · ')}
                    </div>
                  </div>
                </div>
              )}
              {flights.filter((f: Flight) => f.direction === 'return').length > 0 && (
                <div style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
                  <span style={{ fontSize:'18px' }}>↩</span>
                  <div>
                    <div style={{ fontSize:'13.5px', fontWeight:'500' }}>Return flights</div>
                    <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                      {flights.filter((f: Flight) => f.direction === 'return')[0]?.origin} → {flights.filter((f: Flight) => f.direction === 'return').slice(-1)[0]?.destination} · {fmtDate(flightReturnDate)}
                    </div>
                    <div style={{ fontSize:'12px', color:'var(--text-primary)', marginTop:'3px' }}>
                      {flights.filter((f: Flight) => f.direction === 'return').map((f: Flight) => `${f.airline || 'Flight'} ${f.flight_number || ''}`.trim()).join(' · ')}
                    </div>
                  </div>
                </div>
              )}
              {accommodations.map((a: Accommodation) => (
                <div key={a.id} style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                  <span style={{ fontSize:'18px' }}>🏨</span>
                  <div>
                    <div style={{ fontSize:'13.5px', fontWeight:'500' }}>{a.hotel_name}</div>
                    <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{fmtDate(a.checkin_date)} → {fmtDate(a.checkout_date)} · {a.nights || calcNights(a.checkin_date, a.checkout_date)} nights · {a.board_basis} · {a.room_type}</div>
                    {a.special_occasion && <div style={{ fontSize:'11.5px', color:'var(--accent)' }}>🎉 {a.special_occasion}</div>}
                  </div>
                </div>
              ))}
              {transfers.length > 0 && (
                <div style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
                  <span style={{ fontSize:'18px' }}>🚗</span>
                  <div>
                    <div style={{ fontSize:'13.5px', fontWeight:'500' }}>Transfers</div>
                    <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                      {transfers.length} transfer{transfers.length !== 1 ? 's' : ''} booked
                    </div>
                    <div style={{ fontSize:'12px', color:'var(--text-primary)', marginTop:'3px' }}>
                      {transfers.map((t: Transfer) => t.supplier_name || t.transfer_type).filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
              )}
              {extras.length > 0 && (
                <div style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
                  <span style={{ fontSize:'18px' }}>✨</span>
                  <div>
                    <div style={{ fontSize:'13.5px', fontWeight:'500' }}>Extras</div>
                    <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                      {extras.length} extra{extras.length !== 1 ? 's' : ''} on this booking
                    </div>
                    <div style={{ fontSize:'12px', color:'var(--text-primary)', marginTop:'3px' }}>
                      {extras.map((e: Extra) => e.description || e.extra_type || 'Extra').join(' · ')}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {booking.status === 'CONFIRMED' && (
          <div className="card" style={{ padding:'20px 22px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', flexWrap:'wrap', marginBottom:'14px' }}>
              <div>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Client Request / Ops Reminder</div>
                <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>
                  Capture anything the client asks for and push it straight into Today work with a due date.
                </div>
              </div>
              <button className="btn btn-secondary btn-xs" onClick={() => onJumpTab('tasks')}>Open Tasks →</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 150px auto', gap:'10px', marginBottom:'10px' }}>
              <div>
                <label className="label">Task</label>
                <input className="input" placeholder="e.g. Pre-book tee time, quote extension, chase flight release" value={requestForm.task_name} onChange={e => setRequestForm(p => ({ ...p, task_name: e.target.value }))} />
              </div>
              <div>
                <label className="label">Category</label>
                <select className="input" value={requestForm.category} onChange={e => setRequestForm(p => ({ ...p, category: e.target.value }))}>
                  {['Operations', 'Flights', 'Accommodation', 'Transfers', 'Documents', 'Financial'].map(cat => <option key={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Due Date</label>
                <DateInput value={requestForm.due_date} onChange={v => setRequestForm(p => ({ ...p, due_date: v }))} />
              </div>
              <div style={{ display:'flex', alignItems:'end' }}>
                <button className="btn btn-cta" onClick={addClientRequest} disabled={savingRequest}>{savingRequest ? 'Saving…' : 'Add to Today'}</button>
              </div>
            </div>
            <div>
              <label className="label">Details</label>
              <textarea className="input" style={{ minHeight:'78px', resize:'vertical', fontSize:'13px' }} placeholder="Free text note, client request details, supplier follow-up needed, or a reminder for something not released yet." value={requestForm.notes} onChange={e => setRequestForm(p => ({ ...p, notes: e.target.value }))} />
            </div>
            {operationalTasks.length > 0 && (
              <div style={{ marginTop:'14px', paddingTop:'14px', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:'8px' }}>
                <div style={{ fontSize:'12px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Open Dated Requests</div>
                {operationalTasks.slice(0, 3).map((task: BookingTask) => (
                  <div key={task.id} style={{ background:'var(--bg-secondary)', borderRadius:'8px', padding:'10px 12px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', gap:'10px' }}>
                      <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-primary)' }}>{task.task_name}</div>
                      <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{fmtDate(task.due_date)}</div>
                    </div>
                    {task.notes && <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'4px' }}>{task.notes}</div>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Notes */}
        <div className="card" style={{ padding:'16px 18px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Booking Notes</div>
            <button className="btn btn-secondary btn-xs" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Notes'}</button>
          </div>
          <div style={{ display:'grid', gap:'10px' }}>
            <div><label className="label">Destination</label><input className="input" placeholder="e.g. Mauritius, Dubai" value={form.destination} onChange={e => setForm(p=>({...p,destination:e.target.value}))}/></div>
            <div><label className="label">Booking Notes</label><textarea className="input" style={{ minHeight:'84px', resize:'vertical', fontSize:'13px' }} value={form.booking_notes} onChange={e => setForm(p=>({...p,booking_notes:e.target.value}))}/></div>
          </div>
        </div>
      </div>

      {/* Right sidebar */}
      <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
        {/* Client */}
        <div className="card" style={{ padding:'16px 18px' }}>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'10px' }}>Lead Client</div>
          {client ? (
            <div>
              <div style={{ fontSize:'15px', fontWeight:'500', marginBottom:'6px' }}>{client.first_name} {client.last_name}</div>
              {client.phone && <div style={{ fontSize:'13px', color:'var(--text-muted)', marginBottom:'3px' }}>📞 {client.phone}</div>}
              {client.email && <a href={`mailto:${client.email}`} style={{ fontSize:'13px', color:'var(--accent)', textDecoration:'none', display:'block' }}>✉ {client.email}</a>}
            </div>
          ) : <div style={{ color:'var(--text-muted)', fontSize:'13px' }}>No client linked</div>}
        </div>

        {/* Key dates */}
        <div className="card" style={{ padding:'16px 18px' }}>
          <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'10px' }}>Key Dates</div>
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {[
              { label:'Booked',    val:fmtDate(booking.created_at),    color:'var(--text-muted)', sub:'' },
            ].map(d => (
              <div key={d.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>{d.label}</span>
                <span style={{ fontSize:'13px', color:d.color, fontWeight:'500' }}>{d.val}</span>
              </div>
            ))}
            {/* Departure — with flight sync */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>Departure</span>
              <div style={{ textAlign:'right' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                  <span style={{ fontSize:'13px', color:'var(--accent)', fontWeight:'500' }}>{fmtDate(booking.departure_date)}</span>
                  {depDateMismatch && (
                    <button onClick={syncDepartureFromFlight}
                      style={{ background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:'4px', cursor:'pointer', fontSize:'10.5px', color:'#92400e', padding:'1px 6px', fontWeight:'600' }}
                      title={`Flight departs ${fmtDate(flightDepDate)} — click to sync`}>
                      ⟳ {fmtDate(flightDepDate)}
                    </button>
                  )}
                </div>
                {depDays !== null && depDays >= 0
                  ? <div style={{ fontSize:'10.5px', color:'var(--text-muted)' }}>{depDays}d away</div>
                  : depDays !== null
                    ? <div style={{ fontSize:'10.5px', color:'var(--text-muted)' }}>Departed</div>
                    : null}
              </div>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>Return</span>
              <div style={{ textAlign:'right' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                  <span style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:'500' }}>{fmtDate(booking.return_date)}</span>
                  {returnDateMismatch && (
                    <button onClick={syncReturnFromFlight}
                      style={{ background:'#ede9fe', border:'1px solid #c4b5fd', borderRadius:'4px', cursor:'pointer', fontSize:'10.5px', color:'#5b21b6', padding:'1px 6px', fontWeight:'600' }}
                      title={`Flights return on ${fmtDate(flightReturnDate)} — click to sync`}>
                      ⟳ {fmtDate(flightReturnDate)}
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Balance Due — inline editable */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:'4px', borderTop:'1px solid var(--border)' }}>
              <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>Balance Due</span>
              {editingBalDue ? (
                <div style={{ display:'flex', gap:'5px', alignItems:'center' }}>
                  <DateInput value={balDueDraft} onChange={setBalDueDraft}
                    style={{ fontSize:'12px', width:'130px' }} />
                  <button className="btn btn-cta btn-xs" onClick={saveBalDue}>✓</button>
                  <button className="btn btn-ghost btn-xs" onClick={() => setEditingBalDue(false)}>✕</button>
                </div>
              ) : (
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:'13px', color: balance <= 0 ? 'var(--green)' : 'var(--red)', fontWeight:'500' }}>
                      {fmtDate(booking.balance_due_date)}
                    </span>
                    {balance <= 0 && <div style={{ fontSize:'10.5px', color:'var(--text-muted)' }}>Paid ✓</div>}
                  </div>
                  <button onClick={() => setEditingBalDue(true)}
                    style={{ background:'none', border:'none', cursor:'pointer', fontSize:'11px', color:'var(--text-muted)', padding:'2px', opacity:0.6 }}
                    title="Edit balance due date">✏</button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Task progress */}
        <div className="card" style={{ padding:'16px 18px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'10px' }}>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Task Progress</div>
            <span style={{ fontSize:'12px', color: taskPct===100 ? 'var(--green)' : 'var(--text-muted)' }}>{tasksDone}/{tasksTotal}</span>
          </div>
          <div style={{ height:'6px', background:'var(--border)', borderRadius:'3px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${taskPct}%`, background: taskPct===100 ? 'var(--green)' : 'var(--accent)', borderRadius:'3px', transition:'width 0.3s' }}/>
          </div>
          <div style={{ fontSize:'11.5px', color:'var(--text-muted)', marginTop:'6px' }}>{taskPct}% complete</div>
        </div>
      </div>
    </div>
  )
}

// ── PASSENGERS TAB ───────────────────────────────────────────
function PassengersTab({ bookingId, passengers, onUpdate, showToast }: any) {
  const blank = { title:'Mr', first_name:'', last_name:'', date_of_birth:'', passenger_type:'Adult', is_lead:false, passport_number:'', passport_expiry:'' }
  const [adding, setAdding]   = useState(false)
  const [form, setForm]       = useState({ ...blank })
  const [saving, setSaving]   = useState(false)
  const [editing, setEditing] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const passengerFormGridStyle = {
    display: 'grid',
    gridTemplateColumns: '80px minmax(150px, 1fr) minmax(150px, 1fr) 130px 170px',
    gap: '10px',
    alignItems: 'end',
  } as const

  async function addPassenger() {
    if (!form.first_name.trim() || !form.last_name.trim()) { showToast('Name required', 'error'); return }
    setSaving(true)
    try {
      const response = await authedFetch(`/api/bookings/${bookingId}/passengers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          date_of_birth: form.date_of_birth || null,
          passenger_type: form.passenger_type,
          is_lead: passengers.length === 0 ? true : form.is_lead,
          passport_number: form.passport_number || null,
          passport_expiry: form.passport_expiry || null,
        }),
      })
      const result = await response.json()
      if (result.success) {
        showToast('Passenger added ✓')
        setAdding(false)
        setForm({ ...blank })
        onUpdate()
      } else {
        showToast('Failed: ' + result.message, 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to add passenger', 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveEdit(id: number) {
    try {
      const response = await authedFetch(`/api/bookings/${bookingId}/passengers`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          passengerId: id,
          title: editForm.title,
          first_name: editForm.first_name,
          last_name: editForm.last_name,
          date_of_birth: editForm.date_of_birth || null,
          passenger_type: editForm.passenger_type,
          is_lead: editForm.is_lead,
          passport_number: editForm.passport_number || null,
          passport_expiry: editForm.passport_expiry || null,
        }),
      })
      const result = await response.json()
      if (result.success) {
        showToast('Passenger updated ✓')
        setEditing(null)
        onUpdate()
      } else {
        showToast('Failed: ' + result.message, 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update passenger', 'error')
    }
  }

  async function deletePax(id: number) {
    try {
      const response = await authedFetch(`/api/bookings/${bookingId}/passengers?passengerId=${id}`, {
        method: 'DELETE',
      })
      const result = await response.json()
      if (result.success) {
        showToast('Passenger removed')
        onUpdate()
      } else {
        showToast('Failed: ' + result.message, 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to remove passenger', 'error')
    }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Passengers ({passengers.length})</div>
        <button className="btn btn-cta" onClick={() => setAdding(true)}>+ Add Passenger</button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
        {passengers.map((p: Passenger) => (
          <div key={p.id} className="card" style={{ padding:'16px 18px', borderLeft:`3px solid ${p.is_lead ? 'var(--gold,#f59e0b)' : 'var(--border)'}` }}>
            {editing === p.id ? (
              <div style={passengerFormGridStyle}>
                <div><label className="label">Title</label><select className="input" value={editForm.title} onChange={e=>setEditForm((f:any)=>({...f,title:e.target.value}))}>{TITLES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label className="label">First Name</label><input className="input" value={editForm.first_name} onChange={e=>setEditForm((f:any)=>({...f,first_name:e.target.value}))}/></div>
                <div><label className="label">Last Name</label><input className="input" value={editForm.last_name} onChange={e=>setEditForm((f:any)=>({...f,last_name:e.target.value}))}/></div>
                <div><label className="label">Type</label><select className="input" value={editForm.passenger_type} onChange={e=>setEditForm((f:any)=>({...f,passenger_type:e.target.value}))}>{PAX_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label className="label">DOB</label><DateInput value={editForm.date_of_birth||''} onChange={v=>setEditForm((f:any)=>({...f,date_of_birth:v}))}/></div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', paddingTop:'18px' }}>
                  <input type="checkbox" checked={editForm.is_lead} onChange={e=>setEditForm((f:any)=>({...f,is_lead:e.target.checked}))}/> <span style={{ fontSize:'13px' }}>Lead passenger</span>
                </div>
                <div style={{ gridColumn:'1/-1', display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                  <button className="btn btn-secondary btn-xs" onClick={()=>setEditing(null)}>Cancel</button>
                  <button className="btn btn-cta btn-xs" onClick={()=>saveEdit(p.id)}>Save</button>
                </div>
              </div>
            ) : (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                    <span style={{ fontSize:'15px', fontWeight:'500' }}>{p.title} {p.first_name} {p.last_name}</span>
                    {p.is_lead && <span style={{ fontSize:'10px', background:'#fef3c7', color:'#d97706', padding:'1px 7px', borderRadius:'10px', fontWeight:'600' }}>LEAD</span>}
                    {(() => {
                      const age = calcAge(p.date_of_birth)
                      const label = age === null ? p.passenger_type
                        : age <= 1 ? 'Infant'
                        : age <= 11 ? 'Child'
                        : age <= 17 ? 'Teen'
                        : 'Adult'
                      return <span style={{ fontSize:'11px', color:'var(--text-muted)', background:'var(--bg-tertiary)', padding:'1px 7px', borderRadius:'10px' }}>{label}</span>
                    })()}
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', display:'flex', gap:'16px' }}>
                    {p.date_of_birth && <span>DOB: {fmtDate(p.date_of_birth)}{calcAge(p.date_of_birth) !== null ? ` (age ${calcAge(p.date_of_birth)})` : ''}</span>}
                    {p.passport_number && <span>Passport: {p.passport_number}{p.passport_expiry ? ` (exp ${fmtDate(p.passport_expiry)})` : ''}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button className="btn btn-secondary btn-xs" onClick={()=>{ setEditing(p.id); setEditForm({...p, title: TITLES.includes(p.title) ? p.title : TITLES[0], date_of_birth: p.date_of_birth?.split('T')[0]||'', passport_expiry: p.passport_expiry?.split('T')[0]||'' }) }}>Edit</button>
                  <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }} onClick={()=>deletePax(p.id)}>✕</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {adding && (
          <div className="card" style={{ padding:'18px 20px', border:'1.5px solid var(--accent)' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:'15px', fontWeight:'300', marginBottom:'14px' }}>New Passenger</div>
            <div style={{ ...passengerFormGridStyle, marginBottom:'10px' }}>
              <div><label className="label">Title</label><select className="input" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}>{TITLES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label className="label">First Name *</label><input className="input" autoFocus value={form.first_name} onChange={e=>setForm(p=>({...p,first_name:e.target.value}))}/></div>
              <div><label className="label">Last Name *</label><input className="input" value={form.last_name} onChange={e=>setForm(p=>({...p,last_name:e.target.value}))}/></div>
              <div><label className="label">Type</label><select className="input" value={form.passenger_type} onChange={e=>setForm(p=>({...p,passenger_type:e.target.value}))}>{PAX_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label className="label">DOB</label><DateInput value={form.date_of_birth} onChange={v=>setForm(p=>({...p,date_of_birth:v}))}/></div>
            </div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
              <button className="btn btn-secondary" onClick={()=>setAdding(false)}>Cancel</button>
              <button className="btn btn-cta" onClick={addPassenger} disabled={saving}>{saving?'Adding…':'Add Passenger'}</button>
            </div>
          </div>
        )}

        {passengers.length === 0 && !adding && (
          <div className="card" style={{ padding:'32px', textAlign:'center' }}>
            <div style={{ color:'var(--text-muted)', fontSize:'13px', marginBottom:'12px' }}>No passengers added yet</div>
            <button className="btn btn-cta" onClick={() => setAdding(true)}>+ Add First Passenger</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── LEG FORM (module-level to prevent re-mount on parent state change) ───────
function LegForm({ leg, onChange, onRemove, idx, canRemove, idSuffix }: any) {
  const [hint, setHint] = useState<string | null>(null)

  async function lookupFlight(fn: string) {
    if (!fn || fn.length < 4) return
    const { data } = await apiRequest<{ data: Record<string, any> | null }>(`/api/bookings/0/flights?flightNumber=${encodeURIComponent(fn.toUpperCase())}`)
    if (!data) return
    const filled: string[] = []
    if (data.airline && !leg.airline) { onChange('airline', data.airline); filled.push('airline') }
    if (data.departure_time && !leg.departure_time) { onChange('departure_time', data.departure_time); filled.push('depart time') }
    if (data.arrival_time && !leg.arrival_time) { onChange('arrival_time', data.arrival_time); filled.push('arrive time') }
    if (data.origin && !leg.origin) { onChange('origin', data.origin); filled.push('origin') }
    if (data.destination && !leg.destination) { onChange('destination', data.destination); filled.push('destination') }
    if (data.next_day && !leg.next_day) { onChange('next_day', data.next_day) }
    if (filled.length > 0) setHint(`✓ Known flight — auto-filled: ${filled.join(', ')}`)
    else setHint('✓ Known flight')
    setTimeout(() => setHint(null), 4000)
  }

  return (
    <div style={{ background:'var(--bg-secondary)', borderRadius:'8px', padding:'14px 16px', position:'relative' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'12px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Leg {idx + 1}</span>
          {hint && <span style={{ fontSize:'11px', color:'var(--green)', fontStyle:'italic' }}>{hint}</span>}
        </div>
        {canRemove && <button type="button" onClick={onRemove} style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:'16px', lineHeight:1 }}>✕</button>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr', gap:'10px' }}>
        <div>
          <label className="label">Flight No *</label>
          <input className="input" placeholder="BA2065" value={leg.flight_number}
            onChange={e=>onChange('flight_number', e.target.value)}
            onBlur={e=>lookupFlight(e.target.value)}/>
        </div>
        <div>
          <label className="label">Airline</label>
          <input className="input" list={`al-${idSuffix}-${idx}`} placeholder="British Airways" value={leg.airline} onChange={e=>onChange('airline', e.target.value)}/>
          <datalist id={`al-${idSuffix}-${idx}`}>{AIRLINES.map((a:string)=><option key={a} value={a}/>)}</datalist>
        </div>
        <div>
          <label className="label">Origin</label>
          <input className="input" list={`ap-${idSuffix}-${idx}`} placeholder="LGW" value={leg.origin} onChange={e=>onChange('origin', e.target.value.toUpperCase())}/>
          <datalist id={`ap-${idSuffix}-${idx}`}>{AIRPORTS.map((a:any)=><option key={a.code} value={a.code}>{a.name}</option>)}</datalist>
        </div>
        <div>
          <label className="label">Destination</label>
          <input className="input" list={`ap-${idSuffix}-${idx}`} placeholder="MRU" value={leg.destination} onChange={e=>onChange('destination', e.target.value.toUpperCase())}/>
        </div>
        <div><label className="label">Terminal</label><input className="input" placeholder="e.g. N, S, 2, 5" value={leg.terminal||''} onChange={e=>onChange('terminal', e.target.value)}/></div>
        <div><label className="label">Departure Date</label><DateInput value={leg.departure_date} onChange={v=>onChange('departure_date', v)}/></div>
        <div><label className="label">Depart Time</label><input className="input" placeholder="21:00" value={leg.departure_time} onChange={e=>onChange('departure_time', e.target.value)}/></div>
        <div><label className="label">Arrive Time</label><input className="input" placeholder="11:55" value={leg.arrival_time} onChange={e=>onChange('arrival_time', e.target.value)}/></div>
        <div style={{ display:'flex', flexDirection:'column', justifyContent:'flex-end', paddingBottom:'6px' }}>
          <label style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'13px', cursor:'pointer' }}>
            <input type="checkbox" checked={leg.next_day} onChange={e=>onChange('next_day', e.target.checked)}/> Arrives next day
          </label>
        </div>
        <div style={{ gridColumn:'1/-1' }}><label className="label">Cabin Class Notes <span style={{ textTransform:'none', fontWeight:'400', letterSpacing:'0' }}>(mixed cabin only)</span></label><input className="input" placeholder="e.g. Mr Smith travelling Business Class on this leg" value={leg.cabin_notes} onChange={e=>onChange('cabin_notes', e.target.value)}/></div>
        {idx > 0 && (
          <div style={{ gridColumn:'1/-1', display:'flex', flexDirection:'column', gap:'6px' }}>
            <label style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'13px', cursor:'pointer' }}>
              <input type="checkbox" checked={leg.use_segment_deadline ?? true} onChange={e=>{ onChange('use_segment_deadline', e.target.checked); if (e.target.checked) onChange('ticketing_deadline', '') }}/> Use segment ticketing deadline
            </label>
            {!leg.use_segment_deadline && (
              <div style={{ maxWidth:'200px' }}><label className="label">Custom deadline for this leg</label><DateInput value={leg.ticketing_deadline||''} onChange={v=>onChange('ticketing_deadline', v)}/></div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const blankLeg = () => ({ flight_number:'', airline:'', origin:'', destination:'', terminal:'', departure_date:'', departure_time:'', arrival_time:'', next_day:false, cabin_notes:'', ticketing_deadline:'', use_segment_deadline:true })

// ── FLIGHTS TAB ──────────────────────────────────────────────
function FlightsTab({ bookingId, outbound, returnFlts, suppliers, onUpdate, showToast }: any) {
  const flightSuppliers = (suppliers || []).filter((s: Supplier) => s.type === 'flight' || s.type === 'other')
  const allLegs = [...outbound, ...returnFlts]
  const totalNet = allLegs.reduce((a: number, f: Flight) => a + (f.net_cost || 0), 0)

  // ── segment form state ──
  const blankSeg = { direction:'outbound' as 'outbound'|'return', pnr:'', flight_supplier:'', net_cost:'', cabin_class:'Economy', baggage_notes:'', ticketing_deadline:'', legs:[blankLeg()] }
  const [adding, setAdding]     = useState(false)
  const [seg, setSeg]           = useState<any>({ ...blankSeg })
  const [saving, setSaving]     = useState(false)
  const [editingLeg, setEditingLeg] = useState<number|null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [addingLegSeg, setAddingLegSeg] = useState<{ segmentId: number; direction: 'outbound'|'return'; firstLeg: Flight } | null>(null)
  const [newLegForm, setNewLegForm] = useState<any>(blankLeg())

  function updateLeg(idx: number, key: string, val: any) {
    setSeg((p: any) => { const legs = [...p.legs]; legs[idx] = { ...legs[idx], [key]: val }; return { ...p, legs } })
  }
  function addLeg() { setSeg((p: any) => ({ ...p, legs: [...p.legs, blankLeg()] })) }
  function removeLeg(idx: number) { setSeg((p: any) => ({ ...p, legs: p.legs.filter((_: any, i: number) => i !== idx) })) }

  async function saveSegment() {
    if (seg.legs.some((l: any) => !l.flight_number.trim())) { showToast('All legs need a flight number', 'error'); return }
    setSaving(true)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/flights`, {
        method: 'POST',
        body: JSON.stringify(seg),
      })
      await onUpdate()
      showToast(result.message || `${seg.direction === 'outbound' ? 'Outbound' : 'Return'} segment added ✓`)
      setAdding(false)
      setSeg({ ...blankSeg })
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveEditLeg(id: number) {
    setSaving(true)
    const { use_segment_deadline, ...editPayload } = editForm
    if (use_segment_deadline) editPayload.ticketing_deadline = null
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/flights`, {
        method: 'PUT',
        body: JSON.stringify({ legId: id, ...editPayload }),
      })
      await onUpdate()
      showToast(result.message || 'Leg updated ✓')
      setEditingLeg(null)
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveNewLegToSegment(segmentId: number, dir: 'outbound'|'return', firstLeg: Flight) {
    if (!newLegForm.flight_number.trim()) { showToast('Flight number required', 'error'); return }
    setSaving(true)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/flights`, {
        method: 'POST',
        body: JSON.stringify({ segmentId, direction: dir, leg: newLegForm, firstLeg }),
      })
      await onUpdate()
      showToast(result.message || 'Connecting leg added ✓')
      setAddingLegSeg(null)
      setNewLegForm(blankLeg())
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteLeg(id: number) {
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/flights?legId=${id}`, {
        method: 'DELETE',
      })
      await onUpdate()
      showToast(result.message || 'Leg removed')
    } catch (error: any) {
      showToast(error.message || 'Failed to delete leg', 'error')
    }
  }

  // Group legs into segments for display
  function renderDirection(legs: Flight[], direction: 'outbound'|'return') {
    if (legs.length === 0 && adding && seg.direction === direction) return null
    const segments = legs.reduce((acc: Record<number, Flight[]>, f) => {
      const sid = f.segment_id || 1
      if (!acc[sid]) acc[sid] = []
      acc[sid].push(f)
      return acc
    }, {})
    return (
      <div className="card" style={{ padding:'18px 20px', marginBottom:'14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
          <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300' }}>
            {direction === 'outbound' ? '✈ Outbound' : '✈ Return'}
            {legs.length > 0 && <span style={{ fontSize:'13px', color:'var(--text-muted)', fontFamily:'Outfit,sans-serif', marginLeft:'8px' }}>{Object.keys(segments).length} segment{Object.keys(segments).length !== 1 ? 's' : ''} · {legs.length} leg{legs.length !== 1 ? 's' : ''}</span>}
          </div>
          <button className="btn btn-secondary btn-xs" onClick={() => { setAdding(true); setSeg({ ...blankSeg, direction }) }}>+ Add Segment</button>
        </div>
        {legs.length === 0 ? (
          <div style={{ color:'var(--text-muted)', fontSize:'13px', fontStyle:'italic' }}>No {direction} flights yet</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {Object.entries(segments).map(([sid, segLegs]: [string, any]) => {
              const first = segLegs[0]
              const segNet = first.net_cost
              // Ticketing deadline: use stored value or auto-calc 12 weeks before first leg departure
              const storedDeadline = first.ticketing_deadline
              const autoDeadline = (() => {
                const dep = first.departure_date
                if (!dep) return null
                const d = new Date(dep.includes('T') ? dep : dep + 'T12:00')
                d.setDate(d.getDate() - 84)
                return d.toISOString().split('T')[0]
              })()
              const deadlineDate = storedDeadline || autoDeadline
              const deadlineLabel = deadlineDate ? new Date(deadlineDate + 'T12:00').toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : null
              const isAutoDeadline = !storedDeadline && !!autoDeadline
              const deadlineUrgent = deadlineDate ? (new Date(deadlineDate + 'T12:00').getTime() - Date.now()) < 14 * 24 * 3600 * 1000 : false
              return (
                <div key={sid} style={{ border:'1px solid var(--border)', borderRadius:'8px', overflow:'hidden' }}>
                  {/* Segment header */}
                  <div style={{ background:'var(--bg-secondary)', padding:'10px 14px', display:'flex', gap:'14px', alignItems:'center', flexWrap:'wrap', borderBottom:'1px solid var(--border)' }}>
                    <span style={{ fontSize:'11px', background: direction==='outbound' ? '#dbeafe' : '#d1fae5', color: direction==='outbound' ? '#2563eb' : '#059669', padding:'2px 8px', borderRadius:'4px', fontWeight:'600' }}>
                      {direction === 'outbound' ? 'Outbound' : 'Return'}
                    </span>
                    <span style={{ fontSize:'12px', fontWeight:'600', color:'var(--text-primary)' }}>{first.cabin_class}</span>
                    {first.flight_supplier && <span style={{ fontSize:'12px', color:'var(--accent)' }}>via {first.flight_supplier}</span>}
                    {first.pnr && <span style={{ fontSize:'12px', fontFamily:'monospace', background:'var(--bg-tertiary)', padding:'1px 8px', borderRadius:'4px' }}>PNR: <strong>{first.pnr}</strong></span>}
                    {deadlineLabel && (
                      <span style={{ fontSize:'11.5px', padding:'2px 8px', borderRadius:'4px', fontWeight:'600',
                        background: deadlineUrgent ? '#fee2e2' : isAutoDeadline ? 'var(--bg-tertiary)' : '#fef3c7',
                        color: deadlineUrgent ? '#dc2626' : isAutoDeadline ? 'var(--text-muted)' : '#92400e',
                      }}>
                        🎫 Ticket by {deadlineLabel}{isAutoDeadline ? ' (auto)' : ''}
                      </span>
                    )}
                    {segNet != null && segNet > 0 && <span style={{ fontSize:'12px', color:'var(--green)', fontWeight:'600', marginLeft:'auto' }}>Net: {fmt(segNet)}</span>}
                    {first.baggage_notes && <span style={{ fontSize:'11.5px', color:'var(--text-muted)' }}>🧳 {first.baggage_notes}</span>}
                  </div>
                  {/* Legs */}
                  <div style={{ padding:'10px 14px', display:'flex', flexDirection:'column', gap:'8px' }}>
                    {segLegs.map((f: Flight, i: number) => (
                      <div key={f.id}>
                        {editingLeg === f.id ? (
                          <div style={{ background:'var(--bg-secondary)', borderRadius:'8px', padding:'14px' }}>
                            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                              <div><label className="label">Flight No</label><input className="input" value={editForm.flight_number} onChange={e=>setEditForm((p:any)=>({...p,flight_number:e.target.value}))}/></div>
                              <div><label className="label">Airline</label><input className="input" value={editForm.airline||''} onChange={e=>setEditForm((p:any)=>({...p,airline:e.target.value}))}/></div>
                              <div><label className="label">Origin</label><input className="input" value={editForm.origin||''} onChange={e=>setEditForm((p:any)=>({...p,origin:e.target.value.toUpperCase()}))}/></div>
                              <div><label className="label">Destination</label><input className="input" value={editForm.destination||''} onChange={e=>setEditForm((p:any)=>({...p,destination:e.target.value.toUpperCase()}))}/></div>
                              <div><label className="label">Depart Date</label><DateInput value={editForm.departure_date||''} onChange={v=>setEditForm((p:any)=>({...p,departure_date:v}))}/></div>
                              <div><label className="label">Depart Time</label><input className="input" value={editForm.departure_time||''} onChange={e=>setEditForm((p:any)=>({...p,departure_time:e.target.value}))}/></div>
                              <div><label className="label">Arrive Time</label><input className="input" value={editForm.arrival_time||''} onChange={e=>setEditForm((p:any)=>({...p,arrival_time:e.target.value}))}/></div>
                              <div><label className="label">Cabin Class</label><select className="input" value={editForm.cabin_class||'Economy'} onChange={e=>setEditForm((p:any)=>({...p,cabin_class:e.target.value}))}>{CABIN_CLASSES.map(c=><option key={c}>{c}</option>)}</select></div>
                              <div><label className="label">PNR</label><input className="input" value={editForm.pnr||''} onChange={e=>setEditForm((p:any)=>({...p,pnr:e.target.value.toUpperCase()}))}/></div>
                              <div><label className="label">Supplier</label>
                                <select className="input" value={editForm.flight_supplier||''} onChange={e=>setEditForm((p:any)=>({...p,flight_supplier:e.target.value}))}>
                                  <option value="">None</option>
                                  {flightSuppliers.map((s:Supplier)=><option key={s.id} value={s.name}>{s.name}</option>)}
                                </select>
                              </div>
                              <div><label className="label">Net Cost (£)</label><input className="input" type="number" value={editForm.net_cost||''} onChange={e=>setEditForm((p:any)=>({...p,net_cost:e.target.value}))}/></div>
                              <div><label className="label">Terminal</label><input className="input" placeholder="e.g. N, S, 2" value={editForm.terminal||''} onChange={e=>setEditForm((p:any)=>({...p,terminal:e.target.value}))}/></div>
                              {i === 0
                                ? <div><label className="label">Ticketing Deadline</label><DateInput value={editForm.ticketing_deadline||''} onChange={v=>setEditForm((p:any)=>({...p,ticketing_deadline:v}))}/></div>
                                : <div style={{ gridColumn:'1/-1', display:'flex', flexDirection:'column', gap:'6px', paddingTop:'2px' }}>
                                    <label style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'13px', cursor:'pointer' }}>
                                      <input type="checkbox" checked={editForm.use_segment_deadline ?? true} onChange={e=>setEditForm((p:any)=>({ ...p, use_segment_deadline: e.target.checked, ticketing_deadline: e.target.checked ? null : p.ticketing_deadline }))}/> Use segment ticketing deadline
                                    </label>
                                    {!editForm.use_segment_deadline && (
                                      <div style={{ maxWidth:'200px' }}><label className="label">Custom deadline for this leg</label><DateInput value={editForm.ticketing_deadline||''} onChange={v=>setEditForm((p:any)=>({...p,ticketing_deadline:v}))}/></div>
                                    )}
                                  </div>
                              }
                              <div><label className="label">Baggage</label><input className="input" value={editForm.baggage_notes||''} onChange={e=>setEditForm((p:any)=>({...p,baggage_notes:e.target.value}))}/></div>
                              <div style={{ gridColumn:'1/-1' }}><label className="label">Cabin Notes</label><input className="input" value={editForm.cabin_notes||''} onChange={e=>setEditForm((p:any)=>({...p,cabin_notes:e.target.value}))}/></div>
                            </div>
                            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                              <button className="btn btn-secondary btn-xs" onClick={()=>setEditingLeg(null)}>Cancel</button>
                              <button className="btn btn-cta btn-xs" onClick={()=>saveEditLeg(f.id)} disabled={saving}>{saving?'Saving…':'Save'}</button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                            <div style={{ width:'20px', height:'20px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'white', fontWeight:'700', flexShrink:0 }}>{i+1}</div>
                            <div style={{ flex:1 }}>
                              <div style={{ display:'flex', gap:'10px', alignItems:'center', flexWrap:'wrap' }}>
                                <span style={{ fontSize:'14px', fontWeight:'700', fontFamily:'monospace' }}>{f.flight_number}</span>
                                <span style={{ fontSize:'13px', color:'var(--text-muted)' }}>{f.airline}</span>
                                {f.next_day && <span style={{ fontSize:'10px', color:'var(--amber)', background:'#fef3c7', padding:'1px 5px', borderRadius:'3px' }}>+1</span>}
                              </div>
                              <div style={{ fontSize:'13px', color:'var(--text-primary)' }}>
                                <strong>{f.origin}</strong>{f.terminal && <span style={{ fontSize:'11px', color:'var(--text-muted)', marginLeft:'3px' }}>T{f.terminal}</span>} {f.departure_time && <span style={{ color:'var(--text-muted)' }}>{f.departure_time}</span>} → <strong>{f.destination}</strong> {f.arrival_time && <span style={{ color:'var(--text-muted)' }}>{f.arrival_time}</span>}
                                <span style={{ color:'var(--text-muted)', fontSize:'12px', marginLeft:'8px' }}>{fmtDate(f.departure_date)}</span>
                              </div>
                              {f.cabin_notes && <div style={{ fontSize:'11.5px', color:'var(--amber)', marginTop:'2px' }}>ℹ {f.cabin_notes}</div>}
                              {i > 0 && f.ticketing_deadline && <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'2px' }}>🎫 Custom deadline: {fmtDate(f.ticketing_deadline)}</div>}
                            </div>
                            <div style={{ display:'flex', gap:'5px' }}>
                              <button className="btn btn-secondary btn-xs" onClick={()=>{ setEditingLeg(f.id); setEditForm({ ...f, departure_date: f.departure_date?.split('T')[0]||'', net_cost: f.net_cost ?? '', use_segment_deadline: i === 0 || !f.ticketing_deadline }) }}>Edit</button>
                              <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }} onClick={()=>deleteLeg(f.id)}>✕</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                    {/* Add connecting leg to existing segment */}
                    {addingLegSeg?.segmentId === Number(sid) ? (
                      <div style={{ borderTop:'1px solid var(--border)', paddingTop:'10px', marginTop:'4px' }}>
                        <LegForm leg={newLegForm} onChange={(k:string,v:any)=>setNewLegForm((p:any)=>({...p,[k]:v}))} onRemove={()=>{}} idx={segLegs.length} canRemove={false} idSuffix={`add-${sid}`} />
                        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'10px' }}>
                          <button className="btn btn-secondary btn-xs" onClick={()=>{ setAddingLegSeg(null); setNewLegForm(blankLeg()) }}>Cancel</button>
                          <button className="btn btn-cta btn-xs" onClick={()=>saveNewLegToSegment(Number(sid), direction, first)} disabled={saving}>{saving?'Saving…':'Add Leg'}</button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ paddingTop:'4px' }}>
                        <button className="btn btn-secondary btn-xs" onClick={()=>{ setAddingLegSeg({ segmentId:Number(sid), direction, firstLeg:first }); setNewLegForm(blankLeg()) }}>+ Add Connecting Leg</button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {/* Total net cost across all segments */}
      {totalNet > 0 && (
        <div style={{ marginBottom:'14px', padding:'10px 16px', background:'var(--bg-secondary)', borderRadius:'8px', display:'flex', gap:'20px', fontSize:'13px' }}>
          <span style={{ color:'var(--text-muted)' }}>Total flights net cost:</span>
          <span style={{ fontWeight:'600', color:'var(--green)' }}>{fmt(totalNet)}</span>
        </div>
      )}

      {renderDirection(outbound, 'outbound')}
      {renderDirection(returnFlts, 'return')}

      {/* Add segment form */}
      {adding && (
        <div className="card" style={{ padding:'22px 24px', border:'1.5px solid var(--accent)' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'18px' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300' }}>
              New {seg.direction === 'outbound' ? 'Outbound' : 'Return'} Segment
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button className="btn btn-secondary btn-xs" style={{ background: seg.direction==='outbound' ? 'var(--accent)' : undefined, color: seg.direction==='outbound' ? 'white' : undefined }}
                onClick={()=>setSeg((p:any)=>({...p,direction:'outbound'}))}>Outbound</button>
              <button className="btn btn-secondary btn-xs" style={{ background: seg.direction==='return' ? 'var(--accent)' : undefined, color: seg.direction==='return' ? 'white' : undefined }}
                onClick={()=>setSeg((p:any)=>({...p,direction:'return'}))}>Return</button>
            </div>
          </div>

          {/* Segment-level fields (shared across all legs) */}
          <div style={{ background:'var(--bg-secondary)', borderRadius:'8px', padding:'14px 16px', marginBottom:'16px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'10px' }}>Segment Details — shared across all legs</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr 1fr', gap:'10px' }}>
              <div>
                <label className="label">Supplier</label>
                <select className="input" value={seg.flight_supplier} onChange={e=>setSeg((p:any)=>({...p,flight_supplier:e.target.value}))}>
                  <option value="">None</option>
                  {flightSuppliers.map((s:Supplier)=><option key={s.id} value={s.name}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="label">PNR / Booking Ref</label><input className="input" placeholder="Q5WR5B" value={seg.pnr} onChange={e=>setSeg((p:any)=>({...p,pnr:e.target.value.toUpperCase()}))}/></div>
              <div><label className="label">Net Cost (£)</label><input className="input" type="number" placeholder="0.00" value={seg.net_cost} onChange={e=>setSeg((p:any)=>({...p,net_cost:e.target.value}))}/></div>
              <div><label className="label">Cabin Class</label><select className="input" value={seg.cabin_class} onChange={e=>setSeg((p:any)=>({...p,cabin_class:e.target.value}))}>{CABIN_CLASSES.map(c=><option key={c}>{c}</option>)}</select></div>
              <div><label className="label">Baggage</label><input className="input" placeholder="2 × 23kg" value={seg.baggage_notes} onChange={e=>setSeg((p:any)=>({...p,baggage_notes:e.target.value}))}/></div>
              <div>
                <label className="label">Ticketing Deadline <span style={{ color:'var(--text-muted)', fontWeight:'400' }}>(auto: −12wk)</span></label>
                <DateInput value={seg.ticketing_deadline} onChange={v=>setSeg((p:any)=>({...p,ticketing_deadline:v}))}/>
              </div>
            </div>
          </div>

          {/* Legs */}
          <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'14px' }}>
            {seg.legs.map((l: any, i: number) => (
              <LegForm key={i} leg={l} onChange={(k:string,v:any)=>updateLeg(i,k,v)} onRemove={()=>removeLeg(i)} idx={i} canRemove={seg.legs.length > 1} idSuffix="new" />
            ))}
          </div>
          <button className="btn btn-secondary btn-xs" style={{ marginBottom:'16px' }} onClick={addLeg}>+ Add Connecting Leg</button>

          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', borderTop:'1px solid var(--border)', paddingTop:'14px' }}>
            <button className="btn btn-secondary" onClick={()=>setAdding(false)}>Cancel</button>
            <button className="btn btn-cta" onClick={saveSegment} disabled={saving}>{saving ? 'Saving…' : `Save ${seg.direction === 'outbound' ? 'Outbound' : 'Return'} Segment (${seg.legs.length} leg${seg.legs.length !== 1 ? 's' : ''})`}</button>
          </div>
        </div>
      )}

      {outbound.length === 0 && returnFlts.length === 0 && !adding && (
        <div className="card" style={{ padding:'40px', textAlign:'center' }}>
          <div style={{ fontSize:'32px', marginBottom:'10px', opacity:0.3 }}>✈</div>
          <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', marginBottom:'8px' }}>No flights added yet</div>
          <div style={{ color:'var(--text-muted)', fontSize:'13px', marginBottom:'16px' }}>Each segment has one supplier, PNR and net cost — add legs for connecting flights</div>
          <div style={{ display:'flex', gap:'8px', justifyContent:'center' }}>
            <button className="btn btn-cta" onClick={()=>{ setAdding(true); setSeg({ ...blankSeg, direction:'outbound' }) }}>+ Add Outbound Segment</button>
            <button className="btn btn-secondary" onClick={()=>{ setAdding(true); setSeg({ ...blankSeg, direction:'return' }) }}>+ Add Return Segment</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── ACCOMMODATION TAB ────────────────────────────────────────
function AccommodationTab({ bookingId, accommodations, hotels, suppliers, passengers, onUpdate, showToast }: any) {
  const blankAccom = { hotel_id:'', hotel_name:'', supplier_id:'', hotel_confirmation:'', checkin_date:'', checkout_date:'', nights:'', room_type:'', room_quantity:'1', board_basis:'Half Board', adults:'2', children:'0', infants:'0', net_cost:'', special_occasion:'', special_requests:'', reservation_status:'pending', reservation_email_to:'' }
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState<any>({ ...blankAccom })
  const [editing, setEditing]   = useState<number|null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving]     = useState(false)
  const totalAdults   = passengers.filter((p:Passenger) => p.passenger_type === 'Adult').length
  const totalChildren = passengers.filter((p:Passenger) => p.passenger_type === 'Child').length

  function onHotelSelect(hotelId: string) {
    const hotel = hotels.find((h: Hotel) => h.id === Number(hotelId))
    setForm((p: any) => ({
      ...p,
      hotel_id: hotelId,
      hotel_name: hotel?.name || p.hotel_name,
      reservation_email_to: hotel?.reservation_email || p.reservation_email_to,
    }))
  }

  async function addAccom() {
    if (!form.hotel_name.trim()) { showToast('Hotel name required', 'error'); return }
    setSaving(true)
    const nights = form.nights ? Number(form.nights) : calcNights(form.checkin_date, form.checkout_date)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/accommodations`, {
        method: 'POST',
        body: JSON.stringify({
          stayOrder: accommodations.length + 1,
          hotel_id: form.hotel_id ? Number(form.hotel_id) : null,
          hotel_name: form.hotel_name.trim(),
          supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
          hotel_confirmation: form.hotel_confirmation || null,
          checkin_date: form.checkin_date || null,
          checkout_date: form.checkout_date || null,
          nights: nights || null,
          room_type: form.room_type || null,
          room_quantity: Number(form.room_quantity) || 1,
          board_basis: form.board_basis || null,
          adults: Number(form.adults) || 2,
          children: Number(form.children) || 0,
          infants: Number(form.infants) || 0,
          net_cost: form.net_cost ? Number(form.net_cost) : null,
          special_occasion: form.special_occasion || null,
          special_requests: form.special_requests || null,
          reservation_status: form.reservation_status,
          reservation_email_to: form.reservation_email_to || null,
        }),
      })
      await onUpdate()
      showToast(result.message || 'Stay added ✓')
      setAdding(false)
      setForm({ ...blankAccom, adults: String(totalAdults||2), children: String(totalChildren||0) })
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveAccomEdit(id: number) {
    setSaving(true)
    const nights = editForm.nights ? Number(editForm.nights) : calcNights(editForm.checkin_date, editForm.checkout_date)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/accommodations`, {
        method: 'PUT',
        body: JSON.stringify({
          accommodationId: id,
          hotel_id: editForm.hotel_id ? Number(editForm.hotel_id) : null,
          hotel_name: editForm.hotel_name?.trim() || null,
          supplier_id: editForm.supplier_id ? Number(editForm.supplier_id) : null,
          hotel_confirmation: editForm.hotel_confirmation || null,
          checkin_date: editForm.checkin_date || null,
          checkout_date: editForm.checkout_date || null,
          nights: nights || null,
          room_type: editForm.room_type || null,
          room_quantity: Number(editForm.room_quantity) || 1,
          board_basis: editForm.board_basis || null,
          adults: Number(editForm.adults) || 2,
          children: Number(editForm.children) || 0,
          infants: Number(editForm.infants) || 0,
          net_cost: editForm.net_cost ? Number(editForm.net_cost) : null,
          special_occasion: editForm.special_occasion || null,
          special_requests: editForm.special_requests || null,
          reservation_email_to: editForm.reservation_email_to || null,
        }),
      })
      await onUpdate()
      showToast(result.message || 'Stay updated ✓')
      setEditing(null)
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function updateResStatus(id: number, status: string) {
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/accommodations`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'reservation_status', accommodationId: id, status }),
      })
      await onUpdate()
      showToast(result.message || 'Status updated')
    } catch (error: any) {
      showToast(error.message || 'Failed to update status', 'error')
    }
  }

  async function deleteAccom(id: number) {
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/accommodations?accommodationId=${id}`, {
        method: 'DELETE',
      })
      await onUpdate()
      showToast(result.message || 'Stay removed')
    } catch (error: any) {
      showToast(error.message || 'Failed to delete stay', 'error')
    }
  }

  const selectedHotel = form.hotel_id ? hotels.find((h: Hotel) => h.id === Number(form.hotel_id)) : null

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Accommodation ({accommodations.length} {accommodations.length===1?'stay':'stays'})</div>
        <button className="btn btn-cta" onClick={() => { setAdding(true); setForm({ ...blankAccom, adults: String(totalAdults||2), children: String(totalChildren||0) }) }}>+ Add Stay</button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
        {accommodations.map((a: Accommodation, i: number) => {
          const resCfg = RES_STATUS[a.reservation_status] || RES_STATUS.pending
          const editHotel = editForm.hotel_id ? hotels.find((h: Hotel) => h.id === Number(editForm.hotel_id)) : null
          return (
            <div key={a.id} className="card" style={{ padding:'18px 20px', border: editing===a.id ? '1.5px solid var(--accent)' : undefined }}>
              {editing === a.id ? (
                <>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:'15px', fontWeight:'300', marginBottom:'14px' }}>Edit Stay {i+1}</div>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                    <div style={{ gridColumn:'1/-1' }}>
                      <label className="label">Hotel</label>
                      <select className="input" value={editForm.hotel_id||''} onChange={e=>{const h=hotels.find((h:Hotel)=>h.id===Number(e.target.value));setEditForm((p:any)=>({...p,hotel_id:e.target.value,hotel_name:h?.name||p.hotel_name,reservation_email_to:h?.reservation_email||p.reservation_email_to}))}}>
                        <option value="">Select from directory…</option>
                        {hotels.map((h:Hotel)=><option key={h.id} value={h.id}>{h.name}</option>)}
                      </select>
                    </div>
                    {!editForm.hotel_id && <div style={{ gridColumn:'1/-1' }}><label className="label">Hotel Name</label><input className="input" value={editForm.hotel_name||''} onChange={e=>setEditForm((p:any)=>({...p,hotel_name:e.target.value}))}/></div>}
                    <div><label className="label">Supplier</label><select className="input" value={editForm.supplier_id||''} onChange={e=>setEditForm((p:any)=>({...p,supplier_id:e.target.value}))}><option value="">No supplier</option>{suppliers.filter((s:Supplier)=>s.type==='hotel'||s.type==='dmc').map((s:Supplier)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                    <div><label className="label">Confirmation Ref</label><input className="input" value={editForm.hotel_confirmation||''} onChange={e=>setEditForm((p:any)=>({...p,hotel_confirmation:e.target.value}))}/></div>
                    <div><label className="label">Check In</label><DateInput value={editForm.checkin_date||''} onChange={v=>setEditForm((p:any)=>({...p,checkin_date:v}))}/></div>
                    <div><label className="label">Check Out</label><DateInput value={editForm.checkout_date||''} onChange={v=>setEditForm((p:any)=>({...p,checkout_date:v}))}/></div>
                    <div><label className="label">Room Type</label><input className="input" list="edit-room-types" value={editForm.room_type||''} onChange={e=>setEditForm((p:any)=>({...p,room_type:e.target.value}))}/>{editHotel?.room_types?.length&&<datalist id="edit-room-types">{editHotel.room_types.map((r:string)=><option key={r} value={r}/>)}</datalist>}</div>
                    <div><label className="label">Rooms</label><input className="input" type="number" min="1" value={editForm.room_quantity||'1'} onChange={e=>setEditForm((p:any)=>({...p,room_quantity:e.target.value}))}/></div>
                    <div><label className="label">Board Basis</label><select className="input" value={editForm.board_basis||''} onChange={e=>setEditForm((p:any)=>({...p,board_basis:e.target.value}))}>{BOARD_BASIS.map(b=><option key={b}>{b}</option>)}</select></div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
                      <div><label className="label">Adults</label><input className="input" type="number" min="0" value={editForm.adults||'0'} onChange={e=>setEditForm((p:any)=>({...p,adults:e.target.value}))}/></div>
                      <div><label className="label">Children</label><input className="input" type="number" min="0" value={editForm.children||'0'} onChange={e=>setEditForm((p:any)=>({...p,children:e.target.value}))}/></div>
                      <div><label className="label">Infants</label><input className="input" type="number" min="0" value={editForm.infants||'0'} onChange={e=>setEditForm((p:any)=>({...p,infants:e.target.value}))}/></div>
                    </div>
                    <div><label className="label">Net Cost (£)</label><input className="input" type="number" value={editForm.net_cost||''} onChange={e=>setEditForm((p:any)=>({...p,net_cost:e.target.value}))}/></div>
                    <div><label className="label">Special Occasion</label><select className="input" value={editForm.special_occasion||''} onChange={e=>setEditForm((p:any)=>({...p,special_occasion:e.target.value}))}><option value="">None</option>{SPECIAL_OCCASIONS.map(o=><option key={o}>{o}</option>)}</select></div>
                    <div style={{ gridColumn:'1/-1' }}><label className="label">Special Requests</label><textarea className="input" style={{ minHeight:'60px', resize:'vertical', fontSize:'13px' }} value={editForm.special_requests||''} onChange={e=>setEditForm((p:any)=>({...p,special_requests:e.target.value}))}/></div>
                    <div style={{ gridColumn:'1/-1' }}><label className="label">Reservation Email</label><input className="input" type="email" value={editForm.reservation_email_to||''} onChange={e=>setEditForm((p:any)=>({...p,reservation_email_to:e.target.value}))}/></div>
                  </div>
                  <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'14px' }}>
                    <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="btn btn-cta" onClick={() => saveAccomEdit(a.id)} disabled={saving}>{saving?'Saving…':'Save Changes'}</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                    <div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300' }}>Stay {i+1}</span>
                        <span style={{ fontSize:'11px', padding:'2px 8px', borderRadius:'10px', background:`${resCfg.color}18`, color:resCfg.color, fontWeight:'500' }}>{resCfg.label}</span>
                        {a.hotel_confirmation && <span style={{ fontSize:'11px', color:'var(--green)', background:'var(--green-light)', padding:'2px 8px', borderRadius:'10px' }}>Ref: {a.hotel_confirmation}</span>}
                      </div>
                      <div style={{ fontSize:'18px', fontWeight:'300', fontFamily:'Fraunces,serif', marginTop:'4px' }}>{a.hotel_name}</div>
                    </div>
                    <div style={{ display:'flex', gap:'6px' }}>
                      <select className="input" style={{ fontSize:'11.5px', padding:'4px 8px', width:'auto' }} value={a.reservation_status} onChange={e => updateResStatus(a.id, e.target.value)}>
                        {Object.entries(RES_STATUS).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                      <button className="btn btn-secondary btn-xs" onClick={() => { setAdding(false); setEditing(a.id); setEditForm({ ...a, checkin_date: a.checkin_date?.split('T')[0]||'', checkout_date: a.checkout_date?.split('T')[0]||'', net_cost: a.net_cost ?? '', hotel_id: a.hotel_id ?? '', supplier_id: a.supplier_id ?? '' }) }}>Edit</button>
                      <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }} onClick={() => deleteAccom(a.id)}>✕</button>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', fontSize:'13px' }}>
                    <div><span style={{ color:'var(--text-muted)', fontSize:'11px' }}>CHECK IN</span><div style={{ fontWeight:'500' }}>{fmtDate(a.checkin_date)}</div></div>
                    <div><span style={{ color:'var(--text-muted)', fontSize:'11px' }}>CHECK OUT</span><div style={{ fontWeight:'500' }}>{fmtDate(a.checkout_date)}</div></div>
                    <div><span style={{ color:'var(--text-muted)', fontSize:'11px' }}>NIGHTS</span><div style={{ fontWeight:'500' }}>{a.nights || calcNights(a.checkin_date, a.checkout_date) || '—'}</div></div>
                    <div><span style={{ color:'var(--text-muted)', fontSize:'11px' }}>ROOM</span><div style={{ fontWeight:'500' }}>{a.room_type || '—'} × {a.room_quantity}</div></div>
                    <div><span style={{ color:'var(--text-muted)', fontSize:'11px' }}>BOARD</span><div style={{ fontWeight:'500' }}>{a.board_basis || '—'}</div></div>
                    <div><span style={{ color:'var(--text-muted)', fontSize:'11px' }}>PAX</span><div style={{ fontWeight:'500' }}>{a.adults}A {a.children>0?`${a.children}C`:''} {a.infants>0?`${a.infants}I`:''}</div></div>
                    <div><span style={{ color:'var(--text-muted)', fontSize:'11px' }}>NET COST</span><div style={{ fontWeight:'500', color:'var(--accent)' }}>{a.net_cost ? fmt(a.net_cost) : '—'}</div></div>
                    {a.special_occasion && <div><span style={{ color:'var(--text-muted)', fontSize:'11px' }}>OCCASION</span><div style={{ color:'var(--gold,#f59e0b)', fontWeight:'500' }}>🎉 {a.special_occasion}</div></div>}
                  </div>
                  {a.special_requests && (
                    <div style={{ marginTop:'10px', padding:'8px 12px', background:'var(--bg-secondary)', borderRadius:'6px', fontSize:'12.5px', color:'var(--text-muted)', borderLeft:'2px solid var(--accent)' }}>
                      <strong style={{ color:'var(--text-primary)' }}>Special Requests:</strong> {a.special_requests}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}

        {adding && (
          <div className="card" style={{ padding:'20px 22px', border:'1.5px solid var(--accent)' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', marginBottom:'16px' }}>Add Stay {accommodations.length + 1}</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Hotel</label>
                <select className="input" value={form.hotel_id} onChange={e => onHotelSelect(e.target.value)}>
                  <option value="">Select from directory…</option>
                  {hotels.map((h: Hotel) => <option key={h.id} value={h.id}>{h.name}</option>)}
                </select>
              </div>
              {!form.hotel_id && (
                <div style={{ gridColumn:'1/-1' }}>
                  <label className="label">Or enter hotel name manually</label>
                  <input className="input" placeholder="Hotel name" value={form.hotel_name} onChange={e=>setForm((p:any)=>({...p,hotel_name:e.target.value}))}/>
                </div>
              )}
              <div>
                <label className="label">Supplier</label>
                <select className="input" value={form.supplier_id} onChange={e=>setForm((p:any)=>({...p,supplier_id:e.target.value}))}>
                  <option value="">No supplier</option>
                  {suppliers.filter((s:Supplier)=>s.type==='hotel'||s.type==='dmc').map((s:Supplier)=><option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div><label className="label">Hotel Confirmation Ref</label><input className="input" placeholder="Optional" value={form.hotel_confirmation} onChange={e=>setForm((p:any)=>({...p,hotel_confirmation:e.target.value}))}/></div>
              <div><label className="label">Check In</label><DateInput value={form.checkin_date} onChange={v=>setForm((p:any)=>({...p,checkin_date:v}))}/></div>
              <div><label className="label">Check Out</label><DateInput value={form.checkout_date} onChange={v=>setForm((p:any)=>({...p,checkout_date:v}))}/></div>
              <div>
                <label className="label">Room Type</label>
                <input className="input" list="room-types-list" placeholder="e.g. Prestige Room" value={form.room_type} onChange={e=>setForm((p:any)=>({...p,room_type:e.target.value}))}/>
                {selectedHotel?.room_types?.length && <datalist id="room-types-list">{selectedHotel.room_types.map((r:string)=><option key={r} value={r}/>)}</datalist>}
              </div>
              <div><label className="label">Rooms</label><input className="input" type="number" min="1" value={form.room_quantity} onChange={e=>setForm((p:any)=>({...p,room_quantity:e.target.value}))}/></div>
              <div>
                <label className="label">Board Basis</label>
                <select className="input" value={form.board_basis} onChange={e=>setForm((p:any)=>({...p,board_basis:e.target.value}))}>
                  {BOARD_BASIS.map(b=><option key={b}>{b}</option>)}
                  {selectedHotel?.meal_plans?.filter((m:string)=>!BOARD_BASIS.includes(m)).map((m:string)=><option key={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'8px' }}>
                <div><label className="label">Adults</label><input className="input" type="number" min="0" value={form.adults} onChange={e=>setForm((p:any)=>({...p,adults:e.target.value}))}/></div>
                <div><label className="label">Children</label><input className="input" type="number" min="0" value={form.children} onChange={e=>setForm((p:any)=>({...p,children:e.target.value}))}/></div>
                <div><label className="label">Infants</label><input className="input" type="number" min="0" value={form.infants} onChange={e=>setForm((p:any)=>({...p,infants:e.target.value}))}/></div>
              </div>
              <div><label className="label">Net Cost (£)</label><input className="input" type="number" placeholder="0.00" value={form.net_cost} onChange={e=>setForm((p:any)=>({...p,net_cost:e.target.value}))}/></div>
              <div>
                <label className="label">Special Occasion</label>
                <select className="input" value={form.special_occasion} onChange={e=>setForm((p:any)=>({...p,special_occasion:e.target.value}))}>
                  <option value="">None</option>
                  {SPECIAL_OCCASIONS.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Special Requests</label>
                <textarea className="input" style={{ minHeight:'70px', resize:'vertical', fontSize:'13px' }} placeholder="Early check-in, ground floor room, room configuration…" value={form.special_requests} onChange={e=>setForm((p:any)=>({...p,special_requests:e.target.value}))}/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Reservation Email To</label>
                <input className="input" type="email" placeholder="reservations@hotel.com" value={form.reservation_email_to} onChange={e=>setForm((p:any)=>({...p,reservation_email_to:e.target.value}))}/>
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'14px' }}>
              <button className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn btn-cta" onClick={addAccom} disabled={saving}>{saving?'Adding…':'Add Stay'}</button>
            </div>
          </div>
        )}

        {accommodations.length === 0 && !adding && (
          <div className="card" style={{ padding:'32px', textAlign:'center' }}>
            <div style={{ color:'var(--text-muted)', fontSize:'13px', marginBottom:'12px' }}>No accommodation added yet</div>
            <button className="btn btn-cta" onClick={() => setAdding(true)}>+ Add First Stay</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TRANSFERS TAB ────────────────────────────────────────────
function TransfersTab({ bookingId, transfers, suppliers, flights, onUpdate, showToast }: any) {
  const blankTransfer = { supplier_id:'', supplier_name:'', transfer_type:'private', meet_greet:true, local_rep:true, arrival_date:'', arrival_time:'', arrival_flight:'', departure_date:'', departure_time:'', departure_flight:'', inter_hotel_dates:'', net_cost:'', notes:'', confirmation_reference:'' }
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState<any>({ ...blankTransfer })
  const [editing, setEditing]   = useState<number|null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving]     = useState(false)

  const outboundFlights = [...flights].filter((f: Flight) => f.direction === 'outbound').sort((a: Flight, b: Flight) => a.leg_order - b.leg_order)
  const returnFlights   = [...flights].filter((f: Flight) => f.direction === 'return').sort((a: Flight, b: Flight) => a.leg_order - b.leg_order)
  const arrFlight = outboundFlights[outboundFlights.length - 1] ?? null
  const depFlight = returnFlights[0] ?? null

  async function addTransfer() {
    setSaving(true)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/transfers`, {
        method: 'POST',
        body: JSON.stringify({
          supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
          supplier_name: form.supplier_name || null,
          transfer_type: form.transfer_type,
          meet_greet: form.meet_greet,
          local_rep: form.local_rep,
          arrival_date: form.arrival_date || null,
          arrival_time: form.arrival_time || null,
          arrival_flight: form.arrival_flight || null,
          departure_date: form.departure_date || null,
          departure_time: form.departure_time || null,
          departure_flight: form.departure_flight || null,
          inter_hotel_dates: form.inter_hotel_dates || null,
          net_cost: form.net_cost ? Number(form.net_cost) : null,
          notes: form.notes || null,
          confirmation_reference: form.confirmation_reference || null,
        }),
      })
      await onUpdate()
      showToast(result.message || 'Transfer added ✓')
      setAdding(false)
      setForm({ ...blankTransfer })
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveTransferEdit(id: number) {
    setSaving(true)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/transfers`, {
        method: 'PUT',
        body: JSON.stringify({
          transferId: id,
          supplier_id: editForm.supplier_id ? Number(editForm.supplier_id) : null,
          supplier_name: editForm.supplier_name || null,
          transfer_type: editForm.transfer_type,
          meet_greet: editForm.meet_greet,
          local_rep: editForm.local_rep,
          arrival_date: editForm.arrival_date || null,
          arrival_time: editForm.arrival_time || null,
          arrival_flight: editForm.arrival_flight || null,
          departure_date: editForm.departure_date || null,
          departure_time: editForm.departure_time || null,
          departure_flight: editForm.departure_flight || null,
          inter_hotel_dates: editForm.inter_hotel_dates || null,
          net_cost: editForm.net_cost ? Number(editForm.net_cost) : null,
          notes: editForm.notes || null,
          confirmation_reference: editForm.confirmation_reference || null,
        }),
      })
      await onUpdate()
      showToast(result.message || 'Transfer updated ✓')
      setEditing(null)
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteTransfer(id: number) {
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/transfers?transferId=${id}`, {
        method: 'DELETE',
      })
      await onUpdate()
      showToast(result.message || 'Transfer removed')
    } catch (error: any) {
      showToast(error.message || 'Failed to delete transfer', 'error')
    }
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Transfers</div>
        <button className="btn btn-cta" onClick={() => {
          const deriveArrivalDate = (f: Flight | null): string => {
            if (!f?.departure_date) return ''
            if (f.next_day) {
              const d = new Date(f.departure_date + 'T12:00')
              d.setDate(d.getDate() + 1)
              return d.toISOString().split('T')[0]
            }
            return f.departure_date.split('T')[0]
          }
          setAdding(true)
          setForm({
            ...blankTransfer,
            arrival_flight:   arrFlight ? (arrFlight.flight_number || '') : '',
            arrival_date:     deriveArrivalDate(arrFlight),
            arrival_time:     arrFlight ? (arrFlight.arrival_time || '') : '',
            departure_flight: depFlight ? (depFlight.flight_number || '') : '',
            departure_date:   depFlight ? (depFlight.departure_date?.split('T')[0] || '') : '',
            departure_time:   depFlight ? (depFlight.departure_time || '') : '',
          })
        }}>+ Add Transfers</button>
      </div>

      {transfers.map((t: Transfer) => (
        <div key={t.id} className="card" style={{ padding:'18px 20px', marginBottom:'12px', border: editing===t.id ? '1.5px solid var(--accent)' : undefined }}>
          {editing === t.id ? (
            <>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:'15px', fontWeight:'300', marginBottom:'14px' }}>Edit Transfer</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div><label className="label">Supplier</label><select className="input" value={editForm.supplier_id||''} onChange={e=>{const s=suppliers.find((s:Supplier)=>s.id===Number(e.target.value));setEditForm((p:any)=>({...p,supplier_id:e.target.value,supplier_name:s?.name||p.supplier_name}))}}><option value="">Select supplier…</option>{suppliers.filter((s:Supplier)=>s.type==='transfer'||s.type==='dmc').map((s:Supplier)=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label className="label">Transfer Type</label><select className="input" value={editForm.transfer_type} onChange={e=>setEditForm((p:any)=>({...p,transfer_type:e.target.value}))}>{TRANSFER_TYPES.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></div>
                <div style={{ display:'flex', gap:'16px', paddingTop:'4px' }}>
                  <label style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'13px', cursor:'pointer' }}><input type="checkbox" checked={editForm.meet_greet} onChange={e=>setEditForm((p:any)=>({...p,meet_greet:e.target.checked}))}/> Meet & Greet</label>
                  <label style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'13px', cursor:'pointer' }}><input type="checkbox" checked={editForm.local_rep} onChange={e=>setEditForm((p:any)=>({...p,local_rep:e.target.checked}))}/> Local Rep</label>
                </div>
                <div><label className="label">Net Cost (£)</label><input className="input" type="number" value={editForm.net_cost||''} onChange={e=>setEditForm((p:any)=>({...p,net_cost:e.target.value}))}/></div>
                <div><label className="label">Arrival Flight</label><input className="input" value={editForm.arrival_flight||''} onChange={e=>setEditForm((p:any)=>({...p,arrival_flight:e.target.value.toUpperCase()}))}/></div>
                <div><label className="label">Arrival Date & Time</label><div style={{ display:'flex', gap:'8px' }}><DateInput value={editForm.arrival_date||''} onChange={v=>setEditForm((p:any)=>({...p,arrival_date:v}))}/><input className="input" style={{ width:'100px' }} value={editForm.arrival_time||''} onChange={e=>setEditForm((p:any)=>({...p,arrival_time:e.target.value}))}/></div></div>
                <div><label className="label">Departure Flight</label><input className="input" value={editForm.departure_flight||''} onChange={e=>setEditForm((p:any)=>({...p,departure_flight:e.target.value.toUpperCase()}))}/></div>
                <div><label className="label">Departure Date & Time</label><div style={{ display:'flex', gap:'8px' }}><DateInput value={editForm.departure_date||''} onChange={v=>setEditForm((p:any)=>({...p,departure_date:v}))}/><input className="input" style={{ width:'100px' }} value={editForm.departure_time||''} onChange={e=>setEditForm((p:any)=>({...p,departure_time:e.target.value}))}/></div></div>
                <div style={{ gridColumn:'1/-1' }}><label className="label">Inter-Hotel Transfer Dates</label><input className="input" value={editForm.inter_hotel_dates||''} onChange={e=>setEditForm((p:any)=>({...p,inter_hotel_dates:e.target.value}))}/></div>
                <div><label className="label">Confirmation / Ref</label><input className="input" placeholder="Supplier reference or booking number" value={editForm.confirmation_reference||''} onChange={e=>setEditForm((p:any)=>({...p,confirmation_reference:e.target.value}))}/></div>
                <div style={{ gridColumn:'1/-1' }}><label className="label">Notes</label><textarea className="input" style={{ minHeight:'60px', resize:'vertical', fontSize:'13px' }} value={editForm.notes||''} onChange={e=>setEditForm((p:any)=>({...p,notes:e.target.value}))}/></div>
              </div>
              <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'14px' }}>
                <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                <button className="btn btn-cta" onClick={() => saveTransferEdit(t.id)} disabled={saving}>{saving?'Saving…':'Save Changes'}</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'12px' }}>
                <div>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', marginBottom:'4px' }}>
                    {t.supplier_name || 'Transfer'} — {TRANSFER_TYPES.find(x=>x.value===t.transfer_type)?.label || t.transfer_type}
                  </div>
                  <div style={{ display:'flex', gap:'8px' }}>
                    {t.meet_greet && <span style={{ fontSize:'11px', background:'var(--accent-light)', color:'var(--accent)', padding:'2px 8px', borderRadius:'4px' }}>Meet & Greet</span>}
                    {t.local_rep && <span style={{ fontSize:'11px', background:'var(--green-light)', color:'var(--green)', padding:'2px 8px', borderRadius:'4px' }}>Local Rep</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button className="btn btn-secondary btn-xs" onClick={() => { setAdding(false); setEditing(t.id); setEditForm({ ...t, arrival_date: t.arrival_date?.split('T')[0]||'', departure_date: t.departure_date?.split('T')[0]||'', net_cost: t.net_cost ?? '', supplier_id: t.supplier_id ?? '' }) }}>Edit</button>
                  <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }} onClick={() => deleteTransfer(t.id)}>✕</button>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', fontSize:'13px' }}>
                <div style={{ padding:'10px 12px', background:'var(--bg-secondary)', borderRadius:'8px' }}>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'4px' }}>ARRIVAL</div>
                  <div style={{ fontWeight:'500' }}>{t.arrival_flight} · {fmtDate(t.arrival_date)} {t.arrival_time}</div>
                </div>
                <div style={{ padding:'10px 12px', background:'var(--bg-secondary)', borderRadius:'8px' }}>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', marginBottom:'4px' }}>DEPARTURE</div>
                  <div style={{ fontWeight:'500' }}>{t.departure_flight} · {fmtDate(t.departure_date)} {t.departure_time}</div>
                </div>
              </div>
              {t.inter_hotel_dates && <div style={{ marginTop:'8px', fontSize:'12.5px', color:'var(--text-muted)' }}>Inter-hotel: {t.inter_hotel_dates}</div>}
              {t.confirmation_reference && <div style={{ marginTop:'6px', fontSize:'12.5px' }}><span style={{ color:'var(--text-muted)' }}>Ref: </span><span style={{ fontWeight:'600', color:'var(--text-primary)', fontFamily:'monospace' }}>{t.confirmation_reference}</span></div>}
              {t.net_cost && <div style={{ marginTop:'6px', fontSize:'13px', color:'var(--accent)' }}>Net: {fmt(t.net_cost)}</div>}
              {t.notes && <div style={{ marginTop:'8px', fontSize:'12.5px', color:'var(--text-muted)', fontStyle:'italic' }}>{t.notes}</div>}
            </>
          )}
        </div>
      ))}

      {adding && (
        <div className="card" style={{ padding:'20px 22px', border:'1.5px solid var(--accent)' }}>
          <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', marginBottom:'16px' }}>Add Transfers</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <div>
              <label className="label">Supplier</label>
              <select className="input" value={form.supplier_id} onChange={e=>{
                const sup = suppliers.find((s:Supplier)=>s.id===Number(e.target.value))
                setForm((p:any)=>({...p,supplier_id:e.target.value,supplier_name:sup?.name||p.supplier_name}))
              }}>
                <option value="">Select supplier…</option>
                {suppliers.filter((s:Supplier)=>s.type==='transfer'||s.type==='dmc').map((s:Supplier)=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Transfer Type</label>
              <select className="input" value={form.transfer_type} onChange={e=>setForm((p:any)=>({...p,transfer_type:e.target.value}))}>
                {TRANSFER_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:'16px', paddingTop:'4px' }}>
              <label style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'13px', cursor:'pointer' }}><input type="checkbox" checked={form.meet_greet} onChange={e=>setForm((p:any)=>({...p,meet_greet:e.target.checked}))}/> Meet & Greet</label>
              <label style={{ display:'flex', gap:'8px', alignItems:'center', fontSize:'13px', cursor:'pointer' }}><input type="checkbox" checked={form.local_rep} onChange={e=>setForm((p:any)=>({...p,local_rep:e.target.checked}))}/> Local Rep</label>
            </div>
            <div><label className="label">Net Cost (£)</label><input className="input" type="number" value={form.net_cost} onChange={e=>setForm((p:any)=>({...p,net_cost:e.target.value}))}/></div>
            <div><label className="label">Arrival Flight</label><input className="input" placeholder="e.g. BA2065" value={form.arrival_flight} onChange={e=>setForm((p:any)=>({...p,arrival_flight:e.target.value.toUpperCase()}))}/></div>
            <div><label className="label">Arrival Date & Time</label><div style={{ display:'flex', gap:'8px' }}><DateInput value={form.arrival_date} onChange={v=>setForm((p:any)=>({...p,arrival_date:v}))}/><input className="input" style={{ width:'100px' }} placeholder="09:25" value={form.arrival_time} onChange={e=>setForm((p:any)=>({...p,arrival_time:e.target.value}))}/></div></div>
            <div><label className="label">Departure Flight</label><input className="input" placeholder="e.g. BA2064" value={form.departure_flight} onChange={e=>setForm((p:any)=>({...p,departure_flight:e.target.value.toUpperCase()}))}/></div>
            <div><label className="label">Departure Date & Time</label><div style={{ display:'flex', gap:'8px' }}><DateInput value={form.departure_date} onChange={v=>setForm((p:any)=>({...p,departure_date:v}))}/><input className="input" style={{ width:'100px' }} placeholder="20:45" value={form.departure_time} onChange={e=>setForm((p:any)=>({...p,departure_time:e.target.value}))}/></div></div>
            <div style={{ gridColumn:'1/-1' }}><label className="label">Inter-Hotel Transfer Dates</label><input className="input" placeholder="e.g. 17-05-2026" value={form.inter_hotel_dates} onChange={e=>setForm((p:any)=>({...p,inter_hotel_dates:e.target.value}))}/></div>
            <div><label className="label">Confirmation / Ref</label><input className="input" placeholder="Supplier reference or booking number" value={form.confirmation_reference} onChange={e=>setForm((p:any)=>({...p,confirmation_reference:e.target.value}))}/></div>
            <div style={{ gridColumn:'1/-1' }}><label className="label">Notes</label><textarea className="input" style={{ minHeight:'60px', resize:'vertical', fontSize:'13px' }} value={form.notes} onChange={e=>setForm((p:any)=>({...p,notes:e.target.value}))}/></div>
          </div>
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'14px' }}>
            <button className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn btn-cta" onClick={addTransfer} disabled={saving}>{saving?'Adding…':'Add Transfers'}</button>
          </div>
        </div>
      )}

      {transfers.length === 0 && !adding && (
        <div className="card" style={{ padding:'32px', textAlign:'center' }}>
          <div style={{ color:'var(--text-muted)', fontSize:'13px', marginBottom:'12px' }}>No transfers added yet</div>
          <button className="btn btn-cta" onClick={() => setAdding(true)}>+ Add Transfers</button>
        </div>
      )}
    </div>
  )
}

// ── EXTRAS TAB ───────────────────────────────────────────────
function ExtrasTab({ bookingId, extras, onUpdate, showToast }: any) {
  const blank = { extra_type:'lounge', description:'', supplier:'', net_cost:'', notes:'' }
  const EXTRA_TYPES = ['lounge', 'parking', 'fast_track', 'seat_upgrade', 'excursion', 'travel_insurance', 'other']
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState<any>({ ...blank })
  const [editing, setEditing]   = useState<number|null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving]     = useState(false)

  async function addExtra() {
    setSaving(true)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/extras`, {
        method: 'POST',
        body: JSON.stringify({
          extra_type: form.extra_type,
          description: form.description || null,
          supplier: form.supplier || null,
          net_cost: form.net_cost ? Number(form.net_cost) : null,
          notes: form.notes || null,
        }),
      })
      showToast(result.message || 'Extra added ✓')
      setAdding(false)
      onUpdate()
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function saveExtraEdit(id: number) {
    setSaving(true)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/extras`, {
        method: 'PUT',
        body: JSON.stringify({
          extraId: id,
          extra_type: editForm.extra_type,
          description: editForm.description || null,
          supplier: editForm.supplier || null,
          net_cost: editForm.net_cost ? Number(editForm.net_cost) : null,
          notes: editForm.notes || null,
        }),
      })
      showToast(result.message || 'Extra updated ✓')
      setEditing(null)
      onUpdate()
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteExtra(id: number) {
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${bookingId}/extras?extraId=${id}`, {
        method: 'DELETE',
      })
      showToast(result.message || 'Extra removed')
      onUpdate()
    } catch (error: any) {
      showToast(error.message || 'Failed to delete extra', 'error')
    }
  }

  const totalExtrasNet = extras.reduce((a: number, e: Extra) => a + (e.net_cost || 0), 0)

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Holiday Extras {totalExtrasNet > 0 && <span style={{ fontSize:'13px', color:'var(--accent)', fontFamily:'Outfit,sans-serif' }}>· {fmt(totalExtrasNet)} net</span>}</div>
        <button className="btn btn-cta" onClick={() => setAdding(true)}>+ Add Extra</button>
      </div>

      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {extras.map((e: Extra) => (
          <div key={e.id} className="card" style={{ padding:'14px 18px', border: editing===e.id ? '1.5px solid var(--accent)' : undefined }}>
            {editing === e.id ? (
              <>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                  <div><label className="label">Type</label><select className="input" value={editForm.extra_type} onChange={ev=>setEditForm((p:any)=>({...p,extra_type:ev.target.value}))}>{EXTRA_TYPES.map((t:string)=><option key={t} value={t}>{t.replace('_',' ')}</option>)}</select></div>
                  <div><label className="label">Description</label><input className="input" value={editForm.description||''} onChange={ev=>setEditForm((p:any)=>({...p,description:ev.target.value}))}/></div>
                  <div><label className="label">Supplier</label><input className="input" value={editForm.supplier||''} onChange={ev=>setEditForm((p:any)=>({...p,supplier:ev.target.value}))}/></div>
                  <div><label className="label">Net Cost (£)</label><input className="input" type="number" value={editForm.net_cost||''} onChange={ev=>setEditForm((p:any)=>({...p,net_cost:ev.target.value}))}/></div>
                  <div><label className="label">Notes</label><input className="input" value={editForm.notes||''} onChange={ev=>setEditForm((p:any)=>({...p,notes:ev.target.value}))}/></div>
                </div>
                <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'12px' }}>
                  <button className="btn btn-secondary btn-xs" onClick={() => setEditing(null)}>Cancel</button>
                  <button className="btn btn-cta btn-xs" onClick={() => saveExtraEdit(e.id)} disabled={saving}>{saving?'Saving…':'Save'}</button>
                </div>
              </>
            ) : (
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ fontSize:'13.5px', fontWeight:'500', textTransform:'capitalize' }}>{e.extra_type?.replace('_',' ')} {e.description ? `— ${e.description}` : ''}</div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px' }}>
                    {e.supplier && <span>{e.supplier} · </span>}
                    {e.net_cost && <span>Net: {fmt(e.net_cost)}</span>}
                  </div>
                  {e.notes && <div style={{ fontSize:'12px', color:'var(--text-muted)', fontStyle:'italic', marginTop:'2px' }}>{e.notes}</div>}
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button className="btn btn-secondary btn-xs" onClick={() => { setEditing(e.id); setEditForm({ ...e, net_cost: e.net_cost ?? '' }) }}>Edit</button>
                  <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }} onClick={() => deleteExtra(e.id)}>✕</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {adding && (
          <div className="card" style={{ padding:'18px 20px', border:'1.5px solid var(--accent)' }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <div>
                <label className="label">Type</label>
                <select className="input" value={form.extra_type} onChange={e=>setForm((p:any)=>({...p,extra_type:e.target.value}))}>
                  {EXTRA_TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                </select>
              </div>
              <div><label className="label">Description</label><input className="input" placeholder="e.g. Aspire Lounge, LGW" value={form.description} onChange={e=>setForm((p:any)=>({...p,description:e.target.value}))}/></div>
              <div><label className="label">Supplier</label><input className="input" placeholder="e.g. Holiday Extras" value={form.supplier} onChange={e=>setForm((p:any)=>({...p,supplier:e.target.value}))}/></div>
              <div><label className="label">Net Cost (£)</label><input className="input" type="number" value={form.net_cost} onChange={e=>setForm((p:any)=>({...p,net_cost:e.target.value}))}/></div>
              <div><label className="label">Notes</label><input className="input" value={form.notes} onChange={e=>setForm((p:any)=>({...p,notes:e.target.value}))}/></div>
            </div>
            <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'12px' }}>
              <button className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
              <button className="btn btn-cta" onClick={addExtra} disabled={saving}>{saving?'Adding…':'Add Extra'}</button>
            </div>
          </div>
        )}

        {extras.length === 0 && !adding && (
          <div className="card" style={{ padding:'32px', textAlign:'center' }}>
            <div style={{ color:'var(--text-muted)', fontSize:'13px', marginBottom:'12px' }}>No extras added</div>
            <button className="btn btn-cta" onClick={() => setAdding(true)}>+ Add Extra</button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── PAYMENTS TAB ─────────────────────────────────────────────
function PaymentsTab({ booking, payments, balance, onUpdate, showToast, currentStaff }: any) {
  const blank = { amount:'', payment_date: new Date().toISOString().split('T')[0], debit_card:'', credit_card:'', amex:'', bank_transfer:'', notes:'' }
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState<any>({ ...blank })
  const [saving, setSaving] = useState(false)
  const totalPaid           = payments.reduce((a: number, p: Payment) => a + (p.amount || 0), 0)
  const sell                = booking.total_sell || booking.deals?.deal_value || 0
  const paymentLockActive   = !!booking.balance_cleared_at || balance <= 0
  const paymentLocked       = paymentLockActive && !isManager(currentStaff)

  async function addPayment() {
    if (paymentLocked) { showToast('Payments are locked once the balance is cleared', 'error'); return }
    const total = (Number(form.debit_card)||0) + (Number(form.credit_card)||0) + (Number(form.amex)||0) + (Number(form.bank_transfer)||0)
    const amount = total || Number(form.amount)
    if (!amount) { showToast('Enter payment amount', 'error'); return }
    if (sell > 0 && amount > balance + 0.005) {
      showToast(`Payment of £${amount.toLocaleString('en-GB', { minimumFractionDigits: 2 })} exceeds outstanding balance of £${balance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`, 'error')
      return
    }
    setSaving(true)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}/payments`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          payment_date: form.payment_date,
          debit_card: Number(form.debit_card) || 0,
          credit_card: Number(form.credit_card) || 0,
          amex: Number(form.amex) || 0,
          bank_transfer: Number(form.bank_transfer) || 0,
          notes: form.notes || null,
        }),
      })
      await onUpdate()
      showToast(result.message || 'Payment recorded ✓')
      setAdding(false)
      setForm({ ...blank })
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function markInvoiceSent(id: number) {
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}/payments`, {
        method: 'PUT',
        body: JSON.stringify({ paymentId: id }),
      })
      await onUpdate()
      showToast(result.message || 'Invoice marked as sent')
    } catch (error: any) {
      showToast(error.message || 'Failed to mark invoice as sent', 'error')
    }
  }

  async function deletePayment(id: number) {
    if (paymentLocked) { showToast('Payments are locked once the balance is cleared', 'error'); return }
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}/payments?paymentId=${id}`, {
        method: 'DELETE',
      })
      await onUpdate()
      showToast(result.message || 'Payment removed')
    } catch (error: any) {
      showToast(error.message || 'Failed to delete payment', 'error')
    }
  }

  const pctPaid = sell > 0 ? Math.min(100, Math.round((totalPaid / sell) * 100)) : 0

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Payments</div>
        <button className="btn btn-cta" onClick={() => setAdding(true)} disabled={paymentLocked}>+ Add Payment</button>
      </div>

      {paymentLockActive && (
        <div style={{ marginBottom:'16px', background:isManager(currentStaff) ? '#eff6ff' : '#fff7ed', border:`1px solid ${isManager(currentStaff) ? '#93c5fd' : '#fdba74'}`, borderRadius:'10px', padding:'12px 16px', fontSize:'12.5px', color:isManager(currentStaff) ? '#1d4ed8' : '#9a3412' }}>
          {isManager(currentStaff)
            ? 'Balance has been cleared. Payments are locked for staff, but you can still override as manager if a correction is genuinely needed.'
            : 'Balance has been cleared. Further payment changes are locked and require a manager override.'}
        </div>
      )}

      {/* Payment progress */}
      <div className="card" style={{ padding:'18px 20px', marginBottom:'16px' }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'16px', marginBottom:'14px' }}>
          <div>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>Invoice Total</div>
            <div style={{ fontSize:'22px', fontWeight:'600', color:'var(--text-primary)' }}>{fmt(sell)}</div>
          </div>
          <div>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>Total Paid</div>
            <div style={{ fontSize:'22px', fontWeight:'600', color:'var(--green)' }}>{fmt(totalPaid)}</div>
          </div>
          <div>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>Balance Remaining</div>
            <div style={{ fontSize:'22px', fontWeight:'600', color: balance > 0 ? 'var(--red)' : 'var(--green)' }}>{balance > 0 ? fmt(balance) : 'PAID ✓'}</div>
          </div>
        </div>
        <div style={{ height:'6px', background:'var(--border)', borderRadius:'3px', overflow:'hidden' }}>
          <div style={{ height:'100%', width:`${pctPaid}%`, background: pctPaid===100 ? 'var(--green)' : 'var(--accent)', borderRadius:'3px', transition:'width 0.3s' }}/>
        </div>
        <div style={{ fontSize:'11.5px', color:'var(--text-muted)', marginTop:'6px' }}>{pctPaid}% paid</div>
      </div>

      {/* Payment history */}
      <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
        {payments.map((p: Payment, i: number) => {
          const breakdown = [
            p.debit_card > 0 && `Debit: ${fmt(p.debit_card)}`,
            p.credit_card > 0 && `Credit: ${fmt(p.credit_card)}`,
            p.amex > 0 && `Amex: ${fmt(p.amex)}`,
            p.bank_transfer > 0 && `Bank: ${fmt(p.bank_transfer)}`,
          ].filter(Boolean).join(' · ')

          return (
            <div key={p.id} className="card" style={{ padding:'14px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <div>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                    <span style={{ fontSize:'15px', fontWeight:'600', color:'var(--green)' }}>{fmt(p.amount)}</span>
                    <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>{fmtDate(p.payment_date)}</span>
                    <span style={{ fontSize:'10px', background:'var(--bg-tertiary)', padding:'1px 7px', borderRadius:'10px', color:'var(--text-muted)' }}>Payment {i+1}</span>
                  </div>
                  {breakdown && <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{breakdown}</div>}
                  {p.notes && <div style={{ fontSize:'12px', color:'var(--text-muted)', fontStyle:'italic', marginTop:'2px' }}>{p.notes}</div>}
                </div>
                <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                  {p.invoice_sent ? (
                    <span style={{ fontSize:'11px', color:'var(--green)', background:'var(--green-light)', padding:'2px 8px', borderRadius:'4px' }}>Invoice Sent ✓</span>
                  ) : (
                    <button className="btn btn-secondary btn-xs" onClick={() => markInvoiceSent(p.id)}>Mark Invoice Sent</button>
                  )}
                  <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }} onClick={() => deletePayment(p.id)} disabled={paymentLocked}>✕</button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {adding && (
        <div className="card" style={{ padding:'20px 22px', border:'1.5px solid var(--accent)', marginTop:'12px' }}>
          <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', marginBottom:'16px' }}>Record Payment</div>
          <div style={{ background:'var(--bg-secondary)', borderRadius:'8px', padding:'14px 16px', marginBottom:'14px' }}>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'10px' }}>Split by payment method (leave 0 if not used)</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'10px' }}>
              <div><label className="label">Debit Card (£)</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.debit_card} onChange={e=>setForm((p:any)=>({...p,debit_card:e.target.value}))}/></div>
              <div><label className="label">Credit Card (£)</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.credit_card} onChange={e=>setForm((p:any)=>({...p,credit_card:e.target.value}))}/></div>
              <div><label className="label">Amex (£)</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.amex} onChange={e=>setForm((p:any)=>({...p,amex:e.target.value}))}/></div>
              <div><label className="label">Bank Transfer (£)</label><input className="input" type="number" min="0" step="0.01" placeholder="0.00" value={form.bank_transfer} onChange={e=>setForm((p:any)=>({...p,bank_transfer:e.target.value}))}/></div>
            </div>
            <div style={{ marginTop:'10px', fontSize:'13px', color:'var(--text-primary)' }}>
              Total: <strong style={{ color:'var(--green)' }}>
                {fmt((Number(form.debit_card)||0)+(Number(form.credit_card)||0)+(Number(form.amex)||0)+(Number(form.bank_transfer)||0))}
              </strong>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'12px' }}>
            <div><label className="label">Payment Date</label><DateInput value={form.payment_date} onChange={v=>setForm((p:any)=>({...p,payment_date:v}))}/></div>
            <div><label className="label">Notes</label><input className="input" placeholder="Optional" value={form.notes} onChange={e=>setForm((p:any)=>({...p,notes:e.target.value}))}/></div>
          </div>
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setAdding(false)}>Cancel</button>
            <button className="btn btn-cta" onClick={addPayment} disabled={saving}>{saving?'Recording…':'Record Payment'}</button>
          </div>
        </div>
      )}

      {payments.length === 0 && !adding && (
        <div className="card" style={{ padding:'32px', textAlign:'center', marginTop:'12px' }}>
          <div style={{ color:'var(--text-muted)', fontSize:'13px', marginBottom:'12px' }}>No payments recorded yet</div>
          <button className="btn btn-cta" onClick={() => setAdding(true)} disabled={paymentLocked}>+ Record First Payment</button>
        </div>
      )}
    </div>
  )
}

// ── COSTING TAB ──────────────────────────────────────────────
function CostingTab({ booking, flights, accommodations, transfers, extras, payments, suppliers, onUpdate, showToast, currentStaff }: any) {
  const [editingBalDue, setEditingBalDue] = useState(false)
  const [balDueDraft, setBalDueDraft]     = useState(booking.balance_due_date?.split('T')[0] || '')
  const [ccDraft, setCcDraft]             = useState(String(booking.cc_surcharge || ''))
  const [editingCc, setEditingCc]         = useState(false)
  const [discountDraft, setDiscountDraft] = useState(String(booking.discount || ''))
  const [editingDiscount, setEditingDiscount] = useState(false)
  const [editingSell, setEditingSell]     = useState(false)
  const [syncing, setSyncing]             = useState(false)
  const [sellDraft, setSellDraft]         = useState(String(booking.total_sell ?? booking.deals?.deal_value ?? 0))

  useEffect(() => {
    setBalDueDraft(booking.balance_due_date?.split('T')[0] || '')
    setCcDraft(String(booking.cc_surcharge || ''))
    setDiscountDraft(String(booking.discount || ''))
    setSellDraft(String(booking.total_sell ?? booking.deals?.deal_value ?? 0))
  }, [booking])

  const sell      = Number(sellDraft) || 0
  const discount  = booking.discount || 0
  const ccSurch   = booking.cc_surcharge || 0
  const clientNet = sell - discount - ccSurch

  // Build cost lines — one per segment (dedup by segment_id for flights)
  const costLines: { label: string; supplier: string; netCost: number }[] = []
  const seenSegments = new Set<string>()
  for (const f of (flights || [])) {
    if (!f.net_cost) continue
    const segKey = `${f.direction}-${f.segment_id ?? f.id}`
    if (seenSegments.has(segKey)) continue
    seenSegments.add(segKey)
    // label: first leg of segment origin→destination
    const segLegs = (flights || []).filter((x: Flight) => x.direction === f.direction && (x.segment_id ?? x.id) === (f.segment_id ?? f.id))
    const origin  = segLegs[0]?.origin || f.origin
    const dest    = segLegs[segLegs.length - 1]?.destination || f.destination
    const airline = f.airline || ''
    costLines.push({
      label:    `${airline} (${origin}→${dest})`.trim(),
      supplier: f.flight_supplier || '—',
      netCost:  f.net_cost,
    })
  }
  for (const a of accommodations) {
    if (!a.net_cost) continue
    costLines.push({
      label:    a.hotel_name || 'Accommodation',
      supplier: suppliers.find((s: Supplier) => s.id === a.supplier_id)?.name || '—',
      netCost:  a.net_cost,
    })
  }
  for (const t of transfers) {
    if (!t.net_cost) continue
    costLines.push({
      label:    `Transfer (${TRANSFER_TYPES.find((x: any) => x.value === t.transfer_type)?.label || t.transfer_type})`,
      supplier: suppliers.find((s: Supplier) => s.id === t.supplier_id)?.name || t.supplier_name || '—',
      netCost:  t.net_cost,
    })
  }
  for (const e of extras) {
    if (!e.net_cost) continue
    costLines.push({
      label:    e.description || (e.extra_type || '').replace('_',' ') || 'Extra',
      supplier: e.supplier || '—',
      netCost:  e.net_cost,
    })
  }

  const totalNetCost = costLines.reduce((a, l) => a + l.netCost, 0)
  const excess       = sell - totalNetCost
  const grossComm    = clientNet - totalNetCost

  const totalPaid = payments.reduce((a: number, p: Payment) => a + (p.amount || 0), 0)
  const isManagerUser       = isManager(currentStaff)
  const canEditCommercial   = !booking.deposit_received || isManagerUser
  const managerMode         = canEditCommercial  // alias kept so downstream references compile
  let running = 0
  const receiptRows = payments.map((p: Payment, i: number) => {
    running += p.amount
    const owing = sell - running
    const type  = i === 0 ? 'Deposit' : (i === payments.length - 1 && owing <= 0) ? 'Balance' : 'Interim'
    return { ...p, amountOwing: Math.max(0, owing), type, runningTotal: running }
  })
  const balanceDue = sell - totalPaid

  async function saveBalDue() {
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'update_balance_due', balance_due_date: balDueDraft || null }),
      })
      await onUpdate()
      showToast(result.message || 'Balance due date updated ✓')
      setEditingBalDue(false)
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    }
  }

  async function saveCcSurcharge() {
    if (!managerMode) { showToast('Only managers can change CC surcharge', 'error'); return }
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'update_cc_surcharge', cc_surcharge: Number(ccDraft) || 0 }),
      })
      await onUpdate()
      showToast(result.message || 'CC surcharge updated ✓')
      setEditingCc(false)
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    }
  }

  async function saveDiscount() {
    if (!canEditCommercial) { showToast('Only managers can change commercial fields after deposit', 'error'); return }
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'update_discount', discount: Number(discountDraft) || null }),
      })
      await onUpdate()
      showToast(result.message || 'Discount updated ✓')
      setEditingDiscount(false)
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    }
  }

  async function saveTotalSell() {
    if (!managerMode) { showToast('Only managers can change commercial fields', 'error'); return }
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'update_total_sell', total_sell: Number(sellDraft) || 0 }),
      })
      await onUpdate()
      showToast(result.message || 'Client total updated ✓')
      setEditingSell(false)
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    }
  }

  async function pushToOverview() {
    if (!managerMode) { showToast('Only managers can change protected commercial fields', 'error'); return }
    if (totalNetCost === 0) { showToast('No costs entered yet', 'error'); return }
    setSyncing(true)
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          action: 'push_costing',
          total_sell: sell,
          total_net: totalNetCost,
          gross_profit: grossComm,
          final_profit: grossComm,
          cc_surcharge: Number(ccDraft) || 0,
        }),
      })
      await onUpdate()
      showToast(result.message || 'Total sell, net and gross profit pushed to Overview ✓')
    } catch (error: any) {
      showToast(`Failed: ${error.message}`, 'error')
    } finally {
      setSyncing(false)
    }
  }

  const TH = ({ children, right }: { children: string; right?: boolean }) => (
    <th style={{ padding:'8px 10px', textAlign: right ? 'right' : 'left', fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:'600', whiteSpace:'nowrap' }}>{children}</th>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

      {/* ── Cost Breakdown ── */}
      <div className="card" style={{ padding:'20px 22px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Cost Details</div>
          {totalNetCost > 0 && (
            <button className="btn btn-cta btn-xs" onClick={pushToOverview} disabled={!managerMode || syncing}>
              {syncing ? 'Pushing…' : managerMode ? '⟳ Push to Overview' : 'Manager Only'}
            </button>
          )}
        </div>

        {costLines.length === 0 ? (
          <div style={{ fontSize:'13px', color:'var(--text-muted)', fontStyle:'italic' }}>
            No net costs entered yet. Add costs in the Flights, Accommodation, Transfers or Extras tabs.
          </div>
        ) : (
          <>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid var(--border)' }}>
                    <TH>Component</TH>
                    <TH>Supplier</TH>
                    <TH right>Net Cost</TH>
                  </tr>
                </thead>
                <tbody>
                  {costLines.map((line, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                      <td style={{ padding:'10px 10px', fontWeight:'500', color:'var(--text-primary)' }}>{line.label}</td>
                      <td style={{ padding:'10px 10px', color:'var(--text-muted)' }}>{line.supplier}</td>
                      <td style={{ padding:'10px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:'500' }}>{fmt(line.netCost)}</td>
                    </tr>
                  ))}
                  <tr style={{ background:'var(--bg-secondary)', borderTop:'2px solid var(--border)' }}>
                    <td colSpan={2} style={{ padding:'10px', fontWeight:'700', fontSize:'13px' }}>Total Net Cost</td>
                    <td style={{ padding:'10px', textAlign:'right', fontFamily:'monospace', fontWeight:'700', fontSize:'15px' }}>{fmt(totalNetCost)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Summary split */}
            <div style={{ borderTop:'2px solid var(--border)', marginTop:'4px', paddingTop:'16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'9px' }}>
                {[
                  { label:'Total Net Cost', val: fmt(totalNetCost), bold: true },
                  { label:'Excess',         val: fmt(excess),       color:'var(--text-muted)' },
                ].map(r => (
                  <div key={r.label} style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>{r.label}</span>
                    <span style={{ fontSize:'13px', fontFamily:'monospace', color: (r as any).color || 'var(--text-primary)', fontWeight: (r as any).bold ? '700' : '500' }}>{r.val}</span>
                  </div>
                ))}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', minHeight:'28px' }}>
                  <span style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>Discount</span>
                  {editingDiscount ? (
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      <span style={{ fontSize:'13px' }}>£</span>
                      <input className="input" type="number" value={discountDraft} onChange={e=>setDiscountDraft(e.target.value)} style={{ width:'80px', fontSize:'13px', padding:'4px 8px' }} autoFocus />
                      <button className="btn btn-cta btn-xs" onClick={saveDiscount}>Save</button>
                      <button className="btn btn-secondary btn-xs" onClick={()=>setEditingDiscount(false)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                      <span style={{ fontSize:'13px', fontFamily:'monospace', color: discount > 0 ? 'var(--amber)' : 'var(--text-muted)', fontWeight:'500' }}>
                        {discount > 0 ? `− ${fmt(discount)}` : '—'}
                      </span>
                      {canEditCommercial && <button className="btn btn-secondary btn-xs" onClick={()=>setEditingDiscount(true)}>Edit</button>}
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', minHeight:'28px' }}>
                  <span style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>CC Surcharge</span>
                  {editingCc ? (
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      <span style={{ fontSize:'13px' }}>£</span>
                      <input className="input" type="number" value={ccDraft} onChange={e=>setCcDraft(e.target.value)} style={{ width:'80px', fontSize:'13px', padding:'4px 8px' }} autoFocus />
                      <button className="btn btn-cta btn-xs" onClick={saveCcSurcharge}>Save</button>
                      <button className="btn btn-secondary btn-xs" onClick={()=>setEditingCc(false)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                      <span style={{ fontSize:'13px', fontFamily:'monospace', color: ccSurch > 0 ? 'var(--amber)' : 'var(--text-muted)', fontWeight:'500' }}>
                        {ccSurch > 0 ? `− ${fmt(ccSurch)}` : '—'}
                      </span>
                      {managerMode && <button className="btn btn-secondary btn-xs" onClick={()=>setEditingCc(true)}>Edit</button>}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'9px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', minHeight:'28px' }}>
                  <span style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>Client Total</span>
                  {editingSell ? (
                    <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
                      <span style={{ fontSize:'13px' }}>£</span>
                      <input className="input" type="number" value={sellDraft} onChange={e=>setSellDraft(e.target.value)} style={{ width:'90px', fontSize:'13px', padding:'4px 8px' }} autoFocus />
                      <button className="btn btn-cta btn-xs" onClick={saveTotalSell}>Save</button>
                      <button className="btn btn-secondary btn-xs" onClick={()=>setEditingSell(false)}>Cancel</button>
                    </div>
                  ) : (
                    <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                      <span style={{ fontSize:'14px', fontWeight:'600', fontFamily:'monospace', color:'var(--text-primary)' }}>
                        {fmt(sell)}
                      </span>
                      {managerMode && <button className="btn btn-secondary btn-xs" onClick={()=>setEditingSell(true)}>Edit</button>}
                    </div>
                  )}
                </div>
                {!canEditCommercial && (
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'6px' }}>
                    Deposit received — commercial values are locked. Only managers can amend.
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>Client Net</span>
                  <span style={{ fontSize:'13px', fontFamily:'monospace', color:'var(--text-primary)', fontWeight:'700' }}>{fmt(clientNet)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>Gross Comm</span>
                  <span style={{ fontSize:'13px', fontFamily:'monospace', color: grossComm >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:'700' }}>{fmt(grossComm)}</span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>Net Comm</span>
                  <span style={{ fontSize:'13px', fontFamily:'monospace', color: grossComm >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:'700' }}>{fmt(grossComm)}</span>
                </div>
              </div>
            </div>

          </>
        )}
      </div>

      {/* ── Receipt Details ── */}
      <div className="card" style={{ padding:'20px 22px' }}>
        <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'16px' }}>Receipt Details</div>
        {payments.length === 0 ? (
          <div style={{ fontSize:'13px', color:'var(--text-muted)', fontStyle:'italic' }}>No payments recorded yet</div>
        ) : (
          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'12.5px' }}>
              <thead>
                <tr style={{ borderBottom:'2px solid var(--border)' }}>
                  <TH>Date</TH>
                  <TH>Type</TH>
                  <TH right>Paid So Far</TH>
                  <TH right>Amount Owing</TH>
                  <TH right>Debit Card</TH>
                  <TH right>Credit Card</TH>
                  <TH right>Amex</TH>
                  <TH right>Bank Transfer</TH>
                  <TH right>Total</TH>
                </tr>
              </thead>
              <tbody>
                {receiptRows.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom:'1px solid var(--border)' }}>
                    <td style={{ padding:'9px 10px', whiteSpace:'nowrap' }}>{fmtDate(r.payment_date)}</td>
                    <td style={{ padding:'9px 10px' }}>
                      <span style={{ fontSize:'11px', padding:'2px 7px', borderRadius:'4px',
                        background: r.type==='Balance' ? '#e6f4ee' : r.type==='Deposit' ? '#fef3c7' : 'var(--bg-secondary)',
                        color:      r.type==='Balance' ? 'var(--green)' : r.type==='Deposit' ? '#d97706' : 'var(--text-muted)',
                        fontWeight:'500' }}>
                        {r.type}
                      </span>
                    </td>
                    <td style={{ padding:'9px 10px', textAlign:'right', fontFamily:'monospace' }}>{fmt(r.runningTotal)}</td>
                    <td style={{ padding:'9px 10px', textAlign:'right', fontFamily:'monospace', color: r.amountOwing > 0 ? 'var(--red)' : 'var(--green)', fontWeight:'500' }}>{fmt(r.amountOwing)}</td>
                    <td style={{ padding:'9px 10px', textAlign:'right', fontFamily:'monospace', color: r.debit_card > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{r.debit_card > 0 ? fmt(r.debit_card) : '—'}</td>
                    <td style={{ padding:'9px 10px', textAlign:'right', fontFamily:'monospace', color: r.credit_card > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{r.credit_card > 0 ? fmt(r.credit_card) : '—'}</td>
                    <td style={{ padding:'9px 10px', textAlign:'right', fontFamily:'monospace', color: r.amex > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{r.amex > 0 ? fmt(r.amex) : '—'}</td>
                    <td style={{ padding:'9px 10px', textAlign:'right', fontFamily:'monospace', color: r.bank_transfer > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>{r.bank_transfer > 0 ? fmt(r.bank_transfer) : '—'}</td>
                    <td style={{ padding:'9px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:'600' }}>{fmt(r.amount)}</td>
                  </tr>
                ))}
                <tr style={{ background:'var(--bg-secondary)', borderTop:'2px solid var(--border)' }}>
                  <td colSpan={8} style={{ padding:'9px 10px', fontSize:'12px', color:'var(--text-muted)', fontWeight:'600', textAlign:'right' }}>Total :</td>
                  <td style={{ padding:'9px 10px', textAlign:'right', fontFamily:'monospace', fontWeight:'700' }}>{fmt(totalPaid)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Balance Due ── */}
      <div className="card" style={{ padding:'20px 24px', border: `2px solid ${balanceDue > 0 ? 'var(--red)' : 'var(--green)'}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>Balance Due</div>
            <div style={{ fontSize:'30px', fontWeight:'700', fontFamily:'Outfit,sans-serif', color: balanceDue > 0 ? 'var(--red)' : 'var(--green)' }}>
              {balanceDue <= 0 ? 'FULLY PAID ✓' : fmt(balanceDue)}
            </div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>Balance Due Date</div>
            {editingBalDue ? (
              <div style={{ display:'flex', gap:'8px', alignItems:'center', justifyContent:'flex-end' }}>
                <DateInput value={balDueDraft} onChange={setBalDueDraft}
                  style={{ fontSize:'13px', width:'150px' }} />
                <button className="btn btn-cta btn-xs" onClick={saveBalDue}>Save</button>
                <button className="btn btn-secondary btn-xs" onClick={() => setEditingBalDue(false)}>Cancel</button>
              </div>
            ) : (
              <div style={{ display:'flex', alignItems:'center', gap:'8px', justifyContent:'flex-end' }}>
                <span style={{ fontSize:'18px', fontWeight:'600', color: balanceDue > 0 ? 'var(--red)' : 'var(--green)' }}>
                  {booking.balance_due_date ? fmtDate(booking.balance_due_date) : '—'}
                </span>
                <button onClick={() => setEditingBalDue(true)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:'12px', padding:'3px', opacity:0.7 }}
                  title="Edit balance due date">✏</button>
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

// ── DOCUMENTS TAB ────────────────────────────────────────────
function DocumentsTab({ booking, client, passengers, outbound, returnFlts, accommodations, transfers, payments, tasks, onUpdate, showToast }: any) {
  const [activeDoc, setActiveDoc] = useState<string | null>(null)
  const [preview, setPreview]     = useState<string | null>(null)

  const ref        = booking.booking_reference
  const clientName = client ? `${client.first_name} ${client.last_name}` : 'Guest'
  const paxList    = passengers.map((p: Passenger) => `${p.title} ${p.first_name} ${p.last_name}`).join(', ')
  const infantCount = passengers.filter((p: Passenger) => p.passenger_type === 'Infant').length
  const passengerCountExInfants = Math.max(0, passengers.length - infantCount)
  const totalPaid  = payments.reduce((a: number, p: Payment) => a + (p.amount || 0), 0)
  const sell       = booking.total_sell || booking.deals?.deal_value || 0
  const balance    = sell - totalPaid
  const today      = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
  const packageNights = (() => {
    if (booking.departure_date && booking.return_date) return calcNights(booking.departure_date, booking.return_date)
    const firstCheckIn = accommodations[0]?.checkin_date || null
    const lastCheckOut = accommodations[accommodations.length - 1]?.checkout_date || null
    return calcNights(firstCheckIn, lastCheckOut)
  })()
  const firstOutbound = outbound[0] || null
  const lastInbound = returnFlts[returnFlts.length - 1] || null
  const productDescription = `${booking.deals?.title || 'Package holiday'}${booking.destination ? ` to ${booking.destination}` : ''}${packageNights ? ` for ${packageNights} night${packageNights === 1 ? '' : 's'}` : ''}`

  function airportLabel(code: string | null) {
    if (!code) return '—'
    const match = AIRPORTS.find(a => a.code === code)
    return match ? `${match.name} (${match.code})` : code
  }

  const DOCS = [
    { id: 'invoice_confirmation', label: 'Invoice / Confirmation',  icon: '📋', desc: 'Commercial confirmation with trip summary and payment position' },
    { id: 'booking_terms', label: 'Booking Terms & Conditions', icon: '📘', desc: 'Separate booking conditions document' },
    { id: 'itinerary',    label: 'Flight Itinerary',       icon: '✈',  desc: `${outbound.length + returnFlts.length} flight leg${outbound.length + returnFlts.length !== 1 ? 's' : ''}` },
    ...accommodations.map((a: Accommodation, i: number) => ({
      id: `accom_${a.id}_customer`,
      label: `${a.hotel_name} — Guest Voucher`,
      icon: '🏨',
      desc: `Stay ${i + 1}: ${fmtDate(a.checkin_date)} → ${fmtDate(a.checkout_date)}`,
    })),
    ...accommodations.map((a: Accommodation, i: number) => ({
      id: `accom_${a.id}_hotel`,
      label: `${a.hotel_name} — Reservation Email`,
      icon: '✉',
      desc: `Hotel copy — stay ${i + 1}`,
    })),
    ...transfers.map((t: Transfer, i: number) => ({
      id: `transfer_${t.id}`,
      label: `Transfer Voucher${transfers.length > 1 ? ` ${i + 1}` : ''}`,
      icon: '🚗',
      desc: t.supplier_name || 'Transfer details',
    })),
    { id: 'atol', label: 'ATOL Certificate', icon: '📜', desc: 'Air Travel Organiser\'s Licence certificate' },
    ...(booking.booking_status === 'cancelled' ? [{ id: 'cancellation_invoice', label: 'Cancellation Invoice', icon: '🚫', desc: `Issued ${fmtDate(booking.cancellation_date)}` }] : []),
  ]

  const docStyles = `
    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Arial, sans-serif; color: #1a1a2e; background: white; padding: 40px; max-width: 800px; margin: 0 auto; font-size: 13px; line-height: 1.5; }
      .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 28px; padding-bottom: 18px; border-bottom: 2px solid #1a1a2e; }
      .brand { font-size: 20px; font-weight: 300; letter-spacing: -0.01em; }
      .brand em { font-style: italic; }
      .brand-sub { font-size: 10px; color: #94a3b8; margin-top: 3px; text-transform: uppercase; letter-spacing: 0.1em; }
      .ref-box { text-align: right; }
      .ref-box .ref { font-size: 17px; font-weight: 700; color: #3b82f6; letter-spacing: 0.06em; font-family: monospace; }
      .ref-box .date { font-size: 11px; color: #94a3b8; margin-top: 3px; }
      h1 { font-size: 24px; font-weight: 300; margin-bottom: 4px; }
      .subtitle { color: #64748b; font-size: 13px; margin-bottom: 20px; }
      h2 { font-size: 11px; font-weight: 700; margin: 22px 0 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
      th { background: #f8fafc; text-align: left; padding: 7px 12px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #64748b; border-bottom: 1px solid #e2e8f0; }
      td { padding: 9px 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; vertical-align: top; }
      tr:last-child td { border-bottom: none; }
      td:first-child { color: #64748b; width: 200px; font-size: 12px; }
      .highlight { background: #f8fafc; padding: 14px 16px; border-radius: 6px; margin-bottom: 16px; border-left: 4px solid #3b82f6; }
      .hotel-highlight { background: #f0fdf4; border-left: 4px solid #059669; border-radius: 6px; padding: 14px 16px; margin-bottom: 18px; }
      .hotel-name { font-size: 22px; font-weight: 300; font-family: Georgia, serif; margin-bottom: 6px; }
      .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; }
      .badge-green { background: #d1fae5; color: #059669; }
      .badge-amber { background: #fef3c7; color: #d97706; }
      .badge-blue { background: #dbeafe; color: #2563eb; }
      .badge-red { background: #fee2e2; color: #dc2626; }
      .footer { margin-top: 40px; padding-top: 14px; border-top: 1px solid #e5e7eb; font-size: 10.5px; color: #94a3b8; text-align: center; }
      .sign { margin-top: 28px; font-size: 13.5px; line-height: 1.8; }
      .atol-wrap { padding: 0; display:flex; justify-content:center; }
      .atol-canvas {
        position: relative;
        width: 760px;
        height: 1080px;
        background: linear-gradient(180deg, #fbf3c9 0%, #f8efbf 100%);
        border: 1px solid #d7cfa2;
        font-family: Arial, sans-serif;
        color: #111;
        overflow: hidden;
      }
      .atol-watermark {
        position:absolute;
        top: 118px;
        right: 88px;
        width: 260px;
        height: 420px;
        opacity: 0.12;
        transform: rotate(32deg);
        pointer-events:none;
      }
      .atol-watermark-box {
        position:absolute;
        inset: 36px 18px 40px 18px;
        border: 22px solid #111827;
      }
      .atol-watermark-text {
        position:absolute;
        inset: 0;
        display:flex;
        align-items:center;
        justify-content:center;
        font-size: 118px;
        font-weight: 700;
        letter-spacing: -0.06em;
      }
      .atol-corner {
        position:absolute;
        top:-120px;
        right:-70px;
        width: 260px;
        height: 260px;
        border: 18px solid rgba(0,0,0,0.06);
        transform: rotate(45deg);
      }
      .atol-text { position:absolute; left:0; right:0; text-align:center; }
      .atol-banner { top: 34px; left: 58px; right: 58px; font-size: 12px; font-weight: 700; }
      .atol-main-title { top: 72px; font-size: 52px; font-weight: 700; }
      .atol-lead {
        top: 144px;
        left: 54px;
        right: 54px;
        font-size: 17px;
        line-height: 1.2;
        font-weight: 700;
      }
      .atol-sublead {
        top: 206px;
        left: 78px;
        right: 78px;
        font-size: 16px;
        line-height: 1.25;
      }
      .atol-field {
        position: absolute;
        font-size: 12px;
        line-height: 1.3;
      }
      .atol-field strong { font-size: 16px; display:block; margin-bottom: 4px; }
      .atol-field p { margin: 0; }
      .atol-protected-left { top: 306px; left: 54px; width: 410px; }
      .atol-protected-right { top: 306px; left: 468px; width: 210px; }
      .atol-what { top: 372px; left: 54px; width: 620px; }
      .atol-who { top: 442px; left: 54px; width: 620px; }
      .atol-protection-title {
        position:absolute; top: 486px; left:0; right:0;
        text-align:center; font-size: 22px; font-weight: 700;
      }
      .atol-body {
        position:absolute; top: 522px; left: 58px; right: 58px;
        font-size: 12px; line-height: 1.25;
      }
      .atol-body p { margin: 0 0 12px; }
      .atol-legal-bottom {
        position:absolute; top: 894px; left: 56px; right: 56px;
        font-size: 10.5px; line-height: 1.2;
      }
      .atol-footer-grid {
        position:absolute; top: 1004px; left: 56px; right: 56px;
        display:grid; grid-template-columns: 1.15fr 1fr 1fr 0.8fr 1fr;
        align-items:stretch; text-align:center;
      }
      .atol-footer-grid > div { padding-top: 8px; font-size: 12px; font-weight: 700; }
      .atol-footer-grid .label { display:block; font-size: 11px; font-weight: 700; line-height: 1.1; margin-bottom: 8px; }
      .atol-footer-grid .value { display:block; font-size: 12px; font-weight: 700; }
      .atol-footer-grid .issuer-note { font-size: 10px; font-style: italic; font-weight: 600; line-height: 1.15; }
      .atol-copyright {
        position:absolute; bottom: 18px; left:0; right:0;
        text-align:center; font-size: 9px;
      }
      .terms-block { margin-bottom:18px; }
      .terms-block h3 { font-size:12px; text-transform:uppercase; letter-spacing:0.08em; color:#64748b; margin-bottom:8px; }
      .terms-block ul { padding-left:18px; }
      .terms-block li { margin-bottom:6px; }
      @media print { body { padding: 20px; } .no-print { display: none; } }
    </style>`

  function brandHeader(title: string, subtitle?: string) {
    return `
      <div class="header">
        <div>
          <div class="brand"><em>Mauritius</em> Holidays Direct</div>
          <div class="brand-sub">MHD Travel Ltd · ATOL Protected 11423</div>
        </div>
        <div class="ref-box">
          <div class="ref">${ref}</div>
          <div class="date">${today}</div>
        </div>
      </div>
      <h1>${title}</h1>
      ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}`
  }

  function documentTaskKeys(docId: string) {
    if (docId === 'invoice_confirmation') return ['booking_confirmation']
    if (docId === 'atol') return ['atol_certificate']
    if (docId === 'itinerary') return ['etickets_sent', 'travel_docs']
    if (docId.startsWith('accom_') && docId.endsWith('_customer')) return ['travel_docs']
    if (docId.startsWith('transfer_')) return ['travel_docs']
    return []
  }

  async function markDocumentIssued(docId: string) {
    const taskKeys = documentTaskKeys(docId)
    if (taskKeys.length === 0) return
    try {
      const result = await apiRequest<{ message?: string }>(`/api/bookings/${booking.id}/documents`, {
        method: 'POST',
        body: JSON.stringify({ docId }),
      })
      if (result.message && result.message !== 'No task update required') {
        showToast(result.message)
      }
      onUpdate()
    } catch (error: any) {
      showToast(error.message || 'Failed to update document task', 'error')
    }
  }

  function generateDoc(docId: string): string {
    if (docId === 'invoice_confirmation') {
      const flightRows = [...outbound, ...returnFlts].map((f: Flight) =>
        `<tr><td style="width:auto"><strong>${f.flight_number}</strong></td><td>${f.airline || '—'}</td><td>${f.origin} → ${f.destination}</td><td>${fmtDate(f.departure_date)}${f.departure_time ? ' ' + f.departure_time : ''}</td><td>${f.cabin_class}</td></tr>`
      ).join('')
      const accomRows = accommodations.map((a: Accommodation) =>
        `<tr><td style="width:auto"><strong>${a.hotel_name}</strong></td><td>${fmtDate(a.checkin_date)} – ${fmtDate(a.checkout_date)}</td><td>${a.nights || calcNights(a.checkin_date, a.checkout_date)} nts</td><td>${a.room_type || '—'} ×${a.room_quantity}</td><td>${a.board_basis || '—'}</td></tr>`
      ).join('')
      return `<!DOCTYPE html><html><head><title>Invoice / Confirmation — ${ref}</title>${docStyles}</head><body>
        ${brandHeader('Invoice / Confirmation', `Dear ${clientName},`)}
        <p style="line-height:1.8;margin-bottom:18px;">Thank you for booking with Mauritius Holidays Direct. This document confirms your booking and shows the current financial position. Your booking terms and your ATOL Certificate are provided separately.</p>
        <div class="highlight">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">Lead Passenger</span><div style="font-weight:600;margin-top:2px">${clientName}</div></div>
            <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">All Passengers</span><div style="margin-top:2px">${paxList}</div></div>
            <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">Departure</span><div style="font-weight:600;margin-top:2px">${fmtDate(booking.departure_date)}</div></div>
            <div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">Return</span><div style="font-weight:600;margin-top:2px">${fmtDate(booking.return_date)}</div></div>
            ${booking.destination ? `<div><span style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:0.06em">Destination</span><div style="margin-top:2px">${booking.destination}</div></div>` : ''}
          </div>
        </div>
        ${flightRows ? `<h2>Flights</h2><table><thead><tr><th>Flight</th><th>Airline</th><th>Route</th><th>Departure</th><th>Class</th></tr></thead><tbody>${flightRows}</tbody></table>` : ''}
        ${accomRows ? `<h2>Accommodation</h2><table><thead><tr><th>Hotel</th><th>Dates</th><th>Nights</th><th>Room</th><th>Board</th></tr></thead><tbody>${accomRows}</tbody></table>` : ''}
        <h2>Payment Schedule</h2>
        <table><tbody>
          <tr><td>Total Holiday Cost</td><td style="text-align:right;font-size:17px;font-weight:700">£${sell.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>
          <tr><td>Payments Received</td><td style="text-align:right;color:#059669;font-weight:600">£${totalPaid.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>
          <tr style="background:#f8fafc"><td><strong>Balance Remaining</strong></td><td style="text-align:right"><strong style="color:${balance > 0 ? '#dc2626' : '#059669'};font-size:15px">${balance > 0 ? '£' + balance.toLocaleString('en-GB', { minimumFractionDigits: 2 }) : 'PAID IN FULL ✓'}</strong></td></tr>
          ${booking.balance_due_date && balance > 0 ? `<tr><td colspan="2" style="color:#dc2626;font-size:12px">⚠ Balance due by: <strong>${fmtDate(booking.balance_due_date)}</strong> (12 weeks before departure)</td></tr>` : ''}
        </tbody></table>
        <p style="font-size:12px;color:#64748b;line-height:1.7;margin-bottom:14px;">Please check all names, dates and travel details immediately and tell us straight away if anything needs correcting. Where applicable, your ATOL Certificate is issued separately and should be kept with this confirmation.</p>
        <div class="sign">Kind regards,<br><strong>Samir Abattouy</strong><br>Mauritius Expert<br><em>Mauritius</em> Holidays Direct</div>
        <div class="footer">Mauritius Holidays Direct · MHD Travel Ltd · ATOL Protected 11423 · ${today}</div>
      </body></html>`
    }

    if (docId === 'booking_terms') {
      return `<!DOCTYPE html><html><head><title>Booking Terms & Conditions — ${ref}</title>${docStyles}</head><body>
        ${brandHeader('Booking Terms & Conditions', `Booking reference: ${ref}`)}
        <p style="line-height:1.8;margin-bottom:18px;">These booking conditions apply to the holiday arrangements confirmed under booking reference <strong>${ref}</strong>. They are supplied separately from the commercial confirmation and ATOL Certificate for easier client review.</p>

        <div class="terms-block">
          <h3>1. Your Booking</h3>
          <ul>
            <li>Your booking is confirmed once we accept your booking and receive payment or authority to take payment.</li>
            <li>Please check all names, dates and booked arrangements immediately on receipt of your confirmation documents.</li>
            <li>Passenger names must match passports exactly. Any correction costs charged by airlines or suppliers will be payable by the client.</li>
          </ul>
        </div>

        <div class="terms-block">
          <h3>2. Payments</h3>
          <ul>
            <li>The total booking value currently recorded is <strong>£${sell.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</strong>.</li>
            <li>Payments received to date total <strong>£${totalPaid.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</strong>.</li>
            <li>${balance > 0 ? `The outstanding balance is <strong>£${balance.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</strong>${booking.balance_due_date ? ` and is due by <strong>${fmtDate(booking.balance_due_date)}</strong>` : ''}.` : 'This booking is currently shown as paid in full.'}</li>
            <li>If balance is not paid by the due date, suppliers may cancel arrangements and cancellation charges may apply.</li>
          </ul>
        </div>

        <div class="terms-block">
          <h3>3. Changes And Cancellations</h3>
          <ul>
            <li>If you ask to change your booking after confirmation, we will do our best to assist but changes are subject to supplier availability and any charges imposed by airlines, hotels or other providers.</li>
            <li>Cancellations after confirmation may incur charges up to the full booking cost, depending on the timing and supplier terms.</li>
            <li>Requests such as room upgrades, extra nights, special services or date changes should be requested as early as possible and are not confirmed until we confirm them back to you in writing.</li>
          </ul>
        </div>

        <div class="terms-block">
          <h3>4. Travel Requirements</h3>
          <ul>
            <li>You are responsible for ensuring all travellers have valid passports, visas, health documentation and travel insurance suitable for the trip.</li>
            <li>Airlines and local authorities may refuse travel if documentation is incomplete or incorrect.</li>
            <li>Special requests are passed to suppliers but cannot be guaranteed unless expressly confirmed in writing.</li>
          </ul>
        </div>

        <div class="terms-block">
          <h3>5. ATOL Protection</h3>
          <ul>
            <li>Flight-inclusive packages protected by ATOL are covered by MHD Travel Ltd, ATOL 11423.</li>
            <li>Your ATOL Certificate is issued separately and is the formal evidence of the protection that applies to your booking.</li>
            <li>Only the protected components shown on the ATOL Certificate are covered by that certificate.</li>
          </ul>
        </div>

        <div class="terms-block">
          <h3>6. Operational Notes For This Booking</h3>
          <p style="font-size:13px;line-height:1.7;color:#374151;">Destination: ${booking.destination || 'TBC'}<br>Travel period: ${fmtDate(booking.departure_date)} to ${fmtDate(booking.return_date)}<br>Passengers: ${paxList || clientName}</p>
        </div>

        <div class="footer">Separate booking conditions supplied with ${ref} · ${today}</div>
      </body></html>`
    }

    if (docId === 'itinerary') {
      const allLegs = [
        ...outbound.map((f: Flight) => ({ ...f, _dir: 'Outbound' })),
        ...returnFlts.map((f: Flight) => ({ ...f, _dir: 'Return' })),
      ]
      const rows = allLegs.map((f: any, i: number) => `
        <tr style="${i === outbound.length && i > 0 ? 'border-top:2px solid #e5e7eb' : ''}">
          <td style="width:auto"><span class="badge ${f._dir === 'Outbound' ? 'badge-blue' : 'badge-green'}">${f._dir}</span></td>
          <td><strong style="font-size:15px;font-family:monospace">${f.flight_number}</strong><br><span style="color:#64748b;font-size:12px">${f.airline || ''}</span></td>
          <td><strong style="font-size:15px">${f.origin}</strong><br><span style="font-size:12px;color:#64748b">${fmtDate(f.departure_date)}</span><br><strong style="font-size:16px">${f.departure_time || '—'}</strong></td>
          <td style="font-size:20px;color:#d1d5db;text-align:center">→</td>
          <td><strong style="font-size:15px">${f.destination}</strong><br><span style="font-size:12px;color:#64748b">${f.next_day ? (f.arrival_date ? fmtDate(f.arrival_date) : '') + ' (+1)' : fmtDate(f.departure_date)}</span><br><strong style="font-size:16px">${f.arrival_time || '—'}</strong></td>
          <td><span class="badge badge-amber">${f.cabin_class}</span>${f.pnr ? `<br><span style="font-size:11px;color:#64748b">PNR: <strong>${f.pnr}</strong></span>` : ''}</td>
          <td style="font-size:12px;color:#64748b">${f.baggage_notes || '—'}</td>
        </tr>`).join('')
      return `<!DOCTYPE html><html><head><title>Flight Itinerary — ${ref}</title>${docStyles}</head><body>
        ${brandHeader('Flight Itinerary', `Passengers: ${paxList}`)}
        <table><thead><tr><th></th><th>Flight</th><th>Departs</th><th></th><th>Arrives</th><th>Class / PNR</th><th>Baggage</th></tr></thead><tbody>${rows}</tbody></table>
        <p style="font-size:12px;color:#64748b;line-height:1.7">Please arrive at the airport at least 3 hours before departure for international flights. Ensure your passport is valid for at least 6 months beyond your return date. All times are local.</p>
        <div class="footer">Mauritius Holidays Direct · ${ref} · ${today}</div>
      </body></html>`
    }

    if (docId.startsWith('accom_') && docId.endsWith('_customer')) {
      const accomId = Number(docId.split('_')[1])
      const a: Accommodation = accommodations.find((x: Accommodation) => x.id === accomId)
      if (!a) return '<html><body>Not found</body></html>'
      const nights = a.nights || calcNights(a.checkin_date, a.checkout_date)
      return `<!DOCTYPE html><html><head><title>Accommodation Voucher — ${a.hotel_name}</title>${docStyles}</head><body>
        ${brandHeader('Accommodation Voucher', 'Please present this voucher upon check-in')}
        <div class="hotel-highlight">
          <div class="hotel-name">${a.hotel_name}</div>
          <div style="font-size:13px;color:#374151">${a.room_type ? a.room_type + ' × ' + a.room_quantity : ''} &nbsp;·&nbsp; ${a.board_basis || ''}</div>
        </div>
        <table><tbody>
          <tr><td>Lead Guest</td><td><strong>${clientName}</strong></td></tr>
          <tr><td>All Guests</td><td>${paxList}</td></tr>
          <tr><td>Check In</td><td><strong style="font-size:15px">${fmtDate(a.checkin_date)}</strong></td></tr>
          <tr><td>Check Out</td><td><strong style="font-size:15px">${fmtDate(a.checkout_date)}</strong></td></tr>
          <tr><td>Duration</td><td>${nights} nights</td></tr>
          <tr><td>Room Type</td><td>${a.room_type || '—'} × ${a.room_quantity}</td></tr>
          <tr><td>Board Basis</td><td>${a.board_basis || '—'}</td></tr>
          <tr><td>Adults / Children</td><td>${a.adults} adults${a.children > 0 ? ', ' + a.children + ' children' : ''}${a.infants > 0 ? ', ' + a.infants + ' infants' : ''}</td></tr>
          ${a.hotel_confirmation ? `<tr><td>Hotel Reference</td><td><strong style="color:#3b82f6;font-size:15px;font-family:monospace">${a.hotel_confirmation}</strong></td></tr>` : ''}
          ${a.special_occasion ? `<tr><td>Special Occasion</td><td><span class="badge badge-amber">🎉 ${a.special_occasion}</span></td></tr>` : ''}
          ${a.special_requests ? `<tr><td>Special Requests</td><td style="color:#3b82f6;font-style:italic">${a.special_requests}</td></tr>` : ''}
          <tr><td>Our Reference</td><td><strong style="color:#3b82f6;font-family:monospace">${ref}</strong></td></tr>
        </tbody></table>
        <div class="footer">Mauritius Holidays Direct · ${ref} · ${today}</div>
      </body></html>`
    }

    if (docId.startsWith('accom_') && docId.endsWith('_hotel')) {
      const accomId = Number(docId.split('_')[1])
      const a: Accommodation = accommodations.find((x: Accommodation) => x.id === accomId)
      if (!a) return '<html><body>Not found</body></html>'
      const nights = a.nights || calcNights(a.checkin_date, a.checkout_date)
      const paxRows = passengers.map((p: Passenger) =>
        `<tr><td>${p.is_lead ? '<strong>' : ''}${p.title} ${p.first_name} ${p.last_name}${p.is_lead ? ' (Lead)</strong>' : ''}</td><td>${p.passenger_type}</td><td>${p.date_of_birth ? fmtDate(p.date_of_birth) : '—'}</td></tr>`
      ).join('')
      return `<!DOCTYPE html><html><head><title>Hotel Reservation — ${a.hotel_name}</title>${docStyles}</head><body>
        ${brandHeader('Hotel Reservation Request')}
        <p style="line-height:1.8;margin-bottom:20px;">Dear ${a.reservation_email_to ? 'Reservations Team' : 'Sir/Madam'},<br><br>
        We would like to place the following reservation on behalf of our client. Please confirm availability and provide a booking reference at your earliest convenience.</p>
        <table><tbody>
          <tr><td>Hotel</td><td><strong>${a.hotel_name}</strong></td></tr>
          <tr><td>Check In</td><td><strong style="font-size:15px">${fmtDate(a.checkin_date)}</strong></td></tr>
          <tr><td>Check Out</td><td><strong style="font-size:15px">${fmtDate(a.checkout_date)}</strong></td></tr>
          <tr><td>Duration</td><td>${nights} nights</td></tr>
          <tr><td>Room Type</td><td>${a.room_type || 'To be advised'} × ${a.room_quantity}</td></tr>
          <tr><td>Board Basis</td><td>${a.board_basis || 'To be advised'}</td></tr>
          <tr><td>Adults / Children</td><td>${a.adults} adults${a.children > 0 ? ', ' + a.children + ' children' : ''}${a.infants > 0 ? ', ' + a.infants + ' infants' : ''}</td></tr>
          ${a.special_occasion ? `<tr><td>Special Occasion</td><td style="color:#d97706;font-weight:500">🎉 ${a.special_occasion} — Please arrange a complimentary decoration if possible</td></tr>` : ''}
          ${a.special_requests ? `<tr><td>Special Requests</td><td style="color:#3b82f6">${a.special_requests}</td></tr>` : ''}
          <tr><td>Our Reference</td><td><strong style="color:#3b82f6;font-family:monospace;font-size:15px">${ref}</strong></td></tr>
        </tbody></table>
        <h2>Guest Names</h2>
        <table><thead><tr><th>Name</th><th>Type</th><th>Date of Birth</th></tr></thead><tbody>${paxRows}</tbody></table>
        <p style="line-height:1.8">Please confirm this reservation by return email and provide your booking reference number. We look forward to hearing from you.</p>
        <div class="sign">Kind regards,<br><strong>Samir Abattouy</strong><br>Mauritius Expert · <em>Mauritius</em> Holidays Direct<br><span style="font-size:11px;color:#94a3b8">ATOL Protected 11423</span></div>
        <div class="footer">Mauritius Holidays Direct · ${ref} · ${today}</div>
      </body></html>`
    }

    if (docId.startsWith('transfer_')) {
      const transferId = Number(docId.split('_')[1])
      const t: Transfer = transfers.find((x: Transfer) => x.id === transferId)
      if (!t) return '<html><body>Not found</body></html>'
      const typeLabel = TRANSFER_TYPES.find(x => x.value === t.transfer_type)?.label || t.transfer_type
      const accomList = accommodations.map((a: Accommodation) => a.hotel_name).join(' → ')
      return `<!DOCTYPE html><html><head><title>Transfer Voucher — ${ref}</title>${docStyles}</head><body>
        ${brandHeader('Transfer Voucher', 'Please present this voucher to your driver / representative')}
        <div class="highlight" style="border-left-color:#3b82f6">
          <div style="font-size:15px;font-weight:600">${t.supplier_name || 'Transfer Company'}</div>
          <div style="color:#64748b;margin-top:4px">${typeLabel}</div>
          <div style="margin-top:6px;display:flex;gap:12px">
            ${t.meet_greet ? '<span class="badge badge-blue">✓ Meet &amp; Greet</span>' : ''}
            ${t.local_rep ? '<span class="badge badge-green">✓ Local Rep</span>' : ''}
          </div>
        </div>
        <table><tbody>
          <tr><td>Booking Reference</td><td><strong style="color:#3b82f6;font-family:monospace;font-size:15px">${ref}</strong></td></tr>
          <tr><td>Lead Passenger</td><td><strong>${clientName}</strong></td></tr>
          <tr><td>All Passengers</td><td>${paxList}</td></tr>
          ${accomList ? `<tr><td>Accommodation</td><td>${accomList}</td></tr>` : ''}
          ${t.arrival_flight ? `
          <tr style="background:#f8fafc"><td colspan="2" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b">Arrival Transfer</td></tr>
          <tr><td>Flight</td><td><strong style="font-size:16px;font-family:monospace">${t.arrival_flight}</strong></td></tr>
          <tr><td>Arrival Date &amp; Time</td><td><strong>${fmtDate(t.arrival_date)}</strong>${t.arrival_time ? ' at ' + t.arrival_time : ''}</td></tr>` : ''}
          ${t.departure_flight ? `
          <tr style="background:#f8fafc"><td colspan="2" style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b">Departure Transfer</td></tr>
          <tr><td>Flight</td><td><strong style="font-size:16px;font-family:monospace">${t.departure_flight}</strong></td></tr>
          <tr><td>Departure Date &amp; Time</td><td><strong>${fmtDate(t.departure_date)}</strong>${t.departure_time ? ' at ' + t.departure_time : ''}</td></tr>` : ''}
          ${t.inter_hotel_dates ? `<tr><td>Inter-Hotel Transfer</td><td>${t.inter_hotel_dates}</td></tr>` : ''}
          ${t.notes ? `<tr><td>Notes</td><td style="color:#64748b;font-style:italic">${t.notes}</td></tr>` : ''}
        </tbody></table>
        <div class="footer">Mauritius Holidays Direct · ${ref} · ${today}</div>
      </body></html>`
    }

    if (docId === 'atol') {
      return `<!DOCTYPE html><html><head><title>ATOL Certificate — ${ref}</title>${docStyles}</head><body>
        <div class="atol-wrap">
          <div class="atol-canvas">
            <div class="atol-corner"></div>
            <div class="atol-watermark">
              <div class="atol-watermark-box"></div>
              <div class="atol-watermark-text">ATOL</div>
            </div>
            <div class="atol-text atol-banner">This is an important document. Make sure that you take it with you when you travel.</div>
            <div class="atol-text atol-main-title">ATOL Certificate</div>
            <div class="atol-text atol-lead">This confirms that your money is protected by the ATOL scheme and that you can get home if your travel company collapses.</div>
            <div class="atol-text atol-sublead">This certificate sets out how the ATOL scheme will protect the people named on it for the parts of their trip listed below.</div>

            <div class="atol-field atol-protected-left">
              <strong>Who is protected?</strong>
              <p>${paxList || clientName}</p>
            </div>

            <div class="atol-field atol-protected-right">
              <strong>Number of passengers: ${passengerCountExInfants}</strong>
            </div>

            <div class="atol-field atol-what">
              <strong>What is protected and who is providing the protection?</strong>
              <p>${productDescription}. Further details about your booking and protection can be found in the table overleaf.</p>
            </div>

            <div class="atol-field atol-who">
              <strong>Who is protecting your trip?</strong>
              <p>MHD Travel Ltd, 11423</p>
            </div>

            <div class="atol-protection-title">Your protection</div>
            <div class="atol-body">
              <p>You are protected from when you were given this certificate to the end of your trip. If the provider of one of the parts of your trip listed above stops trading, in most circumstances, <strong>MHD Travel Ltd</strong> must provide you with an alternative at no extra cost or offer you a full refund of the total ATOL-protected cost. See guidance on your rights at www.atol.org.uk. Please contact <strong>MHD Travel Ltd</strong> on 020 8951 6922.</p>
              <p>If <strong>MHD Travel Ltd</strong> stops trading and you are overseas, your flight arrangements should not be affected. However, you should check the instructions at www.atol.org.uk. Or, you can call (+44) 20 7453 6350. The ATOL website will also provide advice on what you must do if you have not yet left for your holiday.</p>
              <p>If <strong>MHD Travel Ltd</strong> stops trading, depending on the terms of the ATOL scheme available at www.atol.org.uk, the passengers named above will either:</p>
              <p>1. be able to take and complete their trip, and return to the UK; or, if that is not possible,<br>2. receive a refund for the total amount paid to <strong>MHD Travel Ltd</strong>.</p>
            </div>

            <div class="atol-legal-bottom">
              By issuing this ATOL Certificate, under Regulation 17 of the Civil Aviation (Air Travel Organisers' Licensing) Regulations 2012, MHD Travel Ltd confirms that the parts of the trip listed above are sold in line with the ATOL held by MHD Travel Ltd.<br><br>
              The ATOL scheme is run by the Civil Aviation Authority and paid for by the Air Travel Trust. To see what that is and what you can expect, together with full information on its terms and conditions, go to www.atol.org.uk.
            </div>

            <div class="atol-footer-grid">
              <div>
                <span class="label">Unique reference<br>number:</span>
                <span class="value">${ref}</span>
              </div>
              <div>
                <span class="label">Date of issue:</span>
                <span class="value">${new Date().toLocaleDateString('en-GB')}</span>
              </div>
              <div>
                <span class="label">ATOL Certificate<br>Issuer:</span>
                <span class="issuer-note">Mauritius Holidays Direct</span>
              </div>
              <div>
                <span class="label">ATOL<br>number:</span>
                <span class="value">11423</span>
              </div>
              <div>
                <span class="value" style="padding-top:20px">Flight-plus<br>sale</span>
              </div>
            </div>

            <div class="atol-copyright">Copyright UK Civil Aviation Authority. The ATOL Logo is a registered trade mark.</div>
          </div>
        </div>
      </body></html>`
    }

    if (docId === 'cancellation_invoice') {
      const cancDate = booking.cancellation_date ? fmtDate(booking.cancellation_date) : today
      const isDepositOnly = booking.cancellation_type === 'deposit_only'
      const cancAmount = isDepositOnly ? totalPaid : null
      const cancTypeLabel =
        booking.cancellation_type === 'deposit_only'  ? 'Deposit Retained — No Further Charges' :
        booking.cancellation_type === 'post_payment'  ? 'Booking Cancelled Post Full Payment' :
        booking.cancellation_type === 'tickets_issued'? 'Cancelled — Tickets Previously Issued' : 'Cancelled'
      const settlementSummary =
        booking.cancellation_type === 'deposit_only'
          ? 'Client deposit retained as the cancellation charge.'
          : booking.cancellation_type === 'tickets_issued'
            ? 'Refund, if any, will be confirmed separately by Ticketing & Admin in line with airline fare rules.'
            : 'Refund, if any, will be confirmed separately by Customer Service / Case Management in line with terms and conditions.'
      const checklist = booking.cancellation_checklist || {}
      const checklistItems = [
        checklist['flights']       !== undefined ? `<li>Flights: ${checklist['flights'] ? '✓ Cancelled with supplier' : '⚠ Pending supplier cancellation'}</li>` : '',
        checklist['accommodation'] !== undefined ? `<li>Accommodation: ${checklist['accommodation'] ? '✓ Cancelled with supplier' : '⚠ Pending supplier cancellation'}</li>` : '',
        checklist['transfers']     !== undefined ? `<li>Transfers: ${checklist['transfers'] ? '✓ Cancelled with supplier' : '⚠ Pending supplier cancellation'}</li>` : '',
        checklist['extras']        !== undefined ? `<li>Extras: ${checklist['extras'] ? '✓ Cancelled with supplier' : '⚠ Pending supplier cancellation'}</li>` : '',
      ].filter(Boolean).join('')

      return `<!DOCTYPE html><html><head><title>Cancellation Invoice — ${ref}</title>${docStyles}</head><body>
        ${brandHeader('Cancellation Invoice', `Booking reference: ${ref} · Cancelled ${cancDate}`)}
        <div class="highlight" style="border-left-color:#dc2626;background:#fef2f2;">
          <div style="color:#dc2626;font-weight:700;font-size:15px;margin-bottom:4px;">CANCELLATION NOTICE</div>
          <div style="font-size:12.5px;color:#7f1d1d;">${cancTypeLabel}</div>
        </div>
        <h2>Client Details</h2>
        <table><tbody>
          <tr><td>Client</td><td>${clientName}</td></tr>
          <tr><td>Booking Reference</td><td style="font-family:monospace;font-weight:700;">${ref}</td></tr>
          <tr><td>Cancellation Date</td><td>${cancDate}</td></tr>
          ${booking.cancellation_actioned_by ? `<tr><td>Actioned By</td><td>${booking.cancellation_actioned_by}</td></tr>` : ''}
          ${booking.cancellation_notes ? `<tr><td>Notes</td><td>${booking.cancellation_notes}</td></tr>` : ''}
        </tbody></table>
        <h2>Original Booking Summary</h2>
        <table><tbody>
          <tr><td>Product</td><td>${productDescription}</td></tr>
          <tr><td>Departure</td><td>${fmtDate(booking.departure_date)}${booking.return_date ? ` → ${fmtDate(booking.return_date)}` : ''}</td></tr>
          <tr><td>Passengers</td><td>${paxList || '—'}</td></tr>
          <tr><td>Total Holiday Value</td><td><strong>£${sell.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</strong></td></tr>
          <tr><td>Total Paid</td><td>£${totalPaid.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>
        </tbody></table>
        ${checklistItems ? `<h2>Supplier Cancellation Status</h2><ul style="padding-left:18px;line-height:2;">${checklistItems}</ul>` : ''}
        <h2>Cancellation Charge</h2>
        <table><tbody>
          <tr><td>Settlement</td><td>${settlementSummary}</td></tr>
          ${cancAmount !== null ? `<tr><td>Amount Forfeited</td><td style="font-size:15px;font-weight:700;color:#dc2626;">£${cancAmount.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</td></tr>` : ''}
        </tbody></table>
        <div class="footer">Mauritius Holidays Direct · MHD Travel Ltd · This document serves as your official cancellation invoice. Please retain for your records.</div>
      </body></html>`
    }

    return '<html><body>Document not found</body></html>'
  }

  function openDoc(docId: string) {
    setActiveDoc(docId)
    setPreview(generateDoc(docId))
  }

  async function printDoc() {
    if (!activeDoc) return
    const html = generateDoc(activeDoc)
    const win = window.open('', '_blank', 'width=900,height=750')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
    await markDocumentIssued(activeDoc)
    setTimeout(() => win.print(), 500)
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' }}>
      {/* Doc list */}
      <div>
        <div style={{ fontFamily: 'Fraunces,serif', fontSize: '16px', fontWeight: '300', marginBottom: '12px' }}>Documents</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {DOCS.map(d => (
            <div key={d.id} onClick={() => openDoc(d.id)} className="card"
              style={{ padding: '11px 14px', cursor: 'pointer', borderLeft: `3px solid ${activeDoc === d.id ? 'var(--accent)' : 'var(--border)'}`, background: activeDoc === d.id ? 'var(--bg-secondary)' : undefined, transition: 'all 0.12s' }}
              onMouseEnter={e => { if (activeDoc !== d.id) e.currentTarget.style.background = 'var(--bg-secondary)' }}
              onMouseLeave={e => { if (activeDoc !== d.id) e.currentTarget.style.background = 'transparent' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                <span style={{ fontSize: '17px', flexShrink: 0, marginTop: '1px' }}>{d.icon}</span>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)', lineHeight: '1.3' }}>{d.label}</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '2px' }}>{d.desc}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview */}
      <div>
        {activeDoc && preview ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginBottom: '10px' }}>
              <button className="btn btn-secondary" onClick={() => { setActiveDoc(null); setPreview(null) }}>✕ Close</button>
              <button className="btn btn-cta" onClick={printDoc}>🖨 Print / Save & Mark Issued</button>
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: '10px', overflow: 'hidden', background: 'white', boxShadow: 'var(--shadow-md)' }}>
              <iframe srcDoc={preview} style={{ width: '100%', height: '700px', border: 'none' }} title="Document Preview" />
            </div>
          </div>
        ) : (
          <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.25 }}>📄</div>
            <div style={{ fontFamily: 'Fraunces,serif', fontSize: '17px', fontWeight: '300', marginBottom: '6px' }}>Document Centre</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Select a document from the list to preview and print</div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TASKS TAB ────────────────────────────────────────────────
function TasksTab({ tasks, activities, bookingReference, onUpdate, showToast }: any) {
  const categories = Array.from(new Set((tasks as BookingTask[]).map(t => t.category))).sort((a, b) => {
    const aIndex = TASK_CATEGORY_ORDER.indexOf(a)
    const bIndex = TASK_CATEGORY_ORDER.indexOf(b)
    if (aIndex === -1 && bIndex === -1) return a.localeCompare(b)
    if (aIndex === -1) return 1
    if (bIndex === -1) return -1
    return aIndex - bIndex
  })
  const tasksDone  = tasks.filter((t: BookingTask) => t.is_done).length
  const taskPct    = tasks.length ? Math.round((tasksDone / tasks.length) * 100) : 0
  const relevantActivities = (activities as Activity[])
    .filter(activity => activity.activity_type === 'TASK_COMPLETED' || activity.notes?.includes(bookingReference))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 8)

  async function toggle(task: BookingTask) {
    try {
      await apiRequest(`/api/bookings/${task.booking_id}/tasks`, {
        method: 'PUT',
        body: JSON.stringify({ action: 'toggle', taskId: task.id }),
      })
      onUpdate()
    } catch (error: any) {
      showToast(error.message || 'Failed to update task', 'error')
    }
  }

  return (
    <div>
      {/* Progress */}
      <div className="card" style={{ padding:'16px 20px', marginBottom:'16px', display:'flex', alignItems:'center', gap:'16px' }}>
        <div style={{ flex:1 }}>
          <div style={{ height:'8px', background:'var(--border)', borderRadius:'4px', overflow:'hidden' }}>
            <div style={{ height:'100%', width:`${taskPct}%`, background: taskPct===100 ? 'var(--green)' : 'var(--accent)', borderRadius:'4px', transition:'width 0.3s' }}/>
          </div>
        </div>
        <div style={{ fontSize:'14px', fontWeight:'600', color: taskPct===100 ? 'var(--green)' : 'var(--text-primary)', whiteSpace:'nowrap' }}>{tasksDone}/{tasks.length} complete · {taskPct}%</div>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:'12px' }}>
        {categories.map(cat => {
          const catTasks = tasks
            .filter((task: BookingTask) => task.category === cat)
            .sort((a: BookingTask, b: BookingTask) => (a.sort_order || 0) - (b.sort_order || 0))
          const doneCnt = catTasks.filter((t: BookingTask) => t.is_done).length
          const color   = CAT_COLORS[cat] || 'var(--accent)'
          return (
            <div key={cat} className="card" style={{ padding:'16px 18px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                  <span>{CAT_ICONS[cat]}</span>
                  <span style={{ fontSize:'13px', fontWeight:'600', color }}>{cat}</span>
                </div>
                <span style={{ fontSize:'11.5px', color: doneCnt===catTasks.length ? 'var(--green)' : 'var(--text-muted)' }}>{doneCnt}/{catTasks.length}</span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {catTasks.map((task: BookingTask) => (
                  <label key={task.id} style={{ display:'flex', gap:'10px', alignItems:'center', cursor:'pointer', padding:'6px 8px', borderRadius:'6px', transition:'background 0.1s' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-secondary)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                    <input type="checkbox" checked={task.is_done} onChange={() => toggle(task)} style={{ width:'15px', height:'15px', accentColor:color, cursor:'pointer', flexShrink:0 }}/>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'13px', color: task.is_done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.is_done ? 'line-through' : 'none' }}>
                        {task.task_name}
                      </div>
                      {(task.due_date || task.notes) && (
                        <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', marginTop:'3px', alignItems:'center' }}>
                          {task.due_date && (
                            <span style={{ fontSize:'10.5px', color:'var(--text-muted)', background:'var(--bg-secondary)', padding:'1px 7px', borderRadius:'999px' }}>
                              Due {fmtDate(task.due_date)}
                            </span>
                          )}
                          {task.notes && (
                            <span style={{ fontSize:'11px', color:'var(--text-muted)', lineHeight:1.4 }}>
                              {task.notes}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {task.is_done && task.completed_at && <span style={{ fontSize:'10.5px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{fmtDate(task.completed_at)}</span>}
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <div className="card" style={{ padding:'16px 18px', marginTop:'16px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' }}>
          <div style={{ fontSize:'13px', fontWeight:'700', color:'var(--text-primary)' }}>Recent Activity</div>
          <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>{bookingReference}</span>
        </div>
        {relevantActivities.length === 0 ? (
          <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>No recent task or booking activity yet.</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {relevantActivities.map(activity => (
              <div key={activity.id} style={{ padding:'10px 12px', background:'var(--bg-secondary)', borderRadius:'8px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', gap:'12px', alignItems:'flex-start' }}>
                  <div style={{ fontSize:'12.5px', color:'var(--text-primary)', lineHeight:1.5 }}>{activity.notes || activity.activity_type}</div>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{fmtDate(activity.created_at)}</div>
                </div>
                <div style={{ fontSize:'10.5px', color:'var(--text-muted)', marginTop:'4px' }}>{activity.activity_type}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── CANCELLATION MODAL ───────────────────────────────────────
function CancellationModal({ booking, hasFlights, hasAccommodation, hasTransfers, hasExtras, totalPaid, defaultActionedBy, onClose, onConfirm }: {
  booking: Booking
  hasFlights: boolean
  hasAccommodation: boolean
  hasTransfers: boolean
  hasExtras: boolean
  totalPaid: number
  defaultActionedBy: string
  onClose: () => void
  onConfirm: (type: string, checklist: Record<string, boolean>, notes: string, actionedBy: string) => Promise<void>
}) {
  const [cancType, setCancType]       = useState<string>('')
  const [checklist, setChecklist]     = useState<Record<string, boolean>>({
    flights:       false,
    accommodation: false,
    transfers:     false,
    extras:        false,
  })
  const [notes, setNotes]             = useState('')
  const [actionedBy, setActionedBy]   = useState(defaultActionedBy || '')
  const [submitting, setSubmitting]   = useState(false)

  const TYPES = [
    { value: 'deposit_only',  label: 'Deposit only paid — client loses deposit, no further charges' },
    { value: 'post_payment',  label: 'Full payment received — CS / Case Management to handle refund' },
    { value: 'tickets_issued', label: 'Tickets already issued — Ticketing & Admin to handle' },
  ]

  const checkItems = [
    { key: 'flights',       label: 'Flights cancelled with supplier',       show: hasFlights },
    { key: 'accommodation', label: 'Accommodation cancelled with supplier', show: hasAccommodation },
    { key: 'transfers',     label: 'Transfers cancelled with supplier',     show: hasTransfers },
    { key: 'extras',        label: 'Extras / activities cancelled',         show: hasExtras },
  ].filter(i => i.show)

  async function handleSubmit() {
    if (!cancType || !actionedBy) return
    setSubmitting(true)
    await onConfirm(cancType, checklist, notes, actionedBy)
    setSubmitting(false)
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
      <div style={{ background:'var(--bg-primary)', borderRadius:'14px', width:'100%', maxWidth:'520px', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
        {/* Header */}
        <div style={{ padding:'20px 24px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'20px' }}>🚫</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:'600', fontSize:'15px', color:'#dc2626' }}>Cancel Booking</div>
            <div style={{ fontSize:'12.5px', color:'var(--text-muted)', marginTop:'1px' }}>{booking.booking_reference} · {booking.deals?.clients ? `${booking.deals.clients.first_name} ${booking.deals.clients.last_name}` : ''}</div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', color:'var(--text-muted)', lineHeight:1 }}>×</button>
        </div>

        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'16px' }}>
          {/* Warning */}
          <div style={{ background:'#fef3c7', border:'1px solid #fbbf24', borderRadius:'8px', padding:'10px 14px', fontSize:'12.5px', color:'#92400e' }}>
            This action cannot be undone. The booking will be marked as cancelled immediately.
          </div>

          {/* Cancellation type */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>Cancellation Type *</label>
            <select value={cancType} onChange={e => setCancType(e.target.value)}
              style={{ width:'100%', padding:'9px 12px', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'13.5px', background:'var(--bg-primary)', color:'var(--text-primary)' }}>
              <option value=''>— Select type —</option>
              {TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Payment summary for context */}
          {cancType === 'deposit_only' && totalPaid > 0 && (
            <div style={{ background:'#f0fdf4', border:'1px solid #86efac', borderRadius:'8px', padding:'10px 14px', fontSize:'12.5px', color:'#15803d' }}>
              Deposit retained: <strong>£{totalPaid.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</strong> — this becomes the commissionable amount
            </div>
          )}

          {/* Supplier cancellation checklist */}
          {checkItems.length > 0 && (
            <div>
              <label style={{ fontSize:'12px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'8px' }}>Supplier Cancellation Checklist</label>
              <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'8px' }}>
                Any item you leave unticked will be pushed into Today as an operations follow-up so it does not get buried.
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {checkItems.map(item => (
                  <label key={item.key} style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', padding:'8px 12px', borderRadius:'6px', background:'var(--bg-secondary)', fontSize:'13px' }}>
                    <input type='checkbox' checked={checklist[item.key] || false}
                      onChange={e => setChecklist(prev => ({ ...prev, [item.key]: e.target.checked }))}
                      style={{ width:'15px', height:'15px', accentColor:'#dc2626', cursor:'pointer', flexShrink:0 }} />
                    <span style={{ color: checklist[item.key] ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: checklist[item.key] ? 'line-through' : 'none' }}>
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder='Reason for cancellation, client reference, etc.'
              style={{ width:'100%', padding:'9px 12px', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'13px', resize:'vertical', background:'var(--bg-primary)', color:'var(--text-primary)' }} />
          </div>

          {/* Actioned by */}
          <div>
            <label style={{ fontSize:'12px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', display:'block', marginBottom:'6px' }}>Actioned By (Manager) *</label>
            <input type='text' value={actionedBy} onChange={e => setActionedBy(e.target.value)}
              placeholder='Manager name'
              style={{ width:'100%', padding:'9px 12px', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'13px', background:'var(--bg-primary)', color:'var(--text-primary)' }} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding:'14px 24px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:'10px', justifyContent:'flex-end' }}>
          <button className='btn btn-secondary' onClick={onClose} disabled={submitting}>Cancel</button>
          <button onClick={handleSubmit} disabled={!cancType || !actionedBy || submitting}
            style={{ padding:'9px 20px', borderRadius:'8px', border:'none', background: (!cancType || !actionedBy) ? '#fca5a5' : '#dc2626', color:'white', fontWeight:'600', fontSize:'13.5px', cursor: (!cancType || !actionedBy) ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Cancelling…' : 'Confirm Cancellation'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── PORTAL TAB ────────────────────────────────────────────
function PortalTab({ bookingId, passengers, showToast }: { bookingId: number; passengers: any[]; showToast: (m: string) => void }) {
  const [data, setData]           = useState<any>(null)
  const [loading, setLoading]     = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [generating, setGen]      = useState(false)
  const [revoking, setRevoke]     = useState(false)
  const [notifBody, setNBody]     = useState('')
  const [sendingN, setSendingN]   = useState(false)
  const [passports, setPassports] = useState<any[]>([])
  const [requests, setRequests]   = useState<any[]>([])

  useEffect(() => { void load() }, [bookingId])

  async function load() {
    setLoading(true)
    setLoadError(null)
    try {
      const [portalRes, passRes, reqRes] = await Promise.all([
        authedFetch(`/api/bookings/${bookingId}/portal`).then((r: Response) => r.json()),
        authedFetch(`/api/bookings/${bookingId}/passports`).then((r: Response) => r.json()),
        authedFetch(`/api/bookings/${bookingId}/requests`).then((r: Response) => r.json()),
      ])
      if (portalRes.success) setData(portalRes.data)
      if (passRes.success && Array.isArray(passRes.data)) setPassports(passRes.data)
      if (reqRes.success && Array.isArray(reqRes.data)) setRequests(reqRes.data)
    } catch (e) {
      setLoadError(String(e))
    } finally {
      setLoading(false)
    }
  }

  async function generate() {
    setGen(true)
    const res = await authedFetch(`/api/bookings/${bookingId}/portal/generate`, { method: 'POST' })
    const r = await res.json()
    setGen(false)
    if (r.success) { showToast('Portal link generated'); void load() }
    else showToast(r.message ?? 'Failed to generate link')
  }

  async function revoke() {
    if (!confirm('Revoke this portal link? The client will lose access immediately.')) return
    setRevoke(true)
    await authedFetch(`/api/bookings/${bookingId}/portal/revoke`, { method: 'POST' })
    setRevoke(false)
    showToast('Portal access revoked')
    void load()
  }

  async function sendNotification() {
    if (!notifBody.trim()) return
    setSendingN(true)
    await authedFetch(`/api/bookings/${bookingId}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ body: notifBody.trim() }),
    })
    setSendingN(false)
    setNBody('')
    showToast('Notification sent')
  }

  async function updatePassport(uploadId: string, status: string, issueNote?: string) {
    await authedFetch(`/api/bookings/${bookingId}/passports/${uploadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, issue_note: issueNote ?? null }),
    })
    showToast(status === 'checked' ? 'Passport confirmed' : 'Issue flagged')
    void load()
  }

  async function updateRequest(requestId: string, status: string) {
    await authedFetch(`/api/bookings/${bookingId}/requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    void load()
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: 20 }}>Loading portal data…</div>
  if (loadError) return <div style={{ color: '#dc2626', fontSize: 13, padding: 20 }}>Failed to load portal data: {loadError}</div>

  const token = data?.token
  const readiness = data?.readiness
  const isActive = token?.active

  const STATUS_PASSPORT_LABEL: Record<string, string> = { pending: 'Awaiting upload', uploaded: 'Awaiting review', needs_attention: 'Issue flagged', checked: 'Confirmed' }
  const STATUS_PASSPORT_COLOR: Record<string, string> = { pending: '#9ca3af', uploaded: '#1d4ed8', needs_attention: '#dc2626', checked: '#059669' }
  const STATUS_REQ_LABEL: Record<string, string> = { submitted: 'Submitted', seen: 'In progress', actioned: 'Arranged' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 680 }}>

      {/* Portal access card */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 20, border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600 }}>Client Portal Access</h3>
          <span style={{ fontSize: 12, fontWeight: 600, padding: '3px 10px', borderRadius: 20,
            background: isActive ? '#dcfce7' : '#f3f4f6',
            color: isActive ? '#166534' : '#6b7280' }}>
            {isActive ? 'Active' : token?.revoked_at ? 'Revoked' : 'Not sent'}
          </span>
        </div>

        {/* Readiness gate */}
        {readiness && !readiness.ready && (
          <div style={{ marginBottom: 16, padding: 12, background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
            <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 600, color: '#92400e' }}>Complete booking before sending portal link:</p>
            {readiness.missing.map((m: any) => (
              <p key={m.field} style={{ margin: '2px 0', fontSize: 13, color: '#b45309' }}>· {m.label}</p>
            ))}
          </div>
        )}

        {/* Active link display */}
        {isActive && token?.portal_url && (
          <div style={{ marginBottom: 16, padding: 10, background: '#f0fdf4', borderRadius: 8, border: '1px solid #bbf7d0' }}>
            <p style={{ margin: '0 0 4px', fontSize: 12, color: '#6b7280' }}>Portal URL</p>
            <p style={{ margin: '0 0 4px', fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all', color: '#111827' }}>{token.portal_url}</p>
            <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>Expires {new Date(token.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            onClick={generate}
            disabled={generating || (readiness && !readiness.ready)}
            style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 7, border: 'none', background: (readiness && !readiness.ready) ? '#e5e7eb' : '#1a3a5c', color: (readiness && !readiness.ready) ? '#9ca3af' : '#fff', cursor: (generating || (readiness && !readiness.ready)) ? 'not-allowed' : 'pointer' }}
          >
            {generating ? 'Generating…' : isActive ? 'Regenerate link' : 'Send portal link'}
          </button>

          {isActive && (
            <button onClick={revoke} disabled={revoking}
              style={{ fontSize: 13, padding: '8px 16px', borderRadius: 7, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', cursor: revoking ? 'not-allowed' : 'pointer' }}>
              {revoking ? 'Revoking…' : 'Revoke access'}
            </button>
          )}

          {isActive && token?.portal_url && (
            <button onClick={() => { navigator.clipboard.writeText(token.portal_url); showToast('Link copied') }}
              style={{ fontSize: 13, padding: '8px 16px', borderRadius: 7, border: '1px solid var(--border)', background: '#fff', color: 'var(--text-primary)', cursor: 'pointer' }}>
              Copy link
            </button>
          )}
        </div>
      </div>

      {/* Passports panel */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 20, border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>Passports</h3>
        {passports.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>No passport uploads yet.</p>
        ) : passports.map((p: any) => (
            <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 500 }}>{p.passenger_name}</p>
                <p style={{ margin: 0, fontSize: 12, color: STATUS_PASSPORT_COLOR[p.status] ?? '#9ca3af', fontWeight: 600 }}>
                  {STATUS_PASSPORT_LABEL[p.status] ?? p.status}
                </p>
                {p.issue_note && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#dc2626' }}>Note: {p.issue_note}</p>}
                {p.checked_at && <p style={{ margin: '2px 0 0', fontSize: 12, color: '#9ca3af' }}>Confirmed {new Date(p.checked_at).toLocaleDateString('en-GB')}</p>}
              </div>
              {p.status === 'uploaded' && (
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={() => updatePassport(p.id, 'checked')}
                    style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer' }}>
                    Mark checked
                  </button>
                  <button onClick={() => { const note = prompt('Describe the issue:'); if (note) updatePassport(p.id, 'needs_attention', note) }}
                    style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid #dc2626', background: '#fff', color: '#dc2626', cursor: 'pointer' }}>
                    Flag issue
                  </button>
                </div>
              )}
              {p.status === 'needs_attention' && (
                <button onClick={() => updatePassport(p.id, 'checked')}
                  style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer' }}>
                  Mark checked
                </button>
              )}
            </div>
          ))}
        </div>

      {/* Client requests */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 20, border: '1px solid var(--border)' }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, fontWeight: 600 }}>
          Client Requests
          {requests.filter((r: any) => r.status === 'submitted').length > 0 && (
            <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#1a3a5c', color: '#fff' }}>
              {requests.filter((r: any) => r.status === 'submitted').length} new
            </span>
          )}
        </h3>
        {requests.length === 0 ? (
          <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>No requests yet.</p>
        ) : requests.map((r: any) => (
          <div key={r.id} style={{ padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: '0 0 2px', fontSize: 12, color: 'var(--text-muted)' }}>{r.category}</p>
                <p style={{ margin: 0, fontSize: 14 }}>{r.message}</p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleDateString('en-GB')}</p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
                  background: r.status === 'actioned' ? '#dcfce7' : r.status === 'seen' ? '#dbeafe' : '#f3f4f6',
                  color: r.status === 'actioned' ? '#166534' : r.status === 'seen' ? '#1e40af' : '#374151' }}>
                  {STATUS_REQ_LABEL[r.status] ?? r.status}
                </span>
                {r.status === 'submitted' && (
                  <button onClick={() => updateRequest(r.id, 'seen')}
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: '1px solid var(--border)', background: '#fff', cursor: 'pointer' }}>
                    Mark seen
                  </button>
                )}
                {r.status === 'seen' && (
                  <button onClick={() => updateRequest(r.id, 'actioned')}
                    style={{ fontSize: 11, padding: '3px 8px', borderRadius: 5, border: 'none', background: '#059669', color: '#fff', cursor: 'pointer' }}>
                    Mark arranged
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Manual notification */}
      {isActive && (
        <div style={{ background: 'var(--bg-secondary)', borderRadius: 10, padding: 20, border: '1px solid var(--border)' }}>
          <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>Send a Message to Client</h3>
          <textarea
            value={notifBody}
            onChange={e => setNBody(e.target.value)}
            placeholder="Message shown in client portal…"
            rows={3}
            maxLength={500}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 7, border: '1px solid var(--border)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', marginBottom: 8 }}
          />
          <button onClick={sendNotification} disabled={sendingN || !notifBody.trim()}
            style={{ fontSize: 13, fontWeight: 600, padding: '8px 16px', borderRadius: 7, border: 'none', background: notifBody.trim() ? '#1a3a5c' : '#e5e7eb', color: notifBody.trim() ? '#fff' : '#9ca3af', cursor: (sendingN || !notifBody.trim()) ? 'not-allowed' : 'pointer' }}>
            {sendingN ? 'Sending…' : 'Send to portal'}
          </button>
        </div>
      )}
    </div>
  )
}
