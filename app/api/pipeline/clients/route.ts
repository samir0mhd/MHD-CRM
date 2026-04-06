import { NextRequest, NextResponse } from 'next/server'
import { searchPipelineClients } from '@/lib/modules/deals/deal.service'

export async function GET(request: NextRequest) {
  try {
    const query = request.nextUrl.searchParams.get('q') || ''
    const results = await searchPipelineClients(query)
    return NextResponse.json(results)
  } catch (error) {
    console.error('Error searching pipeline clients:', error)
    return NextResponse.json({ error: 'Failed to search clients' }, { status: 500 })
  }
}
