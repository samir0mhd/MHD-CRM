import { supabase } from '@/lib/supabase'
import { dbMutate } from '@/lib/api-client'

export type StaffUser = {
  id: number
  name: string
  role: string
  is_active: boolean
  auth_user_id: string | null
  email: string
  mfa_required: boolean
  mfa_enrolled_at: string | null
}

export type AuthUser = {
  id: string
  email: string
}

// ── STAFF USER QUERIES ─────────────────────────────────────────
export async function getStaffUserByAuthId(authUserId: string): Promise<StaffUser | null> {
  const { data } = await supabase
    .from('staff_users')
    .select('id,name,role,is_active,auth_user_id,email,mfa_required,mfa_enrolled_at')
    .eq('auth_user_id', authUserId)
    .maybeSingle()
  return data
}

export async function getStaffUserByEmail(email: string): Promise<StaffUser | null> {
  const { data } = await supabase
    .from('staff_users')
    .select('id,name,role,is_active,auth_user_id,email,mfa_required,mfa_enrolled_at')
    .eq('email', email.toLowerCase())
    .maybeSingle()
  return data
}

export async function getUnlinkedManagers(): Promise<StaffUser[]> {
  const { data } = await supabase
    .from('staff_users')
    .select('id,name,role,is_active,auth_user_id,email,mfa_required,mfa_enrolled_at')
    .eq('role', 'manager')
    .is('auth_user_id', null)
  return data || []
}

// ── STAFF USER MUTATIONS ──────────────────────────────────────
export async function linkStaffUserToAuth(staffUserId: number, authUserId: string, email?: string) {
  return dbMutate({
    table: 'staff_users',
    action: 'update',
    values: {
      auth_user_id: authUserId,
      ...(email && { email: email.toLowerCase() })
    },
    filters: [{ column: 'id', value: staffUserId }],
  })
}

export async function createStaffUser(staffUser: {
  name: string
  email: string
  auth_user_id: string
  role: string
  is_active: boolean
  mfa_required: boolean
}) {
  return dbMutate({
    table: 'staff_users',
    action: 'insert',
    values: staffUser,
  })
}