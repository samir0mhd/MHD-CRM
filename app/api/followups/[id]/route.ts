import { NextRequest, NextResponse } from 'next/server'
import * as followupService from '@/lib/modules/followups/followup.service'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()

    if (body.action === 'skip') {
      const { error } = await followupService.skipFollowUp(Number(id))
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'reset') {
      const { error } = await followupService.resetFollowUp(Number(id))
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    const { error } = await followupService.saveEmailDraft(Number(id), body.email_subject || '', body.email_body || '')
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update follow-up'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
