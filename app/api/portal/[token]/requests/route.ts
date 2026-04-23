import { NextRequest, NextResponse } from 'next/server'
import { validatePortalToken } from '@/lib/modules/portal/portal.service'
import { insertClientRequest } from '@/lib/modules/portal/portal.repository'
import { REQUEST_CATEGORY_LABEL, REQUEST_STATUS_LABEL, type RequestCategory } from '@/lib/modules/portal/portal.types'

const VALID_CATEGORIES: RequestCategory[] = ['room', 'dietary', 'celebration', 'accessibility', 'general']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const validation = await validatePortalToken(token)
  if (!validation.valid) {
    return NextResponse.json({ success: false, reason: validation.reason }, { status: 410 })
  }

  const body = await req.json()
  const category: RequestCategory = body.category
  const message: string = (body.message ?? '').trim()

  if (!VALID_CATEGORIES.includes(category)) {
    return NextResponse.json({ success: false, message: 'Invalid category' }, { status: 400 })
  }
  if (!message) {
    return NextResponse.json({ success: false, message: 'Message is required' }, { status: 400 })
  }
  if (message.length > 1000) {
    return NextResponse.json({ success: false, message: 'Message too long' }, { status: 400 })
  }

  const { data } = await insertClientRequest({
    booking_id: validation.bookingId,
    category,
    message,
  })

  return NextResponse.json({
    success: true,
    data: {
      id:             data?.id,
      category,
      category_label: REQUEST_CATEGORY_LABEL[category],
      message,
      status_label:   REQUEST_STATUS_LABEL['submitted'],
      created_at:     new Date().toISOString(),
    },
  })
}
