'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { StaffUser } from '@/lib/access'

type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  toggleTheme: () => void
}>({
  theme: 'light',
  toggleTheme: () => {},
})

const AuthContext = createContext<{
  session: Session | null
  user: User | null
  staffUser: StaffUser | null
  loadingAuth: boolean
  refreshStaff: () => Promise<void>
  signOut: () => Promise<void>
}>({
  session: null,
  user: null,
  staffUser: null,
  loadingAuth: true,
  refreshStaff: async () => {},
  signOut: async () => {},
})

export function useTheme() {
  return useContext(ThemeContext)
}

export function useAuth() {
  return useContext(AuthContext)
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    return (localStorage.getItem('mhd-theme') as Theme) || 'light'
  })
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [staffUser, setStaffUser] = useState<StaffUser | null>(null)
  const [loadingAuth, setLoadingAuth] = useState(true)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  async function signOut() {
    // Explicitly clear all auth state before Supabase signOut so the UI
    // immediately exits the authenticated shell — no dependency on onAuthStateChange.
    setLoadingAuth(false)
    setSession(null)
    setUser(null)
    setStaffUser(null)
    try {
      await supabase.auth.signOut()
    } catch (err) {
      console.error('[auth] signOut error:', err)
    }
  }

  const refreshStaff = useCallback(async function refreshStaff(authUser?: User | null) {
    const activeUser = authUser ?? user
    if (!activeUser) {
      setStaffUser(null)
      return
    }
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      setStaffUser(null)
      return
    }

    const res = await fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })

    if (!res.ok) {
      setStaffUser(null)
      return
    }

    const json = await res.json()
    setStaffUser((json.staffUser || null) as StaffUser | null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  useEffect(() => {
    let active = true

    // Safety net: if neither init() nor onAuthStateChange resolves within 10s,
    // force loadingAuth to false so the app never hangs on the loading gate.
    const safetyTimer = setTimeout(() => {
      if (active) {
        console.warn('[auth] init timed out — forcing loader to resolve')
        setLoadingAuth(false)
      }
    }, 10_000)

    async function init() {
      try {
        const { data } = await supabase.auth.getSession()
        if (!active) return
        setSession(data.session)
        setUser(data.session?.user ?? null)
        if (data.session?.user) {
          await refreshStaff(data.session.user)
        }
      } catch (err) {
        console.error('[auth] init failed:', err)
      } finally {
        if (active) {
          clearTimeout(safetyTimer)
          setLoadingAuth(false)
        }
      }
    }

    void init()

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      try {
        setSession(nextSession)
        setUser(nextSession?.user ?? null)
        if (nextSession?.user) await refreshStaff(nextSession.user)
        else setStaffUser(null)
      } catch (err) {
        console.error('[auth] onAuthStateChange failed:', err)
      } finally {
        if (active) {
          clearTimeout(safetyTimer)
          setLoadingAuth(false)
        }
      }
    })

    return () => {
      active = false
      clearTimeout(safetyTimer)
      listener.subscription.unsubscribe()
    }
  }, [])

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    localStorage.setItem('mhd-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <AuthContext.Provider value={{ session, user, staffUser, loadingAuth, refreshStaff, signOut }}>
        {children}
      </AuthContext.Provider>
    </ThemeContext.Provider>
  )
}
