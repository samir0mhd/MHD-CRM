'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ── TYPES ────────────────────────────────────────────────────
type Booking = {
  id: number
  booking_reference: string
  deal_id: number
  status: string
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
  created_at: string
  deals?: { id: number; title: string; deal_value: number; clients?: Client }
}
type Client = { id: number; first_name: string; last_name: string; phone: string; email: string }
type Passenger = {
  id: number; booking_id: number; title: string; first_name: string; last_name: string
  date_of_birth: string | null; passenger_type: string; is_lead: boolean
  passport_number: string | null; passport_expiry: string | null
}
type Flight = {
  id: number; booking_id: number; direction: string; leg_order: number
  flight_number: string | null; airline: string | null; origin: string | null; destination: string | null
  departure_date: string | null; departure_time: string | null
  arrival_date: string | null; arrival_time: string | null; next_day: boolean
  cabin_class: string; pnr: string | null; flight_supplier: string | null
  net_cost: number | null; baggage_notes: string | null; cabin_notes: string | null
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
}
type Extra = {
  id: number; booking_id: number; extra_type: string | null; description: string | null
  supplier: string | null; net_cost: number | null; sell_price: number | null; notes: string | null
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
  { key:'balance_chased',        name:'Balance payment chased',         category:'Financial',     sort:3  },
  { key:'balance_received',      name:'Balance payment received',       category:'Financial',     sort:4  },
  { key:'final_costing',         name:'Final costing confirmed',        category:'Financial',     sort:5  },
  { key:'flights_ticketed',      name:'Flights ticketed',               category:'Flights',       sort:6  },
  { key:'ticket_numbers',        name:'Ticket numbers recorded',        category:'Flights',       sort:7  },
  { key:'etickets_sent',         name:'E-tickets sent to client',       category:'Flights',       sort:8  },
  { key:'hotel_confirmation',    name:'Hotel confirmation received',    category:'Accommodation', sort:9  },
  { key:'rooming_list',          name:'Hotel rooming list sent',        category:'Accommodation', sort:10 },
  { key:'special_requests',      name:'Special requests confirmed',     category:'Accommodation', sort:11 },
  { key:'transfers_booked',      name:'Transfers booked with DMC',      category:'Transfers',     sort:12 },
  { key:'transfer_confirmation', name:'Transfer confirmation received', category:'Transfers',     sort:13 },
  { key:'arrival_details_sent',  name:'Arrival details sent to DMC',   category:'Transfers',     sort:14 },
  { key:'booking_confirmation',  name:'Booking confirmation sent',      category:'Documents',     sort:15 },
  { key:'travel_docs',           name:'Travel documents issued',        category:'Documents',     sort:16 },
  { key:'welcome_pack',          name:'Welcome pack sent',              category:'Documents',     sort:17 },
  { key:'atol_certificate',      name:'ATOL certificate issued',        category:'Documents',     sort:18 },
  { key:'predeparture_call',     name:'Pre-departure call made',        category:'Pre-Departure', sort:19 },
  { key:'emergency_contact',     name:'Emergency contact confirmed',    category:'Pre-Departure', sort:20 },
  { key:'welcome_back_call',     name:'Welcome back call made',         category:'Post-Trip',     sort:21 },
  { key:'review_requested',      name:'Review requested (Trustpilot)',  category:'Post-Trip',     sort:22 },
  { key:'rebook_conversation',   name:'Re-booking conversation started',category:'Post-Trip',     sort:23 },
]
const CAT_COLORS: Record<string,string> = {
  Financial:'#10b981', Flights:'#3b82f6', Accommodation:'#8b5cf6',
  Transfers:'#f97316', Documents:'#f59e0b', 'Pre-Departure':'#ec4899', 'Post-Trip':'#14b8a6',
}
const CAT_ICONS: Record<string,string> = {
  Financial:'💷', Flights:'✈', Accommodation:'🏨',
  Transfers:'🚗', Documents:'📄', 'Pre-Departure':'📞', 'Post-Trip':'🌟',
}

// ── HELPERS ──────────────────────────────────────────────────
const fmt     = (n: number | null) => '£' + (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtDate = (d: string | null) => !d ? '—' : new Date(d + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const daysUntil = (d: string | null) => !d ? null : Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)

function calcNights(checkin: string | null, checkout: string | null): number | null {
  if (!checkin || !checkout) return null
  return Math.round((new Date(checkout).getTime() - new Date(checkin).getTime()) / 86400000)
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
  const [tasks, setTasks]               = useState<BookingTask[]>([])
  const [hotels, setHotels]             = useState<Hotel[]>([])
  const [suppliers, setSuppliers]       = useState<Supplier[]>([])
  const [loading, setLoading]           = useState(true)
  const [tab, setTab]                   = useState<'overview'|'passengers'|'flights'|'accommodation'|'transfers'|'extras'|'payments'|'costing'|'tasks'|'documents'>('overview')
  const [toast, setToast]               = useState<{ msg: string; type: 'success'|'error' } | null>(null)
  const [saving, setSaving]             = useState(false)
  const toastTimer                      = useRef<any>(null)

  useEffect(() => { loadAll() }, [id])

  async function loadAll() {
    setLoading(true)
    const [
      { data: bk }, { data: pax }, { data: fl }, { data: ac },
      { data: tr }, { data: ex }, { data: pay }, { data: tk },
      { data: ht }, { data: sup },
    ] = await Promise.all([
      supabase.from('bookings').select('*, deals(id,title,deal_value,clients(*))').eq('id', id).single(),
      supabase.from('booking_passengers').select('*').eq('booking_id', id).order('is_lead', { ascending: false }),
      supabase.from('booking_flights').select('*').eq('booking_id', id).order('direction').order('leg_order'),
      supabase.from('booking_accommodations').select('*').eq('booking_id', id).order('stay_order'),
      supabase.from('booking_transfers').select('*').eq('booking_id', id),
      supabase.from('booking_extras').select('*').eq('booking_id', id),
      supabase.from('booking_payments').select('*').eq('booking_id', id).order('payment_date'),
      supabase.from('booking_tasks').select('*').eq('booking_id', id).order('sort_order'),
      supabase.from('hotel_list').select('id,name,room_types,meal_plans,reservation_email,reservation_phone,reservation_address,reservation_contact').order('name'),
      supabase.from('suppliers').select('id,name,type').order('name'),
    ])
    setBooking(bk)
    setPassengers(pax || [])
    setFlights(fl || [])
    setAccoms(ac || [])
    setTransfers(tr || [])
    setExtras(ex || [])
    setPayments(pay || [])
    if (tk && tk.length > 0) {
      setTasks(tk)
    } else if (bk) {
      // auto-init tasks for new bookings
      const inserts = TASK_TEMPLATE.map(t => ({ booking_id: Number(id), task_name: t.name, task_key: t.key, category: t.category, sort_order: t.sort, is_done: false }))
      const { data: newTasks } = await supabase.from('booking_tasks').insert(inserts).select()
      setTasks(newTasks || [])
    }
    setHotels(ht || [])
    setSuppliers(sup || [])
    setLoading(false)
  }

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
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
              <span style={{ fontSize:'12px', padding:'3px 10px', borderRadius:'20px', background:'#e6f4ee', color:'#10b981', fontWeight:'500' }}>{booking.status}</span>
            </div>
            <div style={{ fontSize:'13px', color:'var(--text-muted)', marginTop:'2px' }}>
              {client ? `${client.first_name} ${client.last_name}` : '—'} · {fmtDate(booking.departure_date)}{booking.return_date ? ` → ${fmtDate(booking.return_date)}` : ''}
              {booking.destination ? ` · ${booking.destination}` : ''}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <Link href={`/deals/${booking.deal_id}`}><button className="btn btn-secondary">← Deal</button></Link>
        </div>
      </div>

      {/* Balance due alert */}
      {balDays !== null && balDays <= 14 && balDays >= 0 && balance > 0 && (
        <div style={{ margin:'0 0 16px', background:'#fdeaea', border:'1px solid var(--red)', borderRadius:'10px', padding:'12px 18px', display:'flex', alignItems:'center', gap:'10px' }}>
          <span style={{ fontSize:'18px' }}>⚠️</span>
          <div style={{ flex:1, fontSize:'13.5px', color:'var(--red)', fontWeight:'500' }}>
            Balance of {fmt(balance)} due {balDays === 0 ? 'TODAY' : `in ${balDays} day${balDays===1?'':'s'}`} — {fmtDate(booking.balance_due_date)}
          </div>
        </div>
      )}

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
          <OverviewTab booking={booking} client={client} payments={payments}
            totalPaid={totalPaid} balance={balance} taskPct={taskPct}
            tasksDone={tasksDone} tasksTotal={tasks.length}
            depDays={depDays} accommodations={accommodations} outbound={outbound}
            onUpdate={loadAll} showToast={showToast} />
        )}

        {/* ── PASSENGERS TAB ───────────────────────────── */}
        {tab === 'passengers' && (
          <PassengersTab bookingId={booking.id} passengers={passengers} onUpdate={loadAll} showToast={showToast} />
        )}

        {/* ── FLIGHTS TAB ──────────────────────────────── */}
        {tab === 'flights' && (
          <FlightsTab bookingId={booking.id} outbound={outbound} returnFlts={returnFlts}
            suppliers={suppliers} onUpdate={loadAll} showToast={showToast} />
        )}

        {/* ── ACCOMMODATION TAB ────────────────────────── */}
        {tab === 'accommodation' && (
          <AccommodationTab bookingId={booking.id} accommodations={accommodations}
            hotels={hotels} suppliers={suppliers} passengers={passengers}
            onUpdate={loadAll} showToast={showToast} />
        )}

        {/* ── TRANSFERS TAB ────────────────────────────── */}
        {tab === 'transfers' && (
          <TransfersTab bookingId={booking.id} transfers={transfers} suppliers={suppliers}
            flights={flights} onUpdate={loadAll} showToast={showToast} />
        )}

        {/* ── EXTRAS TAB ───────────────────────────────── */}
        {tab === 'extras' && (
          <ExtrasTab bookingId={booking.id} extras={extras} onUpdate={loadAll} showToast={showToast} />
        )}

        {/* ── PAYMENTS TAB ─────────────────────────────── */}
        {tab === 'payments' && (
          <PaymentsTab booking={booking} payments={payments} balance={balance}
            onUpdate={loadAll} showToast={showToast} />
        )}

        {/* ── COSTING TAB ──────────────────────────────── */}
        {tab === 'costing' && (
          <CostingTab booking={booking} flights={[...outbound, ...returnFlts]}
            accommodations={accommodations} transfers={transfers}
            extras={extras} payments={payments} suppliers={suppliers}
            onUpdate={loadAll} showToast={showToast} />
        )}

        {/* ── TASKS TAB ────────────────────────────────── */}
        {tab === 'tasks' && (
          <TasksTab tasks={tasks} onUpdate={loadAll} showToast={showToast} />
        )}

        {/* ── DOCUMENTS TAB ────────────────────────────── */}
        {tab === 'documents' && (
          <DocumentsTab booking={booking} client={client} passengers={passengers}
            outbound={outbound} returnFlts={returnFlts} accommodations={accommodations}
            transfers={transfers} payments={payments} />
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}

// ── OVERVIEW TAB ─────────────────────────────────────────────
function OverviewTab({ booking, client, payments, totalPaid, balance, taskPct, tasksDone, tasksTotal, depDays, accommodations, outbound, onUpdate, showToast }: any) {
  const [editing, setEditing] = useState(false)
  const [form, setForm]       = useState({
    destination:    booking.destination || '',
    total_sell:     booking.total_sell || booking.deals?.deal_value || '',
    total_net:      booking.total_net || '',
    gross_profit:   booking.gross_profit || '',
    discount:       booking.discount || '0',
    return_date:    booking.return_date?.split('T')[0] || '',
    balance_due_date: booking.balance_due_date?.split('T')[0] || '',
    booking_notes:  booking.booking_notes || '',
  })
  const [saving, setSaving]         = useState(false)
  const [editingBalDue, setEditingBalDue] = useState(false)
  const [balDueDraft, setBalDueDraft]     = useState(booking.balance_due_date?.split('T')[0] || '')

  async function saveBalDue() {
    const { error } = await supabase.from('bookings').update({ balance_due_date: balDueDraft || null }).eq('id', booking.id)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Balance due date updated ✓')
    setEditingBalDue(false)
    onUpdate()
  }

  async function save() {
    setSaving(true)
    const { error } = await supabase.from('bookings').update({
      destination:      form.destination || null,
      total_sell:       form.total_sell ? Number(form.total_sell) : null,
      total_net:        form.total_net ? Number(form.total_net) : null,
      gross_profit:     form.gross_profit ? Number(form.gross_profit) : null,
      discount:         Number(form.discount) || 0,
      return_date:      form.return_date || null,
      balance_due_date: form.balance_due_date || null,
      booking_notes:    form.booking_notes || null,
    }).eq('id', booking.id)
    setSaving(false)
    if (error) { showToast('Save failed: ' + error.message, 'error'); return }
    showToast('Booking updated ✓')
    setEditing(false)
    onUpdate()
  }

  const sell     = booking.total_sell || booking.deals?.deal_value || 0
  const profit   = booking.gross_profit || 0
  const commission = profit > 0 ? (profit - 10) * 0.1 : 0
  const firstHotel = accommodations[0]
  const firstFlight = outbound[0]

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:'20px' }}>
      <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>

        {/* Financial summary */}
        <div className="card" style={{ padding:'20px 22px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Financials</div>
            <button className="btn btn-secondary btn-xs" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : '✏ Edit'}</button>
          </div>

          {editing ? (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
              <div><label className="label">Destination</label><input className="input" placeholder="e.g. Mauritius, Dubai" value={form.destination} onChange={e => setForm(p=>({...p,destination:e.target.value}))}/></div>
              <div><label className="label">Return Date</label><input className="input" type="date" value={form.return_date} onChange={e => setForm(p=>({...p,return_date:e.target.value}))}/></div>
              <div><label className="label">Balance Due Date</label><input className="input" type="date" value={form.balance_due_date} onChange={e => setForm(p=>({...p,balance_due_date:e.target.value}))}/></div>
              <div><label className="label">Total Sell (£)</label><input className="input" type="number" value={form.total_sell} onChange={e => setForm(p=>({...p,total_sell:e.target.value}))}/></div>
              <div><label className="label">Total Net (£)</label><input className="input" type="number" value={form.total_net} onChange={e => setForm(p=>({...p,total_net:e.target.value}))}/></div>
              <div><label className="label">Gross Profit (£)</label><input className="input" type="number" value={form.gross_profit} onChange={e => setForm(p=>({...p,gross_profit:e.target.value}))}/></div>
              <div><label className="label">Discount (£)</label><input className="input" type="number" value={form.discount} onChange={e => setForm(p=>({...p,discount:e.target.value}))}/></div>
              <div style={{ gridColumn:'1/-1' }}><label className="label">Booking Notes</label><textarea className="input" style={{ minHeight:'70px', resize:'vertical', fontSize:'13px' }} value={form.booking_notes} onChange={e => setForm(p=>({...p,booking_notes:e.target.value}))}/></div>
              <div style={{ gridColumn:'1/-1', display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                <button className="btn btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
                <button className="btn btn-cta" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px' }}>
              {[
                { label:'Invoice Total', val:fmt(sell),    color:'var(--accent-mid)' },
                { label:'Total Net',     val:fmt(booking.total_net), color:'var(--text-muted)' },
                { label:'Gross Profit',  val:fmt(profit),   color:'var(--green)' },
                { label:'Discount',      val:fmt(booking.discount), color:'var(--amber)' },
                { label:'Total Paid',    val:fmt(totalPaid), color:'var(--green)' },
                { label:'Balance Due',   val:fmt(balance),  color: balance > 0 ? 'var(--red)' : 'var(--green)' },
              ].map(s => (
                <div key={s.label} style={{ background:'var(--bg-secondary)', borderRadius:'8px', padding:'12px 14px' }}>
                  <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>{s.label}</div>
                  <div style={{ fontSize:'20px', fontWeight:'600', color:s.color, fontFamily:'Outfit,sans-serif' }}>{s.val}</div>
                </div>
              ))}
            </div>
          )}

          {!editing && profit > 0 && (
            <div style={{ marginTop:'12px', padding:'10px 14px', background:'var(--bg-tertiary)', borderRadius:'8px', display:'flex', gap:'20px' }}>
              <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>Commission formula: <span style={{ color:'var(--text-primary)', fontWeight:'500' }}>(£{profit.toLocaleString()} - £10) × 10% = <span style={{ color:'var(--green)', fontWeight:'600' }}>{fmt(commission)}</span></span></div>
            </div>
          )}
        </div>

        {/* Trip summary */}
        {(firstHotel || firstFlight) && (
          <div className="card" style={{ padding:'20px 22px' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'14px' }}>Trip Summary</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {firstFlight && (
                <div style={{ display:'flex', gap:'12px', alignItems:'center' }}>
                  <span style={{ fontSize:'18px' }}>✈</span>
                  <div>
                    <div style={{ fontSize:'13.5px', fontWeight:'500' }}>{firstFlight.origin} → {firstFlight.destination}</div>
                    <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{firstFlight.airline} {firstFlight.flight_number} · {fmtDate(firstFlight.departure_date)} · {firstFlight.cabin_class}</div>
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
            </div>
          </div>
        )}

        {/* Notes */}
        {booking.booking_notes && !editing && (
          <div className="card" style={{ padding:'16px 18px' }}>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.06em' }}>Booking Notes</div>
            <div style={{ fontSize:'13.5px', color:'var(--text-primary)', lineHeight:'1.6' }}>{booking.booking_notes}</div>
          </div>
        )}
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
              { label:'Booked',    val:fmtDate(booking.created_at),    color:'var(--text-muted)' },
              { label:'Departure', val:fmtDate(booking.departure_date), sub: depDays !== null && depDays >= 0 ? `${depDays}d away` : depDays !== null ? 'Departed' : '', color:'var(--accent)' },
              { label:'Return',    val:fmtDate(booking.return_date),   color:'var(--text-muted)' },
            ].map(d => (
              <div key={d.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>{d.label}</span>
                <div style={{ textAlign:'right' }}>
                  <span style={{ fontSize:'13px', color:d.color, fontWeight:'500' }}>{d.val}</span>
                  {d.sub && <div style={{ fontSize:'10.5px', color:'var(--text-muted)' }}>{d.sub}</div>}
                </div>
              </div>
            ))}
            {/* Balance Due — inline editable */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', paddingTop:'4px', borderTop:'1px solid var(--border)' }}>
              <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>Balance Due</span>
              {editingBalDue ? (
                <div style={{ display:'flex', gap:'5px', alignItems:'center' }}>
                  <input className="input" type="date" value={balDueDraft}
                    onChange={e => setBalDueDraft(e.target.value)}
                    style={{ fontSize:'12px', padding:'3px 6px', width:'130px' }} />
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

  async function addPassenger() {
    if (!form.first_name.trim() || !form.last_name.trim()) { showToast('Name required', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('booking_passengers').insert({
      booking_id: bookingId, title: form.title, first_name: form.first_name.trim(),
      last_name: form.last_name.trim(), date_of_birth: form.date_of_birth || null,
      passenger_type: form.passenger_type, is_lead: passengers.length === 0 ? true : form.is_lead,
      passport_number: form.passport_number || null, passport_expiry: form.passport_expiry || null,
    })
    setSaving(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Passenger added ✓')
    setAdding(false); setForm({ ...blank }); onUpdate()
  }

  async function saveEdit(id: number) {
    await supabase.from('booking_passengers').update({
      title: editForm.title, first_name: editForm.first_name, last_name: editForm.last_name,
      date_of_birth: editForm.date_of_birth || null, passenger_type: editForm.passenger_type,
      is_lead: editForm.is_lead, passport_number: editForm.passport_number || null,
      passport_expiry: editForm.passport_expiry || null,
    }).eq('id', id)
    showToast('Passenger updated ✓')
    setEditing(null); onUpdate()
  }

  async function deletePax(id: number) {
    await supabase.from('booking_passengers').delete().eq('id', id)
    showToast('Passenger removed')
    onUpdate()
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
              <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr', gap:'10px' }}>
                <div><label className="label">Title</label><select className="input" value={editForm.title} onChange={e=>setEditForm((f:any)=>({...f,title:e.target.value}))}>{TITLES.map(t=><option key={t}>{t}</option>)}</select></div>
                <div><label className="label">First Name</label><input className="input" value={editForm.first_name} onChange={e=>setEditForm((f:any)=>({...f,first_name:e.target.value}))}/></div>
                <div><label className="label">Last Name</label><input className="input" value={editForm.last_name} onChange={e=>setEditForm((f:any)=>({...f,last_name:e.target.value}))}/></div>
                <div><label className="label">DOB</label><input className="input" type="date" value={editForm.date_of_birth||''} onChange={e=>setEditForm((f:any)=>({...f,date_of_birth:e.target.value}))}/></div>
                <div><label className="label">Type</label><select className="input" value={editForm.passenger_type} onChange={e=>setEditForm((f:any)=>({...f,passenger_type:e.target.value}))}>{PAX_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
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
                    <span style={{ fontSize:'11px', color:'var(--text-muted)', background:'var(--bg-tertiary)', padding:'1px 7px', borderRadius:'10px' }}>{p.passenger_type}</span>
                  </div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)', display:'flex', gap:'16px' }}>
                    {p.date_of_birth && <span>DOB: {fmtDate(p.date_of_birth)}</span>}
                    {p.passport_number && <span>Passport: {p.passport_number}{p.passport_expiry ? ` (exp ${fmtDate(p.passport_expiry)})` : ''}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button className="btn btn-secondary btn-xs" onClick={()=>{ setEditing(p.id); setEditForm({...p, date_of_birth: p.date_of_birth?.split('T')[0]||'', passport_expiry: p.passport_expiry?.split('T')[0]||'' }) }}>Edit</button>
                  <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }} onClick={()=>deletePax(p.id)}>✕</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {adding && (
          <div className="card" style={{ padding:'18px 20px', border:'1.5px solid var(--accent)' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:'15px', fontWeight:'300', marginBottom:'14px' }}>New Passenger</div>
            <div style={{ display:'grid', gridTemplateColumns:'80px 1fr 1fr 130px', gap:'10px', marginBottom:'10px' }}>
              <div><label className="label">Title</label><select className="input" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}>{TITLES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label className="label">First Name *</label><input className="input" autoFocus value={form.first_name} onChange={e=>setForm(p=>({...p,first_name:e.target.value}))}/></div>
              <div><label className="label">Last Name *</label><input className="input" value={form.last_name} onChange={e=>setForm(p=>({...p,last_name:e.target.value}))}/></div>
              <div><label className="label">Type</label><select className="input" value={form.passenger_type} onChange={e=>setForm(p=>({...p,passenger_type:e.target.value}))}>{PAX_TYPES.map(t=><option key={t}>{t}</option>)}</select></div>
              <div><label className="label">Date of Birth</label><input className="input" type="date" value={form.date_of_birth} onChange={e=>setForm(p=>({...p,date_of_birth:e.target.value}))}/></div>
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

// ── FLIGHT FORM GRID (module-level — must NOT be inside FlightsTab or inputs lose focus) ──
function FlightGrid({ f, setF, idSuffix, flightSuppliers }: { f: any; setF: any; idSuffix: string; flightSuppliers: Supplier[] }) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'10px' }}>
      <div><label className="label">Flight Number *</label><input className="input" placeholder="e.g. BA2065" value={f.flight_number} onChange={e=>setF((p:any)=>({...p,flight_number:e.target.value}))}/></div>
      <div>
        <label className="label">Airline</label>
        <input className="input" list={`airlines-dl-${idSuffix}`} placeholder="e.g. British Airways" value={f.airline} onChange={e=>setF((p:any)=>({...p,airline:e.target.value}))}/>
        <datalist id={`airlines-dl-${idSuffix}`}>{AIRLINES.map(a=><option key={a} value={a}/>)}</datalist>
      </div>
      <div><label className="label">Cabin Class</label><select className="input" value={f.cabin_class} onChange={e=>setF((p:any)=>({...p,cabin_class:e.target.value}))}>{CABIN_CLASSES.map(c=><option key={c}>{c}</option>)}</select></div>
      <div>
        <label className="label">Origin</label>
        <input className="input" list={`airports-dl-${idSuffix}`} placeholder="e.g. LGW" value={f.origin} onChange={e=>setF((p:any)=>({...p,origin:e.target.value.toUpperCase()}))}/>
        <datalist id={`airports-dl-${idSuffix}`}>{AIRPORTS.map(a=><option key={a.code} value={a.code}>{a.name}</option>)}</datalist>
      </div>
      <div>
        <label className="label">Destination</label>
        <input className="input" list={`airports-dl-${idSuffix}`} placeholder="e.g. MRU" value={f.destination} onChange={e=>setF((p:any)=>({...p,destination:e.target.value.toUpperCase()}))}/>
      </div>
      <div><label className="label">Departure Date</label><input className="input" type="date" value={f.departure_date} onChange={e=>setF((p:any)=>({...p,departure_date:e.target.value}))}/></div>
      <div><label className="label">Depart Time</label><input className="input" placeholder="e.g. 21:00" value={f.departure_time} onChange={e=>setF((p:any)=>({...p,departure_time:e.target.value}))}/></div>
      <div><label className="label">Arrive Time</label><input className="input" placeholder="e.g. 11:55" value={f.arrival_time} onChange={e=>setF((p:any)=>({...p,arrival_time:e.target.value}))}/></div>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', paddingTop:'18px' }}>
        <input type="checkbox" id={`nxtday-${idSuffix}`} checked={f.next_day} onChange={e=>setF((p:any)=>({...p,next_day:e.target.checked}))}/>
        <label htmlFor={`nxtday-${idSuffix}`} style={{ fontSize:'13px', cursor:'pointer' }}>Arrives next day</label>
      </div>
      <div><label className="label">PNR / Booking Ref</label><input className="input" placeholder="e.g. Q5WR5B" value={f.pnr} onChange={e=>setF((p:any)=>({...p,pnr:e.target.value.toUpperCase()}))}/></div>
      <div>
        <label className="label">Flight Supplier</label>
        <select className="input" value={f.flight_supplier||''} onChange={e=>setF((p:any)=>({...p,flight_supplier:e.target.value}))}>
          <option value="">No supplier</option>
          {flightSuppliers.map((s:Supplier)=><option key={s.id} value={s.name}>{s.name}</option>)}
        </select>
      </div>
      <div><label className="label">Net Cost (£)</label><input className="input" type="number" placeholder="0.00" value={f.net_cost} onChange={e=>setF((p:any)=>({...p,net_cost:e.target.value}))}/></div>
      <div><label className="label">Baggage Notes</label><input className="input" placeholder="e.g. 2 x 23kg per person" value={f.baggage_notes} onChange={e=>setF((p:any)=>({...p,baggage_notes:e.target.value}))}/></div>
      <div style={{ gridColumn:'1/-1' }}><label className="label">Cabin Class Notes</label><input className="input" placeholder="e.g. Mr Smith travelling Business Class" value={f.cabin_notes} onChange={e=>setF((p:any)=>({...p,cabin_notes:e.target.value}))}/></div>
    </div>
  )
}

// ── FLIGHTS TAB ──────────────────────────────────────────────
function FlightsTab({ bookingId, outbound, returnFlts, suppliers, onUpdate, showToast }: any) {
  const blank = { flight_number:'', airline:'', origin:'', destination:'', departure_date:'', departure_time:'', arrival_date:'', arrival_time:'', next_day:false, cabin_class:'Economy', pnr:'', flight_supplier:'', net_cost:'', baggage_notes:'', cabin_notes:'' }
  const [adding, setAdding]     = useState<'outbound'|'return'|null>(null)
  const [form, setForm]         = useState<any>({ ...blank })
  const [editing, setEditing]   = useState<number|null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving]     = useState(false)

  const flightSuppliers = (suppliers || []).filter((s: Supplier) => s.type === 'flight')

  async function addFlight() {
    if (!form.flight_number.trim()) { showToast('Flight number required', 'error'); return }
    setSaving(true)
    const legs = adding === 'outbound' ? outbound : returnFlts
    const { error } = await supabase.from('booking_flights').insert({
      booking_id: bookingId, direction: adding, leg_order: legs.length + 1,
      flight_number: form.flight_number, airline: form.airline || null,
      origin: form.origin || null, destination: form.destination || null,
      departure_date: form.departure_date || null, departure_time: form.departure_time || null,
      arrival_date: form.arrival_date || null, arrival_time: form.arrival_time || null,
      next_day: form.next_day, cabin_class: form.cabin_class,
      pnr: form.pnr || null, flight_supplier: form.flight_supplier || null,
      baggage_notes: form.baggage_notes || null, cabin_notes: form.cabin_notes || null,
    })
    setSaving(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Flight added ✓'); setAdding(null); onUpdate()
  }

  async function saveEdit(id: number) {
    setSaving(true)
    const { error } = await supabase.from('booking_flights').update({
      flight_number: editForm.flight_number, airline: editForm.airline || null,
      origin: editForm.origin || null, destination: editForm.destination || null,
      departure_date: editForm.departure_date || null, departure_time: editForm.departure_time || null,
      arrival_date: editForm.arrival_date || null, arrival_time: editForm.arrival_time || null,
      next_day: editForm.next_day, cabin_class: editForm.cabin_class,
      pnr: editForm.pnr || null, flight_supplier: editForm.flight_supplier || null,
      net_cost: editForm.net_cost ? Number(editForm.net_cost) : null,
      baggage_notes: editForm.baggage_notes || null, cabin_notes: editForm.cabin_notes || null,
    }).eq('id', id)
    setSaving(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Flight updated ✓'); setEditing(null); onUpdate()
  }

  async function deleteFlight(id: number) {
    await supabase.from('booking_flights').delete().eq('id', id)
    showToast('Flight removed'); onUpdate()
  }

  function renderGroup(legs: Flight[], direction: 'outbound'|'return') {
    return (
      <div className="card" style={{ padding:'18px 20px', marginBottom:'14px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
          <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300' }}>{direction === 'outbound' ? '✈ Outbound' : '✈ Return'}</div>
          <button className="btn btn-secondary btn-xs" onClick={() => { setEditing(null); setAdding(direction); setForm({ ...blank }) }}>+ Add Leg</button>
        </div>
        {legs.length === 0 ? (
          <div style={{ color:'var(--text-muted)', fontSize:'13px', fontStyle:'italic' }}>No {direction} flights yet</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {legs.map((f: Flight, i: number) => (
              <div key={f.id} style={{ padding:'12px 14px', background:'var(--bg-secondary)', borderRadius:'8px', border: editing===f.id ? '1.5px solid var(--accent)' : 'none' }}>
                {editing === f.id ? (
                  <>
                    <FlightGrid f={editForm} setF={setEditForm} idSuffix={`edit-${f.id}`} flightSuppliers={flightSuppliers} />
                    <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'12px' }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => setEditing(null)}>Cancel</button>
                      <button className="btn btn-cta btn-xs" onClick={() => saveEdit(f.id)} disabled={saving}>{saving?'Saving…':'Save Changes'}</button>
                    </div>
                  </>
                ) : (
                  <div style={{ display:'flex', gap:'12px', alignItems:'flex-start' }}>
                    <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:'11px', color:'white', fontWeight:'700' }}>{i+1}</div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px', flexWrap:'wrap' }}>
                        <span style={{ fontSize:'15px', fontWeight:'600', fontFamily:'monospace' }}>{f.flight_number}</span>
                        <span style={{ fontSize:'13px', color:'var(--text-muted)' }}>{f.airline}</span>
                        <span style={{ fontSize:'11.5px', background:'var(--bg-tertiary)', padding:'2px 8px', borderRadius:'4px', color:'var(--accent)' }}>{f.cabin_class}</span>
                        {f.next_day && <span style={{ fontSize:'11px', color:'var(--amber)', background:'#fef3c7', padding:'1px 6px', borderRadius:'4px' }}>Next Day</span>}
                      </div>
                      <div style={{ fontSize:'13px', color:'var(--text-primary)', marginBottom:'3px' }}>
                        <strong>{f.origin}</strong> {f.departure_time} → <strong>{f.destination}</strong> {f.arrival_time}
                      </div>
                      <div style={{ fontSize:'12px', color:'var(--text-muted)', display:'flex', gap:'12px', flexWrap:'wrap' }}>
                        <span>{fmtDate(f.departure_date)}</span>
                        {f.pnr && <span>PNR: <strong>{f.pnr}</strong></span>}
                        {f.flight_supplier && <span>via {f.flight_supplier}</span>}
                        {f.net_cost != null && f.net_cost > 0 && <span style={{ color:'var(--accent)', fontWeight:'500' }}>Net: {fmt(f.net_cost)}</span>}
                        {f.baggage_notes && <span>🧳 {f.baggage_notes}</span>}
                      </div>
                      {f.cabin_notes && <div style={{ fontSize:'12px', color:'var(--amber)', marginTop:'3px' }}>ℹ {f.cabin_notes}</div>}
                    </div>
                    <div style={{ display:'flex', gap:'6px' }}>
                      <button className="btn btn-secondary btn-xs" onClick={() => { setAdding(null); setEditing(f.id); setEditForm({ ...f, departure_date: f.departure_date?.split('T')[0]||'', arrival_date: f.arrival_date?.split('T')[0]||'', net_cost: f.net_cost ?? '' }) }}>Edit</button>
                      <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }} onClick={() => deleteFlight(f.id)}>✕</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      {renderGroup(outbound, 'outbound')}
      {renderGroup(returnFlts, 'return')}
      {adding && (
        <div className="card" style={{ padding:'20px 22px', border:'1.5px solid var(--accent)' }}>
          <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', marginBottom:'14px' }}>
            Add {adding === 'outbound' ? 'Outbound' : 'Return'} Leg {(adding === 'outbound' ? outbound : returnFlts).length + 1}
          </div>
          <FlightGrid f={form} setF={setForm} idSuffix="add" flightSuppliers={flightSuppliers} />
          <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end', marginTop:'12px' }}>
            <button className="btn btn-secondary" onClick={() => setAdding(null)}>Cancel</button>
            <button className="btn btn-cta" onClick={addFlight} disabled={saving}>{saving?'Adding…':'Add Flight Leg'}</button>
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
    const { error } = await supabase.from('booking_accommodations').insert({
      booking_id: bookingId, stay_order: accommodations.length + 1,
      hotel_id: form.hotel_id ? Number(form.hotel_id) : null,
      hotel_name: form.hotel_name.trim(),
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      hotel_confirmation: form.hotel_confirmation || null,
      checkin_date: form.checkin_date || null, checkout_date: form.checkout_date || null,
      nights: nights || null, room_type: form.room_type || null,
      room_quantity: Number(form.room_quantity) || 1, board_basis: form.board_basis || null,
      adults: Number(form.adults) || 2, children: Number(form.children) || 0, infants: Number(form.infants) || 0,
      net_cost: form.net_cost ? Number(form.net_cost) : null,
      special_occasion: form.special_occasion || null, special_requests: form.special_requests || null,
      reservation_status: form.reservation_status,
      reservation_email_to: form.reservation_email_to || null,
    })
    setSaving(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Stay added ✓')
    setAdding(false); onUpdate()
  }

  async function saveAccomEdit(id: number) {
    setSaving(true)
    const nights = editForm.nights ? Number(editForm.nights) : calcNights(editForm.checkin_date, editForm.checkout_date)
    const { error } = await supabase.from('booking_accommodations').update({
      hotel_id: editForm.hotel_id ? Number(editForm.hotel_id) : null,
      hotel_name: editForm.hotel_name?.trim() || null,
      supplier_id: editForm.supplier_id ? Number(editForm.supplier_id) : null,
      hotel_confirmation: editForm.hotel_confirmation || null,
      checkin_date: editForm.checkin_date || null, checkout_date: editForm.checkout_date || null,
      nights: nights || null, room_type: editForm.room_type || null,
      room_quantity: Number(editForm.room_quantity) || 1, board_basis: editForm.board_basis || null,
      adults: Number(editForm.adults) || 2, children: Number(editForm.children) || 0, infants: Number(editForm.infants) || 0,
      net_cost: editForm.net_cost ? Number(editForm.net_cost) : null,
      special_occasion: editForm.special_occasion || null, special_requests: editForm.special_requests || null,
      reservation_email_to: editForm.reservation_email_to || null,
    }).eq('id', id)
    setSaving(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Stay updated ✓'); setEditing(null); onUpdate()
  }

  async function updateResStatus(id: number, status: string) {
    await supabase.from('booking_accommodations').update({ reservation_status: status, ...(status === 'sent' ? { reservation_sent_at: new Date().toISOString() } : {}) }).eq('id', id)
    showToast('Status updated')
    onUpdate()
  }

  async function deleteAccom(id: number) {
    await supabase.from('booking_accommodations').delete().eq('id', id)
    showToast('Stay removed'); onUpdate()
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
                    <div><label className="label">Check In</label><input className="input" type="date" value={editForm.checkin_date||''} onChange={e=>setEditForm((p:any)=>({...p,checkin_date:e.target.value}))}/></div>
                    <div><label className="label">Check Out</label><input className="input" type="date" value={editForm.checkout_date||''} onChange={e=>setEditForm((p:any)=>({...p,checkout_date:e.target.value}))}/></div>
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
              <div><label className="label">Check In</label><input className="input" type="date" value={form.checkin_date} onChange={e=>setForm((p:any)=>({...p,checkin_date:e.target.value}))}/></div>
              <div><label className="label">Check Out</label><input className="input" type="date" value={form.checkout_date} onChange={e=>setForm((p:any)=>({...p,checkout_date:e.target.value}))}/></div>
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
  const blankTransfer = { supplier_id:'', supplier_name:'', transfer_type:'private', meet_greet:true, local_rep:true, arrival_date:'', arrival_time:'', arrival_flight:'', departure_date:'', departure_time:'', departure_flight:'', inter_hotel_dates:'', net_cost:'', notes:'' }
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState<any>({ ...blankTransfer })
  const [editing, setEditing]   = useState<number|null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving]     = useState(false)

  const arrFlight = flights.find((f: Flight) => f.direction === 'outbound' && f.destination?.includes('MRU'))
  const depFlight = flights.find((f: Flight) => f.direction === 'return' && f.origin?.includes('MRU'))

  async function addTransfer() {
    setSaving(true)
    const { error } = await supabase.from('booking_transfers').insert({
      booking_id: bookingId,
      supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
      supplier_name: form.supplier_name || null,
      transfer_type: form.transfer_type,
      meet_greet: form.meet_greet, local_rep: form.local_rep,
      arrival_date: form.arrival_date || null, arrival_time: form.arrival_time || null,
      arrival_flight: form.arrival_flight || null,
      departure_date: form.departure_date || null, departure_time: form.departure_time || null,
      departure_flight: form.departure_flight || null,
      inter_hotel_dates: form.inter_hotel_dates || null,
      net_cost: form.net_cost ? Number(form.net_cost) : null,
      notes: form.notes || null,
    })
    setSaving(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Transfer added ✓')
    setAdding(false); onUpdate()
  }

  async function saveTransferEdit(id: number) {
    setSaving(true)
    const { error } = await supabase.from('booking_transfers').update({
      supplier_id: editForm.supplier_id ? Number(editForm.supplier_id) : null,
      supplier_name: editForm.supplier_name || null,
      transfer_type: editForm.transfer_type,
      meet_greet: editForm.meet_greet, local_rep: editForm.local_rep,
      arrival_date: editForm.arrival_date || null, arrival_time: editForm.arrival_time || null,
      arrival_flight: editForm.arrival_flight || null,
      departure_date: editForm.departure_date || null, departure_time: editForm.departure_time || null,
      departure_flight: editForm.departure_flight || null,
      inter_hotel_dates: editForm.inter_hotel_dates || null,
      net_cost: editForm.net_cost ? Number(editForm.net_cost) : null,
      notes: editForm.notes || null,
    }).eq('id', id)
    setSaving(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Transfer updated ✓'); setEditing(null); onUpdate()
  }

  async function deleteTransfer(id: number) {
    await supabase.from('booking_transfers').delete().eq('id', id)
    showToast('Transfer removed'); onUpdate()
  }

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Transfers</div>
        <button className="btn btn-cta" onClick={() => {
          setAdding(true)
          setForm({
            ...blankTransfer,
            arrival_flight: arrFlight ? arrFlight.flight_number : '',
            arrival_date:   arrFlight ? arrFlight.arrival_date : '',
            arrival_time:   arrFlight ? arrFlight.arrival_time : '',
            departure_flight: depFlight ? depFlight.flight_number : '',
            departure_date:   depFlight ? depFlight.departure_date : '',
            departure_time:   depFlight ? depFlight.departure_time : '',
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
                <div><label className="label">Arrival Date & Time</label><div style={{ display:'flex', gap:'8px' }}><input className="input" type="date" value={editForm.arrival_date||''} onChange={e=>setEditForm((p:any)=>({...p,arrival_date:e.target.value}))}/><input className="input" style={{ width:'100px' }} value={editForm.arrival_time||''} onChange={e=>setEditForm((p:any)=>({...p,arrival_time:e.target.value}))}/></div></div>
                <div><label className="label">Departure Flight</label><input className="input" value={editForm.departure_flight||''} onChange={e=>setEditForm((p:any)=>({...p,departure_flight:e.target.value.toUpperCase()}))}/></div>
                <div><label className="label">Departure Date & Time</label><div style={{ display:'flex', gap:'8px' }}><input className="input" type="date" value={editForm.departure_date||''} onChange={e=>setEditForm((p:any)=>({...p,departure_date:e.target.value}))}/><input className="input" style={{ width:'100px' }} value={editForm.departure_time||''} onChange={e=>setEditForm((p:any)=>({...p,departure_time:e.target.value}))}/></div></div>
                <div style={{ gridColumn:'1/-1' }}><label className="label">Inter-Hotel Transfer Dates</label><input className="input" value={editForm.inter_hotel_dates||''} onChange={e=>setEditForm((p:any)=>({...p,inter_hotel_dates:e.target.value}))}/></div>
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
            <div><label className="label">Arrival Date & Time</label><div style={{ display:'flex', gap:'8px' }}><input className="input" type="date" value={form.arrival_date} onChange={e=>setForm((p:any)=>({...p,arrival_date:e.target.value}))}/><input className="input" style={{ width:'100px' }} placeholder="09:25" value={form.arrival_time} onChange={e=>setForm((p:any)=>({...p,arrival_time:e.target.value}))}/></div></div>
            <div><label className="label">Departure Flight</label><input className="input" placeholder="e.g. BA2064" value={form.departure_flight} onChange={e=>setForm((p:any)=>({...p,departure_flight:e.target.value.toUpperCase()}))}/></div>
            <div><label className="label">Departure Date & Time</label><div style={{ display:'flex', gap:'8px' }}><input className="input" type="date" value={form.departure_date} onChange={e=>setForm((p:any)=>({...p,departure_date:e.target.value}))}/><input className="input" style={{ width:'100px' }} placeholder="20:45" value={form.departure_time} onChange={e=>setForm((p:any)=>({...p,departure_time:e.target.value}))}/></div></div>
            <div style={{ gridColumn:'1/-1' }}><label className="label">Inter-Hotel Transfer Dates</label><input className="input" placeholder="e.g. 17-05-2026" value={form.inter_hotel_dates} onChange={e=>setForm((p:any)=>({...p,inter_hotel_dates:e.target.value}))}/></div>
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
  const blank = { extra_type:'lounge', description:'', supplier:'', net_cost:'', sell_price:'', notes:'' }
  const EXTRA_TYPES = ['lounge', 'parking', 'fast_track', 'seat_upgrade', 'excursion', 'travel_insurance', 'other']
  const [adding, setAdding]     = useState(false)
  const [form, setForm]         = useState<any>({ ...blank })
  const [editing, setEditing]   = useState<number|null>(null)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving]     = useState(false)

  async function addExtra() {
    setSaving(true)
    const { error } = await supabase.from('booking_extras').insert({
      booking_id: bookingId, extra_type: form.extra_type,
      description: form.description || null, supplier: form.supplier || null,
      net_cost: form.net_cost ? Number(form.net_cost) : null,
      sell_price: form.sell_price ? Number(form.sell_price) : null,
      notes: form.notes || null,
    })
    setSaving(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Extra added ✓')
    setAdding(false); onUpdate()
  }

  async function saveExtraEdit(id: number) {
    setSaving(true)
    const { error } = await supabase.from('booking_extras').update({
      extra_type: editForm.extra_type, description: editForm.description || null,
      supplier: editForm.supplier || null,
      net_cost: editForm.net_cost ? Number(editForm.net_cost) : null,
      sell_price: editForm.sell_price ? Number(editForm.sell_price) : null,
      notes: editForm.notes || null,
    }).eq('id', id)
    setSaving(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Extra updated ✓'); setEditing(null); onUpdate()
  }

  async function deleteExtra(id: number) {
    await supabase.from('booking_extras').delete().eq('id', id)
    showToast('Extra removed'); onUpdate()
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
                  <div><label className="label">Sell Price (£)</label><input className="input" type="number" value={editForm.sell_price||''} onChange={ev=>setEditForm((p:any)=>({...p,sell_price:ev.target.value}))}/></div>
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
                    {e.net_cost && <span>Net: {fmt(e.net_cost)} · </span>}
                    {e.sell_price && <span>Sell: {fmt(e.sell_price)}</span>}
                  </div>
                  {e.notes && <div style={{ fontSize:'12px', color:'var(--text-muted)', fontStyle:'italic', marginTop:'2px' }}>{e.notes}</div>}
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  <button className="btn btn-secondary btn-xs" onClick={() => { setEditing(e.id); setEditForm({ ...e, net_cost: e.net_cost ?? '', sell_price: e.sell_price ?? '' }) }}>Edit</button>
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
              <div><label className="label">Sell Price (£)</label><input className="input" type="number" value={form.sell_price} onChange={e=>setForm((p:any)=>({...p,sell_price:e.target.value}))}/></div>
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
function PaymentsTab({ booking, payments, balance, onUpdate, showToast }: any) {
  const blank = { amount:'', payment_date: new Date().toISOString().split('T')[0], debit_card:'', credit_card:'', amex:'', bank_transfer:'', notes:'' }
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState<any>({ ...blank })
  const [saving, setSaving] = useState(false)
  const totalPaid           = payments.reduce((a: number, p: Payment) => a + (p.amount || 0), 0)
  const sell                = booking.total_sell || booking.deals?.deal_value || 0

  async function addPayment() {
    const total = (Number(form.debit_card)||0) + (Number(form.credit_card)||0) + (Number(form.amex)||0) + (Number(form.bank_transfer)||0)
    const amount = total || Number(form.amount)
    if (!amount) { showToast('Enter payment amount', 'error'); return }
    setSaving(true)
    const { error } = await supabase.from('booking_payments').insert({
      booking_id: booking.id, amount,
      payment_date: form.payment_date,
      debit_card: Number(form.debit_card) || 0,
      credit_card: Number(form.credit_card) || 0,
      amex: Number(form.amex) || 0,
      bank_transfer: Number(form.bank_transfer) || 0,
      notes: form.notes || null,
    })
    setSaving(false)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Payment recorded ✓')
    setAdding(false); setForm({ ...blank }); onUpdate()
  }

  async function markInvoiceSent(id: number) {
    await supabase.from('booking_payments').update({ invoice_sent: true, invoice_sent_at: new Date().toISOString() }).eq('id', id)
    showToast('Invoice marked as sent')
    onUpdate()
  }

  async function deletePayment(id: number) {
    await supabase.from('booking_payments').delete().eq('id', id)
    showToast('Payment removed'); onUpdate()
  }

  const pctPaid = sell > 0 ? Math.min(100, Math.round((totalPaid / sell) * 100)) : 0

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
        <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Payments</div>
        <button className="btn btn-cta" onClick={() => setAdding(true)}>+ Add Payment</button>
      </div>

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
                  <button className="btn btn-ghost btn-xs" style={{ color:'var(--red)' }} onClick={() => deletePayment(p.id)}>✕</button>
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
            <div><label className="label">Payment Date</label><input className="input" type="date" value={form.payment_date} onChange={e=>setForm((p:any)=>({...p,payment_date:e.target.value}))}/></div>
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
          <button className="btn btn-cta" onClick={() => setAdding(true)}>+ Record First Payment</button>
        </div>
      )}
    </div>
  )
}

// ── COSTING TAB ──────────────────────────────────────────────
function CostingTab({ booking, flights, accommodations, transfers, extras, payments, suppliers, onUpdate, showToast }: any) {
  const [editingBalDue, setEditingBalDue] = useState(false)
  const [balDueDraft, setBalDueDraft]     = useState(booking.balance_due_date?.split('T')[0] || '')

  const sell      = booking.total_sell || booking.deals?.deal_value || 0
  const discount  = booking.discount || 0
  const clientNet = sell - discount

  // Build cost lines from existing component data
  const costLines: { label: string; supplier: string; netCost: number }[] = []
  for (const f of (flights || [])) {
    if (f.net_cost) costLines.push({
      label:    `${f.airline || ''} ${f.flight_number || ''} (${f.origin}→${f.destination})`.trim(),
      supplier: f.flight_supplier || '—',
      netCost:  f.net_cost,
    })
  }
  for (const a of accommodations) {
    if (a.net_cost) costLines.push({
      label:    a.hotel_name || 'Accommodation',
      supplier: suppliers.find((s: Supplier) => s.id === a.supplier_id)?.name || '—',
      netCost:  a.net_cost,
    })
  }
  for (const t of transfers) {
    if (t.net_cost) costLines.push({
      label:    `Transfer${t.transfer_type ? ` (${TRANSFER_TYPES.find((x: any) => x.value === t.transfer_type)?.label || t.transfer_type})` : ''}`,
      supplier: suppliers.find((s: Supplier) => s.id === t.supplier_id)?.name || t.supplier_name || '—',
      netCost:  t.net_cost,
    })
  }
  for (const e of extras) {
    if (e.net_cost) costLines.push({
      label:    e.description || e.extra_type || 'Extra',
      supplier: e.supplier || '—',
      netCost:  e.net_cost,
    })
  }

  const totalNetCost = costLines.reduce((a, l) => a + l.netCost, 0)
  const excess       = sell - totalNetCost
  const grossComm    = clientNet - totalNetCost

  // Receipt rows with running totals and type labels
  const totalPaid = payments.reduce((a: number, p: Payment) => a + (p.amount || 0), 0)
  let running = 0
  const receiptRows = payments.map((p: Payment, i: number) => {
    running += p.amount
    const owing = sell - running
    const type  = i === 0 ? 'Deposit' : (i === payments.length - 1 && owing <= 0) ? 'Balance' : 'Intrim'
    return { ...p, amountOwing: Math.max(0, owing), type, runningTotal: running }
  })
  const balanceDue = sell - totalPaid

  async function saveBalDue() {
    const { error } = await supabase.from('bookings').update({ balance_due_date: balDueDraft || null }).eq('id', booking.id)
    if (error) { showToast('Failed: ' + error.message, 'error'); return }
    showToast('Balance due date updated ✓')
    setEditingBalDue(false)
    onUpdate()
  }

  const TH = ({ children, right }: { children: string; right?: boolean }) => (
    <th style={{ padding:'8px 10px', textAlign: right ? 'right' : 'left', fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', fontWeight:'600', whiteSpace:'nowrap' }}>{children}</th>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

      {/* ── Cost Breakdown ── */}
      <div className="card" style={{ padding:'20px 22px' }}>
        <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'16px' }}>Cost Details</div>

        {costLines.length === 0 ? (
          <div style={{ fontSize:'13px', color:'var(--text-muted)', fontStyle:'italic' }}>
            No net costs entered yet. Add costs in the Accommodation, Transfers, or Extras tabs.
          </div>
        ) : (
          <>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid var(--border)' }}>
                    <TH>Component</TH>
                    <TH>Supplier</TH>
                    <TH right>Supplier Gross</TH>
                    <TH right>Gross Margin</TH>
                    <TH right>Margin %</TH>
                  </tr>
                </thead>
                <tbody>
                  {costLines.map((line, i) => {
                    const proportional = totalNetCost > 0 ? (line.netCost / totalNetCost) * clientNet : 0
                    const margin       = proportional - line.netCost
                    const marginPct    = proportional > 0 ? (margin / proportional) * 100 : 0
                    return (
                      <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}>
                        <td style={{ padding:'10px 10px', fontWeight:'500', color:'var(--text-primary)' }}>{line.label}</td>
                        <td style={{ padding:'10px 10px', color:'var(--text-muted)' }}>{line.supplier}</td>
                        <td style={{ padding:'10px 10px', textAlign:'right', fontFamily:'monospace' }}>{fmt(line.netCost)}</td>
                        <td style={{ padding:'10px 10px', textAlign:'right', fontFamily:'monospace', color: margin >= 0 ? 'var(--green)' : 'var(--red)' }}>{fmt(margin)}</td>
                        <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--text-muted)' }}>{marginPct.toFixed(1)}%</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary split */}
            <div style={{ borderTop:'2px solid var(--border)', marginTop:'4px', paddingTop:'16px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'24px' }}>
              <div style={{ display:'flex', flexDirection:'column', gap:'9px' }}>
                {[
                  { label:'Total Net Cost',      val: fmt(totalNetCost), bold: true  },
                  { label:'Excess',              val: fmt(excess),       color:'var(--text-muted)' },
                  { label:'Discount',            val: discount > 0 ? `− ${fmt(discount)}` : '—', color:'var(--amber)' },
                ].map(r => (
                  <div key={r.label} style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>{r.label}</span>
                    <span style={{ fontSize:'13px', fontFamily:'monospace', color: r.color || 'var(--text-primary)', fontWeight: r.bold ? '700' : '500' }}>{r.val}</span>
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:'9px' }}>
                {[
                  { label:'Client Total',    val: fmt(sell),       color:'var(--accent-mid)', bold: true },
                  { label:'Client Net',      val: fmt(clientNet),  color:'var(--text-primary)', bold: true },
                  { label:'Gross Comm',      val: fmt(grossComm),  color: grossComm >= 0 ? 'var(--green)' : 'var(--red)', bold: true },
                  { label:'Net Comm',        val: fmt(grossComm),  color: grossComm >= 0 ? 'var(--green)' : 'var(--red)', bold: true },
                ].map(r => (
                  <div key={r.label} style={{ display:'flex', justifyContent:'space-between' }}>
                    <span style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>{r.label}</span>
                    <span style={{ fontSize:'13px', fontFamily:'monospace', color: r.color, fontWeight:'700' }}>{r.val}</span>
                  </div>
                ))}
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
                <input className="input" type="date" value={balDueDraft}
                  onChange={e => setBalDueDraft(e.target.value)}
                  style={{ fontSize:'13px', padding:'5px 8px', width:'150px' }} />
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
function DocumentsTab({ booking, client, passengers, outbound, returnFlts, accommodations, transfers, payments }: any) {
  const [activeDoc, setActiveDoc] = useState<string | null>(null)
  const [preview, setPreview]     = useState<string | null>(null)

  const ref        = booking.booking_reference
  const clientName = client ? `${client.first_name} ${client.last_name}` : 'Guest'
  const paxList    = passengers.map((p: Passenger) => `${p.title} ${p.first_name} ${p.last_name}`).join(', ')
  const totalPaid  = payments.reduce((a: number, p: Payment) => a + (p.amount || 0), 0)
  const sell       = booking.total_sell || booking.deals?.deal_value || 0
  const balance    = sell - totalPaid
  const today      = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })

  const DOCS = [
    { id: 'confirmation', label: 'Booking Confirmation',  icon: '📋', desc: 'Cover letter with full trip summary & payment schedule' },
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

  function generateDoc(docId: string): string {
    if (docId === 'confirmation') {
      const flightRows = [...outbound, ...returnFlts].map((f: Flight) =>
        `<tr><td style="width:auto"><strong>${f.flight_number}</strong></td><td>${f.airline || '—'}</td><td>${f.origin} → ${f.destination}</td><td>${fmtDate(f.departure_date)}${f.departure_time ? ' ' + f.departure_time : ''}</td><td>${f.cabin_class}</td></tr>`
      ).join('')
      const accomRows = accommodations.map((a: Accommodation) =>
        `<tr><td style="width:auto"><strong>${a.hotel_name}</strong></td><td>${fmtDate(a.checkin_date)} – ${fmtDate(a.checkout_date)}</td><td>${a.nights || calcNights(a.checkin_date, a.checkout_date)} nts</td><td>${a.room_type || '—'} ×${a.room_quantity}</td><td>${a.board_basis || '—'}</td></tr>`
      ).join('')
      return `<!DOCTYPE html><html><head><title>Booking Confirmation — ${ref}</title>${docStyles}</head><body>
        ${brandHeader('Booking Confirmation', `Dear ${clientName},`)}
        <p style="line-height:1.8;margin-bottom:18px;">Thank you for booking with Mauritius Holidays Direct. We are delighted to confirm your holiday arrangements as detailed below. Please review this confirmation carefully and contact us immediately if any details require amendment.</p>
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
        <p style="font-size:12px;color:#64748b;line-height:1.7;margin-bottom:14px;">This booking is protected by our ATOL licence (No. 11423). Your ATOL Certificate will be issued separately. Please ensure all passenger names match exactly as they appear on passports.</p>
        <div class="sign">Kind regards,<br><strong>Samir Abattouy</strong><br>Mauritius Expert<br><em>Mauritius</em> Holidays Direct</div>
        <div class="footer">Mauritius Holidays Direct · MHD Travel Ltd · ATOL Protected 11423 · ${today}</div>
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
      const firstFlight = outbound[0]
      return `<!DOCTYPE html><html><head><title>ATOL Certificate — ${ref}</title>${docStyles}</head><body>
        <div style="border:2px solid #1a1a2e;padding:36px;border-radius:8px;">
          ${brandHeader('ATOL Certificate', 'Air Travel Organiser\'s Licence — No. 11423')}
          <div style="background:#fef9c3;border:1px solid #fbbf24;border-radius:6px;padding:14px 16px;margin-bottom:20px;">
            <div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:4px">ATOL Protected</div>
            <p style="font-size:12px;color:#92400e;line-height:1.7">In the unlikely event of our insolvency, the Civil Aviation Authority (the UK's aviation regulator) will ensure that you are not stranded abroad and will arrange to refund any money you have paid to us for an advance booking. For further information visit the ATOL website at www.caa.co.uk/atol-protection</p>
          </div>
          <table><tbody>
            <tr><td>Lead Passenger</td><td><strong>${clientName}</strong></td></tr>
            <tr><td>All Passengers</td><td>${paxList}</td></tr>
            <tr><td>Booking Reference</td><td><strong style="color:#3b82f6;font-family:monospace;font-size:16px">${ref}</strong></td></tr>
            <tr><td>Departure Date</td><td><strong>${fmtDate(booking.departure_date)}</strong></td></tr>
            <tr><td>Return Date</td><td><strong>${fmtDate(booking.return_date)}</strong></td></tr>
            ${firstFlight ? `<tr><td>Flight Details</td><td>${firstFlight.airline || ''} ${firstFlight.flight_number} · ${firstFlight.origin} → ${firstFlight.destination}</td></tr>` : ''}
            ${accommodations.length > 0 ? `<tr><td>Accommodation</td><td>${accommodations.map((a: Accommodation) => `${a.hotel_name} (${fmtDate(a.checkin_date)} – ${fmtDate(a.checkout_date)})`).join('<br>')}</td></tr>` : ''}
            <tr><td>Total Cost</td><td><strong style="font-size:18px">£${sell.toLocaleString('en-GB', { minimumFractionDigits: 2 })}</strong></td></tr>
            <tr><td>Date Issued</td><td>${today}</td></tr>
            <tr><td>ATOL Holder</td><td>MHD Travel Ltd, ATOL No. 11423</td></tr>
          </tbody></table>
          <p style="font-size:11px;color:#94a3b8;margin-top:16px;line-height:1.7">MHD Travel Ltd is a company registered in England and Wales. This certificate is issued under the Air Travel Organiser's Licensing Scheme (ATOL) managed by the Civil Aviation Authority.</p>
        </div>
        <div class="footer">${today}</div>
      </body></html>`
    }

    return '<html><body>Document not found</body></html>'
  }

  function openDoc(docId: string) {
    setActiveDoc(docId)
    setPreview(generateDoc(docId))
  }

  function printDoc() {
    if (!activeDoc) return
    const html = generateDoc(activeDoc)
    const win = window.open('', '_blank', 'width=900,height=750')
    if (!win) return
    win.document.write(html)
    win.document.close()
    win.focus()
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
              <button className="btn btn-cta" onClick={printDoc}>🖨 Print / Save as PDF</button>
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
function TasksTab({ tasks, onUpdate, showToast }: any) {
  const categories = Array.from(new Set(TASK_TEMPLATE.map(t => t.category)))
  const tasksDone  = tasks.filter((t: BookingTask) => t.is_done).length
  const taskPct    = tasks.length ? Math.round((tasksDone / tasks.length) * 100) : 0

  async function toggle(task: BookingTask) {
    const newDone = !task.is_done
    await supabase.from('booking_tasks').update({ is_done: newDone, completed_at: newDone ? new Date().toISOString() : null }).eq('id', task.id)
    onUpdate()
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
          const catTasks = TASK_TEMPLATE.filter(t => t.category === cat).map(t => tasks.find((tk: BookingTask) => tk.task_key === t.key)).filter(Boolean)
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
                    <span style={{ fontSize:'13px', color: task.is_done ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: task.is_done ? 'line-through' : 'none', flex:1 }}>{task.task_name}</span>
                    {task.is_done && task.completed_at && <span style={{ fontSize:'10.5px', color:'var(--text-muted)', whiteSpace:'nowrap' }}>{fmtDate(task.completed_at)}</span>}
                  </label>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
