import { NextRequest, NextResponse } from 'next/server'
import * as followupService from '@/lib/modules/followups/followup.service'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const result = await followupService.sendFollowUp(body)
    return NextResponse.json(result)
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to send email'
    const status = message === 'Missing required fields' ? 400 : 500
    return NextResponse.json({ error: message }, { status })
  }
}
