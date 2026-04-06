import { NextRequest, NextResponse } from 'next/server'
import { snoozeDealAction } from '@/lib/modules/today/today.service'

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await request.json()
    await snoozeDealAction(Number(id), Number(body.days))
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to snooze action'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
