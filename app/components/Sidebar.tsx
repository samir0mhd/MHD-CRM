'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth, useTheme } from '../providers'

const NAV = [
  {
    section: 'Admin',
    items: [
      { href: '/',        label: 'Dashboard',        icon: '◈' },
      { href: '/today',   label: "Today's Actions",  icon: '◎' },
      { href: '/reports', label: 'Admin Reports',    icon: '📊' },
      { href: '/users',   label: 'User Access',      icon: '🔐' },
    ],
  },
  {
    section: 'Sales',
    items: [
      { href: '/pipeline',   label: 'Pipeline',        icon: '⬡' },
      { href: '/deals',      label: 'All Deals',        icon: '≡' },
      { href: '/lost',       label: 'Lost Deals',       icon: '◌' },
      { href: '/quotes/new', label: 'Quote Builder',    icon: '◇' },
      { href: '/followups',  label: 'Follow-ups',       icon: '✉' },
      { href: '/templates',  label: 'Email Templates',  icon: '◫' },
    ],
  },
  {
    section: 'Clients',
    items: [
      { href: '/clients', label: 'Clients', icon: '○' },
    ],
  },
  {
    section: 'Bookings',
    items: [
      { href: '/bookings', label: 'Bookings', icon: '✦' },
    ],
  },
  {
    section: 'Resources',
    items: [
      { href: '/hotels',    label: 'Hotel Directory', icon: '🏨' },
      { href: '/hotel-pricing', label: 'Hotel Pricing', icon: '◭' },
      { href: '/suppliers', label: 'Suppliers',        icon: '◈' },
    ],
  },
]

export default function Sidebar() {
  const pathname  = usePathname()
  const { theme, toggleTheme } = useTheme()
  const { staffUser } = useAuth()
  const hydratedTheme = useSyncExternalStore(
    () => () => {},
    () => theme,
    () => 'light',
  )

  const themeLabel = hydratedTheme === 'dark' ? 'Dark mode' : 'Light mode'
  const themeIcon = hydratedTheme === 'dark' ? '☾' : '○'
  const themeToggleClass = hydratedTheme === 'dark' ? 'theme-toggle dark' : 'theme-toggle'

  function isActive(href: string) {
    if (href === '/quotes/new') return pathname.startsWith('/quotes')
    if (href === '/deals')      return pathname === '/deals'
    if (href === '/')           return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="sidebar">

      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{
            width:'34px', height:'34px', flexShrink:0,
            background:'var(--text-primary)', borderRadius:'9px',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <span style={{
              fontFamily:'Fraunces, serif',
              fontSize:'17px', fontWeight:'400', fontStyle:'italic',
              color:'var(--bg-primary)', lineHeight:1,
            }}>M</span>
          </div>
          <div>
            <div style={{
              fontFamily:'Fraunces, serif',
              fontSize:'15px', fontWeight:'300',
              color:'var(--text-primary)', lineHeight:1.2,
              letterSpacing:'-0.01em',
            }}>
              Mauritius
            </div>
            <div style={{
              fontFamily:'Outfit, sans-serif',
              fontSize:'9.5px', color:'var(--text-muted)',
              textTransform:'uppercase', letterSpacing:'0.1em',
              fontWeight:'600', marginTop:'1px',
            }}>
              Holidays Direct
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map((group) => (
          <div key={group.section}>
            <div className="nav-section-label">{group.section}</div>
            {group.items.map((item) => {
              const active = isActive(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${active ? 'active' : ''}`}
                >
                  <span className="nav-icon"
                    style={{ color: active ? 'var(--accent)' : undefined }}>
                    {item.icon}
                  </span>
                  <span style={{ flex:1 }}>{item.label}</span>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer — theme toggle + user */}
      <div style={{
        padding:'14px 14px',
        borderTop:'1px solid var(--border)',
        display:'flex', flexDirection:'column', gap:'10px',
      }}>
        {/* Theme toggle */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
            <span style={{ fontSize:'13px', opacity:0.6 }}>
              {themeIcon}
            </span>
            <span style={{ fontSize:'12px', color:'var(--text-muted)', fontFamily:'Outfit, sans-serif' }}>
              {themeLabel}
            </span>
          </div>
          <button
            className={themeToggleClass}
            onClick={toggleTheme}
            aria-label="Toggle theme"
          />
        </div>

        {/* User */}
        <div style={{ display:'flex', alignItems:'center', gap:'9px', paddingTop:'2px' }}>
          <div style={{
            width:'28px', height:'28px', borderRadius:'50%', flexShrink:0,
            background:'var(--accent-light)', border:'1.5px solid var(--accent)',
            display:'flex', alignItems:'center', justifyContent:'center',
          }}>
            <span style={{
              fontFamily:'Fraunces, serif', fontSize:'12px',
              color:'var(--accent)', fontStyle:'italic',
            }}>{(staffUser?.name || 'S').charAt(0)}</span>
          </div>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:'12.5px', fontWeight:'500', color:'var(--text-primary)', lineHeight:1.2, fontFamily:'Outfit, sans-serif' }}>
              {staffUser?.name || 'Signed in'}
            </div>
            <div style={{ fontSize:'10.5px', color:'var(--text-muted)', lineHeight:1.2, fontFamily:'Outfit, sans-serif' }}>
              {staffUser?.role || 'Secure access'}
            </div>
          </div>
          <button className="btn btn-secondary btn-xs" onClick={() => void supabase.auth.signOut()}>Sign out</button>
        </div>
      </div>
    </aside>
  )
}
