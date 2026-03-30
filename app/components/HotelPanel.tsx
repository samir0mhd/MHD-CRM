'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Hotel = {
  id: number
  name: string
  description: string | null
  star_rating: number | null
  region: string | null
  website_url: string | null
  mhd_url: string | null
  brochure_url: string | null
  room_types: string[] | null
  meal_plans: string[] | null
  highlights: string[] | null
}

function Stars({ rating }: { rating: number | null }) {
  if (!rating) return null
  return (
    <span style={{ color: '#f59e0b', fontSize: '16px', letterSpacing: '2px' }}>
      {'★'.repeat(Math.floor(rating))}{'☆'.repeat(5 - Math.floor(rating))}
    </span>
  )
}

// ── HOTEL NAME BUTTON ─────────────────────────────────────
// Use this anywhere you want a clickable hotel name
export function HotelName({ name, style }: { name: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={e => { e.stopPropagation(); setOpen(true) }}
        style={{
          background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          fontFamily: 'inherit', fontSize: 'inherit', fontWeight: 'inherit',
          color: 'inherit', textAlign: 'left', textDecoration: 'none',
          borderBottom: '1px dashed var(--border)', transition: 'border-color 0.12s',
          ...style,
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
        {name}
      </button>
      {open && <HotelPanel name={name} onClose={() => setOpen(false)} />}
    </>
  )
}

// ── HOTEL PANEL ───────────────────────────────────────────
export function HotelPanel({ name, onClose }: { name: string; onClose: () => void }) {
  const [hotel, setHotel] = useState<Hotel | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('hotel_list')
        .select('*')
        .ilike('name', name)
        .single()
      setHotel(data)
      setLoading(false)
    }
    load()
  }, [name])

  const hasContent = hotel && (hotel.description || hotel.highlights?.length || hotel.room_types?.length || hotel.meal_plans?.length || hotel.star_rating)

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 300, backdropFilter: 'blur(2px)' }}
      />

      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: '420px', background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        zIndex: 301, display: 'flex', flexDirection: 'column',
        boxShadow: 'var(--shadow-lg)',
        animation: 'slideIn 0.2s ease',
      }}>
        <style>{`@keyframes slideIn { from { transform: translateX(100%) } to { transform: translateX(0) } }`}</style>

        {/* Header */}
        <div style={{ padding: '20px 22px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, marginRight: '12px' }}>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '20px', fontWeight: '300', color: 'var(--text-primary)', lineHeight: '1.2', marginBottom: '4px' }}>{name}</div>
              {hotel?.region && <div style={{ fontSize: '12px', color: 'var(--accent-mid)', fontWeight: '500' }}>📍 {hotel.region}</div>}
              {hotel?.star_rating && <div style={{ marginTop: '4px' }}><Stars rating={hotel.star_rating} /></div>}
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: 'var(--text-muted)', padding: '0', lineHeight: 1 }}>✕</button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 22px' }}>
          {loading ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading…</div>
          ) : !hasContent ? (
            <div style={{ textAlign: 'center', padding: '32px 20px' }}>
              <div style={{ fontSize: '28px', marginBottom: '12px', opacity: 0.3 }}>🏨</div>
              <div style={{ fontFamily: 'Fraunces,serif', fontSize: '18px', fontWeight: '300', color: 'var(--text-secondary)', marginBottom: '8px' }}>No profile yet</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '20px' }}>Add details in the Hotel Directory to see them here.</div>
              <a href="/hotels" style={{ display: 'inline-block', padding: '8px 18px', background: 'var(--action-primary-bg)', color: 'var(--action-primary-text)', borderRadius: '8px', fontSize: '13px', textDecoration: 'none', fontFamily: 'Outfit,sans-serif', fontWeight: '500' }}>
                Open Hotel Directory →
              </a>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

              {/* Highlights */}
              {hotel?.highlights?.length ? (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Resort Highlights</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {hotel.highlights.map((h, i) => (
                      <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', fontSize: '13.5px', color: 'var(--text-primary)', lineHeight: '1.5' }}>
                        <span style={{ color: 'var(--accent-mid)', flexShrink: 0, marginTop: '2px' }}>✦</span>
                        <span>{h}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Description */}
              {hotel?.description && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>About</div>
                  <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: '1.7' }}>{hotel.description}</div>
                </div>
              )}

              {/* Room types */}
              {hotel?.room_types?.length ? (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Room Types</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {hotel.room_types.map((r, i) => (
                      <span key={i} style={{ padding: '4px 10px', background: 'var(--blue-light)', color: 'var(--blue)', borderRadius: '6px', fontSize: '12.5px', fontWeight: '500' }}>{r}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Meal plans */}
              {hotel?.meal_plans?.length ? (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '8px' }}>Meal Plans</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {hotel.meal_plans.map((m, i) => (
                      <span key={i} style={{ padding: '4px 10px', background: 'var(--teal-light)', color: 'var(--teal)', borderRadius: '6px', fontSize: '12.5px', fontWeight: '500' }}>{m}</span>
                    ))}
                  </div>
                </div>
              ) : null}

              {/* Links */}
              {(hotel?.website_url || hotel?.mhd_url || hotel?.brochure_url) && (
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '10px' }}>Links & Resources</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {hotel.website_url && (
                      <a href={hotel.website_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', textDecoration: 'none', border: '1px solid var(--border)', transition: 'all 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                        <span style={{ fontSize: '16px' }}>🌐</span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>Hotel Website</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{hotel.website_url.replace('https://','').replace('http://','')}</div>
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>↗</span>
                      </a>
                    )}
                    {hotel.mhd_url && (
                      <a href={hotel.mhd_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--gold-light)', borderRadius: '8px', textDecoration: 'none', border: '1px solid var(--border)', transition: 'all 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--gold)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                        <span style={{ fontSize: '16px' }}>🏖</span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>MHD Website Page</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>mauritiusholidaysdirect.co.uk</div>
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>↗</span>
                      </a>
                    )}
                    {hotel.brochure_url && (
                      <a href={hotel.brochure_url} target="_blank" rel="noopener noreferrer"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-tertiary)', borderRadius: '8px', textDecoration: 'none', border: '1px solid var(--border)', transition: 'all 0.12s' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                        <span style={{ fontSize: '16px' }}>📄</span>
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--text-primary)' }}>Brochure / Fact Sheet</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>PDF or document link</div>
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>↗</span>
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* Edit link */}
              <div style={{ paddingTop: '8px', borderTop: '1px solid var(--border)' }}>
                <a href="/hotels" style={{ fontSize: '12.5px', color: 'var(--accent)', textDecoration: 'none', fontFamily: 'Outfit,sans-serif' }}>
                  ✏ Edit this hotel profile →
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
