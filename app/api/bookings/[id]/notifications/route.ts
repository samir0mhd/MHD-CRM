import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { insertNotifications } from '@/lib/modules/portal/portal.repository'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  const { currentStaff } = await getAccessContext(token)
  if (!currentStaff) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const bookingId = Number(id)
  const body = await req.json()
  const message: string = (body.body ?? '').trim()

  if (!message) return NextResponse.json({ success: false, message: 'Body is required' }, { status: 400 })
  if (message.length > 500) return NextResponse.json({ success: false, message: 'Message too long' }, { status: 400 })

  await insertNotifications([{
    booking_id:    bookingId,
    type:          'general',
    body:          message,
    scheduled_for: new Date().toISOString(),
  }])

  return NextResponse.json({ success: true })
}
