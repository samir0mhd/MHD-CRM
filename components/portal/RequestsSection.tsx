'use client'

import { useState } from 'react'
import type { PortalRequestView, RequestCategory } from '@/lib/modules/portal/portal.types'
import { REQUEST_CATEGORY_LABEL } from '@/lib/modules/portal/portal.types'

const CATEGORIES: RequestCategory[] = ['room', 'dietary', 'celebration', 'accessibility', 'general']

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  'Submitted':   { bg: '#f3f4f6', color: '#374151' },
  'In progress': { bg: '#dbeafe', color: '#1e40af' },
  'Arranged':    { bg: '#dcfce7', color: '#166534' },
}

export default function RequestsSection({ requests: initial, token }: { requests: PortalRequestView[]; token: string }) {
  const [requests, setRequests] = useState(initial)
  const [open, setOpen]         = useState(false)
  const [category, setCategory] = useState<RequestCategory>('general')
  const [message, setMessage]   = useState('')
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState<string | null>(null)

  async function submit() {
    if (!message.trim()) { setError('Please enter a message'); return }
    setSaving(true)
    setError(null)

    const res = await fetch(`/api/portal/${token}/requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, message: message.trim() }),
    })
    const result = await res.json()
    setSaving(false)

    if (result.success) {
      setRequests(prev => [result.data, ...prev])
      setMessage('')
      setOpen(false)
    } else {
      setError(result.message ?? 'Something went wrong')
    }
  }

  return (
    <div style={{ padding: '20px', background: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase', margin: 0 }}>Requests</p>
        {!open && (
          <button onClick={() => setOpen(true)} style={{ fontSize: 13, fontWeight: 600, color: '#1a3a5c', background: 'none', border: '1px solid #1a3a5c', borderRadius: 6, padding: '5px 12px', cursor: 'pointer' }}>
            + New request
          </button>
        )}
      </div>

      {open && (
        <div style={{ background: '#f9fafb', borderRadius: 10, padding: 16, marginBottom: 16, border: '1px solid #e5e7eb' }}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>Category</label>
            <select
              value={category}
              onChange={e => setCategory(e.target.value as RequestCategory)}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, background: '#fff' }}
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{REQUEST_CATEGORY_LABEL[c]}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }}>Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              placeholder="Tell us what you need…"
              rows={3}
              maxLength={1000}
              style={{ width: '100%', padding: '8px 10px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 14, resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit' }}
            />
          </div>

          {error && <p style={{ color: '#dc2626', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={submit} disabled={saving} style={{ flex: 1, padding: '10px', background: '#1a3a5c', color: '#fff', border: 'none', borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Sending…' : 'Send request'}
            </button>
            <button onClick={() => { setOpen(false); setMessage(''); setError(null) }} style={{ padding: '10px 16px', background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 7, fontSize: 14, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {requests.length === 0 && !open && (
        <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>No requests yet. Tap above to send one.</p>
      )}

      {requests.map(r => {
        const ss = STATUS_STYLE[r.status_label] ?? STATUS_STYLE['Submitted']
        return (
          <div key={r.id} style={{ padding: '12px 0', borderBottom: '1px solid #f3f4f6' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: '0 0 3px', fontSize: 12, color: '#9ca3af' }}>{r.category_label}</p>
                <p style={{ margin: 0, fontSize: 14, color: '#374151', lineHeight: 1.5 }}>{r.message}</p>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: ss.bg, color: ss.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {r.status_label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
