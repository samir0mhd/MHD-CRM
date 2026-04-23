'use client'

import { useState, useRef } from 'react'
import type { PortalPassengerView, PassportStatus } from '@/lib/modules/portal/portal.types'
import { PASSPORT_STATUS_LABEL } from '@/lib/modules/portal/portal.types'

const STATUS_STYLE: Record<PassportStatus, { bg: string; color: string }> = {
  pending:          { bg: '#fef9c3', color: '#92400e' },
  uploaded:         { bg: '#dbeafe', color: '#1e40af' },
  needs_attention:  { bg: '#fee2e2', color: '#991b1b' },
  checked:          { bg: '#dcfce7', color: '#166534' },
}

function PassportSlot({ passenger, token, onUpdated }: {
  passenger: PortalPassengerView
  token: string
  onUpdated: (passengerId: number, status: PassportStatus) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const status = passenger.passport.status
  const canUpload = status === 'pending' || status === 'needs_attention'
  const style = STATUS_STYLE[status]

  async function handleFile(file: File) {
    setUploading(true)
    setError(null)
    const form = new FormData()
    form.append('file', file)

    const res = await fetch(`/api/portal/${token}/passports/${passenger.id}`, {
      method: 'POST',
      body: form,
    })
    const result = await res.json()
    setUploading(false)

    if (result.success) {
      onUpdated(passenger.id, 'uploaded')
    } else {
      setError(result.message ?? 'Upload failed')
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid #f3f4f6' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: '0 0 2px', fontSize: 14, fontWeight: 600, color: '#111827' }}>
          {passenger.first_name} {passenger.last_name}
        </p>
        <p style={{ margin: 0, fontSize: 12, color: '#9ca3af', textTransform: 'capitalize' as const }}>
          {passenger.passenger_type}
        </p>
        {error && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#dc2626' }}>{error}</p>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column' as const, alignItems: 'flex-end', gap: 6, marginLeft: 12 }}>
        <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 10, background: style.bg, color: style.color, whiteSpace: 'nowrap' as const }}>
          {status === 'pending' ? 'Needed' : status === 'uploaded' ? 'Under review' : status === 'needs_attention' ? 'Action needed' : 'Confirmed ✓'}
        </span>

        {canUpload && (
          <>
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{ fontSize: 12, color: '#1a3a5c', background: 'none', border: '1px solid #1a3a5c', borderRadius: 6, padding: '4px 10px', cursor: uploading ? 'not-allowed' : 'pointer', opacity: uploading ? 0.6 : 1 }}
            >
              {uploading ? 'Uploading…' : 'Upload copy'}
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </>
        )}

        {status === 'needs_attention' && (
          <p style={{ margin: 0, fontSize: 12, color: '#dc2626' }}>Contact your consultant</p>
        )}
      </div>
    </div>
  )
}

export default function PassengersSection({ passengers, token }: { passengers: PortalPassengerView[]; token: string }) {
  const [list, setList] = useState(passengers)

  function handleUpdated(passengerId: number, status: PassportStatus) {
    setList(prev => prev.map(p =>
      p.id === passengerId ? { ...p, passport: { ...p.passport, status } } : p
    ))
  }

  return (
    <div style={{ padding: '20px', background: '#fff' }}>
      <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: '#9ca3af', textTransform: 'uppercase', margin: '0 0 4px' }}>Passengers &amp; Passports</p>
      <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 16px', lineHeight: 1.5 }}>
        Passport copies are reviewed by our team before travel.
      </p>

      {list.map(p => (
        <PassportSlot key={p.id} passenger={p} token={token} onUpdated={handleUpdated} />
      ))}
    </div>
  )
}
