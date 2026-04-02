import { NextResponse } from 'next/server'
import { hasSupabaseAdmin, supabaseAdmin } from '@/lib/supabase-admin'

async function canBootstrap() {
  if (!supabaseAdmin) return false
  const { data } = await supabaseAdmin
    .from('staff_users')
    .select('id,auth_user_id,role')
    .eq('role', 'manager')

  return !(data || []).some(user => !!user.auth_user_id)
}

export async function GET() {
  if (!hasSupabaseAdmin()) {
    return NextResponse.json({ canBootstrap: false, setupReady: false, message: 'SUPABASE_SERVICE_ROLE_KEY is missing' })
  }
  return NextResponse.json({ canBootstrap: await canBootstrap(), setupReady: true })
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Server auth setup is incomplete. Add SUPABASE_SERVICE_ROLE_KEY first.' }, { status: 500 })
  }
  if (!(await canBootstrap())) {
    return NextResponse.json({ error: 'Bootstrap already completed' }, { status: 403 })
  }

  const body = await request.json()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const name = String(body.name || 'Samir Abattouy').trim()

  if (!email || !password || !name) {
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

  const { data: existing } = await supabaseAdmin
    .from('staff_users')
    .select('id')
    .eq('name', name)
    .maybeSingle()

  if (existing) {
    await supabaseAdmin.from('staff_users').update({
      auth_user_id: created.user.id,
      email,
      role: 'manager',
      mfa_required: true,
      is_active: true,
    }).eq('id', existing.id)
  } else {
    await supabaseAdmin.from('staff_users').insert({
      name,
      auth_user_id: created.user.id,
      email,
      role: 'manager',
      mfa_required: true,
      is_active: true,
    })
  }

  return NextResponse.json({ ok: true })
}
