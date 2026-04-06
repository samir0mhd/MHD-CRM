import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/modules/auth/auth.service'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ user: null, staffUser: null }, { status: 200 })
  }

  const result = await authenticateUser(token)

  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  return NextResponse.json(result)
}
