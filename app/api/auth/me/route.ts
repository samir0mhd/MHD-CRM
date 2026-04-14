import { NextResponse } from 'next/server'
import { authenticateUser } from '@/lib/modules/auth/auth.service'
import { getAccessContext, isManager } from '@/lib/access'

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

  const { staffUsers } = await getAccessContext(token)
  const workspaceUsers = isManager(result.staffUser)
    ? staffUsers.map(user => ({
        id: user.id,
        name: user.name,
        role: user.role,
        job_title: user.job_title,
      }))
    : []

  return NextResponse.json({
    ...result,
    workspaceUsers,
  })
}
