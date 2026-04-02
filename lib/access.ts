import { supabase } from './supabase'

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

export async function getAccessContext() {
  const { data } = await supabase
    .from('staff_users')
    .select('id,name,role,is_active,auth_user_id,email,mfa_required,mfa_enrolled_at')
    .eq('is_active', true)
    .order('name')

  const staffUsers = (data || []) as StaffUser[]
  const { data: userData } = await supabase.auth.getUser()
  const authUserId = userData.user?.id || null

  const currentStaff =
    (authUserId ? staffUsers.find(user => (user as StaffUser & { auth_user_id?: string | null }).auth_user_id === authUserId) : null) ||
    staffUsers.find(user => user.name === 'Samir Abattouy') ||
    staffUsers.find(user => user.role === 'manager') ||
    staffUsers[0] ||
    null

  return { staffUsers, currentStaff }
}

export function isManager(staff: StaffUser | null | undefined) {
  return staff?.role === 'manager'
}
