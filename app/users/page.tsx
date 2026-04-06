'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../providers'
import { isManager, type StaffUser } from '@/lib/access'

type StaffRecord = StaffUser & {
  email?: string | null
  mfa_required?: boolean | null
  mfa_enrolled_at?: string | null
}

export default function UsersPage() {
  const { session, staffUser, refreshStaff } = useAuth()
  const [staff, setStaff] = useState<StaffRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadingMfa, setLoadingMfa] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'sales', mfaRequired: true })

  const [enrollData, setEnrollData] = useState<{ factorId: string; qrCode: string; secret: string; existing: boolean } | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const managerMode = isManager(staffUser)

  async function loadStaff() {
    setLoading(true)
    const { data } = await supabase
      .from('staff_users')
      .select('id,name,role,is_active,email,mfa_required,mfa_enrolled_at')
      .order('name')
    setStaff((data || []) as StaffRecord[])
    setLoading(false)
  }

  async function createUser() {
    if (!session?.access_token) return
    setSaving(true)
    setMessage(null)
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) {
      setMessage(json.error || 'Failed to create user')
      return
    }
    setForm({ name: '', email: '', password: '', role: 'sales', mfaRequired: true })
    setMessage('User created ✓')
    void loadStaff()
  }

  async function detectExistingTotp() {
    setLoadingMfa(true)
    const { data: factorsData, error } = await supabase.auth.mfa.listFactors()
    setLoadingMfa(false)
    if (error) return

    // Check for any existing factor with friendly name 'Authenticator'
    const allFactors = [...(factorsData?.totp || []), ...(factorsData?.phone || [])]
    const existingAuthenticator = allFactors.find(f => f.friendly_name === 'Authenticator')
    if (!existingAuthenticator) return

    setEnrollData({
      factorId: existingAuthenticator.id,
      qrCode: '',
      secret: '',
      existing: true,
    })
  }

  async function startTotpEnrollment() {
    setMessage(null)
    setLoadingMfa(true)
    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
    setLoadingMfa(false)
    if (factorsError) {
      setMessage(factorsError.message)
      return
    }

    // Check for any existing factor with friendly name 'Authenticator'
    const allFactors = [...(factorsData?.totp || []), ...(factorsData?.phone || [])]
    const existingAuthenticator = allFactors.find(f => f.friendly_name === 'Authenticator')
    if (existingAuthenticator) {
      setEnrollData({
        factorId: existingAuthenticator.id,
        qrCode: '',
        secret: '',
        existing: true,
      })
      setMessage('Existing authenticator found. Enter the current 6-digit code to finish linking it.')
      return
    }

    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator' })
    if (error) {
      setMessage(error.message)
      return
    }
    setEnrollData({
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      existing: false,
    })
  }

  async function resetTotpEnrollment() {
    setMessage(null)
    setLoadingMfa(true)
    const { data: factorsData, error: factorsError } = await supabase.auth.mfa.listFactors()
    if (factorsError) {
      setLoadingMfa(false)
      setMessage(factorsError.message)
      return
    }

    // Find the factor with friendly name 'Authenticator'
    const allFactors = [...(factorsData?.totp || []), ...(factorsData?.phone || [])]
    const existingAuthenticator = allFactors.find(f => f.friendly_name === 'Authenticator')
    if (existingAuthenticator) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: existingAuthenticator.id })
      if (error) {
        setLoadingMfa(false)
        setMessage(error.message)
        return
      }
    }

    setEnrollData(null)
    setLoadingMfa(false)
    await startTotpEnrollment()
  }

  async function verifyTotpEnrollment() {
    if (!session?.access_token || !enrollData || !verifyCode) return
    setMessage(null)
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({ factorId: enrollData.factorId })
    if (challengeError) {
      setMessage(challengeError.message)
      return
    }
    const { error } = await supabase.auth.mfa.verify({
      factorId: enrollData.factorId,
      challengeId: challengeData.id,
      code: verifyCode,
    })
    if (error) {
      setMessage(error.message)
      return
    }
    await fetch('/api/auth/mfa/complete', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    await refreshStaff()
    setEnrollData(null)
    setVerifyCode('')
    setMessage('Authenticator linked ✓')
    void loadStaff()
  }

  const qrSrc = useMemo(() => {
    if (!enrollData?.qrCode) return null
    // enrollData.qrCode is the otpauth:// URI, generate QR image from it
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(enrollData.qrCode)}`
  }, [enrollData?.qrCode])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadStaff()
      void refreshStaff()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [refreshStaff])

  useEffect(() => {
    if (!session?.user || staffUser?.mfa_enrolled_at) return
    const timer = window.setTimeout(() => {
      void detectExistingTotp()
    }, 0)
    return () => window.clearTimeout(timer)
  }, [session?.user, staffUser?.mfa_enrolled_at])

  return (
    <div>
      <div className="page-header">
        <div>
          <div className="page-title">User Access</div>
          <div style={{ fontSize:'12.5px', color:'var(--text-muted)', marginTop:'2px' }}>
            Manager-controlled user creation with password access and authenticator support
          </div>
        </div>
      </div>

      <div className="page-body" style={{ display:'flex', flexDirection:'column', gap:'20px' }}>
        {message && <div className="card" style={{ padding:'12px 16px', fontSize:'12.5px' }}>{message}</div>}

        <div className="card" style={{ padding:'20px 24px' }}>
          <div style={{ fontFamily:'Fraunces,serif', fontSize:'18px', fontWeight:'300', marginBottom:'10px' }}>My Security</div>
          <div style={{ fontSize:'12.5px', color:'var(--text-muted)', marginBottom:'14px' }}>
            Use an authenticator app rather than SMS or a basic PIN. This is the cleanest second factor for your managers and staff.
          </div>

          {staffUser?.mfa_enrolled_at ? (
            <div style={{ fontSize:'13px', color:'var(--green)' }}>Authenticator active since {new Date(staffUser.mfa_enrolled_at).toLocaleDateString('en-GB')}</div>
          ) : loadingMfa ? (
            <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>Checking authenticator status…</div>
          ) : enrollData ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px', maxWidth:'420px' }}>
              {qrSrc && <Image src={qrSrc} alt="Authenticator QR" width={220} height={220} style={{ border:'1px solid var(--border)', borderRadius:'12px', background:'white', padding:'10px' }} unoptimized />}
              {enrollData.existing && (
                <div style={{ background:'#fff7ed', border:'1px solid #fdba74', borderRadius:'10px', padding:'12px 14px', fontSize:'12.5px', color:'#9a3412', lineHeight:1.6 }}>
                  This account already has an authenticator linked, so Supabase will not issue a new QR code.
                  Enter the current 6-digit code from that app, or reset the authenticator and generate a fresh QR.
                </div>
              )}
              {enrollData.secret && <div style={{ fontSize:'12px', color:'var(--text-muted)' }}>If scanning fails, use secret: <code>{enrollData.secret}</code></div>}
              <input className="input" placeholder="6-digit authenticator code" value={verifyCode} onChange={e => setVerifyCode(e.target.value)} />
              <div style={{ display:'flex', gap:'8px' }}>
                <button className="btn btn-cta" onClick={verifyTotpEnrollment}>Verify Authenticator</button>
                {enrollData.existing && <button className="btn btn-secondary" onClick={resetTotpEnrollment} disabled={loadingMfa}>{loadingMfa ? 'Resetting…' : 'Reset Authenticator'}</button>}
              </div>
            </div>
          ) : (
            <button className="btn btn-cta" onClick={startTotpEnrollment} disabled={loadingMfa}>{loadingMfa ? 'Checking…' : 'Set Up Authenticator'}</button>
          )}
        </div>

        <div className="card" style={{ padding:'20px 24px' }}>
          <div style={{ fontFamily:'Fraunces,serif', fontSize:'18px', fontWeight:'300', marginBottom:'14px' }}>Team Directory</div>
          {loading ? (
            <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>Loading users…</div>
          ) : (
            <div style={{ display:'grid', gap:'10px' }}>
              {staff.map(member => (
                <div key={member.id} style={{ border:'1px solid var(--border)', borderRadius:'12px', padding:'14px 16px', display:'flex', justifyContent:'space-between', gap:'12px' }}>
                  <div>
                    <div style={{ fontSize:'13px', fontWeight:'600' }}>{member.name}</div>
                    <div style={{ fontSize:'11.5px', color:'var(--text-muted)', marginTop:'2px' }}>{member.email || 'No email linked'} · {member.role || 'staff'}</div>
                  </div>
                  <div style={{ textAlign:'right', fontSize:'11.5px', color:'var(--text-muted)' }}>
                    <div>{member.mfa_required ? 'MFA required' : 'MFA optional'}</div>
                    <div>{member.mfa_enrolled_at ? 'Enrolled' : 'Not enrolled'}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card" style={{ padding:'20px 24px', opacity: managerMode ? 1 : 0.6 }}>
          <div style={{ fontFamily:'Fraunces,serif', fontSize:'18px', fontWeight:'300', marginBottom:'14px' }}>Create User</div>
          {!staffUser && (
            <div style={{ fontSize:'12.5px', color:'var(--amber)', marginBottom:'10px' }}>
              Your staff profile is still syncing. If this stays here, refresh the page once and it should pick up your manager record.
            </div>
          )}
          {!managerMode ? (
            <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>Only managers can create users.</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'12px' }}>
              <input className="input" placeholder="Full name" value={form.name} onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))} />
              <input className="input" type="email" placeholder="Email" value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} />
              <input className="input" type="password" placeholder="Temporary password" value={form.password} onChange={e => setForm(prev => ({ ...prev, password: e.target.value }))} />
              <select className="input" value={form.role} onChange={e => setForm(prev => ({ ...prev, role: e.target.value }))}>
                <option value="sales">Sales</option>
                <option value="operations">Operations</option>
                <option value="manager">Manager</option>
              </select>
              <label style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'13px' }}>
                <input type="checkbox" checked={form.mfaRequired} onChange={e => setForm(prev => ({ ...prev, mfaRequired: e.target.checked }))} />
                Require authenticator setup
              </label>
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button className="btn btn-cta" onClick={createUser} disabled={saving || !form.name || !form.email || !form.password}>
                  {saving ? 'Creating…' : 'Create User'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
