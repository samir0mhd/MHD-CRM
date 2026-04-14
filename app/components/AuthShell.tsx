'use client'

import { usePathname, useRouter } from 'next/navigation'
import Sidebar from './Sidebar'
import AppHeader from './AppHeader'
import { useAuth } from '../providers'
import LoginScreen from './LoginScreen'
import MfaGate from './MfaGate'

export default function AuthShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { session, loadingAuth, staffUser } = useAuth()

  if (loadingAuth) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'100vh', color:'var(--text-muted)', fontSize:'14px' }}>
        Loading secure workspace…
      </div>
    )
  }

  if (!session) {
    return <LoginScreen />
  }

  const mfaRequired = !!staffUser?.mfa_required
  const mfaEnrolled = !!staffUser?.mfa_enrolled_at
  const mustCompleteMfaSetup = mfaRequired && !mfaEnrolled
  const onUsersPage = pathname === '/users'

  if (mustCompleteMfaSetup && !onUsersPage) {
    return (
      <div className="main-layout">
        <Sidebar />
        <main className="main-content">
          <AppHeader />
          <div className="page-body">
            <div className="card" style={{ padding:'32px 36px', maxWidth:'620px' }}>
              <div style={{ fontFamily:'Fraunces,serif', fontSize:'24px', fontWeight:'300', marginBottom:'10px' }}>Secure Your Account</div>
              <div style={{ fontSize:'13px', color:'var(--text-muted)', lineHeight:1.6, marginBottom:'18px' }}>
                Your role requires an authenticator app before you can use the system fully. This protects payments, profit, cancellations and user management.
              </div>
              <button className="btn btn-cta" onClick={() => router.push('/users')}>Set Up Authenticator</button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="main-layout">
      <Sidebar />
      <main className="main-content">
        <AppHeader />
        <MfaGate />
        {children}
      </main>
    </div>
  )
}
