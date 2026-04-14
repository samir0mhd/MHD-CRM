'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '../providers'
import { isManager } from '@/lib/access'

const NAV = [
  {
    section: 'Home',
    items: [
      { href: '/',      label: 'Overview', icon: '◎' },
      { href: '/today', label: 'Today',    icon: '◌' },
    ],
  },
  {
    section: 'Sales',
    items: [
      { href: '/pipeline',   label: 'Pipeline',       icon: '⬡' },
      { href: '/deals',      label: 'All Deals',      icon: '≡' },
      { href: '/lost',       label: 'Lost Deals',     icon: '◔' },
      { href: '/quotes/new', label: 'Quote Builder',  icon: '◇' },
      { href: '/followups',  label: 'Follow-ups',     icon: '✉' },
    ],
  },
  {
    section: 'Bookings',
    items: [
      { href: '/bookings', label: 'Bookings', icon: '✦' },
    ],
  },
  {
    section: 'Clients',
    items: [
      { href: '/clients', label: 'Clients', icon: '○' },
    ],
  },
  {
    section: 'Performance',
    items: [
      { href: '/reports', label: 'Reports', icon: '◫' },
    ],
  },
  {
    section: 'Resources',
    items: [
      { href: '/hotels',        label: 'Hotel Directory', icon: '▣' },
      { href: '/hotel-pricing', label: 'Hotel Pricing',   icon: '◭' },
      { href: '/suppliers',     label: 'Suppliers',       icon: '◈' },
      { href: '/templates',     label: 'Templates',       icon: '△' },
    ],
  },
]

export default function Sidebar() {
  const pathname  = usePathname()
  const { staffUser } = useAuth()
  const navGroups = isManager(staffUser)
    ? [
        {
          section: 'Workspace',
          items: [{ href: '/workspace', label: 'My Workspace', icon: '◈' }],
        },
        ...NAV,
        {
          section: 'Team & Admin',
          items: [{ href: '/users', label: 'User Access', icon: '🔐' }],
        },
      ]
    : NAV

  function isActive(href: string) {
    if (href === '/quotes/new') return pathname.startsWith('/quotes')
    if (href === '/deals')      return pathname === '/deals'
    if (href === '/')           return pathname === '/'
    return pathname === href || pathname.startsWith(href + '/')
  }

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-brand-mark">
          <div className="sidebar-brand-badge">
            <span className="sidebar-brand-letter">M</span>
          </div>
          <div>
            <div className="sidebar-brand-title">Mauritius Holidays</div>
            <div className="sidebar-brand-subtitle">Direct CRM</div>
          </div>
        </div>
      </div>

      <div className="sidebar-nav-wrap">
        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.section} className="nav-group">
              <div className="nav-section-label">{group.section}</div>
              {group.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`nav-item ${active ? 'active' : ''}`}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span style={{ flex:1 }}>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
      </div>
    </aside>
  )
}
