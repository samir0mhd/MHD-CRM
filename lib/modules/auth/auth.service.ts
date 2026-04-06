import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import * as repo from './auth.repository'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export type AuthResult = {
  user: repo.AuthUser
  staffUser: repo.StaffUser | null
}

export type AuthError = {
  error: string
  status: 401 | 403 | 500
}

// ── AUTHENTICATION WORKFLOWS ──────────────────────────────────
export async function authenticateUser(token: string): Promise<AuthResult | AuthError> {
  if (!supabaseAdmin) {
    return { error: 'Server auth setup is incomplete', status: 500 }
  }

  if (!token) {
    // This shouldn't happen as the API layer should handle missing tokens
    return { error: 'No token provided', status: 401 }
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    return { error: 'Invalid session', status: 401 }
  }

  const staffUser = await findOrLinkStaffUser({
    id: userData.user.id,
    email: userData.user.email ?? '',
  })

  // Enforce MFA: if required but not yet enrolled, block access
  if (staffUser?.mfa_required && !staffUser.mfa_enrolled_at) {
    return { error: 'MFA setup required. Please configure an authenticator before continuing.', status: 403 }
  }

  return {
    user: {
      id: userData.user.id,
      email: userData.user.email!,
    },
    staffUser,
  }
}

export async function findOrLinkStaffUser(authUser: repo.AuthUser): Promise<repo.StaffUser | null> {
  // First try to find by auth_user_id
  let staffUser = await repo.getStaffUserByAuthId(authUser.id)

  if (!staffUser && authUser.email) {
    // Try to find by email
    const emailMatch = await repo.getStaffUserByEmail(authUser.email)

    if (emailMatch) {
      if (!emailMatch.auth_user_id) {
        // Link the existing staff user to this auth user
        await repo.linkStaffUserToAuth(emailMatch.id, authUser.id)
        staffUser = { ...emailMatch, auth_user_id: authUser.id }
      } else {
        // Email already linked to another auth user
        staffUser = emailMatch
      }
    }
  }

  return staffUser
}

export async function requireManager(token: string): Promise<{ user: repo.AuthUser; staffUser: repo.StaffUser } | AuthError> {
  const auth = await authenticateUser(token)
  if ('error' in auth) return auth

  if (!auth.staffUser || auth.staffUser.role !== 'manager') {
    return { error: 'Manager access required', status: 403 }
  }

  return { user: auth.user, staffUser: auth.staffUser }
}

// ── USER MANAGEMENT WORKFLOWS ────────────────────────────────
export async function createStaffUser(params: {
  name: string
  email: string
  password: string
  role: string
  mfaRequired: boolean
}): Promise<{ success: true } | { error: string; status: 400 }> {
  const { name, email, password, role, mfaRequired } = params

  if (!name || !email || !password) {
    return { error: 'Name, email and password are required', status: 400 }
  }

  if (!supabaseAdmin) {
    return { error: 'Server auth setup is incomplete', status: 400 }
  }

  // Create the auth user
  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return { error: createError?.message || 'Failed to create auth user', status: 400 }
  }

  // Create the staff user record
  const insertResult = await repo.createStaffUser({
    name,
    email: email.toLowerCase(),
    auth_user_id: created.user.id,
    role,
    is_active: true,
    mfa_required: mfaRequired,
  })

  if (insertResult.error) {
    return { error: insertResult.error.message, status: 400 }
  }

  return { success: true }
}