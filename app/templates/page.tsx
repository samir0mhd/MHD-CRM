'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Template = {
  id: number
  name: string
  description: string
  subject_line: string
  opening_hook: string
  why_choose_us: string
  urgency_notice: string
  closing_cta: string
  is_built_in: boolean
  created_at: string
}

// ── BUILT-IN TEMPLATES (locked, read-only) ────────────────
const BUILT_INS = [
  {
    id: -1,
    name: 'The Dream Seller',
    description: 'Opens with vivid Mauritius imagery. Sells the experience first, details second. Best for new enquiries.',
    subject_line: 'Your Mauritius Holiday Quote — [Client Name]',
    opening_hook: `Imagine waking up to the sound of the Indian Ocean, stepping onto your private terrace as the Mauritian sun rises over a turquoise lagoon. This is the holiday I've crafted for you.

Thank you for entrusting us with your dream holiday to Mauritius. I've personally curated this quote for you, selecting [Hotel Name] — one of the finest resorts on the island — because I believe it perfectly matches what you're looking for.`,
    why_choose_us: `• 25 Years of Expertise — Specialists in Mauritius since 1999. We know every resort intimately.
• Best Price Guarantee — Find it cheaper within 72 hours and we'll refund the difference.
• Fully Protected — ABTA · IATA · ATOL Protected (5744). Your money is 100% safe.
• 5-Star Rated — Award-winning service on Trustpilot. Thousands of happy clients.`,
    urgency_notice: `Mauritius is one of the world's most sought-after destinations, and availability at [Hotel Name] moves quickly — particularly during this period. I'd recommend securing your place sooner rather than later to avoid disappointment.`,
    closing_cta: `I'm available to speak with you directly if you have any questions — call me on 020 8951 6922 or reply to this email. I'd love to help make this holiday a reality for you.`,
    is_built_in: true,
    created_at: '',
  },
  {
    id: -2,
    name: 'The Trusted Expert',
    description: 'Leads with 25 years of expertise and credentials. Reassuring and authoritative. Best for first-time enquirers.',
    subject_line: 'Your Personalised Mauritius Quote from Samir Abattouy',
    opening_hook: `My name is Samir Abattouy. For over 25 years I have specialised exclusively in Mauritius — I have visited the island many times, stayed at over 40 resorts personally, and arranged holidays for thousands of clients. When I prepare a quote, it reflects genuine expertise, not a generic package.

Having considered your requirements carefully, I have selected [Hotel Name] on [Board Basis] — and I'm confident this is the right choice for you.`,
    why_choose_us: `• 25 Years of Expertise — Specialists in Mauritius since 1999. We know every resort intimately.
• Best Price Guarantee — Find it cheaper within 72 hours and we'll refund the difference.
• Fully Protected — ABTA · IATA · ATOL Protected (5744). Your money is 100% safe.
• 5-Star Rated — Award-winning service on Trustpilot. Thousands of happy clients.`,
    urgency_notice: '',
    closing_cta: `I'm available to speak with you directly — a 10-minute call is often all it takes to answer everything and get you booked. Please call me on 020 8951 6922 or reply to this email.`,
    is_built_in: true,
    created_at: '',
  },
  {
    id: -3,
    name: 'The Urgency Close',
    description: 'Acknowledges the quote and immediately drives action. Best for warm leads going cold.',
    subject_line: 'Your Mauritius Quote is Ready — Prices Subject to Change',
    opening_hook: `Thank you for your enquiry. I've prepared your complete holiday quote below for [Hotel Name], [Nights] nights on [Board Basis]. Everything is ready — all we need from you is a 10% deposit to lock in this price and availability today.`,
    why_choose_us: `• 25 Years of Expertise — Specialists in Mauritius since 1999.
• Best Price Guarantee — Find it cheaper within 72 hours and we'll refund the difference.
• Fully Protected — ABTA · IATA · ATOL Protected (5744). Your money is 100% safe.
• 5-Star Rated — Award-winning service on Trustpilot.`,
    urgency_notice: `⚠ Important: This quote is based on current flight and hotel availability. Prices at [Hotel Name] for your dates are subject to change — and in our experience, they rarely go down. We strongly recommend confirming at your earliest convenience.`,
    closing_cta: `To confirm your holiday today:
1. Reply to this email or call me on 020 8951 6922
2. Pay your 10% deposit by card or bank transfer
3. Receive your booking confirmation and ATOL certificate within 24 hours`,
    is_built_in: true,
    created_at: '',
  },
  {
    id: -4,
    name: 'The VIP Treatment',
    description: 'Positions the client as receiving a personally curated quote. Bespoke and exclusive. Best for high-value deals.',
    subject_line: 'Your Bespoke Mauritius Itinerary — Prepared Exclusively for You',
    opening_hook: `This is not an off-the-shelf package. What follows is a personally curated Mauritius itinerary, prepared exclusively for you by our senior Indian Ocean specialist, based on your specific preferences and travel dates.

[Hotel Name] was selected from our portfolio of over 57 Mauritius resorts because it represents an exceptional combination of location, service, and value for your party.`,
    why_choose_us: `• Personal Consultant — Samir handles your booking personally from enquiry to return.
• Airport Meet & Greet — Our representative meets you on arrival in Mauritius.
• 24/7 In-Resort Support — Direct line to us throughout your holiday.
• Full Financial Protection — ABTA · IATA · ATOL 5744. Your investment is fully safeguarded.`,
    urgency_notice: '',
    closing_cta: `I am personally available to discuss this itinerary with you at your convenience. Please call me directly on 020 8951 6922, WhatsApp me on 07881 551204, or schedule a call at your preferred time via calendly.com/mauritiusexpert`,
    is_built_in: true,
    created_at: '',
  },
]

const SECTION_LABELS: Record<string, string> = {
  opening_hook:   'Opening Hook',
  why_choose_us:  'Why Choose Us',
  urgency_notice: 'Urgency / Availability Notice',
  closing_cta:    'Closing & Call to Action',
}

const PLACEHOLDERS: Record<string, string> = {
  opening_hook:   'The opening paragraph(s) that greet the client and set the tone…',
  why_choose_us:  'Bullet points or paragraphs explaining why they should book with MHD…',
  urgency_notice: 'Optional — urgency message about availability or price validity…',
  closing_cta:    'Final paragraph with instructions on how to confirm or get in touch…',
}

const fmt = (d: string) => d ? new Date(d).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }) : ''

export default function TemplatesPage() {
  const [customs, setCustoms]       = useState<Template[]>([])
  const [loading, setLoading]       = useState(true)
  const [editingId, setEditingId]   = useState<number|'new'|null>(null)
  const [viewingBuiltIn, setViewing] = useState<typeof BUILT_INS[0]|null>(null)
  const [toast, setToast]           = useState<{msg:string;type:'success'|'error'}|null>(null)
  const [deleting, setDeleting]     = useState<number|null>(null)

  // Form state
  const [form, setForm] = useState({
    name:'', description:'', subject_line:'',
    opening_hook:'', why_choose_us:'', urgency_notice:'', closing_cta:'',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('email_templates').select('*').eq('is_built_in', false).order('created_at', { ascending: false })
    setCustoms(data || [])
    setLoading(false)
  }

  function showToast(msg: string, type: 'success'|'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  function openNew() {
    setForm({ name:'', description:'', subject_line:'', opening_hook:'', why_choose_us:'', urgency_notice:'', closing_cta:'' })
    setEditingId('new')
    setViewing(null)
  }

  function openEdit(t: Template) {
    setForm({ name:t.name, description:t.description||'', subject_line:t.subject_line||'', opening_hook:t.opening_hook||'', why_choose_us:t.why_choose_us||'', urgency_notice:t.urgency_notice||'', closing_cta:t.closing_cta||'' })
    setEditingId(t.id)
    setViewing(null)
  }

  function duplicateBuiltIn(t: typeof BUILT_INS[0]) {
    setForm({ name:`${t.name} (Custom)`, description:t.description, subject_line:t.subject_line, opening_hook:t.opening_hook, why_choose_us:t.why_choose_us, urgency_notice:t.urgency_notice, closing_cta:t.closing_cta })
    setEditingId('new')
    setViewing(null)
  }

  async function handleSave() {
    if (!form.name.trim()) { showToast('Template name is required', 'error'); return }
    if (!form.opening_hook.trim()) { showToast('Opening hook is required', 'error'); return }
    setSaving(true)
    if (editingId === 'new') {
      const { error } = await supabase.from('email_templates').insert({ ...form, is_built_in: false })
      if (error) { showToast('Failed to save: '+error.message, 'error'); setSaving(false); return }
      showToast('Template saved ✓')
    } else {
      const { error } = await supabase.from('email_templates').update({ ...form, updated_at: new Date().toISOString() }).eq('id', editingId)
      if (error) { showToast('Failed to update: '+error.message, 'error'); setSaving(false); return }
      showToast('Template updated ✓')
    }
    setSaving(false)
    setEditingId(null)
    load()
  }

  async function handleDelete(id: number) {
    setDeleting(id)
    await supabase.from('email_templates').delete().eq('id', id)
    showToast('Template deleted')
    setDeleting(null)
    load()
  }

  // ── EDIT / NEW FORM ──────────────────────────────────────
  if (editingId !== null) {
    const isNew = editingId === 'new'
    return (
      <div>
        <div className="page-header">
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <button onClick={() => setEditingId(null)} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'13px', cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>← Templates</button>
            <div style={{ width:'1px', height:'20px', background:'var(--border)' }}/>
            <div>
              <div className="page-title">{isNew ? 'New Template' : 'Edit Template'}</div>
              <div style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>Custom templates are available in the Quote Builder</div>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            <button className="btn btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
            <button className="btn btn-cta" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isNew ? 'Save Template' : 'Update Template'}</button>
          </div>
        </div>

        <div className="page-body" style={{ maxWidth:'820px' }}>
          {/* Name & description */}
          <div className="card" style={{ padding:'20px 24px', marginBottom:'16px' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:'17px', fontWeight:'300', marginBottom:'16px' }}>Template Details</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Template Name *</label>
                <input className="input" placeholder="e.g. Honeymoon Special, Repeat Client Warm…" value={form.name} onChange={e => setForm(p=>({...p,name:e.target.value}))}/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Description <span style={{ fontWeight:'400', textTransform:'none', letterSpacing:'0' }}>(shown in quote builder picker)</span></label>
                <input className="input" placeholder="e.g. Warm tone for returning clients, focuses on relationship…" value={form.description} onChange={e => setForm(p=>({...p,description:e.target.value}))}/>
              </div>
              <div style={{ gridColumn:'1/-1' }}>
                <label className="label">Email Subject Line</label>
                <input className="input" placeholder="e.g. Your Mauritius Holiday Quote — [Client Name]" value={form.subject_line} onChange={e => setForm(p=>({...p,subject_line:e.target.value}))}/>
                <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'4px' }}>Use [Client Name], [Hotel Name], [Nights], [Board Basis] as placeholders — auto-filled when sending</div>
              </div>
            </div>
          </div>

          {/* Content sections */}
          {(['opening_hook','why_choose_us','urgency_notice','closing_cta'] as const).map(field => (
            <div key={field} className="card" style={{ padding:'20px 24px', marginBottom:'14px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'10px' }}>
                <div>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', marginBottom:'2px' }}>{SECTION_LABELS[field]}</div>
                  {field==='urgency_notice'&&<div style={{ fontSize:'12px', color:'var(--text-muted)' }}>Optional — leave blank to omit from email</div>}
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  {/* Quick insert placeholder buttons */}
                  {['[Client Name]','[Hotel Name]','[Nights]','[Board Basis]'].map(ph=>(
                    <button key={ph} onClick={()=>setForm(p=>({...p,[field]:p[field]+(p[field]?'\n':'')+ph}))}
                      style={{ padding:'3px 8px', borderRadius:'4px', border:'1px solid var(--border)', background:'var(--bg-tertiary)', color:'var(--text-muted)', fontSize:'10.5px', cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>
                      {ph}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                className="input"
                style={{ minHeight: field==='opening_hook'?'140px':field==='why_choose_us'?'120px':'100px', resize:'vertical', fontFamily:'Outfit,sans-serif', fontSize:'13.5px', lineHeight:'1.7' }}
                placeholder={PLACEHOLDERS[field]}
                value={(form as any)[field]}
                onChange={e => setForm(p=>({...p,[field]:e.target.value}))}
              />
            </div>
          ))}

          {/* Preview */}
          <div className="card" style={{ padding:'20px 24px', marginBottom:'16px' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', marginBottom:'14px' }}>Preview</div>
            <div style={{ background:'white', border:'1px solid #ddd', borderRadius:'8px', overflow:'hidden', fontFamily:'Arial,sans-serif', fontSize:'13px', lineHeight:'1.7', color:'#333' }}>
              <div style={{ background:'#1a3a5c', padding:'18px 24px', textAlign:'center' }}>
                <div style={{ color:'#c9963a', fontFamily:'Georgia,serif', fontSize:'18px', letterSpacing:'0.08em', fontWeight:'bold' }}>MAURITIUS HOLIDAYS DIRECT</div>
                <div style={{ color:'rgba(255,255,255,0.45)', fontSize:'10px', marginTop:'3px', letterSpacing:'0.14em' }}>YOUR LUXURY MAURITIUS SPECIALIST · EST. 1999</div>
              </div>
              <div style={{ padding:'24px 28px' }}>
                {form.subject_line&&<div style={{ fontSize:'11px', color:'#999', marginBottom:'16px', fontStyle:'italic' }}>Subject: {form.subject_line}</div>}
                <p style={{ marginBottom:'14px' }}><strong>Dear [Client Name],</strong></p>
                {form.opening_hook&&<p style={{ marginBottom:'16px', whiteSpace:'pre-wrap' }}>{form.opening_hook}</p>}
                {form.urgency_notice&&(
                  <div style={{ background:'#fff4e5', border:'1px solid #f0a830', borderRadius:'6px', padding:'10px 14px', marginBottom:'16px', fontSize:'12px' }}>
                    <strong style={{ color:'#c07000' }}>⚠ Note: </strong>{form.urgency_notice}
                  </div>
                )}
                <div style={{ background:'#f8f8f6', borderRadius:'6px', padding:'14px 16px', marginBottom:'16px', fontSize:'12px' }}>
                  <div style={{ fontWeight:'bold', marginBottom:'8px' }}>Why Choose Us?</div>
                  <div style={{ whiteSpace:'pre-wrap', color:'#555' }}>{form.why_choose_us||'[Why choose us section]'}</div>
                </div>
                <p style={{ marginBottom:'14px', whiteSpace:'pre-wrap' }}>{form.closing_cta||'[Closing call to action]'}</p>
                <div style={{ borderTop:'1px solid #eee', paddingTop:'14px', fontSize:'12px', color:'#666' }}>
                  <div style={{ fontFamily:'Georgia,serif', fontSize:'16px', color:'#1a3a5c', marginBottom:'2px' }}>Samir Abattouy</div>
                  <div style={{ color:'#c9963a', fontStyle:'italic', marginBottom:'8px', fontSize:'11px' }}>Mauritius Expert · Senior Travel Consultant</div>
                  <div>📞 020 8951 6922 · 📱 07881 551204 · ✉ samir@mauritiusholidaysdirect.co.uk</div>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setEditingId(null)}>Cancel</button>
            <button className="btn btn-cta" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : isNew ? 'Save Template' : 'Update Template'}</button>
          </div>
        </div>

        {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
      </div>
    )
  }

  // ── VIEW BUILT-IN ─────────────────────────────────────────
  if (viewingBuiltIn) {
    return (
      <div>
        <div className="page-header">
          <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
            <button onClick={() => setViewing(null)} style={{ background:'none', border:'none', color:'var(--text-muted)', fontSize:'13px', cursor:'pointer', fontFamily:'Outfit,sans-serif' }}>← Templates</button>
            <div style={{ width:'1px', height:'20px', background:'var(--border)' }}/>
            <div>
              <div className="page-title">{viewingBuiltIn.name}</div>
              <div style={{ fontSize:'12.5px', color:'var(--text-muted)' }}>Built-in template — read only</div>
            </div>
          </div>
          <button className="btn btn-cta" onClick={() => duplicateBuiltIn(viewingBuiltIn)}>⧉ Duplicate & Customise</button>
        </div>

        <div className="page-body" style={{ maxWidth:'820px' }}>
          <div style={{ background:'var(--amber-light)', border:'1px solid var(--border)', borderRadius:'10px', padding:'12px 16px', marginBottom:'20px', fontSize:'13px', color:'var(--amber)', display:'flex', alignItems:'center', gap:'10px' }}>
            <span style={{ fontSize:'16px' }}>🔒</span>
            <span>Built-in templates are locked. Click <strong>Duplicate & Customise</strong> to create an editable copy.</span>
          </div>

          {(['opening_hook','why_choose_us','urgency_notice','closing_cta'] as const).map(field => {
            const val = (viewingBuiltIn as any)[field]
            if (!val) return null
            return (
              <div key={field} className="card" style={{ padding:'18px 22px', marginBottom:'12px' }}>
                <div style={{ fontFamily:'Fraunces,serif', fontSize:'15px', fontWeight:'300', color:'var(--text-muted)', marginBottom:'8px' }}>{SECTION_LABELS[field]}</div>
                <div style={{ fontSize:'13.5px', lineHeight:'1.75', color:'var(--text-primary)', whiteSpace:'pre-wrap', fontFamily:'Outfit,sans-serif' }}>{val}</div>
              </div>
            )
          })}

          <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'8px' }}>
            <button className="btn btn-cta" onClick={() => duplicateBuiltIn(viewingBuiltIn)}>⧉ Duplicate & Customise</button>
          </div>
        </div>
      </div>
    )
  }

  // ── MAIN LIST VIEW ────────────────────────────────────────
  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">Email Templates</div>
          <div style={{ fontSize:'12.5px', color:'var(--text-muted)', marginTop:'2px' }}>
            {BUILT_INS.length} built-in · {customs.length} custom
          </div>
        </div>
        <button className="btn btn-cta" onClick={openNew}>+ New Template</button>
      </div>

      <div className="page-body">

        {/* Built-ins */}
        <div style={{ marginBottom:'28px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:'19px', fontWeight:'300' }}>Built-in Templates</div>
            <div style={{ background:'var(--bg-tertiary)', border:'1px solid var(--border)', borderRadius:'20px', padding:'2px 10px', fontSize:'11px', color:'var(--text-muted)', fontWeight:'600' }}>🔒 Read only</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
            {BUILT_INS.map(t => (
              <div key={t.id} className="card" style={{ padding:'18px 20px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'8px' }}>
                  <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', color:'var(--text-primary)' }}>{t.name}</div>
                  <div style={{ display:'flex', gap:'6px' }}>
                    <button className="btn btn-secondary btn-sm" onClick={() => setViewing(t)}>View</button>
                    <button className="btn btn-primary btn-sm" onClick={() => duplicateBuiltIn(t)}>⧉ Copy</button>
                  </div>
                </div>
                <div style={{ fontSize:'13px', color:'var(--text-muted)', lineHeight:'1.5', marginBottom:'10px' }}>{t.description}</div>
                <div style={{ fontSize:'12px', color:'var(--text-secondary)', background:'var(--bg-tertiary)', borderRadius:'6px', padding:'8px 10px', fontStyle:'italic' }}>
                  "{t.opening_hook.split('\n')[0].slice(0,120)}{t.opening_hook.length>120?'…':''}"
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Custom templates */}
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <div style={{ fontFamily:'Fraunces,serif', fontSize:'19px', fontWeight:'300' }}>Custom Templates</div>
            <button className="btn btn-secondary btn-sm" onClick={openNew}>+ New Template</button>
          </div>

          {loading ? (
            <div style={{ color:'var(--text-muted)', fontSize:'13px', padding:'20px 0' }}>Loading…</div>
          ) : customs.length === 0 ? (
            <div className="card empty-state">
              <div className="empty-state-icon">◇</div>
              <div className="empty-state-title">No custom templates yet</div>
              <div className="empty-state-desc">Duplicate a built-in to start customising, or create one from scratch.</div>
              <div style={{ display:'flex', gap:'10px', justifyContent:'center', marginTop:'16px' }}>
                <button className="btn btn-secondary" onClick={() => duplicateBuiltIn(BUILT_INS[0])}>⧉ Duplicate Dream Seller</button>
                <button className="btn btn-cta" onClick={openNew}>+ New from Scratch</button>
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {customs.map(t => (
                <div key={t.id} className="card" style={{ padding:'16px 20px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'4px' }}>
                        <div style={{ fontFamily:'Fraunces,serif', fontSize:'16px', fontWeight:'300', color:'var(--text-primary)' }}>{t.name}</div>
                        <span style={{ fontSize:'10px', color:'var(--text-muted)', background:'var(--bg-tertiary)', padding:'2px 7px', borderRadius:'4px', fontWeight:'600' }}>CUSTOM</span>
                      </div>
                      {t.description&&<div style={{ fontSize:'13px', color:'var(--text-muted)', marginBottom:'6px' }}>{t.description}</div>}
                      {t.subject_line&&<div style={{ fontSize:'12px', color:'var(--text-secondary)', marginBottom:'6px' }}>Subject: <em>{t.subject_line}</em></div>}
                      {t.opening_hook&&(
                        <div style={{ fontSize:'12.5px', color:'var(--text-secondary)', background:'var(--bg-tertiary)', borderRadius:'6px', padding:'8px 10px', fontStyle:'italic', lineHeight:'1.5' }}>
                          "{t.opening_hook.split('\n')[0].slice(0,140)}{t.opening_hook.length>140?'…':''}"
                        </div>
                      )}
                      <div style={{ fontSize:'11px', color:'var(--text-muted)', marginTop:'6px' }}>Created {fmt(t.created_at)}</div>
                    </div>
                    <div style={{ display:'flex', gap:'6px', marginLeft:'16px', flexShrink:0 }}>
                      <button className="btn btn-secondary btn-sm" onClick={() => openEdit(t)}>✏ Edit</button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => handleDelete(t.id)}
                        disabled={deleting===t.id}>
                        {deleting===t.id?'…':'Delete'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast&&<div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
