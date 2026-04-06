import { NextResponse } from 'next/server'
import { requireManager, createStaffUser } from '@/lib/modules/auth/auth.service'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  }

  const auth = await requireManager(token)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  const body = await request.json()
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()
  const password = String(body.password || '')
  const role = String(body.role || 'sales')
  const mfaRequired = !!body.mfaRequired

  const result = await createStaffUser({ name, email, password, role, mfaRequired })

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json({ ok: true })
}
