import { NextRequest, NextResponse } from 'next/server'
import { createPipelineDeal, fetchPipelineDeals } from '@/lib/modules/deals/deal.service'
import { getAccessContext } from '@/lib/access'

export async function GET() {
  try {
    const deals = await fetchPipelineDeals()
    return NextResponse.json(deals)
  } catch (error) {
    console.error('Error loading pipeline deals:', error)
    return NextResponse.json({ error: 'Failed to load pipeline deals' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '') ?? null
    const { currentStaff } = await getAccessContext(token)
    if (!currentStaff) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const result = await createPipelineDeal(body, currentStaff)
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create deal'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
