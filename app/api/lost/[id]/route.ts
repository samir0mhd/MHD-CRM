import { NextRequest, NextResponse } from 'next/server'
import * as lostService from '@/lib/modules/lost/lost.service'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const deal = { id: Number(id) }

    if (body.action === 'reopen') {
      const result = await lostService.reopenLostDeal(deal)
      if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    if (body.action === 'schedule_winback') {
      const { error } = await lostService.scheduleWinback(deal, Number(body.days) || 0, body.structured_reason ?? null)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update lost deal'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
