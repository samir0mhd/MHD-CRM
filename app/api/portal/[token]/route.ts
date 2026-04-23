import { NextRequest, NextResponse } from 'next/server'
import { validatePortalToken, assemblePortalView } from '@/lib/modules/portal/portal.service'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const validation = await validatePortalToken(token)

  if (!validation.valid) {
    return NextResponse.json(
      { success: false, reason: validation.reason },
      { status: validation.reason === 'not_found' ? 404 : 410 }
    )
  }

  const view = await assemblePortalView(validation.bookingId)
  if (!view) {
    return NextResponse.json({ success: false, reason: 'booking_not_found' }, { status: 404 })
  }

  return NextResponse.json({ success: true, data: view })
}
