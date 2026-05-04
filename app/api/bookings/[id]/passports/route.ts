import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { getPassportUploads } from '@/lib/modules/portal/portal.repository'
import { supabase } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  const { currentStaff } = await getAccessContext(token)
  if (!currentStaff) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const bookingId = Number(id)
  const uploads = await getPassportUploads(bookingId)

  // Join with passenger names
  const { data: passengers } = await supabase
    .from('booking_passengers')
    .select('id, first_name, last_name, passenger_type')
    .eq('booking_id', bookingId)

  const passengerMap = new Map((passengers ?? []).map(p => [p.id, p]))

  const enriched = await Promise.all(uploads.map(async u => {
    const p = passengerMap.get(u.passenger_id)
    let signed_url: string | null = null
    if (u.storage_path && supabaseAdmin) {
      const { data: urlData } = await supabaseAdmin.storage
        .from('passport-uploads')
        .createSignedUrl(u.storage_path, 3600)
      signed_url = urlData?.signedUrl ?? null
    }
    return {
      id:                  u.id,
      passenger_id:        u.passenger_id,
      passenger_name:      p ? `${p.first_name} ${p.last_name}` : 'Unknown',
      passenger_type:      p?.passenger_type ?? null,
      status:              u.status,
      storage_path:        u.storage_path,
      signed_url,
      uploaded_at:         u.uploaded_at,
      issue_note:          u.issue_note,
      checked_at:          u.checked_at,
      checked_by_staff_id: u.checked_by_staff_id,
    }
  }))

  return NextResponse.json({ success: true, data: enriched })
}
