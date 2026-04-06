'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const fmt     = (n: number) => '£' + (n||0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

type MonthData = {
  month: number
  year: number
  revenue: number
  profit: number
  bookings: number
  quotes: number
  leads: number
}

type LostReason = { reason: string; count: number }
type StaffUser = { id: number; name: string; role: string | null; is_active: boolean | null }
type Target = {
  id?: number
  month?: number
  year?: number
  revenue_target: number
  profit_target?: number
  bookings_target?: number
  quotes_target: number
  leads_target: number
  rotten_days?: number
  profit_target_bronze?: number
  profit_target_silver?: number
  profit_target_gold?: number
  bonus_bronze?: number
  bonus_silver?: number
  bonus_gold?: number
  [key: string]: number | string | undefined
}
type CommissionRow = {
  bookingId: number
  bookingReference: string
  surname: string
  clearedDate: string
  paymentReceived: number
  commissionableAmount: number
}
type QuoteRow = {
  staffId: number
  name: string
  role: string | null
  quotesBuilt: number
  quotesSent: number
  quotedDeals: number
  sentDeals: number
  bookedDeals: number
  quotedValue: number
  quotedProfit: number
  avgQuoteValue: number
  avgVersionsPerDeal: number
  avgTurnaroundHours: number
  conversionPct: number
}
type QuoteRecentRow = {
  quoteId: number
  quoteRef: string
  version: number | null
  staffId: number | null
  staffName: string
  clientSurname: string
  title: string
  hotel: string
  createdAt: string
  sentToClient: boolean
  booked: boolean
  quotedValue: number
  quotedProfit: number
}
type QuoteUnassigned = {
  quotesBuilt: number
  quotesSent: number
  quotedDeals: number
}
type SalesRow = {
  staffId: number
  name: string
  role: string | null
  leads: number
  quotesSent: number
  bookings: number
  bookedValue: number
  bookedProfit: number
  avgBookingValue: number
  leadToBookingPct: number
  quoteToBookingPct: number
}
type SalesBookingRow = {
  bookingId: number
  bookingReference: string
  staffId: number | null
  staffName: string
  clientSurname: string
  title: string
  bookedAt: string
  bookedValue: number
  bookedProfit: number
}
type SalesUnassigned = {
  leads: number
  quotesSent: number
  bookings: number
  bookedValue: number
}
type AssignmentHealth = {
  clientsWithoutOwner: number
  dealsWithoutOwner: number
  bookingsWithoutOwner: number
}

type ProfitTargetKey = 'profit_target_bronze' | 'profit_target_silver' | 'profit_target_gold'
type BonusTargetKey = 'bonus_bronze' | 'bonus_silver' | 'bonus_gold'

type ReportView = 'commission' | 'overview' | 'sales' | 'quotes' | 'suppliers'

function previousMonthValue() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function calcCommission(total: number) {
  const firstBand = Math.min(total, 10000)
  const secondBand = Math.max(total - 10000, 0)
  return firstBand * 0.1 + secondBand * 0.15
}

function fmtDuration(hours: number) {
  if (!hours || hours <= 0) return '—'
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

function startOfMonth(value: string): string {
  return `${value}-01`
}

function endOfMonth(value: string): string {
  const [year, month] = value.split('-').map(Number)
  return new Date(year, month, 0).toISOString().split('T')[0]
}

function previousMonthRange() {
  const monthValue = previousMonthValue()
  return {
    from: startOfMonth(monthValue),
    to: endOfMonth(monthValue),
  }
}

function currentMonthRange() {
  const now = new Date()
  const monthValue = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  return {
    from: startOfMonth(monthValue),
    to: now.toISOString().split('T')[0],
  }
}

export default function ReportsPage() {
  const previousRange = previousMonthRange()
  const salesRange = currentMonthRange()
  const [monthlyData, setMonthlyData]   = useState<MonthData[]>([])
  const [lostReasons, setLostReasons]   = useState<LostReason[]>([])
  const [stageBreakdown, setStage]      = useState<{stage:string;count:number;value:number}[]>([])
  const [staffUsers, setStaffUsers]     = useState<StaffUser[]>([])
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null)
  const [commissionFrom, setCommissionFrom] = useState(previousRange.from)
  const [commissionTo, setCommissionTo] = useState(previousRange.to)
  const [commissionRows, setCommissionRows] = useState<CommissionRow[]>([])
  const [commissionLoading, setCommissionLoading] = useState(false)
  const [manualBonus, setManualBonus] = useState(0)
  const [salesFrom, setSalesFrom] = useState(salesRange.from)
  const [salesTo, setSalesTo] = useState(salesRange.to)
  const [salesStaffFilter, setSalesStaffFilter] = useState<string>('ALL')
  const [salesRows, setSalesRows] = useState<SalesRow[]>([])
  const [salesBookings, setSalesBookings] = useState<SalesBookingRow[]>([])
  const [salesUnassigned, setSalesUnassigned] = useState<SalesUnassigned>({ leads: 0, quotesSent: 0, bookings: 0, bookedValue: 0 })
  const [salesLoading, setSalesLoading] = useState(false)
  const [quoteFrom, setQuoteFrom] = useState(salesRange.from)
  const [quoteTo, setQuoteTo] = useState(salesRange.to)
  const [quoteStaffFilter, setQuoteStaffFilter] = useState<string>('ALL')
  const [quoteRows, setQuoteRows] = useState<QuoteRow[]>([])
  const [quoteRecentRows, setQuoteRecentRows] = useState<QuoteRecentRow[]>([])
  const [quoteUnassigned, setQuoteUnassigned] = useState<QuoteUnassigned>({ quotesBuilt: 0, quotesSent: 0, quotedDeals: 0 })
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [reportView, setReportView] = useState<ReportView>('commission')
  const [staffForm, setStaffForm] = useState({ name: '', role: 'sales' })
  const [staffSaving, setStaffSaving] = useState(false)
  const [assignmentHealth, setAssignmentHealth] = useState<AssignmentHealth>({
    clientsWithoutOwner: 0,
    dealsWithoutOwner: 0,
    bookingsWithoutOwner: 0,
  })
  const [loading, setLoading]           = useState(true)
  const [editingTargets, setEditTargets] = useState(false)
  const [targets, setTargets]           = useState<Target | null>(null)
  const [savingTargets, setSavingTargets] = useState(false)
  const [toast, setToast]               = useState<string|null>(null)
  const [selectedYear, setYear]         = useState(new Date().getFullYear())

  async function createStaffUser() {
    if (!staffForm.name.trim()) return
    setStaffSaving(true)
    const response = await fetch('/api/reports/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(staffForm),
    })
    const error = response.ok ? null : await response.json()

    if (error) {
      setToast(error.error || 'Failed to add staff user')
      setTimeout(() => setToast(null), 3000)
      setStaffSaving(false)
      return
    }

    const reportResponse = await fetch(`/api/reports?year=${selectedYear}`)
    if (!reportResponse.ok) {
      setToast('Failed to refresh reports')
      setTimeout(() => setToast(null), 3000)
      setStaffSaving(false)
      return
    }
    const reportData = await reportResponse.json()
    const activeStaff = reportData.staffUsers as StaffUser[]
    setStaffUsers(activeStaff)
    const newStaff = activeStaff.find(user => user.name === staffForm.name.trim())
    if (newStaff) setSelectedStaffId(newStaff.id)
    setStaffForm({ name: '', role: 'sales' })
    setStaffSaving(false)
    setToast('Staff user added ✓')
    setTimeout(() => setToast(null), 3000)
  }

  async function saveTargets() {
    if (!targets) return
    setSavingTargets(true)
    await fetch('/api/reports/targets', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(targets),
    })
    setSavingTargets(false)
    setEditTargets(false)
    setToast('Targets updated ✓')
    setTimeout(() => setToast(null), 3000)
  }

  useEffect(() => {
    let cancelled = false

    async function run() {
      setLoading(true)
      const response = await fetch(`/api/reports?year=${selectedYear}`)
      if (!response.ok) {
        if (!cancelled) setLoading(false)
        return
      }
      const data = await response.json()
      if (cancelled) return

      setMonthlyData(data.monthlyData)
      setLostReasons(data.lostReasons)
      setStage(data.stageBreakdown)
      setTargets(data.targets)
      setStaffUsers(data.staffUsers)
      setAssignmentHealth(data.assignmentHealth)
      if (data.staffUsers.length > 0 && !data.staffUsers.find(s => s.id === selectedStaffId)) {
        const preferredStaff = data.staffUsers.find((staff: StaffUser) => staff.name === 'Samir Abattouy') || data.staffUsers[0]
        setSelectedStaffId(preferredStaff.id)
      }
      setLoading(false)
    }

    void run()
    return () => { cancelled = true }
  }, [selectedStaffId, selectedYear])

  useEffect(() => {
    let cancelled = false

    async function run() {
      if (!selectedStaffId) {
        setCommissionRows([])
        return
      }

      setCommissionLoading(true)
      const response = await fetch(`/api/reports/commission?staffId=${selectedStaffId}&from=${commissionFrom}&to=${commissionTo}`)
      if (!response.ok) {
        if (!cancelled) setCommissionLoading(false)
        return
      }
      const data = await response.json()
      if (cancelled) return
      setCommissionRows(data.rows || [])
      setCommissionLoading(false)
    }

    void run()
    return () => { cancelled = true }
  }, [selectedStaffId, commissionFrom, commissionTo])

  useEffect(() => {
    let cancelled = false

    async function run() {
      setSalesLoading(true)
      const response = await fetch(`/api/reports/sales?from=${salesFrom}&to=${salesTo}`)
      if (!response.ok) {
        if (!cancelled) setSalesLoading(false)
        return
      }
      const data = await response.json()
      if (cancelled) return
      setSalesRows(data.rows)
      setSalesBookings(data.bookings)
      setSalesUnassigned(data.unassigned)
      setSalesLoading(false)
    }

    void run()
    return () => { cancelled = true }
  }, [salesFrom, salesTo, staffUsers])

  useEffect(() => {
    let cancelled = false

    async function run() {
      setQuoteLoading(true)
      const response = await fetch(`/api/reports/quotes?from=${quoteFrom}&to=${quoteTo}`)
      if (!response.ok) {
        if (!cancelled) setQuoteLoading(false)
        return
      }
      const data = await response.json()
      if (cancelled) return
      setQuoteRows(data.rows)
      setQuoteRecentRows(data.recentRows)
      setQuoteUnassigned(data.unassigned)
      setQuoteLoading(false)
    }

    void run()
    return () => { cancelled = true }
  }, [quoteFrom, quoteTo, staffUsers])

  const totalRevenue = monthlyData.reduce((a,m)=>a+m.revenue, 0)
  const totalProfit  = monthlyData.reduce((a,m)=>a+m.profit, 0)
  const totalBookings = monthlyData.reduce((a,m)=>a+m.bookings, 0)
  const maxRevenue   = Math.max(...monthlyData.map(m=>m.revenue), 1)
  const commissionableTotal = commissionRows.reduce((sum, row) => sum + row.commissionableAmount, 0)
  const paymentReceivedTotal = commissionRows.reduce((sum, row) => sum + row.paymentReceived, 0)
  const commissionTotal = calcCommission(commissionableTotal)
  const staffPayoutTotal = commissionTotal + manualBonus
  const selectedStaff = staffUsers.find(staff => staff.id === selectedStaffId) || null
  const filteredSalesRows = salesStaffFilter === 'ALL'
    ? salesRows
    : salesRows.filter(row => row.staffId === Number(salesStaffFilter))
  const filteredSalesBookings = salesStaffFilter === 'ALL'
    ? salesBookings
    : salesBookings.filter(row => row.staffId === Number(salesStaffFilter))
  const salesSummary = filteredSalesRows.reduce((sum, row) => ({
    leads: sum.leads + row.leads,
    quotesSent: sum.quotesSent + row.quotesSent,
    bookings: sum.bookings + row.bookings,
    bookedValue: sum.bookedValue + row.bookedValue,
    bookedProfit: sum.bookedProfit + row.bookedProfit,
  }), { leads: 0, quotesSent: 0, bookings: 0, bookedValue: 0, bookedProfit: 0 })
  const salesAvgBookingValue = salesSummary.bookings > 0 ? salesSummary.bookedValue / salesSummary.bookings : 0
  const salesLeadToBooking = salesSummary.leads > 0 ? (salesSummary.bookings / salesSummary.leads) * 100 : 0
  const salesQuoteToBooking = salesSummary.quotesSent > 0 ? (salesSummary.bookings / salesSummary.quotesSent) * 100 : 0
  const salesTopPerformer = filteredSalesRows[0] || null
  const filteredQuoteRows = quoteStaffFilter === 'ALL'
    ? quoteRows
    : quoteRows.filter(row => row.staffId === Number(quoteStaffFilter))
  const filteredQuoteRecentRows = quoteStaffFilter === 'ALL'
    ? quoteRecentRows
    : quoteRecentRows.filter(row => row.staffId === Number(quoteStaffFilter))
  const quoteSummary = filteredQuoteRows.reduce((sum, row) => ({
    quotesBuilt: sum.quotesBuilt + row.quotesBuilt,
    quotesSent: sum.quotesSent + row.quotesSent,
    quotedDeals: sum.quotedDeals + row.quotedDeals,
    sentDeals: sum.sentDeals + row.sentDeals,
    bookedDeals: sum.bookedDeals + row.bookedDeals,
    quotedValue: sum.quotedValue + row.quotedValue,
    quotedProfit: sum.quotedProfit + row.quotedProfit,
  }), { quotesBuilt: 0, quotesSent: 0, quotedDeals: 0, sentDeals: 0, bookedDeals: 0, quotedValue: 0, quotedProfit: 0 })
  const quoteAvgValue = quoteSummary.quotesBuilt > 0 ? quoteSummary.quotedValue / quoteSummary.quotesBuilt : 0
  const quoteAvgVersions = quoteSummary.quotedDeals > 0 ? quoteSummary.quotesBuilt / quoteSummary.quotedDeals : 0
  const quoteTurnaroundValues = filteredQuoteRows.map(row => row.avgTurnaroundHours).filter(value => value > 0)
  const quoteAvgTurnaround = quoteTurnaroundValues.length > 0
    ? quoteTurnaroundValues.reduce((sum, value) => sum + value, 0) / quoteTurnaroundValues.length
    : 0
  const quoteConversion = quoteSummary.sentDeals > 0 ? (quoteSummary.bookedDeals / quoteSummary.sentDeals) * 100 : 0
  const quoteTopPerformer = filteredQuoteRows[0] || null
  const REPORT_VIEWS: { key: ReportView; label: string; desc: string; icon: string }[] = [
    { key: 'commission', label: 'Commission', desc: 'Payroll-facing commission reports', icon: '💷' },
    { key: 'overview', label: 'Business Overview', desc: 'Revenue, profit and pipeline view', icon: '📊' },
    { key: 'sales', label: 'Sales', desc: 'Sales productivity and conversion', icon: '📈' },
    { key: 'quotes', label: 'Quotes', desc: 'Quote output and quote conversion', icon: '🧾' },
    { key: 'suppliers', label: 'Suppliers', desc: 'Supplier spend and booking mix', icon: '🏨' },
  ]

  const STAGE_COLORS: Record<string,string> = {
    'New Lead':'#8b5cf6', 'Quote Sent':'#f59e0b', 'Engaged':'#3b82f6',
    'Follow Up':'#f97316', 'Decision Pending':'#ec4899', 'Booked':'#10b981', 'Lost':'#ef4444',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Admin Reports</div>
          <div style={{ fontSize:'12.5px', color:'var(--text-muted)', marginTop:'2px' }}>
            Structured reporting hub for commission, finance, sales, quotes and supplier reporting
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <select className="input" style={{ width:'100px' }} value={selectedYear} onChange={e=>setYear(Number(e.target.value))}>
            {[2024,2025,2026,2027].map(y=><option key={y}>{y}</option>)}
          </select>
          <button className="btn btn-secondary" onClick={()=>setEditTargets(true)}>⚙ Edit Targets</button>
          <Link href="/"><button className="btn btn-secondary">← Dashboard</button></Link>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{ color:'var(--text-muted)', fontSize:'13px' }}>Loading reports…</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'20px' }}>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px' }}>
              {REPORT_VIEWS.map(view => (
                <button
                  key={view.key}
                  onClick={() => setReportView(view.key)}
                  className="card"
                  style={{
                    padding:'14px 16px',
                    textAlign:'left',
                    cursor:'pointer',
                    border: reportView === view.key ? '2px solid var(--accent)' : '1px solid var(--border)',
                    background: reportView === view.key ? 'var(--bg-secondary)' : 'var(--bg-primary)',
                  }}
                >
                  <div style={{ fontSize:'18px', marginBottom:'8px' }}>{view.icon}</div>
                  <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--text-primary)' }}>{view.label}</div>
                  <div style={{ fontSize:'11.5px', color:'var(--text-muted)', marginTop:'3px', lineHeight:1.4 }}>{view.desc}</div>
                </button>
              ))}
            </div>

            {reportView === 'commission' && (
            <div style={{ display:'grid', gridTemplateColumns:'320px 1fr', gap:'16px', alignItems:'start' }}>
              <div className="card" style={{ padding:'20px 24px' }}>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'14px' }}>Staff Setup</div>
                <div style={{ fontSize:'12.5px', color:'var(--text-muted)', marginBottom:'14px', lineHeight:1.5 }}>
                  Staff are added here for reporting first. We can expand this later into full users, permissions and role restrictions.
                </div>

                <div style={{ display:'grid', gap:'8px', marginBottom:'16px' }}>
                  {[
                    { label: 'Clients without owner', value: assignmentHealth.clientsWithoutOwner },
                    { label: 'Deals without owner', value: assignmentHealth.dealsWithoutOwner },
                    { label: 'Bookings without owner', value: assignmentHealth.bookingsWithoutOwner },
                  ].map(item => (
                    <div key={item.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 12px', border:'1px solid var(--border)', borderRadius:'10px', background:'var(--bg-secondary)' }}>
                      <span style={{ fontSize:'12px', color:'var(--text-muted)' }}>{item.label}</span>
                      <span style={{ fontSize:'13px', fontWeight:'700', color:item.value > 0 ? 'var(--red)' : 'var(--green)' }}>{item.value}</span>
                    </div>
                  ))}
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'16px' }}>
                  <input className="input" placeholder="Staff name" value={staffForm.name} onChange={e => setStaffForm(prev => ({ ...prev, name: e.target.value }))} />
                  <select className="input" value={staffForm.role} onChange={e => setStaffForm(prev => ({ ...prev, role: e.target.value }))}>
                    <option value="sales">Sales</option>
                    <option value="manager">Manager</option>
                    <option value="operations">Operations</option>
                  </select>
                  <button className="btn btn-cta" onClick={createStaffUser} disabled={!staffForm.name.trim() || staffSaving}>
                    {staffSaving ? 'Saving…' : 'Add Staff'}
                  </button>
                </div>

                <div style={{ borderTop:'1px solid var(--border)', paddingTop:'14px' }}>
                  <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:'10px' }}>Current Staff</div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                    {staffUsers.length === 0 ? (
                      <div style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>No staff users yet.</div>
                    ) : (
                      staffUsers.map(staff => (
                        <div key={staff.id} style={{ padding:'10px 12px', border:'1px solid var(--border)', borderRadius:'10px', background:selectedStaffId === staff.id ? 'var(--bg-secondary)' : 'transparent' }}>
                          <div style={{ fontSize:'13px', fontWeight:'600', color:'var(--text-primary)' }}>{staff.name}</div>
                          <div style={{ fontSize:'11.5px', color:'var(--text-muted)', marginTop:'2px' }}>{staff.role || 'staff'}</div>
                        </div>
                      ))
                    )}
                  </div>
                  <div style={{ marginTop:'12px', fontSize:'12px' }}>
                    <Link href="/bookings" style={{ color:'var(--accent)', textDecoration:'none' }}>Open bookings to clean ownership →</Link>
                  </div>
                </div>
              </div>

              <div className="card" style={{ padding:'20px 24px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'16px', marginBottom:'16px', flexWrap:'wrap' }}>
                <div>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Staff Commission Report</div>
                  <div style={{ fontSize:'12.5px', color:'var(--text-muted)', marginTop:'3px' }}>
                    Triggered only when the booking balance reaches zero. Later amendments do not change the pulled commissionable profit.
                  </div>
                </div>
                <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                  <select className="input" style={{ minWidth:'180px' }} value={selectedStaffId || ''} onChange={e => setSelectedStaffId(e.target.value ? Number(e.target.value) : null)}>
                    {staffUsers.length === 0 && <option value="">No staff set up</option>}
                    {staffUsers.map(staff => <option key={staff.id} value={staff.id}>{staff.name}</option>)}
                  </select>
                  <input className="input" type="date" value={commissionFrom} onChange={e => setCommissionFrom(e.target.value)} />
                  <input className="input" type="date" value={commissionTo} onChange={e => setCommissionTo(e.target.value)} />
                  <input className="input" type="number" min="0" value={manualBonus} onChange={e => setManualBonus(Number(e.target.value) || 0)} placeholder="Manual bonus" style={{ width:'150px' }} />
                </div>
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'18px' }}>
                {[
                  { label:'Payment Received', val:fmt(paymentReceivedTotal), color:'var(--green)' },
                  { label:'Commissionable Amount', val:fmt(commissionableTotal), color:'var(--gold)' },
                  { label:'Commission', val:fmt(commissionTotal), color:'var(--accent-mid)' },
                  { label:'Commission + Bonus', val:fmt(staffPayoutTotal), color:'var(--text-primary)' },
                ].map(card => (
                  <div key={card.label} style={{ border:'1px solid var(--border)', borderRadius:'12px', padding:'14px 16px', background:'var(--bg-secondary)' }}>
                    <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)' }}>{card.label}</div>
                    <div style={{ marginTop:'6px', fontFamily:'Fraunces,serif', fontSize:'26px', fontWeight:'300', color:card.color }}>{card.val}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', marginBottom:'12px', flexWrap:'wrap', fontSize:'12px', color:'var(--text-muted)' }}>
                <div>
                  {selectedStaff ? `${selectedStaff.name}` : 'No staff selected'} · From {fmtDate(commissionFrom)} to {fmtDate(commissionTo)}
                </div>
                <div>
                  First £10,000 at 10%, remaining amount at 15%
                </div>
              </div>

              {commissionLoading ? (
                <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>Loading commission report…</div>
              ) : commissionRows.length === 0 ? (
                <div style={{ border:'1px dashed var(--border)', borderRadius:'12px', padding:'20px', color:'var(--text-muted)', fontSize:'13px' }}>
                  {staffUsers.length === 0
                    ? 'No staff users are set up yet. Add staff records first, then assign bookings to staff_id.'
                    : 'No bookings cleared to zero for this staff member in the selected calendar month.'}
                </div>
              ) : (
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                  <thead>
                    <tr style={{ borderBottom:'2px solid var(--border)' }}>
                      {['Sr#','Booking ID','Booking Ref','Customer Surname','Payment Received','Commissionable Amount','Cleared On'].map(h => (
                        <th key={h} style={{ padding:'8px 10px', textAlign:h === 'Customer Surname' || h === 'Booking Ref' ? 'left' : 'right', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {commissionRows.map((row, index) => (
                      <tr key={`${row.bookingId}-${row.clearedDate}`} style={{ borderBottom:'1px solid var(--border)' }}>
                        <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--text-muted)' }}>{index + 1}</td>
                        <td style={{ padding:'10px 10px', textAlign:'right' }}>
                          <Link href={`/bookings/${row.bookingId}`} style={{ color:'var(--accent)', textDecoration:'none', fontWeight:'600' }}>
                            {row.bookingId}
                          </Link>
                        </td>
                        <td style={{ padding:'10px 10px', fontFamily:'monospace' }}>{row.bookingReference}</td>
                        <td style={{ padding:'10px 10px' }}>{row.surname}</td>
                        <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--green)', fontWeight:'600' }}>{fmt(row.paymentReceived)}</td>
                        <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--gold)', fontWeight:'600' }}>{fmt(row.commissionableAmount)}</td>
                        <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--text-muted)' }}>{fmtDate(row.clearedDate)}</td>
                      </tr>
                    ))}
                    <tr style={{ borderTop:'2px solid var(--border)', background:'var(--bg-tertiary)' }}>
                      <td colSpan={4} style={{ padding:'10px 10px', fontSize:'12px', fontWeight:'700', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Total</td>
                      <td style={{ padding:'10px 10px', textAlign:'right', fontWeight:'700', color:'var(--green)' }}>{fmt(paymentReceivedTotal)}</td>
                      <td style={{ padding:'10px 10px', textAlign:'right', fontWeight:'700', color:'var(--gold)' }}>{fmt(commissionableTotal)}</td>
                      <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--text-muted)' }}>{commissionRows.length} booking{commissionRows.length === 1 ? '' : 's'}</td>
                    </tr>
                  </tbody>
                </table>
              )}
            </div>
            </div>
            )}

            {reportView === 'sales' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                <div className="card" style={{ padding:'20px 24px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'16px', flexWrap:'wrap', marginBottom:'16px' }}>
                    <div>
                      <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Sales Report</div>
                      <div style={{ fontSize:'12.5px', color:'var(--text-muted)', marginTop:'3px' }}>
                        Consultant performance by leads, quotes, bookings, booked value and booked profit.
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                      <select className="input" style={{ minWidth:'180px' }} value={salesStaffFilter} onChange={e => setSalesStaffFilter(e.target.value)}>
                        <option value="ALL">Whole team</option>
                        {staffUsers.map(staff => <option key={staff.id} value={String(staff.id)}>{staff.name}</option>)}
                      </select>
                      <input className="input" type="date" value={salesFrom} onChange={e => setSalesFrom(e.target.value)} />
                      <input className="input" type="date" value={salesTo} onChange={e => setSalesTo(e.target.value)} />
                    </div>
                  </div>

                  {(salesUnassigned.leads > 0 || salesUnassigned.quotesSent > 0 || salesUnassigned.bookings > 0) && (
                    <div style={{ marginBottom:'16px', background:'#fff7ed', border:'1px solid #fdba74', borderRadius:'10px', padding:'12px 14px', fontSize:'12.5px', color:'#9a3412', lineHeight:1.6 }}>
                      {salesUnassigned.leads} unassigned lead{salesUnassigned.leads === 1 ? '' : 's'}, {salesUnassigned.quotesSent} unassigned quote{salesUnassigned.quotesSent === 1 ? '' : 's'}, and {salesUnassigned.bookings} unassigned booking{salesUnassigned.bookings === 1 ? '' : 's'} in this period are excluded from consultant scoring.
                      {' '}<Link href="/bookings" style={{ color:'#9a3412', textDecoration:'underline' }}>Clean ownership</Link>.
                    </div>
                  )}

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'12px', marginBottom:'18px' }}>
                    {[
                      { label:'Leads', val:String(salesSummary.leads), color:'var(--accent-mid)' },
                      { label:'Quotes Sent', val:String(salesSummary.quotesSent), color:'var(--amber)' },
                      { label:'Bookings', val:String(salesSummary.bookings), color:'var(--green)' },
                      { label:'Booked Value', val:fmt(salesSummary.bookedValue), color:'var(--text-primary)' },
                      { label:'Booked Profit', val:fmt(salesSummary.bookedProfit), color:'var(--gold)' },
                      { label:'Avg Booking', val:fmt(salesAvgBookingValue), color:'var(--blue)' },
                    ].map(card => (
                      <div key={card.label} style={{ border:'1px solid var(--border)', borderRadius:'12px', padding:'14px 16px', background:'var(--bg-secondary)' }}>
                        <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)' }}>{card.label}</div>
                        <div style={{ marginTop:'6px', fontFamily:'Fraunces,serif', fontSize:'26px', fontWeight:'300', color:card.color }}>{card.val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr', gap:'12px' }}>
                    <div style={{ border:'1px solid var(--border)', borderRadius:'12px', padding:'14px 16px', background:'var(--bg-secondary)' }}>
                      <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:'8px' }}>Top Performer</div>
                      {salesTopPerformer ? (
                        <>
                          <div style={{ fontSize:'15px', fontWeight:'600', color:'var(--text-primary)' }}>{salesTopPerformer.name}</div>
                          <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'3px' }}>
                            {salesTopPerformer.bookings} bookings · {fmt(salesTopPerformer.bookedProfit)} profit
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>No consultant activity in this date range.</div>
                      )}
                    </div>
                    <div style={{ border:'1px solid var(--border)', borderRadius:'12px', padding:'14px 16px', background:'var(--bg-secondary)' }}>
                      <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:'8px' }}>Lead to Booking</div>
                      <div style={{ fontFamily:'Fraunces,serif', fontSize:'28px', fontWeight:'300', color:'var(--green)' }}>{salesLeadToBooking.toFixed(1)}%</div>
                    </div>
                    <div style={{ border:'1px solid var(--border)', borderRadius:'12px', padding:'14px 16px', background:'var(--bg-secondary)' }}>
                      <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:'8px' }}>Quote to Booking</div>
                      <div style={{ fontFamily:'Fraunces,serif', fontSize:'28px', fontWeight:'300', color:'var(--accent-mid)' }}>{salesQuoteToBooking.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding:'20px 24px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
                    <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Consultant Scoreboard</div>
                    <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                      Profit uses final booking profit when available, otherwise latest sent quote profit.
                    </div>
                  </div>

                  {salesLoading ? (
                    <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>Loading sales report…</div>
                  ) : filteredSalesRows.length === 0 ? (
                    <div style={{ border:'1px dashed var(--border)', borderRadius:'12px', padding:'20px', color:'var(--text-muted)', fontSize:'13px' }}>
                      No sales activity found in the selected date range.
                    </div>
                  ) : (
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                      <thead>
                        <tr style={{ borderBottom:'2px solid var(--border)' }}>
                          {['Consultant','Leads','Quotes','Bookings','Booked Value','Booked Profit','Avg Booking','Lead→Book','Quote→Book'].map(h => (
                            <th key={h} style={{ padding:'8px 10px', textAlign:h === 'Consultant' ? 'left' : 'right', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSalesRows.map(row => (
                          <tr key={row.staffId} style={{ borderBottom:'1px solid var(--border)' }}>
                            <td style={{ padding:'10px 10px' }}>
                              <div style={{ fontWeight:'600', color:'var(--text-primary)' }}>{row.name}</div>
                              <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{row.role || 'staff'}</div>
                            </td>
                            <td style={{ padding:'10px 10px', textAlign:'right' }}>{row.leads}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right' }}>{row.quotesSent}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--green)', fontWeight:'600' }}>{row.bookings}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right' }}>{fmt(row.bookedValue)}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--gold)', fontWeight:'600' }}>{fmt(row.bookedProfit)}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right' }}>{fmt(row.avgBookingValue)}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right', color:row.leadToBookingPct >= 20 ? 'var(--green)' : row.leadToBookingPct >= 10 ? 'var(--amber)' : 'var(--text-muted)' }}>{row.leadToBookingPct.toFixed(1)}%</td>
                            <td style={{ padding:'10px 10px', textAlign:'right', color:row.quoteToBookingPct >= 35 ? 'var(--green)' : row.quoteToBookingPct >= 20 ? 'var(--amber)' : 'var(--text-muted)' }}>{row.quoteToBookingPct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="card" style={{ padding:'20px 24px' }}>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'14px' }}>Recent Bookings In Range</div>
                  {salesLoading ? (
                    <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>Loading booked deals…</div>
                  ) : filteredSalesBookings.length === 0 ? (
                    <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No bookings landed in this date window.</div>
                  ) : (
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                      <thead>
                        <tr style={{ borderBottom:'2px solid var(--border)' }}>
                          {['Booked On','Consultant','Booking','Client','Title','Value','Profit'].map(h => (
                            <th key={h} style={{ padding:'8px 10px', textAlign:h === 'Value' || h === 'Profit' ? 'right' : 'left', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredSalesBookings.slice(0, 12).map(row => (
                          <tr key={row.bookingId} style={{ borderBottom:'1px solid var(--border)' }}>
                            <td style={{ padding:'10px 10px', color:'var(--text-muted)' }}>{fmtDate(row.bookedAt)}</td>
                            <td style={{ padding:'10px 10px' }}>{row.staffName}</td>
                            <td style={{ padding:'10px 10px', fontFamily:'monospace' }}>
                              <Link href={`/bookings/${row.bookingId}`} style={{ color:'var(--accent)', textDecoration:'none', fontWeight:'600' }}>
                                {row.bookingReference}
                              </Link>
                            </td>
                            <td style={{ padding:'10px 10px' }}>{row.clientSurname}</td>
                            <td style={{ padding:'10px 10px', color:'var(--text-muted)' }}>{row.title}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right' }}>{fmt(row.bookedValue)}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--gold)', fontWeight:'600' }}>{fmt(row.bookedProfit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {reportView === 'quotes' && (
              <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
                <div className="card" style={{ padding:'20px 24px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:'16px', flexWrap:'wrap', marginBottom:'16px' }}>
                    <div>
                      <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Quote Report</div>
                      <div style={{ fontSize:'12.5px', color:'var(--text-muted)', marginTop:'3px' }}>
                        Quote output, revision volume, turnaround speed and quoted-deal conversion.
                      </div>
                    </div>
                    <div style={{ display:'flex', gap:'8px', alignItems:'center', flexWrap:'wrap' }}>
                      <select className="input" style={{ minWidth:'180px' }} value={quoteStaffFilter} onChange={e => setQuoteStaffFilter(e.target.value)}>
                        <option value="ALL">Whole team</option>
                        {staffUsers.map(staff => <option key={staff.id} value={String(staff.id)}>{staff.name}</option>)}
                      </select>
                      <input className="input" type="date" value={quoteFrom} onChange={e => setQuoteFrom(e.target.value)} />
                      <input className="input" type="date" value={quoteTo} onChange={e => setQuoteTo(e.target.value)} />
                    </div>
                  </div>

                  {(quoteUnassigned.quotesBuilt > 0 || quoteUnassigned.quotesSent > 0) && (
                    <div style={{ marginBottom:'16px', background:'#fff7ed', border:'1px solid #fdba74', borderRadius:'10px', padding:'12px 14px', fontSize:'12.5px', color:'#9a3412', lineHeight:1.6 }}>
                      {quoteUnassigned.quotesBuilt} unassigned quote version{quoteUnassigned.quotesBuilt === 1 ? '' : 's'}, with {quoteUnassigned.quotesSent} sent to client, across {quoteUnassigned.quotedDeals} deal{quoteUnassigned.quotedDeals === 1 ? '' : 's'} are excluded from consultant scoring.
                      {' '}<Link href="/pipeline" style={{ color:'#9a3412', textDecoration:'underline' }}>Clean ownership</Link>.
                    </div>
                  )}

                  <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'12px', marginBottom:'18px' }}>
                    {[
                      { label:'Quote Versions', val:String(quoteSummary.quotesBuilt), color:'var(--accent-mid)' },
                      { label:'Quotes Sent', val:String(quoteSummary.quotesSent), color:'var(--amber)' },
                      { label:'Quoted Deals', val:String(quoteSummary.quotedDeals), color:'var(--text-primary)' },
                      { label:'Quoted Value', val:fmt(quoteSummary.quotedValue), color:'var(--green)' },
                      { label:'Quoted Profit', val:fmt(quoteSummary.quotedProfit), color:'var(--gold)' },
                      { label:'Avg Quote Value', val:fmt(quoteAvgValue), color:'var(--blue)' },
                    ].map(card => (
                      <div key={card.label} style={{ border:'1px solid var(--border)', borderRadius:'12px', padding:'14px 16px', background:'var(--bg-secondary)' }}>
                        <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)' }}>{card.label}</div>
                        <div style={{ marginTop:'6px', fontFamily:'Fraunces,serif', fontSize:'26px', fontWeight:'300', color:card.color }}>{card.val}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr', gap:'12px' }}>
                    <div style={{ border:'1px solid var(--border)', borderRadius:'12px', padding:'14px 16px', background:'var(--bg-secondary)' }}>
                      <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:'8px' }}>Top Converter</div>
                      {quoteTopPerformer ? (
                        <>
                          <div style={{ fontSize:'15px', fontWeight:'600', color:'var(--text-primary)' }}>{quoteTopPerformer.name}</div>
                          <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'3px' }}>
                            {quoteTopPerformer.conversionPct.toFixed(1)}% quote-to-booking from sent deals
                          </div>
                        </>
                      ) : (
                        <div style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>No quote activity in this date range.</div>
                      )}
                    </div>
                    <div style={{ border:'1px solid var(--border)', borderRadius:'12px', padding:'14px 16px', background:'var(--bg-secondary)' }}>
                      <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:'8px' }}>Overall Conversion</div>
                      <div style={{ fontFamily:'Fraunces,serif', fontSize:'28px', fontWeight:'300', color:'var(--green)' }}>{quoteConversion.toFixed(1)}%</div>
                    </div>
                    <div style={{ border:'1px solid var(--border)', borderRadius:'12px', padding:'14px 16px', background:'var(--bg-secondary)' }}>
                      <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:'8px' }}>Avg Versions / Deal</div>
                      <div style={{ fontFamily:'Fraunces,serif', fontSize:'28px', fontWeight:'300', color:'var(--accent-mid)' }}>{quoteAvgVersions.toFixed(1)}</div>
                    </div>
                    <div style={{ border:'1px solid var(--border)', borderRadius:'12px', padding:'14px 16px', background:'var(--bg-secondary)' }}>
                      <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:'8px' }}>Avg First Quote Turnaround</div>
                      <div style={{ fontFamily:'Fraunces,serif', fontSize:'28px', fontWeight:'300', color:'var(--green)' }}>{fmtDuration(quoteAvgTurnaround)}</div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding:'20px 24px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:'10px', marginBottom:'14px', flexWrap:'wrap' }}>
                    <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Consultant Quote Scoreboard</div>
                    <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                      Conversion = booked deals / sent quoted deals
                    </div>
                  </div>

                  {quoteLoading ? (
                    <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>Loading quote report…</div>
                  ) : filteredQuoteRows.length === 0 ? (
                    <div style={{ border:'1px dashed var(--border)', borderRadius:'12px', padding:'20px', color:'var(--text-muted)', fontSize:'13px' }}>
                      No quote activity found in the selected date range.
                    </div>
                  ) : (
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                      <thead>
                        <tr style={{ borderBottom:'2px solid var(--border)' }}>
                          {['Consultant','Quote Versions','Sent','Quoted Deals','Booked Deals','Quoted Value','Quoted Profit','Avg Version / Deal','Turnaround','Conversion'].map(h => (
                            <th key={h} style={{ padding:'8px 10px', textAlign:h === 'Consultant' ? 'left' : 'right', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredQuoteRows.map(row => (
                          <tr key={row.staffId} style={{ borderBottom:'1px solid var(--border)' }}>
                            <td style={{ padding:'10px 10px' }}>
                              <div style={{ fontWeight:'600', color:'var(--text-primary)' }}>{row.name}</div>
                              <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{row.role || 'staff'}</div>
                            </td>
                            <td style={{ padding:'10px 10px', textAlign:'right' }}>{row.quotesBuilt}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--amber)', fontWeight:'600' }}>{row.quotesSent}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right' }}>{row.quotedDeals}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--green)', fontWeight:'600' }}>{row.bookedDeals}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right' }}>{fmt(row.quotedValue)}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--gold)', fontWeight:'600' }}>{fmt(row.quotedProfit)}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right' }}>{row.avgVersionsPerDeal.toFixed(1)}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right' }}>{fmtDuration(row.avgTurnaroundHours)}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right', color:row.conversionPct >= 35 ? 'var(--green)' : row.conversionPct >= 20 ? 'var(--amber)' : 'var(--text-muted)' }}>{row.conversionPct.toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="card" style={{ padding:'20px 24px' }}>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'14px' }}>Recent Quote Activity</div>
                  {quoteLoading ? (
                    <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>Loading recent quotes…</div>
                  ) : filteredQuoteRecentRows.length === 0 ? (
                    <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No quotes created in this date window.</div>
                  ) : (
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                      <thead>
                        <tr style={{ borderBottom:'2px solid var(--border)' }}>
                          {['Created','Consultant','Quote Ref','Version','Client','Deal / Hotel','Sent','Booked','Sell','Profit'].map(h => (
                            <th key={h} style={{ padding:'8px 10px', textAlign:h === 'Sell' || h === 'Profit' ? 'right' : 'left', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)' }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredQuoteRecentRows.slice(0, 14).map(row => (
                          <tr key={row.quoteId} style={{ borderBottom:'1px solid var(--border)' }}>
                            <td style={{ padding:'10px 10px', color:'var(--text-muted)' }}>{fmtDate(row.createdAt)}</td>
                            <td style={{ padding:'10px 10px' }}>{row.staffName}</td>
                            <td style={{ padding:'10px 10px', fontFamily:'monospace', color:'var(--accent)' }}>{row.quoteRef}</td>
                            <td style={{ padding:'10px 10px' }}>{row.version ?? '—'}</td>
                            <td style={{ padding:'10px 10px' }}>{row.clientSurname}</td>
                            <td style={{ padding:'10px 10px' }}>
                              <div style={{ color:'var(--text-primary)' }}>{row.title}</div>
                              <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{row.hotel}</div>
                            </td>
                            <td style={{ padding:'10px 10px', color:row.sentToClient ? 'var(--green)' : 'var(--text-muted)', fontWeight:'600' }}>{row.sentToClient ? 'Yes' : 'No'}</td>
                            <td style={{ padding:'10px 10px', color:row.booked ? 'var(--green)' : 'var(--text-muted)', fontWeight:'600' }}>{row.booked ? 'Yes' : 'No'}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right' }}>{fmt(row.quotedValue)}</td>
                            <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--gold)', fontWeight:'600' }}>{fmt(row.quotedProfit)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            {reportView === 'suppliers' && (
              <div className="card" style={{ padding:'28px 24px' }}>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'8px' }}>Supplier Report</div>
                <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>
                  Reserved for supplier volume, spend, booking mix and operational dependency tracking.
                </div>
              </div>
            )}

            {reportView === 'overview' && (
            <>
            {/* Year summary */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
              {[
                { label:'Total Revenue',  val:fmt(totalRevenue),                                          color:'var(--text-primary)' },
                { label:'Total Profit',   val:fmt(totalProfit),                                           color:'var(--gold)'         },
                { label:'Bookings',       val:String(totalBookings),                                      color:'var(--green)'        },
                { label:'Avg Deal Value', val:fmt(totalBookings>0?totalRevenue/totalBookings:0),          color:'var(--blue)'         },
              ].map(s=>(
                <div key={s.label} className="stat-card">
                  <div className="stat-label">{s.label}</div>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:'28px', fontWeight:'300', color:s.color, lineHeight:1, marginTop:'4px' }}>{s.val}</div>
                </div>
              ))}
            </div>

            {/* Monthly bar chart */}
            <div className="card" style={{ padding:'20px 24px' }}>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'20px' }}>Monthly Performance {selectedYear}</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:'6px', alignItems:'flex-end', height:'160px', marginBottom:'8px' }}>
                {monthlyData.map(m => {
                  const h = Math.round((m.revenue/maxRevenue)*140)
                  const ph = Math.round((m.profit/maxRevenue)*140)
                  const isCurrentMonth = m.month===new Date().getMonth()+1 && m.year===new Date().getFullYear()
                  return (
                    <div key={m.month} style={{ display:'flex', flexDirection:'column', alignItems:'center', height:'160px', justifyContent:'flex-end', position:'relative' }}>
                      <div style={{ position:'relative', width:'100%', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'flex-end' }}>
                        {m.revenue>0&&<div title={`Revenue: ${fmt(m.revenue)}`} style={{ width:'100%', height:`${h}px`, background:isCurrentMonth?'var(--accent-mid)':'var(--border-strong)', borderRadius:'3px 3px 0 0', minHeight:'2px', cursor:'pointer', position:'relative' }}>
                          {ph>0&&<div style={{ position:'absolute', bottom:0, left:0, right:0, height:`${ph}px`, background:isCurrentMonth?'var(--gold)':'var(--gold)', borderRadius:'3px 3px 0 0', opacity:0.8 }}/>}
                        </div>}
                        {m.revenue===0&&<div style={{ width:'100%', height:'2px', background:'var(--border)', borderRadius:'3px' }}/>}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(12,1fr)', gap:'6px' }}>
                {monthlyData.map(m=>(
                  <div key={m.month} style={{ textAlign:'center', fontSize:'10px', color:m.month===new Date().getMonth()+1&&m.year===new Date().getFullYear()?'var(--accent-mid)':'var(--text-muted)', fontWeight:m.month===new Date().getMonth()+1&&m.year===new Date().getFullYear()?'700':'400' }}>
                    {MONTHS[m.month-1]}
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:'16px', marginTop:'10px', fontSize:'11.5px', color:'var(--text-muted)' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}><div style={{ width:'10px', height:'10px', background:'var(--border-strong)', borderRadius:'2px' }}/> Revenue</div>
                <div style={{ display:'flex', alignItems:'center', gap:'5px' }}><div style={{ width:'10px', height:'10px', background:'var(--gold)', borderRadius:'2px', opacity:0.8 }}/> Profit</div>
              </div>
            </div>

            {/* Monthly table */}
            <div className="card" style={{ padding:'20px 24px' }}>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'16px' }}>Monthly Breakdown</div>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:'13px' }}>
                <thead>
                  <tr style={{ borderBottom:'2px solid var(--border)' }}>
                    {['Month','Revenue','Profit','Margin','Bookings','Quotes','Leads'].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:h==='Month'?'left':'right', fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.filter(m=>m.revenue>0||m.leads>0||m.quotes>0).map(m=>{
                    const margin = m.revenue>0 ? ((m.profit/m.revenue)*100).toFixed(1) : '—'
                    const isCurrent = m.month===new Date().getMonth()+1&&m.year===new Date().getFullYear()
                    return(
                      <tr key={m.month} style={{ borderBottom:'1px solid var(--border)', background:isCurrent?'var(--accent-light)':'transparent' }}>
                        <td style={{ padding:'10px 10px', fontWeight:isCurrent?'600':'400', color:isCurrent?'var(--accent-mid)':'var(--text-primary)' }}>
                          {MONTHS[m.month-1]} {m.year}{isCurrent&&<span style={{ fontSize:'10px', marginLeft:'6px', color:'var(--accent-mid)' }}>← current</span>}
                        </td>
                        <td style={{ padding:'10px 10px', textAlign:'right', fontFamily:'Fraunces,serif', fontWeight:'300' }}>{fmt(m.revenue)}</td>
                        <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--gold)', fontFamily:'Fraunces,serif', fontWeight:'300' }}>{fmt(m.profit)}</td>
                        <td style={{ padding:'10px 10px', textAlign:'right', color:parseFloat(margin)>=10?'var(--green)':parseFloat(margin)>=7?'var(--amber)':'var(--red)' }}>{margin}{margin!=='—'?'%':''}</td>
                        <td style={{ padding:'10px 10px', textAlign:'right' }}>{m.bookings||'—'}</td>
                        <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--text-muted)' }}>{m.quotes||'—'}</td>
                        <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--text-muted)' }}>{m.leads||'—'}</td>
                      </tr>
                    )
                  })}
                  {/* Totals row */}
                  <tr style={{ borderTop:'2px solid var(--border)', fontWeight:'600', background:'var(--bg-tertiary)' }}>
                    <td style={{ padding:'10px 10px', fontSize:'12px', fontWeight:'700', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Total</td>
                    <td style={{ padding:'10px 10px', textAlign:'right', fontFamily:'Fraunces,serif', fontWeight:'300', fontSize:'15px' }}>{fmt(totalRevenue)}</td>
                    <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--gold)', fontFamily:'Fraunces,serif', fontWeight:'300', fontSize:'15px' }}>{fmt(totalProfit)}</td>
                    <td style={{ padding:'10px 10px', textAlign:'right' }}>{totalRevenue>0?((totalProfit/totalRevenue)*100).toFixed(1)+'%':'—'}</td>
                    <td style={{ padding:'10px 10px', textAlign:'right' }}>{totalBookings}</td>
                    <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--text-muted)' }}>{monthlyData.reduce((a,m)=>a+m.quotes,0)}</td>
                    <td style={{ padding:'10px 10px', textAlign:'right', color:'var(--text-muted)' }}>{monthlyData.reduce((a,m)=>a+m.leads,0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>

              {/* Pipeline funnel */}
              <div className="card" style={{ padding:'20px 24px' }}>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'16px' }}>Pipeline by Stage</div>
                {stageBreakdown.map(s=>(
                  <div key={s.stage} style={{ marginBottom:'10px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'4px' }}>
                      <span style={{ color:STAGE_COLORS[s.stage]||'var(--text-primary)', fontWeight:'500' }}>{s.stage}</span>
                      <span style={{ color:'var(--text-muted)' }}>{s.count} deal{s.count!==1?'s':''} · {fmt(s.value)}</span>
                    </div>
                    <div style={{ height:'6px', background:'var(--border)', borderRadius:'3px', overflow:'hidden' }}>
                      <div style={{ height:'100%', width:`${Math.min((s.count/Math.max(...stageBreakdown.map(x=>x.count)))*100,100)}%`, background:STAGE_COLORS[s.stage]||'var(--accent)', borderRadius:'3px', transition:'width 0.5s' }}/>
                    </div>
                  </div>
                ))}
              </div>

              {/* Lost reasons */}
              <div className="card" style={{ padding:'20px 24px' }}>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'16px' }}>Lost Deal Reasons</div>
                {lostReasons.length===0 ? (
                  <div style={{ fontSize:'13px', color:'var(--text-muted)', fontStyle:'italic' }}>No lost deals recorded yet</div>
                ) : (
                  <>
                    {lostReasons.map((r,i)=>{
                      const maxCount = lostReasons[0].count
                      return(
                        <div key={i} style={{ marginBottom:'12px' }}>
                          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'13px', marginBottom:'4px' }}>
                            <span style={{ color:'var(--text-primary)', lineHeight:'1.4', flex:1, marginRight:'10px' }}>{r.reason}</span>
                            <span style={{ color:'var(--red)', fontWeight:'600', flexShrink:0 }}>{r.count}x</span>
                          </div>
                          <div style={{ height:'5px', background:'var(--border)', borderRadius:'3px', overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${(r.count/maxCount)*100}%`, background:'var(--red)', borderRadius:'3px', opacity:0.7 }}/>
                          </div>
                        </div>
                      )
                    })}
                    <div style={{ marginTop:'12px', fontSize:'12px', color:'var(--text-muted)' }}>
                      Total lost deals: {lostReasons.reduce((a,r)=>a+r.count,0)}
                    </div>
                  </>
                )}
              </div>
            </div>
            </>
            )}
          </div>
        )}
      </div>

      {/* Edit targets modal */}
      {editingTargets && targets && (
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setEditTargets(false)}}>
          <div className="modal" style={{ maxWidth:'560px' }}>
            <div className="modal-title">Monthly Targets</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
              <div>
                <label className="label">Revenue Target (£)</label>
                <input className="input" type="number" value={targets.revenue_target} onChange={e=>setTargets(prev => prev ? ({ ...prev, revenue_target: Number(e.target.value) }) : prev)}/>
              </div>
              <div>
                <label className="label">Quotes Target</label>
                <input className="input" type="number" value={targets.quotes_target} onChange={e=>setTargets(prev => prev ? ({ ...prev, quotes_target: Number(e.target.value) }) : prev)}/>
              </div>
              <div>
                <label className="label">Leads Target</label>
                <input className="input" type="number" value={targets.leads_target} onChange={e=>setTargets(prev => prev ? ({ ...prev, leads_target: Number(e.target.value) }) : prev)}/>
              </div>
              <div>
                <label className="label">Rotten Deal Threshold (days)</label>
                <input className="input" type="number" value={targets.rotten_days||3} onChange={e=>setTargets(prev => prev ? ({ ...prev, rotten_days: Number(e.target.value) }) : prev)}/>
              </div>
            </div>
            <div style={{ marginTop:'16px', padding:'14px', background:'var(--bg-tertiary)', borderRadius:'10px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'12px' }}>Profit Bonus Tiers</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
                {[
                  { key:'profit_target_bronze', bonus_key:'bonus_bronze', label:'🥉 Bronze', color:'#cd7f32' },
                  { key:'profit_target_silver', bonus_key:'bonus_silver', label:'🥈 Silver', color:'#9e9e9e' },
                  { key:'profit_target_gold',   bonus_key:'bonus_gold',   label:'🥇 Gold',   color:'#f59e0b' },
                ].map((tier: { key: ProfitTargetKey; bonus_key: BonusTargetKey; label: string; color: string })=>(
                  <div key={tier.key}>
                    <label className="label" style={{ color:tier.color }}>{tier.label}</label>
                    <input className="input" type="number" placeholder="Profit target" value={Number(targets[tier.key] || 0)} onChange={e=>setTargets(prev => prev ? ({ ...prev, [tier.key]: Number(e.target.value) }) : prev)} style={{ marginBottom:'6px' }}/>
                    <input className="input" type="number" placeholder="Bonus (£)" value={Number(targets[tier.bonus_key] || 0)} onChange={e=>setTargets(prev => prev ? ({ ...prev, [tier.bonus_key]: Number(e.target.value) }) : prev)}/>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'20px' }}>
              <button className="btn btn-secondary" onClick={()=>setEditTargets(false)}>Cancel</button>
              <button className="btn btn-cta" onClick={saveTargets} disabled={savingTargets}>{savingTargets?'Saving…':'Save Targets'}</button>
            </div>
          </div>
        </div>
      )}

      {toast&&<div className="toast success">{toast}</div>}
    </div>
  )
}
