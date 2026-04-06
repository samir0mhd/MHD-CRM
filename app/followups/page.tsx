'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

type FollowUp = {
  id: number
  deal_id: number
  sequence_day: number
  status: 'pending' | 'sent' | 'skipped'
  scheduled_for: string
  sent_at: string | null
  email_subject: string | null
  email_body: string | null
  created_at: string
  deals?: {
    id: number
    title: string
    stage: string
    clients?: { first_name: string; last_name: string; email: string }
  }
}

const DAY_LABELS: Record<number, string> = {
  2:  'Day 2 — First Follow-up',
  5:  'Day 5 — Second Follow-up',
  10: 'Day 10 — Final Chase',
}

const DAY_COLORS: Record<number, string> = {
  2:  '#3b82f6',
  5:  '#f59e0b',
  10: '#ef4444',
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'var(--amber)',
  sent:    'var(--green)',
  skipped: 'var(--text-muted)',
}

// ── DEFAULT EMAIL BODIES ──────────────────────────────────
function defaultSubject(day: number, dealTitle: string): string {
  const subjects: Record<number, string> = {
    2:  `Following up — Your Mauritius Holiday Quote`,
    5:  `Still Available — Your Mauritius Quote`,
    10: `Last Chance — Your Mauritius Holiday`,
  }
  return subjects[day] || `Following up — ${dealTitle}`
}

function defaultBody(day: number, clientName: string): string {
  const first = clientName.split(' ')[0]
  if (day === 2) return `
<p>Dear ${first},</p>
<p>I hope you've had a chance to review the Mauritius holiday quote I sent over. I wanted to follow up and see if you had any questions or if there's anything you'd like me to adjust.</p>
<p>As I mentioned, availability at this time of year moves quickly — I'd be happy to hold the current pricing for a little longer while you decide.</p>
<p>Please don't hesitate to call me directly on <strong>020 8951 6922</strong> or WhatsApp me on <strong>07881 551204</strong> — I'm always happy to talk through the details.</p>
<p>Warm regards,<br><strong>Samir Abattouy</strong><br>Mauritius Expert · Mauritius Holidays Direct<br>020 8951 6922 · samir@mauritiusholidaysdirect.co.uk</p>
<p style="font-size:11px;color:#888">ABTA · IATA · ATOL Protected 5744</p>
`.trim()

  if (day === 5) return `
<p>Dear ${first},</p>
<p>I wanted to reach out once more regarding your Mauritius holiday quote. I understand that planning a holiday is a big decision, and I want to make sure you have all the information you need.</p>
<p>I've been monitoring availability and the dates you're looking at are still available — but I wouldn't want you to miss out. A 10% deposit is all it takes to secure your holiday today.</p>
<p>If the quote needs any adjustments — different hotel, different dates, or a different budget — just say the word and I'll put something new together for you.</p>
<p>Call me on <strong>020 8951 6922</strong> or schedule a call at your convenience: <a href="https://calendly.com/mauritiusexpert">calendly.com/mauritiusexpert</a></p>
<p>Warm regards,<br><strong>Samir Abattouy</strong><br>Mauritius Expert · Mauritius Holidays Direct<br>020 8951 6922 · samir@mauritiusholidaysdirect.co.uk</p>
<p style="font-size:11px;color:#888">ABTA · IATA · ATOL Protected 5744</p>
`.trim()

  if (day === 10) return `
<p>Dear ${first},</p>
<p>I've been trying to reach you regarding your Mauritius holiday quote and I wanted to send one final message before I close off this enquiry.</p>
<p>If your plans have changed or you've decided to go elsewhere, that's completely fine — I just want to make sure you haven't been left waiting. If you're still interested, I'm here and ready to help.</p>
<p>Sometimes the timing just isn't right — and if that's the case, please keep my details. When you're ready to plan your Mauritius holiday, I'll be here.</p>
<p>With warm regards,<br><strong>Samir Abattouy</strong><br>Mauritius Expert · Mauritius Holidays Direct<br>020 8951 6922 · samir@mauritiusholidaysdirect.co.uk</p>
<p style="font-size:11px;color:#888">ABTA · IATA · ATOL Protected 5744</p>
`.trim()

  return `<p>Dear ${first},</p><p>Following up on your Mauritius holiday quote.</p><p>Warm regards,<br>Samir Abattouy</p>`
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isOverdue(d: string) {
  return new Date(d) < new Date()
}

function isDueToday(d: string) {
  const today = new Date(); today.setHours(0,0,0,0)
  const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate()+1)
  const date = new Date(d)
  return date >= today && date < tomorrow
}

export default function FollowUpPage() {
  const [followUps, setFollowUps]     = useState<FollowUp[]>([])
  const [loading, setLoading]         = useState(true)
  const [filter, setFilter]           = useState<'due'|'all'|'sent'|'skipped'>('due')
  const [sendingId, setSendingId]     = useState<number|null>(null)
  const [editingId, setEditingId]     = useState<number|null>(null)
  const [editSubject, setEditSubject] = useState('')
  const [editBody, setEditBody]       = useState('')
  const [toast, setToast]             = useState<{msg:string;type:'success'|'error'}|null>(null)
  const toastTimer                    = useRef<ReturnType<typeof setTimeout> | null>(null)

  async function load() {
    setLoading(true)
    const response = await fetch('/api/followups')
    if (response.ok) {
      const data = await response.json()
      setFollowUps(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    const timeoutId = setTimeout(() => { void load() }, 0)
    return () => clearTimeout(timeoutId)
  }, [])

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3500)
  }

  function openEdit(fu: FollowUp) {
    const client = fu.deals?.clients
    const clientName = client ? `${client.first_name} ${client.last_name}` : 'Valued Client'
    setEditSubject(fu.email_subject || defaultSubject(fu.sequence_day, fu.deals?.title||''))
    setEditBody(fu.email_body || defaultBody(fu.sequence_day, clientName))
    setEditingId(fu.id)
  }

  async function saveEdit() {
    if (!editingId) return
    await fetch(`/api/followups/${editingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_subject: editSubject, email_body: editBody }),
    })
    setEditingId(null)
    showToast('Email saved ✓')
    load()
  }

  async function sendEmail(fu: FollowUp) {
    const client = fu.deals?.clients
    if (!client?.email) { showToast('No email address for this client', 'error'); return }

    setSendingId(fu.id)
    const clientName = `${client.first_name} ${client.last_name}`
    const subject = fu.email_subject || defaultSubject(fu.sequence_day, fu.deals?.title||'')
    const body    = fu.email_body    || defaultBody(fu.sequence_day, clientName)

    try {
      const res = await fetch('/api/send-followup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ follow_up_id: fu.id, to: client.email, subject, body, deal_id: fu.deal_id, sequence_day: fu.sequence_day }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      showToast(`✓ Follow-up sent to ${client.email}`)
      load()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      showToast('Failed to send: '+message, 'error')
    }
    setSendingId(null)
  }

  async function skipFollowUp(id: number) {
    await fetch(`/api/followups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'skip' }),
    })
    showToast('Follow-up skipped')
    load()
  }

  async function resetToPending(id: number) {
    await fetch(`/api/followups/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reset' }),
    })
    showToast('Reset to pending')
    load()
  }

  // Filter
  const filtered = followUps.filter(fu => {
    if (filter === 'due')     return fu.status === 'pending' && (isOverdue(fu.scheduled_for) || isDueToday(fu.scheduled_for))
    if (filter === 'all')     return fu.status === 'pending'
    if (filter === 'sent')    return fu.status === 'sent'
    if (filter === 'skipped') return fu.status === 'skipped'
    return true
  })

  const dueTodayCount  = followUps.filter(fu => fu.status==='pending' && (isDueToday(fu.scheduled_for)||isOverdue(fu.scheduled_for))).length
  const pendingCount   = followUps.filter(fu => fu.status==='pending').length
  const sentCount      = followUps.filter(fu => fu.status==='sent').length

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Follow-up Sequences</div>
          <div style={{ fontSize:'12.5px', color:'var(--text-muted)', marginTop:'2px' }}>
            {dueTodayCount > 0
              ? <span style={{ color:'var(--red)', fontWeight:'600' }}>⚡ {dueTodayCount} due today</span>
              : <span>{pendingCount} pending · {sentCount} sent</span>}
          </div>
        </div>
      </div>

      <div className="page-body">
        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px', marginBottom:'24px' }}>
          {[
            { label:'Due Today',  val:dueTodayCount,                                           color:'var(--red)'   },
            { label:'Pending',    val:followUps.filter(f=>f.status==='pending').length,        color:'var(--amber)' },
            { label:'Sent',       val:sentCount,                                               color:'var(--green)' },
            { label:'Skipped',    val:followUps.filter(f=>f.status==='skipped').length,        color:'var(--text-muted)' },
          ].map(s=>(
            <div key={s.label} className="stat-card">
              <div className="stat-label">{s.label}</div>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:'32px', fontWeight:'300', color:s.color, lineHeight:1, marginTop:'4px' }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Filter tabs */}
        <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:'20px' }}>
          {([
            { key:'due',     label:`Due Now (${dueTodayCount})`  },
            { key:'all',     label:`All Pending (${pendingCount})` },
            { key:'sent',    label:`Sent (${sentCount})`          },
            { key:'skipped', label:'Skipped'                      },
          ] as const).map(t=>(
            <button key={t.key} onClick={()=>setFilter(t.key)}
              style={{ padding:'10px 18px', border:'none', background:'transparent', fontSize:'13.5px', cursor:'pointer',
                color: filter===t.key ? 'var(--accent-mid)' : 'var(--text-muted)',
                fontWeight: filter===t.key ? '500' : '400',
                borderBottom: filter===t.key ? '2px solid var(--accent-mid)' : '2px solid transparent',
                marginBottom:'-1px', fontFamily:'Outfit,sans-serif' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ color:'var(--text-muted)', fontSize:'13px' }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">✉</div>
            <div className="empty-state-title">
              {filter==='due' ? 'Nothing due right now' : `No ${filter} follow-ups`}
            </div>
            <div className="empty-state-desc">
              {filter==='due' ? 'Follow-ups are created automatically when a quote is marked as sent.' : ''}
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {filtered.map(fu => {
              const client     = fu.deals?.clients
              const clientName = client ? `${client.first_name} ${client.last_name}` : 'Unknown'
              const col        = DAY_COLORS[fu.sequence_day] || 'var(--accent)'
              const overdue    = fu.status==='pending' && isOverdue(fu.scheduled_for) && !isDueToday(fu.scheduled_for)
              const dueToday   = isDueToday(fu.scheduled_for)
              const isEditing  = editingId === fu.id

              return (
                <div key={fu.id} className="card" style={{ overflow:'hidden', borderLeft:`3px solid ${fu.status==='sent'?'var(--green)':fu.status==='skipped'?'var(--border)':col}` }}>
                  <div style={{ padding:'16px 20px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'4px' }}>
                          <span style={{ fontSize:'11px', fontWeight:'700', textTransform:'uppercase', letterSpacing:'0.08em', color:col, background:`${col}18`, padding:'2px 8px', borderRadius:'4px' }}>
                            {DAY_LABELS[fu.sequence_day] || `Day ${fu.sequence_day}`}
                          </span>
                          {dueToday && fu.status==='pending' && (
                            <span style={{ fontSize:'11px', fontWeight:'700', color:'var(--red)', background:'var(--red-light)', padding:'2px 8px', borderRadius:'4px' }}>⚡ Due Today</span>
                          )}
                          {overdue && (
                            <span style={{ fontSize:'11px', fontWeight:'700', color:'var(--red)', background:'var(--red-light)', padding:'2px 8px', borderRadius:'4px' }}>⚠ Overdue</span>
                          )}
                          <span style={{ fontSize:'11px', color:STATUS_COLORS[fu.status], fontWeight:'600', textTransform:'capitalize' }}>
                            {fu.status==='sent' ? `✓ Sent ${fu.sent_at ? fmtDate(fu.sent_at) : ''}` : fu.status}
                          </span>
                        </div>
                        <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', color:'var(--text-primary)', marginBottom:'2px' }}>
                          <Link href={`/deals/${fu.deal_id}`} style={{ textDecoration:'none', color:'inherit' }}>{fu.deals?.title || '—'}</Link>
                        </div>
                        <div style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>
                          {clientName}
                          {client?.email && <span style={{ marginLeft:'8px', color:'var(--text-muted)' }}>· {client.email}</span>}
                          <span style={{ marginLeft:'8px' }}>· Scheduled {fmtDate(fu.scheduled_for)}</span>
                        </div>
                      </div>

                      {/* Actions */}
                      {fu.status === 'pending' && (
                        <div style={{ display:'flex', gap:'6px', flexShrink:0, marginLeft:'16px' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => openEdit(fu)}>✏ Edit</button>
                          <button className="btn btn-ghost btn-sm" onClick={() => skipFollowUp(fu.id)}>Skip</button>
                          <button className="btn btn-cta btn-sm" onClick={() => sendEmail(fu)} disabled={sendingId===fu.id}>
                            {sendingId===fu.id ? 'Sending…' : '✉ Send'}
                          </button>
                        </div>
                      )}
                      {fu.status === 'skipped' && (
                        <button className="btn btn-ghost btn-sm" onClick={() => resetToPending(fu.id)}>↩ Restore</button>
                      )}
                      {fu.status === 'sent' && (
                        <div style={{ display:'flex', gap:'6px' }}>
                          <Link href={`/deals/${fu.deal_id}`}>
                            <button className="btn btn-ghost btn-sm">View Deal →</button>
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Email preview / edit */}
                    {isEditing && (
                      <div style={{ marginTop:'14px', padding:'14px', background:'var(--bg-tertiary)', borderRadius:'10px', borderTop:'1px solid var(--border)' }}>
                        <div style={{ marginBottom:'10px' }}>
                          <label className="label">Subject Line</label>
                          <input className="input" value={editSubject} onChange={e=>setEditSubject(e.target.value)}/>
                        </div>
                        <div style={{ marginBottom:'12px' }}>
                          <label className="label">Email Body <span style={{ fontWeight:'400', textTransform:'none', letterSpacing:'0', fontSize:'11px' }}>(HTML supported)</span></label>
                          <textarea className="input" style={{ minHeight:'200px', resize:'vertical', fontFamily:'monospace', fontSize:'12.5px', lineHeight:'1.6' }}
                            value={editBody} onChange={e=>setEditBody(e.target.value)}/>
                        </div>
                        {/* Preview */}
                        <div style={{ marginBottom:'12px' }}>
                          <div style={{ fontSize:'11px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>Preview</div>
                          <div style={{ background:'white', border:'1px solid var(--border)', borderRadius:'8px', padding:'16px 20px', fontSize:'13px', lineHeight:'1.7', color:'#333', fontFamily:'Arial,sans-serif', maxHeight:'240px', overflowY:'auto' }}
                            dangerouslySetInnerHTML={{ __html: editBody }}/>
                        </div>
                        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                          <button className="btn btn-secondary btn-sm" onClick={saveEdit}>Save Draft</button>
                          <button className="btn btn-cta btn-sm" onClick={async () => { await saveEdit(); await sendEmail({...fu, email_subject:editSubject, email_body:editBody}) }}>
                            Save & Send
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Show saved subject if not editing */}
                    {!isEditing && fu.email_subject && fu.status==='pending' && (
                      <div style={{ marginTop:'8px', fontSize:'12px', color:'var(--text-muted)', fontStyle:'italic' }}>
                        Subject: {fu.email_subject}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
