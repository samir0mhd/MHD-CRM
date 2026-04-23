import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { revokeAllBookingTokens } from '@/lib/modules/portal/portal.repository'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  const { currentStaff } = await getAccessContext(token)
  if (!currentStaff) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const bookingId = Number(id)
  if (!bookingId) return NextResponse.json({ success: false, message: 'Invalid booking' }, { status: 400 })

  await revokeAllBookingTokens(bookingId)
  return new NextResponse(null, { status: 204 })
}
