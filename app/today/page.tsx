'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type Action = {
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

const fmt = (n:number) => '£'+(n||0).toLocaleString('en-GB',{maximumFractionDigits:0})

function priorityScore(deal_value:number, days_overdue:number, stage:string): number {
  const valueScore   = Math.min(deal_value/1000, 50)
  const urgencyScore = Math.min(days_overdue*10, 100)
  const stageScore   = STAGE_WEIGHT[stage]||0
  return Math.round(valueScore + urgencyScore + stageScore)
}

function priorityLabel(score:number): { label:string; color:string; bg:string } {
  if (score >= 100) return { label:'🔴 Critical', color:'var(--red)',   bg:'var(--red-light)'   }
  if (score >= 50)  return { label:'🟠 High',     color:'var(--amber)', bg:'var(--amber-light)' }
  if (score >= 20)  return { label:'🟡 Medium',   color:'var(--gold)',  bg:'var(--gold-light)'  }
  return                   { label:'🟢 Normal',   color:'var(--green)', bg:'var(--green-light)' }
}

function buildWhatsApp(phone:string, clientName:string, actType:string|null, dealTitle:string): string {
  const first = clientName.split(' ')[0]
  const messages: Record<string,string> = {
    CALL:      `Hi ${first}, I tried calling you regarding your Mauritius holiday. Please give me a call when you get a chance — 020 8951 6922. Samir`,
    WHATSAPP:  `Hi ${first}, just following up on your Mauritius holiday quote. Happy to answer any questions — just reply here. Samir`,
    FOLLOW_UP: `Hi ${first}, wanted to check in on the Mauritius quote I sent over. Have you had a chance to review it? Samir`,
    EMAIL:     `Hi ${first}, just a quick follow up on your Mauritius holiday enquiry. Let me know if you have any questions. Samir`,
    default:   `Hi ${first}, following up on your Mauritius holiday — ${dealTitle}. Let me know if you have any questions. Samir`,
  }
  const msg = messages[actType||'default'] || messages.default
  const clean = phone.replace(/\D/g,'')
  return `https://wa.me/${clean}?text=${encodeURIComponent(msg)}`
}

function buildMailto(email:string, clientName:string, actType:string|null, dealTitle:string): string {
  const first = clientName.split(' ')[0]
  const subjects: Record<string,string> = {
    FOLLOW_UP: `Following up — Your Mauritius Holiday Quote`,
    EMAIL:     `Your Mauritius Holiday — ${dealTitle}`,
    default:   `Your Mauritius Holiday Enquiry`,
  }
  const bodies: Record<string,string> = {
    FOLLOW_UP: `Dear ${first},\n\nI hope you're well. I wanted to follow up on the Mauritius holiday quote I sent over and see if you had any questions or if there's anything you'd like me to adjust.\n\nPlease don't hesitate to call me on 020 8951 6922 or reply to this email.\n\nWarm regards,\nSamir Abattouy\nMauritius Holidays Direct\n020 8951 6922`,
    EMAIL:     `Dear ${first},\n\nI wanted to reach out regarding your Mauritius holiday enquiry.\n\nWarm regards,\nSamir Abattouy\nMauritius Holidays Direct\n020 8951 6922`,
    default:   `Dear ${first},\n\nFollowing up on your Mauritius holiday enquiry.\n\nWarm regards,\nSamir Abattouy\nMauritius Holidays Direct\n020 8951 6922`,
  }
  const subject = encodeURIComponent(subjects[actType||'default'] || subjects.default)
  const body    = encodeURIComponent(bodies[actType||'default']    || bodies.default)
  return `mailto:${email}?subject=${subject}&body=${body}`
}

export default function TodayPage() {
  const [actions, setActions]     = useState<Action[]>([])
  const [upcoming, setUpcoming]   = useState<Action[]>([])
  const [loading, setLoading]     = useState(true)
  const [completing, setCompleting] = useState<number|null>(null)
  const [snoozing, setSnoozing]   = useState<number|null>(null)
  const [toast, setToast]         = useState<string|null>(null)
  const [copied, setCopied]       = useState<number|null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const now       = new Date()
    const todayEnd  = new Date(now); todayEnd.setHours(23,59,59,999)
    const weekAhead = new Date(now.getTime()+7*86400000).toISOString()

    const { data } = await supabase.from('deals')
      .select('id,title,stage,deal_value,next_activity_at,next_activity_type,clients(first_name,last_name,phone,email)')
      .not('stage','in','("BOOKED","LOST")')
      .not('next_activity_at','is',null)
      .order('next_activity_at',{ascending:true})

    const overdueDue: Action[] = []
    const upcomingList: Action[] = []

    ;(data||[]).forEach((d:any) => {
      const daysOverdue = Math.floor((now.getTime()-new Date(d.next_activity_at).getTime())/86400000)
      const score = priorityScore(d.deal_value||0, daysOverdue, d.stage)
      const item = { ...d, days_overdue: daysOverdue, priority_score: score }
      if (new Date(d.next_activity_at) <= todayEnd) overdueDue.push(item)
      else if (new Date(d.next_activity_at) <= new Date(weekAhead)) upcomingList.push(item)
    })

    // Sort by priority score descending
    overdueDue.sort((a,b) => b.priority_score - a.priority_score)
    upcomingList.sort((a,b) => new Date(a.next_activity_at).getTime()-new Date(b.next_activity_at).getTime())

    setActions(overdueDue)
    setUpcoming(upcomingList)
    setLoading(false)
  }

  async function markComplete(deal: Action) {
    setCompleting(deal.id)
    await supabase.from('deals').update({ next_activity_at:null, next_activity_type:null }).eq('id',deal.id)
    await supabase.from('activities').insert({ deal_id:deal.id, activity_type:deal.next_activity_type||'NOTE', notes:`Action completed — ${STAGE_LABELS[deal.stage]||deal.stage}` })
    showToast('✓ Action completed')
    setCompleting(null)
    load()
  }

  async function snooze(deal: Action, days: number) {
    setSnoozing(deal.id)
    const newDate = new Date()
    newDate.setDate(newDate.getDate()+days)
    newDate.setHours(9,0,0,0)
    await supabase.from('deals').update({ next_activity_at:newDate.toISOString() }).eq('id',deal.id)
    showToast(`Snoozed ${days} day${days>1?'s':''}`)
    setSnoozing(null)
    load()
  }

  function copyPhone(phone:string, id:number) {
    navigator.clipboard.writeText(phone)
    setCopied(id)
    setTimeout(()=>setCopied(null), 2000)
  }

  function showToast(msg:string) {
    setToast(msg)
    setTimeout(()=>setToast(null), 2800)
  }

  const today = new Date().toLocaleDateString('en-GB',{weekday:'long',day:'numeric',month:'long'})

  return (
    <div>
      <div className="page-header">
        <div>
          <div style={{fontSize:'11px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.1em',color:'var(--text-muted)',marginBottom:'2px'}}>{today}</div>
          <div className="page-title">Today's Actions</div>
        </div>
        <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
          {actions.length>0&&<span style={{fontSize:'13px',color:'var(--red)',fontWeight:'600'}}>{actions.length} action{actions.length!==1?'s':''} due</span>}
          <Link href="/pipeline"><button className="btn btn-secondary btn-sm">Pipeline →</button></Link>
        </div>
      </div>

      <div className="page-body">
        {loading ? (
          <div style={{color:'var(--text-muted)',fontSize:'13px'}}>Loading…</div>
        ) : actions.length===0 && upcoming.length===0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">✓</div>
            <div className="empty-state-title">All clear</div>
            <div className="empty-state-desc">No actions due today or this week. Set next actions on your deals to stay on top of follow-ups.</div>
            <Link href="/pipeline"><button className="btn btn-cta" style={{marginTop:'16px'}}>Open Pipeline →</button></Link>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:'20px'}}>

            {/* Due now */}
            {actions.length>0&&(
              <div>
                <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'19px',fontWeight:'300'}}>Due Now</div>
                  <div style={{background:'var(--red)',color:'white',borderRadius:'20px',padding:'2px 10px',fontSize:'12px',fontWeight:'700'}}>{actions.length}</div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                  {actions.map(deal => {
                    const client    = deal.clients
                    const clientName= client?`${client.first_name} ${client.last_name}`:'Unknown'
                    const priority  = priorityLabel(deal.priority_score)
                    const stageCol  = STAGE_COLORS[deal.stage]||'var(--accent)'
                    const isDueToday = deal.days_overdue === 0
                    const isOverdue  = deal.days_overdue > 0

                    return (
                      <div key={deal.id} className="card" style={{overflow:'hidden',borderLeft:`3px solid ${stageCol}`}}>
                        <div style={{padding:'14px 18px'}}>
                          {/* Header row */}
                          <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                            <div style={{flex:1}}>
                              <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px',flexWrap:'wrap'}}>
                                <span style={{fontSize:'11px',fontWeight:'700',padding:'2px 8px',borderRadius:'4px',background:priority.bg,color:priority.color}}>{priority.label}</span>
                                <span style={{fontSize:'11px',fontWeight:'600',color:stageCol,background:`${stageCol}18`,padding:'2px 8px',borderRadius:'4px'}}>{STAGE_LABELS[deal.stage]||deal.stage}</span>
                                {deal.next_activity_type&&<span style={{fontSize:'11px',color:'var(--text-muted)'}}>{ACT_ICONS[deal.next_activity_type]} {deal.next_activity_type.charAt(0)+deal.next_activity_type.slice(1).toLowerCase().replace('_',' ')}</span>}
                                {isOverdue&&<span style={{fontSize:'11px',color:'var(--red)',fontWeight:'600'}}>⚠ {deal.days_overdue}d overdue</span>}
                                {isDueToday&&<span style={{fontSize:'11px',color:'var(--amber)',fontWeight:'600'}}>Due today</span>}
                              </div>
                              <Link href={`/deals/${deal.id}`} style={{textDecoration:'none'}}>
                                <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',color:'var(--text-primary)',marginBottom:'2px'}}>{deal.title}</div>
                              </Link>
                              <div style={{fontSize:'12.5px',color:'var(--text-muted)'}}>{clientName}{deal.deal_value?` · ${fmt(deal.deal_value)}`:''}</div>
                            </div>
                            <div style={{textAlign:'right',marginLeft:'12px',flexShrink:0}}>
                              <div style={{fontSize:'11px',color:'var(--text-muted)',marginBottom:'4px'}}>Priority score</div>
                              <div style={{fontFamily:'Fraunces,serif',fontSize:'22px',fontWeight:'300',color:priority.color}}>{deal.priority_score}</div>
                            </div>
                          </div>

                          {/* Quick actions */}
                          <div style={{display:'flex',gap:'6px',flexWrap:'wrap',paddingTop:'10px',borderTop:'1px solid var(--border)'}}>
                            {client?.phone&&(
                              <>
                                <button onClick={()=>copyPhone(client.phone!,deal.id)}
                                  style={{padding:'6px 12px',borderRadius:'7px',border:'1.5px solid var(--border)',background:copied===deal.id?'var(--green-light)':'transparent',color:copied===deal.id?'var(--green)':'var(--text-secondary)',fontSize:'12px',cursor:'pointer',fontFamily:'Outfit,sans-serif',transition:'all 0.15s'}}>
                                  {copied===deal.id?'✓ Copied':' 📋 Copy Number'}
                                </button>
                                <a href={buildWhatsApp(client.phone,clientName,deal.next_activity_type,deal.title)} target="_blank"
                                  style={{padding:'6px 12px',borderRadius:'7px',border:'1.5px solid #25d366',background:'#e8f9ef',color:'#1a9e52',fontSize:'12px',cursor:'pointer',fontFamily:'Outfit,sans-serif',textDecoration:'none',display:'inline-flex',alignItems:'center'}}>
                                  💬 WhatsApp
                                </a>
                              </>
                            )}
                            {client?.email&&(
                              <a href={buildMailto(client.email,clientName,deal.next_activity_type,deal.title)}
                                style={{padding:'6px 12px',borderRadius:'7px',border:'1.5px solid var(--border)',background:'transparent',color:'var(--text-secondary)',fontSize:'12px',cursor:'pointer',fontFamily:'Outfit,sans-serif',textDecoration:'none',display:'inline-flex',alignItems:'center'}}>
                                📧 Email
                              </a>
                            )}
                            <div style={{flex:1}}/>
                            {/* Snooze */}
                            <div style={{display:'flex',gap:'4px'}}>
                              {[1,3,7].map(d=>(
                                <button key={d} onClick={()=>snooze(deal,d)} disabled={snoozing===deal.id}
                                  style={{padding:'5px 10px',borderRadius:'6px',border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>
                                  +{d}d
                                </button>
                              ))}
                            </div>
                            <button onClick={()=>markComplete(deal)} disabled={completing===deal.id}
                              style={{padding:'6px 14px',borderRadius:'7px',border:'none',background:'var(--green)',color:'white',fontSize:'12px',cursor:'pointer',fontFamily:'Outfit,sans-serif',fontWeight:'600'}}>
                              {completing===deal.id?'…':'✓ Done'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Upcoming this week */}
            {upcoming.length>0&&(
              <div>
                <div style={{fontFamily:'Fraunces,serif',fontSize:'19px',fontWeight:'300',marginBottom:'12px'}}>This Week</div>
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  {upcoming.map(deal=>{
                    const client    = deal.clients
                    const clientName= client?`${client.first_name} ${client.last_name}`:'Unknown'
                    const stageCol  = STAGE_COLORS[deal.stage]||'var(--accent)'
                    const dueDate   = new Date(deal.next_activity_at).toLocaleDateString('en-GB',{weekday:'short',day:'numeric',month:'short'})
                    return(
                      <div key={deal.id} className="card" style={{padding:'12px 16px',borderLeft:`3px solid ${stageCol}`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                        <div style={{flex:1}}>
                          <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'2px'}}>
                            {deal.next_activity_type&&<span style={{fontSize:'12px'}}>{ACT_ICONS[deal.next_activity_type]}</span>}
                            <Link href={`/deals/${deal.id}`} style={{textDecoration:'none'}}>
                              <span style={{fontSize:'13.5px',fontWeight:'500',color:'var(--text-primary)'}}>{deal.title}</span>
                            </Link>
                            <span style={{fontSize:'11px',color:stageCol,fontWeight:'600',background:`${stageCol}18`,padding:'1px 7px',borderRadius:'4px'}}>{STAGE_LABELS[deal.stage]||deal.stage}</span>
                          </div>
                          <div style={{fontSize:'12px',color:'var(--text-muted)'}}>{clientName}{deal.deal_value?` · ${fmt(deal.deal_value)}`:''}</div>
                        </div>
                        <div style={{display:'flex',gap:'6px',alignItems:'center',marginLeft:'12px',flexShrink:0}}>
                          <span style={{fontSize:'12px',color:'var(--text-muted)',fontWeight:'500'}}>{dueDate}</span>
                          {client?.phone&&(
                            <a href={buildWhatsApp(client.phone,clientName,deal.next_activity_type,deal.title)} target="_blank"
                              style={{padding:'4px 10px',borderRadius:'6px',border:'1.5px solid #25d366',background:'#e8f9ef',color:'#1a9e52',fontSize:'11.5px',cursor:'pointer',fontFamily:'Outfit,sans-serif',textDecoration:'none'}}>
                              💬
                            </a>
                          )}
                          {client?.email&&(
                            <a href={buildMailto(client.email,clientName,deal.next_activity_type,deal.title)}
                              style={{padding:'4px 10px',borderRadius:'6px',border:'1.5px solid var(--border)',background:'transparent',color:'var(--text-secondary)',fontSize:'11.5px',cursor:'pointer',fontFamily:'Outfit,sans-serif',textDecoration:'none'}}>
                              📧
                            </a>
                          )}
                          <Link href={`/deals/${deal.id}`}>
                            <button style={{padding:'4px 10px',borderRadius:'6px',border:'1.5px solid var(--border)',background:'transparent',color:'var(--text-secondary)',fontSize:'11.5px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>Open →</button>
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

      {toast&&<div className="toast success">{toast}</div>}
    </div>
  )
}
