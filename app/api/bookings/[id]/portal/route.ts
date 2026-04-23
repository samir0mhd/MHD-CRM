import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { checkPortalReadiness, getPortalTokenMeta } from '@/lib/modules/portal/portal.service'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  const { currentStaff } = await getAccessContext(token)
  if (!currentStaff) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const bookingId = Number(id)
  if (!bookingId) return NextResponse.json({ success: false, message: 'Invalid booking' }, { status: 400 })

  const [readiness, tokenMeta] = await Promise.all([
    checkPortalReadiness(bookingId),
    getPortalTokenMeta(bookingId),
  ])

  return NextResponse.json({ success: true, data: { readiness, token: tokenMeta } })
}
