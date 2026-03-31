'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
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

export default function ReportsPage() {
  const [monthlyData, setMonthlyData]   = useState<MonthData[]>([])
  const [lostReasons, setLostReasons]   = useState<LostReason[]>([])
  const [stageBreakdown, setStage]      = useState<{stage:string;count:number;value:number}[]>([])
  const [loading, setLoading]           = useState(true)
  const [editingTargets, setEditTargets] = useState(false)
  const [targets, setTargets]           = useState<any>(null)
  const [savingTargets, setSavingTargets] = useState(false)
  const [toast, setToast]               = useState<string|null>(null)
  const [selectedYear, setYear]         = useState(new Date().getFullYear())

  useEffect(() => { load() }, [selectedYear])

  async function load() {
    setLoading(true)

    // Monthly data for selected year
    const yearStart = new Date(selectedYear, 0, 1).toISOString()
    const yearEnd   = new Date(selectedYear, 11, 31, 23, 59, 59).toISOString()

    const { data: bookings } = await supabase.from('bookings')
      .select('id, created_at, deal_id, deals(deal_value, quotes(profit, sent_to_client, created_at))')
      .eq('status', 'CONFIRMED')
      .gte('created_at', yearStart)
      .lte('created_at', yearEnd)

    const { data: quotes } = await supabase.from('quotes')
      .select('id, created_at')
      .eq('sent_to_client', true)
      .gte('created_at', yearStart)
      .lte('created_at', yearEnd)

    const { data: leads } = await supabase.from('deals')
      .select('id, created_at')
      .gte('created_at', yearStart)
      .lte('created_at', yearEnd)

    // Build monthly breakdown
    const monthly: Record<number, MonthData> = {}
    for (let m = 1; m <= 12; m++) {
      monthly[m] = { month: m, year: selectedYear, revenue: 0, profit: 0, bookings: 0, quotes: 0, leads: 0 }
    }

    ;(bookings||[]).forEach((b: any) => {
      const m = new Date(b.created_at).getMonth() + 1
      const sentQuotes = (b.deals?.quotes||[]).filter((q:any)=>q.sent_to_client).sort((a:any,z:any)=>new Date(z.created_at).getTime()-new Date(a.created_at).getTime())
      const bestQuote  = sentQuotes[0] || (b.deals?.quotes||[])[0]
      monthly[m].revenue  += b.deals?.deal_value || 0
      monthly[m].profit   += bestQuote?.profit || 0
      monthly[m].bookings += 1
    })

    ;(quotes||[]).forEach((q: any) => { monthly[new Date(q.created_at).getMonth()+1].quotes++ })
    ;(leads||[]).forEach((l: any)  => { monthly[new Date(l.created_at).getMonth()+1].leads++   })

    setMonthlyData(Object.values(monthly))

    // Lost reasons
    const { data: lostDeals } = await supabase.from('deals').select('lost_reason').eq('stage', 'LOST').not('lost_reason', 'is', null)
    const reasonMap: Record<string,number> = {}
    ;(lostDeals||[]).forEach((d:any) => { const r=d.lost_reason?.trim(); if(r) reasonMap[r]=(reasonMap[r]||0)+1 })
    setLostReasons(Object.entries(reasonMap).sort((a,b)=>b[1]-a[1]).map(([reason,count])=>({reason,count})))

    // Stage breakdown
    const { data: allDeals } = await supabase.from('deals').select('stage, deal_value')
    const stageMap: Record<string,{count:number;value:number}> = {}
    ;(allDeals||[]).forEach((d:any) => {
      if (!stageMap[d.stage]) stageMap[d.stage] = { count:0, value:0 }
      stageMap[d.stage].count++
      stageMap[d.stage].value += d.deal_value||0
    })
    const stageOrder = ['NEW_LEAD','QUOTE_SENT','ENGAGED','FOLLOW_UP','DECISION_PENDING','BOOKED','LOST']
    const stageLabels: Record<string,string> = { NEW_LEAD:'New Lead', QUOTE_SENT:'Quote Sent', ENGAGED:'Engaged', FOLLOW_UP:'Follow Up', DECISION_PENDING:'Decision Pending', BOOKED:'Booked', LOST:'Lost' }
    setStage(stageOrder.filter(s=>stageMap[s]).map(s=>({ stage:stageLabels[s]||s, count:stageMap[s].count, value:stageMap[s].value })))

    // Targets
    const now = new Date()
    const { data: tData } = await supabase.from('targets').select('*').eq('month', now.getMonth()+1).eq('year', now.getFullYear()).single()
    setTargets(tData)

    setLoading(false)
  }

  async function saveTargets() {
    if (!targets) return
    setSavingTargets(true)
    const now = new Date()
    await supabase.from('targets').upsert({ ...targets, month: now.getMonth()+1, year: now.getFullYear() }, { onConflict: 'month,year' })
    setSavingTargets(false)
    setEditTargets(false)
    setToast('Targets updated ✓')
    setTimeout(() => setToast(null), 3000)
  }

  const totalRevenue = monthlyData.reduce((a,m)=>a+m.revenue, 0)
  const totalProfit  = monthlyData.reduce((a,m)=>a+m.profit, 0)
  const totalBookings = monthlyData.reduce((a,m)=>a+m.bookings, 0)
  const maxRevenue   = Math.max(...monthlyData.map(m=>m.revenue), 1)

  const STAGE_COLORS: Record<string,string> = {
    'New Lead':'#8b5cf6', 'Quote Sent':'#f59e0b', 'Engaged':'#3b82f6',
    'Follow Up':'#f97316', 'Decision Pending':'#ec4899', 'Booked':'#10b981', 'Lost':'#ef4444',
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Reports</div>
          <div style={{ fontSize:'12.5px', color:'var(--text-muted)', marginTop:'2px' }}>
            {selectedYear} · {totalBookings} bookings · {fmt(totalRevenue)} revenue · {fmt(totalProfit)} profit
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
                <input className="input" type="number" value={targets.revenue_target} onChange={e=>setTargets((p:any)=>({...p,revenue_target:Number(e.target.value)}))}/>
              </div>
              <div>
                <label className="label">Quotes Target</label>
                <input className="input" type="number" value={targets.quotes_target} onChange={e=>setTargets((p:any)=>({...p,quotes_target:Number(e.target.value)}))}/>
              </div>
              <div>
                <label className="label">Leads Target</label>
                <input className="input" type="number" value={targets.leads_target} onChange={e=>setTargets((p:any)=>({...p,leads_target:Number(e.target.value)}))}/>
              </div>
              <div>
                <label className="label">Rotten Deal Threshold (days)</label>
                <input className="input" type="number" value={targets.rotten_days||3} onChange={e=>setTargets((p:any)=>({...p,rotten_days:Number(e.target.value)}))}/>
              </div>
            </div>
            <div style={{ marginTop:'16px', padding:'14px', background:'var(--bg-tertiary)', borderRadius:'10px' }}>
              <div style={{ fontSize:'12px', fontWeight:'700', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:'12px' }}>Profit Bonus Tiers</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
                {[
                  { key:'profit_target_bronze', bonus_key:'bonus_bronze', label:'🥉 Bronze', color:'#cd7f32' },
                  { key:'profit_target_silver', bonus_key:'bonus_silver', label:'🥈 Silver', color:'#9e9e9e' },
                  { key:'profit_target_gold',   bonus_key:'bonus_gold',   label:'🥇 Gold',   color:'#f59e0b' },
                ].map(tier=>(
                  <div key={tier.key}>
                    <label className="label" style={{ color:tier.color }}>{tier.label}</label>
                    <input className="input" type="number" placeholder="Profit target" value={targets[tier.key]} onChange={e=>setTargets((p:any)=>({...p,[tier.key]:Number(e.target.value)}))} style={{ marginBottom:'6px' }}/>
                    <input className="input" type="number" placeholder="Bonus (£)" value={targets[tier.bonus_key]} onChange={e=>setTargets((p:any)=>({...p,[tier.bonus_key]:Number(e.target.value)}))}/>
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
