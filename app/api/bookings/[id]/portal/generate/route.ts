import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { checkPortalReadiness, generatePortalLink } from '@/lib/modules/portal/portal.service'
import { supabase } from '@/lib/supabase'

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

  // Fetch client_id and return_date from booking
  const { data: booking } = await supabase
    .from('bookings')
    .select('return_date, deal_id, deals(client_id)')
    .eq('id', bookingId)
    .single()

  if (!booking?.return_date) {
    return NextResponse.json({ success: false, message: 'Return date is required' }, { status: 422 })
  }

  // Get client_id via deal
  const dealRaw = booking.deals as unknown
  const clientId = (Array.isArray(dealRaw) ? dealRaw[0] : dealRaw as { client_id: number } | null)?.client_id
  if (!clientId) {
    return NextResponse.json({ success: false, message: 'Client not found for this booking' }, { status: 422 })
  }

  const result = await generatePortalLink(bookingId, clientId, booking.return_date, currentStaff.id)

  return NextResponse.json({ success: true, data: result })
}
