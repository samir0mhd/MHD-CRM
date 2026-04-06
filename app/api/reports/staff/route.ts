import { NextRequest, NextResponse } from 'next/server'
import * as reportsService from '@/lib/modules/reports/reports.service'
import { requireManager } from '@/lib/modules/auth/auth.service'

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  if (!token) {
    return NextResponse.json({ error: 'Missing token' }, { status: 401 })
  }

  const auth = await requireManager(token)
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status })
  }

  try {
    const body = await request.json()
    const { error } = await reportsService.createStaffUser(body)

    if (error) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create staff user'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
