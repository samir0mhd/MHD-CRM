'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

type DealWithClient = {
  id: number
  title: string
  stage: string
  deal_value: number
  next_activity_at: string
  next_activity_type: string
  clients?: { first_name: string; last_name: string; phone?: string; email?: string }
}

const STAGE_COLORS: Record<string, string> = {
  NEW_LEAD: '#8b5cf6', QUOTE_SENT: '#f59e0b', ENGAGED: '#3b82f6',
  FOLLOW_UP: '#f97316', DECISION_PENDING: '#ec4899', BOOKED: '#10b981', LOST: '#ef4444',
}

const STAGE_LABELS: Record<string, string> = {
  NEW_LEAD: 'New Lead', QUOTE_SENT: 'Quote Sent', ENGAGED: 'Engaged',
  FOLLOW_UP: 'Follow Up', DECISION_PENDING: 'Decision Pending', BOOKED: 'Booked', LOST: 'Lost',
}

function fmt(n: number) {
  return '£' + (n || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })
}

function daysDiff(date: string) {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86400000)
}

export default function TodayPage() {
  const [overdue, setOverdue]     = useState<DealWithClient[]>([])
  const [dueToday, setDueToday]   = useState<DealWithClient[]>([])
  const [upcoming, setUpcoming]   = useState<DealWithClient[]>([])
  const [loading, setLoading]     = useState(true)
  const [toast, setToast]         = useState<string | null>(null)
  const [completing, setCompleting] = useState<number | null>(null)

  useEffect(() => { loadActions() }, [])

  async function loadActions() {
    setLoading(true)
    const today     = new Date()
    const todayStr  = today.toISOString().split('T')[0]
    const weekAhead = new Date(today.getTime() + 7 * 86400000).toISOString()

    const { data } = await supabase
      .from('deals')
      .select('id, title, stage, deal_value, next_activity_at, next_activity_type, clients(first_name, last_name, phone, email)')
      .not('stage', 'in', '("BOOKED","LOST")')
      .not('next_activity_at', 'is', null)
      .order('next_activity_at', { ascending: true })

    const deals = data || []
    const now = new Date()

    setOverdue(deals.filter(d => new Date(d.next_activity_at) < now && !isSameDay(d.next_activity_at, todayStr)))
    setDueToday(deals.filter(d => isSameDay(d.next_activity_at, todayStr)))
    setUpcoming(deals.filter(d => new Date(d.next_activity_at) > now && !isSameDay(d.next_activity_at, todayStr) && new Date(d.next_activity_at) <= new Date(weekAhead)))
    setLoading(false)
  }

  function isSameDay(dateStr: string, todayStr: string) {
    return dateStr.split('T')[0] === todayStr
  }

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2800)
  }

  async function completeAction(deal: DealWithClient, activityNote: string) {
    setCompleting(deal.id)
    await supabase.from('activities').insert({
      deal_id: deal.id,
      activity_type: deal.next_activity_type || 'FOLLOW_UP',
      notes: activityNote || `${deal.next_activity_type || 'Action'} completed`,
    })
    await supabase.from('deals').update({
      next_activity_at: null,
      next_activity_type: null,
    }).eq('id', deal.id)
    showToast('Action completed ✓')
    setCompleting(null)
    loadActions()
  }

  async function snooze(dealId: number, days: number) {
    const newDate = new Date(Date.now() + days * 86400000).toISOString()
    await supabase.from('deals').update({ next_activity_at: newDate }).eq('id', dealId)
    showToast(`Snoozed ${days} day${days > 1 ? 's' : ''}`)
    loadActions()
  }

  const totalActions = overdue.length + dueToday.length

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '80vh' }}>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px' }}>Loading your actions…</div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">Today's Actions</div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {totalActions > 0 && (
            <div style={{ background: 'var(--red-light)', color: 'var(--red)', padding: '8px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
              {totalActions} action{totalActions > 1 ? 's' : ''} need attention
            </div>
          )}
          <Link href="/pipeline">
            <button className="btn btn-primary">View Pipeline →</button>
          </Link>
        </div>
      </div>

      <div className="page-body">

        {/* Summary pills */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '28px' }}>
          {[
            { label: 'Overdue', count: overdue.length, color: 'var(--red)', bg: 'var(--red-light)' },
            { label: 'Due Today', count: dueToday.length, color: 'var(--amber)', bg: 'var(--amber-light)' },
            { label: 'This Week', count: upcoming.length, color: 'var(--accent-mid)', bg: 'var(--accent-light)' },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ borderLeft: `4px solid ${s.color}` }}>
              <div className="stat-label">{s.label}</div>
              <div className="stat-value" style={{ color: s.color }}>{s.count}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {s.count === 0 ? 'All clear ✓' : `deal${s.count > 1 ? 's' : ''} need attention`}
              </div>
            </div>
          ))}
        </div>

        {/* All clear state */}
        {overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0 && (
          <div className="card empty-state" style={{ padding: '60px 24px' }}>
            <div style={{ fontSize: '40px', marginBottom: '16px' }}>✦</div>
            <div className="empty-state-title">You're all clear!</div>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>No actions due. Enjoy the moment or go close some deals.</div>
            <Link href="/pipeline" style={{ marginTop: '20px', display: 'inline-block' }}>
              <button className="btn btn-primary">Open Pipeline →</button>
            </Link>
          </div>
        )}

        {/* Overdue */}
        {overdue.length > 0 && (
          <Section title="🔴 Overdue" subtitle="These need urgent attention" color="var(--red)">
            {overdue.map(deal => (
              <ActionCard key={deal.id} deal={deal} variant="overdue"
                onComplete={note => completeAction(deal, note)}
                onSnooze={days => snooze(deal.id, days)}
                completing={completing === deal.id}
              />
            ))}
          </Section>
        )}

        {/* Due today */}
        {dueToday.length > 0 && (
          <Section title="🟡 Due Today" subtitle="Scheduled for today" color="var(--amber)">
            {dueToday.map(deal => (
              <ActionCard key={deal.id} deal={deal} variant="today"
                onComplete={note => completeAction(deal, note)}
                onSnooze={days => snooze(deal.id, days)}
                completing={completing === deal.id}
              />
            ))}
          </Section>
        )}

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <Section title="🔵 Upcoming This Week" subtitle="Next 7 days" color="var(--accent-mid)">
            {upcoming.map(deal => (
              <ActionCard key={deal.id} deal={deal} variant="upcoming"
                onComplete={note => completeAction(deal, note)}
                onSnooze={days => snooze(deal.id, days)}
                completing={completing === deal.id}
              />
            ))}
          </Section>
        )}

      </div>

      {toast && <div className="toast success">{toast}</div>}
    </div>
  )
}

function Section({ title, subtitle, color, children }: { title: string; subtitle: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '14px' }}>
        <div style={{ fontFamily: 'Instrument Serif, serif', fontSize: '20px', color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{subtitle}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>{children}</div>
    </div>
  )
}

function ActionCard({ deal, variant, onComplete, onSnooze, completing }: {
  deal: DealWithClient
  variant: 'overdue' | 'today' | 'upcoming'
  onComplete: (note: string) => void
  onSnooze: (days: number) => void
  completing: boolean
}) {
  const [expanded, setExpanded]   = useState(false)
  const [note, setNote]           = useState('')
  const client                    = deal.clients as any
  const days                      = variant === 'overdue' ? daysDiff(deal.next_activity_at) : 0
  const stageColor                = STAGE_COLORS[deal.stage] || 'var(--text-muted)'
  const dueDate                   = new Date(deal.next_activity_at).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

  const borderColor = variant === 'overdue' ? 'var(--red)' : variant === 'today' ? 'var(--amber)' : 'var(--accent-mid)'

  return (
    <div className="card" style={{ padding: '0', overflow: 'hidden', borderLeft: `4px solid ${borderColor}` }}>
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'flex-start', gap: '16px', cursor: 'pointer' }}
        onClick={() => setExpanded(p => !p)}>

        {/* Activity type icon */}
        <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: borderColor + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
          {deal.next_activity_type === 'CALL' ? '📞' : deal.next_activity_type === 'EMAIL' ? '📧' : deal.next_activity_type === 'WHATSAPP' ? '💬' : deal.next_activity_type === 'MEETING' ? '🤝' : '◎'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'Instrument Serif, serif', fontSize: '16px', color: 'var(--text-primary)' }}>{deal.title}</span>
            <span style={{ fontSize: '11px', background: stageColor + '22', color: stageColor, padding: '2px 8px', borderRadius: '10px', fontWeight: '500' }}>
              {STAGE_LABELS[deal.stage] || deal.stage}
            </span>
          </div>
          {client && (
            <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginBottom: '6px' }}>
              {client.first_name} {client.last_name}
              {client.phone && ` · ${client.phone}`}
            </div>
          )}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: borderColor }}>
              {deal.next_activity_type || 'Follow up'}
              {variant === 'overdue' && ` · ${days}d overdue`}
              {variant !== 'overdue' && ` · ${dueDate}`}
            </span>
            <span style={{ fontSize: '12px', color: 'var(--green)', fontWeight: '500' }}>
              {fmt(deal.deal_value || 0)}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {client?.phone && (
            <a href={`https://wa.me/${client.phone.replace(/\D/g, '')}`} target="_blank"
              onClick={e => e.stopPropagation()}
              style={{ padding: '6px 10px', borderRadius: '6px', background: '#e8f9ef', color: '#1a9e52', fontSize: '12px', textDecoration: 'none', fontWeight: '500' }}>
              💬 WhatsApp
            </a>
          )}
          {client?.phone && (
            <a href={`tel:${client.phone}`} onClick={e => e.stopPropagation()}
              style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--accent-light)', color: 'var(--accent)', fontSize: '12px', textDecoration: 'none', fontWeight: '500' }}>
              📞 Call
            </a>
          )}
          <Link href={`/deals/${deal.id}`} onClick={e => e.stopPropagation()}
            style={{ padding: '6px 10px', borderRadius: '6px', background: 'var(--bg-tertiary)', color: 'var(--text-secondary)', fontSize: '12px', textDecoration: 'none' }}>
            Open →
          </Link>
          <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '0 4px' }}>{expanded ? '▲' : '▼'}</div>
        </div>
      </div>

      {/* Expanded action panel */}
      {expanded && (
        <div style={{ padding: '0 20px 18px', borderTop: '1px solid var(--border)' }}>
          <div style={{ paddingTop: '14px' }}>
            <label className="label" style={{ marginBottom: '6px' }}>Log completion note</label>
            <textarea
              className="input"
              style={{ minHeight: '64px', resize: 'vertical', marginBottom: '12px' }}
              placeholder={`What happened on this ${(deal.next_activity_type || 'call').toLowerCase()}? Any notes for the file…`}
              value={note}
              onChange={e => setNote(e.target.value)}
            />
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-success" onClick={() => onComplete(note)} disabled={completing}>
                {completing ? 'Saving…' : '✓ Mark Complete'}
              </button>
              <button className="btn btn-ghost btn-sm" onClick={() => onSnooze(1)}>Snooze 1 day</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onSnooze(3)}>Snooze 3 days</button>
              <button className="btn btn-ghost btn-sm" onClick={() => onSnooze(7)}>Snooze 1 week</button>
              <Link href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                <button className="btn btn-secondary btn-sm">Open Deal →</button>
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
