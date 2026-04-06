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
  mfa_required?: boolean | null
  mfa_enrolled_at?: string | null
}

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
  const { data } = await supabase
    .from('staff_users')
    .select('id,name,role,is_active,auth_user_id,email,mfa_required,mfa_enrolled_at')
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
    return { staffUsers, currentStaff: null }
  }

  return { staffUsers, currentStaff }
}

export function isManager(staff: StaffUser | null | undefined) {
  return staff?.role === 'manager'
}
