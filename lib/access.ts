import { createClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export type StaffRole = 'sales' | 'operations' | 'manager'

export type StaffUser = {
  id: number
  name: string
  role: StaffRole | string | null
  is_active: boolean | null
  auth_user_id?: string | null
  email?: string | null
  job_title?: string | null
  profile_photo_url?: string | null
  email_signature?: string | null
  mfa_required?: boolean | null
  mfa_enrolled_at?: string | null
}

// ── Auth result cache ─────────────────────────────────────────
// getAccessContext() makes 2 remote calls per invocation:
//   1. DB query to staff_users
//   2. HTTP call to Supabase Auth to validate the JWT
// Caching by token eliminates both on repeat calls within the same
// request burst (60s TTL, well within a typical JWT lifetime).
type CacheEntry = {
  result: { staffUsers: StaffUser[]; currentStaff: StaffUser | null }
  expiresAt: number
}
const _cache = new Map<string, CacheEntry>()
const CACHE_TTL_MS = 60_000

/**
 * Resolves the current user and returns the full active staff list.
 *
 * When called with an explicit token (server-side API routes):
 *   - Validates the JWT via a stateless Supabase client
 *   - Matches the resulting auth_user_id against staff_users
 *   - Returns null if the token is invalid or has no matching staff record
 *
 * When called without a token (client-side components):
 *   - Falls through to supabase.auth.getSession() on the browser singleton
 *   - Uses getSession() (not getUser()) to avoid AuthSessionMissingError on mount
 *   - Returns null server-side (no session available)
 *
 * MFA: if a matched user has mfa_required=true but mfa_enrolled_at=null,
 * they are treated as unauthenticated (currentStaff=null).
 */
export async function getAccessContext(token?: string | null) {
  // Cache hit: same token resolves to the same identity within 60 s
  if (token) {
    const hit = _cache.get(token)
    if (hit && hit.expiresAt > Date.now()) return hit.result
  }

  const { data } = await supabase
    .from('staff_users')
    .select('id,name,role,is_active,auth_user_id,email,job_title,profile_photo_url,email_signature,mfa_required,mfa_enrolled_at')
    .eq('is_active', true)
    .order('name')

  const staffUsers = (data || []) as StaffUser[]

  let authUserId: string | null = null

  if (token) {
    // Server-side path: validate the bearer token explicitly
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: userData } = await client.auth.getUser(token)
    authUserId = userData.user?.id ?? null
  } else {
    // Client-side path: the browser singleton has the session.
    // Use getSession() here — it never throws, unlike getUser() which raises
    // AuthSessionMissingError when the session hasn't initialised yet.
    const { data: sessionData } = await supabase.auth.getSession()
    authUserId = sessionData.session?.user?.id ?? null
  }

  const currentStaff = authUserId
    ? (staffUsers.find(u => u.auth_user_id === authUserId) ?? null)
    : null

  // Enforce MFA: required but not yet enrolled → deny identity
  if (currentStaff?.mfa_required && !currentStaff.mfa_enrolled_at) {
    const result = { staffUsers, currentStaff: null }
    if (token) _cache.set(token, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    return result
  }

  const result = { staffUsers, currentStaff }

  if (token) {
    _cache.set(token, { result, expiresAt: Date.now() + CACHE_TTL_MS })
    // Evict expired entries when the cache grows large
    if (_cache.size > 200) {
      const now = Date.now()
      for (const [k, v] of _cache) {
        if (v.expiresAt < now) _cache.delete(k)
      }
    }
  }

  return result
}

export function isManager(staff: StaffUser | null | undefined) {
  return staff?.role === 'manager'
}
