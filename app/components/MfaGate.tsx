'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '../providers'

export default function MfaGate() {
  const { staffUser } = useAuth()
  const [challengeId, setChallengeId] = useState<string | null>(null)
  const [factorId, setFactorId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [status, setStatus] = useState<'idle' | 'needed' | 'loading' | 'ready'>('idle')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!staffUser?.mfa_required || !staffUser?.mfa_enrolled_at) return

    void (async () => {
      setStatus('loading')
      const [{ data: aalData }, { data: factorData }] = await Promise.all([
        supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
        supabase.auth.mfa.listFactors(),
      ])

      if (aalData?.currentLevel === 'aal2') {
        setStatus('ready')
        return
      }

      const factor = factorData?.totp?.[0]
      if (!factor) {
        setStatus('ready')
        return
      }

      const { data: challengeData, error } = await supabase.auth.mfa.challenge({ factorId: factor.id })
      if (error) {
        setError(error.message)
        setStatus('needed')
        return
      }

      setFactorId(factor.id)
      setChallengeId(challengeData.id)
      setStatus('needed')
    })()
  }, [staffUser?.id, staffUser?.mfa_required, staffUser?.mfa_enrolled_at])

  async function verify() {
    if (!factorId || !challengeId || !code) return
    setError('')
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code })
    if (error) {
      setError(error.message)
      return
    }
    setStatus('ready')
  }

  if (!staffUser?.mfa_required || !staffUser?.mfa_enrolled_at) return null
  if (status === 'idle' || status === 'loading' || status === 'ready') return null

  return (
    <div style={{ margin:'18px 24px 0', background:'#eff6ff', border:'1px solid #93c5fd', borderRadius:'12px', padding:'16px 18px' }}>
      <div style={{ fontSize:'13px', fontWeight:'700', color:'#1d4ed8', marginBottom:'8px' }}>Two-Factor Verification Required</div>
      <div style={{ fontSize:'12.5px', color:'#1e3a8a', marginBottom:'12px' }}>Enter the current code from your authenticator app to finish signing in securely.</div>
      {error && <div style={{ fontSize:'12px', color:'#b91c1c', marginBottom:'10px' }}>{error}</div>}
      <div style={{ display:'flex', gap:'8px', alignItems:'center', maxWidth:'320px' }}>
        <input className="input" placeholder="6-digit code" value={code} onChange={e => setCode(e.target.value)} />
        <button className="btn btn-cta" onClick={verify}>Verify</button>
      </div>
    </div>
  )
}
