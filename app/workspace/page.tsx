'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { authedFetch } from '@/lib/api-client'
import { useAuth } from '@/app/providers'
import type { WorkspaceResponse } from '@/lib/modules/workspace/workspace.service'

const money = (value: number) => `£${Number(value || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}`
const moneyPrecise = (value: number) => `£${Number(value || 0).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

function formatDate(value: string | null | undefined) {
  if (!value) return 'Not scheduled'
  return new Date(value.includes('T') ? value : `${value}T12:00`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function clientName(client?: { first_name?: string | null; last_name?: string | null } | null) {
  const name = `${client?.first_name || ''} ${client?.last_name || ''}`.trim()
  return name || 'Unassigned traveller'
}

function initials(name: string) {
  return name
    .split(' ')
    .map(part => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

function progressWidth(value: number, max: number) {
  if (!max || max <= 0) return '0%'
  return `${Math.max(0, Math.min((value / max) * 100, 100))}%`
}

function MiniStat({
  label,
  value,
  hint,
}: {
  label: string
  value: string
  hint?: string
}) {
  return (
    <div className="workspace-mini-stat">
      <div className="workspace-mini-label">{label}</div>
      <div className="workspace-mini-value">{value}</div>
      {hint ? <div className="workspace-mini-hint">{hint}</div> : null}
    </div>
  )
}

export default function WorkspacePage() {
  const { staffUser, refreshStaff } = useAuth()
  const searchParams = useSearchParams()
  const [data, setData] = useState<WorkspaceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [removingPhoto, setRemovingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({
    job_title: '',
    profile_photo_url: '',
    email_signature: '',
  })

  const requestedStaffId = useMemo(() => {
    const raw = searchParams.get('staffId')
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) ? parsed : null
  }, [searchParams])

  async function loadWorkspace(targetStaffId?: number | null) {
    setLoading(true)
    setError(null)

    const response = await authedFetch(targetStaffId ? `/api/workspace?staffId=${targetStaffId}` : '/api/workspace')
    const json = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(typeof json.error === 'string' ? json.error : 'Failed to load workspace')
      setLoading(false)
      return
    }

    const nextData = (json.data || null) as WorkspaceResponse | null
    setData(nextData)
    setForm({
      job_title: nextData?.profile.job_title || '',
      profile_photo_url: nextData?.profile.profile_photo_url || '',
      email_signature: nextData?.profile.email_signature || '',
    })
    setLoading(false)
  }

  useEffect(() => {
    let active = true
    const url = requestedStaffId ? `/api/workspace?staffId=${requestedStaffId}` : '/api/workspace'

    authedFetch(url)
      .then(response => response.json().catch(() => ({})).then(json => ({ response, json })))
      .then(({ response, json }) => {
        if (!active) return

        if (!response.ok) {
          setError(typeof json.error === 'string' ? json.error : 'Failed to load workspace')
          setLoading(false)
          return
        }

        const nextData = (json.data || null) as WorkspaceResponse | null
        setData(nextData)
        setForm({
          job_title: nextData?.profile.job_title || '',
          profile_photo_url: nextData?.profile.profile_photo_url || '',
          email_signature: nextData?.profile.email_signature || '',
        })
        setLoading(false)
      })
      .catch(() => {
        if (!active) return
        setError('Failed to load workspace')
        setLoading(false)
      })

    return () => {
      active = false
    }
  }, [requestedStaffId])

  const roleLabel = data?.profile
    ? data.profile.job_title || data.profile.role || 'Team member'
    : staffUser?.role || 'Team member'
  const isOwnWorkspace = !!staffUser && !!data && staffUser.id === data.profile.id

  async function handleSaveProfile() {
    setSaving(true)
    setMessage(null)
    setError(null)

    const response = await authedFetch('/api/workspace', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(typeof json.error === 'string' ? json.error : 'Failed to save profile')
      setSaving(false)
      return
    }

    setMessage('Workspace profile updated')
    await refreshStaff()
    await loadWorkspace(requestedStaffId)
    setSaving(false)
  }

  async function handlePhotoUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (file.size > 2 * 1024 * 1024) {
      setPhotoError('File must be under 2 MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Only JPG, PNG or WebP accepted')
      return
    }

    setPhotoError(null)
    setUploadingPhoto(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const response = await authedFetch('/api/workspace/photo', { method: 'POST', body: fd })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        setPhotoError(json.error || 'Upload failed')
        return
      }
      setForm(current => ({ ...current, profile_photo_url: json.url }))
      await refreshStaff()
    } catch {
      setPhotoError('Upload failed — check your connection')
    } finally {
      setUploadingPhoto(false)
      event.target.value = ''
    }
  }

  async function handlePhotoRemove() {
    setPhotoError(null)
    setRemovingPhoto(true)
    try {
      const response = await authedFetch('/api/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_title: form.job_title,
          profile_photo_url: '',
          email_signature: form.email_signature,
        }),
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) {
        setPhotoError(typeof json.error === 'string' ? json.error : 'Failed to remove photo')
        return
      }
      setForm(current => ({ ...current, profile_photo_url: '' }))
      await refreshStaff()
      await loadWorkspace(requestedStaffId)
    } catch {
      setPhotoError('Failed to remove photo')
    } finally {
      setRemovingPhoto(false)
    }
  }

  if (loading) {
    return (
      <div className="workspace-shell">
        <div className="workspace-loading">Loading your workspace…</div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="workspace-shell">
        <div className="card" style={{ padding: '28px 30px', maxWidth: '560px' }}>
          <div className="page-eyebrow">Workspace</div>
          <div className="page-title" style={{ marginBottom: '10px' }}>Your workspace is unavailable</div>
          <div style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.7 }}>
            {error || 'We could not load your personal workspace right now.'}
          </div>
        </div>
      </div>
    )
  }

  const monthlyBonus = data.monthlyBonusTier
  const nextBonusTier = monthlyBonus
    ? data.monthly.recognisedProfit < monthlyBonus.bronze
      ? { label: 'Bronze', target: monthlyBonus.bronze, bonus: monthlyBonus.bonusBronze }
      : data.monthly.recognisedProfit < monthlyBonus.silver
        ? { label: 'Silver', target: monthlyBonus.silver, bonus: monthlyBonus.bonusSilver }
        : data.monthly.recognisedProfit < monthlyBonus.gold
          ? { label: 'Gold', target: monthlyBonus.gold, bonus: monthlyBonus.bonusGold }
          : null
    : null

  const personalLine = isOwnWorkspace
    ? 'Your personal board for live performance, commission progress, and active travel work.'
    : `Manager view of ${data.profile.name}'s live workspace, current performance, and active ownership items.`

  return (
    <div className="workspace-shell">
      {!isOwnWorkspace ? (
        <div className="workspace-viewing-banner">
          <div className="workspace-viewing-banner-label">Viewing Staff Workspace</div>
          <div className="workspace-viewing-banner-copy">
            You are viewing <strong>{data.profile.name}</strong> as a manager. Profile editing stays self-service.
          </div>
        </div>
      ) : null}

      <div className="workspace-hero card">
        <div className="workspace-hero-main">
          <div className="workspace-avatar">
            {data.profile.profile_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.profile.profile_photo_url} alt={data.profile.name} className="workspace-avatar-image" />
            ) : (
              <span>{initials(data.profile.name)}</span>
            )}
          </div>
          <div>
            <div className="page-eyebrow">{isOwnWorkspace ? 'My Workspace' : 'Staff Workspace'}</div>
            <h2 className="workspace-title">{data.profile.name}</h2>
            <div className="workspace-subtitle">{roleLabel}</div>
            {data.profile.email && <div className="workspace-contact">{data.profile.email}</div>}
            <div className="workspace-personal-line">{personalLine}</div>
          </div>
        </div>

        <div className="workspace-hero-kpis">
          <div className="workspace-kpi-stat">
            <div className="workspace-kpi-label">Recognised profit</div>
            <div className="workspace-kpi-value" style={{ color: 'var(--green)' }}>{money(data.monthly.recognisedProfit)}</div>
          </div>
          <div className="workspace-kpi-stat">
            <div className="workspace-kpi-label">Commission this month</div>
            <div className="workspace-kpi-value" style={{ color: 'var(--gold)' }}>{moneyPrecise(data.monthly.commission)}</div>
          </div>
          {data.yearToDate.targetProgress.recognisedProfitTarget && (
            <div className="workspace-kpi-stat">
              <div className="workspace-kpi-label">Year target</div>
              <div className="workspace-kpi-value">{data.yearToDate.targetProgress.recognisedProfitProgressPct || 0}%</div>
            </div>
          )}
          {!isOwnWorkspace && <div className="workspace-chip workspace-chip-manager">Manager view active</div>}
        </div>

        <div className="workspace-hero-actions">
          {isOwnWorkspace && <a className="btn btn-secondary btn-sm" href="#workspace-profile-editor">Edit profile</a>}
          <Link className="btn btn-secondary btn-sm" href="/bookings">Bookings</Link>
          <Link className="btn btn-secondary btn-sm" href="/pipeline">Pipeline</Link>
        </div>
      </div>

      <section className="workspace-band">
        <div className="workspace-band-header">
          <div>
            <div className="page-eyebrow">Performance</div>
            <h2 className="workspace-section-title">This month &amp; year to date</h2>
          </div>
        </div>

        <div className="workspace-grid">
          <section className="workspace-panel card">
            <div className="workspace-section-header">
              <div>
                <div className="page-eyebrow">Monthly</div>
                <h2 className="workspace-section-title">This month</h2>
              </div>
            </div>
            <div className="workspace-stats-grid">
              <MiniStat label="Quotes sent" value={String(data.monthly.quotesSent)} />
              <MiniStat label="Bookings confirmed" value={String(data.monthly.bookingsConverted)} />
              <div className="workspace-mini-stat" style={{ gridColumn: '1 / -1', background: 'var(--green-light)', borderColor: 'var(--green)' }}>
                <div className="workspace-mini-label">Recognised profit</div>
                <div className="workspace-mini-value" style={{ color: 'var(--green)' }}>{money(data.monthly.recognisedProfit)}</div>
                <div className="workspace-mini-hint">From commissionable events this month</div>
              </div>
              <div className="workspace-bonus-card" style={{ gridColumn: '1 / -1' }}>
                <div className="workspace-mini-label">Bonus tier</div>
                <div className="workspace-bonus-value" style={{ color: 'var(--gold)' }}>
                  {monthlyBonus ? money(data.monthly.recognisedProfit) : '—'}
                </div>
                {monthlyBonus ? (
                  <>
                    <div className="workspace-tier-track">
                      <div className="workspace-tier-step bronze" style={{ width: `${(monthlyBonus.bronze / Math.max(monthlyBonus.gold, 1)) * 100}%` }} />
                      <div className="workspace-tier-step silver" style={{ left: `${(monthlyBonus.bronze / Math.max(monthlyBonus.gold, 1)) * 100}%`, width: `${((monthlyBonus.silver - monthlyBonus.bronze) / Math.max(monthlyBonus.gold, 1)) * 100}%` }} />
                      <div className="workspace-tier-fill" style={{ width: progressWidth(data.monthly.recognisedProfit, monthlyBonus.gold) }} />
                    </div>
                    <div className="workspace-tier-labels">
                      <span>🥉 {money(monthlyBonus.bronze)}</span>
                      <span>🥈 {money(monthlyBonus.silver)}</span>
                      <span>🥇 {money(monthlyBonus.gold)}</span>
                    </div>
                    <div className="workspace-mini-hint">
                      {nextBonusTier
                        ? `${money(nextBonusTier.target - data.monthly.recognisedProfit)} more to ${nextBonusTier.label} — +${money(nextBonusTier.bonus)} bonus`
                        : `Gold tier reached — +${money(monthlyBonus.bonusGold)} bonus unlocked`}
                    </div>
                  </>
                ) : (
                  <div className="workspace-mini-hint">No target configured for this month.</div>
                )}
              </div>
            </div>
          </section>

          <section className="workspace-panel card">
            <div className="workspace-section-header">
              <div>
                <div className="page-eyebrow">Year to date</div>
                <h2 className="workspace-section-title">Year progress</h2>
              </div>
            </div>
            <div className="workspace-stats-grid workspace-stats-grid-compact">
              <MiniStat label="Revenue YTD" value={money(data.yearToDate.revenue)} hint="Confirmed bookings" />
              <MiniStat label="Profit YTD" value={money(data.yearToDate.recognisedProfit)} hint="Recognised commissionable profit" />
              <MiniStat label="Commission YTD" value={moneyPrecise(data.yearToDate.commission)} />
              <div className="workspace-target-card" style={{ gridColumn: '1 / -1' }}>
                <div className="workspace-mini-label">Yearly targets</div>
                <div className="workspace-target-line" style={{ marginTop: '10px' }}>
                  <span>Revenue</span>
                  <strong>
                    {data.yearToDate.targetProgress.revenueTarget
                      ? `${data.yearToDate.targetProgress.revenueProgressPct || 0}% of ${money(data.yearToDate.targetProgress.revenueTarget)}`
                      : 'Not configured'}
                  </strong>
                </div>
                <div className="workspace-progress">
                  <div style={{ width: `${data.yearToDate.targetProgress.revenueProgressPct || 0}%` }} />
                </div>
                <div className="workspace-target-line" style={{ marginTop: '10px' }}>
                  <span>Recognised profit</span>
                  <strong>
                    {data.yearToDate.targetProgress.recognisedProfitTarget
                      ? `${data.yearToDate.targetProgress.recognisedProfitProgressPct || 0}% of ${money(data.yearToDate.targetProgress.recognisedProfitTarget)}`
                      : 'Not configured'}
                  </strong>
                </div>
                <div className="workspace-progress workspace-progress-profit">
                  <div style={{ width: `${data.yearToDate.targetProgress.recognisedProfitProgressPct || 0}%` }} />
                </div>
              </div>
            </div>
          </section>

          <section className="workspace-panel card">
            <div className="workspace-section-header">
              <div>
                <div className="page-eyebrow">Pipeline &amp; Workload</div>
                <h2 className="workspace-section-title">What&apos;s live</h2>
              </div>
            </div>
            <div className="workspace-stats-grid workspace-stats-grid-compact">
              <MiniStat label="Pipeline value" value={money(data.potential.pipelineValue)} hint="Not yet earned" />
              <MiniStat label="Expected profit" value={money(data.potential.expectedProfit)} hint="From open quotes" />
              <MiniStat label="Active deals" value={String(data.workload.activeDeals)} />
              <MiniStat label="Confirmed bookings" value={String(data.workload.confirmedBookings)} />
              <MiniStat label="Shared bookings" value={String(data.workload.sharedBookings)} />
              <MiniStat label="Pending share items" value={String(data.workload.pendingShareItems)} />
            </div>
          </section>

          <section className="workspace-panel card" id="workspace-profile-editor">
            <div className="workspace-section-header">
              <div>
                <div className="page-eyebrow">Profile</div>
                <h2 className="workspace-section-title">{isOwnWorkspace ? 'Your profile' : 'Profile'}</h2>
              </div>
            </div>
            <div className="workspace-profile-card">
              <div className="workspace-profile-card-head">
                <div className="workspace-profile-card-avatar">
                  {form.profile_photo_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={form.profile_photo_url} alt={data.profile.name} className="workspace-avatar-image" />
                  ) : (
                    <span>{initials(data.profile.name)}</span>
                  )}
                </div>
                <div>
                  <div className="workspace-profile-card-name">{data.profile.name}</div>
                  <div className="workspace-profile-card-role">{form.job_title || roleLabel}</div>
                  <div className="workspace-profile-card-copy">
                    {isOwnWorkspace ? 'Keep your workspace identity polished for quotes, handovers, and internal visibility.' : 'Manager preview of the staff profile block.'}
                  </div>
                </div>
              </div>
              <div className="workspace-signature-preview workspace-signature-preview-inline">
                <div className="workspace-mini-label">Signature preview</div>
                <div className="workspace-signature-body">
                  {(form.email_signature || '').trim() || 'No email signature added yet.'}
                </div>
              </div>
            </div>
            <div className="workspace-form-grid">
              <div>
                <label className="label">Job title</label>
                <input
                  className="input"
                  value={form.job_title}
                  onChange={event => setForm(current => ({ ...current, job_title: event.target.value }))}
                  placeholder="Senior Travel Consultant"
                  disabled={!isOwnWorkspace}
                />
              </div>
              <div>
                <label className="label">Profile photo</label>
                {isOwnWorkspace ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                    <div className="workspace-profile-card-avatar" style={{ width: '52px', height: '52px' }}>
                      {form.profile_photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={form.profile_photo_url} alt={data.profile.name} className="workspace-avatar-image" />
                      ) : (
                        <span>{initials(data.profile.name)}</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <label
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px',
                          padding: '0 14px', height: '36px', borderRadius: '8px',
                          border: '1px solid var(--border)', background: 'var(--surface)',
                          fontSize: '13px', cursor: uploadingPhoto ? 'not-allowed' : 'pointer',
                          color: 'var(--text)', whiteSpace: 'nowrap',
                          opacity: uploadingPhoto ? 0.6 : 1,
                        }}
                      >
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          style={{ display: 'none' }}
                          onChange={handlePhotoUpload}
                          disabled={uploadingPhoto}
                        />
                        {uploadingPhoto ? 'Uploading…' : form.profile_photo_url ? 'Replace photo' : 'Upload photo'}
                      </label>
                      {form.profile_photo_url && (
                        <button
                          className="btn btn-ghost btn-xs"
                          style={{ color: 'var(--text-muted)', fontSize: '12px' }}
                          onClick={() => void handlePhotoRemove()}
                          type="button"
                          disabled={removingPhoto || uploadingPhoto}
                        >
                          {removingPhoto ? 'Removing…' : 'Remove'}
                        </button>
                      )}
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        JPG, PNG or WebP up to 2 MB
                      </div>
                    </div>
                    {photoError && (
                      <span style={{ fontSize: '12px', color: 'var(--red)' }}>{photoError}</span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                    {form.profile_photo_url ? 'Photo set' : 'No photo'}
                  </div>
                )}
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label className="label">Email signature</label>
                <textarea
                  className="input"
                  value={form.email_signature}
                  onChange={event => setForm(current => ({ ...current, email_signature: event.target.value }))}
                  placeholder="Kind regards,&#10;Mauritius Holidays Direct"
                  style={{ minHeight: '100px' }}
                  disabled={!isOwnWorkspace}
                />
              </div>
            </div>
            <div className="workspace-form-actions">
              {error ? <div className="workspace-form-message error">{error}</div> : null}
              {message ? <div className="workspace-form-message success">{message}</div> : null}
              {isOwnWorkspace ? (
                <button className="btn btn-cta" onClick={() => void handleSaveProfile()} disabled={saving}>
                  {saving ? 'Saving…' : 'Save profile'}
                </button>
              ) : (
                <div className="workspace-mini-hint">Profile is self-service — staff members can edit their own.</div>
              )}
            </div>
          </section>
        </div>
      </section>

      <section className="workspace-band">
        <div className="workspace-band-header">
          <div>
            <div className="page-eyebrow">Workboard</div>
            <h2 className="workspace-section-title">Deals, bookings &amp; shared ownership</h2>
          </div>
        </div>

        <div className="workspace-list-grid">
          <section className="workspace-list-panel card">
            <div className="workspace-section-header">
              <div>
                <div className="page-eyebrow">Deals</div>
                <h2 className="workspace-section-title">Active pipeline</h2>
              </div>
              <Link href="/pipeline" className="workspace-link">View all →</Link>
            </div>
            <div className="workspace-list-meta">{data.lists.myDeals.total} active deal{data.lists.myDeals.total === 1 ? '' : 's'}</div>
            <div className="workspace-list">
              {data.lists.myDeals.items.length === 0 ? (
                <div className="workspace-empty">No active deals right now.</div>
              ) : data.lists.myDeals.items.map(deal => (
                <Link key={deal.id} href={`/deals/${deal.id}`} style={{ textDecoration: 'none' }}>
                  <div className="workspace-row">
                    <div>
                      <div className="workspace-row-title">{deal.title || clientName(deal.clients)}</div>
                      <div className="workspace-row-meta">{clientName(deal.clients)} · {deal.stage}</div>
                    </div>
                    <div className="workspace-row-side">
                      <strong>{money(deal.deal_value || 0)}</strong>
                      <span>{formatDate(deal.next_activity_at || deal.created_at)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="workspace-list-panel card">
            <div className="workspace-section-header">
              <div>
                <div className="page-eyebrow">Bookings</div>
                <h2 className="workspace-section-title">Confirmed &amp; active</h2>
              </div>
              <Link href="/bookings" className="workspace-link">View all →</Link>
            </div>
            <div className="workspace-list-meta">{data.lists.myBookings.total} active booking{data.lists.myBookings.total === 1 ? '' : 's'}</div>
            <div className="workspace-list">
              {data.lists.myBookings.items.length === 0 ? (
                <div className="workspace-empty">No active bookings assigned.</div>
              ) : data.lists.myBookings.items.map(booking => (
                <Link key={booking.id} href={`/bookings/${booking.id}`} style={{ textDecoration: 'none' }}>
                  <div className="workspace-row">
                    <div>
                      <div className="workspace-row-title">{booking.booking_reference}</div>
                      <div className="workspace-row-meta">{booking.deals?.title || clientName(booking.deals?.clients)}</div>
                    </div>
                    <div className="workspace-row-side">
                      <strong>{money(booking.total_sell || 0)}</strong>
                      <span>{formatDate(booking.departure_date || booking.created_at)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>

          <section className="workspace-list-panel card">
            <div className="workspace-section-header">
              <div>
                <div className="page-eyebrow">Shared ownership</div>
                <h2 className="workspace-section-title">Shared bookings</h2>
              </div>
              <Link href="/bookings" className="workspace-link">View all →</Link>
            </div>
            <div className="workspace-list-meta">{data.lists.sharedBookings.total} shared booking{data.lists.sharedBookings.total === 1 ? '' : 's'}</div>
            <div className="workspace-list">
              {data.lists.sharedBookings.items.length === 0 ? (
                <div className="workspace-empty">No shared bookings live right now.</div>
              ) : data.lists.sharedBookings.items.map(row => (
                <div key={`${row.booking_id}-${row.share_percent}`} className="workspace-row">
                  <div>
                    <div className="workspace-row-title">{row.bookings?.booking_reference || `Booking ${row.booking_id}`}</div>
                    <div className="workspace-row-meta">{row.bookings?.deals?.title || clientName(row.bookings?.deals?.clients)}</div>
                  </div>
                  <div className="workspace-row-side">
                    <strong>{Number(row.share_percent).toFixed(0)}%</strong>
                    <span>{row.is_primary ? 'Primary owner' : 'Shared owner'}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="workspace-list-panel card">
            <div className="workspace-section-header">
              <div>
                <div className="page-eyebrow">Pending</div>
                <h2 className="workspace-section-title">Actions waiting</h2>
              </div>
              <Link href="/today" className="workspace-link">Today →</Link>
            </div>
            <div className="workspace-list-meta">{data.lists.pendingShareItems.total} pending item{data.lists.pendingShareItems.total === 1 ? '' : 's'}</div>
            <div className="workspace-list">
              {data.lists.pendingShareItems.items.length === 0 ? (
                <div className="workspace-empty">No pending ownership items.</div>
              ) : data.lists.pendingShareItems.items.map(item => (
                <div key={item.id} className="workspace-row">
                  <div>
                    <div className="workspace-row-title">{item.bookings?.booking_reference || `Booking ${item.booking_id}`}</div>
                    <div className="workspace-row-meta">{item.reason || 'Ownership request'}</div>
                  </div>
                  <div className="workspace-row-side">
                    <strong>{item.claimant?.name || 'Pending'}</strong>
                    <span>{formatDate(item.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}
