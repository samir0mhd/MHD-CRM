import { NextRequest, NextResponse } from 'next/server'
import { validatePortalToken } from '@/lib/modules/portal/portal.service'
import { markNotificationRead } from '@/lib/modules/portal/portal.repository'

export async function PATCH(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string; notificationId: string }> }
) {
  const { token, notificationId } = await params
  const validation = await validatePortalToken(token)
  if (!validation.valid) {
    return NextResponse.json({ success: false, reason: validation.reason }, { status: 410 })
  }

  await markNotificationRead(notificationId, validation.bookingId)
  return new NextResponse(null, { status: 204 })
}
