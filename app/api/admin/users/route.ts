import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

async function requireManager(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return { error: 'Missing token', status: 401 as const }

  const supabase = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData.user) return { error: 'Invalid session', status: 401 as const }

  let { data: staffUser } = await supabaseAdmin
    .from('staff_users')
    .select('id,role,auth_user_id,email')
    .eq('auth_user_id', userData.user.id)
    .maybeSingle()

  if (!staffUser && userData.user.email) {
    const email = userData.user.email.toLowerCase()
    const { data: emailMatch } = await supabaseAdmin
      .from('staff_users')
      .select('id,role,auth_user_id,email')
      .eq('email', email)
      .maybeSingle()

    if (emailMatch) {
      if (!emailMatch.auth_user_id) {
        const { data: linked } = await supabaseAdmin
          .from('staff_users')
          .update({ auth_user_id: userData.user.id })
          .eq('id', emailMatch.id)
          .select('id,role,auth_user_id,email')
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
      .select('id,role,auth_user_id,email')
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
        .select('id,role,auth_user_id,email')
        .single()
      staffUser = linked || manager || null
    }
  }

  if (!staffUser || staffUser.role !== 'manager') {
    return { error: 'Manager access required', status: 403 as const }
  }

  return { user: userData.user, staffUser }
}

export async function POST(request: Request) {
  const auth = await requireManager(request)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const role = String(body.role || 'sales')
  const mfaRequired = !!body.mfaRequired

  if (!name || !email || !password) {
    return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 })
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return NextResponse.json({ error: createError?.message || 'Failed to create auth user' }, { status: 400 })
  }

  const { error: insertError } = await supabaseAdmin.from('staff_users').insert({
    name,
    email,
    auth_user_id: created.user.id,
    role,
    is_active: true,
    mfa_required: mfaRequired,
  })

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true })
}
