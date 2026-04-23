'use client'

import { useState } from 'react'
import type { PortalNotificationView, NotificationType } from '@/lib/modules/portal/portal.types'

const TYPE_ICON: Record<NotificationType, string> = {
  balance_reminder: '💳',
  passport_reminder: '🛂',
  documents_coming: '📄',
  countdown: '✈️',
  general: '💬',
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function NotificationsTimeline({ notifications: initial, token }: {
  notifications: PortalNotificationView[]
  token: string
}) {
  const [items, setItems] = useState(initial)

  async function markRead(id: string) {
    setItems(prev => prev.map(n => n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
    await fetch(`/api/portal/${token}/notifications/${id}/read`, { method: 'PATCH' })
  }

  return (
    <div style={{ padding: '20px', background: '#fff' }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 16px' }}>Updates</p>

      {items.map(n => (
        <div
          key={n.id}
          onClick={() => !n.read_at && markRead(n.id)}
          style={{
            display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #f3f4f6',
            cursor: n.read_at ? 'default' : 'pointer',
            opacity: n.read_at ? 0.7 : 1,
          }}
        >
          <span style={{ fontSize: 20, flexShrink: 0, lineHeight: 1 }}>{TYPE_ICON[n.type]}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: '0 0 4px', fontSize: 14, color: '#111827', lineHeight: 1.5, fontWeight: n.read_at ? 400 : 500 }}>
              {n.body}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: '#9ca3af' }}>{fmtDate(n.scheduled_for)}</p>
          </div>
          {!n.read_at && (
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1a3a5c', flexShrink: 0, marginTop: 6 }} />
          )}
        </div>
      ))}
    </div>
  )
}
