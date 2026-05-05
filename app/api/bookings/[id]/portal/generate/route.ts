import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { checkPortalReadiness, generatePortalLink, getPortalGenerationContext } from '@/lib/modules/portal/portal.service'

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

  const readiness = await checkPortalReadiness(bookingId)
  if (!readiness.ready) {
    return NextResponse.json({ success: false, message: 'Booking is not portal-ready', missing: readiness.missing }, { status: 422 })
  }

  const { clientId, tripEndDate } = await getPortalGenerationContext(bookingId)
  if (!clientId) {
    return NextResponse.json({ success: false, message: 'Client not found for this booking' }, { status: 422 })
  }
  if (!tripEndDate) {
    return NextResponse.json({ success: false, message: 'Trip end date is required' }, { status: 422 })
  }

  const result = await generatePortalLink(bookingId, clientId, tripEndDate, currentStaff.id)

  return NextResponse.json({ success: true, data: result })
}
