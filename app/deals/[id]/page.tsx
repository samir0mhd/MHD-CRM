'use client'

import { useEffect, useState, useRef, type CSSProperties } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getAccessContext, isManager, type StaffUser } from '@/lib/access'
import { authedFetch } from '@/lib/api-client'
import Link from 'next/link'
import {
  fetchDealById,
  changeStage as changeStageService,
  logActivity as logActivityService,
  markQuoteSent as markQuoteSentService,
  deleteQuote as deleteQuoteService,
  markBooked as markBookedService,
  markLost as markLostService,
  saveOwnership as saveOwnershipService,
  isExistingBookingResult,
  type CelebrationMilestone,
} from '@/lib/modules/deals/deal.service'
import type { Activity, Deal, Quote } from '@/lib/modules/deals/deal.repository'
import {
  getDisplayActionNote,
  getDisplayActionType,
  NEXT_ACTION_TYPES,
  validateNextActionInput,
} from '@/lib/modules/deals/next-action'

const STAGES = ['NEW_LEAD','QUOTE_SENT','ENGAGED','FOLLOW_UP','DECISION_PENDING','BOOKED']

const STAGE_LABELS: Record<string,string> = {
  NEW_LEAD:'New Lead', QUOTE_SENT:'Quote Sent', ENGAGED:'Engaged',
  FOLLOW_UP:'Follow Up', DECISION_PENDING:'Decision Pending', BOOKED:'Booked', LOST:'Lost',
}
const STAGE_COLORS: Record<string,string> = {
  NEW_LEAD:'#8b5cf6', QUOTE_SENT:'#f59e0b', ENGAGED:'#3b82f6',
  FOLLOW_UP:'#f97316', DECISION_PENDING:'#ec4899', BOOKED:'#10b981', LOST:'#ef4444',
}
const ACT_LABELS: Record<string,string> = {
  CALL:'Call logged', EMAIL:'Email sent', WHATSAPP:'WhatsApp sent',
  NOTE:'Note added', MEETING:'Meeting held', FOLLOW_UP:'Follow up set',
  QUOTE_CREATED:'Quote created', QUOTE_SENT:'Quote sent to client',
  STAGE_CHANGE:'Stage updated', BOOKING_CREATED:'Booking confirmed',
}
const ACT_COLORS: Record<string,string> = {
  CALL:'#3b82f6', EMAIL:'#8b5cf6', WHATSAPP:'#25d366', NOTE:'#f59e0b',
  MEETING:'#ec4899', FOLLOW_UP:'#f97316', QUOTE_CREATED:'#10b981',
  QUOTE_SENT:'#10b981', STAGE_CHANGE:'#6366f1', BOOKING_CREATED:'#10b981',
}
const LOG_ACTION_TYPES = ['CALL','EMAIL','WHATSAPP','NOTE','MEETING','FOLLOW_UP']
const ACT_ICONS: Record<string,string> = {
  CALL:'📞', EMAIL:'📧', WHATSAPP:'💬', NOTE:'📝', MEETING:'🤝', FOLLOW_UP:'🔔'
}

const FIREWORKS = [
  { left: '16%', top: '18%', color: '#f59e0b', delay: '0s', size: 150 },
  { left: '82%', top: '16%', color: '#38bdf8', delay: '0.35s', size: 170 },
  { left: '11%', top: '70%', color: '#f472b6', delay: '0.75s', size: 140 },
  { left: '88%', top: '72%', color: '#10b981', delay: '1.1s', size: 165 },
  { left: '50%', top: '10%', color: '#facc15', delay: '1.45s', size: 190 },
]

const fmt     = (n:number) => '£'+(n||0).toLocaleString('en-GB',{maximumFractionDigits:0})
const fmtDate = (d:string|null) => !d ? '—' : new Date(d).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})

type QuoteGroup = {
  key: string
  quoteRef: string
  quoteIds: number[]
  optionCount: number
  quote: Quote
}

function buildQuoteGroups(quotes: Quote[]): QuoteGroup[] {
  const orderedQuotes = [...quotes].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  const groups: QuoteGroup[] = []
  const groupIndexByKey = new Map<string, number>()

  orderedQuotes.forEach(quote => {
    const key = quote.quote_ref?.trim() || `quote-${quote.id}`
    const existingIndex = groupIndexByKey.get(key)

    if (existingIndex === undefined) {
      groups.push({
        key,
        quoteRef: quote.quote_ref?.trim() || `Quote #${quote.id}`,
        quoteIds: [quote.id],
        optionCount: 1,
        quote: { ...quote },
      })
      groupIndexByKey.set(key, groups.length - 1)
      return
    }

    const group = groups[existingIndex]
    group.quoteIds.push(quote.id)
    group.optionCount += 1
    group.quote = {
      ...group.quote,
      sent_to_client: !!group.quote.sent_to_client || !!quote.sent_to_client,
    }
  })

  return groups
}

export default function DealDetailPage() {
  const { id }    = useParams()
  const router    = useRouter()
  const [deal, setDeal]               = useState<Deal|null>(null)
  const [loading, setLoading]         = useState(true)
  const [tab, setTab]                 = useState<'overview'|'quotes'|'activity'|'booking'>('overview')
  const [toast, setToast]             = useState<{msg:string;type:'success'|'error'}|null>(null)
  const [marking, setMarking]         = useState(false)
  const [showLostModal, setShowLost]  = useState(false)
  const [lostReason, setLostReason]   = useState('')
  const [actType, setActType]         = useState('CALL')
  const [actNotes, setActNotes]       = useState('')
  const [loggingAct, setLoggingAct]   = useState(false)
  const [nextActType, setNextActType] = useState('')
  const [nextActDate, setNextActDate] = useState('')
  const [nextActNote, setNextActNote] = useState('')
  const [savingNext, setSavingNext]   = useState(false)
  const [nextSaved, setNextSaved]     = useState(false)
  const [expandedQuote, setExpandedQuote] = useState<string|null>(null)
  const [celebration, setCelebration] = useState<{
    ref: string
    value: number
    profit: number
    clientName: string
    hotel: string
    consultantName: string | null
    milestone: CelebrationMilestone | null
  } | null>(null)
  const [staffUsers, setStaffUsers]   = useState<StaffUser[]>([])
  const [currentStaff, setCurrentStaff] = useState<StaffUser | null>(null)
  const [ownerDraft, setOwnerDraft]   = useState('')
  const [savingOwner, setSavingOwner] = useState(false)
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      const [data, access] = await Promise.all([
        fetchDealById(Number(id)),
        getAccessContext(),
      ])

      if (data) {
        setDeal(data)
        setNextActType(getDisplayActionType(data.next_activity_type, Boolean(data.next_activity_at)) || '')
        setNextActDate(data.next_activity_at ? data.next_activity_at.split('T')[0] : '')
        setNextActNote(getDisplayActionNote(data.next_activity_note, Boolean(data.next_activity_at)) || '')
        setOwnerDraft(String(data.staff_id || data.clients?.owner_staff_id || ''))
      }

      setStaffUsers(access.staffUsers)
      setCurrentStaff(access.currentStaff)
      setLoading(false)
    })()
  }, [id])

  async function loadDeal() {
    setLoading(true)
    const data = await fetchDealById(Number(id))
    if (data) {
      setDeal(data)
      setNextActType(getDisplayActionType(data.next_activity_type, Boolean(data.next_activity_at)) || '')
      setNextActDate(data.next_activity_at ? data.next_activity_at.split('T')[0] : '')
      setNextActNote(getDisplayActionNote(data.next_activity_note, Boolean(data.next_activity_at)) || '')
      setOwnerDraft(String(data.staff_id || data.clients?.owner_staff_id || ''))
    }
    setLoading(false)
  }

  function showToast(msg:string, type:'success'|'error'='success') {
    setToast({ msg, type })
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 3000)
  }

  async function changeStage(newStage:string) {
    if (!deal || deal.stage === newStage) return
    await changeStageService(deal.id, newStage)
    showToast(`Moved to ${STAGE_LABELS[newStage]}`)
      void loadDeal()
  }

  async function logActivity() {
    if (!deal || !actNotes.trim()) return
    setLoggingAct(true)
    await logActivityService(deal.id, actType, actNotes.trim())
    setActNotes('')
    showToast('Activity logged ✓')
    setLoggingAct(false)
    loadDeal()
  }

  async function saveNextAction() {
    if (!deal) return
    const validationError = validateNextActionInput({
      actionType: nextActType,
      dueDate: nextActDate,
      actionNote: nextActNote,
    })
    if (validationError) { showToast(validationError, 'error'); return }
    setSavingNext(true)
    try {
      const res = await authedFetch(`/api/deals/${deal.id}/next-action`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          actionType: nextActType,
          dueDate: nextActDate,
          actionNote: nextActNote,
        }),
      })
      const result = await res.json().catch(() => null)
      if (!res.ok) throw new Error(result?.error || 'Failed to save next action')

      const saved = result?.nextAction
      setNextActType(saved?.actionType || nextActType)
      setNextActDate(saved?.dueDate || nextActDate)
      setNextActNote(saved?.actionNote || nextActNote.trim())
      setNextSaved(true)
    showToast('Next action saved ✓')
    setTimeout(() => setNextSaved(false), 2500)
    void loadDeal()
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Failed to save next action', 'error')
    } finally {
      setSavingNext(false)
    }
  }

  async function markQuoteSent(quoteIds:number[], quoteRef:string) {
    if (!deal) return
    await markQuoteSentService(deal, quoteIds, quoteRef)
    showToast('Quote marked as sent — follow-up sequence created ✓')
    loadDeal()
  }

  async function deleteQuote(quoteIds:number[], quoteRef:string) {
    if (!deal) return
    if (!confirm('Delete this quote? This cannot be undone.')) return
    await deleteQuoteService(deal.id, quoteIds, quoteRef)
    showToast('Quote deleted')
    loadDeal()
  }

  async function markBooked() {
    if (!deal) return
    setMarking(true)
    try {
      const result = await markBookedService(deal, staffUsers, currentStaff)
      if (isExistingBookingResult(result)) {
        showToast(`Already has booking — ${result.bookingReference}`, 'error')
        setMarking(false)
        return
      }

      setCelebration({
        ref: result.bookingRef,
        value: result.value,
        profit: result.profit,
        clientName: result.clientName,
        hotel: result.hotel,
        consultantName: result.consultantName,
        milestone: result.milestone,
      })
      setTimeout(() => { router.refresh(); router.push('/bookings') }, 5500)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      showToast('Error creating booking — '+message, 'error')
      setMarking(false)
    }
  }

  async function markLost() {
    if (!deal || !lostReason.trim()) return
    await markLostService(deal.id, lostReason)
    setShowLost(false); showToast('Deal marked as lost'); loadDeal()
  }

  async function saveOwnership() {
    if (!deal || !isManager(currentStaff) || !ownerDraft) return
    const nextStaffId = Number(ownerDraft)
    const bookingTargets = (Array.isArray(deal.bookings) ? deal.bookings : []).filter(booking => booking.staff_id !== nextStaffId)

    setSavingOwner(true)
    try {
      const result = await saveOwnershipService(deal, currentStaff, nextStaffId, deal.clients, bookingTargets)
      if (result.updated) {
        showToast('Ownership updated ✓')
      } else {
        showToast('Ownership already aligned')
      }
      await loadDeal()
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update ownership', 'error')
    } finally {
      setSavingOwner(false)
    }
  }

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh' }}><div style={{ color:'var(--text-muted)', fontSize:'14px' }}>Loading deal…</div></div>
  if (!deal)   return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'80vh' }}><div style={{ color:'var(--text-muted)', fontSize:'14px' }}>Deal not found</div></div>

  const client      = deal.clients
  const quoteGroups = buildQuoteGroups(deal.quotes||[])
  const acts        = (deal.activities||[]).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime())
  const isBooked = deal.stage==='BOOKED'
  const isLost   = deal.stage==='LOST'
  const hasBook  = (deal.bookings?.length||0)>0
  const stageIdx = STAGES.indexOf(deal.stage)
  const totalQ   = quoteGroups.reduce((a,g)=>a+(g.quote.price||0),0)
  const totalP   = quoteGroups.reduce((a,g)=>a+(g.quote.profit||0),0)
  const assignedStaffId = deal.staff_id || client?.owner_staff_id || null
  const assignedStaff = staffUsers.find(staff => staff.id === assignedStaffId) || null
  const clientOwnerMismatch = (client?.owner_staff_id ?? null) !== (deal.staff_id ?? null)
  const bookingOwnerMismatch = (Array.isArray(deal.bookings) ? deal.bookings : []).some(booking => booking.staff_id !== assignedStaffId)
  const dealInfoRows: { label: string; val: string; color?: string }[] = [
    { label:'Stage', val:STAGE_LABELS[deal.stage]||deal.stage, color:STAGE_COLORS[deal.stage] },
    { label:'Departure', val:fmtDate(deal.departure_date) },
    { label:'Source', val:deal.source||'—' },
    { label:'Quotes', val:`${quoteGroups.length} quote${quoteGroups.length!==1?'s':''}` },
  ]

  const TABS = [
    { key:'overview',  label:'Overview'                    },
    { key:'quotes',    label:`Quotes (${quoteGroups.length})`   },
    { key:'activity',  label:`Activity (${acts.length})`   },
    { key:'booking',   label:'Booking'                     },
  ] as const

  /* ── Booking Celebration ──────────────────────── */
  if (celebration) {
    const milestone = celebration.milestone
    const headline = milestone ? milestone.label : 'Booking Confirmed'
    const strapline = milestone
      ? `${celebration.consultantName || 'Sales'} just pushed through a monthly target`
      : 'Another Mauritius escape is officially on the books'
    return (
      <div onClick={() => setCelebration(null)} style={{
        position:'fixed', inset:0, zIndex:9999,
        background:'radial-gradient(circle at 50% 20%, rgba(16,185,129,0.18), transparent 28%), radial-gradient(circle at 10% 20%, rgba(59,130,246,0.18), transparent 22%), radial-gradient(circle at 88% 18%, rgba(245,158,11,0.22), transparent 24%), linear-gradient(180deg, #07111f 0%, #04070d 100%)',
        display:'flex', alignItems:'center', justifyContent:'center',
        flexDirection:'column', cursor:'pointer',
        animation:'celebFadeIn 0.4s ease',
      }}>
        <style>{`
          @keyframes celebFadeIn { from { opacity:0 } to { opacity:1 } }
          @keyframes cardLift { 0%{transform:translateY(30px) scale(0.92);opacity:0} 100%{transform:translateY(0) scale(1);opacity:1} }
          @keyframes riseUp { from{transform:translateY(24px);opacity:0} to{transform:translateY(0);opacity:1} }
          @keyframes pulseGlow { 0%,100%{box-shadow:0 0 0 rgba(245,158,11,0)} 50%{box-shadow:0 0 45px rgba(245,158,11,0.16)} }
          @keyframes sparkFly {
            0% { transform: rotate(var(--angle)) translateX(0) scale(0.3); opacity:1; }
            100% { transform: rotate(var(--angle)) translateX(var(--distance)) scale(1); opacity:0; }
          }
          @keyframes emberFloat {
            0% { transform: translateY(0) scale(0.8); opacity:0; }
            20% { opacity:1; }
            100% { transform: translateY(-120px) scale(1.15); opacity:0; }
          }
          @keyframes countdown {
            from { transform: scaleX(1); }
            to { transform: scaleX(0); }
          }
        `}</style>

        {FIREWORKS.map((burst, burstIndex) => (
          <div key={`${burst.left}-${burst.top}`} style={{
            position:'absolute',
            left: burst.left,
            top: burst.top,
            width: 0,
            height: 0,
            pointerEvents: 'none',
          }}>
            {[...Array(18)].map((_, i) => (
              <span key={i} style={{
                '--angle': `${i * 20}deg`,
                '--distance': `${burst.size}px`,
                position: 'absolute',
                width: '8px',
                height: '8px',
                borderRadius: '999px',
                background: burst.color,
                boxShadow: `0 0 18px ${burst.color}`,
                animation: `sparkFly 1.45s ease-out infinite`,
                animationDelay: `calc(${burst.delay} + ${i * 0.035}s)`,
                opacity: 0,
              } as CSSProperties} />
            ))}
            {[...Array(4)].map((_, i) => (
              <span key={`ember-${i}`} style={{
                position: 'absolute',
                left: `${-30 + i * 18}px`,
                top: `${10 + i * 8}px`,
                width: '4px',
                height: '4px',
                borderRadius: '999px',
                background: burstIndex % 2 === 0 ? '#fef08a' : '#ffffff',
                boxShadow: '0 0 18px rgba(255,255,255,0.8)',
                animation: `emberFloat 2.2s ease-out infinite`,
                animationDelay: `calc(${burst.delay} + ${i * 0.18}s)`,
                opacity: 0,
              }} />
            ))}
          </div>
        ))}

        <div style={{
          width:'min(560px, 92vw)',
          background:'linear-gradient(180deg, rgba(10,17,31,0.9) 0%, rgba(11,20,37,0.82) 100%)',
          border:'1px solid rgba(148,163,184,0.18)',
          borderRadius:'30px',
          padding:'34px 34px 28px',
          boxShadow:'0 32px 90px rgba(0,0,0,0.48)',
          animation:'cardLift 0.55s cubic-bezier(0.2,1,0.22,1) both, pulseGlow 2.4s ease-in-out infinite',
          position:'relative',
          overflow:'hidden',
          textAlign:'center',
          backdropFilter:'blur(14px)',
        }}>
          <div style={{
            position:'absolute',
            inset:'0 auto auto 0',
            width:'100%',
            height:'1px',
            background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
          }} />

          <div style={{
            display:'inline-flex',
            alignItems:'center',
            gap:'8px',
            borderRadius:'999px',
            padding:'8px 14px',
            background: milestone ? `${milestone.color}22` : 'rgba(255,255,255,0.06)',
            border: `1px solid ${milestone ? `${milestone.color}66` : 'rgba(255,255,255,0.08)'}`,
            color: milestone?.color || '#f8fafc',
            fontSize:'11px',
            fontWeight:'700',
            letterSpacing:'0.14em',
            textTransform:'uppercase',
            marginBottom:'18px',
            animation:'riseUp 0.45s 0.12s both',
          }}>
            <span>{milestone ? '✦' : '✈'}</span>
            <span>{headline}</span>
          </div>

          <div style={{
            fontFamily:'Fraunces, serif',
            fontSize:'52px',
            lineHeight:0.96,
            letterSpacing:'-0.04em',
            color:'#f8fafc',
            marginBottom:'12px',
            animation:'riseUp 0.5s 0.2s both',
          }}>
            Booking
            <br />
            locked in
          </div>

          <div style={{
            fontFamily:'Outfit, sans-serif',
            fontSize:'14px',
            color:'#94a3b8',
            marginBottom:'22px',
            animation:'riseUp 0.5s 0.28s both',
          }}>
            {strapline}
          </div>

          <div style={{
            display:'grid',
            gridTemplateColumns:'1.15fr 0.85fr',
            gap:'14px',
            marginBottom:'18px',
            textAlign:'left',
          }}>
            <div style={{
              background:'rgba(255,255,255,0.05)',
              border:'1px solid rgba(255,255,255,0.08)',
              borderRadius:'20px',
              padding:'18px 18px 16px',
              animation:'riseUp 0.5s 0.34s both',
            }}>
              <div style={{ fontSize:'11px', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'8px' }}>
                Client / Booking
              </div>
              <div style={{ fontSize:'20px', fontWeight:'700', color:'#f8fafc', marginBottom:'6px' }}>{celebration.clientName}</div>
              <div style={{ fontSize:'13px', color:'#cbd5e1' }}>
                {celebration.hotel || deal.title}
              </div>
              <div style={{ marginTop:'12px', fontFamily:'monospace', fontSize:'12px', color:'#fbbf24', letterSpacing:'0.1em' }}>
                REF {celebration.ref}
              </div>
            </div>

            <div style={{ display:'grid', gap:'14px' }}>
              <div style={{
                background:'rgba(255,255,255,0.05)',
                border:'1px solid rgba(255,255,255,0.08)',
                borderRadius:'20px',
                padding:'16px 16px 14px',
                animation:'riseUp 0.5s 0.42s both',
              }}>
                <div style={{ fontSize:'11px', color:'#94a3b8', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'8px' }}>Booking Value</div>
                <div style={{ fontFamily:'Fraunces, serif', fontSize:'32px', color:'#f8fafc', lineHeight:1 }}>
                  £{(celebration.value||0).toLocaleString('en-GB',{maximumFractionDigits:0})}
                </div>
              </div>

              {celebration.profit > 0 && (
                <div style={{
                  background:'rgba(16,185,129,0.09)',
                  border:'1px solid rgba(16,185,129,0.22)',
                  borderRadius:'20px',
                  padding:'16px 16px 14px',
                  animation:'riseUp 0.5s 0.5s both',
                }}>
                  <div style={{ fontSize:'11px', color:'#86efac', textTransform:'uppercase', letterSpacing:'0.12em', marginBottom:'8px' }}>Est. Profit</div>
                  <div style={{ fontFamily:'Fraunces, serif', fontSize:'32px', color:'#bbf7d0', lineHeight:1 }}>
                    £{(celebration.profit||0).toLocaleString('en-GB',{maximumFractionDigits:0})}
                  </div>
                </div>
              )}
            </div>
          </div>

          {milestone && (
            <div style={{
              marginBottom:'18px',
              background:`linear-gradient(135deg, ${milestone.color}22 0%, rgba(255,255,255,0.04) 100%)`,
              border:`1px solid ${milestone.color}55`,
              borderRadius:'20px',
              padding:'16px 18px',
              textAlign:'left',
              animation:'riseUp 0.5s 0.58s both',
            }}>
              <div style={{ display:'flex', justifyContent:'space-between', gap:'12px', alignItems:'center', marginBottom:'8px' }}>
                <div style={{ fontSize:'12px', fontWeight:'800', letterSpacing:'0.12em', textTransform:'uppercase', color:milestone.color }}>
                  {milestone.label}
                </div>
                {milestone.bonus > 0 && (
                  <div style={{ fontSize:'12px', fontWeight:'700', color:'#f8fafc' }}>
                    Bonus £{milestone.bonus.toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </div>
                )}
              </div>
              <div style={{ fontSize:'13px', color:'#cbd5e1', lineHeight:1.6 }}>
                Monthly booked profit now at <strong style={{ color:'#f8fafc' }}>£{milestone.reachedTotal.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</strong>
                {' '}against the <strong style={{ color: milestone.color }}>£{milestone.target.toLocaleString('en-GB', { maximumFractionDigits: 0 })}</strong> target.
              </div>
            </div>
          )}

          <div style={{ fontSize:'11px', color:'#64748b', letterSpacing:'0.06em', textTransform:'uppercase', animation:'riseUp 0.5s 0.65s both' }}>
            tap anywhere to continue
          </div>

          <div style={{ position:'absolute', bottom:0, left:0, right:0, height:'4px', background:'rgba(255,255,255,0.08)' }}>
            <div style={{
              height:'100%',
              background: milestone
                ? `linear-gradient(90deg, ${milestone.color}, #f8fafc)`
                : 'linear-gradient(90deg, #38bdf8, #10b981, #f59e0b)',
              transformOrigin:'left',
              animation:'countdown 5.5s linear forwards',
            }} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header">
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <Link href="/pipeline" style={{ color:'var(--text-muted)', textDecoration:'none', fontSize:'13px' }}>← Pipeline</Link>
          <div>
            <div className="page-title" style={{ fontSize:'22px' }}>{deal.title}</div>
            <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>
              {client?.first_name} {client?.last_name} · {client?.email}
              {assignedStaff ? ` · Owner: ${assignedStaff.name}` : ' · Owner: Unassigned'}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          {hasBook && <Link href="/bookings"><button className="btn btn-secondary">Booking {deal.bookings![0].booking_reference} →</button></Link>}
          {!isBooked && !isLost && !hasBook && <button className="btn btn-success" onClick={markBooked} disabled={marking}>{marking?'Creating…':'🎉 Mark Booked'}</button>}
          {!isBooked && !isLost && <button className="btn btn-danger" onClick={()=>setShowLost(true)}>✕ Mark Lost</button>}
          {!isBooked && !isLost && <Link href={`/quotes/new?deal=${deal.id}`}><button className="btn btn-primary">+ New Quote</button></Link>}
        </div>
      </div>

      <div className="page-body" style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:'20px' }}>
        <div>
          {/* Stage bar */}
          {!isBooked && !isLost && (
            <div className="card" style={{ padding:'16px 20px', marginBottom:'20px' }}>
              <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
                {STAGES.map((stage,i) => {
                  const done=i<stageIdx, current=stage===deal.stage, col=STAGE_COLORS[stage]
                  return (
                    <div key={stage} style={{ display:'flex', alignItems:'center', flex:1 }}>
                      <button onClick={()=>changeStage(stage)} style={{ flex:1, padding:'8px 4px', borderRadius:'6px', border:'1.5px solid', fontSize:'11px', cursor:'pointer', fontWeight:current?'600':'400', textAlign:'center', whiteSpace:'nowrap', transition:'all 0.15s', borderColor:current?col:done?col+'66':'var(--border)', background:current?col+'22':done?col+'11':'transparent', color:current?col:done?col:'var(--text-muted)' }}>
                        {current?'● ':done?'✓ ':''}{STAGE_LABELS[stage]}
                      </button>
                      {i<STAGES.length-1 && <div style={{ width:'10px', height:'2px', background:done?'var(--accent)':'var(--border)', flexShrink:0 }}/>}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Booked banner */}
          {isBooked && (
            <div style={{ background:'var(--green-light)', border:'1px solid var(--green)', borderRadius:'10px', padding:'14px 18px', marginBottom:'20px', display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontSize:'20px' }}>🎉</span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:'600', color:'var(--green)', fontSize:'14px' }}>Deal Booked — {deal.bookings?.[0]?.booking_reference}</div>
                <div style={{ fontSize:'12.5px', color:'var(--green)' }}>Converted to confirmed booking</div>
              </div>
              <Link href="/bookings"><button className="btn btn-sm" style={{ background:'var(--green)', color:'white', border:'none', cursor:'pointer', padding:'6px 14px', borderRadius:'6px', fontSize:'12px', fontFamily:'DM Sans, sans-serif' }}>Open Booking →</button></Link>
            </div>
          )}

          {/* Lost banner */}
          {isLost && (
            <div style={{ background:'var(--red-light)', border:'1px solid var(--red)', borderRadius:'10px', padding:'14px 18px', marginBottom:'20px' }}>
              <div style={{ fontWeight:'600', color:'var(--red)', fontSize:'14px', marginBottom:'4px' }}>Deal Lost</div>
              {deal.lost_reason && <div style={{ fontSize:'13px', color:'var(--red)' }}>{deal.lost_reason}</div>}
            </div>
          )}

          {/* Tabs */}
          <div style={{ display:'flex', borderBottom:'1px solid var(--border)', marginBottom:'20px' }}>
            {TABS.map(t=>(
              <button key={t.key} onClick={()=>setTab(t.key)} style={{ padding:'10px 18px', border:'none', background:'transparent', fontSize:'13.5px', cursor:'pointer', color:tab===t.key?'var(--accent)':'var(--text-muted)', fontWeight:tab===t.key?'500':'400', borderBottom:tab===t.key?'2px solid var(--accent)':'2px solid transparent', marginBottom:'-1px' }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* OVERVIEW TAB */}
          {tab==='overview' && (
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
                {[
                  { label:'Deal Value',   val:fmt(deal.deal_value||0), color:'var(--accent-mid)' },
                  { label:'Total Quoted', val:fmt(totalQ),              color:'var(--green)'      },
                  { label:'Est. Profit',  val:fmt(totalP),              color:'var(--gold)'       },
                ].map(s=>(
                  <div key={s.label} className="stat-card">
                    <div className="stat-label">{s.label}</div>
                    <div style={{ fontFamily:'Instrument Serif, serif', fontSize:'28px', color:s.color, lineHeight:1, marginTop:'4px' }}>{s.val}</div>
                  </div>
                ))}
              </div>

              <div className="card" style={{ padding:'20px' }}>
                <div style={{ fontFamily:'Instrument Serif, serif', fontSize:'17px', marginBottom:'14px' }}>Deal Details</div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
                  {[
                    { label:'Title',     val:deal.title                           },
                    { label:'Value',     val:fmt(deal.deal_value||0)              },
                    { label:'Departure', val:fmtDate(deal.departure_date)         },
                    { label:'Source',    val:deal.source||'—'                     },
                    { label:'Stage',     val:STAGE_LABELS[deal.stage]||deal.stage },
                    { label:'Created',   val:fmtDate(deal.created_at)             },
                  ].map(f=>(
                    <div key={f.label}>
                      <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'3px' }}>{f.label}</div>
                      <div style={{ fontSize:'14px', color:'var(--text-primary)', fontWeight:'500' }}>{f.val}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ padding:'20px' }}>
                <div style={{ fontFamily:'Instrument Serif, serif', fontSize:'17px', marginBottom:'14px' }}>Log Activity</div>
                <div style={{ display:'flex', gap:'8px', marginBottom:'10px', flexWrap:'wrap' }}>
                  {LOG_ACTION_TYPES.map(t=>(
                    <button key={t} onClick={()=>setActType(t)} style={{ padding:'6px 14px', borderRadius:'20px', border:'1.5px solid', fontSize:'12.5px', cursor:'pointer', borderColor:actType===t?'var(--accent)':'var(--border)', background:actType===t?'var(--accent-light)':'transparent', color:actType===t?'var(--accent)':'var(--text-muted)' }}>
                      {ACT_ICONS[t]} {t.charAt(0)+t.slice(1).toLowerCase().replace('_',' ')}
                    </button>
                  ))}
                </div>
                <textarea className="input" style={{ minHeight:'80px', resize:'vertical', marginBottom:'10px' }} placeholder={`Notes for this ${actType.toLowerCase().replace('_',' ')}…`} value={actNotes} onChange={e=>setActNotes(e.target.value)}/>
                <button className="btn btn-primary" onClick={logActivity} disabled={loggingAct||!actNotes.trim()}>{loggingAct?'Saving…':'Log Activity'}</button>
              </div>

              {acts.length>0 && (
                <div className="card" style={{ padding:'20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                    <div style={{ fontFamily:'Instrument Serif, serif', fontSize:'17px' }}>Recent Activity</div>
                    <button onClick={()=>setTab('activity')} style={{ fontSize:'12.5px', color:'var(--accent)', background:'none', border:'none', cursor:'pointer' }}>View all →</button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                    {acts.slice(0,3).map(a=><ActivityItem key={a.id} act={a}/>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* QUOTES TAB */}
          {tab==='quotes' && (
            <div>
              {!isBooked && !isLost && (
                <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:'16px' }}>
                  <Link href={`/quotes/new?deal=${deal.id}`}><button className="btn btn-primary">+ New Quote</button></Link>
                </div>
              )}
              {quoteGroups.length===0 ? (
                <div className="card empty-state">
                  <div style={{ fontSize:'28px' }}>◇</div>
                  <div className="empty-state-title">No quotes yet</div>
                  <Link href={`/quotes/new?deal=${deal.id}`}><button className="btn btn-primary" style={{ marginTop:'12px' }}>Build First Quote</button></Link>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
                  {quoteGroups.map(group=>(
                    <QuoteCard
                      key={group.key} quoteGroup={group} dealId={deal.id}
                      isBooked={isBooked} isLost={isLost}
                      expanded={expandedQuote===group.key}
                      onToggle={()=>setExpandedQuote(expandedQuote===group.key?null:group.key)}
                      onMarkSent={()=>markQuoteSent(group.quoteIds, group.quoteRef)}
                      onDelete={()=>deleteQuote(group.quoteIds, group.quoteRef)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ACTIVITY TAB */}
          {tab==='activity' && (
            <div>
              <div style={{ fontFamily:'Instrument Serif, serif', fontSize:'17px', marginBottom:'16px' }}>Activity Timeline</div>
              {acts.length===0
                ? <div className="card empty-state"><div style={{ fontSize:'13px', color:'var(--text-muted)' }}>No activity yet</div></div>
                : <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>{acts.map(a=><ActivityItem key={a.id} act={a}/>)}</div>}
            </div>
          )}

          {/* BOOKING TAB */}
          {tab==='booking' && (
            <div>
              {hasBook ? (
                <div className="card" style={{ padding:'24px', textAlign:'center' }}>
                  <div style={{ fontSize:'36px', marginBottom:'12px' }}>🎉</div>
                  <div style={{ fontFamily:'Instrument Serif, serif', fontSize:'20px', marginBottom:'8px' }}>Booking {deal.bookings![0].booking_reference}</div>
                  <div style={{ fontSize:'13px', color:'var(--text-muted)', marginBottom:'16px' }}>This deal has been confirmed</div>
                  <Link href="/bookings"><button className="btn btn-primary">Open Booking →</button></Link>
                </div>
              ) : !isBooked ? (
                <div className="card empty-state">
                  <div style={{ fontSize:'28px' }}>✦</div>
                  <div className="empty-state-title">Not booked yet</div>
                  <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>Mark this deal as booked to create a confirmed booking</div>
                  {!isLost && <button className="btn btn-success" style={{ marginTop:'14px' }} onClick={markBooked} disabled={marking}>{marking?'Creating…':'🎉 Mark Booked'}</button>}
                </div>
              ) : null}
            </div>
          )}
        </div>

        {/* SIDEBAR */}
        <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
          <div className="card" style={{ padding:'18px' }}>
            <div style={{ fontFamily:'Instrument Serif, serif', fontSize:'16px', marginBottom:'14px' }}>Ownership</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'4px' }}>Assigned Consultant</div>
                <div style={{ fontSize:'14px', fontWeight:'500', color:'var(--text-primary)' }}>{assignedStaff?.name || 'Unassigned'}</div>
                <div style={{ fontSize:'12px', color:'var(--text-muted)', marginTop:'2px' }}>{assignedStaff?.role || 'Needs assignment for reporting'}</div>
              </div>

              {(clientOwnerMismatch || bookingOwnerMismatch) && (
                <div style={{ background:'#fff7ed', border:'1px solid #fdba74', borderRadius:'10px', padding:'10px 12px', fontSize:'12px', color:'#9a3412', lineHeight:1.55 }}>
                  Ownership is out of sync across this client, deal or booking. Realigning here updates the full chain.
                </div>
              )}

              {isManager(currentStaff) ? (
                <>
                  <div>
                    <label className="label">Manager Reassign</label>
                    <select className="input" value={ownerDraft} onChange={e => setOwnerDraft(e.target.value)}>
                      <option value="">Select consultant…</option>
                      {staffUsers.map(staff => <option key={staff.id} value={String(staff.id)}>{staff.name} · {staff.role || 'staff'}</option>)}
                    </select>
                  </div>
                  <button className="btn btn-secondary" onClick={saveOwnership} disabled={savingOwner || !ownerDraft}>
                    {savingOwner ? 'Saving…' : 'Update Ownership'}
                  </button>
                </>
              ) : (
                <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>
                  Ownership is manager-controlled and stays sticky to the client.
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding:'18px' }}>
            <div style={{ fontFamily:'Instrument Serif, serif', fontSize:'16px', marginBottom:'14px' }}>◎ Next Action</div>
            <div style={{ marginBottom:'10px' }}>
              <label className="label">What needs to be done? <span style={{ color:'var(--red)' }}>*</span></label>
              <input
                className="input"
                type="text"
                placeholder="e.g. Call – discuss Sugar Beach vs Ambre"
                value={nextActNote}
                onChange={e=>setNextActNote(e.target.value)}
                style={{ borderColor: nextActNote.trim() ? undefined : 'var(--border)' }}
              />
            </div>
            <div style={{ marginBottom:'10px' }}>
              <label className="label">Action Type <span style={{ color:'var(--red)' }}>*</span></label>
              <select className="input" value={nextActType} onChange={e=>setNextActType(e.target.value)}>
                <option value="">Select…</option>
                {NEXT_ACTION_TYPES.map(t=><option key={t} value={t}>{ACT_ICONS[t] || '*'} {t.charAt(0)+t.slice(1).toLowerCase().replace('_',' ')}</option>)}
              </select>
            </div>
            <div style={{ marginBottom:'12px' }}>
              <label className="label">Due Date <span style={{ color:'var(--red)' }}>*</span></label>
              <input className="input" type="date" value={nextActDate} onChange={e=>setNextActDate(e.target.value)}/>
            </div>
            <button onClick={saveNextAction} disabled={savingNext}
              style={{ width:'100%', padding:'9px', borderRadius:'8px', border:'none', cursor:'pointer', fontSize:'13px', fontFamily:'DM Sans, sans-serif', fontWeight:'500', background:nextSaved?'var(--green)':'var(--accent)', color:'white', transition:'background 0.3s' }}>
              {savingNext?'Saving…':nextSaved?'✓ Saved!':'Save Next Action'}
            </button>
          </div>

          {client && (
            <div className="card" style={{ padding:'18px' }}>
              <div style={{ fontFamily:'Instrument Serif, serif', fontSize:'16px', marginBottom:'14px' }}>◑ Client</div>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'12px' }}>
                <div style={{ width:'38px', height:'38px', borderRadius:'50%', background:'var(--accent)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'14px', fontFamily:'Instrument Serif, serif', flexShrink:0 }}>
                  {(client.first_name?.[0]||'')+(client.last_name?.[0]||'')}
                </div>
                <div>
                  <div style={{ fontSize:'14px', fontWeight:'500', color:'var(--text-primary)' }}>{client.first_name} {client.last_name}</div>
                  <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>{client.email}</div>
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px', marginBottom:'12px' }}>
                {client.phone && <>
                  <a href={`tel:${client.phone}`} className="btn btn-secondary btn-sm" style={{ textDecoration:'none', flex:1, justifyContent:'center', display:'flex', alignItems:'center' }}>📞 Call</a>
                  <a href={`https://wa.me/${client.phone.replace(/\D/g,'')}`} target="_blank" style={{ textDecoration:'none', flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:'5px 10px', borderRadius:'6px', background:'#e8f9ef', color:'#1a9e52', fontSize:'12px', fontWeight:'500', fontFamily:'DM Sans, sans-serif' }}>💬 WhatsApp</a>
                </>}
              </div>
              <Link href={`/clients?id=${client.id}`} style={{ fontSize:'12.5px', color:'var(--accent)', textDecoration:'none' }}>View full profile →</Link>
            </div>
          )}

          <div className="card" style={{ padding:'18px' }}>
            <div style={{ fontFamily:'Instrument Serif, serif', fontSize:'16px', marginBottom:'14px' }}>Deal Info</div>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px', fontSize:'13px' }}>
              {dealInfoRows.map(f=>(
                <div key={f.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ color:'var(--text-muted)' }}>{f.label}</span>
                  <span style={{ fontWeight:'500', color:f.color||'var(--text-primary)' }}>{f.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Lost modal */}
      {showLostModal && (
        <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)setShowLost(false)}}>
          <div className="modal" style={{ maxWidth:'440px' }}>
            <div className="modal-title">Mark Deal as Lost</div>
            <div style={{ fontSize:'13.5px', color:'var(--text-muted)', marginBottom:'14px' }}>What was the reason? This helps track patterns over time.</div>
            <label className="label">Lost Reason</label>
            <textarea className="input" style={{ minHeight:'80px', resize:'vertical', marginBottom:'16px' }} placeholder="e.g. Went with competitor, budget too low, no response…" value={lostReason} onChange={e=>setLostReason(e.target.value)}/>
            <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
              <button className="btn btn-secondary" onClick={()=>setShowLost(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={markLost} disabled={!lostReason.trim()}>Mark as Lost</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type==='error'?'error':'success'}`}>{toast.msg}</div>}
    </div>
  )
}

// ── QUOTE CARD ────────────────────────────────────────────
function QuoteCard({ quoteGroup, dealId, isBooked, isLost, expanded, onToggle, onMarkSent, onDelete }:{
  quoteGroup:QuoteGroup; dealId:number; isBooked:boolean; isLost:boolean;
  expanded:boolean; onToggle:()=>void; onMarkSent:()=>void; onDelete:()=>void;
}) {
  const quote = quoteGroup.quote
  const fmt = (n:number) => '£'+(n||0).toLocaleString('en-GB',{maximumFractionDigits:0})
  const marginColor = (quote.margin_percent||0)>=10?'var(--green)':(quote.margin_percent||0)>=7?'var(--amber)':'var(--red)'
  const outLegs = quote.flight_details?.outbound||[]
  const retLegs = quote.flight_details?.return||[]
  const allLegs = [...outLegs,...retLegs]
  const costs   = quote.cost_breakdown||{}

  const checkinDisplay = quote.checkin_date
    ? quote.checkin_next_day
      ? (() => { const d=new Date(quote.checkin_date+'T12:00'); d.setDate(d.getDate()+1); return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'}) })()
      : new Date(quote.checkin_date+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
    : '—'

  return (
    <div className="card" style={{ overflow:'hidden' }}>
      {/* Quote header — always visible */}
      <div style={{ padding:'16px 20px', cursor:'pointer' }} onClick={onToggle}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div style={{ flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
              <span style={{ fontFamily:'monospace', fontSize:'12px', fontWeight:'700', color:'var(--accent)', background:'var(--accent-light)', padding:'2px 8px', borderRadius:'4px' }}>{quoteGroup.quoteRef}</span>
              {quoteGroup.optionCount>1 && <span style={{ fontSize:'11px', color:'var(--text-muted)', fontWeight:'600' }}>{quoteGroup.optionCount} options</span>}
              {quote.sent_to_client && <span style={{ fontSize:'11px', color:'var(--green)', fontWeight:'600' }}>✓ Sent to client</span>}
              <span style={{ fontSize:'11px', color:'var(--text-muted)', marginLeft:'auto' }}>{new Date(quote.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</span>
            </div>
            <div style={{ fontFamily:'Instrument Serif, serif', fontSize:'18px', color:'var(--text-primary)', marginBottom:'4px' }}>
              {quote.hotel}
            </div>
            <div style={{ fontSize:'12px', color:'var(--text-muted)', display:'flex', gap:'8px', flexWrap:'wrap' }}>
              {quote.board_basis && <span>{quote.board_basis}</span>}
              {quote.nights && <span>· {quote.nights} nights</span>}
              {quote.room_type && <span>· {quote.room_type}</span>}
              {checkinDisplay!=='—' && <span>· Check-in {checkinDisplay}</span>}
              {quote.adults && <span>· {quote.adults} adult{quote.adults>1?'s':''}{(quote.children??0)>0?`, ${quote.children} child${quote.children!==1?'ren':''}${Array.isArray(quote.child_ages)&&quote.child_ages.length===(quote.children??0)?` (ages ${quote.child_ages.join(', ')})`:''}`:''}{ (quote.infants??0)>0?`, ${quote.infants} infant${quote.infants!==1?'s':''}`:''}</span>}
            </div>
          </div>
          <div style={{ textAlign:'right', marginLeft:'16px' }}>
            <div style={{ fontFamily:'Instrument Serif, serif', fontSize:'26px', color:'var(--green)' }}>{fmt(quote.price||0)}</div>
            <div style={{ fontSize:'12px', marginTop:'2px' }}>
              <span style={{ color:'var(--gold)' }}>Profit: {fmt(quote.profit||0)}</span>
              <span style={{ color:marginColor, marginLeft:'6px', fontWeight:'600' }}>({(quote.margin_percent||0).toFixed(1)}%)</span>
            </div>
            <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>{expanded?'▴ Less':'▾ More details'}</div>
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div style={{ borderTop:'1px solid var(--border)', padding:'16px 20px', background:'var(--bg-tertiary)' }}>
          {quoteGroup.optionCount>1 && (
            <div style={{ marginBottom:'16px', padding:'10px 12px', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'8px', fontSize:'12px', color:'var(--text-muted)' }}>
              This quote currently contains {quoteGroup.optionCount} client-facing options under the same quote reference.
            </div>
          )}

          {/* Flights */}
          {allLegs.length>0 && allLegs.some(l=>l.date||l.depart_time) && (
            <div style={{ marginBottom:'16px' }}>
              <div style={{ fontSize:'12px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>Flights</div>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {allLegs.map((l, i)=>(
                  <div key={i} style={{ display:'flex', gap:'12px', fontSize:'12.5px', padding:'8px 12px', background:'var(--surface)', borderRadius:'6px', alignItems:'center' }}>
                    <span style={{ color:'var(--text-muted)', width:'16px' }}>{i<outLegs.length?'✈':'↩'}</span>
                    <span style={{ fontWeight:'600', color:'var(--text-primary)', minWidth:'80px' }}>{l.from} → {l.to}</span>
                    <span style={{ color:'var(--text-muted)' }}>{l.date?new Date(l.date+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}):''}</span>
                    <span style={{ fontFamily:'monospace', color:'var(--text-secondary)' }}>{l.depart_time||''}{l.arrival_time?' → '+l.arrival_time:''}{l.overnight?' (+1)':''}</span>
                    <span style={{ color:'var(--text-muted)' }}>{l.airline}</span>
                    <span style={{ color:'var(--text-muted)' }}>{l.cabin}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost breakdown */}
          {(costs.flight_net||costs.acc_net||costs.trans_net||costs.total_net) && (
            <div style={{ marginBottom:'16px' }}>
              <div style={{ fontSize:'12px', fontWeight:'600', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'8px' }}>Internal Costs</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
                {[
                  { label:'Flights',   val:costs.flight_net },
                  { label:'Accomm.',   val:costs.acc_net    },
                  { label:'Transfers', val:costs.trans_net  },
                  { label:'Total Net', val:costs.total_net  },
                ].filter(c=>c.val).map(c=>(
                  <div key={c.label} style={{ padding:'8px 10px', background:'var(--surface)', borderRadius:'6px', textAlign:'center' }}>
                    <div style={{ fontSize:'10px', color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.04em', marginBottom:'3px' }}>{c.label}</div>
                    <div style={{ fontSize:'14px', fontWeight:'600', color:'var(--text-primary)' }}>£{(c.val||0).toLocaleString('en-GB',{maximumFractionDigits:0})}</div>
                  </div>
                ))}
              </div>
              {costs.extras?.length>0 && (
                <div style={{ marginTop:'8px', fontSize:'12px', color:'var(--text-muted)' }}>
                  Extras: {costs.extras.map(e=>`${e.label} (£${e.net})`).join(' · ')}
                </div>
              )}
            </div>
          )}

          {/* Additional services */}
          {quote.additional_services && (
            <div style={{ marginBottom:'16px', padding:'12px 14px', background:'#f0f7f0', border:'1px solid #c3dfc3', borderRadius:'8px' }}>
              <div style={{ fontSize:'11px', fontWeight:'600', color:'#2d6a2d', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:'6px' }}>Additional Services (shown to client)</div>
              <div style={{ fontSize:'13px', color:'#444', lineHeight:'1.6', whiteSpace:'pre-wrap' }}>{quote.additional_services}</div>
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {!isBooked && !isLost && (
              <Link href={`/quotes/new?deal=${dealId}&quote=${quote.id}`}>
                <button className="btn btn-secondary btn-sm">✏ Edit Quote</button>
              </Link>
            )}
            {!quote.sent_to_client && !isBooked && !isLost && (
              <button className="btn btn-primary btn-sm" onClick={onMarkSent}>✓ Mark as Sent</button>
            )}
            {quote.sent_to_client && (
              <span style={{ fontSize:'12px', color:'var(--green)', fontWeight:'500', alignSelf:'center' }}>✓ Sent to client</span>
            )}
            {!isBooked && (
              <button className="btn btn-danger btn-sm" onClick={onDelete} style={{ marginLeft:'auto' }}>🗑 Delete</button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── ACTIVITY ITEM ─────────────────────────────────────────
function ActivityItem({ act }:{ act:Activity }) {
  const color = ACT_COLORS[act.activity_type]||'var(--text-muted)'
  const label = ACT_LABELS[act.activity_type]||act.activity_type
  return (
    <div style={{ display:'flex', gap:'12px', padding:'12px 14px', background:'var(--bg-tertiary)', borderRadius:'8px', borderLeft:`3px solid ${color}` }}>
      <div style={{ flex:1 }}>
        <div style={{ fontSize:'12.5px', fontWeight:'600', color, marginBottom:'3px' }}>{label}</div>
        {act.notes && <div style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:'1.5', whiteSpace:'pre-wrap' }}>{act.notes}</div>}
        <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>
          {new Date(act.created_at).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'})}
        </div>
      </div>
    </div>
  )
}
