'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Target = {
  revenue_target: number
  profit_target_bronze: number
  profit_target_silver: number
  profit_target_gold: number
  quotes_target: number
  leads_target: number
  bonus_bronze: number
  bonus_silver: number
  bonus_gold: number
  rotten_days: number
}

type DashData = {
  confirmedRevenue: number
  confirmedProfit: number
  quotesThisMonth: number
  leadsThisMonth: number
  conversionRate: number
  pipelineValue: number
  expectedProfit: number
  activeDeals: number
  rottenDeals: number
  yearRevenue: number
  yearProfit: number
  recentDeals: any[]
  recentBookings: any[]
  lostReasons: { reason: string; count: number }[]
  upcomingDepartures: any[]
}

const fmt  = (n: number) => '£' + (n||0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
const fmtK = (n: number) => n >= 1000 ? '£' + (n/1000).toFixed(0) + 'k' : fmt(n)
const pct  = (a: number, b: number) => b > 0 ? Math.min(Math.round((a/b)*100), 100) : 0

function ProgressBar({ value, max, color = 'var(--accent-mid)' }: { value: number; max: number; color?: string }) {
  const p = pct(value, max)
  return (
    <div style={{ height: '8px', background: 'var(--border)', borderRadius: '4px', overflow: 'hidden', marginTop: '8px' }}>
      <div style={{ height: '100%', width: `${p}%`, background: color, borderRadius: '4px', transition: 'width 0.6s ease' }} />
    </div>
  )
}

function ProfitTier({ profit, bronze, silver, gold, bonusBronze, bonusSilver, bonusGold }: any) {
  const tier = profit >= gold ? 'gold' : profit >= silver ? 'silver' : profit >= bronze ? 'bronze' : null
  const next = profit < bronze ? { target: bronze, bonus: bonusBronze, label: 'Bronze', color: '#cd7f32' }
             : profit < silver ? { target: silver, bonus: bonusSilver, label: 'Silver', color: '#9e9e9e' }
             : profit < gold   ? { target: gold,   bonus: bonusGold,   label: 'Gold',   color: '#f59e0b' }
             : null
  const tierConfig: Record<string,any> = {
    gold:   { label: 'Gold Tier',   color: '#f59e0b', bg: '#fdf3e3', bonus: bonusGold,   emoji: '🥇' },
    silver: { label: 'Silver Tier', color: '#9e9e9e', bg: '#f5f5f5', bonus: bonusSilver, emoji: '🥈' },
    bronze: { label: 'Bronze Tier', color: '#cd7f32', bg: '#fdf0e0', bonus: bonusBronze, emoji: '🥉' },
  }
  return (
    <div style={{ padding: '18px 20px', background: tier ? tierConfig[tier].bg : 'var(--bg-tertiary)', borderRadius: '12px', border: `1.5px solid ${tier ? tierConfig[tier].color+'44' : 'var(--border)'}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '2px' }}>Bonus Tier</div>
          {tier ? (
            <div style={{ fontFamily: 'Fraunces,serif', fontSize: '20px', fontWeight: '300', color: tierConfig[tier].color }}>
              {tierConfig[tier].emoji} {tierConfig[tier].label} — £{tierConfig[tier].bonus} bonus earned
            </div>
          ) : (
            <div style={{ fontFamily: 'Fraunces,serif', fontSize: '18px', fontWeight: '300', color: 'var(--text-muted)' }}>No tier reached yet this month</div>
          )}
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: 'Fraunces,serif', fontSize: '32px', fontWeight: '300', color: tier ? tierConfig[tier].color : 'var(--text-primary)' }}>{fmt(profit)}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>confirmed profit this month</div>
        </div>
      </div>
      <div style={{ position: 'relative', height: '10px', background: 'var(--border)', borderRadius: '5px', overflow: 'hidden', marginBottom: '6px' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${(bronze/gold)*100}%`, background: '#cd7f3222', borderRight: '1px solid #cd7f3266' }} />
        <div style={{ position: 'absolute', left: `${(bronze/gold)*100}%`, top: 0, bottom: 0, width: `${((silver-bronze)/gold)*100}%`, background: '#9e9e9e22', borderRight: '1px solid #9e9e9e66' }} />
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min((profit/gold)*100, 100)}%`, background: tier==='gold'?'#f59e0b':tier==='silver'?'#9e9e9e':tier==='bronze'?'#cd7f32':'var(--accent-mid)', borderRadius: '5px', transition: 'width 0.6s ease' }} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', color: 'var(--text-muted)' }}>
        <span>£0</span>
        <span style={{ color: '#cd7f32' }}>🥉 {fmtK(bronze)}</span>
        <span style={{ color: '#9e9e9e' }}>🥈 {fmtK(silver)}</span>
        <span style={{ color: '#f59e0b' }}>🥇 {fmtK(gold)}</span>
      </div>
      {next && (
        <div style={{ marginTop: '10px', fontSize: '12.5px', color: 'var(--text-secondary)', background: 'var(--surface)', borderRadius: '8px', padding: '8px 12px' }}>
          <span style={{ color: next.color, fontWeight: '600' }}>{next.label} tier</span> — {fmt(next.target - profit)} more profit needed to unlock +£{next.bonus} bonus
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const [data, setData]       = useState<DashData | null>(null)
  const [target, setTarget]   = useState<Target | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const now        = new Date()
    const month      = now.getMonth() + 1
    const year       = now.getFullYear()
    const monthStart = new Date(year, month - 1, 1).toISOString()
    const monthEnd   = new Date(year, month, 0, 23, 59, 59).toISOString()
    const yearStart  = new Date(year, 0, 1).toISOString()

    const { data: tData } = await supabase.from('targets').select('*').eq('month', month).eq('year', year).single()
    setTarget(tData)
    const rd = tData?.rotten_days || 3

    // Confirmed bookings this month
    const { data: bookings } = await supabase.from('bookings')
      .select('id, deal_id, booking_reference, departure_date, created_at, deals(id, title, deal_value, quotes(profit, sent_to_client, created_at))')
      .eq('status', 'CONFIRMED')
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)

    let confirmedRevenue = 0, confirmedProfit = 0
    const recentBookings: any[] = []
    ;(bookings || []).forEach((b: any) => {
      const quotes     = b.deals?.quotes || []
      const sentQuotes = quotes.filter((q: any) => q.sent_to_client).sort((a: any, z: any) => new Date(z.created_at).getTime() - new Date(a.created_at).getTime())
      const bestQuote  = sentQuotes[0] || quotes.sort((a: any, z: any) => new Date(z.created_at).getTime() - new Date(a.created_at).getTime())[0]
      confirmedRevenue += b.deals?.deal_value || 0
      confirmedProfit  += bestQuote?.profit || 0
      recentBookings.push({ ...b, profit: bestQuote?.profit || 0 })
    })

    // Year to date
    const { data: yearBookings } = await supabase.from('bookings')
      .select('id, deal_id, deals(deal_value, quotes(profit, sent_to_client, created_at))')
      .eq('status', 'CONFIRMED')
      .gte('created_at', yearStart)
    let yearRevenue = 0, yearProfit = 0
    ;(yearBookings || []).forEach((b: any) => {
      const quotes     = b.deals?.quotes || []
      const sentQuotes = quotes.filter((q: any) => q.sent_to_client).sort((a: any, z: any) => new Date(z.created_at).getTime() - new Date(a.created_at).getTime())
      const bestQuote  = sentQuotes[0] || quotes[0]
      yearRevenue += b.deals?.deal_value || 0
      yearProfit  += bestQuote?.profit || 0
    })

    // Quotes sent this month
    const { count: quotesCount } = await supabase.from('quotes')
      .select('id', { count: 'exact', head: true })
      .eq('sent_to_client', true)
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)

    // New leads this month
    const { count: leadsCount } = await supabase.from('deals')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', monthStart)
      .lte('created_at', monthEnd)

    // Conversion rate
    const { count: totalDeals  } = await supabase.from('deals').select('id', { count: 'exact', head: true })
    const { count: totalBooked } = await supabase.from('deals').select('id', { count: 'exact', head: true }).eq('stage', 'BOOKED')
    const conversionRate = totalDeals ? Math.round(((totalBooked||0) / totalDeals) * 100) : 0

    // Active pipeline
    const { data: pipeline } = await supabase.from('deals')
      .select('id, title, stage, deal_value, next_activity_at, created_at, clients(first_name, last_name), quotes(profit, sent_to_client, created_at)')
      .not('stage', 'in', '("BOOKED","LOST")')
      .order('created_at', { ascending: false })

    let pipelineValue = 0, expectedProfit = 0, rottenDeals = 0
    ;(pipeline || []).forEach((d: any) => {
      pipelineValue += d.deal_value || 0
      const sentQuotes = (d.quotes||[]).filter((q: any) => q.sent_to_client).sort((a: any,z: any)=>new Date(z.created_at).getTime()-new Date(a.created_at).getTime())
      const bestQuote  = sentQuotes[0] || (d.quotes||[]).sort((a: any,z: any)=>new Date(z.created_at).getTime()-new Date(a.created_at).getTime())[0]
      expectedProfit  += bestQuote?.profit || 0
      if (d.next_activity_at && Math.floor((Date.now()-new Date(d.next_activity_at).getTime())/86400000) >= rd) rottenDeals++
    })

    // Lost reasons
    const { data: lostDeals } = await supabase.from('deals').select('lost_reason').eq('stage', 'LOST').not('lost_reason', 'is', null)
    const reasonMap: Record<string, number> = {}
    ;(lostDeals||[]).forEach((d: any) => {
      const r = d.lost_reason?.trim()
      if (r) reasonMap[r] = (reasonMap[r]||0) + 1
    })
    const lostReasons = Object.entries(reasonMap).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([reason,count])=>({reason,count}))

    // Upcoming departures
    const in30 = new Date(); in30.setDate(in30.getDate()+30)
    const { data: upcoming } = await supabase.from('bookings')
      .select('id, booking_reference, departure_date, deals(title, clients(first_name, last_name))')
      .eq('status', 'CONFIRMED')
      .gte('departure_date', new Date().toISOString().split('T')[0])
      .lte('departure_date', in30.toISOString().split('T')[0])
      .order('departure_date', { ascending: true })
      .limit(5)

    setData({ confirmedRevenue, confirmedProfit, quotesThisMonth: quotesCount||0, leadsThisMonth: leadsCount||0, conversionRate, pipelineValue, expectedProfit, activeDeals: pipeline?.length||0, rottenDeals, yearRevenue, yearProfit, recentDeals: (pipeline||[]).slice(0,5), recentBookings, lostReasons, upcomingDepartures: upcoming||[] })
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh' }}>
      <div style={{ color:'var(--text-muted)', fontSize:'14px' }}>Loading dashboard…</div>
    </div>
  )

  const d = data!
  const t = target || { revenue_target:200000, profit_target_bronze:15000, profit_target_silver:20000, profit_target_gold:25000, quotes_target:25, leads_target:30, bonus_bronze:100, bonus_silver:150, bonus_gold:250, rotten_days:3 }
  const now = new Date()
  const monthName = now.toLocaleString('en-GB', { month:'long' })
  const year = now.getFullYear()

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.1em', color:'var(--text-muted)', marginBottom:'2px' }}>Good morning, Samir</div>
          <div className="page-title">{monthName} {year}</div>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <Link href="/reports"><button className="btn btn-secondary">📊 Full Reports</button></Link>
          <Link href="/pipeline"><button className="btn btn-cta">+ New Deal</button></Link>
        </div>
      </div>

      <div className="page-body" style={{ display:'flex', flexDirection:'column', gap:'18px' }}>

        {/* Profit tier hero */}
        <ProfitTier profit={d.confirmedProfit} bronze={t.profit_target_bronze} silver={t.profit_target_silver} gold={t.profit_target_gold} bonusBronze={t.bonus_bronze} bonusSilver={t.bonus_silver} bonusGold={t.bonus_gold}/>

        {/* Monthly scoreboard */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>

          <div className="card" style={{ padding:'18px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', marginBottom:'4px' }}>Revenue This Month</div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:'32px', fontWeight:'300', color:'var(--text-primary)' }}>{fmt(d.confirmedRevenue)}</div>
              <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>of {fmt(t.revenue_target)}</div>
            </div>
            <ProgressBar value={d.confirmedRevenue} max={t.revenue_target} color={d.confirmedRevenue>=t.revenue_target?'var(--green)':'var(--accent-mid)'}/>
            <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--text-muted)', marginTop:'5px' }}>
              <span>{pct(d.confirmedRevenue,t.revenue_target)}% of target</span>
              {d.confirmedRevenue>=t.revenue_target ? <span style={{ color:'var(--green)', fontWeight:'600' }}>✓ Target hit!</span> : <span>{fmt(t.revenue_target-d.confirmedRevenue)} to go</span>}
            </div>
          </div>

          <div className="card" style={{ padding:'18px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', marginBottom:'4px' }}>Confirmed Profit</div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:'32px', fontWeight:'300', color:'var(--gold)' }}>{fmt(d.confirmedProfit)}</div>
              <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>of {fmt(t.profit_target_gold)} gold tier</div>
            </div>
            <ProgressBar value={d.confirmedProfit} max={t.profit_target_gold} color={d.confirmedProfit>=t.profit_target_gold?'#f59e0b':d.confirmedProfit>=t.profit_target_silver?'#9e9e9e':d.confirmedProfit>=t.profit_target_bronze?'#cd7f32':'var(--accent-mid)'}/>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'5px' }}>
              + {fmt(d.expectedProfit)} expected from pipeline · {fmt(d.confirmedProfit+d.expectedProfit)} total potential
            </div>
          </div>

          <div className="card" style={{ padding:'18px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', marginBottom:'4px' }}>Quotes Sent</div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:'32px', fontWeight:'300', color:'var(--text-primary)' }}>{d.quotesThisMonth}</div>
              <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>of {t.quotes_target} target</div>
            </div>
            <ProgressBar value={d.quotesThisMonth} max={t.quotes_target} color={d.quotesThisMonth>=t.quotes_target?'var(--green)':'var(--blue)'}/>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'5px' }}>
              {pct(d.quotesThisMonth,t.quotes_target)}% of target · {Math.max(0,t.quotes_target-d.quotesThisMonth)} to go
            </div>
          </div>

          <div className="card" style={{ padding:'18px 20px' }}>
            <div style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:'var(--text-muted)', marginBottom:'4px' }}>New Leads</div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:'32px', fontWeight:'300', color:'var(--text-primary)' }}>{d.leadsThisMonth}</div>
              <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>of {t.leads_target} target</div>
            </div>
            <ProgressBar value={d.leadsThisMonth} max={t.leads_target} color={d.leadsThisMonth>=t.leads_target?'var(--green)':'var(--purple)'}/>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'5px' }}>
              {pct(d.leadsThisMonth,t.leads_target)}% · Conversion rate: <strong>{d.conversionRate}%</strong>
            </div>
          </div>
        </div>

        {/* Year to date */}
        <div className="card" style={{ padding:'18px 20px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Year to Date {year}</div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>Yearly profit target: <strong style={{ color:'var(--gold)' }}>£200,000</strong></div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'16px', marginBottom:'14px' }}>
            {[
              { label:'Revenue YTD',     val:fmt(d.yearRevenue),      sub:`${pct(d.yearRevenue,2400000)}% of annual run-rate`, color:'var(--text-primary)' },
              { label:'Profit YTD',      val:fmt(d.yearProfit),       sub:`${pct(d.yearProfit,200000)}% of £200k target`,      color:'var(--gold)' },
              { label:'Conversion Rate', val:`${d.conversionRate}%`,  sub:`${d.activeDeals} active deals in pipeline`,         color:'var(--green)' },
            ].map(s=>(
              <div key={s.label}>
                <div style={{ fontSize:'11px', fontWeight:'600', textTransform:'uppercase', letterSpacing:'0.07em', color:'var(--text-muted)', marginBottom:'4px' }}>{s.label}</div>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:'26px', fontWeight:'300', color:s.color, marginBottom:'2px' }}>{s.val}</div>
                <div style={{ fontSize:'11.5px', color:'var(--text-muted)' }}>{s.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'var(--text-muted)', marginBottom:'4px' }}>
            <span>Yearly profit progress</span><span>{fmt(d.yearProfit)} / £200,000</span>
          </div>
          <ProgressBar value={d.yearProfit} max={200000} color={d.yearProfit>=200000?'var(--green)':'var(--gold)'}/>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>

          {/* Pipeline */}
          <div className="card" style={{ padding:'18px 20px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Pipeline</div>
              <Link href="/pipeline" style={{ fontSize:'12px', color:'var(--accent-mid)', textDecoration:'none' }}>View all →</Link>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'8px', marginBottom:'14px' }}>
              {[
                { label:'Active', val:d.activeDeals,         color:'var(--text-primary)' },
                { label:'Value',  val:fmtK(d.pipelineValue), color:'var(--green)'        },
                { label:'Rotten', val:d.rottenDeals,         color:d.rottenDeals>0?'var(--red)':'var(--text-muted)' },
              ].map(s=>(
                <div key={s.label} style={{ textAlign:'center', padding:'10px', background:'var(--bg-tertiary)', borderRadius:'8px' }}>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:'22px', fontWeight:'300', color:s.color }}>{s.val}</div>
                  <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginTop:'2px' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {d.recentDeals.slice(0,4).map((deal: any) => {
              const isRotten = deal.next_activity_at && Math.floor((Date.now()-new Date(deal.next_activity_at).getTime())/86400000) >= (t.rotten_days||3)
              return (
                <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration:'none' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-primary)' }}>
                        {isRotten&&<span style={{ color:'var(--red)', marginRight:'4px' }}>●</span>}
                        {deal.title}
                      </div>
                      <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{deal.clients?.first_name} {deal.clients?.last_name}</div>
                    </div>
                    <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--green)' }}>{fmt(deal.deal_value||0)}</div>
                  </div>
                </Link>
              )
            })}
          </div>

          {/* Right column */}
          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

            {/* Upcoming departures */}
            <div className="card" style={{ padding:'18px 20px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' }}>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300' }}>Upcoming Departures</div>
                <Link href="/bookings" style={{ fontSize:'12px', color:'var(--accent-mid)', textDecoration:'none' }}>View all →</Link>
              </div>
              {d.upcomingDepartures.length===0 ? (
                <div style={{ fontSize:'13px', color:'var(--text-muted)', fontStyle:'italic' }}>No departures in next 30 days</div>
              ) : d.upcomingDepartures.map((b: any) => {
                const days = Math.ceil((new Date(b.departure_date).getTime()-Date.now())/86400000)
                return (
                  <div key={b.id} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize:'13px', fontWeight:'500', color:'var(--text-primary)' }}>{b.deals?.title}</div>
                      <div style={{ fontSize:'11px', color:'var(--text-muted)' }}>{b.booking_reference} · {b.deals?.clients?.first_name} {b.deals?.clients?.last_name}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontSize:'12px', fontWeight:'600', color:days<=7?'var(--red)':days<=14?'var(--amber)':'var(--text-secondary)' }}>✈ {days}d</div>
                      <div style={{ fontSize:'10.5px', color:'var(--text-muted)' }}>{new Date(b.departure_date+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Lost reasons */}
            {d.lostReasons.length>0&&(
              <div className="card" style={{ padding:'18px 20px' }}>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'12px' }}>Top Lost Reasons</div>
                {d.lostReasons.map((r,i)=>(
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                    <div style={{ flex:1, fontSize:'13px', color:'var(--text-secondary)', lineHeight:'1.4' }}>{r.reason}</div>
                    <div style={{ fontSize:'12px', fontWeight:'600', color:'var(--red)', background:'var(--red-light)', padding:'2px 8px', borderRadius:'10px', flexShrink:0 }}>{r.count}x</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
