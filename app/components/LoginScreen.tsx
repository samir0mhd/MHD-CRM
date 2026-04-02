'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function LoginScreen() {
  const [mode, setMode] = useState<'login' | 'bootstrap'>('login')
  const [canBootstrap, setCanBootstrap] = useState(false)
  const [loadingBootstrap, setLoadingBootstrap] = useState(true)
  const [bootstrapMessage, setBootstrapMessage] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('Samir Abattouy')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/auth/bootstrap')
        const json = await res.json()
        setCanBootstrap(!!json.canBootstrap)
        setBootstrapMessage(json.message || '')
        if (json.canBootstrap) setMode('bootstrap')
      } catch {
        setCanBootstrap(false)
        setBootstrapMessage('Secure bootstrap is not ready yet. Standard sign-in is still available.')
      } finally {
        setLoadingBootstrap(false)
      }
    })()
  }, [])

  async function handleLogin() {
    setSaving(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSaving(false)
    if (error) setError(error.message)
  }

  async function handleBootstrap() {
    setSaving(true)
    setError('')
    const res = await fetch('/api/auth/bootstrap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    })
    const json = await res.json()
    if (!res.ok) {
      setError(json.error || 'Failed to create manager account')
      setSaving(false)
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setSaving(false)
    if (error) setError(error.message)
  }

  return (
    <div style={{ minHeight:'100vh', display:'grid', placeItems:'center', padding:'24px', background:'linear-gradient(145deg, #f4f1e8 0%, #eef4ef 45%, #e9f1fb 100%)' }}>
      <div className="card" style={{ width:'100%', maxWidth:'480px', padding:'32px 34px' }}>
        <div style={{ fontFamily:'Fraunces,serif', fontSize:'28px', fontWeight:'300', marginBottom:'8px' }}>MHD CRM Secure Access</div>
        <div style={{ fontSize:'13px', color:'var(--text-muted)', lineHeight:1.6, marginBottom:'22px' }}>
          Password-based access with authenticator-app security for protected roles.
        </div>

        {loadingBootstrap ? (
          <div style={{ fontSize:'13px', color:'var(--text-muted)' }}>Checking access setup…</div>
        ) : (
          <>
            {bootstrapMessage && (
              <div style={{ marginBottom:'14px', background:'#eff6ff', border:'1px solid #93c5fd', color:'#1d4ed8', borderRadius:'10px', padding:'10px 12px', fontSize:'12.5px' }}>
                {bootstrapMessage}
              </div>
            )}
            {canBootstrap && (
              <div style={{ display:'flex', gap:'6px', marginBottom:'18px' }}>
                <button className="btn btn-secondary" onClick={() => setMode('bootstrap')} style={{ flex:1, background: mode === 'bootstrap' ? 'var(--bg-secondary)' : undefined }}>First Manager</button>
                <button className="btn btn-secondary" onClick={() => setMode('login')} style={{ flex:1, background: mode === 'login' ? 'var(--bg-secondary)' : undefined }}>Sign In</button>
              </div>
            )}

            {error && <div style={{ marginBottom:'14px', background:'#fef2f2', border:'1px solid #fca5a5', color:'#b91c1c', borderRadius:'10px', padding:'10px 12px', fontSize:'12.5px' }}>{error}</div>}

            {mode === 'bootstrap' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                <input className="input" placeholder="Manager name" value={name} onChange={e => setName(e.target.value)} />
                <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                <button className="btn btn-cta" onClick={handleBootstrap} disabled={!name || !email || !password || saving}>
                  {saving ? 'Creating…' : 'Create First Manager'}
                </button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
                <input className="input" type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} />
                <input className="input" type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} />
                <button className="btn btn-cta" onClick={handleLogin} disabled={!email || !password || saving}>
                  {saving ? 'Signing in…' : 'Sign In'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
