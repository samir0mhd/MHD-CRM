import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { updateRequestStatus } from '@/lib/modules/portal/portal.repository'
import type { RequestStatus } from '@/lib/modules/portal/portal.types'

const VALID_STATUSES: RequestStatus[] = ['seen', 'actioned']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; requestId: string }> }
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  const { currentStaff } = await getAccessContext(token)
  if (!currentStaff) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const { requestId } = await params
  const body = await req.json()
  const status: RequestStatus = body.status

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 })
  }

  const now = new Date().toISOString()

  await updateRequestStatus(requestId, {
    status,
    seen_at:              status === 'seen' ? now : undefined,
    actioned_at:          status === 'actioned' ? now : undefined,
    actioned_by_staff_id: status === 'actioned' ? currentStaff.id : undefined,
  })

  return NextResponse.json({ success: true })
}
