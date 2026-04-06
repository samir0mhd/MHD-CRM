import { NextRequest, NextResponse } from 'next/server'
import { moveDealToStage } from '@/lib/modules/deals/deal.service'
import { getAccessContext } from '@/lib/access'

// POST /api/pipeline/move - Move a deal to a different stage
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)

    if (!currentStaff) {
      return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { dealId, newStage, stageLabel } = body

    if (!dealId || !newStage || !stageLabel) {
      return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 })
    }

    const result = await moveDealToStage(dealId, newStage, stageLabel)

    if (!result.success) {
      return NextResponse.json({ success: false, message: 'Failed to move deal' }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: `Moved to ${stageLabel}`
    })
  } catch (error) {
    console.error('Error moving deal:', error)
    return NextResponse.json({
      success: false,
      message: 'Failed to move deal'
    }, { status: 500 })
  }
}
