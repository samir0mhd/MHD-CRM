import { NextRequest, NextResponse } from 'next/server'
import { snoozeDealForDays } from '@/lib/modules/deals/deal.service'
import { getAccessContext } from '@/lib/access'

// POST /api/pipeline/snooze - Snooze a deal for N days
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)

    if (!currentStaff) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { dealId, days } = body

    if (!dealId || !days || days < 1) {
      return NextResponse.json({ success: false, message: 'Invalid request' }, { status: 400 })
    }

    const result = await snoozeDealForDays(dealId, days)

    if (!result.success) {
      return NextResponse.json({ success: false, message: 'Failed to snooze deal' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Snoozed ${days} day${days > 1 ? 's' : ''}`
    })
  } catch (error) {
    console.error('Error snooping deal:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to snooze deal'
    }, { status: 500 })
  }
}
