import { NextResponse } from 'next/server'
import * as lostService from '@/lib/modules/lost/lost.service'

export async function GET() {
  try {
    const deals = await lostService.fetchLostDeals()
    return NextResponse.json(deals)
  } catch (error) {
    console.error('Error loading lost deals:', error)
    return NextResponse.json({ error: 'Failed to load lost deals' }, { status: 500 })
  }
}
