import { NextRequest, NextResponse } from 'next/server'
import { getAccessContext } from '@/lib/access'
import { saveNextAction } from '@/lib/modules/deals/deal.service'
import { toDateOnly } from '@/lib/modules/deals/next-action'

function authToken(request: NextRequest) {
  return request.headers.get('authorization')?.replace('Bearer ', '') ?? null
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { currentStaff } = await getAccessContext(authToken(request))
    if (!currentStaff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const body = await request.json().catch(() => ({}))
    const saved = await saveNextAction(
      Number(id),
      typeof body.actionType === 'string' ? body.actionType : null,
      typeof body.dueDate === 'string' ? body.dueDate : null,
      typeof body.actionNote === 'string' ? body.actionNote : null,
    )

    return NextResponse.json({
      nextAction: {
        actionType: saved.next_activity_type,
        dueDate: toDateOnly(saved.next_activity_at),
        actionNote: saved.next_activity_note,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save next action'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
