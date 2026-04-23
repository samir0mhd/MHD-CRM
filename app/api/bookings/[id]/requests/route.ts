import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { getClientRequests } from '@/lib/modules/portal/portal.repository'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  const { currentStaff } = await getAccessContext(token)
  if (!currentStaff) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const bookingId = Number(id)
  const requests = await getClientRequests(bookingId)

  return NextResponse.json({ success: true, data: requests })
}
