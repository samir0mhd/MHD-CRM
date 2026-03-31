'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

// ── CONSTANTS ─────────────────────────────────────────────
const AIRPORTS    = ['LGW','LHR','MAN','BHX','EDI','GLA','BRS','LTN','STN','NCL','LBA','EMA','DXB','AUH','SIN','CPT','JNB','MRU','SEZ','CMB','BKK','HKG']
const CABIN_CLASS = ['Economy','Premium Economy','Business Class','First Class']
const AIRLINES    = ['Air Mauritius','British Airways','TUI','Jet2','Virgin Atlantic','Emirates','Air France','KLM','Qatar Airways','Etihad','Singapore Airlines','Condor','Other']
const QUICK_EXTRAS = ['Airport Lounge Access','Airport Parking','Honeymoon Package','Wedding Package','Travel Insurance','Room Upgrade','Meet & Greet','Private Transfers','Car Hire','Excursion Package','Spa Credit','Legal Fees']
const CONTACT = {
  direct:'020 8951 6922', whatsapp:'07881 551204',
  email:'samir@mauritiusholidaysdirect.co.uk',
  calendly:'https://calendly.com/mauritiusexpert',
  trustpilot:'https://uk.trustpilot.com/review/www.mauritiusholidaysdirect.co.uk',
  address:'130 Burnt Oak Broadway, Edgware, Middlesex HA8 0BB',
  web:'www.mauritiusholidaysdirect.co.uk',
}

// ── TYPES ─────────────────────────────────────────────────
type FlightLeg  = { id:string; date:string; depart_time:string; checkin_time:string; arrival_time:string; airline:string; from:string; to:string; cabin:string; overnight:boolean; flight_number:string }
type ExtraItem  = { id:string; label:string; net:number }
type DealInfo   = { id:number; title:string; departure_date:string|null; clients?:{ first_name:string; last_name:string; email?:string; phone?:string } }

type HotelOption = {
  id:string; hotel:string; roomType:string; boardBasis:string; nights:string
  checkinDate:string; checkinNextDay:boolean
  outLegs:FlightLeg[]; retLegs:FlightLeg[]
  flightNet:string; accNet:string; transNet:string; extras:ExtraItem[]
  sellPrice:string; margin:string; profit:string
}

type Centre = {
  id:string; destination:string; hotel:string; roomType:string; boardBasis:string
  nights:string; checkinDate:string; checkinNextDay:boolean
  inboundLegs:FlightLeg[]; outboundLegs:FlightLeg[]
  accNet:string; flightNet:string; transNet:string; extras:ExtraItem[]
}

// ── HELPERS ───────────────────────────────────────────────
const uid  = () => Math.random().toString(36).slice(2,8)
const fmt  = (n:number) => '£'+(n||0).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})
const fmtS = (n:number) => '£'+(n||0).toLocaleString('en-GB',{maximumFractionDigits:0})
function genRef(initials:string, count:number) {
  const n=new Date(), d=String(n.getDate()).padStart(2,'0'), m=String(n.getMonth()+1).padStart(2,'0'), y=String(n.getFullYear()).slice(-2)
  return `${d}${m}${y}${(initials||'SA').toUpperCase()}${String(count+1).padStart(2,'0')}`
}
function newLeg(dir:'out'|'ret'|'in'): FlightLeg {
  return { id:uid(), date:'', depart_time:'', checkin_time:'', arrival_time:'', airline:'Air Mauritius', from:dir==='out'?'LGW':'MRU', to:dir==='out'?'MRU':'LGW', cabin:'Economy', overnight:false, flight_number:'' }
}
function addDays(dateStr:string, days:number): string {
  if (!dateStr) return ''
  const d=new Date(dateStr+'T12:00'); d.setDate(d.getDate()+days)
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
}
function fmtLegDate(d:string): string {
  if (!d) return '—'
  return new Date(d+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
}
function newHotelOption(): HotelOption {
  return { id:uid(), hotel:'', roomType:'', boardBasis:'All Inclusive', nights:'7', checkinDate:'', checkinNextDay:false, outLegs:[newLeg('out')], retLegs:[newLeg('ret')], flightNet:'', accNet:'', transNet:'', extras:[], sellPrice:'', margin:'', profit:'' }
}
function newCentre(destination='', idx=0): Centre {
  const from = idx===0?'LGW':'MRU'
  const to   = idx===0?'DXB':'MRU'
  return { id:uid(), destination, hotel:'', roomType:'', boardBasis:'All Inclusive', nights:'3', checkinDate:'', checkinNextDay:false, inboundLegs:[{...newLeg('out'), from, to}], outboundLegs:[{...newLeg('ret'), from:to, to:idx===0?'MRU':'LGW'}], accNet:'', flightNet:'', transNet:'', extras:[] }
}

// ── DB-BACKED SEARCH ──────────────────────────────────────
function DBSearch({ table, field='name', value, onChange, placeholder, extraQuery }:{ table:string; field?:string; value:string; onChange:(v:string)=>void; placeholder:string; extraQuery?:(q:any)=>any }) {
  const [q,setQ]           = useState(value)
  const [results,setRes]   = useState<string[]>([])
  const [open,setOpen]     = useState(false)
  const [saving,setSaving] = useState(false)
  const ref                = useRef<HTMLDivElement>(null)
  const timer              = useRef<any>(null)

  useEffect(()=>{ setQ(value) },[value])
  useEffect(()=>{
    const h=(e:MouseEvent)=>{ if(ref.current&&!ref.current.contains(e.target as Node))setOpen(false) }
    document.addEventListener('mousedown',h); return ()=>document.removeEventListener('mousedown',h)
  },[])

  function search(val:string){
    if(timer.current) clearTimeout(timer.current)
    timer.current=setTimeout(async()=>{
      let q2=supabase.from(table).select(field).ilike(field,`%${val}%`).order(field).limit(10)
      if(extraQuery) q2=extraQuery(q2)
      const{data}=await q2
      setRes((data||[]).map((r:any)=>r[field]))
    },200)
  }

  function handleChange(val:string){ setQ(val); onChange(val); setOpen(true); search(val) }

  async function saveNew(){
    if(!q.trim()) return
    setSaving(true)
    await supabase.from(table).insert({[field]:q.trim()})
    setSaving(false); setOpen(false); onChange(q.trim())
  }

  const showSaveNew = q.trim().length>1 && !results.includes(q.trim())

  return(
    <div ref={ref} style={{position:'relative'}}>
      <input className="input" placeholder={placeholder} value={q}
        onChange={e=>handleChange(e.target.value)}
        onFocus={()=>{ setOpen(true); search(q) }} autoComplete="off"/>
      {open&&(
        <div style={{position:'absolute',top:'100%',left:0,right:0,zIndex:400,background:'var(--surface)',border:'1.5px solid var(--border)',borderRadius:'10px',boxShadow:'var(--shadow-lg)',marginTop:'4px',maxHeight:'280px',overflowY:'auto'}}>
          {results.map(r=>(
            <div key={r} onMouseDown={()=>{ setQ(r); onChange(r); setOpen(false) }}
              style={{padding:'10px 16px',fontSize:'13.5px',cursor:'pointer',borderBottom:'1px solid var(--border)',color:'var(--text-primary)',background:r===value?'var(--accent-light)':'transparent'}}
              onMouseEnter={e=>(e.currentTarget.style.background='var(--bg-tertiary)')}
              onMouseLeave={e=>(e.currentTarget.style.background=r===value?'var(--accent-light)':'transparent')}>
              {r===value&&<span style={{color:'var(--accent)',marginRight:'8px'}}>✓</span>}{r}
            </div>
          ))}
          {showSaveNew&&(
            <div onMouseDown={saveNew}
              style={{padding:'10px 16px',fontSize:'13px',cursor:'pointer',color:'var(--accent-mid)',fontWeight:'600',borderTop:'1px solid var(--border)',background:'var(--accent-light)'}}>
              {saving?'Saving…':`+ Save "${q.trim()}" for future use`}
            </div>
          )}
          {results.length===0&&!showSaveNew&&<div style={{padding:'12px 16px',fontSize:'13px',color:'var(--text-muted)'}}>No results — type to save new</div>}
        </div>
      )}
    </div>
  )
}

// ── FLIGHT LEG ROW ────────────────────────────────────────
function LegRow({leg,legs,setLegs,canRemove}:{leg:FlightLeg;legs:FlightLeg[];setLegs:(l:FlightLeg[])=>void;canRemove:boolean}){
  const upd=(field:keyof FlightLeg,val:any)=>setLegs(legs.map(l=>l.id===leg.id?{...l,[field]:val}:l))
  return(
    <div style={{background:'var(--bg-tertiary)',border:'1px solid var(--border)',borderRadius:'10px',padding:'12px 14px',marginBottom:'8px'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr repeat(4,1fr)',gap:'8px',marginBottom:'8px'}}>
        <div><label className="label">Flight No.</label><input className="input" placeholder="MK053" value={leg.flight_number||''} onChange={e=>upd('flight_number',e.target.value)} style={{fontFamily:'monospace',textTransform:'uppercase'}}/></div>
        <div><label className="label">Date</label><input className="input" type="date" value={leg.date} onChange={e=>upd('date',e.target.value)}/></div>
        <div><label className="label">Departs</label><input className="input" placeholder="16:00" maxLength={5} value={leg.depart_time} onChange={e=>upd('depart_time',e.target.value)} style={{fontFamily:'monospace',textAlign:'center'}}/></div>
        <div><label className="label">Check-in by</label><input className="input" placeholder="13:00" maxLength={5} value={leg.checkin_time} onChange={e=>upd('checkin_time',e.target.value)} style={{fontFamily:'monospace',textAlign:'center'}}/></div>
        <div><label className="label">Arrives</label><input className="input" placeholder="07:40" maxLength={5} value={leg.arrival_time} onChange={e=>upd('arrival_time',e.target.value)} style={{fontFamily:'monospace',textAlign:'center'}}/></div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr auto',gap:'8px',alignItems:'flex-end'}}>
        <div><label className="label">Airline</label>
          <select className="input" value={leg.airline} onChange={e=>upd('airline',e.target.value)}>{AIRLINES.map(a=><option key={a}>{a}</option>)}</select></div>
        <div><label className="label">From</label>
          <select className="input" value={leg.from} onChange={e=>upd('from',e.target.value)}>{AIRPORTS.map(a=><option key={a}>{a}</option>)}</select></div>
        <div><label className="label">To</label>
          <select className="input" value={leg.to} onChange={e=>upd('to',e.target.value)}>{AIRPORTS.map(a=><option key={a}>{a}</option>)}</select></div>
        <div><label className="label">Cabin</label>
          <select className="input" value={leg.cabin} onChange={e=>upd('cabin',e.target.value)}>{CABIN_CLASS.map(c=><option key={c}>{c}</option>)}</select></div>
        <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:'4px',paddingBottom:'2px'}}>
          <label className="label" style={{whiteSpace:'nowrap'}}>+1</label>
          <input type="checkbox" checked={leg.overnight} onChange={e=>upd('overnight',e.target.checked)} style={{width:'18px',height:'18px',cursor:'pointer'}}/>
        </div>
      </div>
      {canRemove&&<button onClick={()=>setLegs(legs.filter(l=>l.id!==leg.id))} style={{marginTop:'8px',background:'var(--red-light)',color:'var(--red)',border:'none',borderRadius:'6px',padding:'4px 10px',cursor:'pointer',fontSize:'11.5px',fontFamily:'Outfit,sans-serif'}}>Remove leg</button>}
    </div>
  )
}

// ── HOTEL OPTION PANEL (Single Destination) ───────────────
function HotelOptionPanel({option,index,totalOptions,onChange,onRemove,onDuplicate}:{option:HotelOption;index:number;totalOptions:number;onChange:(o:HotelOption)=>void;onRemove:()=>void;onDuplicate:()=>void}){
  const [collapsed,setCollapsed]=useState(false)
  const upd=(field:keyof HotelOption,val:any)=>onChange({...option,[field]:val})
  const updLeg=(dir:'out'|'ret',legs:FlightLeg[])=>onChange({...option,[dir==='out'?'outLegs':'retLegs']:legs})
  const updExtra=(id:string,field:keyof ExtraItem,val:any)=>upd('extras',option.extras.map(e=>e.id===id?{...e,[field]:val}:e))

  const flightN=parseFloat(option.flightNet)||0, accN=parseFloat(option.accNet)||0, transN=parseFloat(option.transNet)||0
  const extrasN=option.extras.reduce((a,e)=>a+(e.net||0),0), totalNet=flightN+accN+transN+extrasN
  const sellN=parseFloat(option.sellPrice)||0, profitN=parseFloat(option.profit)||0
  const markupN = parseFloat(option.margin)|| (sellN>0&&profitN>0&&profitN<sellN ? (profitN/(sellN-profitN))*100 : 0)

  function onSell(v:string){
    const sell=parseFloat(v)||0
    const mg=parseFloat(option.margin)||0
    const pr=parseFloat(option.profit)||0
    if(sell>0&&mg>0){
      const profit = totalNet>0 ? totalNet*mg/100 : sell*mg/(100+mg)
      onChange({...option,sellPrice:v,profit:profit.toFixed(2)})
    } else if(sell>0&&pr>0){
      const markup = sell>pr ? (pr/(sell-pr))*100 : 0
      onChange({...option,sellPrice:v,margin:markup.toFixed(1)})
    } else onChange({...option,sellPrice:v})
  }
  function onMargin(v:string){
    const sell=parseFloat(option.sellPrice)||0
    const mg=parseFloat(v)||0
    if(totalNet>0&&mg>0){
      const s=totalNet*(1+mg/100)
      onChange({...option,margin:v,sellPrice:s.toFixed(2),profit:(totalNet*mg/100).toFixed(2)})
    } else if(sell>0&&mg>0){
      const profit = sell*mg/(100+mg)
      onChange({...option,margin:v,profit:profit.toFixed(2)})
    } else onChange({...option,margin:v})
  }
  function onProfit(v:string){
    const sell=parseFloat(option.sellPrice)||0
    const pr=parseFloat(v)||0
    if(sell>0&&pr>0){
      const markup = sell>pr ? (pr/(sell-pr))*100 : 0
      onChange({...option,profit:v,margin:markup.toFixed(1)})
    } else if(totalNet>0&&pr>0){
      const s=totalNet+pr
      onChange({...option,profit:v,sellPrice:s.toFixed(2),margin:((pr/totalNet)*100).toFixed(1)})
    } else onChange({...option,profit:v})
  }

  const COLORS=['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899']
  const color=COLORS[index%COLORS.length]

  return(
    <div className="card" style={{marginBottom:'14px',borderLeft:`3px solid ${color}`,overflow:'hidden'}}>
      <div style={{padding:'14px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',background:'var(--bg-tertiary)'}} onClick={()=>setCollapsed(c=>!c)}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <div style={{width:'26px',height:'26px',borderRadius:'50%',background:color,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'12px',fontWeight:'700',flexShrink:0}}>{index+1}</div>
          <div>
            <div style={{fontFamily:'Fraunces,serif',fontSize:'15px',fontWeight:'300',color:'var(--text-primary)'}}>{option.hotel||`Option ${index+1} — select hotel`}</div>
            <div style={{fontSize:'11.5px',color:'var(--text-muted)',marginTop:'1px'}}>{option.boardBasis}{option.nights?` · ${option.nights} nights`:''}{sellN>0?` · ${fmtS(sellN)}`:''}{markupN>0?` · ${markupN.toFixed(1)}%`:''}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
          {totalOptions>1&&<button onClick={e=>{e.stopPropagation();onDuplicate()}} className="btn btn-ghost btn-xs">⧉ Copy</button>}
          {totalOptions>1&&<button onClick={e=>{e.stopPropagation();onRemove()}} className="btn btn-danger btn-xs">Remove</button>}
          <span style={{color:'var(--text-muted)',fontSize:'16px',marginLeft:'4px'}}>{collapsed?'▸':'▾'}</span>
        </div>
      </div>

      {!collapsed&&(
        <div style={{padding:'18px'}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'14px'}}>
            <div style={{gridColumn:'1/-1'}}><label className="label">Hotel Name *</label><DBSearch table="hotel_list" value={option.hotel} onChange={v=>upd('hotel',v)} placeholder="Search or type hotel name…"/></div>
            <div style={{gridColumn:'1/-1'}}><label className="label">Room Type</label><input className="input" placeholder="e.g. Deluxe Ocean Suite…" value={option.roomType} onChange={e=>upd('roomType',e.target.value)}/></div>
            <div><label className="label">Meal Plan</label><DBSearch table="meal_plan_list" value={option.boardBasis} onChange={v=>upd('boardBasis',v)} placeholder="Search meal plan…"/></div>
            <div><label className="label">Nights</label><input className="input" type="number" min="1" value={option.nights} onChange={e=>{
              const nights=e.target.value
              upd('nights',nights)
              // Auto-populate return flight date
              if(option.checkinDate&&nights){
                const retDate=new Date(option.checkinDate+'T12:00')
                retDate.setDate(retDate.getDate()+parseInt(nights)||0)
                const retStr=retDate.toISOString().split('T')[0]
                const updatedRetLegs=option.retLegs.map((l,i)=>i===0&&!l.date?{...l,date:retStr}:l)
                onChange({...option,nights,retLegs:updatedRetLegs})
              }
            }}/></div>
            <div><label className="label">Check-in Date</label><input className="input" type="date" value={option.checkinDate} onChange={e=>{
              const checkin=e.target.value
              // Auto-populate outbound flight date if empty
              const updatedOutLegs=option.outLegs.map((l,i)=>i===0&&!l.date?{...l,date:checkin}:l)
              // Auto-populate return flight date if nights set
              let updatedRetLegs=option.retLegs
              if(checkin&&option.nights){
                const retDate=new Date(checkin+'T12:00')
                retDate.setDate(retDate.getDate()+(parseInt(option.nights)||0))
                const retStr=retDate.toISOString().split('T')[0]
                updatedRetLegs=option.retLegs.map((l,i)=>i===0&&!l.date?{...l,date:retStr}:l)
              }
              onChange({...option,checkinDate:checkin,outLegs:updatedOutLegs,retLegs:updatedRetLegs})
            }}/></div>
            <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',paddingBottom:'4px'}}>
              <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
                <input type="checkbox" checked={option.checkinNextDay} onChange={e=>upd('checkinNextDay',e.target.checked)} style={{width:'16px',height:'16px'}}/>
                <span style={{fontSize:'13px',color:'var(--text-secondary)'}}>Check-in next day{option.checkinNextDay&&option.checkinDate?<span style={{color:'var(--accent)',marginLeft:'6px',fontSize:'11.5px'}}>({addDays(option.checkinDate,1)})</span>:null}</span>
              </label>
            </div>
          </div>

          {/* Flights */}
          <div style={{marginBottom:'14px'}}>
            <div style={{fontWeight:'600',fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>✈ Outbound Flights</div>
            {option.outLegs.map(leg=><LegRow key={leg.id} leg={leg} legs={option.outLegs} setLegs={l=>updLeg('out',l)} canRemove={option.outLegs.length>1}/>)}
            <button className="btn btn-ghost btn-sm" style={{border:'1.5px dashed var(--border)',width:'100%',justifyContent:'center'}} onClick={()=>updLeg('out',[...option.outLegs,newLeg('out')])}>+ Add outbound leg</button>
          </div>
          <div style={{marginBottom:'14px'}}>
            <div style={{fontWeight:'600',fontSize:'12px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>↩ Return Flights</div>
            {option.retLegs.map(leg=><LegRow key={leg.id} leg={leg} legs={option.retLegs} setLegs={l=>updLeg('ret',l)} canRemove={option.retLegs.length>1}/>)}
            <button className="btn btn-ghost btn-sm" style={{border:'1.5px dashed var(--border)',width:'100%',justifyContent:'center'}} onClick={()=>updLeg('ret',[...option.retLegs,newLeg('ret')])}>+ Add return leg</button>
          </div>

          {/* Nets */}
          <div style={{background:'var(--bg-tertiary)',borderRadius:'10px',padding:'14px',marginBottom:'12px'}}>
            <div style={{fontWeight:'600',fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>Internal Net Costs</div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'12px'}}>
              {([['Flight Net (£)',option.flightNet,(v:string)=>upd('flightNet',v)],['Accommodation Net (£)',option.accNet,(v:string)=>upd('accNet',v)],['Transfers Net (£)',option.transNet,(v:string)=>upd('transNet',v)]] as [string,string,any][]).map(([l,v,s])=>(
                <div key={l}><label className="label">{l}</label><input className="input" type="number" step="0.01" placeholder="0.00" value={v} onChange={e=>s(e.target.value)}/></div>
              ))}
            </div>
            {option.extras.length>0&&(
              <div style={{marginBottom:'10px'}}>
                <div style={{display:'grid',gridTemplateColumns:'1fr 130px 32px',gap:'6px',marginBottom:'5px'}}>
                  {['Extra Item','Net (£)',''].map(h=><div key={h} style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em'}}>{h}</div>)}
                </div>
                {option.extras.map(e=>(
                  <div key={e.id} style={{display:'grid',gridTemplateColumns:'1fr 130px 32px',gap:'6px',marginBottom:'6px',alignItems:'center'}}>
                    <input className="input" placeholder="e.g. Airport Lounge" value={e.label} onChange={x=>updExtra(e.id,'label',x.target.value)}/>
                    <input className="input" type="number" step="0.01" placeholder="0.00" value={e.net||''} onChange={x=>updExtra(e.id,'net',parseFloat(x.target.value)||0)}/>
                    <button onClick={()=>upd('extras',option.extras.filter(x=>x.id!==e.id))} style={{background:'var(--red-light)',color:'var(--red)',border:'none',borderRadius:'6px',width:'30px',height:'36px',cursor:'pointer',fontSize:'13px'}}>✕</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{display:'flex',flexWrap:'wrap',gap:'5px',marginBottom:totalNet>0?'10px':'0'}}>
              {QUICK_EXTRAS.map(label=>(
                <button key={label} onClick={()=>upd('extras',[...option.extras,{id:uid(),label,net:0}])}
                  style={{padding:'3px 9px',borderRadius:'20px',border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>+ {label}</button>
              ))}
              <button onClick={()=>upd('extras',[...option.extras,{id:uid(),label:'',net:0}])} style={{padding:'3px 9px',borderRadius:'20px',border:'1px dashed var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>+ Custom</button>
            </div>
            {totalNet>0&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:'10px',borderTop:'1px solid var(--border)'}}>
              <span style={{fontSize:'12px',color:'var(--text-muted)',fontWeight:'600'}}>Total Net Cost</span>
              <span style={{fontFamily:'Fraunces,serif',fontSize:'18px',fontWeight:'300',color:'var(--text-primary)'}}>{fmt(totalNet)}</span>
            </div>}
          </div>

          {/* Sell price */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'10px'}}>
            <div><label className="label">Sell Price (£) *</label><input className="input" type="number" step="1" placeholder="4500" value={option.sellPrice} onChange={e=>onSell(e.target.value)} style={{fontSize:'15px',fontWeight:'500'}}/></div>
            <div><label className="label">Markup %</label><div style={{position:'relative'}}><input className="input" type="number" step="0.1" placeholder="10" value={option.margin} onChange={e=>onMargin(e.target.value)} style={{paddingRight:'26px'}}/><span style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',fontSize:'13px',pointerEvents:'none'}}>%</span></div></div>
            <div><label className="label">Profit (£)</label><input className="input" type="number" step="1" placeholder="Auto" value={option.profit} onChange={e=>onProfit(e.target.value)} style={{color:'var(--gold)',fontWeight:'500'}}/></div>
          </div>
          {sellN>0&&(
            <div style={{display:'flex',gap:'14px',padding:'10px 14px',background:'var(--bg-tertiary)',borderRadius:'8px'}}>
              {[...(totalNet>0?[{l:'Net',v:fmtS(totalNet),c:'var(--text-primary)'}]:[]),{l:'Sell',v:fmtS(sellN),c:'var(--text-primary)'},{l:'Profit',v:fmtS(profitN),c:'var(--gold)'},{l:'Markup',v:markupN.toFixed(1)+'%',c:markupN>=10?'var(--green)':markupN>=7?'var(--amber)':'var(--red)'}].map(s=>(
                <div key={s.l} style={{textAlign:'center'}}>
                  <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:'2px'}}>{s.l}</div>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',color:s.c}}>{s.v}</div>
                </div>
              ))}
              <div style={{flex:1,display:'flex',alignItems:'center',paddingLeft:'6px'}}>
                <div style={{width:'100%',height:'5px',background:'var(--border)',borderRadius:'3px',overflow:'hidden'}}>
                  <div style={{height:'100%',width:`${Math.min(markupN,30)/30*100}%`,borderRadius:'3px',background:markupN>=10?'var(--green)':markupN>=7?'var(--amber)':'var(--red)',transition:'all 0.3s'}}/>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── CENTRE PANEL (Multi-Centre) ───────────────────────────
function CentrePanel({centre,index,total,onChange,onRemove}:{centre:Centre;index:number;total:number;onChange:(c:Centre)=>void;onRemove:()=>void}){
  const [collapsed,setCollapsed]=useState(false)
  const upd=(field:keyof Centre,val:any)=>onChange({...centre,[field]:val})
  const updExtra=(id:string,field:keyof ExtraItem,val:any)=>upd('extras',centre.extras.map(e=>e.id===id?{...e,[field]:val}:e))

  const DEST_COLORS=['#f59e0b','#8b5cf6','#10b981','#3b82f6','#ec4899']
  const color=DEST_COLORS[index%DEST_COLORS.length]
  const accN=parseFloat(centre.accNet)||0, flightN=parseFloat(centre.flightNet)||0, transN=parseFloat(centre.transNet)||0
  const extrasN=centre.extras.reduce((a,e)=>a+(e.net||0),0)
  const totalNet=accN+flightN+transN+extrasN

  const checkinDisplay=centre.checkinDate
    ? centre.checkinNextDay ? addDays(centre.checkinDate,1)
      : new Date(centre.checkinDate+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
    : '—'

  const isFirst=index===0
  const isLast=index===total-1

  return(
    <div style={{marginBottom:'14px',position:'relative'}}>
      {/* Connector line */}
      {!isLast&&<div style={{position:'absolute',left:'22px',top:'100%',width:'2px',height:'14px',background:`${color}44`,zIndex:1}}/>}

      <div className="card" style={{borderLeft:`3px solid ${color}`,overflow:'hidden'}}>
        <div style={{padding:'13px 18px',display:'flex',justifyContent:'space-between',alignItems:'center',cursor:'pointer',background:'var(--bg-tertiary)'}} onClick={()=>setCollapsed(c=>!c)}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'30px',height:'30px',borderRadius:'50%',background:color,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'13px',fontWeight:'700',flexShrink:0}}>
              {index+1}
            </div>
            <div>
              <div style={{display:'flex',alignItems:'center',gap:'8px'}}>
                {centre.destination&&<span style={{fontSize:'11px',fontWeight:'700',textTransform:'uppercase',letterSpacing:'0.08em',color,background:`${color}18`,padding:'2px 8px',borderRadius:'4px'}}>{centre.destination}</span>}
                <span style={{fontFamily:'Fraunces,serif',fontSize:'15px',fontWeight:'300',color:'var(--text-primary)'}}>{centre.hotel||'Select hotel…'}</span>
              </div>
              <div style={{fontSize:'11.5px',color:'var(--text-muted)',marginTop:'1px'}}>
                {centre.boardBasis} · {centre.nights} nights
                {centre.checkinDate&&` · from ${checkinDisplay}`}
                {totalNet>0&&` · Net: ${fmtS(totalNet)}`}
              </div>
            </div>
          </div>
          <div style={{display:'flex',gap:'6px',alignItems:'center'}}>
            {total>2&&<button onClick={e=>{e.stopPropagation();onRemove()}} className="btn btn-danger btn-xs">Remove</button>}
            <span style={{color:'var(--text-muted)',fontSize:'16px',marginLeft:'4px'}}>{collapsed?'▸':'▾'}</span>
          </div>
        </div>

        {!collapsed&&(
          <div style={{padding:'18px'}}>
            {/* Destination */}
            <div style={{marginBottom:'14px'}}>
              <label className="label">Destination *</label>
              <DBSearch table="destinations" value={centre.destination} onChange={v=>upd('destination',v)} placeholder="e.g. Dubai, Mauritius, Cape Town…"/>
            </div>

            {/* Hotel & Accommodation */}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'14px'}}>
              <div style={{gridColumn:'1/-1'}}><label className="label">Hotel</label><DBSearch table="hotel_list" value={centre.hotel} onChange={v=>upd('hotel',v)} placeholder="Search or type hotel…"/></div>
              <div style={{gridColumn:'1/-1'}}><label className="label">Room Type</label><input className="input" placeholder="e.g. Superior Room, Suite…" value={centre.roomType} onChange={e=>upd('roomType',e.target.value)}/></div>
              <div><label className="label">Meal Plan</label><DBSearch table="meal_plan_list" value={centre.boardBasis} onChange={v=>upd('boardBasis',v)} placeholder="Search meal plan…"/></div>
              <div><label className="label">Nights</label><input className="input" type="number" min="1" value={centre.nights} onChange={e=>upd('nights',e.target.value)}/></div>
              <div><label className="label">Check-in Date</label><input className="input" type="date" value={centre.checkinDate} onChange={e=>upd('checkinDate',e.target.value)}/></div>
              <div style={{display:'flex',flexDirection:'column',justifyContent:'flex-end',paddingBottom:'4px'}}>
                <label style={{display:'flex',alignItems:'center',gap:'8px',cursor:'pointer'}}>
                  <input type="checkbox" checked={centre.checkinNextDay} onChange={e=>upd('checkinNextDay',e.target.checked)} style={{width:'16px',height:'16px'}}/>
                  <span style={{fontSize:'13px',color:'var(--text-secondary)'}}>
                    Check-in next day
                    {centre.checkinNextDay&&centre.checkinDate&&<span style={{color:'var(--accent)',marginLeft:'6px',fontSize:'11.5px'}}>({addDays(centre.checkinDate,1)})</span>}
                  </span>
                </label>
              </div>
            </div>

            {/* Inbound flights */}
            <div style={{marginBottom:'12px'}}>
              <div style={{fontWeight:'600',fontSize:'11.5px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>
                ✈ Flights {isFirst?'from UK':'between centres'} → {centre.destination||'Destination'}
              </div>
              {centre.inboundLegs.map(leg=><LegRow key={leg.id} leg={leg} legs={centre.inboundLegs} setLegs={l=>upd('inboundLegs',l)} canRemove={centre.inboundLegs.length>1}/>)}
              <button className="btn btn-ghost btn-sm" style={{border:'1.5px dashed var(--border)',width:'100%',justifyContent:'center'}} onClick={()=>upd('inboundLegs',[...centre.inboundLegs,{...newLeg('out'),from:'',to:''}])}>+ Add leg</button>
            </div>

            {/* Outbound flights (only on last centre) */}
            {isLast&&(
              <div style={{marginBottom:'12px'}}>
                <div style={{fontWeight:'600',fontSize:'11.5px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>
                  ↩ Return Flights → UK
                </div>
                {centre.outboundLegs.map(leg=><LegRow key={leg.id} leg={leg} legs={centre.outboundLegs} setLegs={l=>upd('outboundLegs',l)} canRemove={centre.outboundLegs.length>1}/>)}
                <button className="btn btn-ghost btn-sm" style={{border:'1.5px dashed var(--border)',width:'100%',justifyContent:'center'}} onClick={()=>upd('outboundLegs',[...centre.outboundLegs,{...newLeg('ret'),from:'',to:''}])}>+ Add leg</button>
              </div>
            )}

            {/* Net costs */}
            <div style={{background:'var(--bg-tertiary)',borderRadius:'10px',padding:'13px',marginBottom:'10px'}}>
              <div style={{fontWeight:'600',fontSize:'11px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'10px'}}>Net Costs — {centre.destination||`Centre ${index+1}`}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px',marginBottom:'10px'}}>
                {([['Accommodation (£)',centre.accNet,(v:string)=>upd('accNet',v)],['Flights (£)',centre.flightNet,(v:string)=>upd('flightNet',v)],['Transfers (£)',centre.transNet,(v:string)=>upd('transNet',v)]] as [string,string,any][]).map(([l,v,s])=>(
                  <div key={l}><label className="label">{l}</label><input className="input" type="number" step="0.01" placeholder="0.00" value={v} onChange={e=>s(e.target.value)}/></div>
                ))}
              </div>
              {centre.extras.length>0&&(
                <div style={{marginBottom:'8px'}}>
                  {centre.extras.map(e=>(
                    <div key={e.id} style={{display:'grid',gridTemplateColumns:'1fr 120px 30px',gap:'6px',marginBottom:'6px',alignItems:'center'}}>
                      <input className="input" placeholder="Extra item" value={e.label} onChange={x=>updExtra(e.id,'label',x.target.value)}/>
                      <input className="input" type="number" placeholder="0.00" value={e.net||''} onChange={x=>updExtra(e.id,'net',parseFloat(x.target.value)||0)}/>
                      <button onClick={()=>upd('extras',centre.extras.filter(x=>x.id!==e.id))} style={{background:'var(--red-light)',color:'var(--red)',border:'none',borderRadius:'6px',width:'28px',height:'36px',cursor:'pointer',fontSize:'13px'}}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{display:'flex',flexWrap:'wrap',gap:'5px',marginBottom:totalNet>0?'10px':'0'}}>
                {['Lounge Access','Transfers','Excursion','Visa Fees','Travel Insurance'].map(label=>(
                  <button key={label} onClick={()=>upd('extras',[...centre.extras,{id:uid(),label,net:0}])}
                    style={{padding:'3px 8px',borderRadius:'20px',border:'1px solid var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>+ {label}</button>
                ))}
                <button onClick={()=>upd('extras',[...centre.extras,{id:uid(),label:'',net:0}])} style={{padding:'3px 8px',borderRadius:'20px',border:'1px dashed var(--border)',background:'transparent',color:'var(--text-muted)',fontSize:'11px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>+ Custom</button>
              </div>
              {totalNet>0&&<div style={{display:'flex',justifyContent:'space-between',alignItems:'center',paddingTop:'8px',borderTop:'1px solid var(--border)'}}>
                <span style={{fontSize:'12px',color:'var(--text-muted)',fontWeight:'600'}}>Centre Net</span>
                <span style={{fontFamily:'Fraunces,serif',fontSize:'16px',fontWeight:'300',color:'var(--text-primary)'}}>{fmt(totalNet)}</span>
              </div>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── MAIN PAGE ─────────────────────────────────────────────
export default function NewQuotePage(){
  const searchParams = useSearchParams()
  const dealId       = searchParams.get('deal')  ? Number(searchParams.get('deal'))  : null
  const editQuoteId  = searchParams.get('quote') ? Number(searchParams.get('quote')) : null
  const isEditMode   = !!editQuoteId

  const [deal,setDeal]         = useState<DealInfo|null>(null)
  const [deals,setDeals]       = useState<DealInfo[]>([])
  const [saving,setSaving]     = useState(false)
  const [saved,setSaved]       = useState(false)
  const [savedRefs,setSavedRefs] = useState<string[]>([])
  const [error,setError]       = useState('')
  const [showPreview,setShowPreview] = useState(false)
  const [emailTemplate,setEmailTemplate] = useState<1|2|3|4>(1)
  const [dealIdVal,setDealIdVal] = useState(dealId?String(dealId):'')

  // Mode: 'single' or 'multi'
  const [quoteMode,setQuoteMode] = useState<'single'|'multi'>('single')

  // Shared
  const [adults,setAdults]     = useState('2')
  const [children,setChildren] = useState('0')
  const [infants,setInfants]   = useState('0')
  const [initials,setInitials] = useState('SA')
  const [additionalServices,setAdditionalServices] = useState('')
  const [quoteCount,setQuoteCount] = useState(0)
  const [editingRef,setEditingRef] = useState('')
  const [customTemplates,setCustomTemplates] = useState<{id:number;name:string;description:string;opening_hook:string;why_choose_us:string;urgency_notice:string;closing_cta:string}[]>([])
  const [selectedCustomTemplate,setSelectedCustomTemplate] = useState<number|null>(null)

  // Single mode
  const [hotelOptions,setHotelOptions] = useState<HotelOption[]>([newHotelOption()])

  // Multi-centre mode
  const [centres,setCentres]   = useState<Centre[]>([newCentre('Dubai',0), newCentre('Mauritius',1)])
  const [mcSellPrice,setMcSell]= useState('')
  const [mcMargin,setMcMargin] = useState('')
  const [mcProfit,setMcProfit] = useState('')

  useEffect(()=>{
    if(dealId){loadDeal(dealId);setDealIdVal(String(dealId))}
    loadDeals()
    if(editQuoteId) loadExistingQuote(editQuoteId)
    loadCustomTemplates()
  },[dealId,editQuoteId])

  async function loadCustomTemplates(){
    const{data}=await supabase.from('email_templates').select('id,name,description,opening_hook,why_choose_us,urgency_notice,closing_cta').eq('is_built_in',false).order('created_at',{ascending:false})
    setCustomTemplates(data||[])
  }
  async function loadDeal(id:number){
    const{data}=await supabase.from('deals').select('id,title,departure_date,clients(first_name,last_name,email,phone)').eq('id',id).single()
    if(data){
      setDeal(data)
      if(!isEditMode){
        setHotelOptions(prev=>prev.map(o=>({...o,checkinDate:data.departure_date||''})))
        setCentres(prev=>prev.map((c,i)=>i===prev.length-1?{...c,checkinDate:data.departure_date||''}:c))
      }
    }
    const{count}=await supabase.from('quotes').select('id',{count:'exact',head:true}).eq('deal_id',id)
    setQuoteCount(count||0)
  }
  async function loadDeals(){
    const{data}=await supabase.from('deals').select('id,title,departure_date,clients(first_name,last_name,email)').not('stage','in','("BOOKED","LOST")').order('created_at',{ascending:false})
    setDeals(data||[])
  }
  async function loadExistingQuote(qid:number){
    const{data}=await supabase.from('quotes').select('*').eq('id',qid).single()
    if(!data) return
    setEditingRef(data.quote_ref||'')
    setAdults(String(data.adults||2)); setChildren(String(data.children||0)); setInfants(String(data.infants||0))
    setInitials(data.consultant_initials||'SA'); setAdditionalServices(data.additional_services||'')
    if(data.quote_type==='multi_centre'&&data.centres){
      setQuoteMode('multi'); setCentres(data.centres)
      setMcSell(String(data.price||'')); setMcMargin(String(data.margin_percent||'')); setMcProfit(String(data.profit||''))
    } else {
      setQuoteMode('single')
      const costs=data.cost_breakdown||{}, fd=data.flight_details||{}
      setHotelOptions([{ id:uid(), hotel:data.hotel||'', roomType:data.room_type||'', boardBasis:data.board_basis||'All Inclusive', nights:String(data.nights||7), checkinDate:data.checkin_date||data.departure_date||'', checkinNextDay:data.checkin_next_day||false, outLegs:fd.outbound?.length>0?fd.outbound:[newLeg('out')], retLegs:fd.return?.length>0?fd.return:[newLeg('ret')], flightNet:String(costs.flight_net||''), accNet:String(costs.acc_net||''), transNet:String(costs.trans_net||''), extras:costs.extras||[], sellPrice:String(data.price||''), margin:String(data.margin_percent||''), profit:String(data.profit||'') }])
    }
  }

  // Multi-centre pricing
  const mcSellN=parseFloat(mcSellPrice)||0, mcProfitN=parseFloat(mcProfit)||0
  const mcMarginN = parseFloat(mcMargin)|| (mcSellN>0&&mcProfitN>0&&mcProfitN<mcSellN ? (mcProfitN/(mcSellN-mcProfitN))*100 : 0)
  const mcTotalNet=centres.reduce((a,c)=>{
    const accN=parseFloat(c.accNet)||0,flightN=parseFloat(c.flightNet)||0,transN=parseFloat(c.transNet)||0
    return a+accN+flightN+transN+c.extras.reduce((x,e)=>x+(e.net||0),0)
  },0)
  function onMcSell(v:string){
    const sell=parseFloat(v)||0,mg=parseFloat(mcMargin)||0,pr=parseFloat(mcProfit)||0
    if(sell>0&&mg>0){
      const profit = mcTotalNet>0 ? mcTotalNet*mg/100 : sell*mg/(100+mg)
      setMcProfit(profit.toFixed(2))
    } else if(sell>0&&pr>0){
      const markup = sell>pr ? (pr/(sell-pr))*100 : 0
      setMcMargin(markup.toFixed(1))
    }
    setMcSell(v)
  }
  function onMcMargin(v:string){
    const sell=parseFloat(mcSellPrice)||0,mg=parseFloat(v)||0
    if(mcTotalNet>0&&mg>0){
      const s=mcTotalNet*(1+mg/100)
      setMcSell(s.toFixed(2)); setMcProfit((mcTotalNet*mg/100).toFixed(2))
    } else if(sell>0&&mg>0){
      const profit = sell*mg/(100+mg)
      setMcProfit(profit.toFixed(2))
    }
    setMcMargin(v)
  }
  function onMcProfit(v:string){
    const sell=parseFloat(mcSellPrice)||0,pr=parseFloat(v)||0
    if(sell>0&&pr>0){
      const markup = sell>pr ? (pr/(sell-pr))*100 : 0
      setMcMargin(markup.toFixed(1))
    } else if(mcTotalNet>0&&pr>0){
      const s=mcTotalNet+pr; setMcSell(s.toFixed(2)); setMcMargin(((pr/mcTotalNet)*100).toFixed(1))
    }
    setMcProfit(v)
  }

  const quoteRef = isEditMode ? editingRef : genRef(initials,quoteCount)

  async function handleSave(){
    const tid=Number(dealIdVal)
    if(!tid){ setError('Select a deal'); return }

    if(quoteMode==='single'){
      if(hotelOptions.some(o=>!o.hotel.trim())){ setError('All hotel options need a hotel name'); return }
      if(hotelOptions.some(o=>!o.sellPrice)){ setError('All hotel options need a sell price'); return }
    } else {
      if(centres.some(c=>!c.destination.trim())){ setError('All centres need a destination'); return }
      if(centres.some(c=>!c.hotel.trim())){ setError('All centres need a hotel'); return }
      if(!mcSellPrice){ setError('Sell price required'); return }
    }

    setSaving(true); setError('')

    if(isEditMode&&editQuoteId){
      // EDIT MODE — overwrite
      if(quoteMode==='single'){
        const o=hotelOptions[0]
        const sellN=parseFloat(o.sellPrice)||0,profitN=parseFloat(o.profit)||0
        const marginN = sellN>0&&profitN>0&&profitN<sellN ? (profitN/(sellN-profitN))*100 : (parseFloat(o.margin)||0)
        const flightN=parseFloat(o.flightNet)||0,accN=parseFloat(o.accNet)||0,transN=parseFloat(o.transNet)||0
        const extrasN=o.extras.reduce((a,e)=>a+(e.net||0),0)
        await supabase.from('quotes').update({
          hotel:o.hotel.trim(),board_basis:o.boardBasis,room_type:o.roomType||null,quote_type:'single',
          cabin_class:o.outLegs[0]?.cabin||'Economy',departure_date:o.outLegs[0]?.date||null,
          departure_airport:o.outLegs[0]?.from||null,airline:o.outLegs[0]?.airline||null,
          nights:parseInt(o.nights)||null,adults:parseInt(adults)||2,children:parseInt(children)||0,infants:parseInt(infants)||0,
          price:sellN,profit:profitN,margin_percent:parseFloat(marginN.toFixed(1))||0,consultant_initials:initials,
          flight_details:{outbound:o.outLegs,return:o.retLegs},
          cost_breakdown:{flight_net:flightN,acc_net:accN,trans_net:transN,extras:o.extras,total_net:flightN+accN+transN+extrasN},
          additional_services:additionalServices.trim()||null,
          checkin_date:o.checkinDate||null,checkin_next_day:o.checkinNextDay,
        }).eq('id',editQuoteId)
      } else {
        await supabase.from('quotes').update({
          quote_type:'multi_centre',centres,hotel:centres[0]?.hotel||'Multi-Centre',
          board_basis:centres[0]?.boardBasis||'',departure_date:centres[0]?.inboundLegs[0]?.date||null,
          nights:centres.reduce((a,c)=>a+(parseInt(c.nights)||0),0),
          adults:parseInt(adults)||2,children:parseInt(children)||0,infants:parseInt(infants)||0,
          price:mcSellN,profit:mcProfitN,margin_percent:parseFloat(mcMarginN.toFixed(1))||0,
          consultant_initials:initials,additional_services:additionalServices.trim()||null,
          cost_breakdown:{total_net:mcTotalNet,centres:centres.map(c=>({destination:c.destination,net:parseFloat(c.accNet||'0')+(parseFloat(c.flightNet||'0'))+(parseFloat(c.transNet||'0'))}))},
        }).eq('id',editQuoteId)
      }
      await supabase.from('activities').insert({deal_id:tid,activity_type:'QUOTE_CREATED',notes:`Quote ${editingRef} updated`})
      setSavedRefs([editingRef]); setSaving(false); setSaved(true); return
    }

    // NEW QUOTES
    const refs:string[]=[]
    if(quoteMode==='single'){
      for(let i=0;i<hotelOptions.length;i++){
        const o=hotelOptions[i], ref=genRef(initials,quoteCount+i); refs.push(ref)
        const sellN=parseFloat(o.sellPrice)||0,profitN=parseFloat(o.profit)||0
        const marginN = sellN>0&&profitN>0&&profitN<sellN ? (profitN/(sellN-profitN))*100 : (parseFloat(o.margin)||0)
        const flightN=parseFloat(o.flightNet)||0,accN=parseFloat(o.accNet)||0,transN=parseFloat(o.transNet)||0
        const extrasN=o.extras.reduce((a,e)=>a+(e.net||0),0)
        const{error:qErr}=await supabase.from('quotes').insert({
          deal_id:tid,hotel:o.hotel.trim(),board_basis:o.boardBasis,room_type:o.roomType||null,quote_type:'single',
          cabin_class:o.outLegs[0]?.cabin||'Economy',departure_date:o.outLegs[0]?.date||null,
          departure_airport:o.outLegs[0]?.from||null,airline:o.outLegs[0]?.airline||null,
          nights:parseInt(o.nights)||null,adults:parseInt(adults)||2,children:parseInt(children)||0,infants:parseInt(infants)||0,
          price:sellN,profit:profitN,margin_percent:parseFloat(marginN.toFixed(1))||0,
          consultant_initials:initials,quote_ref:ref,sent_to_client:false,
          flight_details:{outbound:o.outLegs,return:o.retLegs},
          cost_breakdown:{flight_net:flightN,acc_net:accN,trans_net:transN,extras:o.extras,total_net:flightN+accN+transN+extrasN},
          additional_services:additionalServices.trim()||null,checkin_date:o.checkinDate||null,checkin_next_day:o.checkinNextDay,
        })
        if(qErr){ setError('Failed on option '+(i+1)+': '+qErr.message); setSaving(false); return }
      }
      const first=hotelOptions[0]
      await supabase.from('deals').update({deal_value:parseFloat(first.sellPrice)||0,departure_date:first.outLegs[0]?.date||undefined}).eq('id',tid)
      await supabase.from('activities').insert({deal_id:tid,activity_type:'QUOTE_CREATED',notes:`${hotelOptions.length} option quote — ${hotelOptions.map(o=>o.hotel).join(' / ')} · Refs: ${refs.join(', ')}`})
    } else {
      const ref=genRef(initials,quoteCount); refs.push(ref)
      const totalNights=centres.reduce((a,c)=>a+(parseInt(c.nights)||0),0)
      const destList=centres.map(c=>c.destination).filter(Boolean).join(' → ')
      const{error:qErr}=await supabase.from('quotes').insert({
        deal_id:tid,quote_type:'multi_centre',centres,
        hotel:`Multi-Centre: ${destList}`,destination:destList,
        board_basis:centres.map(c=>c.boardBasis).join(' / '),
        departure_date:centres[0]?.inboundLegs[0]?.date||null,
        nights:totalNights,adults:parseInt(adults)||2,children:parseInt(children)||0,infants:parseInt(infants)||0,
        price:mcSellN,profit:mcProfitN,margin_percent:parseFloat(mcMarginN.toFixed(1))||0,
        consultant_initials:initials,quote_ref:ref,sent_to_client:false,
        cost_breakdown:{total_net:mcTotalNet,centres:centres.map(c=>({destination:c.destination,hotel:c.hotel,nights:c.nights,net:parseFloat(c.accNet||'0')+(parseFloat(c.flightNet||'0'))+(parseFloat(c.transNet||'0'))}))},
        additional_services:additionalServices.trim()||null,
      })
      if(qErr){ setError('Failed: '+qErr.message); setSaving(false); return }
      await supabase.from('deals').update({deal_value:mcSellN,departure_date:centres[0]?.inboundLegs[0]?.date||undefined}).eq('id',tid)
      await supabase.from('activities').insert({deal_id:tid,activity_type:'QUOTE_CREATED',notes:`Multi-centre quote — ${destList} · ${fmtS(mcSellN)} · Ref: ${ref}`})
    }

    setSavedRefs(refs); setSaving(false); setSaved(true); setQuoteCount(c=>c+refs.length)
  }

  const TEMPLATES=[{id:1,label:'The Dream Seller',desc:'Sell the experience'},{id:2,label:'The Trusted Expert',desc:'Authority & credentials'},{id:3,label:'The Urgency Close',desc:'Drive action now'},{id:4,label:'The VIP Treatment',desc:'Bespoke & exclusive'}] as const

  return(
    <div>
      <div className="page-header">
        <div style={{display:'flex',alignItems:'center',gap:'14px'}}>
          {dealId?<Link href={`/deals/${dealId}`} style={{color:'var(--text-muted)',textDecoration:'none',fontSize:'13px'}}>← Back to Deal</Link>
                 :<Link href="/pipeline" style={{color:'var(--text-muted)',textDecoration:'none',fontSize:'13px'}}>← Pipeline</Link>}
          <div style={{width:'1px',height:'20px',background:'var(--border)'}}/>
          <div>
            <div className="page-title">{isEditMode?'Edit Quote':'Quote Builder'}</div>
            <div style={{fontSize:'12.5px',color:'var(--text-muted)',marginTop:'1px'}}>
              Ref: <strong style={{color:'var(--accent-mid)',fontFamily:'monospace'}}>{quoteRef}</strong>
              {isEditMode&&<span style={{marginLeft:'8px',fontSize:'11px',background:'var(--amber-light)',color:'var(--amber)',padding:'2px 8px',borderRadius:'10px',fontWeight:'600'}}>Editing</span>}
              {deal&&` · ${deal.title}`}
            </div>
          </div>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          {hotel&&<button className="btn btn-secondary" onClick={()=>setShowPreview(true)}>👁 Preview Email</button>}
          {saved
            ?<Link href={`/deals/${dealIdVal}`}><button className="btn btn-primary">← Back to Deal</button></Link>
            :<button className="btn btn-cta btn-lg" onClick={handleSave} disabled={saving}>{saving?'Saving…':isEditMode?'Update Quote':'Save Quote'}</button>}
        </div>
      </div>

      <div className="page-body">
        {error&&<div style={{background:'var(--red-light)',color:'var(--red)',padding:'12px 16px',borderRadius:'8px',fontSize:'13px',marginBottom:'16px'}}>{error}</div>}
        {saved&&(
          <div style={{background:'var(--green-light)',color:'var(--green)',padding:'12px 16px',borderRadius:'8px',fontSize:'13px',marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span>✓ {savedRefs.length} quote{savedRefs.length>1?'s':''} saved! Refs: {savedRefs.join(', ')}</span>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={()=>setShowPreview(true)} style={{background:'var(--green)',color:'white',border:'none',borderRadius:'6px',padding:'5px 12px',fontSize:'12px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}>👁 Preview Email</button>
              <Link href={`/deals/${dealIdVal}`}><button className="btn btn-secondary btn-sm">Back to Deal →</button></Link>
            </div>
          </div>
        )}

        <div style={{display:'grid',gridTemplateColumns:'1fr 290px',gap:'20px'}}>
          <div style={{display:'flex',flexDirection:'column',gap:'16px'}}>

            {/* Deal selector */}
            <div className="card" style={{padding:'18px 20px'}}>
              <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',marginBottom:'12px'}}>Deal</div>
              {deal?(
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'11px 14px',background:'var(--accent-light)',borderRadius:'8px',border:'1.5px solid var(--accent)'}}>
                  <div>
                    <div style={{fontWeight:'500',color:'var(--accent-mid)',fontSize:'14px'}}>{deal.title}</div>
                    {deal.clients&&<div style={{fontSize:'12px',color:'var(--text-muted)',marginTop:'1px'}}>{(deal.clients as any).first_name} {(deal.clients as any).last_name} · {(deal.clients as any).email}</div>}
                  </div>
                  <button onClick={()=>{ setDeal(null); setDealIdVal('') }} className="btn btn-secondary btn-sm">Change</button>
                </div>
              ):(
                <div>
                  <label className="label">Select Deal *</label>
                  <select className="input" value={dealIdVal} onChange={e=>{setDealIdVal(e.target.value);loadDeal(Number(e.target.value))}}>
                    <option value="">Choose…</option>
                    {deals.map(d=><option key={d.id} value={d.id}>{d.title}{d.clients?` — ${(d.clients as any).first_name} ${(d.clients as any).last_name}`:''}</option>)}
                  </select>
                </div>
              )}
            </div>

            {/* Quote type toggle */}
            {!isEditMode&&(
              <div className="card" style={{padding:'18px 20px'}}>
                <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',marginBottom:'14px'}}>Quote Type</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                  {[
                    {key:'single',label:'Single Destination',desc:'One or more hotel options for the same destination',icon:'🏨'},
                    {key:'multi',label:'Multi-Centre',desc:'Sequential itinerary across 2+ destinations (e.g. Dubai + Mauritius)',icon:'✈'},
                  ].map(t=>(
                    <button key={t.key} onClick={()=>setQuoteMode(t.key as 'single'|'multi')}
                      style={{padding:'14px',borderRadius:'10px',border:'2px solid',textAlign:'left',cursor:'pointer',fontFamily:'Outfit,sans-serif',
                        borderColor:quoteMode===t.key?'var(--accent-mid)':'var(--border)',
                        background:quoteMode===t.key?'var(--accent-light)':'transparent',
                        transition:'all 0.15s'}}>
                      <div style={{fontSize:'18px',marginBottom:'6px'}}>{t.icon}</div>
                      <div style={{fontSize:'13.5px',fontWeight:'600',color:quoteMode===t.key?'var(--accent-mid)':'var(--text-primary)',marginBottom:'3px'}}>{t.label}</div>
                      <div style={{fontSize:'11.5px',color:'var(--text-muted)',lineHeight:'1.4'}}>{t.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Passengers */}
            <div className="card" style={{padding:'18px 20px'}}>
              <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',marginBottom:'12px'}}>Passengers</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'10px'}}>
                <div><label className="label">Adults</label><input className="input" type="number" min="1" value={adults} onChange={e=>setAdults(e.target.value)}/></div>
                <div><label className="label">Children</label><input className="input" type="number" min="0" value={children} onChange={e=>setChildren(e.target.value)}/></div>
                <div><label className="label">Infants</label><input className="input" type="number" min="0" value={infants} onChange={e=>setInfants(e.target.value)}/></div>
              </div>
            </div>

            {/* ── SINGLE DESTINATION ── */}
            {quoteMode==='single'&&(
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'12px'}}>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300'}}>Hotel Options</div>
                  {!isEditMode&&<button className="btn btn-secondary btn-sm" onClick={()=>setHotelOptions(p=>[...p,newHotelOption()])}>+ Add Option</button>}
                </div>
                {hotelOptions.map((o,i)=>(
                  <HotelOptionPanel key={o.id} option={o} index={i} totalOptions={hotelOptions.length}
                    onChange={updated=>setHotelOptions(p=>p.map(x=>x.id===updated.id?updated:x))}
                    onRemove={()=>setHotelOptions(p=>p.filter(x=>x.id!==o.id))}
                    onDuplicate={()=>{const src=hotelOptions.find(x=>x.id===o.id);if(src)setHotelOptions(p=>[...p,{...src,id:uid(),hotel:''}])}}/>
                ))}
                {!isEditMode&&hotelOptions.length<6&&(
                  <button onClick={()=>setHotelOptions(p=>[...p,newHotelOption()])}
                    style={{width:'100%',padding:'13px',border:'2px dashed var(--border)',borderRadius:'12px',background:'transparent',color:'var(--text-muted)',fontSize:'13px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>
                    + Add Another Hotel Option
                  </button>
                )}
              </div>
            )}

            {/* ── MULTI-CENTRE ── */}
            {quoteMode==='multi'&&(
              <div>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'4px'}}>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300'}}>Centres</div>
                  <button className="btn btn-secondary btn-sm" onClick={()=>setCentres(p=>[...p,newCentre('',p.length)])}>+ Add Centre</button>
                </div>
                <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'14px'}}>Each centre has its own destination, hotel, flights and net costs. The return flight goes on the last centre.</div>

                {centres.map((c,i)=>(
                  <CentrePanel key={c.id} centre={c} index={i} total={centres.length}
                    onChange={updated=>setCentres(p=>p.map(x=>x.id===updated.id?updated:x))}
                    onRemove={()=>setCentres(p=>p.filter(x=>x.id!==c.id))}/>
                ))}

                {centres.length<6&&(
                  <button onClick={()=>setCentres(p=>[...p,newCentre('',p.length)])}
                    style={{width:'100%',padding:'13px',border:'2px dashed var(--border)',borderRadius:'12px',background:'transparent',color:'var(--text-muted)',fontSize:'13px',cursor:'pointer',fontFamily:'Outfit,sans-serif'}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent)';e.currentTarget.style.color='var(--accent)'}}
                    onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-muted)'}}>
                    + Add Another Centre
                  </button>
                )}

                {/* Multi-centre combined pricing */}
                <div className="card" style={{padding:'20px',marginTop:'16px'}}>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',marginBottom:'6px'}}>Combined Package Price</div>
                  <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'14px'}}>
                    {mcTotalNet>0&&<span>Total net across all centres: <strong>{fmt(mcTotalNet)}</strong> · </span>}
                    One price shown to client covering the full itinerary.
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'14px'}}>
                    <div><label className="label">Sell Price (£) *</label><input className="input" type="number" step="1" placeholder="8500" value={mcSellPrice} onChange={e=>onMcSell(e.target.value)} style={{fontSize:'15px',fontWeight:'500'}}/></div>
                    <div><label className="label">Markup %</label><div style={{position:'relative'}}><input className="input" type="number" step="0.1" placeholder="10" value={mcMargin} onChange={e=>onMcMargin(e.target.value)} style={{paddingRight:'26px'}}/><span style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',color:'var(--text-muted)',fontSize:'13px',pointerEvents:'none'}}>%</span></div></div>
                    <div><label className="label">Profit (£)</label><input className="input" type="number" step="1" placeholder="Auto" value={mcProfit} onChange={e=>onMcProfit(e.target.value)} style={{color:'var(--gold)',fontWeight:'500'}}/></div>
                  </div>
                  {mcSellN>0&&(
                    <div style={{display:'flex',gap:'16px',padding:'12px 14px',background:'var(--bg-tertiary)',borderRadius:'8px'}}>
                      {[...(mcTotalNet>0?[{l:'Net',v:fmtS(mcTotalNet),c:'var(--text-primary)'}]:[]),{l:'Sell',v:fmtS(mcSellN),c:'var(--text-primary)'},{l:'Profit',v:fmtS(mcProfitN),c:'var(--gold)'},{l:'Markup',v:mcMarginN.toFixed(1)+'%',c:mcMarginN>=10?'var(--green)':mcMarginN>=7?'var(--amber)':'var(--red)'}].map(s=>(
                        <div key={s.l} style={{textAlign:'center'}}>
                          <div style={{fontSize:'10px',textTransform:'uppercase',letterSpacing:'0.06em',color:'var(--text-muted)',marginBottom:'2px'}}>{s.l}</div>
                          <div style={{fontFamily:'Fraunces,serif',fontSize:'18px',fontWeight:'300',color:s.c}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Additional services */}
            <div className="card" style={{padding:'18px 20px'}}>
              <div style={{fontFamily:'Fraunces,serif',fontSize:'17px',fontWeight:'300',marginBottom:'4px'}}>Additional Services</div>
              <div style={{fontSize:'12px',color:'var(--text-muted)',marginBottom:'10px'}}>Shown to client in the quote email</div>
              <textarea className="input" style={{minHeight:'90px',resize:'vertical'}}
                placeholder="e.g. Airport lounge access at Gatwick South Terminal, private chauffeur transfer, welcome amenity at resort on arrival…"
                value={additionalServices} onChange={e=>setAdditionalServices(e.target.value)}/>
            </div>
          </div>

          {/* SIDEBAR */}
          <div style={{position:'sticky',top:'80px',alignSelf:'flex-start',display:'flex',flexDirection:'column',gap:'12px'}}>

            {/* Live summary */}
            {quoteMode==='single'&&hotelOptions.map((o,i)=>{
              const sellN=parseFloat(o.sellPrice)||0,profitN=parseFloat(o.profit)||0
              const marginN = sellN>0&&profitN>0&&profitN<sellN ? (profitN/(sellN-profitN))*100 : (parseFloat(o.margin)||0)
              const COLORS=['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899']
              const col=COLORS[i%COLORS.length]
              return(
                <div key={o.id} style={{background:'#0d1b2a',borderRadius:'12px',padding:'16px',color:'white',borderLeft:`3px solid ${col}`}}>
                  <div style={{fontSize:'9px',textTransform:'uppercase',letterSpacing:'0.12em',color:col,marginBottom:'3px'}}>Option {i+1}</div>
                  <div style={{fontFamily:'Fraunces,serif',fontSize:'15px',fontWeight:'300',marginBottom:'2px'}}>{o.hotel||'—'}</div>
                  <div style={{fontSize:'11px',opacity:0.5,marginBottom:'10px'}}>{o.boardBasis} · {o.nights} nights</div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'10px',opacity:0.6}}>Total</span>
                    <span style={{fontFamily:'Fraunces,serif',fontSize:'19px',fontWeight:'300',color:'#d4a84a'}}>{sellN>0?fmtS(sellN):'—'}</span>
                  </div>
                  {profitN>0&&<div style={{textAlign:'right',fontSize:'10px',color:'rgba(201,168,76,0.5)',marginTop:'2px'}}>Profit: {fmtS(profitN)} ({marginN.toFixed(1)}%)</div>}
                </div>
              )
            })}

            {quoteMode==='multi'&&(
              <div style={{background:'#0d1b2a',borderRadius:'12px',padding:'16px',color:'white'}}>
                <div style={{fontSize:'9px',textTransform:'uppercase',letterSpacing:'0.12em',color:'#d4a84a',marginBottom:'6px'}}>Multi-Centre Itinerary</div>
                {centres.map((c,i)=>(
                  <div key={c.id} style={{marginBottom:'6px',paddingBottom:'6px',borderBottom:i<centres.length-1?'1px solid rgba(255,255,255,0.07)':'none'}}>
                    <div style={{fontSize:'11px',fontWeight:'600',color:'#d4a84a'}}>{c.destination||`Centre ${i+1}`}</div>
                    <div style={{fontSize:'12px',color:'rgba(255,255,255,0.75)',fontFamily:'Fraunces,serif',fontWeight:'300'}}>{c.hotel||'—'}</div>
                    <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)'}}>{c.nights} nights · {c.boardBasis}</div>
                  </div>
                ))}
                <div style={{marginTop:'10px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <span style={{fontSize:'10px',opacity:0.6}}>Package Total</span>
                  <span style={{fontFamily:'Fraunces,serif',fontSize:'19px',fontWeight:'300',color:'#d4a84a'}}>{mcSellN>0?fmtS(mcSellN):'—'}</span>
                </div>
              </div>
            )}

            {/* Consultant initials */}
            <div className="card" style={{padding:'14px 16px'}}>
              <label className="label">Consultant Initials</label>
              <input className="input" maxLength={3} style={{textTransform:'uppercase',letterSpacing:'0.1em',fontWeight:'600',marginBottom:'6px'}} value={initials} onChange={e=>setInitials(e.target.value.toUpperCase())}/>
              <div style={{fontSize:'11.5px',color:'var(--text-muted)'}}>Ref: <span style={{fontWeight:'600',color:'var(--accent-mid)',fontFamily:'monospace'}}>{quoteRef}</span></div>
            </div>

            {/* Template picker */}
            <div className="card" style={{padding:'14px 16px'}}>
              <div style={{fontSize:'11px',fontWeight:'700',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:'8px'}}>Email Template</div>
              <div style={{display:'flex',flexDirection:'column',gap:'5px'}}>
                <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',padding:'4px 0 2px',fontWeight:'600'}}>Built-in</div>
                {TEMPLATES.map(t=>(
                  <button key={t.id} onClick={()=>{setEmailTemplate(t.id as 1|2|3|4);setSelectedCustomTemplate(null)}}
                    style={{padding:'7px 10px',borderRadius:'7px',border:'1.5px solid',textAlign:'left',cursor:'pointer',fontFamily:'Outfit,sans-serif',
                      borderColor:emailTemplate===t.id&&!selectedCustomTemplate?'var(--accent-mid)':'var(--border)',
                      background:emailTemplate===t.id&&!selectedCustomTemplate?'var(--accent-light)':'transparent'}}>
                    <div style={{fontSize:'12px',fontWeight:'500',color:emailTemplate===t.id&&!selectedCustomTemplate?'var(--accent-mid)':'var(--text-primary)'}}>{t.label}</div>
                    <div style={{fontSize:'10.5px',color:'var(--text-muted)'}}>{t.desc}</div>
                  </button>
                ))}
                {customTemplates.length>0&&(
                  <>
                    <div style={{fontSize:'10px',color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.06em',padding:'6px 0 2px',fontWeight:'600',borderTop:'1px solid var(--border)',marginTop:'4px'}}>Custom</div>
                    {customTemplates.map(t=>(
                      <button key={t.id} onClick={()=>setSelectedCustomTemplate(t.id)}
                        style={{padding:'7px 10px',borderRadius:'7px',border:'1.5px solid',textAlign:'left',cursor:'pointer',fontFamily:'Outfit,sans-serif',
                          borderColor:selectedCustomTemplate===t.id?'var(--accent-mid)':'var(--border)',
                          background:selectedCustomTemplate===t.id?'var(--accent-light)':'transparent'}}>
                        <div style={{fontSize:'12px',fontWeight:'500',color:selectedCustomTemplate===t.id?'var(--accent-mid)':'var(--text-primary)'}}>{t.name}</div>
                        {t.description&&<div style={{fontSize:'10.5px',color:'var(--text-muted)'}}>{t.description}</div>}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>

            <div style={{background:'var(--gold-light)',borderRadius:'10px',padding:'12px 14px',border:'1px solid var(--border)'}}>
              <div style={{fontSize:'10.5px',fontWeight:'700',color:'var(--gold)',marginBottom:'6px',textTransform:'uppercase',letterSpacing:'0.06em'}}>Markup Guide</div>
              <div style={{fontSize:'12px',color:'var(--text-secondary)',lineHeight:'1.8'}}>
                <div>🟢 10%+ great margin</div><div>🟡 7–10% acceptable</div><div>🔴 Under 7% review</div>
              </div>
            </div>

            <button className="btn btn-secondary" style={{width:'100%',justifyContent:'center',padding:'11px'}} onClick={()=>setShowPreview(true)}>
              👁 Preview & Copy Email
            </button>
          </div>
        </div>
      </div>

      {showPreview&&(
        <EmailPreviewModal
          deal={deal} quoteMode={quoteMode}
          hotelOptions={hotelOptions} centres={centres}
          adults={adults} children={children} infants={infants}
          additionalServices={additionalServices}
          sellPrice={quoteMode==='single'?parseFloat(hotelOptions[0]?.sellPrice||'0'):mcSellN}
          quoteRef={quoteRef} template={emailTemplate}
          selectedCustomTemplate={selectedCustomTemplate}
          customTemplates={customTemplates}
          onClose={()=>setShowPreview(false)}/>
      )}
    </div>
  )
}

// helper to check hotel var
function hotel(hotelOptions: HotelOption[]) { return hotelOptions[0]?.hotel || '' }

// ── EMAIL PREVIEW MODAL ───────────────────────────────────
function EmailPreviewModal({deal,quoteMode,hotelOptions,centres,adults,children,infants,additionalServices,sellPrice,quoteRef,template,selectedCustomTemplate,customTemplates,onClose}:any){
  const emailRef  = useRef<HTMLDivElement>(null)
  const client    = deal?.clients as any
  const firstName = client?.first_name||'Valued Client'
  const today     = new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'})
  const [activeTemplate,setActiveTemplate]=useState<1|2|3|4>(template)
  const [activeCustom,setActiveCustom]=useState<number|null>(selectedCustomTemplate)
  const isMulti   = quoteMode==='multi'
  const depositAmt= (sellPrice*0.1).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})

  const TEMPLATES=[{id:1,label:'The Dream Seller'},{id:2,label:'The Trusted Expert'},{id:3,label:'The Urgency Close'},{id:4,label:'The VIP Treatment'}] as const

  function copyEmail(){
    if(!emailRef.current) return
    const range=document.createRange(); range.selectNodeContents(emailRef.current)
    const sel=window.getSelection(); sel?.removeAllRanges(); sel?.addRange(range)
    document.execCommand('copy'); sel?.removeAllRanges()
    alert('Email copied! Paste directly into Outlook or Gmail.')
  }

  // Shared components
  const EHeader=()=>(
    <div style={{background:'#1a3a5c',padding:'22px 30px',textAlign:'center'}}>
      <div style={{color:'#c9963a',fontFamily:'Georgia,serif',fontSize:'22px',letterSpacing:'0.08em',fontWeight:'bold'}}>MAURITIUS HOLIDAYS DIRECT</div>
      <div style={{color:'rgba(255,255,255,0.45)',fontSize:'10px',marginTop:'4px',letterSpacing:'0.16em'}}>YOUR LUXURY MAURITIUS SPECIALIST · EST. 1999</div>
    </div>
  )
  const EMeta=()=>(
    <table style={{width:'100%',marginBottom:'24px'}}><tbody><tr>
      <td style={{width:'55%'}}/>
      <td style={{textAlign:'right',fontSize:'12px',color:'#666',lineHeight:'2'}}>
        <div><strong>Quote Date:</strong> {today}</div>
        <div><strong>Quote Ref:</strong> <span style={{fontFamily:'monospace',color:'#1a3a5c'}}>{quoteRef}</span></div>
        <div><strong>Your Consultant:</strong> Samir Abattouy — Mauritius Expert</div>
      </td>
    </tr></tbody></table>
  )
  const ETravellers=()=>(
    <div style={{background:'#eef2f8',padding:'9px 14px',borderRadius:'5px',marginBottom:'18px',fontSize:'13px',fontWeight:'600',color:'#1a3a5c'}}>
      Travellers: {adults} Adult{parseInt(adults)>1?'s':''}{parseInt(children)>0?`, ${children} Child${parseInt(children)>1?'ren':''}`:''}{parseInt(infants)>0?`, ${infants} Infant${parseInt(infants)>1?'s':''}`:''} 
    </div>
  )
  const EServices=()=>additionalServices?(
    <div style={{background:'#f0f7f0',border:'1px solid #c3dfc3',borderRadius:'7px',padding:'13px 16px',marginBottom:'18px'}}>
      <div style={{fontWeight:'700',fontSize:'12px',color:'#2d6a2d',marginBottom:'6px'}}>Also Included in Your Quote</div>
      <div style={{fontSize:'13px',color:'#444',lineHeight:'1.7',whiteSpace:'pre-wrap'}}>{additionalServices}</div>
    </div>
  ):null
  const EPrice=()=>(
    <div style={{background:'#1a3a5c',color:'white',padding:'16px 20px',borderRadius:'9px',display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'18px'}}>
      <div>
        <div style={{fontSize:'10px',color:'rgba(201,150,58,0.8)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:'3px'}}>Total Investment</div>
        <div style={{fontSize:'12px',color:'rgba(255,255,255,0.5)'}}>All inclusive — flights · transfers · accommodation · taxes</div>
      </div>
      <div style={{textAlign:'right'}}>
        <div style={{fontFamily:'Georgia,serif',fontSize:'28px',color:'#c9963a',fontWeight:'bold'}}>£{sellPrice.toLocaleString('en-GB',{minimumFractionDigits:2})}</div>
        <div style={{fontSize:'10px',color:'rgba(255,255,255,0.35)'}}>10% deposit = £{depositAmt}</div>
      </div>
    </div>
  )
  const ECredentials=()=>(
    <div style={{background:'#f8f8f6',borderRadius:'7px',padding:'14px 18px',marginBottom:'18px',fontSize:'12px'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
        {[['25 Years of Expertise','Specialists in Mauritius since 1999 — every resort personally visited.'],['Best Price Guarantee','Find it cheaper within 72 hours and we\'ll refund the difference.'],['Fully Protected','ABTA · IATA · ATOL Protected (5744) — your money is 100% safe.'],['5-Star Rated','Award-winning service — thousands of happy clients on Trustpilot.']].map(([t,d])=>(
          <div key={t}><div style={{fontWeight:'700',color:'#1a3a5c',marginBottom:'2px'}}>{t}</div><div style={{color:'#666',lineHeight:'1.5'}}>{d}</div></div>
        ))}
      </div>
    </div>
  )
  const EContact=()=>(
    <div style={{background:'#eef2f8',borderRadius:'7px',padding:'14px 18px',marginBottom:'18px',fontSize:'13px'}}>
      <div style={{fontWeight:'700',color:'#1a3a5c',marginBottom:'8px'}}>Ready to book? Contact Samir directly:</div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'6px',color:'#444'}}>
        <div>Direct: {CONTACT.direct}</div><div>WhatsApp: {CONTACT.whatsapp}</div>
        <div>Email: {CONTACT.email}</div><div><a href={CONTACT.calendly} style={{color:'#1a3a5c'}}>Schedule a call</a></div>
      </div>
      <div style={{marginTop:'8px',fontSize:'11px',color:'#888'}}><a href={CONTACT.trustpilot} style={{color:'#1a3a5c'}}>Read our Trustpilot reviews</a></div>
    </div>
  )
  const EDeposit=()=>(
    <div style={{background:'#fffbf0',border:'1px solid #f0d080',borderRadius:'7px',padding:'13px 16px',marginBottom:'18px',fontSize:'13px'}}>
      <strong>To secure your booking:</strong> A 10% deposit of <strong>£{depositAmt}</strong> is all that's needed today. Balance due 12 weeks before departure. Local accommodation tax of approx. €3 per adult per night payable at resort.
    </div>
  )
  const ESignature=()=>(
    <div style={{borderTop:'2px solid #e5e7eb',paddingTop:'18px'}}>
      <div style={{fontSize:'13px',color:'#666',marginBottom:'3px'}}>Warm regards,</div>
      <div style={{fontFamily:'Georgia,serif',fontSize:'19px',color:'#1a3a5c',marginBottom:'1px'}}>Samir Abattouy</div>
      <div style={{fontSize:'12px',color:'#c9963a',marginBottom:'10px',fontStyle:'italic'}}>Mauritius Expert · Senior Travel Consultant</div>
      <div style={{fontSize:'12px',color:'#555',lineHeight:'2'}}>
        Direct: {CONTACT.direct} · WhatsApp: {CONTACT.whatsapp}<br/>
        {CONTACT.email} · {CONTACT.web}
      </div>
      <div style={{marginTop:'14px',textAlign:'center',padding:'10px',background:'#1a3a5c',borderRadius:'5px',fontSize:'10px',fontWeight:'600',color:'#c9963a',letterSpacing:'0.08em'}}>
        ABTA · IATA · ATOL PROTECTED 5744 — BOOK WITH COMPLETE CONFIDENCE
      </div>
    </div>
  )

  // Single hotel block
  const SingleHotelBlock=({option,index,showLabel}:{option:HotelOption;index:number;showLabel:boolean})=>{
    const allLegs=[...option.outLegs,...option.retLegs]
    const checkinDisplay=option.checkinDate
      ? option.checkinNextDay?addDays(option.checkinDate,1):new Date(option.checkinDate+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
      : '—'
    const COLORS=['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ec4899']
    const col=COLORS[index%COLORS.length]
    const sellN=parseFloat(option.sellPrice)||0
    return(
      <div style={{marginBottom:'22px',border:`1.5px solid ${col}22`,borderRadius:'9px',overflow:'hidden'}}>
        {showLabel&&<div style={{background:col,padding:'9px 16px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{color:'white',fontWeight:'700',fontSize:'13px'}}>Option {index+1}: {option.hotel}</div>
          {sellN>0&&<div style={{color:'white',fontFamily:'Georgia,serif',fontSize:'16px',fontWeight:'bold'}}>£{sellN.toLocaleString('en-GB',{minimumFractionDigits:2})}</div>}
        </div>}
        <div style={{padding:'14px 16px'}}>
          <div style={{marginBottom:'14px'}}>
            <div style={{fontWeight:'700',marginBottom:'8px',fontSize:'12px',color:'#1a3a5c',borderBottom:'1.5px solid #c9963a',paddingBottom:'5px'}}>Accommodation</div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',border:'1px solid #e5e7eb'}}>
              <tbody>
                {[['Resort',option.hotel,'Meal Plan',option.boardBasis],['Room',option.roomType||'To be confirmed','Duration',`${option.nights} nights`],['Check-In',checkinDisplay,'Destination','Mauritius, Indian Ocean']].map(([l1,v1,l2,v2],i)=>(
                  <tr key={i} style={{background:i%2===0?'#f8f9fb':'white'}}>
                    <td style={{padding:'7px 11px',fontWeight:'600',width:'100px',fontSize:'11px',color:'#555'}}>{l1}</td><td style={{padding:'7px 11px',fontWeight:'500'}}>{v1}</td>
                    <td style={{padding:'7px 11px',fontWeight:'600',width:'90px',fontSize:'11px',color:'#555'}}>{l2}</td><td style={{padding:'7px 11px',fontWeight:'500'}}>{v2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {allLegs.some(l=>l.date||l.depart_time)&&(
            <div>
              <div style={{fontWeight:'700',marginBottom:'8px',fontSize:'12px',color:'#1a3a5c',borderBottom:'1.5px solid #c9963a',paddingBottom:'5px'}}>Flights</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11.5px'}}>
                <thead><tr style={{background:'#1a3a5c',color:'white'}}>{['Flight','Date','Departs','Arrives','Airline','Route','Cabin'].map(h=><th key={h} style={{padding:'6px 9px',textAlign:'left',fontWeight:'500',fontSize:'10.5px'}}>{h}</th>)}</tr></thead>
                <tbody>{allLegs.map((f,i)=>(
                  <tr key={f.id} style={{background:i%2===0?'#f8f9fb':'white',borderBottom:'1px solid #eee'}}>
                    <td style={{padding:'6px 9px',fontFamily:'monospace',fontWeight:'600'}}>{f.flight_number||'—'}</td>
                    <td style={{padding:'6px 9px'}}>{fmtLegDate(f.date)}</td>
                    <td style={{padding:'6px 9px',fontFamily:'monospace'}}>{f.depart_time||'—'}</td>
                    <td style={{padding:'6px 9px',fontFamily:'monospace'}}>{f.arrival_time||'—'}{f.overnight?' (+1)':''}</td>
                    <td style={{padding:'6px 9px'}}>{f.airline}</td>
                    <td style={{padding:'6px 9px',fontWeight:'500'}}>{f.from} → {f.to}</td>
                    <td style={{padding:'6px 9px'}}>{f.cabin}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
          {!showLabel&&sellN>0&&<div style={{background:'#1a3a5c',color:'white',padding:'12px 16px',borderRadius:'7px',display:'flex',justifyContent:'space-between',alignItems:'center',marginTop:'14px'}}>
            <div><div style={{fontSize:'10px',color:'rgba(201,150,58,0.8)',textTransform:'uppercase',letterSpacing:'0.1em'}}>Total Investment</div><div style={{fontSize:'11px',color:'rgba(255,255,255,0.5)'}}>Flights · transfers · accommodation</div></div>
            <div style={{fontFamily:'Georgia,serif',fontSize:'24px',color:'#c9963a',fontWeight:'bold'}}>£{sellN.toLocaleString('en-GB',{minimumFractionDigits:2})}</div>
          </div>}
        </div>
      </div>
    )
  }

  // Multi-centre block
  const MultiCentreBlocks=()=>(
    <div>
      <div style={{background:'#f0f4f9',borderRadius:'7px',padding:'12px 16px',marginBottom:'18px',fontSize:'12px',color:'#555'}}>
        <strong style={{color:'#1a3a5c'}}>Your Multi-Centre Holiday Itinerary</strong>
        <div style={{marginTop:'4px'}}>{centres.map((c:Centre)=>c.destination).filter(Boolean).join(' → ')}</div>
      </div>
      {centres.map((c:Centre,i:number)=>{
        const DEST_COLORS=['#f59e0b','#8b5cf6','#10b981','#3b82f6','#ec4899']
        const col=DEST_COLORS[i%DEST_COLORS.length]
        const allLegs=[...(c.inboundLegs||[]),...(i===centres.length-1?c.outboundLegs||[]:[]) ]
        const checkinDisplay=c.checkinDate
          ? c.checkinNextDay?addDays(c.checkinDate,1):new Date(c.checkinDate+'T12:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
          : '—'
        return(
          <div key={c.id} style={{marginBottom:'20px',borderLeft:`3px solid ${col}`,paddingLeft:'14px'}}>
            <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'10px'}}>
              <div style={{width:'22px',height:'22px',borderRadius:'50%',background:col,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:'700',flexShrink:0}}>{i+1}</div>
              <div style={{fontWeight:'700',fontSize:'14px',color:'#1a3a5c'}}>{c.destination||`Centre ${i+1}`}</div>
              <div style={{fontSize:'12px',color:'#888'}}>· {c.nights} nights</div>
            </div>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'12.5px',border:'1px solid #e5e7eb',marginBottom:'10px'}}>
              <tbody>
                {[['Hotel',c.hotel,'Meal Plan',c.boardBasis],['Room',c.roomType||'To be confirmed','Check-In',checkinDisplay]].map(([l1,v1,l2,v2],j)=>(
                  <tr key={j} style={{background:j%2===0?'#f8f9fb':'white'}}>
                    <td style={{padding:'7px 10px',fontWeight:'600',width:'90px',fontSize:'11px',color:'#555'}}>{l1}</td><td style={{padding:'7px 10px'}}>{v1}</td>
                    <td style={{padding:'7px 10px',fontWeight:'600',width:'80px',fontSize:'11px',color:'#555'}}>{l2}</td><td style={{padding:'7px 10px'}}>{v2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {allLegs.some((l:FlightLeg)=>l.date||l.depart_time)&&(
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px',marginBottom:'6px'}}>
                <thead><tr style={{background:'#1a3a5c',color:'white'}}>{['Date','Departs','Arrives','Airline','Route'].map(h=><th key={h} style={{padding:'5px 8px',textAlign:'left',fontWeight:'500',fontSize:'10px'}}>{h}</th>)}</tr></thead>
                <tbody>{allLegs.map((f:FlightLeg,j:number)=>(
                  <tr key={f.id} style={{background:j%2===0?'#f8f9fb':'white',borderBottom:'1px solid #eee'}}>
                    <td style={{padding:'5px 8px'}}>{fmtLegDate(f.date)}</td>
                    <td style={{padding:'5px 8px',fontFamily:'monospace'}}>{f.depart_time||'—'}</td>
                    <td style={{padding:'5px 8px',fontFamily:'monospace'}}>{f.arrival_time||'—'}{f.overnight?' (+1)':''}</td>
                    <td style={{padding:'5px 8px'}}>{f.airline}</td>
                    <td style={{padding:'5px 8px',fontWeight:'500'}}>{f.from} → {f.to}</td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </div>
        )
      })}
    </div>
  )

  // Build 4 templates
  const multiDesc=isMulti?`a multi-centre holiday across ${centres.map((c:Centre)=>c.destination).filter(Boolean).join(', ')}`:`a luxury holiday at ${hotelOptions[0]?.hotel||'the resort'}`
  const singleHotelName=hotelOptions[0]?.hotel||'the resort'

  const T1=()=>(
    <div style={{background:'white',color:'#333',fontFamily:'Arial,sans-serif',fontSize:'14px',lineHeight:'1.6'}}>
      <EHeader/>
      <div style={{padding:'28px 32px'}}>
        <EMeta/>
        <p style={{marginBottom:'8px'}}><strong>Dear {firstName},</strong></p>
        <p style={{marginBottom:'18px',fontSize:'15px',lineHeight:'1.8',color:'#1a3a5c',fontStyle:'italic',borderLeft:'3px solid #c9963a',paddingLeft:'14px'}}>
          {isMulti?`Imagine the perfect journey — the glamour of ${centres[0]?.destination||'your first destination'}, then the turquoise waters and warm sands of Mauritius. This is the holiday I've crafted for you.`:`Imagine waking up to the sound of the Indian Ocean, stepping onto your private terrace as the Mauritian sun rises over a turquoise lagoon. This is the holiday I've crafted for you.`}
        </p>
        <p style={{marginBottom:'18px'}}>Thank you for entrusting us with your {isMulti?'dream multi-centre holiday':'dream holiday to Mauritius'}. I've personally curated this quote for you — {isMulti?`a carefully planned itinerary across ${centres.map((c:Centre)=>c.destination).filter(Boolean).join(' and ')}`:`selecting ${singleHotelName} because I believe it perfectly matches what you're looking for`}.</p>
        <ETravellers/>
        {isMulti?<MultiCentreBlocks/>:hotelOptions.map((o:HotelOption,i:number)=><SingleHotelBlock key={o.id} option={o} index={i} showLabel={hotelOptions.length>1}/>)}
        <EServices/>
        <EPrice/>
        <ECredentials/>
        <EContact/>
        <EDeposit/>
        <ESignature/>
      </div>
    </div>
  )
  const T2=()=>(
    <div style={{background:'white',color:'#333',fontFamily:'Arial,sans-serif',fontSize:'14px',lineHeight:'1.6'}}>
      <EHeader/>
      <div style={{padding:'28px 32px'}}>
        <EMeta/>
        <p style={{marginBottom:'8px'}}><strong>Dear {firstName},</strong></p>
        <p style={{marginBottom:'14px'}}>My name is Samir Abattouy. For over 25 years I have specialised exclusively in {isMulti?'luxury long-haul holidays including Mauritius':'Mauritius'} — I have personally visited the island many times, staying at over 40 resorts, and have arranged thousands of holidays for discerning travellers. When I prepare a quote, it reflects genuine expertise.</p>
        <p style={{marginBottom:'18px'}}>Having considered your requirements carefully, I have prepared {isMulti?`a bespoke multi-centre itinerary — ${centres.map((c:Centre)=>c.destination).filter(Boolean).join(' followed by ')}`:`this quote for ${singleHotelName}`}. Please find the full details below.</p>
        <ETravellers/>
        {isMulti?<MultiCentreBlocks/>:hotelOptions.map((o:HotelOption,i:number)=><SingleHotelBlock key={o.id} option={o} index={i} showLabel={hotelOptions.length>1}/>)}
        <EServices/>
        <EPrice/>
        <ECredentials/>
        <EContact/>
        <EDeposit/>
        <ESignature/>
      </div>
    </div>
  )
  const T3=()=>(
    <div style={{background:'white',color:'#333',fontFamily:'Arial,sans-serif',fontSize:'14px',lineHeight:'1.6'}}>
      <EHeader/>
      <div style={{padding:'28px 32px'}}>
        <EMeta/>
        <p style={{marginBottom:'8px'}}><strong>Dear {firstName},</strong></p>
        <div style={{background:'#fff4e5',border:'1px solid #f0a830',borderRadius:'7px',padding:'12px 16px',marginBottom:'18px',fontSize:'13px'}}>
          <strong style={{color:'#c07000'}}>Important:</strong> This quote is based on live availability. Prices and room availability can change without notice — we recommend confirming at your earliest convenience.
        </div>
        <p style={{marginBottom:'18px'}}>Your complete {isMulti?'multi-centre holiday':'holiday'} quote is ready — everything is in place. All we need to secure your dates is a 10% deposit today.</p>
        <ETravellers/>
        {isMulti?<MultiCentreBlocks/>:hotelOptions.map((o:HotelOption,i:number)=><SingleHotelBlock key={o.id} option={o} index={i} showLabel={hotelOptions.length>1}/>)}
        <EServices/>
        <EPrice/>
        <div style={{background:'#f0faf0',border:'1px solid #80c080',borderRadius:'7px',padding:'13px 16px',marginBottom:'18px',fontSize:'13px'}}>
          <strong style={{color:'#2d6a2d'}}>How to Confirm Today</strong>
          <ol style={{margin:'7px 0 0 16px',lineHeight:'2',color:'#444'}}>
            <li>Call <strong>{CONTACT.direct}</strong> or reply to this email</li>
            <li>Pay your 10% deposit of <strong>£{depositAmt}</strong> by card or bank transfer</li>
            <li>Receive your booking confirmation and ATOL certificate within 24 hours</li>
          </ol>
        </div>
        <ECredentials/>
        <EContact/>
        <ESignature/>
      </div>
    </div>
  )
  const T4=()=>(
    <div style={{background:'white',color:'#333',fontFamily:'Arial,sans-serif',fontSize:'14px',lineHeight:'1.6'}}>
      <EHeader/>
      <div style={{padding:'28px 32px'}}>
        <EMeta/>
        <p style={{marginBottom:'8px'}}><strong>Dear {firstName},</strong></p>
        <p style={{marginBottom:'14px',fontSize:'15px',lineHeight:'1.8'}}>What follows is not an off-the-shelf package. This is a personally curated {isMulti?`multi-centre itinerary — ${centres.map((c:Centre)=>c.destination).filter(Boolean).join(' and ')} — `:'Mauritius holiday '}prepared exclusively for you by our senior Indian Ocean specialist.</p>
        <ETravellers/>
        {isMulti?<MultiCentreBlocks/>:hotelOptions.map((o:HotelOption,i:number)=><SingleHotelBlock key={o.id} option={o} index={i} showLabel={hotelOptions.length>1}/>)}
        <EServices/>
        <EPrice/>
        <div style={{background:'#1a3a5c',color:'white',borderRadius:'9px',padding:'16px 20px',marginBottom:'18px',fontSize:'12px'}}>
          <div style={{color:'#c9963a',fontWeight:'700',marginBottom:'9px',fontSize:'13px'}}>Your Dedicated Service Promise</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'9px'}}>
            {[['Personal Consultant','Samir handles your booking personally from enquiry to return'],['Airport Representative','Our team greets you on arrival'],['24/7 In-Resort Support','Direct line to us throughout your holiday'],['Full Financial Protection','ABTA · IATA · ATOL 5744 — fully safeguarded']].map(([t,d])=>(
              <div key={t}><div style={{color:'#c9963a',fontWeight:'600',marginBottom:'2px',fontSize:'11px'}}>{t}</div><div style={{color:'rgba(255,255,255,0.7)',fontSize:'11px',lineHeight:'1.5'}}>{d}</div></div>
            ))}
          </div>
        </div>
        <EContact/>
        <EDeposit/>
        <ESignature/>
      </div>
    </div>
  )

  const templates={1:<T1/>,2:<T2/>,3:<T3/>,4:<T4/>}

  // Custom template renderer
  const CustomTemplateView=({ct}:{ct:any})=>(
    <div style={{background:'white',color:'#333',fontFamily:'Arial,sans-serif',fontSize:'14px',lineHeight:'1.6'}}>
      <EHeader/>
      <div style={{padding:'28px 32px'}}>
        <EMeta/>
        <p style={{marginBottom:'8px'}}><strong>Dear {firstName},</strong></p>
        {ct.opening_hook&&<p style={{marginBottom:'18px',whiteSpace:'pre-wrap'}}>{ct.opening_hook.replace(/\[Client Name\]/g,firstName).replace(/\[Hotel Name\]/g,isMulti?centres[0]?.hotel||'the resort':hotelOptions[0]?.hotel||'the resort')}</p>}
        {ct.urgency_notice&&(
          <div style={{background:'#fff4e5',border:'1px solid #f0a830',borderRadius:'7px',padding:'12px 16px',marginBottom:'18px',fontSize:'13px'}}>
            <strong style={{color:'#c07000'}}>⚠ </strong>{ct.urgency_notice}
          </div>
        )}
        <ETravellers/>
        {isMulti?<MultiCentreBlocks/>:hotelOptions.map((o:HotelOption,i:number)=><SingleHotelBlock key={o.id} option={o} index={i} showLabel={hotelOptions.length>1}/>)}
        <EServices/>
        <EPrice/>
        {ct.why_choose_us&&(
          <div style={{background:'#f8f8f6',borderRadius:'7px',padding:'14px 18px',marginBottom:'18px',fontSize:'12px'}}>
            <div style={{fontWeight:'bold',marginBottom:'8px',color:'#1a3a5c'}}>Why Choose Us?</div>
            <div style={{whiteSpace:'pre-wrap',color:'#555'}}>{ct.why_choose_us}</div>
          </div>
        )}
        <EContact/>
        {ct.closing_cta&&<p style={{marginBottom:'18px',whiteSpace:'pre-wrap',fontSize:'13px'}}>{ct.closing_cta}</p>}
        <EDeposit/>
        <ESignature/>
      </div>
    </div>
  )

  const activeCustomData = activeCustom ? customTemplates?.find((t:any)=>t.id===activeCustom) : null

  return(
    <div className="modal-backdrop" onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{background:'var(--surface)',borderRadius:'16px',width:'100%',maxWidth:'800px',maxHeight:'94vh',overflow:'hidden',display:'flex',flexDirection:'column',boxShadow:'var(--shadow-lg)'}}>
        <div style={{padding:'14px 22px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',flexShrink:0}}>
          <div style={{fontFamily:'Fraunces,serif',fontSize:'18px',fontWeight:'300'}}>Email Preview — {quoteRef}</div>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <button className="btn btn-cta btn-sm" onClick={copyEmail}>📋 Copy to Clipboard</button>
            <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
          </div>
        </div>
        <div style={{padding:'10px 22px',borderBottom:'1px solid var(--border)',display:'flex',gap:'6px',flexShrink:0,background:'var(--bg-tertiary)',alignItems:'center',flexWrap:'wrap'}}>
          <span style={{fontSize:'11.5px',color:'var(--text-muted)',marginRight:'4px'}}>Template:</span>
          {TEMPLATES.map(t=>(
            <button key={t.id} onClick={()=>{setActiveTemplate(t.id as 1|2|3|4);setActiveCustom(null)}}
              style={{padding:'4px 12px',borderRadius:'20px',border:'1.5px solid',fontSize:'11.5px',cursor:'pointer',fontFamily:'Outfit,sans-serif',
                borderColor:activeTemplate===t.id&&!activeCustom?'var(--accent-mid)':'var(--border)',
                background:activeTemplate===t.id&&!activeCustom?'var(--accent-mid)':'transparent',
                color:activeTemplate===t.id&&!activeCustom?'white':'var(--text-muted)'}}>
              {t.label}
            </button>
          ))}
          {customTemplates?.length>0&&customTemplates.map((t:any)=>(
            <button key={t.id} onClick={()=>setActiveCustom(t.id)}
              style={{padding:'4px 12px',borderRadius:'20px',border:'1.5px solid',fontSize:'11.5px',cursor:'pointer',fontFamily:'Outfit,sans-serif',
                borderColor:activeCustom===t.id?'var(--accent-mid)':'var(--border)',
                background:activeCustom===t.id?'var(--accent-mid)':'transparent',
                color:activeCustom===t.id?'white':'var(--text-muted)'}}>
              ✦ {t.name}
            </button>
          ))}
        </div>
        <div style={{overflow:'auto',flex:1,padding:'18px'}}>
          <div ref={emailRef}>{activeCustomData?<CustomTemplateView ct={activeCustomData}/>:templates[activeTemplate]}</div>
        </div>
      </div>
    </div>
  )
}
