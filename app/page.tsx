'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Deal, Booking } from '@/lib/supabase'
import Link from 'next/link'

type DashStats = {
  totalPipeline: number
  activeDeals: number
  bookedThisMonth: number
  totalProfit: number
  overdueFollowUps: number
  quotesAwaitingResponse: number
  hotDeals: number
  departingThisWeek: number
}

type RecentActivity = {
  id: number
  deal_id: number
  activity_type: string
  notes: string
  created_at: string
  deals?: { title: string }
}

const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: 'var(--purple)',
  QUOTE_SENT: 'var(--gold)',
  ENGAGED: 'var(--accent-mid)',
  FOLLOW_UP: 'var(--amber)',
  DECISION_PENDING: 'var(--red)',
  BOOKED: 'var(--green)',
  LOST: 'var(--text-muted)',
}

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: 'New Lead',
  QUOTE_SENT: 'Quote Sent',
  ENGAGED: 'Engaged',
  FOLLOW_UP: 'Follow Up',
  DECISION_PENDING: 'Decision Pending',
  BOOKED: 'Booked',
  LOST: 'Lost',
}

function fmt(n: number) {
  return '£' + n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashStats | null>(null)
  const [deals, setDeals] = useState<Deal[]>([])
  const [activities, setActivities] = useState<RecentActivity[]>([])
  const [upcomingDepartures, setUpcomingDepartures] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [greeting, setGreeting] = useState('')

  useEffect(() => {
    const h = new Date().getHours()
    if (h < 12) setGreeting('Good morning')
    else if (h < 17) setGreeting('Good afternoon')
    else setGreeting('Good evening')
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const [dealsRes, activitiesRes, bookingsRes] = await Promise.all([
        supabase
          .from('deals')
          .select('*, clients(first_name, last_name)')
          .not('stage', 'in', '("BOOKED","LOST")')
          .order('created_at', { ascending: false }),
        supabase
          .from('activities')
          .select('*, deals(title)')
          .order('created_at', { ascending: false })
          .limit(8),
        supabase
          .from('bookings')
          .select('*')
          .gte('departure_date', new Date().toISOString().split('T')[0])
          .order('departure_date', { ascending: true })
          .limit(5),
      ])

      const allDeals = dealsRes.data || []
      const now = new Date()
      const weekAhead = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

      // Booked this month
      const { data: bookedDeals } = await supabase
        .from('deals')
        .select('deal_value')
        .eq('stage', 'BOOKED')
        .gte('created_at', startOfMonth.toISOString())

      // Quotes awaiting response
      const { data: pendingQuotes } = await supabase
        .from('quotes')
        .select('id')
        .eq('sent_to_client', true)

      const overdueDeals = allDeals.filter(d =>
        d.next_activity_at && new Date(d.next_activity_at) < now
      )

      setStats({
        totalPipeline: allDeals.reduce((a, d) => a + (d.deal_value || 0), 0),
        activeDeals: allDeals.length,
        bookedThisMonth: bookedDeals?.length || 0,
        totalProfit: bookedDeals?.reduce((a, d) => a + (d.deal_value || 0), 0) || 0,
        overdueFollowUps: overdueDeals.length,
        quotesAwaitingResponse: pendingQuotes?.length || 0,
        hotDeals: allDeals.filter(d => d.stage === 'DECISION_PENDING').length,
        departingThisWeek: (bookingsRes.data || []).filter(b =>
          new Date(b.departure_date) <= weekAhead
        ).length,
      })

      setDeals(allDeals.slice(0, 6))
      setActivities(activitiesRes.data || [])
      setUpcomingDepartures(bookingsRes.data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '28px', marginBottom: '12px' }}>✦</div>
          <div style={{ fontSize: '14px' }}>Loading your dashboard…</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <div>
          <div className="page-title">{greeting}</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          {stats && stats.overdueFollowUps > 0 && (
            <Link href="/today">
              <button className="btn btn-danger">
                <span className="rotten-dot" />
                {stats.overdueFollowUps} overdue
              </button>
            </Link>
          )}
          <Link href="/pipeline">
            <button className="btn btn-primary">View Pipeline →</button>
          </Link>
        </div>
      </div>

      <div className="page-body">

        {/* KPI Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px', marginBottom: '28px' }}>
          <div className="stat-card">
            <div className="stat-label">Pipeline Value</div>
            <div className="stat-value">{fmt(stats?.totalPipeline || 0)}</div>
            <div className="stat-change" style={{ color: 'var(--text-muted)' }}>{stats?.activeDeals} active deals</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Booked This Month</div>
            <div className="stat-value" style={{ color: 'var(--green)' }}>{stats?.bookedThisMonth || 0}</div>
            <div className="stat-change" style={{ color: 'var(--green)' }}>{fmt(stats?.totalProfit || 0)} profit</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Overdue Actions</div>
            <div className="stat-value" style={{ color: stats?.overdueFollowUps ? 'var(--red)' : 'var(--text-primary)' }}>
              {stats?.overdueFollowUps || 0}
            </div>
            <div className="stat-change" style={{ color: 'var(--text-muted)' }}>need attention</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Hot Deals</div>
            <div className="stat-value" style={{ color: 'var(--amber)' }}>{stats?.hotDeals || 0}</div>
            <div className="stat-change" style={{ color: 'var(--text-muted)' }}>decision pending</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Quotes Sent</div>
            <div className="stat-value" style={{ color: 'var(--accent-mid)' }}>{stats?.quotesAwaitingResponse || 0}</div>
            <div className="stat-change" style={{ color: 'var(--text-muted)' }}>awaiting response</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Departing Soon</div>
            <div className="stat-value" style={{ color: 'var(--purple)' }}>{stats?.departingThisWeek || 0}</div>
            <div className="stat-change" style={{ color: 'var(--text-muted)' }}>this week</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>

          {/* Active Deals */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
              <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '18px', color: 'var(--text-primary)' }}>
                Active Deals
              </div>
              <Link href="/pipeline">
                <button className="btn btn-ghost btn-sm">View all →</button>
              </Link>
            </div>

            {deals.length === 0 ? (
              <div className="card empty-state">
                <div style={{ fontSize: '28px' }}>◈</div>
                <div className="empty-state-title">No active deals</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Add your first lead to get started</div>
                <Link href="/pipeline" style={{ marginTop: '14px', display: 'inline-block' }}>
                  <button className="btn btn-primary">+ New Deal</button>
                </Link>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {deals.map(deal => {
                  const isOverdue = deal.next_activity_at && new Date(deal.next_activity_at) < new Date()
                  const client = deal.clients as any
                  return (
                    <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                      <div className="card" style={{ padding: '14px 18px', cursor: 'pointer', transition: 'all 0.15s' }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = 'var(--shadow-md)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = 'var(--shadow-sm)')}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                              {isOverdue && <span className="rotten-dot" />}
                              <span style={{ fontFamily: 'Instrument Serif, serif', fontSize: '16px', color: 'var(--text-primary)' }}>
                                {deal.title}
                              </span>
                            </div>
                            {client && (
                              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                {client.first_name} {client.last_name}
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <div style={{ fontSize: '14px', fontWeight: '500', color: 'var(--green)' }}>
                              {fmt(deal.deal_value || 0)}
                            </div>
                            <div style={{ marginTop: '4px' }}>
                              <span className="badge" style={{
                                background: STAGE_COLORS[deal.stage] + '22',
                                color: STAGE_COLORS[deal.stage],
                                fontSize: '11px',
                              }}>
                                {STAGE_LABELS[deal.stage] || deal.stage}
                              </span>
                            </div>
                          </div>
                        </div>
                        {deal.departure_date && (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                            <span>✈ {new Date(deal.departure_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                            {deal.next_activity_at && (
                              <span style={{ color: isOverdue ? 'var(--red)' : 'var(--text-muted)' }}>
                                {isOverdue ? '⚠ Overdue: ' : '◎ Next: '}
                                {new Date(deal.next_activity_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

            {/* Upcoming Departures */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '17px', marginBottom: '14px', color: 'var(--text-primary)' }}>
                ✈ Upcoming Departures
              </div>
              {upcomingDepartures.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  No upcoming departures
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {upcomingDepartures.map(b => {
                    const days = Math.ceil((new Date(b.departure_date).getTime() - Date.now()) / 86400000)
                    return (
                      <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>
                            {b.booking_reference}
                          </div>
                          <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                            {new Date(b.departure_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                          </div>
                        </div>
                        <span className="badge" style={{
                          background: days <= 7 ? 'var(--red-light)' : days <= 30 ? 'var(--amber-light)' : 'var(--green-light)',
                          color: days <= 7 ? 'var(--red)' : days <= 30 ? 'var(--amber)' : 'var(--green)',
                        }}>
                          {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `${days}d`}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Recent Activity */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '17px', marginBottom: '14px', color: 'var(--text-primary)' }}>
                Recent Activity
              </div>
              {activities.length === 0 ? (
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '16px 0' }}>
                  No recent activity
                </div>
              ) : (
                <div>
                  {activities.map((a, i) => (
                    <div key={a.id} className="timeline-item">
                      {i < activities.length - 1 && <div className="timeline-line" />}
                      <div className="timeline-dot" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', color: 'var(--text-secondary)', marginBottom: '1px' }}>
                          <span style={{ fontWeight: '500' }}>{a.activity_type}</span>
                          {(a as any).deals?.title && (
                            <span style={{ color: 'var(--text-muted)' }}> · {(a as any).deals.title}</span>
                          )}
                        </div>
                        {a.notes && (
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {a.notes}
                          </div>
                        )}
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {timeAgo(a.created_at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
