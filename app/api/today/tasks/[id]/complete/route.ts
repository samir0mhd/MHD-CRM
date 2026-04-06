import { NextResponse } from 'next/server'
import { completeTask } from '@/lib/modules/today/today.service'
import { getAccessContext } from '@/lib/access'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const token = _request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)
    const { error } = await completeTask(Number(id), currentStaff)
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return NextResponse.json({ success: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to complete task'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
