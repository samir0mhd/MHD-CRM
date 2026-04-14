import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext, isManager } from '@/lib/access'
import { getPendingManagerRequests } from '@/lib/modules/manager/requests.service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)

    if (!currentStaff) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    if (!isManager(currentStaff)) {
      return NextResponse.json({ error: 'Manager access required' }, { status: 403 })
    }

    const requests = await getPendingManagerRequests()
    return NextResponse.json({ requests })
  } catch (error) {
    console.error('[manager/requests] Error loading requests:', error)
    return NextResponse.json({ error: 'Failed to load requests' }, { status: 500 })
  }
}
