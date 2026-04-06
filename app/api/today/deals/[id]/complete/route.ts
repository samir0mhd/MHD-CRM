import { NextRequest, NextResponse } from 'next/server'
import { completeDealAction } from '@/lib/modules/today/today.service'

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await _request.json()
    await completeDealAction({
      id: Number(id),
      stage: body.stage,
      next_activity_type: body.next_activity_type,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete action'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
