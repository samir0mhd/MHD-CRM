import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { getPassportUpload, updatePassportStatus } from '@/lib/modules/portal/portal.repository'
import type { PassportStatus } from '@/lib/modules/portal/portal.types'

const VALID_STATUSES: PassportStatus[] = ['checked', 'needs_attention']

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; uploadId: string }> }
) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '') ?? null
  const { currentStaff } = await getAccessContext(token)
  if (!currentStaff) return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })

  const { id, uploadId } = await params
  const bookingId = Number(id)
  const body = await req.json()
  const status: PassportStatus = body.status
  const issueNote: string | null = body.issue_note ?? null

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ success: false, message: 'Invalid status' }, { status: 400 })
  }

  const upload = await getPassportUpload(uploadId)
  if (!upload || upload.booking_id !== bookingId) {
    return NextResponse.json({ success: false, message: 'Not found' }, { status: 404 })
  }

  await updatePassportStatus(uploadId, {
    status,
    issue_note:          status === 'needs_attention' ? issueNote : null,
    checked_at:          status === 'checked' ? new Date().toISOString() : null,
    checked_by_staff_id: status === 'checked' ? currentStaff.id : null,
  })

  return NextResponse.json({ success: true })
}

