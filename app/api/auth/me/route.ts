import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server auth setup is incomplete' }, { status: 500 })
  }

  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) {
    return NextResponse.json({ user: null, staffUser: null }, { status: 200 })
  }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) {
    return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
  }

  let { data: staffUser } = await supabaseAdmin
    .from('staff_users')
    .select('id,name,role,is_active,auth_user_id,email,mfa_required,mfa_enrolled_at')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (!staffUser && userData.user.email) {
    const email = userData.user.email.toLowerCase()
    const { data: emailMatch } = await supabaseAdmin
      .from('staff_users')
      .select('id,name,role,is_active,auth_user_id,email,mfa_required,mfa_enrolled_at')
      .eq('email', email)
      .maybeSingle()

    if (emailMatch) {
      if (!emailMatch.auth_user_id) {
        const { data: linked } = await supabaseAdmin
          .from('staff_users')
          .update({ auth_user_id: userData.user.id })
          .eq('id', emailMatch.id)
          .select('id,name,role,is_active,auth_user_id,email,mfa_required,mfa_enrolled_at')
          .single()
        staffUser = linked || emailMatch
      } else {
        staffUser = emailMatch
      }
    }
  }

  if (!staffUser) {
    const { data: unlinkedManagers } = await supabaseAdmin
      .from('staff_users')
      .select('id,name,role,is_active,auth_user_id,email,mfa_required,mfa_enrolled_at')
      .eq('role', 'manager')
      .is('auth_user_id', null)

    if ((unlinkedManagers || []).length === 1) {
      const manager = unlinkedManagers?.[0]
      const { data: linked } = await supabaseAdmin
        .from('staff_users')
        .update({
          auth_user_id: userData.user.id,
          email: userData.user.email?.toLowerCase() || manager?.email || null,
        })
        .eq('id', manager!.id)
        .select('id,name,role,is_active,auth_user_id,email,mfa_required,mfa_enrolled_at')
        .single()

      staffUser = linked || manager || null
    }
  }

  return NextResponse.json({
    user: {
      id: userData.user.id,
      email: userData.user.email,
    },
    staffUser: staffUser || null,
  })
}
