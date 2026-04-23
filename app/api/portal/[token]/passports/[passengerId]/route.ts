import { NextRequest, NextResponse } from 'next/server'
import { validatePortalToken } from '@/lib/modules/portal/portal.service'
import { upsertPassportUpload } from '@/lib/modules/portal/portal.repository'
import { supabase } from '@/lib/supabase'

const MAX_FILE_BYTES = 10 * 1024 * 1024 // 10 MB
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; passengerId: string }> }
) {
  const { token, passengerId: passengerIdStr } = await params
  const validation = await validatePortalToken(token)
  if (!validation.valid) {
    return NextResponse.json({ success: false, reason: validation.reason }, { status: 410 })
  }

  const passengerId = Number(passengerIdStr)
  if (!passengerId) return NextResponse.json({ success: false, message: 'Invalid passenger' }, { status: 400 })

  const formData = await req.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, message: 'No file provided' }, { status: 400 })
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ success: false, message: 'File must be under 10 MB' }, { status: 400 })
  }

  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ success: false, message: 'Only JPG, PNG, WebP or PDF accepted' }, { status: 400 })
  }

  const ext = file.name.split('.').pop() ?? 'bin'
  const storagePath = `${validation.bookingId}/${passengerId}/${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('passport-uploads')
    .upload(storagePath, file, { upsert: true, contentType: file.type })

  if (uploadError) {
    console.error('[passport upload]', uploadError)
    return NextResponse.json({ success: false, message: 'Upload failed' }, { status: 500 })
  }

  await upsertPassportUpload({
    booking_id:   validation.bookingId,
    passenger_id: passengerId,
    status:       'uploaded',
    storage_path: storagePath,
    uploaded_at:  new Date().toISOString(),
  })

  return NextResponse.json({ success: true, status: 'uploaded' })
}
