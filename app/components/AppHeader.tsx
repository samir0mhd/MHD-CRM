'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { authedFetch } from '@/lib/api-client'
import { isManager, type StaffUser } from '@/lib/access'
import { useAuth, useTheme } from '../providers'

type WorkspaceOption = {
  id: number
  name: string
  role: string | null
  job_title?: string | null
}

function initials(name: string) {
  return name
    .split(' ')
    .map(part => part[0] || '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
}

export default function AppHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { theme, toggleTheme } = useTheme()
  const { staffUser, signOut } = useAuth()
  const [workspaceOptions, setWorkspaceOptions] = useState<WorkspaceOption[]>([])
  const managerMode = isManager(staffUser)

  useEffect(() => {
    if (!staffUser || !managerMode) {
      return
    }

    let active = true

    authedFetch('/api/auth/me')
      .then(response => response.json().catch(() => ({})).then(json => ({ response, json })))
      .then(({ response, json }) => {
        if (!active) return
        if (!response.ok) {
          setWorkspaceOptions([])
          return
        }

        const options = Array.isArray(json.workspaceUsers) ? json.workspaceUsers as WorkspaceOption[] : []
        setWorkspaceOptions(options)
      })
      .catch(() => {
        if (!active) return
        setWorkspaceOptions([])
      })

    return () => {
      active = false
    }
  }, [managerMode, staffUser])

  const currentWorkspaceId = useMemo(() => {
    const raw = searchParams.get('staffId')
    const parsed = raw ? Number(raw) : NaN
    return Number.isFinite(parsed) ? parsed : staffUser?.id || 0
  }, [searchParams, staffUser?.id])

  const workspaceLabel = pathname === '/workspace'
    ? 'My Workspace'
    : pathname === '/'
      ? 'Dashboard'
      : pathname === '/today'
        ? 'Today'
        : pathname === '/pipeline'
          ? 'Pipeline'
          : pathname === '/bookings'
            ? 'Bookings'
            : pathname === '/reports'
              ? 'Reports'
              : pathname === '/clients'
                ? 'Clients'
                : null

  async function handleSignOut() {
    await signOut()
    router.replace('/')
  }

  function handleWorkspaceChange(nextStaffId: number) {
    if (!staffUser) return
    if (nextStaffId === staffUser.id) {
      router.push('/workspace')
      return
    }
    router.push(`/workspace?staffId=${nextStaffId}`)
  }

  const themeIcon = theme === 'dark' ? '☾' : '○'
  const currentRole = staffUser
    ? staffUser.role === 'manager' ? 'Manager'
      : staffUser.role === 'sales' ? 'Sales'
      : staffUser.role === 'operations' ? 'Operations'
      : '[role unknown]'
    : null

  return (
    <header className="app-header">
      <div className="app-header-left">
        {workspaceLabel && <div className="app-header-label">{workspaceLabel}</div>}
      </div>

      <div className="app-header-right">
        {managerMode && (
          <label className="header-workspace-control">
            <span className="header-control-label">Workspace</span>
            <select
              className="input header-select"
              value={currentWorkspaceId || ''}
              onChange={event => handleWorkspaceChange(Number(event.target.value))}
            >
              {(workspaceOptions.length > 0 ? workspaceOptions : [staffUser].filter(Boolean) as StaffUser[]).map(option => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {!managerMode && pathname !== '/workspace' && (
          <Link href="/workspace" className="btn btn-secondary btn-sm">My Workspace</Link>
        )}

        <button className="header-theme-btn" onClick={toggleTheme} aria-label="Toggle theme">
          <span>{themeIcon}</span>
        </button>

        <div className="header-identity-card">
          <div className="header-identity-avatar">
            {staffUser?.profile_photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={staffUser.profile_photo_url} alt={staffUser.name} className="header-identity-image" />
            ) : (
              <span>{initials(staffUser?.name || 'MHD')}</span>
            )}
          </div>
          <div className="header-identity-copy">
            <div className="header-identity-name">
              {staffUser?.name ?? '—'}{currentRole ? ` · ${currentRole}` : ''}
            </div>
          </div>
          <button className="btn btn-secondary btn-xs" onClick={() => void handleSignOut()}>
            Sign out
          </button>
        </div>
      </div>
    </header>
  )
}
